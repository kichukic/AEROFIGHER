import { matchFont, PaintStyle, Skia, SkCanvas, SkFont, SkPaint, SkPath, StrokeCap } from '@shopify/react-native-skia';
import { PLANES } from '../sim/planes';
import { GameEvent, isTeamMode, PickupKind, Plane, PlaneType, World } from '../sim/types';
import { MAPS, MapPalette } from '../sim/maps';
import { FLAG_RADIUS } from '../sim/world';
import { GameSession } from './session';
import { drawPlane, drawPlaneShadow } from './planeArt';

// ---------- Palette (placeholder art; swap when reference art arrives) ----------
export const COLORS = {
  sky: '#5aa9e6',
  skyDark: '#3d8bd0',
  grid: 'rgba(255,255,255,0.08)',
  cloud: 'rgba(255,255,255,0.55)',
  zone: 'rgba(200,30,30,0.28)',
  border: 'rgba(255,60,60,0.9)',
  me: '#ffd23f',
  team: ['#2f6bff', '#ff3b3b'],
  ffa: ['#ff3b3b', '#9b5de5', '#00bb77', '#f15bb5', '#fe7f2d', '#00b4d8', '#6a4c93', '#e63946'],
  bullet: '#fff6a0',
  missile: '#ffffff',
  pickup: { repair: '#3ddc84', shield: '#4cc9f0', missiles: '#ff9f1c', boost: '#f72585' } as Record<PickupKind, string>,
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
      missile: paint(COLORS.missile),
      trail: paint('#ffffff', 0, 0.35),
      shield: paint('#4cc9f0', 3, 0.8),
      hpBg: paint('#000000', 0, 0.45),
      hpFg: paint('#3ddc84'),
      hpLow: paint('#ff4d4d'),
      text: paint('#ffffff'),
      textShadow: paint('#000000', 0, 0.6),
      shadow: paint('#000000', 0, 0.18),
      fx: paint('#ffb703'),
      fxSmoke: paint('#444444'),
      spark: paint('#fff3b0'),
      miniBg: paint('#0b1d33', 0, 0.55),
      miniBorder: paint('#ffffff', 1.5, 0.6),
      arrow: paint('#ffffff'),
      lock: paint('#ff4d4d', 2),
      pole: paint('#ffffff', 3),
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
  kind: 'boom' | 'smallboom' | 'spark' | 'flare' | 'flak' | 'dash';
}

export class FxSystem {
  list: Fx[] = [];
  push(events: GameEvent[]) {
    for (const e of events) {
      if (e.t === 'explode') this.list.push({ x: e.x, y: e.y, age: 0, life: e.big ? 0.9 : 0.45, kind: e.big ? 'boom' : 'smallboom' });
      else if (e.t === 'hit') this.list.push({ x: e.x, y: e.y, age: 0, life: 0.18, kind: 'spark' });
      else if (e.t === 'special') this.list.push({ x: e.x, y: e.y, age: 0, life: e.kind === 'flare' ? 1.0 : 0.4, kind: e.kind });
    }
    if (this.list.length > 120) this.list.splice(0, this.list.length - 120);
  }
  update(dt: number) {
    for (const f of this.list) f.age += dt;
    this.list = this.list.filter((f) => f.age < f.life);
  }
}

// Deterministic clouds so every device sees the same sky.
function makeClouds(w: World) {
  const out: { x: number; y: number; r: number }[] = [];
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const density = MAPS[w.config.map]?.cloudDensity ?? 0.45;
  const n = Math.round(((w.config.arenaW * w.config.arenaH) / 100000) * density);
  for (let i = 0; i < n; i++) out.push({ x: rnd() * w.config.arenaW, y: rnd() * w.config.arenaH, r: 40 + rnd() * 70 });
  return out;
}
let cloudCache: { key: string; clouds: { x: number; y: number; r: number }[] } | null = null;

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

  // Grid gives a sense of speed.
  const g = 200;
  const x0 = Math.floor((cam.x - wvw / 2) / g) * g;
  const y0 = Math.floor((cam.y - wvh / 2) / g) * g;
  for (let x = x0; x < cam.x + wvw / 2 + g; x += g) canvas.drawLine(x, cam.y - wvh, x, cam.y + wvh, mp.grid);
  for (let y = y0; y < cam.y + wvh / 2 + g; y += g) canvas.drawLine(cam.x - wvw, y, cam.x + wvw, y, mp.grid);

  canvas.drawRect(Skia.XYWHRect(0, 0, arenaW, arenaH), mp.border);

  const visible = (x: number, y: number, pad: number) =>
    Math.abs(x - cam.x) < wvw / 2 + pad && Math.abs(y - cam.y) < wvh / 2 + pad;

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

  // Pickups
  for (const k of w.pickups) {
    if (!visible(k.x, k.y, 40)) continue;
    const pulse = 1 + Math.sin(time * 5 + k.id) * 0.1;
    canvas.drawCircle(k.x, k.y, 20 * pulse, fillFor(COLORS.pickup[k.kind]));
    canvas.drawCircle(k.x, k.y, 20 * pulse, c.p.miniBorder);
    const letter = PICKUP_LETTER[k.kind];
    const tw = c.font.measureText(letter).width;
    canvas.drawText(letter, k.x - tw / 2, k.y + 5, c.p.text, c.font);
  }

  // Bullets
  for (const b of w.bullets) {
    const bx = b.x + b.vx * ex;
    const by = b.y + b.vy * ex;
    if (!visible(bx, by, 20)) continue;
    canvas.drawLine(bx, by, bx - b.vx * 0.018, by - b.vy * 0.018, c.p.bullet);
  }

  // Missiles
  for (const mi of w.missiles) {
    const mx = mi.x + Math.cos(mi.angle) * mi.speed * ex;
    const my = mi.y + Math.sin(mi.angle) * mi.speed * ex;
    if (!visible(mx, my, 40)) continue;
    for (let i = 1; i <= 4; i++) {
      canvas.drawCircle(mx - Math.cos(mi.angle) * i * 9, my - Math.sin(mi.angle) * i * 9, 5 - i * 0.8, c.p.trail);
    }
    canvas.save();
    canvas.translate(mx, my);
    canvas.rotate((mi.angle * 180) / Math.PI, 0, 0);
    canvas.drawRect(Skia.XYWHRect(-8, -2.5, 16, 5), c.p.missile);
    canvas.restore();
  }

  // Planes: shadows first so they never cover another plane.
  const ART_SCALE = 1.25; // artwork is drawn a bit larger than the hit radius
  for (const p of w.planes) {
    if (!p.alive) continue;
    const pose = s.pose(p);
    if (!visible(pose.x, pose.y, 80)) continue;
    drawPlaneShadow(canvas, p.type, pose.x, pose.y, pose.angle, PLANES[p.type].radius * ART_SCALE);
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
    }
    if (!protectedBlink) {
      const thr = Math.max(0, Math.min(1, (p.speed - st.minSpeed) / (st.maxSpeed - st.minSpeed)));
      drawPlane(canvas, p.type, pose.x, pose.y, pose.angle, st.radius * ART_SCALE, planeColor(w, p, s.myId), thr, time);
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
    const bw = 40;
    const frac = Math.max(0, p.hp / st.hp);
    canvas.drawRect(Skia.XYWHRect(pose.x - bw / 2, pose.y - st.radius - 14, bw, 5), c.p.hpBg);
    canvas.drawRect(Skia.XYWHRect(pose.x - bw / 2, pose.y - st.radius - 14, bw * frac, 5), frac < 0.35 ? c.p.hpLow : c.p.hpFg);
    if (p.id !== s.myId) {
      const tw = c.smallFont.measureText(p.name).width;
      canvas.drawText(p.name, pose.x - tw / 2 + 1, pose.y - st.radius - 19, c.p.textShadow, c.smallFont);
      canvas.drawText(p.name, pose.x - tw / 2, pose.y - st.radius - 20, c.p.text, c.smallFont);
    }
  }

  // Clouds above planes (partially transparent)
  const key = `${w.config.map}-${arenaW}x${arenaH}`;
  if (!cloudCache || cloudCache.key !== key) cloudCache = { key, clouds: makeClouds(w) };
  for (const cl of cloudCache.clouds) {
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
    } else if (f.kind === 'spark') {
      c.p.spark.setAlphaf(1 - t);
      canvas.drawCircle(f.x, f.y, 4 + t * 6, c.p.spark);
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
  // Off-screen enemy arrows
  const me = w.planes.find((p) => p.id === s.myId);
  for (const p of w.planes) {
    if (p.id === s.myId || !p.alive) continue;
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
  for (const f of w.flags) {
    const fx2 = mmX + f.x * sx;
    const fy2 = mmY + f.y * sy;
    canvas.drawRect(Skia.XYWHRect(fx2 - 3, fy2 - 3, 6, 6), fillFor(COLORS.team[f.team]));
    canvas.drawRect(Skia.XYWHRect(fx2 - 3, fy2 - 3, 6, 6), c.p.miniBorder);
  }
  for (const p of w.planes) {
    if (!p.alive) continue;
    const pose = s.pose(p);
    canvas.drawCircle(mmX + pose.x * sx, mmY + pose.y * sy, p.id === s.myId ? 4.5 : 3.5, fillFor(planeColor(w, p, s.myId)));
  }
}
