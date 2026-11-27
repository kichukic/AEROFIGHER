import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import {
  Canvas,
  createPicture,
  PaintStyle,
  Picture,
  Skia,
  SkPaint,
  SkPicture,
  StrokeCap,
} from '@shopify/react-native-skia';
import { PlaneType } from '../sim/types';
import { drawPlane, drawPlaneShadow } from '../game/planeArt';
import { theme } from './ui';

interface PlaneCanvasProps {
  type: PlaneType;
  color?: string;
  size?: number;
  animated?: boolean;
  showHangarRing?: boolean;
  style?: ViewStyle;
}

const PLANE_COLORS: Record<PlaneType, string> = {
  interceptor: '#00e5ff',
  fighter: '#ffd23f',
  bomber: '#ff3b3b',
  stealth: '#c084fc',
  gunship: '#10b981',
};

interface HangarPaints {
  ringPaint: SkPaint;
  dashedRingPaint: SkPaint;
  crossPaint: SkPaint;
  sweepPaint: SkPaint;
}

let cachedPaints: HangarPaints | null = null;

function getHangarPaints(): HangarPaints {
  if (cachedPaints) return cachedPaints;

  const ringPaint = Skia.Paint();
  ringPaint.setAntiAlias(true);
  ringPaint.setStyle(PaintStyle.Stroke);
  ringPaint.setStrokeWidth(1.5);
  ringPaint.setColor(Skia.Color('rgba(0, 229, 255, 0.25)'));

  const dashedRingPaint = Skia.Paint();
  dashedRingPaint.setAntiAlias(true);
  dashedRingPaint.setStyle(PaintStyle.Stroke);
  dashedRingPaint.setStrokeWidth(1);
  dashedRingPaint.setColor(Skia.Color('rgba(255, 210, 63, 0.3)'));
  dashedRingPaint.setPathEffect(Skia.PathEffect.MakeDash([4, 6], 0));

  const crossPaint = Skia.Paint();
  crossPaint.setAntiAlias(true);
  crossPaint.setStyle(PaintStyle.Stroke);
  crossPaint.setStrokeWidth(1);
  crossPaint.setStrokeCap(StrokeCap.Round);
  crossPaint.setColor(Skia.Color('rgba(0, 229, 255, 0.35)'));

  const sweepPaint = Skia.Paint();
  sweepPaint.setAntiAlias(true);
  sweepPaint.setStyle(PaintStyle.Stroke);
  sweepPaint.setStrokeWidth(1.2);
  sweepPaint.setColor(Skia.Color('rgba(0, 245, 212, 0.4)'));

  cachedPaints = { ringPaint, dashedRingPaint, crossPaint, sweepPaint };
  return cachedPaints;
}

export function PlaneCanvas({
  type,
  color,
  size = 140,
  animated = false,
  showHangarRing = true,
  style,
}: PlaneCanvasProps) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const activeColor = color ?? PLANE_COLORS[type] ?? theme.accent;
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const paints = getHangarPaints();
    const cx = size / 2;
    const cy = size / 2;
    // Appropriate scale based on plane design dimensions in unit space
    const planeScale = size / 3.4;

    const renderFrame = (t: number) => {
      const hoverY = animated ? Math.sin(t * 2.8) * (size * 0.035) : 0;
      const bank = animated ? Math.sin(t * 1.8) * 0.12 : 0;
      const throttle = animated ? 0.85 + Math.sin(t * 12) * 0.15 : 0.85;

      const pic = createPicture(
        (canvas) => {
          if (showHangarRing) {
            const r1 = size * 0.44;
            const r2 = size * 0.32;

            // Turntable circular rings
            canvas.drawCircle(cx, cy, r1, paints.ringPaint);
            canvas.drawCircle(cx, cy, r2, paints.dashedRingPaint);

            // Crosshair tick marks
            const tick = size * 0.08;
            canvas.drawLine(cx - r1, cy, cx - r1 + tick, cy, paints.crossPaint);
            canvas.drawLine(cx + r1, cy, cx + r1 - tick, cy, paints.crossPaint);
            canvas.drawLine(cx, cy - r1, cx, cy - r1 + tick, paints.crossPaint);
            canvas.drawLine(cx, cy + r1, cx, cy + r1 - tick, paints.crossPaint);

            // Rotating sweep scanner angle line
            if (animated) {
              const sweepAngle = (t * 1.2) % (Math.PI * 2);
              const sx = cx + Math.cos(sweepAngle) * r1;
              const sy = cy + Math.sin(sweepAngle) * r1;
              canvas.drawLine(cx, cy, sx, sy, paints.sweepPaint);
            }
          }

          // Soft drop shadow underneath plane
          drawPlaneShadow(canvas, type, cx, cy + hoverY + 6, -Math.PI / 2, planeScale, bank);

          // Plane body rotated nose-up (-90 deg = -PI/2)
          drawPlane(
            canvas,
            type,
            cx,
            cy + hoverY,
            -Math.PI / 2,
            planeScale,
            activeColor,
            throttle,
            t,
            bank,
            false
          );
        },
        { width: size, height: size }
      );

      if (mountedRef.current) {
        setPicture(pic);
      }
    };

    if (!animated) {
      // Single static render
      renderFrame(1.0);
      return () => {
        mountedRef.current = false;
      };
    }

    let lastTime = 0;
    const targetFps = 35; // buttery smooth in menus while staying super battery-efficient
    const frameInterval = 1000 / targetFps;

    const loop = (timestamp: number) => {
      if (!mountedRef.current) return;
      if (timestamp - lastTime >= frameInterval) {
        lastTime = timestamp;
        renderFrame(timestamp / 1000);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [type, activeColor, size, animated, showHangarRing]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Canvas style={StyleSheet.absoluteFill}>
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
    </View>
  );
}
