import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import { DISCOVERY_PORT, DISCOVERY_TAG, DiscoveryMsg, PROTOCOL_VERSION } from './protocol';
import { broadcastTargets, discoveryTargets } from './localIp';

type UdpSocket = ReturnType<typeof dgram.createSocket> & {
  on(event: string, cb: (...args: any[]) => void): void;
};
type RInfo = { address: string; port: number };

export interface FoundGame {
  ip: string;
  port: number;
  name: string;
  mode: string;
  players: number;
  max: number;
  open: boolean;
  lastSeen: number;
}

function parse(msg: Buffer | string): DiscoveryMsg | null {
  try {
    const m = JSON.parse(typeof msg === 'string' ? msg : msg.toString('utf8'));
    if (m && m.tag === DISCOVERY_TAG && m.v === PROTOCOL_VERSION) return m as DiscoveryMsg;
  } catch {
    // not ours
  }
  return null;
}

function openSocket(port: number, onMessage: (m: DiscoveryMsg, r: RInfo) => void): Promise<UdpSocket> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket({ type: 'udp4', reusePort: true }) as UdpSocket;
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(sock);
      }
    }, 2500);
    sock.on('message', (data: Buffer, rinfo: RInfo) => {
      const m = parse(data);
      if (m) onMessage(m, rinfo);
    });
    sock.on('error', (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    sock.bind(port, () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        try {
          sock.setBroadcast(true);
        } catch {
          // some devices throw if already set
        }
        resolve(sock);
      }
    });
  });
}

function send(sock: UdpSocket, msg: DiscoveryMsg, port: number, address: string) {
  const data = Buffer.from(JSON.stringify(msg), 'utf8');
  try {
    sock.send(data, 0, data.length, port, address, () => {});
  } catch {
    // ignore unreachable broadcast targets
  }
}

/**
 * Host side: answers probes from joiners (unicast reply) and also broadcasts
 * an announcement every second. Replying to probes is the reliable path on a
 * hotspot, because the host phone may not know its own hotspot IP.
 */
export async function startAnnouncer(getInfo: () => Omit<Extract<DiscoveryMsg, { t: 'announce' }>, 'tag' | 't' | 'v'>) {
  const announce = (): DiscoveryMsg => ({ tag: DISCOVERY_TAG, t: 'announce', v: PROTOCOL_VERSION, ...getInfo() });
  const sock = await openSocket(DISCOVERY_PORT, (m, r) => {
    if (m.t === 'probe') send(sock, announce(), r.port, r.address);
  });
  let targets = await broadcastTargets();
  let n = 0;
  const timer = setInterval(async () => {
    if (++n % 5 === 0) targets = await broadcastTargets();
    for (const t of targets) send(sock, announce(), DISCOVERY_PORT, t);
  }, 1000);
  return () => {
    clearInterval(timer);
    try {
      sock.close();
    } catch {
      // already closed
    }
  };
}

/** Joiner side: sends probes and collects announcements. Calls `onChange` with the current list. */
export async function startScanner(onChange: (games: FoundGame[]) => void) {
  const games = new Map<string, FoundGame>();
  const emit = () => onChange([...games.values()].sort((a, b) => a.name.localeCompare(b.name)));
  const handler = (m: DiscoveryMsg, r: RInfo) => {
    if (m.t !== 'announce') return;
    games.set(r.address, {
      ip: r.address, port: m.port, name: m.name, mode: m.mode, players: m.players, max: m.max, open: m.open, lastSeen: Date.now(),
    });
    emit();
  };
  let sock: UdpSocket;
  try {
    sock = await openSocket(DISCOVERY_PORT, handler);
  } catch {
    // Port busy: fall back to a random port (we still get unicast replies to our probes).
    sock = await openSocket(0, handler);
  }
  const probe: DiscoveryMsg = { tag: DISCOVERY_TAG, t: 'probe', v: PROTOCOL_VERSION };
  const tick = async () => {
    for (const t of await discoveryTargets()) send(sock, probe, DISCOVERY_PORT, t);
    const now = Date.now();
    let changed = false;
    for (const [k, g] of games) if (now - g.lastSeen > 4000) { games.delete(k); changed = true; }
    if (changed) emit();
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => {
    clearInterval(timer);
    try {
      sock.close();
    } catch {
      // already closed
    }
  };
}
