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
    // Swept-wing camo jet.
    const body = mirror([[1.55, 0], [1.3, 0.07], [0.9, 0.14], [0.4, 0.19], [-0.7, 0.2], [-0.95, 0.15], [-1.02, 0.1]]);
    const wings = pair([[0.45, 0.17], [-0.3, 0.98], [-0.58, 1.0], [-0.55, 0.18]]);
    const tail = pair([[-0.58, 0.16], [-0.92, 0.52], [-1.08, 0.52], [-1.0, 0.14]]);
    const intakes = rrect(0.05, 0.17, 0.42, 0.13) + ' ' + rrect(0.05, -0.3, 0.42, 0.13);
    return {
      body: P(body), wings: P(wings), tail: P(tail), extras: P(intakes),
      silhouette: P([body, wings, tail, intakes].join(' ')),
      camo: [
        { x: 0.6, y: 0.05, r: 0.16 }, { x: -0.2, y: -0.1, r: 0.18 }, { x: -0.3, y: 0.6, r: 0.2 },
        { x: -0.45, y: -0.7, r: 0.18 }, { x: 0.1, y: 0.35, r: 0.12, light: true }, { x: -0.1, y: -0.45, r: 0.14, light: true },
        { x: -0.85, y: 0.35, r: 0.12 }, { x: 1.0, y: -0.06, r: 0.1, light: true },
      ],
      bands: [R(-0.7, 0.7, 1.2, 0.12), R(-0.7, -0.82, 1.2, 0.12)],
      noseBand: R(1.22, -0.3, 0.5, 0.6),
      tailBand: R(-1.2, -0.6, 0.22, 1.2),
      roundels: [[-0.3, 0.55], [-0.3, -0.55]],
      panelLines: [[0.6, -0.15, 0.6, 0.15], [-0.3, -0.2, -0.3, 0.2], [-0.1, 0.3, -0.45, 0.85], [-0.1, -0.3, -0.45, -0.85]],
      canopy: R(0.62, -0.09, 0.5, 0.18),
      turret: null,
      props: [],
      propSpan: 0,
      jets: [[-1.02, 0]],
      scheme: { base: '#6f7d3c', wing: '#66743a', dark: '#3c4720', light: '#a8955a' },
    };
  }
  if (type === 'bomber') {
    // Four-engine heavy bomber.
    const body = mirror([[1.32, 0], [1.22, 0.12], [0.95, 0.2], [0.4, 0.23], [-0.75, 0.17], [-1.12, 0.09], [-1.2, 0.04]]);
    const wings = pair([[0.38, 0.2], [0.24, 1.38], [0.05, 1.48], [-0.2, 1.42], [-0.3, 0.2]]);
    const tail = pair([[-0.78, 0.13], [-0.92, 0.62], [-1.1, 0.66], [-1.2, 0.58], [-1.18, 0.08]]);
    const nacelles = [0.5, 0.95, -0.5, -0.95].map((y) => rrect(0.05, y - 0.09, 0.62, 0.18)).join(' ');
    return {
      body: P(body), wings: P(wings), tail: P(tail), extras: P(nacelles),
      silhouette: P([body, wings, tail, nacelles].join(' ')),
      camo: [
        { x: 0.1, y: 0.8, r: 0.22 }, { x: -0.1, y: -1.1, r: 0.2 }, { x: 0.5, y: -0.05, r: 0.15 },
        { x: -0.5, y: 0.08, r: 0.16 }, { x: -1.0, y: -0.4, r: 0.14 }, { x: 0.0, y: 1.25, r: 0.14, light: true },
      ],
      bands: [R(-0.4, 0.62, 0.9, 0.1), R(-0.4, -0.72, 0.9, 0.1)],
      noseBand: R(1.05, -0.3, 0.4, 0.6),
      tailBand: R(-1.25, -0.7, 0.25, 1.4),
      roundels: [[-0.02, 1.2], [-0.02, -1.2]],
      panelLines: [[0.7, -0.2, 0.7, 0.2], [0.0, -0.22, 0.0, 0.22], [-0.5, -0.18, -0.5, 0.18], [0.3, 0.3, 0.2, 1.3], [0.3, -0.3, 0.2, -1.3]],
      canopy: R(0.88, -0.12, 0.3, 0.24),
      turret: [0.45, 0],
      props: [[0.7, 0.5], [0.7, 0.95], [0.7, -0.5], [0.7, -0.95]],
      propSpan: 0.3,
      jets: [],
      scheme: { base: '#55594d', wing: '#4b4f44', dark: '#33362e', light: '#7a7d68' },
    };
  }
  // Fighter: WW2-style single-prop fighter, bare metal.
  const body = mirror([[1.12, 0], [1.08, 0.12], [0.85, 0.16], [0.3, 0.18], [-0.55, 0.12], [-0.98, 0.06], [-1.04, 0.02]]);
  const wings = pair([[0.36, 0.17], [0.27, 1.12], [0.12, 1.24], [-0.1, 1.24], [-0.22, 1.12], [-0.26, 0.17]]);
  const tail = pair([[-0.72, 0.1], [-0.8, 0.46], [-0.92, 0.52], [-1.02, 0.46], [-1.02, 0.06]]);
  return {
    body: P(body), wings: P(wings), tail: P(tail), extras: null,
    silhouette: P([body, wings, tail].join(' ')),
    camo: [],
    bands: [R(-0.4, 0.82, 0.9, 0.12), R(-0.4, -0.94, 0.9, 0.12)],
    noseBand: R(0.82, -0.3, 0.5, 0.6),
    tailBand: R(-1.1, -0.6, 0.2, 1.2),
    roundels: [[0.05, 0.6], [0.05, -0.6]],
    panelLines: [[0.55, -0.16, 0.55, 0.16], [-0.2, -0.16, -0.2, 0.16], [0.3, 0.25, 0.22, 1.1], [0.3, -0.25, 0.22, -1.1], [-0.15, 0.25, -0.2, 1.1], [-0.15, -0.25, -0.2, -1.1]],
    canopy: R(0.12, -0.1, 0.42, 0.2),
    turret: null,
    props: [[1.13, 0]],
    propSpan: 0.48,
    jets: [],
    scheme: { base: '#b9c2c9', wing: '#a9b3bb', dark: '#7d8890', light: '#e4eaee' },
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
  nozzle: SkPaint;
  hitFlash: SkPaint;
} | null = null;

function getCommon() {
  if (common) return common;
  const shadow = fill('#000000', 0.28);
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.09, true));
  common = {
    outline: stroke('#17130f', 0.13),
    innerLine: stroke('#17130f', 0.045, 0.9),
    panel: stroke('#17130f', 0.022, 0.35),
    shadow,
    glass: linear(0, -0.12, 0, 0.12, ['#9fe3ff', '#2f7fb8', '#123a5c'], [0, 0.45, 1]),
    frame: stroke('#17130f', 0.04),
    glint: fill('#ffffff', 0.85),
    white: fill('#f4f1e8'),
    propDisc: fill('#d8d8d8', 0.28),
    blade: stroke('#2a2622', 0.05),
    flameOuter: fill('#ff8a1c', 0.85),
    flameInner: fill('#fff3b0', 0.95),
    nozzle: fill('#2b2b2b'),
    hitFlash: fill('#ffffff', 0.8),
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
