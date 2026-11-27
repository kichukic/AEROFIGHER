import { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { Input } from '../sim/types';

const STICK_R = 65;
const FIRE = { r: 46, side: 24, bottom: 48 };
const MISSILE = { r: 34 };
const SPECIAL_R = 34;
const AUTO_R = 26;

interface Props {
  width: number;
  height: number;
  onInput: (i: Input) => void;
  missiles: number;
  specialLabel: string;
  specialCd: number; // seconds until ready
  specialMax: number;
  autoFire?: boolean;
  autoFiring?: boolean;
  onToggleAutoFire?: () => void;
  hasMissileLock?: boolean;
}

/**
 * Multi-touch controls:
 *  - Right side: anchored fixed-base joystick with clear physical boundaries and immediate response.
 *  - Left side: FIRE (hold), MISSILE, and SPECIAL buttons.
 */
export function Controls({ width, height, onInput, missiles, specialLabel, specialCd, specialMax, autoFire = true, autoFiring = false, onToggleAutoFire, hasMissileLock = false }: Props) {
  const isLandscape = width > height;

  // Default resting position when idle:
  // In landscape: Left side of screen for left thumb
  // In portrait: Right side of screen for right thumb
  const defaultBase = isLandscape
    ? { x: 120, y: height - 105 }
    : { x: width - 105, y: height - 120 };

  const state = useRef({
    stickId: null as string | null,
    base: { x: defaultBase.x, y: defaultBase.y },
    knob: { x: defaultBase.x, y: defaultBase.y },
    fireIds: new Set<string>(),
    missileIds: new Set<string>(),
    specialIds: new Set<string>(),
    input: { aim: null, throttle: 0.65, fire: false, missile: false, special: false } as Input,
  });

  const [view, setView] = useState<{
    active: boolean;
    bx: number;
    by: number;
    kx: number;
    ky: number;
    fire: boolean;
    missile: boolean;
    special: boolean;
  }>({
    active: false,
    bx: defaultBase.x,
    by: defaultBase.y,
    kx: defaultBase.x,
    ky: defaultBase.y,
    fire: false,
    missile: false,
    special: false,
  });

  const redraw = () => {
    const s = state.current;
    setView({
      active: s.stickId !== null,
      bx: s.base.x,
      by: s.base.y,
      kx: s.knob.x,
      ky: s.knob.y,
      fire: s.fireIds.size > 0,
      missile: s.missileIds.size > 0,
      special: s.specialIds.size > 0,
    });
  };

  // Keep joystick base anchored to new orientation default when idle
  useEffect(() => {
    if (state.current.stickId === null) {
      state.current.base = { x: defaultBase.x, y: defaultBase.y };
      state.current.knob = { x: defaultBase.x, y: defaultBase.y };
      redraw();
    }
  }, [defaultBase.x, defaultBase.y]);

  // Button cluster layout:
  // In landscape: cluster is on the bottom-right for right thumb!
  // In portrait: cluster is on the bottom-left for left thumb!
  const fireC = isLandscape
    ? { x: width - FIRE.side - FIRE.r - 20, y: height - FIRE.bottom - FIRE.r + 10 }
    : { x: FIRE.side + FIRE.r, y: height - FIRE.bottom - FIRE.r };
  const misC = isLandscape ? { x: fireC.x - 108, y: fireC.y + 12 } : { x: fireC.x + 108, y: fireC.y + 14 };
  const spC = isLandscape ? { x: fireC.x - 8, y: fireC.y - 104 } : { x: fireC.x + 6, y: fireC.y - 108 };
  const autoC = isLandscape ? { x: fireC.x - 94, y: fireC.y - 68 } : { x: fireC.x + 94, y: fireC.y - 72 };
  const inCircle = (x: number, y: number, c: { x: number; y: number }, r: number) => (x - c.x) ** 2 + (y - c.y) ** 2 <= (r + 18) ** 2;

  const emit = () => {
    const s = state.current;
    if (s.stickId !== null) {
      const dx = s.knob.x - s.base.x;
      const dy = s.knob.y - s.base.y;
      const dist = Math.hypot(dx, dy);
      const rawMag = Math.min(1, dist / STICK_R);
      const DEADZONE = 0.12;
      if (rawMag > DEADZONE) {
        const norm = (rawMag - DEADZONE) / (1 - DEADZONE);
        const curvedMag = Math.pow(norm, 1.25);
        s.input = {
          aim: Math.atan2(dy, dx),
          throttle: 0.50 + 0.45 * curvedMag,
          fire: s.fireIds.size > 0,
          missile: s.missileIds.size > 0,
          special: s.specialIds.size > 0,
        };
      } else {
        s.input = {
          aim: null,
          throttle: 0.65,
          fire: s.fireIds.size > 0,
          missile: s.missileIds.size > 0,
          special: s.specialIds.size > 0,
        };
      }
    } else {
      s.input = { aim: null, throttle: 0.65, fire: s.fireIds.size > 0, missile: s.missileIds.size > 0, special: s.specialIds.size > 0 };
    }
    onInput(s.input);
  };

  const onStart = (e: GestureResponderEvent) => {
    const s = state.current;
    for (const t of e.nativeEvent.changedTouches) {
      const id = String(t.identifier);
      const x = t.pageX;
      const y = t.pageY;
      if (inCircle(x, y, autoC, AUTO_R)) onToggleAutoFire?.();
      else if (inCircle(x, y, fireC, FIRE.r)) s.fireIds.add(id);
      else if (inCircle(x, y, misC, MISSILE.r)) s.missileIds.add(id);
      else if (inCircle(x, y, spC, SPECIAL_R)) s.specialIds.add(id);
      else if (s.stickId === null && (isLandscape ? x < width * 0.62 : (x > width * 0.32 || y < height - 190))) {
        // Dynamic touch-down floating joystick: base spawns immediately under your finger!
        s.stickId = id;
        s.base = { x, y };
        s.knob = { x, y };
      }
    }
    emit();
    redraw();
  };

  const onMove = (e: GestureResponderEvent) => {
    const s = state.current;
    if (s.stickId === null) return;
    for (const t of e.nativeEvent.touches) {
      if (String(t.identifier) !== s.stickId) continue;
      const dx = t.pageX - s.base.x;
      const dy = t.pageY - s.base.y;
      const d = Math.hypot(dx, dy);

      // Smooth floating stick: if user drags past stick boundary, slide the base
      // so reversing direction is instantaneous from wherever the thumb currently is!
      if (d > STICK_R) {
        s.base.x = t.pageX - (dx / d) * STICK_R;
        s.base.y = t.pageY - (dy / d) * STICK_R;
        s.knob = { x: t.pageX, y: t.pageY };
      } else {
        s.knob = { x: t.pageX, y: t.pageY };
      }
    }
    emit();
    redraw();
  };

  const onEnd = (e: GestureResponderEvent) => {
    const s = state.current;
    for (const t of e.nativeEvent.changedTouches) {
      const id = String(t.identifier);
      s.fireIds.delete(id);
      s.missileIds.delete(id);
      s.specialIds.delete(id);
      if (id === s.stickId) {
        s.stickId = null;
        s.base = { x: defaultBase.x, y: defaultBase.y };
        s.knob = { x: defaultBase.x, y: defaultBase.y };
      }
    }
    // Safety: if no touches remain, release everything.
    if (e.nativeEvent.touches.length === 0) {
      s.fireIds.clear();
      s.missileIds.clear();
      s.specialIds.clear();
      s.stickId = null;
      s.base = { x: defaultBase.x, y: defaultBase.y };
      s.knob = { x: defaultBase.x, y: defaultBase.y };
    }
    emit();
    redraw();
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onStart}
      onResponderStart={onStart}
      onResponderMove={onMove}
      onResponderEnd={onEnd}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
    >
      {/* Dynamic Floating Flight Joystick */}
      <View
        pointerEvents="none"
        style={[
          styles.base,
          {
            left: view.bx - STICK_R,
            top: view.by - STICK_R,
            opacity: view.active ? 1 : 0.45,
            borderColor: view.active ? '#4cc9f0' : 'rgba(255,255,255,0.3)',
            backgroundColor: view.active ? 'rgba(76,201,240,0.12)' : 'rgba(0,0,0,0.22)',
          },
        ]}
      >
        {/* Cardinal tick marks */}
        <View style={[styles.tick, { top: 3, left: STICK_R - 1, width: 2, height: 7 }]} />
        <View style={[styles.tick, { bottom: 3, left: STICK_R - 1, width: 2, height: 7 }]} />
        <View style={[styles.tick, { left: 3, top: STICK_R - 1, width: 7, height: 2 }]} />
        <View style={[styles.tick, { right: 3, top: STICK_R - 1, width: 7, height: 2 }]} />
        <View style={styles.centerDot} />
        {!view.active ? <Text style={styles.steerLabel}>TOUCH TO STEER</Text> : null}
      </View>

      {/* Dynamic knob */}
      <View
        pointerEvents="none"
        style={[
          styles.knob,
          {
            left: view.kx - 26,
            top: view.ky - 26,
            opacity: view.active ? 1 : 0.5,
            borderColor: view.active ? '#4cc9f0' : 'rgba(255,255,255,0.7)',
            backgroundColor: view.active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)',
            transform: [{ scale: view.active ? 1.08 : 0.85 }],
          },
        ]}
      >
        <View style={styles.knobInner} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.btn,
          {
            width: FIRE.r * 2,
            height: FIRE.r * 2,
            borderRadius: FIRE.r,
            left: fireC.x - FIRE.r,
            top: fireC.y - FIRE.r,
            borderColor: autoFiring ? '#ff4d4d' : undefined,
          },
          (view.fire || autoFiring) && styles.btnDown,
        ]}
      >
        <Text style={[styles.btnText, { fontSize: 13 }]}>{autoFiring ? 'LOCKED 🔥' : '💥 CANNON'}</Text>
      </View>
      {/* Auto-Fire Toggle */}
      <View
        pointerEvents="none"
        style={[
          styles.btn,
          styles.autoBtn,
          {
            width: AUTO_R * 2,
            height: AUTO_R * 2,
            borderRadius: AUTO_R,
            left: autoC.x - AUTO_R,
            top: autoC.y - AUTO_R,
            borderColor: autoFiring ? '#ff4d4d' : autoFire ? '#00f5d4' : 'rgba(255,255,255,0.3)',
            backgroundColor: autoFiring ? 'rgba(255,77,77,0.35)' : autoFire ? 'rgba(0,245,212,0.22)' : 'rgba(10,25,45,0.6)',
          },
        ]}
      >
        <Text style={[styles.btnTextSmall, { fontSize: 10, fontWeight: '900', color: autoFiring ? '#ff4d4d' : autoFire ? '#00f5d4' : 'rgba(255,255,255,0.45)' }]}>
          {autoFiring ? 'TARGET' : '🎯 AUTO'}
        </Text>
        <Text style={[styles.btnTextSmall, { fontSize: 8, color: autoFiring ? '#ffb703' : autoFire ? '#00f5d4' : 'rgba(255,255,255,0.35)' }]}>
          {autoFiring ? 'FIRE 🔥' : autoFire ? 'ON' : 'OFF'}
        </Text>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.btn, styles.missileBtn,
          {
            width: MISSILE.r * 2,
            height: MISSILE.r * 2,
            borderRadius: MISSILE.r,
            left: misC.x - MISSILE.r,
            top: misC.y - MISSILE.r,
            borderColor: hasMissileLock && missiles > 0 ? '#ff3b3b' : undefined,
            backgroundColor: hasMissileLock && missiles > 0 ? 'rgba(255,59,59,0.35)' : undefined,
          },
          view.missile && styles.btnDown, missiles === 0 && styles.btnEmpty,
        ]}
      >
        <Text style={[styles.btnTextSmall, hasMissileLock && missiles > 0 ? { color: '#ffb703', fontWeight: '900' } : null]}>
          {hasMissileLock && missiles > 0 ? '🎯 LOCK' : '🚀 MSL'}
        </Text>
        <Text style={styles.btnTextSmall}>{missiles}</Text>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.btn, styles.specialBtn,
          { width: SPECIAL_R * 2, height: SPECIAL_R * 2, borderRadius: SPECIAL_R, left: spC.x - SPECIAL_R, top: spC.y - SPECIAL_R },
          view.special && styles.btnDown, specialCd > 0 && styles.btnEmpty,
        ]}
      >
        {specialCd > 0 ? (
          <View style={[styles.cdFill, { height: `${Math.min(100, (specialCd / specialMax) * 100)}%` }]} />
        ) : null}
        <Text style={styles.btnTextSmall}>
          {specialLabel === 'DASH' ? '⚡ DASH' : specialLabel === 'FLARE' ? '🛡️ FLARE' : '💥 FLAK'}
        </Text>
        {specialCd > 0 ? <Text style={styles.btnTextSmall}>{Math.ceil(specialCd)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    width: STICK_R * 2,
    height: STICK_R * 2,
    borderRadius: STICK_R,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 1,
  },
  centerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  steerLabel: {
    position: 'absolute',
    bottom: STICK_R - 22,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  knob: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00e5ff',
    opacity: 0.9,
  },
  btn: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(230,57,70,0.65)', borderWidth: 2.5, borderColor: 'rgba(0,229,255,0.6)' },
  autoBtn: { backgroundColor: 'rgba(5,15,30,0.75)', borderWidth: 2.2 },
  missileBtn: { backgroundColor: 'rgba(255,170,0,0.65)', borderColor: 'rgba(255,210,63,0.7)' },
  specialBtn: { backgroundColor: 'rgba(0,229,255,0.65)', borderColor: 'rgba(0,245,212,0.8)', overflow: 'hidden' },
  cdFill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  btnDown: { transform: [{ scale: 0.92 }], backgroundColor: 'rgba(255,255,255,0.55)' },
  btnEmpty: { opacity: 0.4 },
  btnText: { color: 'white', fontWeight: '900', fontSize: 16 },
  btnTextSmall: { color: 'white', fontWeight: '900', fontSize: 12 },
});
