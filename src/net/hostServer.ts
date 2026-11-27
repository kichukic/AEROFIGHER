import TcpSocket from 'react-native-tcp-socket';
import { configFor, DEFAULT_CONFIG } from '../sim/world';
import { GameEvent, IDLE_INPUT, Input, MatchConfig, PlaneType, PlayerSlot, World } from '../sim/types';
import {
  ClientMsg, GAME_PORT, HostMsg, LineDecoder, LobbyState, MAX_PLAYERS, PROTOCOL_VERSION,
  decodeInput, encodeSnapshot, frame,
} from './protocol';
import { startAnnouncer } from './discovery';

type Sock = ReturnType<typeof TcpSocket.createConnection>;

interface Conn {
  id: string;
  sock: Sock;
  decoder: LineDecoder;
  input: Input;
  lastSeq: number;
  welcomed: boolean;
}

const BOT_NAMES = ['Viper', 'Falcon', 'Ghost', 'Raptor', 'Hawk', 'Talon', 'Blaze', 'Storm'];

export type HostListener = {
  onLobby?: (l: LobbyState) => void;
  onPlayerLeft?: (id: string) => void;
  onError?: (msg: string) => void;
};

export class HostServer {
  lobby: LobbyState;
  inMatch = false;
  private conns = new Map<string, Conn>();
  private server: ReturnType<typeof TcpSocket.createServer> | null = null;
  private stopAnnouncer: (() => void) | null = null;
  private nextId = 1;
  private listeners: HostListener = {};
  /** Set by the running match so it can remove planes of players who disconnect. */
  onPlayerLeftInMatch: ((id: string) => void) | null = null;

  constructor(hostName: string, hostType: PlaneType = 'fighter') {
    this.lobby = {
      hostName,
      config: { ...DEFAULT_CONFIG },
      bots: 0,
      players: [{ id: 'host', name: hostName, team: 0, type: hostType, ready: true, isBot: false, isHost: true }],
    };
  }

  setListener(l: HostListener) {
    this.listeners = l;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const server = TcpSocket.createServer({ noDelay: true, keepAlive: true }, (sock) => this.onConnection(sock as Sock));
      server.on('error', (e: Error) => {
        this.listeners.onError?.(String(e?.message ?? e));
        reject(e);
      });
      server.listen({ port: GAME_PORT, host: '0.0.0.0', reuseAddress: true }, () => resolve());
      this.server = server;
    });
    this.stopAnnouncer = await startAnnouncer(() => ({
      name: this.lobby.hostName,
      mode: this.lobby.config.mode,
      players: this.humanCount(),
      max: MAX_PLAYERS,
      port: GAME_PORT,
      open: !this.inMatch && this.humanCount() < MAX_PLAYERS,
    }));
  }

  stop(reason = 'Host closed the game') {
    this.broadcast({ t: 'closed', reason });
    this.stopAnnouncer?.();
    this.stopAnnouncer = null;
    for (const c of this.conns.values()) {
      try { c.sock.end(); } catch { /* ignore */ }
    }
    this.conns.clear();
    try { this.server?.close(); } catch { /* ignore */ }
    this.server = null;
  }

  private humanCount() {
    return this.lobby.players.filter((p) => !p.isBot).length;
  }

  private onConnection(sock: Sock) {
    const id = 'p' + this.nextId++;
    const conn: Conn = { id, sock, decoder: new LineDecoder(), input: IDLE_INPUT, lastSeq: -1, welcomed: false };
    try { sock.setNoDelay(true); } catch { /* ignore */ }
    sock.setEncoding?.('utf8');
    sock.on('data', (d: string | { toString(enc: 'utf8'): string }) => {
      for (const m of conn.decoder.push(typeof d === 'string' ? d : d.toString('utf8'))) this.onMessage(conn, m as ClientMsg);
    });
    const drop = () => this.dropConn(conn);
    sock.on('close', drop);
    sock.on('error', drop);
  }

  private dropConn(conn: Conn) {
    if (!this.conns.has(conn.id)) return;
    this.conns.delete(conn.id);
    this.lobby.players = this.lobby.players.filter((p) => p.id !== conn.id);
    if (this.inMatch) {
      this.listeners.onPlayerLeft?.(conn.id);
      this.onPlayerLeftInMatch?.(conn.id);
    }
    this.lobbyChanged();
  }

  private send(conn: Conn, msg: HostMsg) {
    try { conn.sock.write(frame(msg)); } catch { this.dropConn(conn); }
  }

  private broadcast(msg: HostMsg) {
    const data = frame(msg);
    for (const c of this.conns.values()) {
      if (!c.welcomed) continue;
      try { c.sock.write(data); } catch { /* dropped on close */ }
    }
  }

  private onMessage(conn: Conn, m: ClientMsg) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello': {
        if (conn.welcomed) return;
        const reject = (reason: string) => {
          try { conn.sock.write(frame({ t: 'reject', reason })); conn.sock.end(); } catch { /* ignore */ }
        };
        if (m.v !== PROTOCOL_VERSION) return reject('Game version mismatch — update the app');
        if (this.inMatch) return reject('A match is already in progress');
        if (this.humanCount() >= MAX_PLAYERS) return reject('Game is full');
        conn.welcomed = true;
        this.conns.set(conn.id, conn);
        const name = String(m.name || 'Pilot').slice(0, 16);
        this.lobby.players.push({ id: conn.id, name, team: this.pickTeam(), type: 'fighter', ready: false, isBot: false, isHost: false });
        this.trimBots();
        this.send(conn, { t: 'welcome', id: conn.id });
        this.lobbyChanged();
        break;
      }
      case 'setup': {
        const p = this.lobby.players.find((q) => q.id === conn.id);
        if (!p || this.inMatch) return;
        if (m.team === 0 || m.team === 1) p.team = m.team;
        if (m.type === 'interceptor' || m.type === 'fighter' || m.type === 'bomber') p.type = m.type;
        if (typeof m.ready === 'boolean') p.ready = m.ready;
        this.lobbyChanged();
        break;
      }
      case 'input': {
        if (typeof m.seq !== 'number' || m.seq <= conn.lastSeq) return;
        conn.lastSeq = m.seq;
        conn.input = decodeInput(m);
        break;
      }
      case 'ping':
        this.send(conn, { t: 'pong', ts: m.ts });
        break;
      case 'bye':
        this.dropConn(conn);
        try { conn.sock.end(); } catch { /* ignore */ }
        break;
    }
  }

  private pickTeam(): number {
    const t0 = this.lobby.players.filter((p) => p.team === 0).length;
    const t1 = this.lobby.players.filter((p) => p.team === 1).length;
    return t0 <= t1 ? 0 : 1;
  }

  private trimBots() {
    const room = MAX_PLAYERS - this.humanCount();
    if (this.lobby.bots > room) this.lobby.bots = Math.max(0, room);
  }

  private lobbyChanged() {
    this.broadcast({ t: 'lobby', lobby: this.lobby });
    this.listeners.onLobby?.({ ...this.lobby, players: [...this.lobby.players] });
  }

  // ---- Host UI controls ----
  setConfig(c: Partial<MatchConfig>) {
    const next = { ...this.lobby.config, ...c };
    this.lobby.config = configFor(next.mode, next.map, next);
    this.lobbyChanged();
  }
  setBots(n: number) {
    this.lobby.bots = Math.max(0, Math.min(MAX_PLAYERS - this.humanCount(), n));
    this.lobbyChanged();
  }
  setHostSetup(s: { team?: number; type?: PlaneType }) {
    const p = this.lobby.players.find((q) => q.id === 'host')!;
    if (s.team === 0 || s.team === 1) p.team = s.team;
    if (s.type) p.type = s.type;
    this.lobbyChanged();
  }
  allReady() {
    return this.lobby.players.every((p) => p.ready);
  }

  /** Build the final slot list (humans + bots) and tell every client to start. */
  startMatch(seed: number): PlayerSlot[] {
    const slots: PlayerSlot[] = this.lobby.players.map((p) => ({ id: p.id, name: p.name, team: p.team, type: p.type, isBot: false }));
    const types: PlaneType[] = ['fighter', 'interceptor', 'bomber'];
    for (let i = 0; i < this.lobby.bots; i++) {
      const t0 = slots.filter((s) => s.team === 0).length;
      const t1 = slots.filter((s) => s.team === 1).length;
      slots.push({ id: 'bot' + i, name: 'Bot ' + BOT_NAMES[i % BOT_NAMES.length], team: t0 <= t1 ? 0 : 1, type: types[i % 3], isBot: true });
    }
    this.inMatch = true;
    for (const c of this.conns.values()) { c.input = IDLE_INPUT; c.lastSeq = -1; }
    this.broadcast({ t: 'start', config: this.lobby.config, slots, seed });
    return slots;
  }

  /** Prepare an immediate rematch with the same lobby (players stay ready). */
  rematch() {
    this.inMatch = false;
  }

  /** Back to the lobby after a match ends. */
  endMatch() {
    this.inMatch = false;
    for (const p of this.lobby.players) if (!p.isHost) p.ready = false;
    this.lobbyChanged();
  }

  remoteInputs(): Record<string, Input> {
    const out: Record<string, Input> = {};
    for (const c of this.conns.values()) out[c.id] = c.input;
    return out;
  }

  sendSnapshot(w: World, events: GameEvent[]) {
    // Hit sparks are cosmetic and frequent; keep the important ones only.
    const e = events.filter((ev) => ev.t !== 'hit');
    this.broadcast({ t: 'snap', s: encodeSnapshot(w), e });
  }
}
