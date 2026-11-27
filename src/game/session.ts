import { botInput } from '../sim/bots';
import { collideObstacles, createWorld, DT, movePlane, removePlane, speedMult, step } from '../sim/world';
import { GameEvent, IDLE_INPUT, Input, MatchConfig, Plane, PlayerSlot, World } from '../sim/types';
import { applySnapshot, encodeInput, Snapshot } from '../net/protocol';
import type { HostServer } from '../net/hostServer';
import type { ClientConnection } from '../net/client';

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

/** What the game screen talks to, regardless of solo / host / client. */
export interface GameSession {
  readonly myId: string;
  readonly world: World;
  readonly kind: 'solo' | 'host' | 'client';
  setInput(i: Input): void;
  /** Advance by real elapsed seconds. Returns events since the last call (for effects, kill feed). */
  update(realDt: number): GameEvent[];
  /** Smoothed render pose for a plane. */
  pose(p: Plane): Pose;
  /** Seconds to extrapolate projectiles by when rendering. */
  extra(): number;
  ping(): number | null;
  dispose(): void;
}

const MAX_CATCHUP = 0.25;

/** Runs the authoritative simulation locally. Used for solo and for the host. */
export class LocalSession implements GameSession {
  readonly world: World;
  readonly kind: 'solo' | 'host';
  private input: Input = IDLE_INPUT;
  private acc = 0;
  private pending: GameEvent[] = [];
  private sinceSnap: GameEvent[] = [];

  constructor(
    readonly myId: string,
    config: MatchConfig,
    slots: PlayerSlot[],
    seed: number,
    private host: HostServer | null = null,
  ) {
    this.kind = host ? 'host' : 'solo';
    this.world = createWorld(config, slots, seed);
    if (host) host.onPlayerLeftInMatch = (id) => removePlane(this.world, id);
  }

  setInput(i: Input) {
    this.input = i;
  }

  update(realDt: number): GameEvent[] {
    this.acc = Math.min(this.acc + realDt, MAX_CATCHUP);
    while (this.acc >= DT) {
      this.acc -= DT;
      const w = this.world;
      if (w.ended) break;
      const inputs: Record<string, Input> = this.host ? this.host.remoteInputs() : {};
      inputs[this.myId] = this.input;
      for (const p of w.planes) if (p.isBot) inputs[p.id] = botInput(w, p);
      step(w, inputs);
      this.pending.push(...w.events);
      this.sinceSnap.push(...w.events);
      w.events = [];
      // Snapshots at 20 Hz (2 of every 3 ticks), and always on match end.
      if (this.host && (w.tick % 3 !== 0 || w.ended)) {
        this.host.sendSnapshot(w, this.sinceSnap);
        this.sinceSnap = [];
      }
    }
    const out = this.pending;
    this.pending = [];
    return out;
  }

  pose(p: Plane): Pose {
    // Extrapolate the partial tick for smooth 60 fps rendering.
    const t = p.alive ? this.acc : 0;
    return { x: p.x + Math.cos(p.angle) * p.speed * t, y: p.y + Math.sin(p.angle) * p.speed * t, angle: p.angle };
  }

  extra() {
    return this.acc;
  }

  ping() {
    return null;
  }

  dispose() {
    if (this.host) this.host.onPlayerLeftInMatch = null;
  }
}

/** Mirrors the host's world from snapshots, predicting our own plane locally. */
export class RemoteSession implements GameSession {
  readonly kind = 'client';
  readonly world: World;
  private input: Input = IDLE_INPUT;
  private seq = 0;
  private sendAcc = 0;
  private sinceSnap = 0;
  private pending: GameEvent[] = [];
  private pred: Plane | null = null;
  private wasAlive = true;

  constructor(
    readonly myId: string,
    config: MatchConfig,
    slots: PlayerSlot[],
    seed: number,
    private conn: ClientConnection,
  ) {
    this.world = createWorld(config, slots, seed);
  }

  /** Called by the connection router for every snapshot from the host. */
  onSnap(s: Snapshot, e: GameEvent[]) {
    if (s.k < this.world.tick) return; // stale
    applySnapshot(this.world, s);
    this.sinceSnap = 0;
    this.pending.push(...e);
    const me = this.world.planes.find((p) => p.id === this.myId);
    if (!me) return;
    if (!this.pred || !me.alive || !this.wasAlive) {
      this.pred = { ...me };
    } else {
      // Reconcile: snap if far off, otherwise blend towards the server.
      const dx = me.x - this.pred.x;
      const dy = me.y - this.pred.y;
      if (dx * dx + dy * dy > 180 * 180) {
        this.pred = { ...me };
      } else {
        this.pred.x += dx * 0.2;
        this.pred.y += dy * 0.2;
        const da = Math.atan2(Math.sin(me.angle - this.pred.angle), Math.cos(me.angle - this.pred.angle));
        this.pred.angle += da * 0.2;
        this.pred.speed = me.speed;
        this.pred.type = me.type;
      }
    }
    this.wasAlive = me.alive;
  }

  setInput(i: Input) {
    this.input = i;
  }

  update(realDt: number): GameEvent[] {
    this.sinceSnap += realDt;
    // Send input ~30 times a second.
    this.sendAcc += realDt;
    if (this.sendAcc >= DT) {
      this.sendAcc = 0;
      this.conn.send(encodeInput(++this.seq, this.input));
    }
    const me = this.world.planes.find((p) => p.id === this.myId);
    if (this.pred && me?.alive && !this.world.ended) {
      // Predict with the server's latest speed modifiers (boost/dash/flag) for our plane.
      const mult = speedMult(this.world, me);
      movePlane(this.pred, this.input, Math.min(realDt, 0.1), mult);
      collideObstacles(this.pred, this.world.obstacles);
    }
    const out = this.pending;
    this.pending = [];
    return out;
  }

  pose(p: Plane): Pose {
    if (p.id === this.myId && this.pred && p.alive) return { x: this.pred.x, y: this.pred.y, angle: this.pred.angle };
    const t = p.alive ? Math.min(this.sinceSnap, 0.15) : 0;
    return { x: p.x + Math.cos(p.angle) * p.speed * t, y: p.y + Math.sin(p.angle) * p.speed * t, angle: p.angle };
  }

  extra() {
    return Math.min(this.sinceSnap, 0.15);
  }

  ping() {
    return this.conn.rtt;
  }

  dispose() {}
}
