import { matchFont, PaintStyle, Skia, SkCanvas, SkFont, SkPaint, SkPath, StrokeCap } from '@shopify/react-native-skia';
import { PLANES } from '../sim/planes';
import { GameEvent, isTeamMode, PickupKind, Plane, PlaneType, World } from '../sim/types';
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
  };
  return polyPath(pts[type]);
}

let cache: {
  paths: Record<PlaneType, SkPath>;
  arrow: SkPath;
  fill: Record<string, SkPaint>;
  outline: SkPaint;
  font: SkFont;
  smallFont: SkFont;
  p: Record<string, SkPaint>;
} | null = null;

function getCache() {
  if (cache) return cache;
  const font = matchFont({ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold' });
  const smallFont = matchFont({ fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold' });
  cache = {
    paths: { interceptor: planePath('interceptor'), fighter: planePath('fighter'), bomber: planePath('bomber') },
    arrow: polyPath([[12, 0], [-8, 8], [-8, -8]]),
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
  kind: 'boom' | 'smallboom' | 'spark' | 'flare' | 'flak' | 'dash' | 'dmgText' | 'smokePuff' | 'fireEmber' | 'shockwave' | 'shrapnel';
  vx?: number;
  vy?: number;
  text?: string;
  color?: string;
  radius?: number;
  angle?: number;
  vAngle?: number;
}

export class FxSystem {
  list: Fx[] = [];
  private smokeTimer = 0;

  push(events: GameEvent[]) {
    for (const e of events) {
      if (e.t === 'explode') {
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
        this.list.push({ x: e.x, y: e.y, age: 0, life: e.kind === 'flare' ? 1.0 : 0.4, kind: e.kind });
      }
    }
    if (this.list.length > 220) this.list.splice(0, this.list.length - 220);
  }

  update(dt: number, planes?: Plane[]) {
    for (const f of this.list) {
      f.age += dt;
      if (f.vx) f.x += f.vx * dt;
      if (f.vy) f.y += f.vy * dt;
      if (f.vAngle) f.angle = (f.angle ?? 0) + f.vAngle * dt;
      if (f.kind === 'shrapnel') {
        f.vx = (f.vx ?? 0) * 0.97;
        f.vy = (f.vy ?? 0) * 0.97;
      }
    }
    this.list = this.list.filter((f) => f.age < f.life);

    // Persistent lingering smoke & fire trails left behind by damaged aircraft
    if (planes) {
      this.smokeTimer += dt;
      if (this.smokeTimer >= 0.05) {
        this.smokeTimer = 0;
        for (const p of planes) {
          if (!p.alive) continue;
          const st = PLANES[p.type];
          const frac = p.hp / st.hp;
          if (frac < 0.5) {
            const behindX = p.x - Math.cos(p.angle) * st.radius;
            const behindY = p.y - Math.sin(p.angle) * st.radius;
            // Lingering billowing smoke puff
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

            // Critical HP fire ember trail
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
        }
      }
    }
    if (this.list.length > 220) this.list.splice(0, this.list.length - 220);
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

  // 2D Trees & Forest groves (with soft drop shadows, lush foliage, and sunlit leaf highlights)
  drawTrees(canvas, terrain.trees, visible, w.config.map);

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

  // Bullets: Sky Force glowing high-energy plasma bolts
  for (const b of w.bullets) {
    const bx = b.x + b.vx * ex;
    const by = b.y + b.vy * ex;
    if (!visible(bx, by, 20)) continue;
    canvas.drawLine(bx, by, bx - b.vx * 0.022, by - b.vy * 0.022, c.p.bulletGlow);
    canvas.drawLine(bx, by, bx - b.vx * 0.016, by - b.vy * 0.016, c.p.bulletCore);
  }

  // Missiles
  for (const mi of w.missiles) {
    const mx = mi.x + Math.cos(mi.angle) * mi.speed * ex;
    const my = mi.y + Math.sin(mi.angle) * mi.speed * ex;
    if (!visible(mx, my, 40)) continue;

    // Billowing expanding smoke trail
    for (let i = 1; i <= 6; i++) {
      const puffX = mx - Math.cos(mi.angle) * i * 11;
      const puffY = my - Math.sin(mi.angle) * i * 11;
      c.p.trail.setAlphaf(Math.max(0, 0.48 - i * 0.07));
      canvas.drawCircle(puffX, puffY, 3 + i * 0.9, c.p.trail);
    }
    c.p.trail.setAlphaf(0.35);

    // Rocket motor exhaust plume
    const tailX = mx - Math.cos(mi.angle) * 8;
    const tailY = my - Math.sin(mi.angle) * 8;
    c.p.fx.setAlphaf(0.85);
    canvas.drawCircle(tailX, tailY, 4, c.p.fx);
    c.p.spark.setAlphaf(0.95);
    canvas.drawCircle(tailX, tailY, 2, c.p.spark);

    // Missile body with fins and nose cone
    canvas.save();
    canvas.translate(mx, my);
    canvas.rotate((mi.angle * 180) / Math.PI, 0, 0);
    // Main fuselage
    canvas.drawRect(Skia.XYWHRect(-8, -2.5, 16, 5), c.p.missile);
    // Nose cone
    canvas.drawCircle(8, 0, 2.5, c.p.missile);
    // Rear steering fins
    canvas.drawLine(-7, -4.5, -3, -2.5, c.p.bullet);
    canvas.drawLine(-7, 4.5, -3, 2.5, c.p.bullet);
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
          canvas.drawText('LOCK 🎯', mtPose.x - 24, mtPose.y + mRad + 14, c.p.lock, c.smallFont);
        }
      }

      // Incoming Missile Alert on player
      const incomingMissile = w.missiles.find((m) => m.target === p.id);
      if (incomingMissile) {
        const blink = Math.sin(time * 24) > 0;
        if (blink) {
          canvas.drawText('⚠️ MISSILE ALERT', pose.x - 48, pose.y - st.radius - 24, c.p.hpLow, c.smallFont);
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
    if (w.time < p.shieldUntil) canvas.drawCircle(pose.x, pose.y, st.radius + 10, c.p.shield);
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
      const crownTxt = '👑 ACE';
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

  // Clouds above planes (partially transparent)
  for (const cl of w.clouds) {
    if (!visible(cl.x, cl.y, cl.r * 2)) continue;
    canvas.drawCircle(cl.x, cl.y, cl.r, mp.cloud);
    canvas.drawCircle(cl.x + cl.r * 0.7, cl.y + cl.r * 0.2, cl.r * 0.7, mp.cloud);
    canvas.drawCircle(cl.x - cl.r * 0.6, cl.y + cl.r * 0.25, cl.r * 0.6, mp.cloud);
  }

  // Effects
  for (const f of fx.list) {
    const t = f.age / f.life;
    if (f.kind === 'flare') {
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
      const big = f.kind === 'boom' ? 1 : 0.5;
      c.p.fxSmoke.setAlphaf((1 - t) * 0.5);
      canvas.drawCircle(f.x, f.y, (20 + t * 50) * big, c.p.fxSmoke);
      c.p.fx.setAlphaf(1 - t);
      canvas.drawCircle(f.x, f.y, (12 + t * 34) * big, c.p.fx);
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
