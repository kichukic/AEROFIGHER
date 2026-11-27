/// <reference types="jest" />
import { createWorld, step, DEFAULT_CONFIG, DT, RESPAWN_DELAY } from '../world';
import { botInput } from '../bots';
import { Input, PlayerSlot, World } from '../types';
import { PLANES } from '../planes';

const slots: PlayerSlot[] = [
  { id: 'a', name: 'A', team: 0, type: 'fighter', isBot: false },
  { id: 'b', name: 'B', team: 1, type: 'fighter', isBot: false },
];

function place(w: World) {
  const [a, b] = w.planes;
  a.x = 1000; a.y = 1000; a.angle = 0; a.vx = a.speed; a.vy = 0;
  b.x = 1150; b.y = 1000; b.angle = 0; b.vx = b.speed; b.vy = 0;
  a.spawnProtectUntil = 0; b.spawnProtectUntil = 0;
}

describe('sim', () => {
  test('plane moves forward along heading', () => {
    const w = createWorld(DEFAULT_CONFIG, slots);
    place(w);
    const x0 = w.planes[0].x;
    step(w, { a: { aim: 0, throttle: 1, fire: false, missile: false, special: false } });
    expect(w.planes[0].x).toBeGreaterThan(x0);
    expect(w.planes[0].y).toBeCloseTo(1000);
  });

  test('plane turns no faster than its turn rate', () => {
    const w = createWorld(DEFAULT_CONFIG, slots);
    place(w);
    step(w, { a: { aim: Math.PI / 2, throttle: 0, fire: false, missile: false, special: false } });
    expect(w.planes[0].angle).toBeCloseTo(PLANES.fighter.turnRate * DT, 5);
  });

  test('bullets damage and kill, killer gets credit, victim respawns', () => {
    const w = createWorld(DEFAULT_CONFIG, slots);
    place(w);
    const fire: Input = { aim: 0, throttle: 0, fire: true, missile: false, special: false };
    let killed = false;
    for (let i = 0; i < 400 && !killed; i++) {
      // Keep b parked in front of a.
      const [a, b] = w.planes;
      b.x = a.x + 150; b.y = a.y; b.angle = 0; b.speed = a.speed;
      step(w, { a: fire });
      killed = w.events.some((e) => e.t === 'kill');
    }
    expect(killed).toBe(true);
    expect(w.planes[0].kills).toBe(1);
    expect(w.planes[1].deaths).toBe(1);
    expect(w.planes[1].alive).toBe(false);
    for (let i = 0; i < Math.ceil(RESPAWN_DELAY / DT) + 1; i++) step(w, {});
    expect(w.planes[1].alive).toBe(true);
    expect(w.planes[1].hp).toBe(PLANES.fighter.hp);
  });

  test('no friendly fire in TDM', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, mode: 'tdm' }, slots.map((s) => ({ ...s, team: 0 })));
    place(w);
    for (let i = 0; i < 60; i++) {
      const [a, b] = w.planes;
      b.x = a.x + 150; b.y = a.y; b.speed = a.speed;
      step(w, { a: { aim: 0, throttle: 0, fire: true, missile: false, special: false } });
    }
    expect(w.planes[1].hp).toBe(PLANES.fighter.hp);
  });

  test('out of bounds causes damage', () => {
    const w = createWorld(DEFAULT_CONFIG, slots);
    w.planes[0].x = -100; w.planes[0].angle = Math.PI;
    const hp = w.planes[0].hp;
    step(w, {});
    expect(w.planes[0].hp).toBeLessThan(hp);
  });

  test('match ends at time limit', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, timeLimit: 1 }, slots);
    for (let i = 0; i < 40; i++) step(w, {});
    expect(w.ended).toBe(true);
    expect(w.events.some((e) => e.t === 'end')).toBe(true);
  });

  test('deterministic: same seed + inputs → same world', () => {
    const run = () => {
      const bots: PlayerSlot[] = [0, 1, 2, 3].map((i) => ({ id: 'bot' + i, name: 'Bot' + i, team: i % 2, type: 'fighter', isBot: true }));
      const w = createWorld(DEFAULT_CONFIG, bots, 99);
      for (let i = 0; i < 900; i++) {
        const inputs: Record<string, Input> = {};
        for (const p of w.planes) inputs[p.id] = botInput(w, p);
        step(w, inputs);
        w.events = [];
      }
      return JSON.stringify(w);
    };
    expect(run()).toEqual(run());
  });

  test('bots actually fight', () => {
    const bots: PlayerSlot[] = [0, 1, 2, 3].map((i) => ({ id: 'bot' + i, name: 'Bot' + i, team: i % 2, type: 'fighter', isBot: true }));
    const w = createWorld(DEFAULT_CONFIG, bots, 7);
    for (let i = 0; i < 30 * 120; i++) {
      const inputs: Record<string, Input> = {};
      for (const p of w.planes) inputs[p.id] = botInput(w, p);
      step(w, inputs);
    }
    expect(w.planes.reduce((s, p) => s + p.kills, 0)).toBeGreaterThan(0);
  });
});
