import { GameEvent, Input, MatchConfig, PickupKind, PlaneType, PlayerSlot, World } from '../sim/types';

export const PROTOCOL_VERSION = 2;
export const DISCOVERY_PORT = 47777;
export const GAME_PORT = 47778;
export const MAX_PLAYERS = 8;
/** Magic tag so we ignore unrelated UDP traffic. */
export const DISCOVERY_TAG = 'AEROFIGHTER';

export interface LobbyPlayer {
  id: string;
  name: string;
  team: number;
  type: PlaneType;
  ready: boolean;
  isBot: boolean;
  isHost: boolean;
}

export interface LobbyState {
  hostName: string;
  config: MatchConfig;
  bots: number;
  players: LobbyPlayer[];
}

// ---- Discovery (UDP) ----
export type DiscoveryMsg =
  | { tag: typeof DISCOVERY_TAG; t: 'probe'; v: number }
  | { tag: typeof DISCOVERY_TAG; t: 'announce'; v: number; name: string; mode: string; players: number; max: number; port: number; open: boolean };

// ---- Game connection (TCP, newline-delimited JSON) ----
export type ClientMsg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'setup'; team?: number; type?: PlaneType; ready?: boolean }
  | { t: 'input'; seq: number; a: number | null; th: number; f: 0 | 1; m: 0 | 1; s?: 0 | 1 }
  | { t: 'ping'; ts: number }
  | { t: 'bye' };

export type HostMsg =
  | { t: 'welcome'; id: string }
  | { t: 'reject'; reason: string }
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'start'; config: MatchConfig; slots: PlayerSlot[]; seed: number }
  | { t: 'snap'; s: Snapshot; e: GameEvent[] }
  | { t: 'pong'; ts: number }
  | { t: 'closed'; reason: string };

// ---- Snapshots ----
// Plane: [id, x, y, angle, speed, hp, flags, kills, deaths, missiles, specialCd, caps]
export type SnapPlane = [string, number, number, number, number, number, number, number, number, number, number, number];
// Flag: [team, x, y, carrierId | null, droppedAt | null]
export type SnapFlag = [number, number, number, string | null, number | null];
export interface Snapshot {
  k: number; // tick
  tm: number; // world time
  ts: [number, number];
  P: SnapPlane[];
  B: [number, number, number, number, number][]; // id, x, y, vx, vy
  M: [number, number, number, number][]; // id, x, y, angle
  K: [number, PickupKind, number, number][]; // id, kind, x, y
  F?: SnapFlag[];
  end?: { w: string | null; wt: number | null };
}

const F_ALIVE = 1, F_SHIELD = 2, F_BOOST = 4, F_PROTECT = 8, F_OOB = 16, F_DASH = 32, F_FLARE = 64;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function encodeSnapshot(w: World): Snapshot {
  const t = w.time;
  return {
    k: w.tick,
    tm: r3(t),
    ts: [w.teamScores[0], w.teamScores[1]],
    P: w.planes.map((p) => [
      p.id, r1(p.x), r1(p.y), r3(p.angle), r1(p.speed), Math.ceil(p.hp),
      (p.alive ? F_ALIVE : 0) | (t < p.shieldUntil ? F_SHIELD : 0) | (t < p.boostUntil ? F_BOOST : 0) |
        (t < p.spawnProtectUntil ? F_PROTECT : 0) | (p.outOfBoundsTime > 0 ? F_OOB : 0) |
        (t < p.dashUntil ? F_DASH : 0) | (t < p.flareUntil ? F_FLARE : 0),
      p.kills, p.deaths, p.missiles, r1(p.specialCd), p.caps,
    ]),
    B: w.bullets.map((b) => [b.id, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy)]),
    F: w.flags.length ? w.flags.map((f) => [f.team, r1(f.x), r1(f.y), f.carrier, f.droppedAt === null ? null : r3(f.droppedAt)]) : undefined,
    M: w.missiles.map((m) => [m.id, r1(m.x), r1(m.y), r3(m.angle)]),
    K: w.pickups.map((k) => [k.id, k.kind, r1(k.x), r1(k.y)]),
    end: w.ended ? { w: w.winner, wt: w.winnerTeam } : undefined,
  };
}

/**
 * Apply a snapshot onto a client-side mirror World (created with the same slots).
 * Flags are turned into short-lived timers relative to the snapshot time.
 */
export function applySnapshot(w: World, s: Snapshot): void {
  w.tick = s.k;
  w.time = s.tm;
  w.teamScores = [s.ts[0], s.ts[1]];
  const far = s.tm + 0.5;
  for (const sp of s.P) {
    const p = w.planes.find((q) => q.id === sp[0]);
    if (!p) continue;
    const flags = sp[6];
    p.x = sp[1]; p.y = sp[2]; p.angle = sp[3]; p.speed = sp[4]; p.hp = sp[5];
    p.alive = (flags & F_ALIVE) !== 0;
    p.shieldUntil = flags & F_SHIELD ? far : 0;
    p.boostUntil = flags & F_BOOST ? far : 0;
    p.spawnProtectUntil = flags & F_PROTECT ? far : 0;
    p.outOfBoundsTime = flags & F_OOB ? 1 : 0;
    p.dashUntil = flags & F_DASH ? far : 0;
    p.flareUntil = flags & F_FLARE ? far : 0;
    p.kills = sp[7]; p.deaths = sp[8]; p.missiles = sp[9]; p.specialCd = sp[10] ?? 0; p.caps = sp[11] ?? 0;
  }
  // Planes that left the match.
  const ids = new Set(s.P.map((sp) => sp[0]));
  w.planes = w.planes.filter((p) => ids.has(p.id));
  w.bullets = s.B.map(([id, x, y, vx, vy]) => ({ id, x, y, vx, vy, owner: '', team: -1, life: 1, dmg: 0 }));
  w.missiles = s.M.map(([id, x, y, angle]) => ({ id, x, y, angle, owner: '', team: -1, speed: 390, target: null, life: 1 }));
  w.pickups = s.K.map(([id, kind, x, y]) => ({ id, kind, x, y }));
  if (s.F) {
    for (const [team, x, y, carrier, droppedAt] of s.F) {
      const f = w.flags.find((g) => g.team === team);
      if (!f) continue;
      f.x = x; f.y = y; f.carrier = carrier; f.droppedAt = droppedAt;
    }
  }
  if (s.end) {
    w.ended = true;
    w.winner = s.end.w;
    w.winnerTeam = s.end.wt;
  }
}

export function encodeInput(seq: number, i: Input): ClientMsg {
  return { t: 'input', seq, a: i.aim === null ? null : r3(i.aim), th: r3(i.throttle), f: i.fire ? 1 : 0, m: i.missile ? 1 : 0, s: i.special ? 1 : 0 };
}

export function decodeInput(m: Extract<ClientMsg, { t: 'input' }>): Input {
  const aim = typeof m.a === 'number' && Number.isFinite(m.a) ? m.a : null;
  const th = typeof m.th === 'number' && Number.isFinite(m.th) ? Math.max(0, Math.min(1, m.th)) : 0.5;
  return { aim, throttle: th, fire: m.f === 1, missile: m.m === 1, special: m.s === 1 };
}

/** Splits a TCP byte stream into newline-delimited JSON messages. */
export class LineDecoder {
  private buf = '';
  push(chunk: string): unknown[] {
    this.buf += chunk;
    if (this.buf.length > 1_000_000) {
      // Garbage / abuse guard.
      this.buf = '';
      return [];
    }
    const out: unknown[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // Ignore malformed line.
      }
    }
    return out;
  }
}

export function frame(msg: ClientMsg | HostMsg): string {
  return JSON.stringify(msg) + '\n';
}
