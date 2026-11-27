/// <reference types="jest" />
import { configFor, createWorld, step, DT, FLAG_RETURN_TIME } from '../world';
import { botInput } from '../bots';
import { IDLE_INPUT, Input, PlayerSlot, World } from '../types';
import { PLANES, SPECIALS } from '../planes';
import { MAP_IDS, MAPS } from '../maps';
import { applySnapshot, encodeSnapshot } from '../../net/protocol';

const two = (aType: PlayerSlot['type'] = 'fighter', bType: PlayerSlot['type'] = 'fighter'): PlayerSlot[] => [
  { id: 'a', name: 'A', team: 0, type: aType, isBot: false },
  { id: 'b', name: 'B', team: 1, type: bType, isBot: false },
];
const go = (o: Partial<Input> = {}): Input => ({ ...IDLE_INPUT, ...o });

function park(w: World) {
  const [a, b] = w.planes;
  a.x = 1000; a.y = 1000; a.angle = 0; a.spawnProtectUntil = 0;
  b.x = 2000; b.y = 1000; b.angle = Math.PI; b.spawnProtectUntil = 0;
}

describe('special abilities', () => {
  test('interceptor dash makes it much faster, then goes on cooldown', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('interceptor'));
    park(w);
    for (let i = 0; i < 30; i++) step(w, { a: go({ aim: 0, throttle: 1 }) });
    const normal = w.planes[0].speed;
    step(w, { a: go({ aim: 0, throttle: 1, special: true }) });
    for (let i = 0; i < 15; i++) step(w, { a: go({ aim: 0, throttle: 1 }) });
    expect(w.planes[0].speed).toBeGreaterThan(normal * 1.4);
    expect(w.planes[0].specialCd).toBeGreaterThan(SPECIALS.interceptor.cooldown - 1);
    expect(w.events.some((e) => e.t === 'special' && e.kind === 'dash')).toBe(true);
  });

  test('fighter flare breaks missile locks', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[1].x = 1500;
    // b fires a missile at a
    step(w, { b: go({ aim: Math.PI, missile: true }) });
    expect(w.missiles[0].target).toBe('a');
    step(w, { a: go({ special: true }) });
    expect(w.missiles.every((m) => m.target === null)).toBe(true);
  });

  test('bomber flak hits planes all around it', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('bomber', 'fighter'));
    park(w);
    const b = w.planes[1];
    b.x = 1000; b.y = 1100; // directly beside the bomber, not in front
    const hp = b.hp;
    step(w, { a: go({ special: true }) });
    for (let i = 0; i < 6; i++) { b.x = w.planes[0].x; b.y = w.planes[0].y + 100; step(w, {}); }
    expect(b.hp).toBeLessThan(hp);
  });
});

describe('maps', () => {
  test('every map builds and spawns planes outside rocks', () => {
    for (const id of MAP_IDS) {
      const slots: PlayerSlot[] = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, name: 'P', team: i % 2, type: 'fighter', isBot: true }));
      const w = createWorld(configFor('tdm', id), slots, 3);
      expect(w.config.arenaW).toBe(MAPS[id].w);
      for (const p of w.planes) {
        for (const o of w.obstacles) expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThan(o.r);
      }
    }
  });

  test('flying into a rock bounces and damages the plane', () => {
    const w = createWorld(configFor('ffa', 'desert'), two());
    park(w);
    const rock = w.obstacles[0];
    const a = w.planes[0];
    a.x = rock.x - rock.r - 30; a.y = rock.y; a.angle = 0;
    const hp = a.hp;
    for (let i = 0; i < 10; i++) step(w, { a: go({ aim: 0, throttle: 1 }) });
    expect(a.hp).toBeLessThan(hp);
    expect(Math.hypot(a.x - rock.x, a.y - rock.y)).toBeGreaterThanOrEqual(rock.r + PLANES.fighter.radius - 0.01);
  });

  test('bullets are stopped by rocks', () => {
    const w = createWorld(configFor('ffa', 'desert'), two());
    const rock = w.obstacles[0];
    const [a, b] = w.planes;
    a.x = rock.x - rock.r - 60; a.y = rock.y; a.angle = 0; a.speed = 0;
    b.x = rock.x + rock.r + 60; b.y = rock.y; b.spawnProtectUntil = 0;
    const hp = b.hp;
    for (let i = 0; i < 20; i++) {
      a.x = rock.x - rock.r - 60; a.y = rock.y; a.angle = 0;
      b.x = rock.x + rock.r + 60; b.y = rock.y;
      step(w, { a: go({ aim: 0, throttle: 0, fire: true }) });
    }
    expect(b.hp).toBe(hp);
  });
});

describe('capture the flag', () => {
  function ctf() {
    const w = createWorld(configFor('ctf', 'ocean', { captureLimit: 2 }), two());
    park(w);
    return w;
  }

  test('take enemy flag, bring it home, score a capture', () => {
    const w = ctf();
    const [a] = w.planes;
    const enemyFlag = w.flags[1];
    a.x = enemyFlag.x; a.y = enemyFlag.y;
    step(w, {});
    expect(enemyFlag.carrier).toBe('a');
    a.x = w.flags[0].homeX; a.y = w.flags[0].homeY;
    step(w, {});
    expect(w.teamScores[0]).toBe(1);
    expect(a.caps).toBe(1);
    expect(enemyFlag.carrier).toBeNull();
    expect(enemyFlag.x).toBe(enemyFlag.homeX);
  });

  test('carrier killed drops the flag; owner touching it returns it', () => {
    const w = ctf();
    const [a, b] = w.planes;
    const enemyFlag = w.flags[1];
    a.x = enemyFlag.x; a.y = enemyFlag.y + 400; // move away from base first
    enemyFlag.carrier = 'a';
    a.hp = 1;
    // b shoots a
    b.x = a.x - 120; b.y = a.y; b.angle = 0;
    for (let i = 0; i < 20 && a.alive; i++) {
      b.x = a.x - 120; b.y = a.y; b.angle = 0;
      step(w, { b: go({ aim: 0, fire: true, throttle: 0 }) });
    }
    expect(a.alive).toBe(false);
    expect(enemyFlag.carrier).toBeNull();
    expect(enemyFlag.droppedAt).not.toBeNull();
    b.x = enemyFlag.x; b.y = enemyFlag.y;
    step(w, {});
    expect(enemyFlag.droppedAt).toBeNull();
    expect(enemyFlag.x).toBe(enemyFlag.homeX);
  });

  test('dropped flag returns home on its own', () => {
    const w = ctf();
    const f = w.flags[1];
    f.x = 1600; f.y = 300; f.droppedAt = w.time;
    for (let i = 0; i < (FLAG_RETURN_TIME + 1) / DT; i++) step(w, {});
    expect(f.x).toBe(f.homeX);
  });

  test('match ends at the capture limit and flags survive a snapshot', () => {
    const w = ctf();
    w.teamScores[0] = 2;
    step(w, {});
    expect(w.ended).toBe(true);
    expect(w.winnerTeam).toBe(0);
    const mirror = createWorld(w.config, two());
    w.flags[1].carrier = 'a';
    applySnapshot(mirror, JSON.parse(JSON.stringify(encodeSnapshot(w))));
    expect(mirror.flags[1].carrier).toBe('a');
  });

  test('bots score captures in a CTF match', () => {
    const slots: PlayerSlot[] = Array.from({ length: 6 }, (_, i) => ({ id: 'bot' + i, name: 'B', team: i % 2, type: (['fighter', 'interceptor', 'bomber'] as const)[i % 3], isBot: true }));
    const w = createWorld(configFor('ctf', 'canyon', { captureLimit: 99 }), slots, 11);
    for (let i = 0; i < 30 * 240; i++) {
      const inputs: Record<string, Input> = {};
      for (const p of w.planes) inputs[p.id] = botInput(w, p);
      step(w, inputs);
      w.events = [];
    }
    expect(w.teamScores[0] + w.teamScores[1]).toBeGreaterThan(0);
  });
});
