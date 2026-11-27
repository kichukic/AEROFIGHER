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

export interface TerrainData {
  fields: TerrainField[];
  roads: TerrainRoad[];
  runway: TerrainRunway | null;
  trees: TerrainTree[];
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
  let runway: TerrainRunway | null = null;

  // 1. Farmland fields / grid parcels
  if (mapId === 'farmland' || mapId === 'ocean' || mapId === 'desert' || mapId === 'canyon' || mapId === 'night') {
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
  if (mapId === 'farmland' || mapId === 'night' || mapId === 'ocean') {
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

  const result: TerrainData = { fields, roads, runway, trees };
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
  treeDark: SkPaint[];
  treeMid: SkPaint[];
  treeLight: SkPaint[];
  treeCore: SkPaint;
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
    // 3 tones of green for varied lush forest canopies
    treeDark: [paint('#1c4217'), paint('#183d21'), paint('#254714')],
    treeMid: [paint('#3c802b'), paint('#32753a'), paint('#4c8a29')],
    treeLight: [paint('#62b047'), paint('#53a85b'), paint('#74bd41')],
    treeCore: paint('#152812', 0, 0.8),
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

    canvas.restore();
  }
}

/**
 * Draw 2D cartoon top-down trees with drop shadows, foliage layers, and sunlit leaf highlights.
 */
export function drawTrees(
  canvas: SkCanvas,
  trees: TerrainTree[],
  visible: (x: number, y: number, pad: number) => boolean,
  mapId: MapId,
) {
  const p = getPaints();

  // Step 1: Shadows first so all tree canopies cleanly overlap shadows
  for (const t of trees) {
    if (!visible(t.x, t.y, t.r + 30)) continue;
    canvas.drawCircle(t.x + t.r * 0.45, t.y + t.r * 0.65, t.r * 0.92, p.shadow);
  }

  // Step 2: Foliage canopies
  for (const t of trees) {
    if (!visible(t.x, t.y, t.r + 30)) continue;
    const s = t.shade % 3;

    // Outer dark foliage base
    canvas.drawCircle(t.x, t.y, t.r, p.treeDark[s]);

    // Secondary cute leaf lobes around the rim for fluffy organic silhouette
    const lobeDist = t.r * 0.48;
    canvas.drawCircle(t.x - lobeDist, t.y - lobeDist * 0.3, t.r * 0.52, p.treeDark[s]);
    canvas.drawCircle(t.x + lobeDist * 0.8, t.y - lobeDist * 0.4, t.r * 0.48, p.treeDark[s]);
    canvas.drawCircle(t.x + lobeDist * 0.2, t.y + lobeDist * 0.8, t.r * 0.5, p.treeDark[s]);

    // Inner vibrant leaf canopy
    canvas.drawCircle(t.x, t.y, t.r * 0.82, p.treeMid[s]);
    canvas.drawCircle(t.x - lobeDist * 0.8, t.y - lobeDist * 0.3, t.r * 0.4, p.treeMid[s]);

    // Sunlit leaf highlight crescent (upper-left)
    canvas.drawCircle(t.x - t.r * 0.24, t.y - t.r * 0.24, t.r * 0.46, p.treeLight[s]);

    // Center tree crown core
    canvas.drawCircle(t.x, t.y, t.r * 0.16, p.treeCore);
  }
}
