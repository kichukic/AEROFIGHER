import { PLANES, SPECIALS } from './planes';
import { MAPS } from './maps';
import { angleDiff, clamp, dist2, rand, turnTowards, wrapAngle } from './math';
import {
  AirDropPerk,
  Bullet,
  Cloud,
  Flag,
  IDLE_INPUT,
  Input,
  isTeamMode,
  MapId,
  MatchConfig,
  Missile,
  Obstacle,
  Pickup,
  PickupKind,
  Plane,
  PlayerSlot,
  SupplyCrate,
  Weapon,
  World,
} from './types';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

export const RESPAWN_DELAY = 3;
export const SPAWN_PROTECTION = 2;
export const ZONE_MARGIN = 350; // how far past the arena edge a plane may stray (hard clamp)
export const ZONE_DPS = 14; // damage per second while outside the arena
export const MISSILE_SPEED = 245; // reduced so players can dodge and jiggle
export const MISSILE_TURN = 3.6; // realistic seeker turn rate so sharp evasive turns outmaneuver it
export const MISSILE_LIFE = 4.5;
export const MISSILE_DAMAGE = 22;
export const MISSILE_COOLDOWN = 0.5;
export const MISSILE_LOCK_CONE = Math.PI * 0.70;
export const MISSILE_LOCK_RANGE = 1000;
export const SEEKER_MAX_OFF_BORESIGHT = 1.05; // ~60° max seeker gimbal angle; exceeding breaks lock
export const PICKUP_RADIUS = 24;
export const PICKUP_INTERVAL = 6;
export const MAX_PICKUPS = 5;
export const CRATE_INTERVAL = 25;
export const SHIELD_TIME = 6;
export const BOOST_TIME = 5;
export const BOOST_MULT = 1.35;
export const DASH_TIME = 1.2;
export const DASH_MULT = 1.75;
export const FLARE_TIME = 1.5;
export const FLAK_COUNT = 18;
export const FLAK_SPEED = 470;
export const FLAK_DAMAGE = 12;
export const FLAK_LIFE = 0.7;
export const CRASH_DAMAGE = 20;
export const FLAG_RADIUS = 42;
export const FLAG_RETURN_TIME = 15;
export const FLAG_BASE_INSET = 230;
export const CARRIER_SPEED_MULT = 0.9;

export const DEFAULT_CONFIG: MatchConfig = configFor('ffa', 'farmland');

/** Build a match config for a mode + map, with sensible defaults. */
export function configFor(mode: MatchConfig['mode'], map: MapId, overrides: Partial<MatchConfig> = {}): MatchConfig {
  const m = MAPS[map];
  return { mode, map, timeLimit: 300, killLimit: 20, captureLimit: 3, botDifficulty: 'medium', ...overrides, arenaW: m.w, arenaH: m.h };
}

function rnd(w: World): number {
  const [v, s] = rand(w.seed);
  w.seed = s;
  return v;
}

function isEnemy(w: World, ownerId: string, team: number, b: Plane): boolean {
  if (ownerId === b.id) return false;
  if (isTeamMode(w.config.mode)) return team !== b.team;
  return true;
}

function newPlane(w: World, s: PlayerSlot): Plane {
  const stats = PLANES[s.type];
  return {
    id: s.id, name: s.name, team: isTeamMode(w.config.mode) ? s.team : -1, type: s.type, isBot: s.isBot,
    x: 0, y: 0, angle: 0, speed: stats.minSpeed, hp: stats.hp, alive: true, respawnAt: 0,
    vx: 0, vy: 0, bank: 0, hitFlashUntil: 0,
    fireCd: 0, missileCd: 0, missiles: stats.missiles, specialCd: 0, shieldUntil: 0, boostUntil: 0,
    dashUntil: 0, flareUntil: 0, spawnProtectUntil: 0, outOfBoundsTime: 0, inCloud: false,
    kills: 0, deaths: 0, caps: 0, streak: 0, lastKillTime: 0, multiKills: 0,
  };
}

export function createClouds(config: MatchConfig): Cloud[] {
  const out: Cloud[] = [];
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const density = MAPS[config.map]?.cloudDensity ?? 0.45;
  const n = Math.round(((config.arenaW * config.arenaH) / 100000) * density);
  for (let i = 0; i < n; i++) out.push({ x: rnd() * config.arenaW, y: rnd() * config.arenaH, r: 40 + rnd() * 70 });
  return out;
}

export function createWorld(config: MatchConfig, slots: PlayerSlot[], seed = 12345): World {
  const map = MAPS[config.map] ?? MAPS.ocean;
  const w: World = {
    tick: 0,
    time: 0,
    config,
    planes: [],
    bullets: [],
    missiles: [],
    pickups: [],
    crates: [],
    flags: [],
    obstacles: map.obstacles.map((o) => ({ ...o })),
    clouds: createClouds(config),
    nextId: 1,
    nextPickupAt: 2,
    nextCrateAt: 14,
    seed,
    ended: false,
    winner: null,
    winnerTeam: null,
    teamScores: [0, 0],
    events: [],
  };
  if (config.mode === 'ctf') {
    const y = config.arenaH / 2;
    w.flags = [0, 1].map((team) => {
      const x = team === 0 ? FLAG_BASE_INSET : config.arenaW - FLAG_BASE_INSET;
      return { team, x, y, homeX: x, homeY: y, carrier: null, droppedAt: null };
    });
  }
  for (const s of slots) {
    const p = newPlane(w, s);
    w.planes.push(p);
    spawnPlane(w, p);
  }
  return w;
}

export function addPlane(w: World, s: PlayerSlot): void {
  if (w.planes.some((p) => p.id === s.id)) return;
  const p = newPlane(w, s);
  w.planes.push(p);
  spawnPlane(w, p);
}

export function removePlane(w: World, id: string): void {
  for (const f of w.flags) if (f.carrier === id) dropFlag(w, f);
  w.planes = w.planes.filter((p) => p.id !== id);
}

export function insideObstacle(obstacles: Obstacle[], x: number, y: number, pad: number): boolean {
  for (const o of obstacles) if (dist2(x, y, o.x, o.y) < (o.r + pad) ** 2) return true;
  return false;
}

function spawnPlane(w: World, p: Plane): void {
  const { arenaW, arenaH, mode } = w.config;
  const stats = PLANES[p.type];
  let best = { x: arenaW / 2, y: arenaH / 2, score: -1 };
  for (let i = 0; i < 16; i++) {
    let x = 200 + rnd(w) * (arenaW - 400);
    const y = 200 + rnd(w) * (arenaH - 400);
    if (isTeamMode(mode)) {
      // Team 0 spawns on the left third, team 1 on the right third.
      const third = arenaW / 3;
      x = (p.team === 0 ? 150 : arenaW - third + 150) + rnd(w) * (third - 300);
    }
    if (insideObstacle(w.obstacles, x, y, 80)) continue;
    let nearest = Infinity;
    for (const o of w.planes) {
      if (o === p || !o.alive || !isEnemy(w, p.id, p.team, o)) continue;
      nearest = Math.min(nearest, dist2(x, y, o.x, o.y));
    }
    if (nearest > best.score) best = { x, y, score: nearest };
  }
  p.x = best.x;
  p.y = best.y;
  // Face the arena center.
  p.angle = Math.atan2(arenaH / 2 - p.y, arenaW / 2 - p.x);
  p.speed = (stats.minSpeed + stats.maxSpeed) / 2;
  p.vx = Math.cos(p.angle) * p.speed;
  p.vy = Math.sin(p.angle) * p.speed;
  p.bank = 0;
  p.hitFlashUntil = 0;
  p.hp = stats.hp;
  p.alive = true;
  p.missiles = stats.missiles;
  p.fireCd = 0;
  p.missileCd = 0;
  p.shieldUntil = 0;
  p.boostUntil = 0;
  p.dashUntil = 0;
  p.flareUntil = 0;
  p.outOfBoundsTime = 0;
  p.spawnProtectUntil = w.time + SPAWN_PROTECTION;
}

function damage(w: World, victim: Plane, amount: number, killerId: string | null, weapon: Weapon): void {
  if (!victim.alive) return;
  if (weapon !== 'zone' && (w.time < victim.shieldUntil || w.time < victim.spawnProtectUntil)) return;
  victim.hp -= amount;
  victim.hitFlashUntil = w.time + 0.12;
  if (victim.hp > 0) return;
  victim.hp = 0;
  victim.alive = false;
  victim.deaths++;
  victim.respawnAt = w.time + RESPAWN_DELAY;
  w.events.push({ t: 'explode', x: victim.x, y: victim.y, big: true });
  for (const f of w.flags) if (f.carrier === victim.id) dropFlag(w, f);
  const killer = killerId ? w.planes.find((p) => p.id === killerId) : undefined;
  if (killer && killer !== victim) {
    killer.kills++;
    if (w.config.mode === 'tdm' && killer.team >= 0) w.teamScores[killer.team as 0 | 1]++;

    // Killstreak & Multikill tracking
    killer.streak = (killer.streak || 0) + 1;
    if (w.time - (killer.lastKillTime || 0) < 4.2) {
      killer.multiKills = (killer.multiKills || 1) + 1;
    } else {
      killer.multiKills = 1;
    }
    killer.lastKillTime = w.time;

    // Was the victim the match leader / Squadron Ace?
    const wasAce = w.planes.every((other) => other.id === victim.id || victim.kills >= other.kills) && victim.kills >= 3;
    if (wasAce) {
      w.events.push({
        t: 'accolade',
        id: killer.id,
        title: 'ACE DETHRONED! 👑',
        subtitle: `Shot down Squadron Ace ${victim.name}`,
        color: '#00f5d4',
        sound: 'ace',
      });
    } else if ((victim.streak || 0) >= 3) {
      w.events.push({
        t: 'accolade',
        id: killer.id,
        title: 'SHUTDOWN! 🛑',
        subtitle: `Ended ${victim.name}'s ${victim.streak} streak (+100 PTS)`,
        color: '#ffd23f',
        sound: 'shutdown',
      });
    }

    // Accolade announcements for multikills & streaks
    if (killer.multiKills === 2) {
      w.events.push({ t: 'accolade', id: killer.id, title: 'DOUBLE KILL! 🔥', color: '#ffd23f', sound: 'streak' });
    } else if (killer.multiKills === 3) {
      w.events.push({ t: 'accolade', id: killer.id, title: 'TRIPLE KILL! ⚡', color: '#ff4d4d', sound: 'streak' });
    } else if (killer.multiKills >= 4) {
      w.events.push({ t: 'accolade', id: killer.id, title: 'ACE IN A DAY! 🏆', color: '#00f5d4', sound: 'streak' });
    } else if (killer.streak === 3) {
      w.events.push({ t: 'accolade', id: killer.id, title: 'KILLING SPREE 🎯', color: '#ffd23f', sound: 'streak' });
    } else if (killer.streak === 5) {
      w.events.push({ t: 'accolade', id: killer.id, title: 'RAMPAGE! 🔥', color: '#ff3b3b', sound: 'streak' });
    } else if (killer.streak === 7) {
      w.events.push({ t: 'accolade', id: killer.id, title: 'UNSTOPPABLE! ⚡', color: '#c77dff', sound: 'streak' });
    } else if (killer.streak === 10) {
      w.events.push({ t: 'accolade', id: killer.id, title: 'GODLIKE! 👑', color: '#ffd23f', sound: 'streak' });
    }
  }

  // Reset victim's streaks & perks
  victim.streak = 0;
  victim.multiKills = 0;
  victim.perk = undefined;

  w.events.push({ t: 'kill', killer: killer && killer !== victim ? killer.id : null, victim: victim.id, weapon });
}

/** Speed multiplier from boost / dash / flag carrying. */
export function speedMult(w: World, p: Plane): number {
  let m = 1;
  if (w.time < p.boostUntil) m *= BOOST_MULT;
  if (w.time < p.dashUntil) m *= DASH_MULT;
  if (p.perk?.kind === 'overdrive' && w.time < p.perk.until) m *= 1.35;
  if (w.flags.some((f) => f.carrier === p.id)) m *= CARRIER_SPEED_MULT;
  return m;
}

/** Pure flight model: steering, throttle, aerodynamic grip and momentum drift. Shared with client-side prediction. */
export function movePlane(p: Plane, input: Input, dt: number, mult: number): void {
  const stats = PLANES[p.type];
  if (input.aim !== null && Number.isFinite(input.aim)) {
    const targetAngle = turnTowards(p.angle, input.aim, stats.turnRate * dt);
    const diff = angleDiff(p.angle, targetAngle);
    const targetBank = clamp(diff / (stats.turnRate * dt || 1e-4), -1, 1);
    p.bank = (p.bank ?? 0) + (targetBank - (p.bank ?? 0)) * Math.min(1, dt * 14);
    p.angle = targetAngle;
  } else {
    p.bank = (p.bank ?? 0) * Math.max(0, 1 - dt * 6);
  }
  const maxS = stats.maxSpeed * mult;
  // While dashing (mult >= DASH_MULT) we fly flat out regardless of throttle.
  const th = mult >= DASH_MULT * 0.95 ? 1 : clamp(input.throttle, 0, 1);
  const target = stats.minSpeed + th * (maxS - stats.minSpeed);
  const ds = target - p.speed;
  const step = stats.accel * dt * (mult > BOOST_MULT ? 3 : 1);
  p.speed += Math.abs(ds) < step ? ds : Math.sign(ds) * step;

  // Aerodynamic momentum & drift:
  // Forward vector driven by current heading
  const fX = Math.cos(p.angle) * p.speed;
  const fY = Math.sin(p.angle) * p.speed;
  // Wing grip smoothly aligns velocity vector to heading while allowing subtle momentum drift
  const grip = Math.min(1, dt * 22);
  p.vx = (p.vx ?? fX) + (fX - (p.vx ?? fX)) * grip;
  p.vy = (p.vy ?? fY) + (fY - (p.vy ?? fY)) * grip;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}

/**
 * Push a plane out of any obstacle it overlaps and bounce it off.
 * Returns true if a collision happened. Shared with client-side prediction.
 */
export function collideObstacles(p: Plane, obstacles: Obstacle[]): boolean {
  const pr = PLANES[p.type].radius;
  let hit = false;
  for (const o of obstacles) {
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    const min = o.r + pr;
    if (d >= min) continue;
    hit = true;
    const nx = d > 0.001 ? dx / d : 1;
    const ny = d > 0.001 ? dy / d : 0;
    p.x = o.x + nx * min;
    p.y = o.y + ny * min;
    // Reflect heading about the surface normal.
    const vx = Math.cos(p.angle);
    const vy = Math.sin(p.angle);
    const dot = vx * nx + vy * ny;
    if (dot < 0) {
      p.angle = Math.atan2(vy - 2 * dot * ny, vx - 2 * dot * nx);
      p.speed *= 0.6;
      p.vx = Math.cos(p.angle) * p.speed;
      p.vy = Math.sin(p.angle) * p.speed;
    }
  }
  return hit;
}

function activateSpecial(w: World, p: Plane): void {
  const sp = SPECIALS[p.type];
  p.specialCd = sp.cooldown;
  w.events.push({ t: 'special', id: p.id, kind: sp.kind, x: p.x, y: p.y });
  switch (sp.kind) {
    case 'dash':
      p.dashUntil = w.time + DASH_TIME;
      break;
    case 'flare':
      p.flareUntil = w.time + FLARE_TIME;
      for (const m of w.missiles) if (m.target === p.id) m.target = null;
      break;
    case 'flak':
      for (let i = 0; i < FLAK_COUNT; i++) {
        const a = (i / FLAK_COUNT) * Math.PI * 2 + p.angle;
        w.bullets.push({
          id: w.nextId++, owner: p.id, team: p.team, x: p.x, y: p.y,
          vx: Math.cos(a) * FLAK_SPEED + Math.cos(p.angle) * p.speed * 0.5,
          vy: Math.sin(a) * FLAK_SPEED + Math.sin(p.angle) * p.speed * 0.5,
          life: FLAK_LIFE, dmg: FLAK_DAMAGE, flak: true,
        });
      }
      break;
  }
}

function stepPlane(w: World, p: Plane, input: Input, dt: number): void {
  const stats = PLANES[p.type];
  if (!p.alive) {
    if (!w.ended && w.time >= p.respawnAt) spawnPlane(w, p);
    return;
  }
  movePlane(p, input, dt, speedMult(w, p));
  if (collideObstacles(p, w.obstacles)) {
    damage(w, p, CRASH_DAMAGE, null, 'crash');
    w.events.push({ t: 'hit', x: p.x, y: p.y, dmg: CRASH_DAMAGE });
    if (!p.alive) return;
  }

  // Cloud concealment: breaks locks and hides plane
  p.inCloud = false;
  for (const c of w.clouds) {
    if (dist2(p.x, p.y, c.x, c.y) <= (c.r + 15) ** 2) {
      p.inCloud = true;
      break;
    }
  }
  if (p.inCloud) {
    for (const m of w.missiles) if (m.target === p.id) m.target = null;
  }

  // Combat zone: outside the arena you take damage; hard clamp further out.
  const { arenaW, arenaH } = w.config;
  const outside = p.x < 0 || p.y < 0 || p.x > arenaW || p.y > arenaH;
  if (outside) {
    p.outOfBoundsTime += dt;
    damage(w, p, ZONE_DPS * dt, null, 'zone');
  } else {
    p.outOfBoundsTime = 0;
  }
  p.x = clamp(p.x, -ZONE_MARGIN, arenaW + ZONE_MARGIN);
  p.y = clamp(p.y, -ZONE_MARGIN, arenaH + ZONE_MARGIN);
  if (!p.alive) return;

  // Guns
  p.fireCd -= dt;
  if (input.fire && p.fireCd <= 0) {
    const isTwin = p.perk?.kind === 'twin_vulcan' && w.time < p.perk.until;
    p.fireCd = isTwin ? stats.fireInterval * 0.65 : stats.fireInterval;
    const nose = stats.radius + 4;
    const spread = (rnd(w) - 0.5) * 0.04;
    const a = p.angle + spread;
    if (isTwin) {
      // Twin vulcan streams from both wingtips
      const perpX = -Math.sin(p.angle);
      const perpY = Math.cos(p.angle);
      const offset = stats.radius * 0.65;
      for (const sign of [-1, 1]) {
        w.bullets.push({
          id: w.nextId++,
          owner: p.id,
          team: p.team,
          x: p.x + Math.cos(p.angle) * nose + perpX * offset * sign,
          y: p.y + Math.sin(p.angle) * nose + perpY * offset * sign,
          vx: Math.cos(a) * stats.bulletSpeed + Math.cos(p.angle) * p.speed,
          vy: Math.sin(a) * stats.bulletSpeed + Math.sin(p.angle) * p.speed,
          life: stats.bulletLife,
          dmg: Math.round(stats.bulletDamage * 0.9),
        });
      }
    } else {
      const b: Bullet = {
        id: w.nextId++,
        owner: p.id,
        team: p.team,
        x: p.x + Math.cos(p.angle) * nose,
        y: p.y + Math.sin(p.angle) * nose,
        vx: Math.cos(a) * stats.bulletSpeed + Math.cos(p.angle) * p.speed,
        vy: Math.sin(a) * stats.bulletSpeed + Math.sin(p.angle) * p.speed,
        life: stats.bulletLife,
        dmg: stats.bulletDamage,
      };
      w.bullets.push(b);
    }
  }

  // Missiles
  p.missileCd -= dt;
  if (input.missile && p.missileCd <= 0 && p.missiles > 0) {
    const isCluster = p.perk?.kind === 'cluster_missile' && w.time < p.perk.until;
    p.missileCd = isCluster ? 0.28 : MISSILE_COOLDOWN;
    p.missiles--;
    const lockTarget = findLockTarget(w, p);
    const m: Missile = {
      id: w.nextId++,
      owner: p.id,
      team: p.team,
      x: p.x + Math.cos(p.angle) * (stats.radius + 6),
      y: p.y + Math.sin(p.angle) * (stats.radius + 6),
      angle: p.angle,
      speed: Math.max(MISSILE_SPEED + 35, p.speed + 25),
      target: lockTarget,
      life: MISSILE_LIFE,
    };
    w.missiles.push(m);
  }

  // Special ability
  p.specialCd = Math.max(0, p.specialCd - dt);
  if (input.special && p.specialCd <= 0) activateSpecial(w, p);
}

/** Nearest enemy inside the plane's forward lock cone. Planes with active flares or inside clouds can't be locked. */
export function findLockTarget(w: World, p: Plane): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const o of w.planes) {
    if (!o.alive || !isEnemy(w, p.id, p.team, o) || w.time < o.flareUntil || o.inCloud) continue;
    const d = dist2(p.x, p.y, o.x, o.y);
    if (d > MISSILE_LOCK_RANGE * MISSILE_LOCK_RANGE) continue;
    const a = Math.atan2(o.y - p.y, o.x - p.x);
    const angleOff = Math.abs(angleDiff(p.angle, a));
    if (angleOff > MISSILE_LOCK_CONE / 2) continue;
    // Score balances distance with angular alignment to favor targets directly ahead
    const score = Math.sqrt(d) * (1 + angleOff * 1.25);
    if (score < bestScore) {
      best = o.id;
      bestScore = score;
    }
  }
  return best;
}

/** Checks if a straight line between (x1, y1) and (x2, y2) intersects any map obstacle. */
export function lineBlockedByObstacle(obstacles: Obstacle[], x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;
  for (const o of obstacles) {
    const t = Math.max(0, Math.min(1, ((o.x - x1) * dx + (o.y - y1) * dy) / len2));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    if ((o.x - px) ** 2 + (o.y - py) ** 2 < (o.r - 8) ** 2) return true;
  }
  return false;
}

export interface AutoFireTarget {
  target: Plane;
  dist: number;
  inSights: boolean;
  leadX: number;
  leadY: number;
}

/**
 * Searches for the best enemy target in front of the aircraft for auto-firing.
 * Calculates ballistic intercept lead and checks whether the predicted impact
 * point is within the plane's forward firing cone and effective bullet range.
 */
export function findAutoFireTarget(w: World, p: Plane): AutoFireTarget | null {
  if (!p.alive) return null;
  const stats = PLANES[p.type];
  const maxRange = stats.bulletSpeed * stats.bulletLife;
  let best: AutoFireTarget | null = null;
  let bestScore = Infinity;

  for (const o of w.planes) {
    if (!o.alive || !isEnemy(w, p.id, p.team, o) || o.inCloud) continue;
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRange || dist < 1) continue;

    // Ballistic intercept lead prediction based on relative velocity
    const tFlight = dist / stats.bulletSpeed;
    const oVx = o.vx ?? (Math.cos(o.angle) * o.speed);
    const oVy = o.vy ?? (Math.sin(o.angle) * o.speed);
    const leadX = o.x + oVx * tFlight;
    const leadY = o.y + oVy * tFlight;

    // Check if flight path of bullets is blocked by an obstacle
    if (lineBlockedByObstacle(w.obstacles, p.x, p.y, leadX, leadY)) continue;

    const angleToLead = Math.atan2(leadY - p.y, leadX - p.x);
    const leadOff = Math.abs(angleDiff(p.angle, angleToLead));

    const angleToDirect = Math.atan2(dy, dx);
    const directOff = Math.abs(angleDiff(p.angle, angleToDirect));

    // Tolerance is wider at close range (0.22 rad ≈ 12.6°) and tighter at long range (0.13 rad ≈ 7.4°)
    const tolerance = Math.max(0.13, 0.22 - (dist / maxRange) * 0.09);
    const inSights = leadOff < tolerance || (dist < 280 && directOff < tolerance * 1.2);

    // Score combines angular offset and distance to pick the most immediate threat
    const score = Math.min(leadOff, directOff) * 1.4 + (dist / maxRange);

    if (inSights || score < bestScore) {
      if (!best || (inSights && !best.inSights) || (inSights === best.inSights && score < bestScore)) {
        best = { target: o, dist, inSights, leadX, leadY };
        bestScore = score;
      }
    }
  }

  return best;
}

function stepProjectiles(w: World, dt: number): void {
  const planes = w.planes;
  // Bullets
  const keptB: Bullet[] = [];
  for (const b of w.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) continue;
    if (insideObstacle(w.obstacles, b.x, b.y, 0)) {
      w.events.push({ t: 'hit', x: b.x, y: b.y });
      continue;
    }
    let hit = false;
    for (const p of planes) {
      if (!p.alive || !isEnemy(w, b.owner, b.team, p)) continue;
      const r = PLANES[p.type].radius;
      if (dist2(b.x, b.y, p.x, p.y) <= r * r) {
        damage(w, p, b.dmg, b.owner, b.flak ? 'flak' : 'gun');
        // Kinetic micro-impulse from projectile impact
        const bSpd = Math.hypot(b.vx, b.vy) || 1;
        p.vx = (p.vx ?? 0) + (b.vx / bSpd) * 16;
        p.vy = (p.vy ?? 0) + (b.vy / bSpd) * 16;
        w.events.push({ t: 'hit', x: b.x, y: b.y, dmg: b.dmg });
        hit = true;
        break;
      }
    }
    if (!hit) keptB.push(b);
  }
  w.bullets = keptB;

  // Missiles
  const keptM: Missile[] = [];
  for (const m of w.missiles) {
    m.life -= dt;
    let target = m.target ? planes.find((p) => p.id === m.target && p.alive) : undefined;
    if (target && (w.time < target.flareUntil || target.inCloud)) {
      m.target = null;
      m.lostLock = true;
      target = undefined;
    }

    // In-flight seeker head: unguided missile acquires nearest visible enemy ahead if lock has not been broken
    if (!target && !m.lostLock) {
      let bestDist = 850 * 850;
      let bestPlane: Plane | undefined = undefined;
      for (const p of planes) {
        if (!p.alive || !isEnemy(w, m.owner, m.team, p) || w.time < p.flareUntil || p.inCloud) continue;
        const d = dist2(m.x, m.y, p.x, p.y);
        if (d > bestDist) continue;
        const a = Math.atan2(p.y - m.y, p.x - m.x);
        if (Math.abs(angleDiff(m.angle, a)) > (Math.PI * 0.7) / 2) continue;
        bestPlane = p;
        bestDist = d;
      }
      if (bestPlane) {
        m.target = bestPlane.id;
        target = bestPlane;
      }
    }

    if (target) {
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const dist = Math.hypot(dx, dy);
      const angleToTarget = Math.atan2(dy, dx);
      const offBoresight = Math.abs(angleDiff(m.angle, angleToTarget));

      // Seeker gimbal limit check:
      // If the target banks away or pulls a sharp jiggle maneuver where angle exceeds ~60° (SEEKER_MAX_OFF_BORESIGHT)
      // OR target flashes closely past the missile (dist < 85 && offBoresight > 0.8),
      // the seeker head LOSES TRACK and flies dumbfire straight!
      if (offBoresight > SEEKER_MAX_OFF_BORESIGHT || (dist < 85 && offBoresight > 0.82)) {
        m.target = null; // LOST LOCK! Seeker loses tracking permanently
        m.lostLock = true;
      } else {
        // Direct pursuit when close, predictive lead pursuit when distant
        let desired: number;
        if (dist < 160) {
          desired = angleToTarget;
        } else {
          const tLead = Math.min(0.32, dist / Math.max(1, m.speed));
          const targetVx = target.vx ?? (Math.cos(target.angle) * target.speed);
          const targetVy = target.vy ?? (Math.sin(target.angle) * target.speed);
          const leadX = target.x + targetVx * tLead;
          const leadY = target.y + targetVy * tLead;
          desired = Math.atan2(leadY - m.y, leadX - m.x);
        }
        // Achievable G-force turning rate allowing evasive jiggling
        m.angle = turnTowards(m.angle, desired, MISSILE_TURN * dt);
      }
    }

    // Settle speed towards steady missile cruising speed (245 px/s)
    if (m.speed > MISSILE_SPEED) {
      m.speed = Math.max(MISSILE_SPEED, m.speed - dt * 65);
    }

    m.x += Math.cos(m.angle) * m.speed * dt;
    m.y += Math.sin(m.angle) * m.speed * dt;
    if (m.life <= 0 || insideObstacle(w.obstacles, m.x, m.y, 0)) {
      w.events.push({ t: 'explode', x: m.x, y: m.y, big: false });
      continue;
    }
    let hit = false;
    for (const p of planes) {
      if (!p.alive || !isEnemy(w, m.owner, m.team, p)) continue;
      const r = PLANES[p.type].radius + 6;
      if (dist2(m.x, m.y, p.x, p.y) <= r * r) {
        damage(w, p, MISSILE_DAMAGE, m.owner, 'missile');
        p.speed *= 0.88; // shockwave impact slows victim momentarily
        // Heavy kinetic knockback impulse pushing along missile velocity vector
        const pushImpulse = 140;
        p.vx = (p.vx ?? 0) + Math.cos(m.angle) * pushImpulse;
        p.vy = (p.vy ?? 0) + Math.sin(m.angle) * pushImpulse;
        // Explosive blast jolt rocks the aircraft wings
        const joltDir = Math.sin(m.angle - p.angle) >= 0 ? 0.75 : -0.75;
        p.bank = clamp((p.bank ?? 0) + joltDir, -1, 1);
        w.events.push({ t: 'hit', x: m.x, y: m.y, dmg: MISSILE_DAMAGE });
        w.events.push({ t: 'explode', x: m.x, y: m.y, big: false });
        hit = true;
        break;
      }
    }
    if (!hit) keptM.push(m);
  }
  w.missiles = keptM;
}

const PICKUP_KINDS: PickupKind[] = ['repair', 'shield', 'missiles', 'boost'];

function stepPickups(w: World): void {
  if (w.time >= w.nextPickupAt) {
    w.nextPickupAt = w.time + PICKUP_INTERVAL;
    if (w.pickups.length < MAX_PICKUPS) {
      const kind = PICKUP_KINDS[Math.floor(rnd(w) * PICKUP_KINDS.length)];
      for (let tries = 0; tries < 8; tries++) {
        const x = 200 + rnd(w) * (w.config.arenaW - 400);
        const y = 200 + rnd(w) * (w.config.arenaH - 400);
        if (insideObstacle(w.obstacles, x, y, 50)) continue;
        const pk: Pickup = { id: w.nextId++, kind, x, y };
        w.pickups.push(pk);
        break;
      }
    }
  }
  w.pickups = w.pickups.filter((pk) => {
    for (const p of w.planes) {
      if (!p.alive) continue;
      const r = PLANES[p.type].radius + PICKUP_RADIUS;
      if (dist2(pk.x, pk.y, p.x, p.y) > r * r) continue;
      const stats = PLANES[p.type];
      switch (pk.kind) {
        case 'repair':
          p.hp = Math.min(stats.hp, p.hp + stats.hp * 0.5);
          break;
        case 'shield':
          p.shieldUntil = w.time + SHIELD_TIME;
          break;
        case 'missiles':
          p.missiles = Math.min(stats.missiles + 3, p.missiles + 2);
          break;
        case 'boost':
          p.boostUntil = w.time + BOOST_TIME;
          break;
      }
      w.events.push({ t: 'pickup', id: p.id, kind: pk.kind });
      return false;
    }
    return true;
  });
}

const CRATE_PERKS: AirDropPerk[] = ['twin_vulcan', 'energy_shield', 'cluster_missile', 'overdrive'];

function stepCrates(w: World, dt: number): void {
  w.crates = w.crates ?? [];
  if (w.time >= w.nextCrateAt && w.crates.length < 2) {
    w.nextCrateAt = w.time + CRATE_INTERVAL + rnd(w) * 10;
    const perk = CRATE_PERKS[Math.floor(rnd(w) * CRATE_PERKS.length)];
    const x = 300 + rnd(w) * (w.config.arenaW - 600);
    const y = 300 + rnd(w) * (w.config.arenaH - 600);
    w.crates.push({
      id: w.nextId++,
      x,
      y,
      perk,
      descentY: -130,
      landed: false,
      beaconPhase: 0,
      life: 40,
    });
  }

  const keptC: SupplyCrate[] = [];
  for (const c of w.crates) {
    c.life -= dt;
    c.beaconPhase = (c.beaconPhase + dt * 3) % (Math.PI * 2);
    if (!c.landed) {
      c.descentY += 130 * dt;
      if (c.descentY >= 0) {
        c.descentY = 0;
        c.landed = true;
      }
    }
    if (c.life <= 0) continue;

    let picked = false;
    for (const p of w.planes) {
      if (!p.alive) continue;
      const r = PLANES[p.type].radius + 24;
      if (dist2(c.x, c.y, p.x, p.y) <= r * r) {
        picked = true;
        p.perk = { kind: c.perk, until: w.time + 12 };
        if (c.perk === 'energy_shield') p.shieldUntil = Math.max(p.shieldUntil, w.time + 12);
        if (c.perk === 'cluster_missile') p.missiles = Math.min(PLANES[p.type].missiles + 4, p.missiles + 4);
        if (c.perk === 'overdrive') p.boostUntil = Math.max(p.boostUntil, w.time + 10);

        const titles: Record<AirDropPerk, string> = {
          twin_vulcan: 'TWIN VULCAN! 💥',
          energy_shield: 'ENERGY SHIELD! 🛡️',
          cluster_missile: 'CLUSTER MISSILES! 🚀',
          overdrive: 'HYPER OVERDRIVE! ⚡',
        };
        const subtitles: Record<AirDropPerk, string> = {
          twin_vulcan: 'Dual high-velocity tracer rounds',
          energy_shield: 'Invulnerable forcefield active (12s)',
          cluster_missile: '+4 rapid tracking missiles loaded',
          overdrive: 'Maximum speed & afterburner boost',
        };
        const colors: Record<AirDropPerk, string> = {
          twin_vulcan: '#ff4d4d',
          energy_shield: '#00f5d4',
          cluster_missile: '#ffd23f',
          overdrive: '#c77dff',
        };

        w.events.push({ t: 'pickup_crate', id: p.id, perk: c.perk, x: c.x, y: c.y });
        w.events.push({
          t: 'accolade',
          id: p.id,
          title: titles[c.perk],
          subtitle: subtitles[c.perk],
          color: colors[c.perk],
          sound: 'streak',
        });
        break;
      }
    }
    if (!picked) keptC.push(c);
  }
  w.crates = keptC;
}

// ---------------- Capture the Flag ----------------

export function flagAtHome(f: Flag): boolean {
  return f.carrier === null && f.droppedAt === null;
}

function returnFlag(w: World, f: Flag, by: string | null): void {
  f.carrier = null;
  f.droppedAt = null;
  f.x = f.homeX;
  f.y = f.homeY;
  w.events.push({ t: 'flag', team: f.team, action: 'return', by });
}

function dropFlag(w: World, f: Flag): void {
  const carrier = w.planes.find((p) => p.id === f.carrier);
  if (carrier) {
    f.x = carrier.x;
    f.y = carrier.y;
  }
  // A flag dropped inside a rock or outside the arena goes straight home.
  const { arenaW, arenaH } = w.config;
  const by = f.carrier;
  f.carrier = null;
  if (insideObstacle(w.obstacles, f.x, f.y, 10) || f.x < 0 || f.y < 0 || f.x > arenaW || f.y > arenaH) {
    returnFlag(w, f, null);
    return;
  }
  f.droppedAt = w.time;
  w.events.push({ t: 'flag', team: f.team, action: 'drop', by });
}

function stepFlags(w: World): void {
  if (w.config.mode !== 'ctf') return;
  for (const f of w.flags) {
    if (f.carrier) {
      const c = w.planes.find((p) => p.id === f.carrier);
      if (!c || !c.alive) {
        dropFlag(w, f);
        continue;
      }
      f.x = c.x;
      f.y = c.y;
      // Capture: carrier reaches their own base while their own flag is home.
      const own = w.flags.find((g) => g.team === c.team)!;
      if (flagAtHome(own) && dist2(c.x, c.y, own.homeX, own.homeY) < (FLAG_RADIUS + 20) ** 2) {
        c.caps++;
        w.teamScores[c.team as 0 | 1]++;
        w.events.push({ t: 'flag', team: f.team, action: 'capture', by: c.id });
        f.carrier = null;
        f.droppedAt = null;
        f.x = f.homeX;
        f.y = f.homeY;
      }
      continue;
    }
    if (f.droppedAt !== null && w.time - f.droppedAt > FLAG_RETURN_TIME) {
      returnFlag(w, f, null);
      continue;
    }
    for (const p of w.planes) {
      if (!p.alive) continue;
      const r = FLAG_RADIUS + PLANES[p.type].radius;
      if (dist2(p.x, p.y, f.x, f.y) > r * r) continue;
      if (p.team !== f.team) {
        // Don't let one plane carry both flags.
        if (w.flags.some((g) => g.carrier === p.id)) continue;
        f.carrier = p.id;
        f.droppedAt = null;
        w.events.push({ t: 'flag', team: f.team, action: 'take', by: p.id });
        break;
      } else if (f.droppedAt !== null) {
        returnFlag(w, f, p.id);
        break;
      }
    }
  }
}

function checkEnd(w: World): void {
  const { mode, killLimit, captureLimit, timeLimit } = w.config;
  let over = w.time >= timeLimit;
  if (mode === 'tdm') {
    if (w.teamScores[0] >= killLimit || w.teamScores[1] >= killLimit) over = true;
  } else if (mode === 'ctf') {
    if (w.teamScores[0] >= captureLimit || w.teamScores[1] >= captureLimit) over = true;
  } else if (w.planes.some((p) => p.kills >= killLimit)) {
    over = true;
  }
  if (!over) return;
  w.ended = true;
  if (isTeamMode(mode)) {
    const [a, b] = w.teamScores;
    w.winnerTeam = a === b ? null : a > b ? 0 : 1;
  } else {
    const sorted = standings(w);
    const top = sorted[0];
    const tie = sorted[1] && sorted[1].kills === top?.kills && sorted[1].deaths === top.deaths;
    w.winner = top && !tie ? top.id : null;
  }
  w.events.push({ t: 'end', winner: w.winner, winnerTeam: w.winnerTeam });
}

/** Advance the world by one fixed tick. Mutates `w` in place. */
export function step(w: World, inputs: Record<string, Input | undefined>, dt = DT): void {
  if (w.ended) return;
  w.tick++;
  w.time += dt;
  for (const p of w.planes) stepPlane(w, p, inputs[p.id] ?? IDLE_INPUT, dt);
  stepProjectiles(w, dt);
  stepPickups(w);
  stepCrates(w, dt);
  stepFlags(w);
  checkEnd(w);
}

/** Returns planes ordered for a scoreboard. */
export function standings(w: World): Plane[] {
  return [...w.planes].sort((a, b) => b.caps - a.caps || b.kills - a.kills || a.deaths - b.deaths);
}

export { wrapAngle };
