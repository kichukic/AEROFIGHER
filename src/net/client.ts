import TcpSocket from 'react-native-tcp-socket';
import { MatchConfig, PlayerSlot, GameEvent } from '../sim/types';
import { ClientMsg, GAME_PORT, HostMsg, LineDecoder, LobbyState, PROTOCOL_VERSION, Snapshot, frame } from './protocol';

type Sock = ReturnType<typeof TcpSocket.createConnection>;

export interface ClientListener {
  onLobby?: (l: LobbyState) => void;
  onStart?: (config: MatchConfig, slots: PlayerSlot[], seed: number) => void;
  onSnap?: (s: Snapshot, e: GameEvent[]) => void;
  onClosed?: (reason: string) => void;
}

export class ClientConnection {
  id = '';
  rtt: number | null = null;
  lobby: LobbyState | null = null;
  private sock: Sock | null = null;
  private decoder = new LineDecoder();
  private listener: ClientListener = {};
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  setListener(l: ClientListener) {
    this.listener = l;
  }

  connect(ip: string, name: string, port = GAME_PORT, timeoutMs = 6000): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail('Could not reach host (timeout)'), timeoutMs);
      const sock = TcpSocket.createConnection({ host: ip, port }, () => {
        try { sock.setNoDelay(true); } catch { /* ignore */ }
        this.send({ t: 'hello', v: PROTOCOL_VERSION, name });
      });
      this.sock = sock;
      sock.setEncoding?.('utf8');
      sock.on('data', (d: string | { toString(enc: 'utf8'): string }) => {
        for (const raw of this.decoder.push(typeof d === 'string' ? d : d.toString('utf8'))) {
          const m = raw as HostMsg;
          if (!settled) {
            if (m.t === 'welcome') {
              settled = true;
              clearTimeout(timer);
              this.id = m.id;
              this.startPing();
              resolve();
              continue;
            }
            if (m.t === 'reject') {
              clearTimeout(timer);
              fail(m.reason);
              return;
            }
          }
          this.onMessage(m);
        }
      });
      sock.on('error', (e: Error) => {
        clearTimeout(timer);
        if (!settled) fail(e?.message || 'Connection failed');
        else this.handleClosed('Connection lost');
      });
      sock.on('close', () => {
        clearTimeout(timer);
        if (!settled) fail('Connection closed');
        else this.handleClosed('Host disconnected');
      });
    });
  }

  private startPing() {
    this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: Date.now() }), 1000);
  }

  private onMessage(m: HostMsg) {
    switch (m.t) {
      case 'lobby':
        this.lobby = m.lobby;
        this.listener.onLobby?.(m.lobby);
        break;
      case 'start':
        this.listener.onStart?.(m.config, m.slots, m.seed);
        break;
      case 'snap':
        this.listener.onSnap?.(m.s, m.e);
        break;
      case 'pong':
        this.rtt = Date.now() - m.ts;
        break;
      case 'closed':
        this.handleClosed(m.reason);
        break;
    }
  }

  private handleClosed(reason: string) {
    if (this.closed) return;
    this.close();
    this.listener.onClosed?.(reason);
  }

  send(m: ClientMsg) {
    if (!this.sock || this.closed) return;
    try {
      this.sock.write(frame(m));
    } catch {
      this.handleClosed('Connection lost');
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    try {
      this.sock?.write(frame({ t: 'bye' }));
      this.sock?.destroy();
    } catch {
      // ignore
    }
    this.sock = null;
  }
}
