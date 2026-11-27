import { PLANES, SPECIALS } from './planes';
import { angleDiff, dist2 } from './math';
import { Input, isTeamMode, Plane, World } from './types';
import { findLockTarget, flagAtHome } from './world';

const NONE: Input = { aim: null, throttle: 0.5, fire: false, missile: false, special: false };

/** Deterministic per-bot number in [0,1) so bots differ from each other. */
function trait(me: Plane): number {
  let h = 0;
  for (let i = 0; i < me.id.length; i++) h = (h * 31 + me.id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/** If a rock is ahead, return a heading that steers around it; otherwise null. */
function avoidObstacles(w: World, me: Plane, desired: number): number | null {
  const look = 140 + me.speed * 0.6;
  const pr = PLANES[me.type].radius;
  for (const o of w.obstacles) {
    const dx = o.x - me.x;
    const dy = o.y - me.y;
    const d = Math.hypot(dx, dy);
    if (d - o.r > look) continue;
    const toObs = Math.atan2(dy, dx);
    const off = angleDiff(me.angle, toObs);
    // Is the obstacle in our flight path?
    const lateral = Math.abs(Math.sin(off) * d);
    if (Math.abs(off) < Math.PI / 2 && lateral < o.r + pr + 30) {
      // Turn to whichever side the desired heading is on (or away from the center).
      const side = angleDiff(toObs, desired) >= 0 ? 1 : -1;
      return toObs + side * (Math.PI / 2 + 0.2);
    }
  }
  return null;
}

/** Fly towards a point, firing at any enemy that happens to be lined up. */
function goTo(w: World, me: Plane, x: number, y: number, throttle: number): Input {
  const aim = Math.atan2(y - me.y, x - me.x);
  return { ...NONE, aim, throttle, fire: enemyInSights(w, me) };
}

function enemyInSights(w: World, me: Plane): boolean {
  const range = 600;
  for (const o of w.planes) {
    if (o === me || !o.alive) continue;
    if (isTeamMode(w.config.mode) && o.team === me.team) continue;
    const d2 = dist2(me.x, me.y, o.x, o.y);
    if (d2 > range * range) continue;
    const a = Math.atan2(o.y - me.y, o.x - me.x);
    if (Math.abs(angleDiff(me.angle, a)) < 0.15) return true;
  }
  return false;
}

function nearestEnemy(w: World, me: Plane): { target: Plane | null; d2: number } {
  let target: Plane | null = null;
  let td = Infinity;
  for (const o of w.planes) {
    if (o === me || !o.alive) continue;
    if (isTeamMode(w.config.mode) && o.team === me.team) continue;
    const d = dist2(me.x, me.y, o.x, o.y);
    if (d < td) {
      td = d;
      target = o;
    }
  }
  return { target, d2: td };
}

function dogfight(w: World, me: Plane, target: Plane, d2: number): Input {
  const stats = PLANES[me.type];
  const dist = Math.sqrt(d2);
  // Lead the target: aim where it will be when the bullet arrives.
  const tFlight = dist / stats.bulletSpeed;
  const lx = target.x + Math.cos(target.angle) * target.speed * tFlight;
  const ly = target.y + Math.sin(target.angle) * target.speed * tFlight;
  const aim = Math.atan2(ly - me.y, lx - me.x);
  const off = Math.abs(angleDiff(me.angle, aim));
  const jitter = (trait(me) - 0.5) * 0.12;
  const fire = dist < 650 && off < 0.18 + jitter;
  const missile =
    me.missiles > 0 && dist < 800 && off < 0.4 && findLockTarget(w, me) === target.id && (w.tick + me.id.length) % 45 === 0;
  // Slow down when close to turn tighter; speed up when far.
  const throttle = dist < 300 ? 0.25 : dist > 900 ? 1 : 0.65;
  return { ...NONE, aim, throttle, fire, missile };
}

function wantSpecial(w: World, me: Plane, target: Plane | null, d2: number, chasing: boolean): boolean {
  if (me.specialCd > 0) return false;
  switch (SPECIALS[me.type].kind) {
    case 'dash':
      // Close the gap on a far target, run home with a flag, or escape when hurt.
      return chasing || (target !== null && d2 > 750 * 750) || (me.hp < PLANES[me.type].hp * 0.3 && d2 < 300 * 300);
    case 'flare':
      return w.missiles.some((m) => m.target === me.id && dist2(m.x, m.y, me.x, me.y) < 380 * 380);
    case 'flak':
      return target !== null && d2 < 170 * 170;
  }
}

/**
 * Simple stateless AI: dogfights the nearest enemy, plays the objective in CTF,
 * grabs repairs when hurt, uses its special ability and avoids rocks and the zone edge.
 */
export function botInput(w: World, me: Plane): Input {
  if (!me.alive) return NONE;
  const stats = PLANES[me.type];
  const { arenaW, arenaH, mode } = w.config;
  const { target, d2 } = nearestEnemy(w, me);
  let out: Input | null = null;
  let objective = false;

  // Stay inside the arena.
  const edge = 220;
  if (me.x < edge || me.y < edge || me.x > arenaW - edge || me.y > arenaH - edge) {
    out = { ...NONE, aim: Math.atan2(arenaH / 2 - me.y, arenaW / 2 - me.x), throttle: 0.8 };
  }

  // Capture the Flag objectives.
  if (!out && mode === 'ctf' && w.flags.length === 2) {
    const own = w.flags[me.team];
    const enemy = w.flags[1 - me.team];
    if (enemy.carrier === me.id) {
      // Carrying: head home.
      out = goTo(w, me, own.homeX, own.homeY, 1);
      objective = true;
    } else if (own.carrier) {
      // Our flag is stolen: hunt the carrier.
      const thief = w.planes.find((p) => p.id === own.carrier);
      if (thief) {
        out = dogfight(w, me, thief, dist2(me.x, me.y, thief.x, thief.y));
        objective = true;
      }
    } else if (own.droppedAt !== null && trait(me) < 0.6) {
      out = goTo(w, me, own.x, own.y, 1);
      objective = true;
    } else if (!enemy.carrier && trait(me) > 0.35 && (!target || d2 > 350 * 350)) {
      // Attackers go for the enemy flag unless someone is right on them.
      out = goTo(w, me, enemy.x, enemy.y, 0.9);
      objective = true;
    } else if (enemy.carrier && flagAtHome(own) && trait(me) <= 0.35) {
      // Defenders hang around home.
      if (!target || dist2(own.homeX, own.homeY, target.x, target.y) > 900 * 900) {
        out = goTo(w, me, own.homeX + Math.cos(w.time + trait(me) * 6) * 300, own.homeY + Math.sin(w.time) * 300, 0.5);
      }
    }
  }

  // Go for a repair/shield if hurt and one is near.
  if (!out && me.hp < stats.hp * 0.4) {
    let best: { x: number; y: number } | null = null;
    let bestD = 700 * 700;
    for (const pk of w.pickups) {
      if (pk.kind !== 'repair' && pk.kind !== 'shield') continue;
      const d = dist2(me.x, me.y, pk.x, pk.y);
      if (d < bestD) {
        bestD = d;
        best = pk;
      }
    }
    if (best) out = goTo(w, me, best.x, best.y, 1);
  }

  if (!out) {
    out = target ? dogfight(w, me, target, d2) : { ...NONE, aim: me.angle + 0.6, throttle: 0.5 };
  }

  // Steer around rocks.
  const avoid = avoidObstacles(w, me, out.aim ?? me.angle);
  if (avoid !== null) out = { ...out, aim: avoid, throttle: Math.min(out.throttle, 0.6) };

  out.special = wantSpecial(w, me, target, d2, objective && SPECIALS[me.type].kind === 'dash');
  return out;
}
