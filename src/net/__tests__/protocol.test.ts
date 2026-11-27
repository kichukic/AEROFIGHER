/// <reference types="jest" />
import { createWorld, DEFAULT_CONFIG, step } from '../../sim/world';
import { botInput } from '../../sim/bots';
import { Input, PlayerSlot } from '../../sim/types';
import { applySnapshot, decodeInput, encodeInput, encodeSnapshot, frame, LineDecoder } from '../protocol';
import { RemoteSession } from '../../game/session';

const slots: PlayerSlot[] = [
  { id: 'host', name: 'Host', team: 0, type: 'fighter', isBot: false },
  { id: 'p1', name: 'P1', team: 1, type: 'bomber', isBot: false },
  { id: 'bot0', name: 'Bot', team: 1, type: 'interceptor', isBot: true },
];

function runHost(ticks: number) {
  const w = createWorld({ ...DEFAULT_CONFIG, mode: 'tdm' }, slots, 5);
  for (let i = 0; i < ticks; i++) {
    const inputs: Record<string, Input> = {};
    for (const p of w.planes) inputs[p.id] = botInput(w, p);
    step(w, inputs);
  }
  return w;
}

describe('protocol', () => {
  test('line decoder handles split and merged chunks', () => {
    const d = new LineDecoder();
    const a = frame({ t: 'ping', ts: 1 });
    const b = frame({ t: 'ping', ts: 2 });
    const all = a + b;
    expect(d.push(all.slice(0, 5))).toEqual([]);
    expect(d.push(all.slice(5))).toEqual([{ t: 'ping', ts: 1 }, { t: 'ping', ts: 2 }]);
    expect(d.push('garbage\n')).toEqual([]);
  });

  test('input round trip and sanitising', () => {
    const i: Input = { aim: 1.2345, throttle: 0.7, fire: true, missile: false, special: false };
    const m = JSON.parse(JSON.stringify(encodeInput(3, i)));
    expect(decodeInput(m)).toEqual({ aim: 1.235, throttle: 0.7, fire: true, missile: false, special: false });
    expect(decodeInput({ t: 'input', seq: 1, a: 'x' as any, th: 99, f: 0, m: 0 })).toEqual({ aim: null, throttle: 1, fire: false, missile: false, special: false });
  });

  test('snapshot applied on a mirror world reproduces host state', () => {
    const host = runHost(600);
    const mirror = createWorld(host.config, slots, 5);
    applySnapshot(mirror, JSON.parse(JSON.stringify(encodeSnapshot(host))));
    expect(mirror.tick).toBe(host.tick);
    expect(mirror.teamScores).toEqual(host.teamScores);
    for (const hp of host.planes) {
      const mp = mirror.planes.find((p) => p.id === hp.id)!;
      expect(mp.x).toBeCloseTo(hp.x, 0);
      expect(mp.y).toBeCloseTo(hp.y, 0);
      expect(mp.alive).toBe(hp.alive);
      expect(mp.kills).toBe(hp.kills);
      expect(mp.hp).toBe(Math.ceil(hp.hp));
    }
    expect(mirror.bullets.length).toBe(host.bullets.length);
    expect(mirror.pickups.length).toBe(host.pickups.length);
  });

  test('snapshot fits comfortably in a TCP frame', () => {
    const host = runHost(900);
    const size = frame({ t: 'snap', s: encodeSnapshot(host), e: [] }).length;
    expect(size).toBeLessThan(8000);
  });

  test('remote session predicts own plane and ignores stale snapshots', () => {
    const host = runHost(60);
    const fakeConn = { send: jest.fn(), rtt: 5 } as any;
    const rs = new RemoteSession('p1', host.config, slots, 5, fakeConn);
    rs.onSnap(encodeSnapshot(host), []);
    const me = rs.world.planes.find((p) => p.id === 'p1')!;
    const before = rs.pose(me);
    rs.setInput({ aim: 0, throttle: 1, fire: false, missile: false, special: false });
    rs.update(0.05);
    expect(fakeConn.send).toHaveBeenCalled();
    const after = rs.pose(me);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
    const stale = encodeSnapshot(host);
    stale.k = 1;
    stale.P = stale.P.map((p) => [p[0], 0, 0, p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11]]);
    rs.onSnap(stale, []);
    expect(rs.world.planes.find((p) => p.id === 'host')!.x).not.toBe(0);
  });

  test('match end propagates through snapshot', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, timeLimit: 0.5 }, slots, 1);
    for (let i = 0; i < 30; i++) step(w, {});
    const mirror = createWorld(w.config, slots, 1);
    applySnapshot(mirror, encodeSnapshot(w));
    expect(mirror.ended).toBe(true);
  });
});
