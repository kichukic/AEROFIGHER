import {
  PaintStyle,
  SkCanvas,
  SkFont,
  Skia,
  SkPaint,
  StrokeCap,
  matchFont,
} from '@shopify/react-native-skia';
import { MapPalette } from '../sim/maps';
import { MapId } from '../sim/types';

export interface TerrainField {
  x: number;
  y: number;
  w: number;
  h: number;
  crop: 'wheat' | 'pasture' | 'plowed' | 'canola' | 'fallow';
  furrowDir: 'h' | 'v' | 'none';
}

export interface TerrainRoad {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  kind: 'dirt' | 'paved';
}

export interface TerrainRunway {
  x: number;
  y: number;
  length: number;
  width: number;
  angle: number;
}

export interface TerrainTree {
  x: number;
  y: number;
  r: number;
  shade: number; // 0, 1, 2
  type: 'oak' | 'pine' | 'palm';
}

export interface NavalPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  label: string;
}

export interface TerrainData {
  fields: TerrainField[];
  roads: TerrainRoad[];
  runway: TerrainRunway | null;
  trees: TerrainTree[];
  platforms: NavalPlatform[];
  shoals: { x: number; y: number; rx: number; ry: number; angle: number }[];
}

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Precomputed deterministic terrain for each map. */
const terrainCache: Record<string, TerrainData> = {};

export function getTerrain(mapId: MapId, arenaW: number, arenaH: number): TerrainData {
  const key = `${mapId}_${arenaW}_${arenaH}`;
  if (terrainCache[key]) return terrainCache[key];

  const rnd = lcg(1337 + arenaW + arenaH);
  const fields: TerrainField[] = [];
  const roads: TerrainRoad[] = [];
  const trees: TerrainTree[] = [];
  const platforms: NavalPlatform[] = [];
  const shoals: { x: number; y: number; rx: number; ry: number; angle: number }[] = [];
  let runway: TerrainRunway | null = null;

  // Ocean: Sky Force Naval Fleet & Defense Platforms
  if (mapId === 'ocean') {
    // Strategic floating naval defense platforms / supercarrier decks
    platforms.push({ x: arenaW * 0.35, y: arenaH * 0.45, w: 320, h: 140, angle: -0.15, label: 'CV-88' });
    platforms.push({ x: arenaW * 0.7, y: arenaH * 0.6, w: 260, h: 120, angle: 0.2, label: 'RIG-04' });
    platforms.push({ x: arenaW * 0.5, y: arenaH * 0.25, w: 220, h: 100, angle: 0.05, label: 'HELIPAD' });

    // Turquoise shallow reef shoals and ocean atoll contours
    for (let i = 0; i < 9; i++) {
      shoals.push({
        x: 300 + rnd() * (arenaW - 600),
        y: 250 + rnd() * (arenaH - 500),
        rx: 140 + rnd() * 220,
        ry: 80 + rnd() * 140,
        angle: rnd() * Math.PI,
      });
    }
  } else if (mapId === 'farmland' || mapId === 'desert' || mapId === 'canyon' || mapId === 'night') {
    const crops: TerrainField['crop'][] = ['wheat', 'pasture', 'plowed', 'canola', 'fallow'];
    const cellSize = 260;
    const cols = Math.ceil(arenaW / cellSize);
    const rows = Math.ceil(arenaH / cellSize);

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const w = Math.min(cellSize, arenaW - x);
        const h = Math.min(cellSize, arenaH - y);
        const crop = crops[Math.floor(rnd() * crops.length)];
        const furrowDir: TerrainField['furrowDir'] = rnd() > 0.4 ? (rnd() > 0.5 ? 'h' : 'v') : 'none';
        fields.push({ x, y, w, h, crop, furrowDir });
      }
    }
  }

  // 2. Airfield Runway (placed near center or lower third)
  if (mapId === 'farmland' || mapId === 'night') {
    runway = {
      x: arenaW * 0.5,
      y: arenaH * 0.65,
      length: 750,
      width: 72,
      angle: 0.05, // slightly off-axis for realism
    };
  }

  // 3. Roads / Paths connecting sectors
  const midY = arenaH * 0.42;
  roads.push({ x1: 0, y1: midY, x2: arenaW, y2: midY, width: 18, kind: 'paved' });
  const midX = arenaW * 0.52;
  roads.push({ x1: midX, y1: 0, x2: midX, y2: arenaH, width: 14, kind: 'dirt' });
  roads.push({ x1: arenaW * 0.2, y1: 0, x2: arenaW * 0.25, y2: arenaH, width: 10, kind: 'dirt' });
  roads.push({ x1: arenaW * 0.75, y1: 0, x2: arenaW * 0.78, y2: arenaH, width: 10, kind: 'dirt' });

  // 4. 2D Trees: Hedgerow lines along field boundaries and clustered forest groves
  const isDesert = mapId === 'desert' || mapId === 'canyon';
  const isArctic = mapId === 'arctic';
  const treeType: TerrainTree['type'] = isDesert ? 'palm' : isArctic ? 'pine' : 'oak';

  // Hedgerow trees along vertical roads/borders
  for (let x = 120; x < arenaW - 100; x += 260) {
    for (let y = 80; y < arenaH - 80; y += 45 + Math.floor(rnd() * 25)) {
      if (rnd() > 0.3) {
        trees.push({
          x: x + (rnd() - 0.5) * 16,
          y,
          r: 12 + rnd() * 10,
          shade: Math.floor(rnd() * 3),
          type: treeType,
        });
      }
    }
  }

  // Clustered forest groves scattered across the countryside
  const numGroves = Math.floor((arenaW * arenaH) / 180000);
  for (let g = 0; g < numGroves; g++) {
    const gx = 200 + rnd() * (arenaW - 400);
    const gy = 200 + rnd() * (arenaH - 400);
    // Don't place groves on the runway
    if (runway && Math.hypot(gx - runway.x, gy - runway.y) < 420) continue;

    const groveSize = 6 + Math.floor(rnd() * 9);
    for (let i = 0; i < groveSize; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = rnd() * 65;
      trees.push({
        x: gx + Math.cos(angle) * dist,
        y: gy + Math.sin(angle) * dist,
        r: 14 + rnd() * 12,
        shade: Math.floor(rnd() * 3),
        type: treeType,
      });
    }
  }

  const result: TerrainData = { fields, roads, runway, trees, platforms, shoals };
  terrainCache[key] = result;
  return result;
}

// ---------- Skia Paint Caches ----------
function paint(color: string, stroke = 0, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAntiAlias(true);
  if (stroke > 0) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
    p.setStrokeCap(StrokeCap.Round);
  }
  p.setAlphaf(alpha);
  return p;
}

let fontCache: SkFont | null = null;
function getRunwayFont(): SkFont {
  return (fontCache ??= matchFont({ fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold' }));
}

interface TerrainPaints {
  crops: Record<TerrainField['crop'], SkPaint>;
  furrow: SkPaint;
  hedgeBorder: SkPaint;
  roadDirt: SkPaint;
  roadPaved: SkPaint;
  roadLine: SkPaint;
  runwayAsphalt: SkPaint;
  runwayLine: SkPaint;
  runwayBorder: SkPaint;
  shadow: SkPaint;
  shoal: SkPaint;
  shoalInner: SkPaint;
  platformHull: SkPaint;
  platformDeck: SkPaint;
  platformHazard: SkPaint;
  runwayGreen: SkPaint;
  runwayRed: SkPaint;
  treeDark: SkPaint[];
  treeMid: SkPaint[];
  treeLight: SkPaint[];
  treeCore: SkPaint;
  // Enhanced tree paints for lush tropical foliage
  treeTrunk: SkPaint;
  treeTrunkLight: SkPaint;
  treeFrondDark: SkPaint[];
  treeFrondMid: SkPaint[];
  treeFrondLight: SkPaint[];
  treeFrondTip: SkPaint;
  treeCanopyDeep: SkPaint;
  treeShadowSoft: SkPaint;
  treeHighlight: SkPaint;
  treeBark: SkPaint;
}

let paints: TerrainPaints | null = null;

function getPaints(): TerrainPaints {
  if (paints) return paints;

  const shadow = paint('#000000', 0, 0.28);

  paints = {
    crops: {
      pasture: paint('#589643'), // vibrant lush meadow
      wheat: paint('#d8aa4f'), // warm golden grain
      plowed: paint('#7d5027'), // rich furrowed earth
      canola: paint('#e2bf34'), // bright yellow blooming field
      fallow: paint('#668a44'), // clover / olive fallow
    },
    furrow: paint('#000000', 1.4, 0.12),
    hedgeBorder: paint('#23461a', 2.5, 0.45),
    roadDirt: paint('#947653', 0, 0.95),
    roadPaved: paint('#3b3f46', 0, 0.95),
    roadLine: paint('#ffffff', 1.8, 0.65),
    runwayAsphalt: paint('#26282e'),
    runwayLine: paint('#ffffff', 2.5, 0.9),
    runwayBorder: paint('#191a1e', 3.5),
    shadow,
    shoal: paint('#00e5ff', 0, 0.18),
    shoalInner: paint('#00f5d4', 0, 0.28),
    platformHull: paint('#1e293b'),
    platformDeck: paint('#0f172a'),
    platformHazard: paint('#ffd23f', 2, 0.9),
    runwayGreen: paint('#00f5d4', 4, 0.95),
    runwayRed: paint('#ff2a4a', 4, 0.95),
    // 3 tones of green for varied lush forest canopies
    treeDark: [paint('#1c4217'), paint('#183d21'), paint('#254714')],
    treeMid: [paint('#3c802b'), paint('#32753a'), paint('#4c8a29')],
    treeLight: [paint('#62b047'), paint('#53a85b'), paint('#74bd41')],
    treeCore: paint('#152812', 0, 0.8),
    // Enhanced tropical tree paints
    treeTrunk: paint('#3d2816'),
    treeTrunkLight: paint('#5a3f26'),
    treeFrondDark: [paint('#0e3310'), paint('#153a14'), paint('#1a4518')],
    treeFrondMid: [paint('#2a6b22'), paint('#256b30'), paint('#367a26')],
    treeFrondLight: [paint('#4aad3a'), paint('#3fa848'), paint('#58b836')],
    treeFrondTip: paint('#7dd66a'),
    treeCanopyDeep: paint('#0a2a0c', 0, 0.75),
    treeShadowSoft: paint('#000000', 0, 0.35),
    treeHighlight: paint('#a8e890', 0, 0.65),
    treeBark: paint('#2a1c0e', 0, 0.9),
  };
  return paints;
}

/**
 * Draw 2D ground fields, roads, airstrip runway, and hedgerow dividers.
 * Viewport culled for 60 FPS mobile performance.
 */
export function drawGroundTerrain(
  canvas: SkCanvas,
  terrain: TerrainData,
  visible: (x: number, y: number, pad: number) => boolean,
  palette: MapPalette,
  mapId: MapId,
) {
  const p = getPaints();

  // 0. Ocean Reef Shoals & Naval Battle Platforms (Sky Force Naval Theater)
  if (terrain.shoals && terrain.shoals.length > 0) {
    for (const sh of terrain.shoals) {
      if (!visible(sh.x, sh.y, Math.max(sh.rx, sh.ry))) continue;
      canvas.save();
      canvas.translate(sh.x, sh.y);
      canvas.rotate((sh.angle * 180) / Math.PI, 0, 0);
      canvas.drawOval(Skia.XYWHRect(-sh.rx, -sh.ry, sh.rx * 2, sh.ry * 2), p.shoal);
      canvas.drawOval(Skia.XYWHRect(-sh.rx * 0.6, -sh.ry * 0.6, sh.rx * 1.2, sh.ry * 1.2), p.shoalInner);
      canvas.restore();
    }
  }

  if (terrain.platforms && terrain.platforms.length > 0) {
    for (const pl of terrain.platforms) {
      if (!visible(pl.x, pl.y, Math.max(pl.w, pl.h))) continue;
      canvas.save();
      canvas.translate(pl.x, pl.y);
      canvas.rotate((pl.angle * 180) / Math.PI, 0, 0);
      const halfW = pl.w / 2;
      const halfH = pl.h / 2;
      canvas.drawRect(Skia.XYWHRect(-halfW + 6, -halfH + 8, pl.w, pl.h), p.shadow);
      canvas.drawRect(Skia.XYWHRect(-halfW, -halfH, pl.w, pl.h), p.platformHull);
      canvas.drawRect(Skia.XYWHRect(-halfW + 4, -halfH + 4, pl.w - 8, pl.h - 8), p.platformDeck);
      canvas.drawLine(-halfW + 20, 0, halfW - 20, 0, p.runwayLine);
      canvas.drawCircle(halfW - 35, 0, 18, p.platformHazard);
      const f = getRunwayFont();
      canvas.drawText('H', halfW - 42, 6, p.platformHazard, f);
      canvas.restore();
    }
  }

  // 1. Draw patchwork fields
  for (const f of terrain.fields) {
    if (!visible(f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h))) continue;
    const rect = Skia.XYWHRect(f.x, f.y, f.w, f.h);

    if (mapId === 'desert' || mapId === 'canyon') {
      // Warm sandy/clay patchwork
      const sandPaint = f.crop === 'wheat' ? p.crops.wheat : p.crops.plowed;
      sandPaint.setAlphaf(0.55);
      canvas.drawRect(rect, sandPaint);
      sandPaint.setAlphaf(1);
    } else if (mapId === 'arctic') {
      // Soft snow / tundra patch
      const arcticPaint = p.crops.fallow;
      arcticPaint.setAlphaf(0.3);
      canvas.drawRect(rect, arcticPaint);
      arcticPaint.setAlphaf(1);
    } else {
      // Farmland / countryside: rich agricultural crop quilt
      canvas.drawRect(rect, p.crops[f.crop]);
    }

    // Furrows / tractor lines
    if (f.furrowDir === 'h') {
      for (let ly = f.y + 12; ly < f.y + f.h; ly += 14) {
        canvas.drawLine(f.x + 4, ly, f.x + f.w - 4, ly, p.furrow);
      }
    } else if (f.furrowDir === 'v') {
      for (let lx = f.x + 12; lx < f.x + f.w; lx += 14) {
        canvas.drawLine(lx, f.y + 4, lx, f.y + f.h - 4, p.furrow);
      }
    }

    // Hedge / boundary line
    canvas.drawRect(rect, p.hedgeBorder);
  }

  // 2. Draw roads
  for (const rd of terrain.roads) {
    const cx = (rd.x1 + rd.x2) / 2;
    const cy = (rd.y1 + rd.y2) / 2;
    const len = Math.hypot(rd.x2 - rd.x1, rd.y2 - rd.y1);
    if (!visible(cx, cy, len / 2)) continue;

    const roadPaint = rd.kind === 'paved' ? p.roadPaved : p.roadDirt;
    roadPaint.setStyle(PaintStyle.Stroke);
    roadPaint.setStrokeWidth(rd.width);
    canvas.drawLine(rd.x1, rd.y1, rd.x2, rd.y2, roadPaint);

    if (rd.kind === 'paved') {
      // Center dashed road marking
      canvas.drawLine(rd.x1, rd.y1, rd.x2, rd.y2, p.roadLine);
    }
  }

  // 3. Draw Military Runway & Tarmac
  if (terrain.runway && visible(terrain.runway.x, terrain.runway.y, terrain.runway.length / 2)) {
    const rw = terrain.runway;
    canvas.save();
    canvas.translate(rw.x, rw.y);
    canvas.rotate((rw.angle * 180) / Math.PI, 0, 0);

    const halfL = rw.length / 2;
    const halfW = rw.width / 2;
    const runRect = Skia.XYWHRect(-halfL, -halfW, rw.length, rw.width);

    // Asphalt surface & dark perimeter
    canvas.drawRect(runRect, p.runwayAsphalt);
    canvas.drawRect(runRect, p.runwayBorder);

    // Threshold piano key stripes at both ends
    for (let side = -1; side <= 1; side += 2) {
      const baseX = side * (halfL - 24);
      for (let k = -halfW + 8; k < halfW - 8; k += 11) {
        canvas.drawLine(baseX, k, baseX + side * 28, k, p.runwayLine);
      }
    }

    // Centerline dashed stripes
    for (let x = -halfL + 65; x < halfL - 65; x += 36) {
      canvas.drawLine(x, 0, x + 20, 0, p.runwayLine);
    }

    // Runway numbers
    const font = getRunwayFont();
    canvas.drawText('24', -halfL + 34, 7, p.runwayLine, font);
    canvas.drawText('06', halfL - 60, 7, p.runwayLine, font);

    // Night stealth airfield: glowing approach threshold lights & red end beacons
    if (mapId === 'night') {
      canvas.drawCircle(-halfL + 12, -halfW + 6, 4, p.runwayGreen);
      canvas.drawCircle(-halfL + 12, halfW - 6, 4, p.runwayGreen);
      canvas.drawCircle(halfL - 12, -halfW + 6, 4, p.runwayRed);
      canvas.drawCircle(halfL - 12, halfW - 6, 4, p.runwayRed);
    }

    canvas.restore();
  }
}

/**
 * Draw lush, detailed top-down trees with layered foliage, trunk detail,
 * palm fronds (tropical maps), drop shadows, and sunlit highlights.
 * Inspired by Sky Force Reloaded's island terrain vegetation.
 */
export function drawTrees(
  canvas: SkCanvas,
  trees: TerrainTree[],
  visible: (x: number, y: number, pad: number) => boolean,
  mapId: MapId,
) {
  const p = getPaints();
  const isPalm = mapId === 'desert' || mapId === 'canyon' || mapId === 'ocean';
  const isPine = mapId === 'arctic';

  // Step 1: Deep ground shadows for all trees (drawn first so canopies overlap them)
  for (const t of trees) {
    if (!visible(t.x, t.y, t.r + 35)) continue;
    // Large, soft elliptical shadow offset to bottom-right (sun from upper-left)
    p.treeShadowSoft.setAlphaf(0.32);
    canvas.drawOval(
      Skia.XYWHRect(
        t.x + t.r * 0.3 - t.r * 1.1,
        t.y + t.r * 0.5 - t.r * 0.7,
        t.r * 2.2,
        t.r * 1.4,
      ),
      p.treeShadowSoft,
    );
  }

  // Step 2: Tree canopies with rich detail
  for (const t of trees) {
    if (!visible(t.x, t.y, t.r + 35)) continue;
    const s = t.shade % 3;

    if (isPalm) {
      // --- Tropical Palm Tree ---
      // Trunk: visible diagonal woody trunk
      canvas.save();
      canvas.translate(t.x, t.y);
      // Thick trunk base
      const trunkAngle = (s * 0.4 - 0.2);
      canvas.drawLine(
        trunkAngle * t.r * 0.3, t.r * 0.4,
        -trunkAngle * t.r * 0.15, -t.r * 0.15,
        p.treeBark,
      );
      p.treeTrunk.setStrokeWidth(t.r * 0.22);
      p.treeTrunk.setStyle(PaintStyle.Stroke);
      p.treeTrunk.setStrokeCap(StrokeCap.Round);
      canvas.drawLine(
        trunkAngle * t.r * 0.25, t.r * 0.35,
        -trunkAngle * t.r * 0.1, -t.r * 0.1,
        p.treeTrunk,
      );
      p.treeTrunkLight.setStrokeWidth(t.r * 0.08);
      p.treeTrunkLight.setStyle(PaintStyle.Stroke);
      p.treeTrunkLight.setStrokeCap(StrokeCap.Round);
      canvas.drawLine(
        trunkAngle * t.r * 0.22, t.r * 0.3,
        -trunkAngle * t.r * 0.08, -t.r * 0.05,
        p.treeTrunkLight,
      );

      // Palm fronds: 6-8 elongated leaf blades radiating from crown center
      const numFronds = 6 + (s % 3);
      const crownX = -trunkAngle * t.r * 0.1;
      const crownY = -t.r * 0.15;
      for (let fi = 0; fi < numFronds; fi++) {
        const frondAngle = (fi / numFronds) * Math.PI * 2 + s * 0.3;
        const frondLen = t.r * (0.9 + (fi % 3) * 0.15);
        const tipX = crownX + Math.cos(frondAngle) * frondLen;
        const tipY = crownY + Math.sin(frondAngle) * frondLen;
        const midX = crownX + Math.cos(frondAngle) * frondLen * 0.55;
        const midY = crownY + Math.sin(frondAngle) * frondLen * 0.55;

        // Dark frond base
        p.treeFrondDark[s].setStrokeWidth(t.r * 0.28);
        p.treeFrondDark[s].setStyle(PaintStyle.Stroke);
        p.treeFrondDark[s].setStrokeCap(StrokeCap.Round);
        canvas.drawLine(crownX, crownY, midX, midY, p.treeFrondDark[s]);

        // Mid green frond
        p.treeFrondMid[s].setStrokeWidth(t.r * 0.2);
        p.treeFrondMid[s].setStyle(PaintStyle.Stroke);
        p.treeFrondMid[s].setStrokeCap(StrokeCap.Round);
        canvas.drawLine(midX, midY, tipX, tipY, p.treeFrondMid[s]);

        // Bright frond tip
        const tipEndX = crownX + Math.cos(frondAngle) * frondLen * 0.85;
        const tipEndY = crownY + Math.sin(frondAngle) * frondLen * 0.85;
        p.treeFrondLight[s].setStrokeWidth(t.r * 0.12);
        p.treeFrondLight[s].setStyle(PaintStyle.Stroke);
        p.treeFrondLight[s].setStrokeCap(StrokeCap.Round);
        canvas.drawLine(tipEndX, tipEndY, tipX, tipY, p.treeFrondLight[s]);
      }

      // Crown center tuft
      canvas.drawCircle(crownX, crownY, t.r * 0.18, p.treeFrondDark[s]);
      canvas.drawCircle(crownX, crownY, t.r * 0.1, p.treeFrondMid[s]);

      canvas.restore();
    } else if (isPine) {
      // --- Conifer / Pine ---
      // Pointed triangular silhouette with layered dark-to-light tiers
      const tiers = 3;
      for (let ti = 0; ti < tiers; ti++) {
        const tierFrac = ti / tiers;
        const tierR = t.r * (1.0 - tierFrac * 0.25);
        const tierY = t.y - tierFrac * t.r * 0.3;

        // Dark outer tier
        canvas.drawOval(
          Skia.XYWHRect(t.x - tierR, tierY - tierR * 0.7, tierR * 2, tierR * 1.4),
          p.treeDark[s],
        );
        // Mid tier
        canvas.drawOval(
          Skia.XYWHRect(t.x - tierR * 0.75, tierY - tierR * 0.5, tierR * 1.5, tierR * 1.0),
          p.treeMid[s],
        );
      }
      // Snow-capped or sunlit tip
      canvas.drawCircle(t.x - t.r * 0.15, t.y - t.r * 0.3, t.r * 0.3, p.treeLight[s]);
      // Trunk dot
      canvas.drawCircle(t.x, t.y + t.r * 0.3, t.r * 0.12, p.treeCore);
    } else {
      // --- Deciduous Oak / Broadleaf (lush tropical-style) ---
      // Deep shadow underlayer for 3D depth
      p.treeCanopyDeep.setAlphaf(0.7);
      canvas.drawCircle(t.x + t.r * 0.08, t.y + t.r * 0.1, t.r * 1.05, p.treeCanopyDeep);

      // Outer dark foliage mass with organic irregular edge (overlapping lobes)
      canvas.drawCircle(t.x, t.y, t.r, p.treeDark[s]);

      // 5 organic sub-canopy lobes for fluffy layered silhouette
      const numLobes = 5;
      for (let li = 0; li < numLobes; li++) {
        const lobeAngle = (li / numLobes) * Math.PI * 2 + s * 0.5;
        const lobeDist = t.r * 0.4;
        const lobeR = t.r * (0.52 + (li % 3) * 0.06);
        const lx = t.x + Math.cos(lobeAngle) * lobeDist;
        const ly = t.y + Math.sin(lobeAngle) * lobeDist;

        // Dark outer lobe
        canvas.drawCircle(lx, ly, lobeR, p.treeDark[s]);
        // Mid green inner lobe
        canvas.drawCircle(lx, ly, lobeR * 0.78, p.treeMid[s]);
      }

      // Inner vibrant leaf canopy (main mass)
      canvas.drawCircle(t.x, t.y, t.r * 0.78, p.treeMid[s]);

      // Secondary inner lobes for depth
      for (let li = 0; li < 3; li++) {
        const a2 = (li / 3) * Math.PI * 2 + s * 0.8 + 0.5;
        const d2 = t.r * 0.25;
        canvas.drawCircle(
          t.x + Math.cos(a2) * d2,
          t.y + Math.sin(a2) * d2,
          t.r * 0.45,
          p.treeMid[s],
        );
      }

      // Sunlit highlight crescent (upper-left, strong)
      canvas.drawCircle(t.x - t.r * 0.22, t.y - t.r * 0.22, t.r * 0.5, p.treeLight[s]);
      // Bright leaf tip highlights (smaller scattered)
      canvas.drawCircle(t.x - t.r * 0.35, t.y - t.r * 0.1, t.r * 0.22, p.treeHighlight);
      canvas.drawCircle(t.x - t.r * 0.1, t.y - t.r * 0.38, t.r * 0.18, p.treeHighlight);

      // Bright frond-like tips at the edge (simulate visible leaf clusters)
      for (let ti = 0; ti < 4; ti++) {
        const tipAngle = (ti / 4) * Math.PI * 2 + s * 0.7 + 0.3;
        const tipDist = t.r * 0.75;
        const tipR = t.r * 0.18;
        canvas.drawCircle(
          t.x + Math.cos(tipAngle) * tipDist,
          t.y + Math.sin(tipAngle) * tipDist,
          tipR,
          p.treeFrondLight[s],
        );
      }

      // Center trunk / core dark spot
      canvas.drawCircle(t.x, t.y, t.r * 0.14, p.treeCore);
    }
  }
}
