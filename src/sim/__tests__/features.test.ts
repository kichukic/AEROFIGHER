/// <reference types="jest" />
import { configFor, createWorld, findAutoFireTarget, findLockTarget, step, DT, FLAG_RETURN_TIME } from '../world';
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
  a.x = 1000; a.y = 1000; a.angle = 0; a.vx = a.speed; a.vy = 0; a.spawnProtectUntil = 0;
  b.x = 2000; b.y = 1000; b.angle = Math.PI; b.vx = -b.speed; b.vy = 0; b.spawnProtectUntil = 0;
  w.clouds = [];
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
    w.obstacles = [{ x: 1600, y: 1100, r: 150 }];
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
    w.obstacles = [{ x: 1600, y: 1100, r: 150 }];
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

describe('tactical clouds', () => {
  test('entering a cloud breaks active missile lock and prevents new locks', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    // Place a cloud over plane a
    w.clouds = [{ x: 1000, y: 1000, r: 80 }];
    w.planes[1].x = 1500;
    // b fires a missile towards a
    step(w, { b: go({ aim: Math.PI, missile: true }) });
    expect(w.planes[0].inCloud).toBe(true);
    expect(findLockTarget(w, w.planes[1])).toBeNull();
    expect(w.missiles[0].target).toBeNull();
  });

  test('cloud stealth flag survives snapshot synchronization', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two());
    park(w);
    w.clouds = [{ x: 1000, y: 1000, r: 80 }];
    step(w, {});
    expect(w.planes[0].inCloud).toBe(true);
    const mirror = createWorld(w.config, two());
    applySnapshot(mirror, JSON.parse(JSON.stringify(encodeSnapshot(w))));
    expect(mirror.planes[0].inCloud).toBe(true);
  });
});

describe('auto-fire targeting', () => {
  test('detects enemy in front within range and flags inSights', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    w.planes[1].x = 1350; w.planes[1].y = 1000; w.planes[1].angle = Math.PI;

    const res = findAutoFireTarget(w, w.planes[0]);
    expect(res).not.toBeNull();
    expect(res!.target.id).toBe('b');
    expect(res!.inSights).toBe(true);
    expect(res!.dist).toBeCloseTo(350, 0);
  });

  test('does not auto-fire at teammates in team modes', () => {
    const w = createWorld(configFor('tdm', 'ocean'), [
      { id: 'a', name: 'A', team: 0, type: 'fighter', isBot: false },
      { id: 'ally', name: 'Ally', team: 0, type: 'fighter', isBot: false },
    ]);
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    w.planes[1].x = 1300; w.planes[1].y = 1000;

    expect(findAutoFireTarget(w, w.planes[0])).toBeNull();
  });

  test('does not target enemies hidden in clouds', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    w.planes[1].x = 1350; w.planes[1].y = 1000;
    w.clouds = [{ x: 1350, y: 1000, r: 80 }];
    step(w, {});

    expect(w.planes[1].inCloud).toBe(true);
    expect(findAutoFireTarget(w, w.planes[0])).toBeNull();
  });

  test('does not auto-fire through obstacles', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    w.planes[1].x = 1400; w.planes[1].y = 1000;
    w.obstacles = [{ x: 1200, y: 1000, r: 60 }];

    expect(findAutoFireTarget(w, w.planes[0])).toBeNull();
  });

  test('returns inSights false when enemy is out of angular firing cone', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    w.planes[1].x = 1000; w.planes[1].y = 1400;

    const res = findAutoFireTarget(w, w.planes[0]);
    expect(res === null || res.inSights === false).toBe(true);
  });
});

describe('true homing missiles', () => {
  test('missile actively curves towards and tracks target', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    w.planes[1].x = 1350; w.planes[1].y = 1200; // offset at ~30 degrees
    w.planes[0].missiles = 1;
    // Launch missile with lock
    step(w, { a: go({ missile: true }) });
    expect(w.missiles.length).toBe(1);
    const m = w.missiles[0];
    expect(m.target).toBe(w.planes[1].id);
    const initialAngle = m.angle;

    // Step forward several frames
    for (let i = 0; i < 10; i++) step(w, {});

    // Missile must have turned towards target (angle increased towards target's positive Y)
    expect(m.angle).toBeGreaterThan(initialAngle);
  });

  test('in-flight seeker acquires target for unguided missile', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    w.planes[1].x = 1400; w.planes[1].y = 1050;

    // Manually inject unguided missile
    w.missiles.push({
      id: 999,
      owner: 'a',
      team: 0,
      x: 1050,
      y: 1000,
      angle: 0,
      speed: 295,
      target: null,
      life: 4,
    });

    step(w, {});
    // Seeker must have locked onto enemy plane b
    expect(w.missiles[0].target).toBe(w.planes[1].id);
  });

  test('seeker breaks lock when target jiggles or outmaneuvers off-boresight limit', () => {
    const w = createWorld(configFor('ffa', 'ocean'), two('fighter', 'fighter'));
    park(w);
    w.planes[0].x = 1000; w.planes[0].y = 1000; w.planes[0].angle = 0;
    // Enemy is positioned 80 degrees off boresight (beyond ~60 deg limit)
    w.planes[1].x = 1050; w.planes[1].y = 1200;

    w.missiles.push({
      id: 998,
      owner: 'a',
      team: 0,
      x: 1000,
      y: 1000,
      angle: 0, // missile facing east
      speed: 245,
      target: w.planes[1].id,
      life: 4,
    });

    step(w, {});
    // Target was too far off-boresight, missile must lose lock and not re-lock
    expect(w.missiles[0].target).toBeNull();
    expect(w.missiles[0].lostLock).toBe(true);
  });
});
