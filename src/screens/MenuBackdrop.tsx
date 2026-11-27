import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Canvas,
  createPicture,
  PaintStyle,
  Picture,
  Skia,
  SkPaint,
  SkPicture,
  TileMode,
} from '@shopify/react-native-skia';

interface BackdropPaints {
  grid: SkPaint;
  gridBold: SkPaint;
  ring: SkPaint;
  sweep: SkPaint;
  cloud: SkPaint;
  contrail: SkPaint;
  jet: SkPaint;
  pip: SkPaint;
  bracket: SkPaint;
}

let cached: BackdropPaints | null = null;

function makePaint(color: string, stroke = 0, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (stroke > 0) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
  }
  p.setAlphaf(alpha);
  return p;
}

function getPaints(): BackdropPaints {
  if (cached) return cached;
  cached = {
    grid: makePaint('#00e5ff', 1, 0.055),
    gridBold: makePaint('#00e5ff', 1, 0.11),
    ring: makePaint('#00e5ff', 1, 0.08),
    sweep: makePaint('#00f5d4', 1.5, 0.16),
    cloud: makePaint('#7dd3fc', 0, 0.045),
    contrail: makePaint('#00e5ff', 1.5, 0.14),
    jet: makePaint('#38bdf8', 0, 0.22),
    pip: makePaint('#ffd23f', 0, 0.35),
    bracket: makePaint('#00e5ff', 1.5, 0.28),
  };
  return cached;
}

/**
 * Animated tactical radar & high-altitude sky backdrop for the main menu.
 */
export function MenuBackdrop() {
  const { width, height } = useWindowDimensions();
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    let alive = true;
    const p = getPaints();
    const bgPaint = Skia.Paint();
    bgPaint.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: 0, y: 0 },
        { x: 0, y: height },
        [Skia.Color('#020712'), Skia.Color('#06142a'), Skia.Color('#030915')],
        [0, 0.45, 1],
        TileMode.Clamp,
      ),
    );

    const t0 = performance.now();
    let lastDraw = 0;

    const tick = (now: number) => {
      if (!alive) return;
      // 24 FPS is plenty for a subtle ambient menu backdrop
      if (now - lastDraw >= 40) {
        lastDraw = now;
        const t = (now - t0) / 1000;
        const pic = createPicture(
          (canvas) => {
            canvas.drawRect(Skia.XYWHRect(0, 0, width, height), bgPaint);

            // Tactical coordinate grid
            const step = 44;
            for (let x = 0; x < width; x += step) {
              canvas.drawLine(x, 0, x, height, (x / step) % 4 === 0 ? p.gridBold : p.grid);
            }
            for (let y = 0; y < height; y += step) {
              canvas.drawLine(0, y, width, y, (y / step) % 4 === 0 ? p.gridBold : p.grid);
            }

            // Concentric radar rings centered behind the hangar
            const rcx = width * 0.5;
            const rcy = height * 0.44;
            const maxR = Math.min(width, height) * 0.65;
            for (let i = 1; i <= 4; i++) {
              canvas.drawCircle(rcx, rcy, (maxR * i) / 4, p.ring);
            }

            // Rotating radar sweep beam
            const sweepAngle = t * 0.45;
            canvas.drawLine(
              rcx,
              rcy,
              rcx + Math.cos(sweepAngle) * maxR,
              rcy + Math.sin(sweepAngle) * maxR,
              p.sweep,
            );

            // Subtle radar target blips
            for (let bi = 0; bi < 3; bi++) {
              const ba = bi * 2.1 + 0.4;
              const br = maxR * (0.35 + bi * 0.22);
              const bx = rcx + Math.cos(ba) * br;
              const by = rcy + Math.sin(ba) * br;
              const pulse = 0.2 + 0.25 * Math.max(0, Math.sin(t * 2.5 - bi));
              p.pip.setAlphaf(pulse);
              canvas.drawCircle(bx, by, 3, p.pip);
            }

            // Drifting ambient cloud silhouettes
            for (let ci = 0; ci < 5; ci++) {
              const speed = 8 + ci * 3;
              const cx = ((ci * 173 + t * speed) % (width + 180)) - 90;
              const cy = height * (0.14 + ci * 0.17);
              const cr = 34 + (ci % 3) * 14;
              canvas.drawCircle(cx, cy, cr, p.cloud);
              canvas.drawCircle(cx + cr * 0.65, cy + 5, cr * 0.72, p.cloud);
              canvas.drawCircle(cx - cr * 0.6, cy + 6, cr * 0.65, p.cloud);
            }

            // Distant patrol jet flyby with contrail
            const jetSpan = width + 220;
            const jx = ((t * 48) % jetSpan) - 110;
            const jy = height * 0.22 + Math.sin(t * 0.5) * 14;
            canvas.drawLine(jx - 85, jy - 3, jx - 8, jy - 3, p.contrail);
            canvas.drawLine(jx - 85, jy + 3, jx - 8, jy + 3, p.contrail);
            const jetPath = Skia.Path.MakeFromSVGString(
              `M ${jx + 10} ${jy} L ${jx - 6} ${jy - 7} L ${jx - 3} ${jy} L ${jx - 6} ${jy + 7} Z`,
            );
            if (jetPath) canvas.drawPath(jetPath, p.jet);

            // Outer HUD corner brackets
            const pad = 8;
            const len = 18;
            canvas.drawLine(pad, pad, pad + len, pad, p.bracket);
            canvas.drawLine(pad, pad, pad, pad + len, p.bracket);
            canvas.drawLine(width - pad, pad, width - pad - len, pad, p.bracket);
            canvas.drawLine(width - pad, pad, width - pad, pad + len, p.bracket);
            canvas.drawLine(pad, height - pad, pad + len, height - pad, p.bracket);
            canvas.drawLine(pad, height - pad, pad, height - pad - len, p.bracket);
            canvas.drawLine(width - pad, height - pad, width - pad - len, height - pad, p.bracket);
            canvas.drawLine(width - pad, height - pad, width - pad, height - pad - len, p.bracket);
          },
          { width, height },
        );
        setPicture(pic);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>{picture ? <Picture picture={picture} /> : null}</Canvas>
    </View>
  );
}
