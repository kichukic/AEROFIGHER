import {
  BlurStyle, ClipOp, PaintStyle, Skia, SkCanvas, SkPaint, SkPath, SkRect, StrokeCap, StrokeJoin, TileMode,
} from '@shopify/react-native-skia';
import { PlaneType } from '../sim/types';

/**
 * Cartoon military aircraft, top-down, in the style of the reference sheet:
 * thick dark outlines, shaded metal / camo paint, coloured stripe bands,
 * glass canopies, spinning propellers and engine glow.
 *
 * Everything is drawn in unit space (nose along +x) and scaled by the plane size.
 * The player's colour (team / FFA colour) is used for the accent bands, nose,
 * spinner and roundels; the base paint scheme belongs to the plane type.
 */

type Pt = [number, number];

interface Scheme {
  base: string; // main body paint
  wing: string; // wing paint
  dark: string; // camo blotches / shading
  light: string; // highlights / second camo colour
}

interface Design {
  body: SkPath;
  wings: SkPath;
  tail: SkPath;
  extras: SkPath | null; // engine nacelles, intakes
  silhouette: SkPath;
  camo: { x: number; y: number; r: number; light?: boolean }[];
  bands: SkRect[]; // accent bands (clipped to wings)
  noseBand: SkRect; // accent area on the nose (clipped to body)
  tailBand: SkRect; // accent area on the tail (clipped to tail)
  roundels: Pt[];
  panelLines: [number, number, number, number][];
  canopy: SkRect;
  turret: Pt | null;
  props: Pt[]; // propeller hubs (x, y); empty = jet
  propSpan: number;
  jets: Pt[]; // jet nozzles
  scheme: Scheme;
}

const P = (d: string) => Skia.Path.MakeFromSVGString(d)!;
const poly = (pts: Pt[]) => 'M ' + pts.map(([x, y]) => `${x} ${y}`).join(' L ') + ' Z';
/** Mirror half-outline points (y >= 0, nose to tail) into a symmetric closed outline. */
const mirror = (pts: Pt[]) => poly([...pts, ...[...pts].reverse().map(([x, y]) => [x, -y] as Pt)]);
const pair = (pts: Pt[]) => poly(pts) + ' ' + poly(pts.map(([x, y]) => [x, -y]));
const rrect = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(w, h) / 2;
  return `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
};
const R = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);

function design(type: PlaneType): Design {
  if (type === 'interceptor') {
    // Sky Force "Swift Justice": Sleek supersonic forward-swept delta interceptor with twin plasma thrusters.
    const body = mirror([[1.62, 0], [1.35, 0.06], [0.95, 0.13], [0.35, 0.18], [-0.7, 0.19], [-1.02, 0.14], [-1.08, 0.09]]);
    const wings = pair([[0.5, 0.16], [-0.25, 1.05], [-0.55, 1.08], [-0.62, 0.18]]);
    const tail = pair([[-0.65, 0.16], [-0.96, 0.54], [-1.12, 0.54], [-1.05, 0.14]]);
    const intakes = rrect(0.08, 0.16, 0.44, 0.12) + ' ' + rrect(0.08, -0.28, 0.44, 0.12);
    return {
      body: P(body), wings: P(wings), tail: P(tail), extras: P(intakes),
      silhouette: P([body, wings, tail, intakes].join(' ')),
      camo: [
        { x: 0.5, y: 0.05, r: 0.15 }, { x: -0.2, y: -0.1, r: 0.16 }, { x: -0.35, y: 0.65, r: 0.18 },
        { x: -0.45, y: -0.75, r: 0.18 }, { x: 0.1, y: 0.4, r: 0.12, light: true }, { x: -0.1, y: -0.4, r: 0.14, light: true },
      ],
      bands: [R(-0.7, 0.75, 1.2, 0.12), R(-0.7, -0.87, 1.2, 0.12)],
      noseBand: R(1.25, -0.3, 0.5, 0.6),
      tailBand: R(-1.22, -0.6, 0.22, 1.2),
      roundels: [[-0.28, 0.6], [-0.28, -0.6]],
      panelLines: [[0.6, -0.14, 0.6, 0.14], [-0.25, -0.18, -0.25, 0.18], [-0.1, 0.3, -0.48, 0.92], [-0.1, -0.3, -0.48, -0.92]],
      canopy: R(0.68, -0.08, 0.48, 0.16),
      turret: null,
      props: [],
      propSpan: 0,
      jets: [[-1.06, -0.06], [-1.06, 0.06]],
      scheme: { base: '#1e293b', wing: '#334155', dark: '#0f172a', light: '#475569' },
    };
  }
  if (type === 'bomber') {
    // Sky Force "Iron Clad": Heavy armored stealth battlecruiser with quad plasma thrusters.
    const body = mirror([[1.45, 0], [1.32, 0.12], [0.95, 0.22], [0.35, 0.25], [-0.75, 0.2], [-1.15, 0.12], [-1.22, 0.06]]);
    const wings = pair([[0.42, 0.22], [0.22, 1.42], [0.02, 1.5], [-0.22, 1.44], [-0.35, 0.22]]);
    const tail = pair([[-0.78, 0.15], [-0.94, 0.66], [-1.14, 0.68], [-1.22, 0.6], [-1.18, 0.1]]);
    const nacelles = [0.55, 1.02, -0.55, -1.02].map((y) => rrect(0.08, y - 0.09, 0.65, 0.18)).join(' ');
    return {
      body: P(body), wings: P(wings), tail: P(tail), extras: P(nacelles),
      silhouette: P([body, wings, tail, nacelles].join(' ')),
      camo: [
        { x: 0.1, y: 0.85, r: 0.22 }, { x: -0.1, y: -1.15, r: 0.2 }, { x: 0.5, y: -0.05, r: 0.16 },
        { x: -0.5, y: 0.08, r: 0.18 }, { x: -1.0, y: -0.45, r: 0.14 },
      ],
      bands: [R(-0.4, 0.65, 0.9, 0.1), R(-0.4, -0.75, 0.9, 0.1)],
      noseBand: R(1.12, -0.3, 0.4, 0.6),
      tailBand: R(-1.28, -0.7, 0.25, 1.4),
      roundels: [[-0.02, 1.24], [-0.02, -1.24]],
      panelLines: [[0.7, -0.22, 0.7, 0.22], [0.0, -0.24, 0.0, 0.24], [-0.5, -0.2, -0.5, 0.2], [0.3, 0.35, 0.18, 1.35], [0.3, -0.35, 0.18, -1.35]],
      canopy: R(0.92, -0.11, 0.32, 0.22),
      turret: [0.42, 0],
      props: [],
      propSpan: 0,
      jets: [[-1.2, -0.15], [-1.2, -0.05], [-1.2, 0.05], [-1.2, 0.15]],
      scheme: { base: '#131822', wing: '#202737', dark: '#0b0f17', light: '#354157' },
    };
  }
  if (type === 'stealth') {
    // Sky Force "Shadow-X": Tactical stealth infiltrator with faceted diamond fuselage, canted V-tails and violet jet glow.
    const body = mirror([[1.65, 0], [1.25, 0.1], [0.7, 0.22], [0.1, 0.24], [-0.55, 0.22], [-0.95, 0.15], [-1.08, 0.05]]);
    const wings = pair([[0.48, 0.2], [-0.1, 1.3], [-0.42, 1.32], [-0.62, 0.85], [-0.52, 0.2]]);
    const tail = pair([[-0.68, 0.14], [-0.98, 0.52], [-1.18, 0.46], [-1.05, 0.1]]);
    const intakes = rrect(0.04, 0.14, 0.42, 0.11) + ' ' + rrect(0.04, -0.25, 0.42, 0.11);
    return {
      body: P(body), wings: P(wings), tail: P(tail), extras: P(intakes),
      silhouette: P([body, wings, tail, intakes].join(' ')),
      camo: [
        { x: 0.4, y: 0.04, r: 0.14 }, { x: -0.2, y: -0.06, r: 0.15 }, { x: -0.25, y: 0.72, r: 0.16 },
        { x: -0.3, y: -0.72, r: 0.16 }, { x: 0.05, y: -0.35, r: 0.12, light: true },
      ],
      bands: [R(-0.45, 0.72, 0.85, 0.12), R(-0.45, -0.84, 0.85, 0.12)],
      noseBand: R(1.2, -0.25, 0.45, 0.5),
      tailBand: R(-1.15, -0.55, 0.2, 1.1),
      roundels: [[-0.2, 0.65], [-0.2, -0.65]],
      panelLines: [[0.7, 0, 0.2, 0.22], [0.7, 0, 0.2, -0.22], [-0.2, -0.2, -0.2, 0.2], [0.15, 0.35, -0.35, 1.05], [0.15, -0.35, -0.35, -1.05]],
      canopy: R(0.62, -0.075, 0.46, 0.15),
      turret: null,
      props: [],
      propSpan: 0,
      jets: [[-1.06, -0.07], [-1.06, 0.07]],
      scheme: { base: '#1a1426', wing: '#281c3d', dark: '#0e0b16', light: '#463069' },
    };
  }
  if (type === 'gunship') {
    // Sky Force "Warthog-30": Rugged close air support titan with titanium armored bathtub nose, 30mm rotary cannon tip & twin turbofans.
    const body = mirror([[1.68, 0], [1.68, 0.035], [1.5, 0.04], [1.42, 0.16], [0.82, 0.24], [0.22, 0.25], [-0.62, 0.22], [-1.12, 0.15], [-1.22, 0.07]]);
    const wings = pair([[0.32, 0.22], [0.18, 1.48], [-0.04, 1.52], [-0.26, 1.48], [-0.34, 0.22]]);
    const tail = pair([[-0.82, 0.16], [-0.94, 0.76], [-1.22, 0.78], [-1.22, 0.62], [-1.12, 0.12]]);
    const engines = rrect(-0.62, 0.24, 0.58, 0.22) + ' ' + rrect(-0.62, -0.46, 0.58, 0.22);
    return {
      body: P(body), wings: P(wings), tail: P(tail), extras: P(engines),
      silhouette: P([body, wings, tail, engines].join(' ')),
      camo: [
        { x: 0.1, y: 0.9, r: 0.22 }, { x: -0.1, y: -0.9, r: 0.22 }, { x: 0.5, y: -0.06, r: 0.17 },
        { x: -0.4, y: 0.08, r: 0.18 }, { x: -0.85, y: -0.5, r: 0.15 },
      ],
      bands: [R(-0.35, 0.75, 0.85, 0.13), R(-0.35, -0.88, 0.85, 0.13)],
      noseBand: R(1.15, -0.28, 0.35, 0.56),
      tailBand: R(-1.26, -0.8, 0.24, 1.6),
      roundels: [[-0.05, 1.15], [-0.05, -1.15]],
      panelLines: [[0.75, -0.22, 0.75, 0.22], [0.1, -0.24, 0.1, 0.24], [-0.45, -0.2, -0.45, 0.2], [0.22, 0.35, 0.12, 1.4], [0.22, -0.35, 0.12, -1.4]],
      canopy: R(0.82, -0.11, 0.38, 0.22),
      turret: null,
      props: [],
      propSpan: 0,
      jets: [[-0.64, -0.35], [-0.64, 0.35]],
      scheme: { base: '#172f22', wing: '#234431', dark: '#0c1a12', light: '#366045' },
    };
  }
  // Fighter: Sky Force "Gladius" — high-performance twin-plasma strike fighter with swept wings.
  const body = mirror([[1.42, 0], [1.25, 0.1], [0.85, 0.17], [0.3, 0.19], [-0.65, 0.16], [-1.04, 0.1], [-1.1, 0.04]]);
  const wings = pair([[0.42, 0.18], [0.15, 1.18], [-0.08, 1.25], [-0.28, 1.16], [-0.34, 0.18]]);
  const tail = pair([[-0.72, 0.12], [-0.88, 0.52], [-1.05, 0.56], [-1.12, 0.48], [-1.08, 0.08]]);
  const intakes = rrect(0.02, 0.16, 0.38, 0.1) + ' ' + rrect(0.02, -0.26, 0.38, 0.1);
  return {
    body: P(body), wings: P(wings), tail: P(tail), extras: P(intakes),
    silhouette: P([body, wings, tail, intakes].join(' ')),
    camo: [
      { x: 0.3, y: 0.04, r: 0.14 }, { x: -0.2, y: -0.08, r: 0.15 }, { x: -0.1, y: 0.7, r: 0.16 },
      { x: -0.15, y: -0.7, r: 0.16 }, { x: 0.1, y: -0.4, r: 0.12, light: true },
    ],
    bands: [R(-0.4, 0.78, 0.9, 0.12), R(-0.4, -0.9, 0.9, 0.12)],
    noseBand: R(1.05, -0.3, 0.45, 0.6),
    tailBand: R(-1.18, -0.6, 0.22, 1.2),
    roundels: [[-0.05, 0.7], [-0.05, -0.7]],
    panelLines: [[0.58, -0.15, 0.58, 0.15], [-0.2, -0.17, -0.2, 0.17], [0.25, 0.25, 0.1, 1.05], [0.25, -0.25, 0.1, -1.05]],
    canopy: R(0.48, -0.09, 0.42, 0.18),
    turret: null,
    props: [],
    propSpan: 0,
    jets: [[-1.08, -0.08], [-1.08, 0.08]],
    scheme: { base: '#1a273e', wing: '#253a5c', dark: '#0e1828', light: '#3a5682' },
  };
}

// ---------- colour helpers ----------
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** amount > 0 lightens towards white, < 0 darkens towards black. */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  const t = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + (t - v) * k))).toString(16).padStart(2, '0');
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}

function fill(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  return p;
}
function stroke(color: string, width: number, alpha = 1): SkPaint {
  const p = fill(color, alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setStrokeCap(StrokeCap.Round);
  return p;
}
function linear(x0: number, y0: number, x1: number, y1: number, colors: string[], pos: number[]): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, colors.map((c) => Skia.Color(c)), pos, TileMode.Clamp));
  return p;
}

interface TypePaints {
  d: Design;
  body: SkPaint;
  wing: SkPaint;
  tail: SkPaint;
  extras: SkPaint;
  camoDark: SkPaint;
  camoLight: SkPaint;
}

const cache: Partial<Record<PlaneType, TypePaints>> = {};
function paintsFor(type: PlaneType): TypePaints {
  const hit = cache[type];
  if (hit) return hit;
  const d = design(type);
  const s = d.scheme;
  const made: TypePaints = {
    d,
    // Rounded fuselage: dark edges, bright highlight just off-centre.
    body: linear(0, -0.24, 0, 0.24, [shade(s.base, -0.35), shade(s.base, 0.35), s.base, shade(s.base, -0.45)], [0, 0.38, 0.62, 1]),
    // Wings: bright leading edge fading to a darker trailing edge.
    wing: linear(0.4, 0, -0.35, 0, [shade(s.wing, 0.3), s.wing, shade(s.wing, -0.3)], [0, 0.45, 1]),
    tail: linear(-0.7, 0, -1.1, 0, [shade(s.wing, 0.2), shade(s.wing, -0.3)], [0, 1]),
    extras: linear(0, -0.1, 0, 0.1, [shade(s.base, -0.2), shade(s.base, 0.3), shade(s.base, -0.4)], [0, 0.45, 1]),
    camoDark: fill(s.dark, 0.85),
    camoLight: fill(s.light, 0.8),
  };
  cache[type] = made;
  return made;
}

const accentCache: Record<string, { fill: SkPaint; dark: SkPaint }> = {};
function accentFor(color: string) {
  return (accentCache[color] ??= {
    fill: linear(0, -0.3, 0, 0.3, [shade(color, 0.25), color, shade(color, -0.3)], [0, 0.5, 1]),
    dark: fill(shade(color, -0.45)),
  });
}

let common: {
  outline: SkPaint;
  innerLine: SkPaint;
  panel: SkPaint;
  shadow: SkPaint;
  glass: SkPaint;
  frame: SkPaint;
  glint: SkPaint;
  white: SkPaint;
  propDisc: SkPaint;
  blade: SkPaint;
  flameOuter: SkPaint;
  flameInner: SkPaint;
  strobeCyan: SkPaint;
  strobeRed: SkPaint;
  nozzle: SkPaint;
  hitFlash: SkPaint;
} | null = null;

function getCommon() {
  if (common) return common;
  const shadow = fill('#000000', 0.35);
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.12, true));
  common = {
    outline: stroke('#0a0e14', 0.11),
    innerLine: stroke('#0a0e14', 0.045, 0.9),
    panel: stroke('#00e5ff', 0.022, 0.4),
    shadow,
    glass: linear(0, -0.12, 0, 0.12, ['#00e5ff', '#0284c7', '#082f49'], [0, 0.45, 1]),
    frame: stroke('#0a0e14', 0.04),
    glint: fill('#ffffff', 0.9),
    white: fill('#f8fafc'),
    propDisc: fill('#d8d8d8', 0.28),
    blade: stroke('#2a2622', 0.05),
    flameOuter: fill('#00d4ff', 0.9), // Sky Force supersonic cyan plasma thruster
    flameInner: fill('#ffffff', 0.98), // Blazing white-hot fusion core
    strobeCyan: fill('#00f5d4', 0.95),
    strobeRed: fill('#ff2a4a', 0.95),
    nozzle: fill('#1e293b'),
    hitFlash: fill('#ffffff', 0.85),
  };
  return common;
}

/** Soft drop shadow (draw before all planes so shadows sit underneath). */
export function drawPlaneShadow(canvas: SkCanvas, type: PlaneType, x: number, y: number, angle: number, scale: number, bank: number = 0) {
  const t = paintsFor(type);
  canvas.save();
  canvas.translate(x + scale * 0.7, y + scale * 1.0);
  canvas.rotate((angle * 180) / Math.PI, 0, 0);
  const bankFactor = 1 - Math.abs(bank) * 0.22;
  canvas.scale(scale * 0.95, scale * 0.95 * bankFactor);
  canvas.drawPath(t.d.silhouette, getCommon().shadow);
  canvas.restore();
}

/** Draw a plane. `throttle` (0..1) drives the jet flame; `time` animates propellers and flicker. */
export function drawPlane(
  canvas: SkCanvas, type: PlaneType, x: number, y: number, angle: number, scale: number,
  color: string, throttle: number, time: number, bank: number = 0, isHit: boolean = false,
) {
  const t = paintsFor(type);
  const d = t.d;
  const c = getCommon();
  const acc = accentFor(color);

  canvas.save();
  canvas.translate(x, y);
  canvas.rotate((angle * 180) / Math.PI, 0, 0);
  const bankFactor = 1 - Math.abs(bank) * 0.28;
  canvas.scale(scale, scale * bankFactor);

  // Jet flame behind everything.
  const flicker = 0.85 + Math.sin(time * 45 + x) * 0.15;
  for (const [jx, jy] of d.jets) {
    const len = (0.3 + throttle * 0.6) * flicker;
    const o = Skia.Path.MakeFromSVGString(`M ${jx} ${jy - 0.11} Q ${jx - len * 0.6} ${jy - 0.08} ${jx - len} ${jy} Q ${jx - len * 0.6} ${jy + 0.08} ${jx} ${jy + 0.11} Z`);
    const i = Skia.Path.MakeFromSVGString(`M ${jx} ${jy - 0.06} L ${jx - len * 0.55} ${jy} L ${jx} ${jy + 0.06} Z`);
    if (o) canvas.drawPath(o, c.flameOuter);
    if (i) canvas.drawPath(i, c.flameInner);
  }

  // 1) Thick cartoon outline around the whole silhouette.
  canvas.drawPath(d.silhouette, c.outline);

  // 2) Base paint, back to front.
  canvas.drawPath(d.tail, t.tail);
  canvas.drawPath(d.wings, t.wing);
  if (d.extras) canvas.drawPath(d.extras, t.extras);
  canvas.drawPath(d.body, t.body);

  // 3) Camo blotches, clipped to the airframe.
  if (d.camo.length) {
    canvas.save();
    canvas.clipPath(d.silhouette, ClipOp.Intersect, true);
    for (const b of d.camo) canvas.drawOval(R(b.x - b.r * 1.3, b.y - b.r, b.r * 2.6, b.r * 2), b.light ? t.camoLight : t.camoDark);
    canvas.restore();
  }

  // 4) Accent colour: wing bands, nose and tail tips.
  canvas.save();
  canvas.clipPath(d.wings, ClipOp.Intersect, true);
  for (const band of d.bands) canvas.drawRect(band, acc.fill);
  canvas.restore();
  canvas.save();
  canvas.clipPath(d.body, ClipOp.Intersect, true);
  canvas.drawRect(d.noseBand, acc.fill);
  canvas.restore();
  canvas.save();
  canvas.clipPath(d.tail, ClipOp.Intersect, true);
  canvas.drawRect(d.tailBand, acc.fill);
  canvas.restore();

  // 5) Panel lines and part separation lines.
  for (const [ax, ay, bx, by] of d.panelLines) canvas.drawLine(ax, ay, bx, by, c.panel);
  canvas.drawPath(d.wings, c.innerLine);
  if (d.extras) canvas.drawPath(d.extras, c.innerLine);
  canvas.drawPath(d.body, c.innerLine);

  // 6) Roundels: white ring with the player colour inside.
  for (const [rx, ry] of d.roundels) {
    canvas.drawCircle(rx, ry, 0.13, c.white);
    canvas.drawCircle(rx, ry, 0.085, acc.dark);
    canvas.drawCircle(rx, ry, 0.13, c.panel);
  }

  // 7) Canopy (and bomber turret).
  canvas.drawOval(d.canopy, c.glass);
  canvas.drawOval(d.canopy, c.frame);
  const cr = d.canopy;
  canvas.drawOval(R(cr.x + cr.width * 0.5, cr.y + cr.height * 0.18, cr.width * 0.3, cr.height * 0.25), c.glint);
  if (d.turret) {
    canvas.drawCircle(d.turret[0], d.turret[1], 0.12, c.glass);
    canvas.drawCircle(d.turret[0], d.turret[1], 0.12, c.frame);
    canvas.drawCircle(d.turret[0] + 0.03, d.turret[1] - 0.04, 0.035, c.glint);
  }

  // 8) Jet nozzles.
  for (const [jx, jy] of d.jets) canvas.drawOval(R(jx - 0.06, jy - 0.1, 0.1, 0.2), c.nozzle);

  // 9) Sky Force Wingtip Navigation Strobes (Cyan on starboard, Red on port)
  const strobe = Math.floor(time * 5) % 2 === 0;
  if (strobe) {
    canvas.drawCircle(-0.3, 1.05, 0.055, c.strobeCyan);
    canvas.drawCircle(-0.3, -1.05, 0.055, c.strobeRed);
  }

  // 9) Propellers: blurred disc + two spinning blades seen edge-on, coloured spinner.
  for (const [px, py] of d.props) {
    const span = d.propSpan;
    canvas.drawOval(R(px - 0.03, py - span, 0.07, span * 2), c.propDisc);
    for (let k = 0; k < 2; k++) {
      const l = Math.cos(time * 55 + k * Math.PI / 2 + px * 7 + py * 3) * span;
      canvas.drawLine(px + 0.01, py - l, px + 0.01, py + l, c.blade);
    }
    canvas.drawCircle(px, py, type === 'bomber' ? 0.06 : 0.085, acc.fill);
    canvas.drawCircle(px, py, type === 'bomber' ? 0.06 : 0.085, c.frame);
  }

  // 10) Damage hit flash
  if (isHit) {
    canvas.drawPath(d.silhouette, c.hitFlash);
  }

  canvas.restore();
}
