import { matchFont, PaintStyle, Skia, SkCanvas, SkFont, SkPaint, SkPath, StrokeCap } from '@shopify/react-native-skia';
import { PLANES } from '../sim/planes';
import { Cloud, GameEvent, isTeamMode, PickupKind, Plane, PlaneType, World } from '../sim/types';
import { MAPS, MapPalette } from '../sim/maps';
import { findAutoFireTarget, findLockTarget, FLAG_RADIUS } from '../sim/world';
import { GameSession } from './session';
import { drawPlane, drawPlaneShadow } from './planeArt';
import { drawGroundTerrain, drawTrees, getTerrain } from './terrainArt';

// ---------- Palette (Sky Force Reloaded Cinematic Sci-Fi Theme) ----------
export const COLORS = {
  sky: '#0a1d37',
  skyDark: '#061122',
  grid: 'rgba(0,229,255,0.08)',
  cloud: 'rgba(255,255,255,0.48)',
  zone: 'rgba(220,30,50,0.3)',
  border: 'rgba(0,229,255,0.9)',
  me: '#ffd23f',
  team: ['#00b4d8', '#ff3b3b'],
  ffa: ['#ff3b3b', '#9b5de5', '#00f5d4', '#f15bb5', '#fe7f2d', '#00b4d8', '#ffd23f', '#e63946'],
  bullet: '#ffffff',
  bulletGlow: '#00e5ff',
  missile: '#ffffff',
  pickup: { repair: '#00f5d4', shield: '#00e5ff', missiles: '#ffaa00', boost: '#c77dff' } as Record<PickupKind, string>,
};

const PICKUP_LETTER: Record<PickupKind, string> = { repair: '+', shield: 'S', missiles: 'M', boost: 'B' };

export function planeColor(w: World, p: Plane, myId: string): string {
  if (p.id === myId) return COLORS.me;
  if (isTeamMode(w.config.mode)) return COLORS.team[p.team] ?? COLORS.team[1];
  const idx = w.planes.findIndex((q) => q.id === p.id);
  return COLORS.ffa[idx % COLORS.ffa.length];
}

// ---------- Cached Skia objects ----------
function paint(color: string, stroke = 0, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (stroke > 0) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
    p.setStrokeCap(StrokeCap.Round);
  }
  p.setAlphaf(alpha);
  return p;
}

function polyPath(pts: [number, number][]): SkPath {
  const d = 'M ' + pts.map(([x, y]) => `${x} ${y}`).join(' L ') + ' Z';
  return Skia.Path.MakeFromSVGString(d)!;
}

function planePath(type: PlaneType): SkPath {
  // Unit shapes pointing along +x; scaled by plane radius at draw time.
  const pts: Record<PlaneType, [number, number][]> = {
    interceptor: [[1.3, 0], [0.2, 0.25], [-0.3, 1.0], [-0.55, 1.0], [-0.45, 0.25], [-0.9, 0.45], [-1.0, 0.45], [-0.85, 0],
      [-1.0, -0.45], [-0.9, -0.45], [-0.45, -0.25], [-0.55, -1.0], [-0.3, -1.0], [0.2, -0.25]],
    fighter: [[1.2, 0], [0.5, 0.18], [0.1, 1.1], [-0.25, 1.1], [-0.3, 0.22], [-0.8, 0.55], [-1.0, 0.55], [-0.9, 0],
      [-1.0, -0.55], [-0.8, -0.55], [-0.3, -0.22], [-0.25, -1.1], [0.1, -1.1], [0.5, -0.18]],
    bomber: [[1.1, 0], [0.8, 0.25], [0.3, 0.3], [0.0, 1.2], [-0.35, 1.2], [-0.35, 0.3], [-0.85, 0.3], [-1.0, 0.6], [-1.1, 0.6],
      [-1.0, 0], [-1.1, -0.6], [-1.0, -0.6], [-0.85, -0.3], [-0.35, -0.3], [-0.35, -1.2], [0.0, -1.2], [0.3, -0.3], [0.8, -0.25]],
    stealth: [[1.35, 0], [0.3, 0.22], [-0.15, 1.15], [-0.45, 1.15], [-0.55, 0.65], [-0.5, 0.2], [-0.85, 0.45], [-1.05, 0.4], [-0.95, 0],
      [-1.05, -0.4], [-0.85, -0.45], [-0.5, -0.2], [-0.55, -0.65], [-0.45, -1.15], [-0.15, -1.15], [0.3, -0.22]],
    gunship: [[1.3, 0], [1.1, 0.2], [0.3, 0.22], [0.15, 1.3], [-0.2, 1.3], [-0.3, 0.22], [-0.75, 0.18], [-0.85, 0.65], [-1.1, 0.65],
      [-1.05, 0.15], [-1.05, 0], [-1.05, -0.15], [-1.1, -0.65], [-0.85, -0.65], [-0.75, -0.18], [-0.3, -0.22], [-0.2, -1.3], [0.15, -1.3], [0.3, -0.22], [1.1, -0.2]],
  };
  return polyPath(pts[type]);
}

let cache: {
  paths: Record<PlaneType, SkPath>;
  arrow: SkPath;
  missileBody: SkPath;
  missileNose: SkPath;
  missileFins: SkPath;
  fill: Record<string, SkPaint>;
  outline: SkPaint;
  font: SkFont;
  smallFont: SkFont;
  p: Record<string, SkPaint>;
} | null = null;

interface BulletStyle {
  outer: SkPaint;
  trail: SkPaint;
  flame: SkPaint;
  hot: SkPaint;
  core: SkPaint;
  white: SkPaint;
  radius: number;
  tailLen: number;
}

interface MissileStyle {
  body: SkPaint;
  nose: SkPaint;
  fins: SkPaint;
  flameOuter: SkPaint;
  flameInner: SkPaint;
  scale: number;
}

let bulletStylesCache: Record<PlaneType | 'flak', BulletStyle> | null = null;
let missileStylesCache: Record<PlaneType, MissileStyle> | null = null;

function makeBulletStyle(outer: string, flame: string, hot: string, core: string, radius: number, tailLen: number): BulletStyle {
  return {
    outer: paint(outer, 0, 0.32),
    trail: paint(flame, 0, 0.28),
    flame: paint(flame, radius * 0.85, 0.88),
    hot: paint(hot),
    core: paint(core),
    white: paint('#ffffff'),
    radius,
    tailLen,
  };
}

function getBulletStyles(): Record<PlaneType | 'flak', BulletStyle> {
  if (bulletStylesCache) return bulletStylesCache;
  bulletStylesCache = {
    interceptor: makeBulletStyle('#00b4d8', '#00e5ff', '#7dd3fc', '#e0f2fe', 3.4, 13),
    fighter: makeBulletStyle('#ff2200', '#ff5500', '#ff9900', '#ffd23f', 4.0, 10),
    bomber: makeBulletStyle('#dc2626', '#ff3b3b', '#ff7700', '#fde047', 5.0, 11),
    stealth: makeBulletStyle('#7e22ce', '#a855f7', '#e879f9', '#fae8ff', 3.5, 14),
    gunship: makeBulletStyle('#059669', '#10b981', '#a3e635', '#ecfccb', 3.6, 11),
    flak: makeBulletStyle('#b91c1c', '#ef4444', '#fb923c', '#fef08a', 4.8, 8),
  };
  return bulletStylesCache;
}

function getMissileStyles(): Record<PlaneType, MissileStyle> {
  if (missileStylesCache) return missileStylesCache;
  missileStylesCache = {
    interceptor: {
      body: paint('#e2e8f0'),
      nose: paint('#00e5ff'),
      fins: paint('#38bdf8'),
      flameOuter: paint('#00e5ff', 0, 0.9),
      flameInner: paint('#ffffff', 0, 0.98),
      scale: 1.0,
    },
    fighter: {
      body: paint('#f1f5f9'),
      nose: paint('#ff3b3b'),
      fins: paint('#64748b'),
      flameOuter: paint('#ff6b00', 0, 0.9),
      flameInner: paint('#fff3b0', 0, 0.98),
      scale: 1.05,
    },
    bomber: {
      body: paint('#cbd5e1'),
      nose: paint('#dc2626'),
      fins: paint('#475569'),
      flameOuter: paint('#ff4400', 0, 0.92),
      flameInner: paint('#fef08a', 0, 0.98),
      scale: 1.28,
    },
    stealth: {
      body: paint('#1e1b4b'),
      nose: paint('#c084fc'),
      fins: paint('#7e22ce'),
      flameOuter: paint('#a855f7', 0, 0.9),
      flameInner: paint('#fae8ff', 0, 0.98),
      scale: 1.05,
    },
    gunship: {
      body: paint('#334155'),
      nose: paint('#10b981'),
      fins: paint('#10b981'),
      flameOuter: paint('#f59e0b', 0, 0.9),
      flameInner: paint('#ffffff', 0, 0.98),
      scale: 1.15,
    },
  };
  return missileStylesCache;
}

function getCache() {
  if (cache) return cache;
  const font = matchFont({ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold' });
  const smallFont = matchFont({ fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold' });
  cache = {
    paths: {
      interceptor: planePath('interceptor'),
      fighter: planePath('fighter'),
      bomber: planePath('bomber'),
      stealth: planePath('stealth'),
      gunship: planePath('gunship'),
    },
    arrow: polyPath([[12, 0], [-8, 8], [-8, -8]]),
    missileBody: polyPath([[7, -2.1], [-9, -2.1], [-9, 2.1], [7, 2.1]]),
    missileNose: polyPath([[13.5, 0], [7, -2.2], [7, 2.2]]),
    missileFins: Skia.Path.MakeFromSVGString(
      'M -4 -2 L -9.5 -6 L -11 -6 L -8.5 -2 Z M -4 2 L -9.5 6 L -11 6 L -8.5 2 Z M 2 -2 L -0.5 -4.2 L -2 -4.2 L -1.2 -2 Z M 2 2 L -0.5 4.2 L -2 4.2 L -1.2 2 Z',
    )!,
    fill: {},
    outline: paint('#1b1b2f', 0.12),
    font,
    smallFont,
    p: {
      sky: paint(COLORS.sky),
      grid: paint(COLORS.grid, 2),
      cloud: paint(COLORS.cloud),
      zone: paint(COLORS.zone),
      border: paint(COLORS.border, 6),
      bullet: paint(COLORS.bullet, 3),
      bulletGlow: paint('#00e5ff', 5.5, 0.45),
      bulletCore: paint('#ffffff', 2.2),
      missile: paint(COLORS.missile),
      trail: paint('#ffffff', 0, 0.35),
      shield: paint('#00e5ff', 3, 0.8),
      hpBg: paint('#050c18', 0, 0.65),
      hpFg: paint('#00f5d4'),
      hpLow: paint('#ff2a4a'),
      text: paint('#ffffff'),
      textShadow: paint('#000000', 0, 0.7),
      shadow: paint('#000000', 0, 0.22),
      fx: paint('#ffb703'),
      fxSmoke: paint('#334155'),
      spark: paint('#fff3b0'),
      sparkStreak: paint('#ffeedd', 2.2),
      starGold: paint('#ffd23f'),
      starCore: paint('#fff8d6'),
      miniBg: paint('#050f1d', 0, 0.65),
      miniBorder: paint('#00e5ff', 1.5, 0.7),
      arrow: paint('#ffffff'),
      lock: paint('#ff2a4a', 2),
      pole: paint('#ffffff', 3),
      aimLine: paint('#00e5ff', 2, 0.45),
      aimChevron: paint('#00e5ff', 2.5, 0.85),
      aimGlow: paint('#00e5ff', 0, 0.25),
      alertVignette: paint('#ff1e42', 8, 0.4),
      techBracket: paint('#00e5ff', 2, 0.4),
      cloudShadow: paint('rgba(0, 10, 28, 0.16)'),
      cloudShade: paint('rgba(165, 195, 225, 0.52)'),
      cloudBody: paint('rgba(255, 255, 255, 0.80)'),
      cloudCrest: paint('rgba(255, 255, 255, 0.96)'),
      cloudVapor: paint('rgba(255, 255, 255, 0.88)'),
      cloudMist: paint('rgba(240, 248, 255, 0.72)'),
      craterSoot: paint('rgba(15, 12, 10, 0.7)'),
      craterBowl: paint('rgba(5, 5, 5, 0.88)'),
      craterEmber: paint('#ff6b1a', 2.2),
      craterEmberGlow: paint('#ff3300', 0, 0.45),
      groundShockwave: paint('rgba(230, 195, 150, 0.68)', 3),
      groundShockwaveWater: paint('rgba(200, 240, 255, 0.78)', 3),
      groundFireCore: paint('#ffffff'),
      groundFireMid: paint('#ff9900'),
      groundFireOuter: paint('#e62200'),
      groundSmoke: paint('rgba(28, 32, 38, 0.75)'),
      missileShadow: paint('rgba(0, 8, 20, 0.3)'),
      // Enhanced explosion paints (Sky Force Reloaded cinematic fireballs)
      boomBloom: paint('#ff4400', 0, 0.35),
      boomFireOuter: paint('#cc2200'),
      boomFireMid: paint('#ff6600'),
      boomFireInner: paint('#ff9922'),
      boomFireCore: paint('#ffffcc'),
      boomCoreWhite: paint('#ffffff'),
      boomEmber: paint('#ffaa00', 0, 0.85),
      boomSmokeRing: paint('rgba(40, 20, 10, 0.55)'),
      boomHeatDistort: paint('rgba(255, 60, 20, 0.18)'),
      boomFlash: paint('#ffffff', 0, 0.65),
      // Enhanced bullet paints (glowing plasma bolts)
      bulletOuter: paint('#ff2200', 0, 0.45),
      bulletFlame: paint('#ff5500', 0, 0.85),
      bulletHot: paint('#ff8800'),
      bulletCoreHot: paint('#ffcc44'),
      bulletWhiteHot: paint('#ffffff'),
      bulletTrailGlow: paint('#ff4400', 0, 0.3),
    },
  };
  return cache;
}

const palettePaints: Record<string, Record<keyof MapPalette, SkPaint>> = {};
function mapPaints(pal: MapPalette, key: string) {
  if (!palettePaints[key]) {
    palettePaints[key] = {
      sky: paint(pal.sky),
      grid: paint(pal.grid, 2),
      cloud: paint(pal.cloud),
      zone: paint(pal.zone),
      border: paint(pal.border, 6),
      rock: paint(pal.rock),
      rockEdge: paint(pal.rockEdge, 5),
      rockTop: paint(pal.rockTop),
    };
  }
  return palettePaints[key];
}

function fillFor(color: string): SkPaint {
  const c = getCache();
  if (!c.fill[color]) c.fill[color] = paint(color);
  return c.fill[color];
}

// ---------- Visual effects (client-side only) ----------
interface Fx {
  x: number;
  y: number;
  age: number;
  life: number;
  kind: 'boom' | 'smallboom' | 'spark' | 'flare' | 'flak' | 'dash' | 'dmgText' | 'smokePuff' | 'fireEmber' | 'shockwave' | 'shrapnel' | 'cloak' | 'overdrive' | 'cloudVapor' | 'cloudMist' | 'cloudTrail' | 'groundShockwave' | 'groundFireball' | 'groundSmoke';
  vx?: number;
  vy?: number;
  text?: string;
  color?: string;
  radius?: number;
  angle?: number;
  vAngle?: number;
}

export interface CloudWake {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  perpX: number;
  perpY: number;
  radius: number;
  age: number;
  life: number;
}

export interface GroundCrater {
  x: number;
  y: number;
  radius: number;
  angle: number;
  age: number;
  life: number;
}

export class FxSystem {
  list: Fx[] = [];
  craters: GroundCrater[] = [];
  wakes: CloudWake[] = [];
  planeMoisture: Record<string, number> = {};
  private smokeTimer = 0;
  private wakeDropTimer = 0;

  getCloudDisplacement(wx: number, wy: number, lobeR: number): [number, number] {
    let dispX = 0;
    let dispY = 0;
    for (let i = 0; i < this.wakes.length; i++) {
      const wk = this.wakes[i];
      const dx = wx - wk.x;
      const dy = wy - wk.y;
      const d2 = dx * dx + dy * dy;
      const maxR = wk.radius + lobeR * 0.6;
      if (d2 < maxR * maxR) {
        const d = Math.sqrt(d2);
        const tLife = 1 - wk.age / wk.life;
        const tDist = 1 - d / maxR;
        const strength = tLife * tDist;

        // Aerodynamic forward bulge: cloud shape deforms along flight heading vector
        const fwdPush = strength * 11.0;
        dispX += wk.dirX * fwdPush;
        dispY += wk.dirY * fwdPush;

        // Subtle lateral parting along the jet's wings
        const lateral = dx * wk.perpX + dy * wk.perpY;
        const sign = lateral >= 0 ? 1 : -1;
        const latPush = strength * 4.0;
        dispX += wk.perpX * sign * latPush;
        dispY += wk.perpY * sign * latPush;
      }
    }
    dispX = Math.max(-16, Math.min(16, dispX));
    dispY = Math.max(-16, Math.min(16, dispY));
    return [dispX, dispY];
  }

  push(events: GameEvent[]) {
    for (const e of events) {
      if (e.t === 'explode') {
        const isGround = Boolean(e.ground);
        if (isGround) {
          // Register persistent ground crater
          this.craters.push({
            x: e.x,
            y: e.y,
            radius: 22 + Math.random() * 8,
            angle: Math.random() * Math.PI * 2,
            age: 0,
            life: 14.0,
          });
          if (this.craters.length > 35) this.craters.splice(0, this.craters.length - 35);

          // Kinetic ground shockwave blast ring
          this.list.push({
            x: e.x,
            y: e.y,
            age: 0,
            life: 0.55,
            kind: 'groundShockwave',
            radius: 110,
          });

          // Multi-lobed fireball dome
          this.list.push({
            x: e.x,
            y: e.y,
            age: 0,
            life: 0.65,
            kind: 'groundFireball',
            radius: 34,
          });
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = 12 + Math.random() * 16;
            this.list.push({
              x: e.x + Math.cos(a) * dist,
              y: e.y + Math.sin(a) * dist,
              vx: Math.cos(a) * 35,
              vy: Math.sin(a) * 35 - 15,
              age: 0,
              life: 0.45 + Math.random() * 0.2,
              kind: 'groundFireball',
              radius: 20 + Math.random() * 8,
            });
          }

          // Billowing dark soot / smoke rising from the crater
          for (let i = 0; i < 5; i++) {
            this.list.push({
              x: e.x + (Math.random() - 0.5) * 22,
              y: e.y + (Math.random() - 0.5) * 14,
              vx: (Math.random() - 0.5) * 30,
              vy: -35 - Math.random() * 25,
              age: 0,
              life: 1.2 + Math.random() * 0.5,
              kind: 'groundSmoke',
              radius: 14 + Math.random() * 10,
            });
          }

          // Radial starburst of tumbling dirt clods, scorching shrapnel & debris
          const debrisColors = ['#ff7700', '#4a2c14', '#1e1e1e', '#ffaa00'];
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const spd = 90 + Math.random() * 160;
            this.list.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd - 20,
              age: 0,
              life: 0.9 + Math.random() * 0.5,
              kind: 'shrapnel',
              radius: 4 + Math.random() * 6,
              angle: Math.random() * Math.PI * 2,
              vAngle: (Math.random() - 0.5) * 16,
              color: debrisColors[i % debrisColors.length],
            });
          }

          // Fiery molten sparks
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 120 + Math.random() * 190;
            this.list.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd,
              age: 0,
              life: 0.35 + Math.random() * 0.25,
              kind: 'spark',
            });
          }
        } else {
          this.list.push({ x: e.x, y: e.y, age: 0, life: e.big ? 0.9 : 0.45, kind: e.big ? 'boom' : 'smallboom' });
          // Kinetic expanding shockwave ring
          this.list.push({ x: e.x, y: e.y, age: 0, life: e.big ? 0.65 : 0.35, kind: 'shockwave', radius: e.big ? 140 : 70 });
          if (e.big) {
            // Eject 6-8 pieces of tumbling fiery plane fuselage and wing wreckage
            for (let i = 0; i < 7; i++) {
              const a = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
              const spd = 75 + Math.random() * 125;
              this.list.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * spd,
                vy: Math.sin(a) * spd,
                age: 0,
                life: 1.1 + Math.random() * 0.5,
                kind: 'shrapnel',
                radius: 5 + Math.random() * 6,
                angle: Math.random() * Math.PI * 2,
                vAngle: (Math.random() - 0.5) * 14,
                color: i % 2 === 0 ? '#ffb703' : '#333333',
              });
            }
          }
        }
      } else if (e.t === 'hit') {
        // High-velocity armor spark shower in all directions
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
          const spd = 110 + Math.random() * 180;
          this.list.push({
            x: e.x,
            y: e.y,
            age: 0,
            life: 0.18 + Math.random() * 0.14,
            kind: 'spark',
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
          });
        }
        // Floating combat damage numbers with upward drift
        if (e.dmg && e.dmg >= 1) {
          const dmgVal = Math.round(e.dmg);
          const color = dmgVal >= 25 ? '#ff4d4d' : dmgVal >= 14 ? '#ffb703' : '#ffffff';
          this.list.push({
            x: e.x + (Math.random() - 0.5) * 14,
            y: e.y - 8,
            age: 0,
            life: 0.7,
            kind: 'dmgText',
            text: `-${dmgVal}`,
            vx: (Math.random() - 0.5) * 20,
            vy: -48 - Math.random() * 18,
            color,
          });
        }
      } else if (e.t === 'special') {
        const life = e.kind === 'flare' ? 1.0 : e.kind === 'cloak' ? 1.2 : e.kind === 'overdrive' ? 0.75 : 0.4;
        this.list.push({ x: e.x, y: e.y, age: 0, life, kind: e.kind });
      }
    }
    if (this.list.length > 280) this.list.splice(0, this.list.length - 280);
  }

  update(dt: number, planes?: Plane[], clouds?: Cloud[]) {
    // 0) Update ground craters
    for (let i = 0; i < this.craters.length; i++) {
      this.craters[i].age += dt;
    }
    this.craters = this.craters.filter((cr) => cr.age < cr.life);

    // 1) Update active cloud wakes
    for (let i = 0; i < this.wakes.length; i++) {
      this.wakes[i].age += dt;
    }
    this.wakes = this.wakes.filter((wk) => wk.age < wk.life);
    if (this.wakes.length > 45) this.wakes.splice(0, this.wakes.length - 45);

    // 2) Update active particles
    for (const f of this.list) {
      f.age += dt;
      if (f.vx) f.x += f.vx * dt;
      if (f.vy) f.y += f.vy * dt;
      if (f.vAngle) f.angle = (f.angle ?? 0) + f.vAngle * dt;
      if (f.kind === 'shrapnel') {
        f.vx = (f.vx ?? 0) * 0.97;
        f.vy = (f.vy ?? 0) * 0.97;
      }
      if (f.kind === 'groundSmoke') {
        f.vx = (f.vx ?? 0) * 0.95;
        f.vy = (f.vy ?? 0) * 0.95;
        f.radius = (f.radius ?? 14) * (1 + dt * 1.3);
      }
      if (f.kind === 'groundFireball') {
        f.vx = (f.vx ?? 0) * 0.92;
        f.vy = (f.vy ?? 0) * 0.92;
        f.radius = (f.radius ?? 20) * (1 + dt * 0.9);
      }
      if (f.kind === 'cloudVapor' || f.kind === 'cloudTrail') {
        f.vx = (f.vx ?? 0) * 0.94;
        f.vy = (f.vy ?? 0) * 0.94;
        f.radius = (f.radius ?? 5) * (1 + dt * 1.5);
      }
      if (f.kind === 'cloudMist') {
        f.vx = (f.vx ?? 0) * 0.91;
        f.vy = (f.vy ?? 0) * 0.91;
        f.radius = (f.radius ?? 10) * (1 + dt * 2.2);
      }
    }
    this.list = this.list.filter((f) => f.age < f.life);

    // 3) Aircraft cloud interactions & smoke trails
    if (planes) {
      this.wakeDropTimer += dt;
      const dropWake = this.wakeDropTimer >= 0.035;
      if (dropWake) this.wakeDropTimer = 0;

      this.smokeTimer += dt;
      const dropSmoke = this.smokeTimer >= 0.05;
      if (dropSmoke) this.smokeTimer = 0;

      for (const p of planes) {
        if (!p.alive) continue;
        const st = PLANES[p.type];

        // Low-HP distress smoke trails
        const frac = p.hp / st.hp;
        if (dropSmoke && frac < 0.5) {
          const behindX = p.x - Math.cos(p.angle) * st.radius;
          const behindY = p.y - Math.sin(p.angle) * st.radius;
          this.list.push({
            x: behindX + (Math.random() - 0.5) * 6,
            y: behindY + (Math.random() - 0.5) * 6,
            age: 0,
            life: 0.85 + Math.random() * 0.4,
            kind: 'smokePuff',
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.5) * 14,
            radius: 8 + (1 - frac) * 10,
          });

          if (frac < 0.25) {
            this.list.push({
              x: behindX + (Math.random() - 0.5) * 8,
              y: behindY + (Math.random() - 0.5) * 8,
              age: 0,
              life: 0.35 + Math.random() * 0.2,
              kind: 'fireEmber',
              vx: (Math.random() - 0.5) * 22,
              vy: (Math.random() - 0.5) * 22,
              radius: 4 + Math.random() * 3,
            });
          }
        }

        // Check if inside or slicing through a cloud
        let nearCloud = p.inCloud;
        if (!nearCloud && clouds) {
          for (const cl of clouds) {
            const d2 = (p.x - cl.x) ** 2 + (p.y - cl.y) ** 2;
            if (d2 <= (cl.r + st.radius + 20) ** 2) {
              nearCloud = true;
              break;
            }
          }
        }

        if (nearCloud) {
          // Brief condensation on aircraft cutting through cloud (0.45s)
          this.planeMoisture[p.id] = 0.45;

          // Drop subtle wake node
          if (dropWake) {
            const dirX = Math.cos(p.angle);
            const dirY = Math.sin(p.angle);
            const perpX = -dirY;
            const perpY = dirX;
            this.wakes.push({
              x: p.x,
              y: p.y,
              dirX,
              dirY,
              perpX,
              perpY,
              radius: st.radius * 2.0 + 25,
              age: 0,
              life: 1.8,
            });
          }
        }

        // Faint, thin aerodynamic wingtip vortex vapor streamers
        const moist = this.planeMoisture[p.id] ?? 0;
        if (moist > 0) {
          this.planeMoisture[p.id] = moist - dt;
          const moistFrac = Math.min(1, moist / 0.45);

          const span = st.radius * 0.85;
          const tipBack = st.radius * 0.2;
          const cosA = Math.cos(p.angle);
          const sinA = Math.sin(p.angle);

          // Left wingtip vortex
          const tipLx = p.x - cosA * tipBack - sinA * span;
          const tipLy = p.y - sinA * tipBack + cosA * span;
          this.list.push({
            x: tipLx,
            y: tipLy,
            vx: -cosA * 6,
            vy: -sinA * 6,
            age: 0,
            life: 0.24 * moistFrac + 0.1,
            kind: 'cloudVapor',
            radius: 1.6 + moistFrac * 0.8,
          });

          // Right wingtip vortex
          const tipRx = p.x - cosA * tipBack + sinA * span;
          const tipRy = p.y - sinA * tipBack - cosA * span;
          this.list.push({
            x: tipRx,
            y: tipRy,
            vx: -cosA * 6,
            vy: -sinA * 6,
            age: 0,
            life: 0.24 * moistFrac + 0.1,
            kind: 'cloudVapor',
            radius: 1.6 + moistFrac * 0.8,
          });
        }
      }
    }
    if (this.list.length > 280) this.list.splice(0, this.list.length - 280);
  }
}

interface CloudLobe {
  ox: number;
  oy: number;
  r: number;
}

interface CloudMesh {
  shadowOffset: { x: number; y: number };
  baseLobes: CloudLobe[];
  crestLobes: CloudLobe[];
}

const cloudCache = new WeakMap<Cloud, CloudMesh>();

function getCloudMesh(cl: Cloud): CloudMesh {
  let hit = cloudCache.get(cl);
  if (hit) return hit;

  let s = Math.floor(Math.abs(cl.x * 31 + cl.y * 73 + cl.r * 101)) % 2147483647;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const baseLobes: CloudLobe[] = [];
  const crestLobes: CloudLobe[] = [];

  // Core central mound
  baseLobes.push({ ox: 0, oy: 0, r: cl.r * 0.75 });
  crestLobes.push({ ox: -cl.r * 0.12, oy: -cl.r * 0.14, r: cl.r * 0.52 });

  // 7 to 9 billowy perimeter mounds
  const numPerimeter = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < numPerimeter; i++) {
    const baseAngle = (i / numPerimeter) * Math.PI * 2;
    const angle = baseAngle + (rnd() - 0.5) * 0.35;
    const dist = cl.r * (0.36 + rnd() * 0.3);
    const lobeR = cl.r * (0.42 + rnd() * 0.28);
    const ox = Math.cos(angle) * dist;
    const oy = Math.sin(angle) * dist;

    baseLobes.push({ ox, oy, r: lobeR });
    crestLobes.push({
      ox: ox - lobeR * 0.16,
      oy: oy - lobeR * 0.16,
      r: lobeR * 0.6,
    });

    if (rnd() > 0.45) {
      const wAngle = angle + (rnd() - 0.5) * 0.45;
      const wDist = dist + lobeR * 0.55;
      baseLobes.push({
        ox: Math.cos(wAngle) * wDist,
        oy: Math.sin(wAngle) * wDist,
        r: lobeR * 0.42,
      });
    }
  }

  hit = {
    shadowOffset: { x: 34 + rnd() * 8, y: 46 + rnd() * 10 },
    baseLobes,
    crestLobes,
  };
  cloudCache.set(cl, hit);
  return hit;
}

function drawCloudGroundShadows(
  canvas: SkCanvas,
  clouds: Cloud[],
  visible: (x: number, y: number, pad: number) => boolean,
  fx: FxSystem,
  c: ReturnType<typeof getCache>,
) {
  const pShadow = c.p.cloudShadow;
  for (const cl of clouds) {
    if (!visible(cl.x, cl.y, cl.r * 2.5)) continue;
    const mesh = getCloudMesh(cl);
    const sx = cl.x + mesh.shadowOffset.x;
    const sy = cl.y + mesh.shadowOffset.y;
    for (const lobe of mesh.baseLobes) {
      const origX = cl.x + lobe.ox;
      const origY = cl.y + lobe.oy;
      const [dispX, dispY] = fx.getCloudDisplacement(origX, origY, lobe.r);
      canvas.drawCircle(sx + lobe.ox + dispX, sy + lobe.oy + dispY, lobe.r, pShadow);
    }
  }
}

function drawVolumetricClouds(
  canvas: SkCanvas,
  clouds: Cloud[],
  visible: (x: number, y: number, pad: number) => boolean,
  fx: FxSystem,
  c: ReturnType<typeof getCache>,
) {
  const pShade = c.p.cloudShade;
  const pBody = c.p.cloudBody;
  const pCrest = c.p.cloudCrest;

  for (const cl of clouds) {
    if (!visible(cl.x, cl.y, cl.r * 2.5)) continue;
    const mesh = getCloudMesh(cl);

    // 1) Bottom volumetric shade layer (cool blue-grey atmospheric tint, offset slightly downwards)
    for (const lobe of mesh.baseLobes) {
      const origX = cl.x + lobe.ox;
      const origY = cl.y + lobe.oy;
      const [dispX, dispY] = fx.getCloudDisplacement(origX, origY, lobe.r);
      canvas.drawCircle(origX + dispX, origY + dispY + lobe.r * 0.12, lobe.r * 1.02, pShade);
    }

    // 2) Main billowy body layer (luminous soft white cumulus mass)
    for (const lobe of mesh.baseLobes) {
      const origX = cl.x + lobe.ox;
      const origY = cl.y + lobe.oy;
      const [dispX, dispY] = fx.getCloudDisplacement(origX, origY, lobe.r);
      canvas.drawCircle(origX + dispX, origY + dispY, lobe.r, pBody);
    }

    // 3) Sunlit crest mounds (pure bright white sun highlights facing top-left)
    for (const lobe of mesh.crestLobes) {
      const origX = cl.x + lobe.ox;
      const origY = cl.y + lobe.oy;
      const [dispX, dispY] = fx.getCloudDisplacement(origX, origY, lobe.r);
      canvas.drawCircle(origX + dispX, origY + dispY, lobe.r, pCrest);
    }
  }
}

function drawFlag(canvas: SkCanvas, x: number, y: number, color: string, time: number, c: ReturnType<typeof getCache>) {
  // Pole
  canvas.drawLine(x, y + 14, x, y - 22, c.p.pole);
  // Waving cloth
  const wave = Math.sin(time * 8) * 3;
  const d = `M ${x} ${y - 22} L ${x + 22} ${y - 16 + wave} L ${x} ${y - 8} Z`;
  const cloth = Skia.Path.MakeFromSVGString(d);
  if (cloth) {
    canvas.drawPath(cloth, fillFor(color));
    canvas.drawPath(cloth, c.p.miniBorder);
  }
}

function drawGroundCraters(
  canvas: SkCanvas,
  craters: GroundCrater[],
  visible: (x: number, y: number, pad: number) => boolean,
  c: ReturnType<typeof getCache>,
  mapId: string
) {
  const isOcean = mapId === 'ocean';
  for (let i = 0; i < craters.length; i++) {
    const cr = craters[i];
    if (!visible(cr.x, cr.y, cr.radius * 2.5)) continue;

    if (isOcean) {
      // Concentric expanding white water foam blast rings & splash wake
      if (cr.age < 3.0) {
        const t = cr.age / 3.0;
        const wAlpha = Math.max(0, (1 - t) * 0.75);
        c.p.groundShockwaveWater.setAlphaf(wAlpha);
        // Outer expanding foaming spray ring
        canvas.drawCircle(cr.x, cr.y, cr.radius * (1 + t * 2.2), c.p.groundShockwaveWater);
        // Inner splash ring
        if (t < 0.6) {
          c.p.groundShockwaveWater.setAlphaf(wAlpha * 0.8);
          canvas.drawCircle(cr.x, cr.y, cr.radius * (0.5 + t * 1.4), c.p.groundShockwaveWater);
        }
      }
    } else {
      // Land maps: scorched earth crater with radiating scorch rays and glowing molten embers
      const alpha = cr.age > 11.0 ? Math.max(0, (14.0 - cr.age) / 3.0) : 1.0;

      // Outer jagged soot & burnt dirt halo
      c.p.craterSoot.setAlphaf(0.68 * alpha);
      canvas.drawCircle(cr.x, cr.y, cr.radius * 1.25, c.p.craterSoot);

      // 6 radiating jagged scorch ray marks
      for (let rIdx = 0; rIdx < 6; rIdx++) {
        const rayAngle = cr.angle + (rIdx / 6) * Math.PI * 2;
        const rayLen = cr.radius * (1.25 + ((rIdx * 7) % 5) * 0.16);
        canvas.drawLine(
          cr.x + Math.cos(rayAngle) * (cr.radius * 0.35),
          cr.y + Math.sin(rayAngle) * (cr.radius * 0.35),
          cr.x + Math.cos(rayAngle) * rayLen,
          cr.y + Math.sin(rayAngle) * rayLen,
          c.p.craterSoot
        );
      }

      // Inner blackened impact depression bowl
      c.p.craterBowl.setAlphaf(0.85 * alpha);
      canvas.drawCircle(cr.x, cr.y, cr.radius * 0.72, c.p.craterBowl);

      // Molten ember crack fractures (cooling down over 3.5s)
      if (cr.age < 3.5) {
        const emberFrac = 1 - cr.age / 3.5;
        c.p.craterEmberGlow.setAlphaf(0.65 * emberFrac * alpha);
        canvas.drawCircle(cr.x, cr.y, cr.radius * 0.45 * emberFrac, c.p.craterEmberGlow);

        c.p.craterEmber.setAlphaf(0.92 * emberFrac * alpha);
        for (let fIdx = 0; fIdx < 3; fIdx++) {
          const fA = cr.angle + (fIdx / 3) * Math.PI * 2 + 0.35;
          const fLen = cr.radius * 0.38 * emberFrac;
          canvas.drawLine(cr.x, cr.y, cr.x + Math.cos(fA) * fLen, cr.y + Math.sin(fA) * fLen, c.p.craterEmber);
        }
      }
    }
  }
}

// ---------- Main draw ----------
export interface Camera {
  x: number;
  y: number;
}

export function drawFrame(canvas: SkCanvas, s: GameSession, fx: FxSystem, cam: Camera, vw: number, vh: number, time: number) {
  const c = getCache();
  const w = s.world;
  const { arenaW, arenaH } = w.config;
  const ex = s.extra();

  const mapDef = MAPS[w.config.map] ?? MAPS.ocean;
  const mp = mapPaints(mapDef.palette, mapDef.id);
  canvas.drawRect(Skia.XYWHRect(0, 0, vw, vh), mp.zone);

  // Zoom out a little so you can see more of the sky around you on a tall phone screen.
  const zoom = vw < vh ? 0.78 : 0.9;
  const wvw = vw / zoom;
  const wvh = vh / zoom;
  canvas.save();
  canvas.scale(zoom, zoom);
  canvas.translate(wvw / 2 - cam.x, wvh / 2 - cam.y);

  // Arena in map sky colour; the area outside is tinted as the danger zone.
  const m = 2000;
  canvas.drawRect(Skia.XYWHRect(-m, -m, arenaW + 2 * m, arenaH + 2 * m), mp.zone);
  canvas.drawRect(Skia.XYWHRect(0, 0, arenaW, arenaH), mp.sky);

  const visible = (x: number, y: number, pad: number) =>
    Math.abs(x - cam.x) < wvw / 2 + pad && Math.abs(y - cam.y) < wvh / 2 + pad;

  // 2D Ground: Patchwork crop fields, dirt roads, and military airstrip runway
  const terrain = getTerrain(w.config.map, arenaW, arenaH);
  drawGroundTerrain(canvas, terrain, visible, mapDef.palette, w.config.map);

  // Persistent scorched ground impact craters and splash waves
  drawGroundCraters(canvas, fx.craters, visible, c, w.config.map);

  // 2D Trees & Forest groves (with soft drop shadows, lush foliage, and sunlit leaf highlights)
  drawTrees(canvas, terrain.trees, visible, w.config.map);

  // Soft atmospheric cloud shadows projected onto the ground terrain
  drawCloudGroundShadows(canvas, w.clouds, visible, fx, c);

  canvas.drawRect(Skia.XYWHRect(0, 0, arenaW, arenaH), mp.border);

  // Rocks / mountains (solid)
  for (const o of w.obstacles) {
    if (!visible(o.x, o.y, o.r + 20)) continue;
    canvas.drawCircle(o.x + 14, o.y + 18, o.r, c.p.shadow);
    canvas.drawCircle(o.x, o.y, o.r, mp.rock);
    canvas.drawCircle(o.x, o.y, o.r, mp.rockEdge);
    canvas.drawCircle(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.45, mp.rockTop);
    canvas.drawCircle(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.18, c.p.cloud);
  }

  // CTF bases and flags
  for (const f of w.flags) {
    const col = COLORS.team[f.team];
    if (visible(f.homeX, f.homeY, 120)) {
      const base = fillFor(col);
      base.setAlphaf(0.18);
      canvas.drawCircle(f.homeX, f.homeY, FLAG_RADIUS + 40, base);
      base.setAlphaf(1);
      const ring = c.p.miniBorder;
      canvas.drawCircle(f.homeX, f.homeY, FLAG_RADIUS + 40, ring);
    }
    if (f.carrier) continue; // drawn on the carrier
    if (!visible(f.x, f.y, 60)) continue;
    drawFlag(canvas, f.x, f.y, col, time, c);
    if (f.droppedAt !== null) {
      const left = Math.max(0, 15 - (w.time - f.droppedAt));
      const txt = String(Math.ceil(left));
      const tw = c.smallFont.measureText(txt).width;
      canvas.drawText(txt, f.x - tw / 2, f.y + 24, c.p.text, c.smallFont);
    }
  }

  // Pickups (Sky Force Golden Star / Medal Collectibles)
  for (const k of w.pickups) {
    if (!visible(k.x, k.y, 40)) continue;
    const pulse = 1 + Math.sin(time * 6 + k.id) * 0.12;
    const r = 18 * pulse;
    canvas.drawCircle(k.x, k.y, r + 4, fillFor(COLORS.pickup[k.kind]));
    canvas.drawCircle(k.x, k.y, r, c.p.starGold);
    canvas.drawCircle(k.x, k.y, r * 0.45, c.p.starCore);
    const letter = PICKUP_LETTER[k.kind];
    const tw = c.font.measureText(letter).width;
    canvas.drawText(letter, k.x - tw / 2, k.y + 5, c.p.textShadow, c.font);
  }

  // Air-Drop Supply Crates
  if (w.crates) {
    for (const cr of w.crates) {
      if (!visible(cr.x, cr.y + cr.descentY, 60)) continue;
      const crateY = cr.y + cr.descentY;

      // Expanding radar beacon ring on ground
      const pulseR = 10 + (cr.beaconPhase / (Math.PI * 2)) * 28;
      c.p.shield.setAlphaf(Math.max(0, 1 - pulseR / 38));
      canvas.drawCircle(cr.x, cr.y, pulseR, c.p.shield);
      c.p.shield.setAlphaf(0.8);

      // Parachute if descending
      if (!cr.landed) {
        const chuteR = 18;
        const chuteY = crateY - 26;
        canvas.drawCircle(cr.x, chuteY, chuteR, c.p.cloud);
        canvas.drawLine(cr.x - chuteR + 3, chuteY + 2, cr.x - 7, crateY - 8, c.p.pole);
        canvas.drawLine(cr.x + chuteR - 3, chuteY + 2, cr.x + 7, crateY - 8, c.p.pole);
      }

      // Military steel crate box
      canvas.drawRect(Skia.XYWHRect(cr.x - 11, crateY - 11, 22, 22), c.p.miniBg);
      canvas.drawRect(Skia.XYWHRect(cr.x - 11, crateY - 11, 22, 22), c.p.miniBorder);

      // Distinct perk colored badge & symbol
      const pColor = cr.perk === 'twin_vulcan' ? '#ff4d4d' : cr.perk === 'energy_shield' ? '#00f5d4' : cr.perk === 'cluster_missile' ? '#ffd23f' : '#c77dff';
      const pBadge = cr.perk === 'twin_vulcan' ? 'V' : cr.perk === 'energy_shield' ? 'S' : cr.perk === 'cluster_missile' ? 'M' : 'O';
      const fillP = fillFor(pColor);
      canvas.drawCircle(cr.x, crateY, 7, fillP);
      const tw = c.smallFont.measureText(pBadge).width;
      canvas.drawText(pBadge, cr.x - tw / 2, crateY + 4, c.p.textShadow, c.smallFont);
    }
  }

  // Build quick owner -> PlaneType lookup for per-flight ordnance visuals
  const ownerTypes: Record<string, PlaneType> = {};
  for (const pl of w.planes) ownerTypes[pl.id] = pl.type;
  const bStyles = getBulletStyles();
  const mStyles = getMissileStyles();

  // Bullets: Per-flight glowing plasma/tracer/railgun ordnance
  for (const b of w.bullets) {
    const bx = b.x + b.vx * ex;
    const by = b.y + b.vy * ex;
    if (!visible(bx, by, 30)) continue;
    const bSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const bDirX = bSpeed > 0 ? b.vx / bSpeed : 0;
    const bDirY = bSpeed > 0 ? b.vy / bSpeed : 0;
    const bs = b.flak ? bStyles.flak : bStyles[ownerTypes[b.owner] ?? 'fighter'];
    const r = bs.radius;

    // Outer expanding glow halo
    canvas.drawCircle(bx, by, r * 1.75, bs.outer);

    // Trailing ionized stream: 4 fading puffs behind the bolt
    for (let ti = 1; ti <= 4; ti++) {
      const tx = bx - bDirX * ti * (bs.tailLen * 0.45);
      const ty = by - bDirY * ti * (bs.tailLen * 0.45);
      bs.trail.setAlphaf(Math.max(0, 0.28 - ti * 0.065));
      canvas.drawCircle(tx, ty, r * (0.92 - ti * 0.16), bs.trail);
    }

    // Mid flame teardrop body
    const tailX = bx - bDirX * bs.tailLen;
    const tailY = by - bDirY * bs.tailLen;
    canvas.drawLine(tailX, tailY, bx + bDirX * 2, by + bDirY * 2, bs.flame);
    canvas.drawCircle(bx, by, r, bs.flame);

    // Inner hot core
    canvas.drawCircle(bx, by, r * 0.68, bs.hot);
    canvas.drawCircle(bx, by, r * 0.44, bs.core);
    // White-hot tip
    canvas.drawCircle(bx + bDirX * 1.5, by + bDirY * 1.5, r * 0.28, bs.white);
  }

  // Missiles: Per-flight tactical guided ordnance with sleek airframe, canards, fins & thruster cone
  for (const mi of w.missiles) {
    const mx = mi.x + Math.cos(mi.angle) * mi.speed * ex;
    const my = mi.y + Math.sin(mi.angle) * mi.speed * ex;
    if (!visible(mx, my, 45)) continue;
    const ms = mStyles[ownerTypes[mi.owner] ?? 'fighter'];
    const cosA = Math.cos(mi.angle);
    const sinA = Math.sin(mi.angle);

    // Missile drop shadow cast onto ground: converges onto missile as flight altitude drops
    const alt = Math.max(0, Math.min(1, mi.life / 0.85));
    const shadowX = mx + 18 * alt;
    const shadowY = my + 22 * alt;
    c.p.missileShadow.setAlphaf(0.28 * alt);
    canvas.save();
    canvas.translate(shadowX, shadowY);
    canvas.rotate((mi.angle * 180) / Math.PI, 0, 0);
    canvas.scale(ms.scale, ms.scale);
    canvas.drawPath(c.missileBody, c.p.missileShadow);
    canvas.restore();

    // Billowing expanding smoke trail with slight turbulence
    for (let i = 1; i <= 7; i++) {
      const puffX = mx - cosA * (11 + i * 10.5);
      const puffY = my - sinA * (11 + i * 10.5);
      c.p.trail.setAlphaf(Math.max(0, 0.52 - i * 0.068));
      canvas.drawCircle(puffX, puffY, (2.6 + i * 0.95) * ms.scale, c.p.trail);
    }
    c.p.trail.setAlphaf(0.35);

    // Sleek missile airframe, fins, warhead nose, and flickering rocket exhaust cone
    canvas.save();
    canvas.translate(mx, my);
    canvas.rotate((mi.angle * 180) / Math.PI, 0, 0);
    canvas.scale(ms.scale, ms.scale);

    // Flickering rocket motor exhaust cone
    const mFlicker = 0.85 + Math.sin(time * 50 + mi.id) * 0.2;
    const coneLen = 13 * mFlicker;
    canvas.drawOval(Skia.XYWHRect(-9 - coneLen, -3.2, coneLen + 1, 6.4), ms.flameOuter);
    canvas.drawOval(Skia.XYWHRect(-9 - coneLen * 0.55, -1.7, coneLen * 0.6, 3.4), ms.flameInner);

    // Dark outline / fuselage / fins / pointed warhead nose
    canvas.drawPath(c.missileFins, ms.fins);
    canvas.drawPath(c.missileBody, ms.body);
    canvas.drawPath(c.missileNose, ms.nose);

    // Active seeker lock pulse on nose tip when tracking a target
    if (mi.target && Math.sin(time * 22 + mi.id) > 0) {
      canvas.drawCircle(13.5, 0, 1.6, ms.flameInner);
    }
    canvas.restore();
  }

  // Planes: shadows first so they never cover another plane.
  const ART_SCALE = 1.25; // artwork is drawn a bit larger than the hit radius
  const topKills = Math.max(0, ...w.planes.map((p) => p.kills));
  const aceId = topKills >= 2 ? w.planes.find((p) => p.kills === topKills && w.planes.filter((q) => q.kills === topKills).length === 1)?.id : null;

  for (const p of w.planes) {
    if (!p.alive) continue;
    const pose = s.pose(p);
    if (!visible(pose.x, pose.y, 80)) continue;
    drawPlaneShadow(canvas, p.type, pose.x, pose.y, pose.angle, PLANES[p.type].radius * ART_SCALE, p.bank ?? 0);
  }

  for (const p of w.planes) {
    if (!p.alive) continue;
    const pose = s.pose(p);
    if (!visible(pose.x, pose.y, 80)) continue;
    const st = PLANES[p.type];
    const protectedBlink = w.time < p.spawnProtectUntil && Math.floor(time * 10) % 2 === 0;
    if (p.id === s.myId) {
      c.p.trail.setAlphaf(0.18);
      canvas.drawCircle(pose.x, pose.y, st.radius * 1.9, c.p.trail);
      c.p.trail.setAlphaf(0.35);

      // Visual Flight Path Guide & Aim Chevron
      const myInput = s.getInput ? s.getInput() : null;
      if (myInput && myInput.aim !== null && Number.isFinite(myInput.aim)) {
        const aimAngle = myInput.aim;
        const noseDist = st.radius + 6;
        const chevronDist = noseDist + 78;
        const targetX = pose.x + Math.cos(aimAngle) * chevronDist;
        const targetY = pose.y + Math.sin(aimAngle) * chevronDist;

        // Glowing trajectory line forward to target heading
        const midX = pose.x + Math.cos(aimAngle) * (noseDist + 40);
        const midY = pose.y + Math.sin(aimAngle) * (noseDist + 40);
        canvas.drawLine(pose.x + Math.cos(aimAngle) * noseDist, pose.y + Math.sin(aimAngle) * noseDist, midX, midY, c.p.aimLine);

        // Holographic chevron pointing along commanded heading
        canvas.save();
        canvas.translate(targetX, targetY);
        canvas.rotate((aimAngle * 180) / Math.PI, 0, 0);

        // Soft glow halo
        canvas.drawCircle(0, 0, 14, c.p.aimGlow);

        // Twin aerodynamic chevrons
        canvas.drawLine(-8, -9, 4, 0, c.p.aimChevron);
        canvas.drawLine(-8, 9, 4, 0, c.p.aimChevron);
        canvas.drawLine(-14, -7, -3, 0, c.p.aimLine);
        canvas.drawLine(-14, 7, -3, 0, c.p.aimLine);

        canvas.restore();
      }

      // Auto-Fire / Lead Targeting Reticle for local player
      const autoTarget = findAutoFireTarget(w, p);
      if (autoTarget) {
        const tgt = autoTarget.target;
        const tPose = s.pose(tgt);
        const rad = PLANES[tgt.type].radius + 8;
        const inSights = autoTarget.inSights;

        // Color: Fiery Red when in sights & firing, Cyan when tracking
        const reticlePaint = inSights ? c.p.lock : c.p.aimLine;
        const pulse = 1 + Math.sin(time * 16) * 0.08;

        // 4 corner targeting brackets around enemy
        const bLen = 8;
        const r = rad * pulse;
        // Top-Left
        canvas.drawLine(tPose.x - r, tPose.y - r + bLen, tPose.x - r, tPose.y - r, reticlePaint);
        canvas.drawLine(tPose.x - r, tPose.y - r, tPose.x - r + bLen, tPose.y - r, reticlePaint);
        // Top-Right
        canvas.drawLine(tPose.x + r, tPose.y - r + bLen, tPose.x + r, tPose.y - r, reticlePaint);
        canvas.drawLine(tPose.x + r, tPose.y - r, tPose.x + r - bLen, tPose.y - r, reticlePaint);
        // Bottom-Left
        canvas.drawLine(tPose.x - r, tPose.y + r - bLen, tPose.x - r, tPose.y + r, reticlePaint);
        canvas.drawLine(tPose.x - r, tPose.y + r, tPose.x - r + bLen, tPose.y + r, reticlePaint);
        // Bottom-Right
        canvas.drawLine(tPose.x + r, tPose.y + r - bLen, tPose.x + r, tPose.y + r, reticlePaint);
        canvas.drawLine(tPose.x + r, tPose.y + r, tPose.x + r - bLen, tPose.y + r, reticlePaint);

        // Lead intercept pip
        canvas.drawCircle(autoTarget.leadX, autoTarget.leadY, inSights ? 4.5 : 3, reticlePaint);
        if (inSights) {
          canvas.drawCircle(autoTarget.leadX, autoTarget.leadY, 7, c.p.aimGlow);
        }
      }

      // Dedicated Missile Lock Reticle
      const mLockTargetId = findLockTarget(w, p);
      if (mLockTargetId) {
        const mTarget = w.planes.find((pl) => pl.id === mLockTargetId);
        if (mTarget && mTarget.alive) {
          const mtPose = s.pose(mTarget);
          const mRad = (PLANES[mTarget.type].radius + 14) * (1 + Math.sin(time * 18) * 0.08);
          // Pulsing lock diamond [ ⟐ ]
          canvas.save();
          canvas.translate(mtPose.x, mtPose.y);
          // Diamond reticle lines
          canvas.drawLine(0, -mRad, mRad, 0, c.p.lock);
          canvas.drawLine(mRad, 0, 0, mRad, c.p.lock);
          canvas.drawLine(0, mRad, -mRad, 0, c.p.lock);
          canvas.drawLine(-mRad, 0, 0, -mRad, c.p.lock);
          // Inner crosshairs
          canvas.drawLine(-mRad * 0.45, 0, mRad * 0.45, 0, c.p.lock);
          canvas.drawLine(0, -mRad * 0.45, 0, mRad * 0.45, c.p.lock);
          canvas.restore();
          // Text label
          canvas.drawText('LOCK', mtPose.x - 14, mtPose.y + mRad + 14, c.p.lock, c.smallFont);
        }
      }

      // Incoming Missile Alert on player
      const incomingMissile = w.missiles.find((m) => m.target === p.id);
      if (incomingMissile) {
        const blink = Math.sin(time * 24) > 0;
        if (blink) {
          canvas.drawText('! MISSILE ALERT !', pose.x - 44, pose.y - st.radius - 24, c.p.hpLow, c.smallFont);
        }
      }
    }
    if (!protectedBlink) {
      const thr = Math.max(0, Math.min(1, (p.speed - st.minSpeed) / (st.maxSpeed - st.minSpeed)));
      const isHit = w.time < (p.hitFlashUntil ?? 0);
      drawPlane(canvas, p.type, pose.x, pose.y, pose.angle, st.radius * ART_SCALE, planeColor(w, p, s.myId), thr, time, p.bank ?? 0, isHit);
    }
    // Low-HP distress smoke & engine fire trails
    const bw = 40;
    const frac = Math.max(0, p.hp / st.hp);
    if (frac < 0.5) {
      const behindX = pose.x - Math.cos(pose.angle) * st.radius;
      const behindY = pose.y - Math.sin(pose.angle) * st.radius;
      const smokeP = Math.sin(time * 14 + p.x) * 4;
      c.p.fxSmoke.setAlphaf(0.5);
      canvas.drawCircle(behindX + smokeP, behindY, 8 + (1 - frac) * 12, c.p.fxSmoke);
      if (frac < 0.25) {
        const fireP = Math.cos(time * 30 + p.y) * 3;
        c.p.fx.setAlphaf(0.85);
        canvas.drawCircle(behindX + fireP, behindY, 6, c.p.fx);
        c.p.spark.setAlphaf(0.9);
        canvas.drawCircle(behindX - fireP, behindY, 3, c.p.spark);
      }
    }
    if (p.inCloud) {
      c.p.cloud.setAlphaf(0.38);
      canvas.drawCircle(pose.x, pose.y, st.radius * 1.8, c.p.cloud);
    }
    if (w.time < p.shieldUntil) {
      if (p.type === 'stealth') {
        const cloakPaint = fillFor('#c084fc');
        cloakPaint.setAlphaf(0.35 + Math.sin(time * 12) * 0.15);
        canvas.drawCircle(pose.x, pose.y, st.radius + 12, cloakPaint);
        cloakPaint.setAlphaf(1);
      } else {
        canvas.drawCircle(pose.x, pose.y, st.radius + 10, c.p.shield);
      }
    }
    if (p.perk?.kind === 'overdrive' && w.time < p.perk.until) {
      const odPulse = 1 + Math.sin(time * 25) * 0.12;
      const odPaint = fillFor('#10b981');
      odPaint.setAlphaf(0.32);
      canvas.drawCircle(pose.x, pose.y, (st.radius + 10) * odPulse, odPaint);
      odPaint.setAlphaf(1);
    }
    if (w.time < p.dashUntil) {
      for (let i = 1; i <= 5; i++) {
        c.p.trail.setAlphaf(0.35 - i * 0.05);
        canvas.drawCircle(pose.x - Math.cos(pose.angle) * i * 14, pose.y - Math.sin(pose.angle) * i * 14, st.radius * (1 - i * 0.12), c.p.trail);
      }
      c.p.trail.setAlphaf(0.35);
    }
    const carried = w.flags.find((f) => f.carrier === p.id);
    if (carried) drawFlag(canvas, pose.x - Math.cos(pose.angle) * st.radius, pose.y - Math.sin(pose.angle) * st.radius, COLORS.team[carried.team], time, c);
    // HP bar + name
    canvas.drawRect(Skia.XYWHRect(pose.x - bw / 2, pose.y - st.radius - 14, bw, 5), c.p.hpBg);
    canvas.drawRect(Skia.XYWHRect(pose.x - bw / 2, pose.y - st.radius - 14, bw * frac, 5), frac < 0.35 ? c.p.hpLow : c.p.hpFg);
    if (aceId && p.id === aceId) {
      const crownBob = Math.sin(time * 5) * 3;
      const crownY = pose.y - st.radius - 28 + crownBob;
      const crownTxt = 'ACE';
      const tw = c.smallFont.measureText(crownTxt).width;
      c.p.spark.setAlphaf(0.95);
      canvas.drawText(crownTxt, pose.x - tw / 2, crownY, c.p.spark, c.smallFont);
    }
    if (p.id !== s.myId) {
      const tw = c.smallFont.measureText(p.name).width;
      canvas.drawText(p.name, pose.x - tw / 2 + 1, pose.y - st.radius - 19, c.p.textShadow, c.smallFont);
      canvas.drawText(p.name, pose.x - tw / 2, pose.y - st.radius - 20, c.p.text, c.smallFont);
    }
  }

  // Volumetric Sky Force clouds with dynamic aerodynamic wake parting
  drawVolumetricClouds(canvas, w.clouds, visible, fx, c);

  // Effects
  for (const f of fx.list) {
    const t = f.age / f.life;
    if (f.kind === 'cloudVapor') {
      const alpha = Math.max(0, (1 - t) * 0.22);
      c.p.cloudVapor.setAlphaf(alpha);
      const rad = (f.radius ?? 1.8) * (1 + t * 0.4);
      canvas.drawCircle(f.x, f.y, rad, c.p.cloudVapor);
    } else if (f.kind === 'cloudTrail') {
      const alpha = Math.max(0, (1 - t * t) * 0.65);
      c.p.cloudBody.setAlphaf(alpha);
      const rad = (f.radius ?? 9) * (1 + t * 2.1);
      canvas.drawCircle(f.x, f.y, rad, c.p.cloudBody);
    } else if (f.kind === 'cloudMist') {
      const alpha = Math.max(0, (1 - t) * 0.7);
      c.p.cloudMist.setAlphaf(alpha);
      const rad = (f.radius ?? 12) * (1 + t * 2.3);
      canvas.drawCircle(f.x, f.y, rad, c.p.cloudMist);
    } else if (f.kind === 'flare') {
      // Bright decoy flares scattering behind the plane.
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + 0.3;
        const r = 20 + t * 90;
        c.p.spark.setAlphaf(1 - t);
        canvas.drawCircle(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 5, c.p.spark);
      }
    } else if (f.kind === 'flak') {
      c.p.shield.setAlphaf(1 - t);
      canvas.drawCircle(f.x, f.y, 20 + t * 300, c.p.shield);
      c.p.shield.setAlphaf(0.8);
    } else if (f.kind === 'dash') {
      c.p.trail.setAlphaf((1 - t) * 0.6);
      canvas.drawCircle(f.x, f.y, 15 + t * 40, c.p.trail);
      c.p.trail.setAlphaf(0.35);
    } else if (f.kind === 'cloak') {
      const alpha = Math.max(0, (1 - t) * 0.85);
      const cloakPaint = fillFor('#c084fc');
      cloakPaint.setAlphaf(alpha);
      canvas.drawCircle(f.x, f.y, 16 + t * 90, cloakPaint);
      c.p.spark.setAlphaf(alpha);
      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2) + t * 4;
        const rad = 20 + t * 70;
        canvas.drawCircle(f.x + Math.cos(a) * rad, f.y + Math.sin(a) * rad, 3.5, c.p.spark);
      }
      cloakPaint.setAlphaf(1);
    } else if (f.kind === 'overdrive') {
      const alpha = Math.max(0, (1 - t) * 0.85);
      const odPaint = fillFor('#10b981');
      odPaint.setAlphaf(alpha);
      canvas.drawCircle(f.x, f.y, 16 + t * 80, odPaint);
      c.p.fx.setAlphaf(alpha);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 3;
        const rad = 14 + t * 55;
        canvas.drawCircle(f.x + Math.cos(a) * rad, f.y + Math.sin(a) * rad, 4, c.p.fx);
      }
      odPaint.setAlphaf(1);
    } else if (f.kind === 'groundShockwave') {
      const isOcean = w.config.map === 'ocean';
      const swPaint = isOcean ? c.p.groundShockwaveWater : c.p.groundShockwave;
      const alpha = Math.max(0, (1 - t) * 0.85);
      swPaint.setAlphaf(alpha);
      const rad = 10 + t * (f.radius ?? 110);
      canvas.drawCircle(f.x, f.y, rad, swPaint);
    } else if (f.kind === 'groundFireball') {
      const rad = (f.radius ?? 24) * (0.6 + t * 0.8);
      // Outer crimson flame
      c.p.groundFireOuter.setAlphaf(Math.max(0, (1 - t * t) * 0.9));
      canvas.drawCircle(f.x, f.y, rad, c.p.groundFireOuter);
      // Mid solar gold
      c.p.groundFireMid.setAlphaf(Math.max(0, (1 - t) * 0.95));
      canvas.drawCircle(f.x, f.y, rad * 0.65, c.p.groundFireMid);
      // White-hot core
      if (t < 0.6) {
        c.p.groundFireCore.setAlphaf(Math.max(0, (1 - t / 0.6) * 0.98));
        canvas.drawCircle(f.x, f.y, rad * 0.35, c.p.groundFireCore);
      }
    } else if (f.kind === 'groundSmoke') {
      const alpha = Math.max(0, (1 - t) * 0.72);
      c.p.groundSmoke.setAlphaf(alpha);
      const rad = (f.radius ?? 14) * (1 + t * 1.4);
      canvas.drawCircle(f.x, f.y, rad, c.p.groundSmoke);
    } else if (f.kind === 'shockwave') {
      const alpha = Math.max(0, (1 - t) * 0.7);
      c.p.shield.setAlphaf(alpha);
      const rad = 14 + t * (f.radius ?? 100);
      canvas.drawCircle(f.x, f.y, rad, c.p.shield);
      c.p.shield.setAlphaf(0.8);
    } else if (f.kind === 'shrapnel') {
      const alpha = Math.max(0, 1 - t * 0.8);
      const len = f.radius ?? 6;
      const shrapPaint = fillFor(f.color ?? '#333333');
      shrapPaint.setAlphaf(alpha);
      canvas.save();
      canvas.translate(f.x, f.y);
      canvas.rotate(((f.angle ?? 0) * 180) / Math.PI, 0, 0);
      canvas.drawRect(Skia.XYWHRect(-len, -len / 3, len * 2, len * 0.7), shrapPaint);
      // Fiery glowing tip
      c.p.spark.setAlphaf(alpha * 0.9);
      canvas.drawCircle(len * 0.7, 0, len * 0.45, c.p.spark);
      canvas.restore();
    } else if (f.kind === 'spark') {
      const alpha = Math.max(0, 1 - t);
      c.p.spark.setAlphaf(alpha);
      c.p.sparkStreak.setAlphaf(alpha * 0.85);
      const tailX = f.x - (f.vx ?? 0) * 0.024;
      const tailY = f.y - (f.vy ?? 0) * 0.024;
      canvas.drawLine(tailX, tailY, f.x, f.y, c.p.sparkStreak);
      canvas.drawCircle(f.x, f.y, 2.8 * (1 - t * 0.5), c.p.spark);
    } else if (f.kind === 'smokePuff') {
      const alpha = Math.max(0, (1 - t) * 0.45);
      c.p.fxSmoke.setAlphaf(alpha);
      const rad = (f.radius ?? 10) * (1 + t * 1.6);
      canvas.drawCircle(f.x, f.y, rad, c.p.fxSmoke);
    } else if (f.kind === 'fireEmber') {
      const alpha = Math.max(0, 1 - t);
      c.p.fx.setAlphaf(alpha * 0.85);
      canvas.drawCircle(f.x, f.y, (f.radius ?? 5) * (1 - t * 0.35), c.p.fx);
      c.p.spark.setAlphaf(alpha);
      canvas.drawCircle(f.x, f.y, (f.radius ?? 5) * 0.35, c.p.spark);
    } else if (f.kind === 'dmgText' && f.text) {
      const alpha = Math.max(0, 1 - (t * t));
      const font = c.smallFont;
      const tw = font.measureText(f.text).width;
      const pText = fillFor(f.color ?? '#ffffff');
      pText.setAlphaf(alpha);
      c.p.textShadow.setAlphaf(alpha * 0.7);
      canvas.drawText(f.text, f.x - tw / 2 + 1, f.y + 1, c.p.textShadow, font);
      canvas.drawText(f.text, f.x - tw / 2, f.y, pText, font);
    } else {
      // Sky Force Reloaded cinematic fireball explosion
      const big = f.kind === 'boom' ? 1 : 0.55;
      const baseR = 28 * big;

      // Phase 0-0.15: Initial white-hot flash
      if (t < 0.15) {
        const flashT = t / 0.15;
        c.p.boomFlash.setAlphaf((1 - flashT) * 0.7);
        canvas.drawCircle(f.x, f.y, baseR * (1.8 + flashT * 1.2) * big, c.p.boomFlash);
      }

      // Heat distortion bloom (wide red-tinted area, fades slowly)
      c.p.boomHeatDistort.setAlphaf(Math.max(0, (1 - t * 0.7) * 0.22));
      canvas.drawCircle(f.x, f.y, (baseR * 3.5 + t * 60) * big, c.p.boomHeatDistort);

      // Outer smoke ring expanding (dark soot halo)
      c.p.boomSmokeRing.setAlphaf(Math.max(0, (1 - t) * 0.5));
      canvas.drawCircle(f.x, f.y, (baseR * 1.6 + t * 55) * big, c.p.boomSmokeRing);

      // Multi-lobed fire mass: 5 overlapping fireballs for organic shape
      const lobeAlpha = Math.max(0, (1 - t * t) * 0.92);
      const fireR = baseR * (0.9 + t * 0.5);
      for (let li = 0; li < 5; li++) {
        const lobeAngle = (li / 5) * Math.PI * 2 + f.x * 0.1;
        const lobeDist = fireR * 0.35 * (1 - t * 0.3);
        const lx = f.x + Math.cos(lobeAngle) * lobeDist;
        const ly = f.y + Math.sin(lobeAngle) * lobeDist;
        const lr = fireR * (0.7 + (li % 3) * 0.1);

        // Dark red outer flame
        c.p.boomFireOuter.setAlphaf(lobeAlpha * 0.85);
        canvas.drawCircle(lx, ly, lr, c.p.boomFireOuter);
        // Orange mid flame
        c.p.boomFireMid.setAlphaf(lobeAlpha * 0.9);
        canvas.drawCircle(lx, ly, lr * 0.72, c.p.boomFireMid);
        // Yellow inner flame
        c.p.boomFireInner.setAlphaf(lobeAlpha * 0.85);
        canvas.drawCircle(lx, ly, lr * 0.45, c.p.boomFireInner);
      }

      // Central white-hot plasma core
      if (t < 0.6) {
        const coreAlpha = Math.max(0, (1 - t / 0.6) * 0.98);
        c.p.boomFireCore.setAlphaf(coreAlpha * 0.9);
        canvas.drawCircle(f.x, f.y, fireR * 0.55, c.p.boomFireCore);
        c.p.boomCoreWhite.setAlphaf(coreAlpha * 0.85);
        canvas.drawCircle(f.x, f.y, fireR * 0.28, c.p.boomCoreWhite);
      }

      // Flying ember sparks radiating outward
      if (t < 0.7) {
        const emberAlpha = Math.max(0, (1 - t / 0.7) * 0.85);
        c.p.boomEmber.setAlphaf(emberAlpha);
        for (let ei = 0; ei < 8; ei++) {
          const eAngle = (ei / 8) * Math.PI * 2 + f.y * 0.05;
          const eDist = (baseR * 0.8 + t * 85) * big;
          const ex2 = f.x + Math.cos(eAngle) * eDist;
          const ey2 = f.y + Math.sin(eAngle) * eDist;
          canvas.drawCircle(ex2, ey2, 2.5 * (1 - t), c.p.boomEmber);
        }
      }

      // Residual dark smoke (lingers longer than fire)
      if (t > 0.3) {
        const smokeAlpha = Math.max(0, (1 - t) * 0.4);
        c.p.fxSmoke.setAlphaf(smokeAlpha);
        canvas.drawCircle(f.x, f.y, (baseR * 1.2 + t * 30) * big, c.p.fxSmoke);
      }
    }
  }

  canvas.restore();

  // ---------- Screen-space overlays ----------
  // Off-screen enemy arrows (clouds hide radar signature)
  const me = w.planes.find((p) => p.id === s.myId);
  for (const p of w.planes) {
    if (p.id === s.myId || !p.alive || p.inCloud) continue;
    if (isTeamMode(w.config.mode) && me && p.team === me.team) continue;
    const pose = s.pose(p);
    const dx = (pose.x - cam.x) * zoom;
    const dy = (pose.y - cam.y) * zoom;
    if (Math.abs(dx) < vw / 2 && Math.abs(dy) < vh / 2) continue;
    const a = Math.atan2(dy, dx);
    const scale = Math.min((vw / 2 - 30) / Math.abs(Math.cos(a) || 1e-6), (vh / 2 - 30) / Math.abs(Math.sin(a) || 1e-6));
    const ax = vw / 2 + Math.cos(a) * scale;
    const ay = vh / 2 + Math.sin(a) * scale;
    canvas.save();
    canvas.translate(ax, ay);
    canvas.rotate((a * 180) / Math.PI, 0, 0);
    canvas.drawPath(c.arrow, fillFor(planeColor(w, p, s.myId)));
    canvas.restore();
  }

  // Minimap (top-right)
  const mmW = vw < vh ? 112 : 150;
  const mmH = (mmW * arenaH) / arenaW;
  const mmX = vw - mmW - 12;
  const mmY = 12;
  canvas.drawRect(Skia.XYWHRect(mmX, mmY, mmW, mmH), c.p.miniBg);
  canvas.drawRect(Skia.XYWHRect(mmX, mmY, mmW, mmH), c.p.miniBorder);
  const sx = mmW / arenaW;
  const sy = mmH / arenaH;
  for (const o of w.obstacles) canvas.drawCircle(mmX + o.x * sx, mmY + o.y * sy, Math.max(2, o.r * sx), mp.rock);
  for (const k of w.pickups) canvas.drawCircle(mmX + k.x * sx, mmY + k.y * sy, 2.5, fillFor(COLORS.pickup[k.kind]));
  if (w.crates) {
    for (const cr of w.crates) canvas.drawCircle(mmX + cr.x * sx, mmY + cr.y * sy, 3, c.p.shield);
  }
  for (const f of w.flags) {
    const fx2 = mmX + f.x * sx;
    const fy2 = mmY + f.y * sy;
    canvas.drawRect(Skia.XYWHRect(fx2 - 3, fy2 - 3, 6, 6), fillFor(COLORS.team[f.team]));
    canvas.drawRect(Skia.XYWHRect(fx2 - 3, fy2 - 3, 6, 6), c.p.miniBorder);
  }

  for (const p of w.planes) {
    if (!p.alive) continue;
    if (p.inCloud && p.id !== s.myId && (!me || p.team !== me.team)) continue;
    const pose = s.pose(p);
    if (aceId && p.id === aceId) {
      canvas.drawCircle(mmX + pose.x * sx, mmY + pose.y * sy, 6.5, c.p.spark);
    }
    canvas.drawCircle(mmX + pose.x * sx, mmY + pose.y * sy, p.id === s.myId ? 4.5 : 3.5, fillFor(planeColor(w, p, s.myId)));
  }

  // Sky Force Low-Health Red Alert Vignette on screen border
  if (me && me.alive && me.hp < PLANES[me.type].hp * 0.35) {
    const pulse = 0.25 + Math.sin(time * 12) * 0.18;
    c.p.alertVignette.setAlphaf(pulse);
    canvas.drawRect(Skia.XYWHRect(4, 4, vw - 8, vh - 8), c.p.alertVignette);
  }

  // Sky Force Tactical Corner Brackets
  canvas.drawLine(14, 14, 38, 14, c.p.techBracket);
  canvas.drawLine(14, 14, 14, 38, c.p.techBracket);
  canvas.drawLine(14, vh - 14, 38, vh - 14, c.p.techBracket);
  canvas.drawLine(14, vh - 14, 14, vh - 38, c.p.techBracket);
}
