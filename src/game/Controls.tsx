import { useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { Input } from '../sim/types';

const STICK_R = 60;
const FIRE = { r: 46, side: 24, bottom: 48 };
const MISSILE = { r: 34 };
const SPECIAL_R = 34;

interface Props {
  width: number;
  height: number;
  onInput: (i: Input) => void;
  missiles: number;
  specialLabel: string;
  specialCd: number; // seconds until ready
  specialMax: number;
}

/**
 * Multi-touch controls using raw touch events:
 *  - Right side: floating joystick (direction = heading, distance = throttle).
 *  - Left side: FIRE (hold), MISSILE and SPECIAL buttons.
 */
export function Controls({ width, height, onInput, missiles, specialLabel, specialCd, specialMax }: Props) {
  const state = useRef({
    stickId: null as string | null,
    origin: { x: 0, y: 0 },
    knob: { x: 0, y: 0 },
    fireIds: new Set<string>(),
    missileIds: new Set<string>(),
    specialIds: new Set<string>(),
    input: { aim: null, throttle: 0.5, fire: false, missile: false, special: false } as Input,
  });
  const [view, setView] = useState<{ stick: { ox: number; oy: number; kx: number; ky: number } | null; fire: boolean; missile: boolean; special: boolean }>({
    stick: null, fire: false, missile: false, special: false,
  });
  const redraw = () => {
    const s = state.current;
    setView({
      stick: s.stickId !== null ? { ox: s.origin.x, oy: s.origin.y, kx: s.knob.x, ky: s.knob.y } : null,
      fire: s.fireIds.size > 0,
      missile: s.missileIds.size > 0,
      special: s.specialIds.size > 0,
    });
  };

  // Left thumb cluster, bottom-left: FIRE in the corner, MISSILE to its right, SPECIAL above it.
  const fireC = { x: FIRE.side + FIRE.r, y: height - FIRE.bottom - FIRE.r };
  const misC = { x: fireC.x + 108, y: fireC.y + 14 };
  const spC = { x: fireC.x + 6, y: fireC.y - 108 };
  const inCircle = (x: number, y: number, c: { x: number; y: number }, r: number) => (x - c.x) ** 2 + (y - c.y) ** 2 <= (r + 18) ** 2;

  const emit = () => {
    const s = state.current;
    if (s.stickId !== null) {
      const dx = s.knob.x - s.origin.x;
      const dy = s.knob.y - s.origin.y;
      const mag = Math.min(1, Math.hypot(dx, dy) / STICK_R);
      s.input = {
        aim: mag > 0.15 ? Math.atan2(dy, dx) : null,
        // Light push = slow & tight turns, full push = full speed.
        throttle: mag > 0.15 ? 0.2 + 0.8 * mag : 0.5,
        fire: s.fireIds.size > 0,
        missile: s.missileIds.size > 0,
        special: s.specialIds.size > 0,
      };
    } else {
      s.input = { aim: null, throttle: 0.5, fire: s.fireIds.size > 0, missile: s.missileIds.size > 0, special: s.specialIds.size > 0 };
    }
    onInput(s.input);
  };

  const onStart = (e: GestureResponderEvent) => {
    const s = state.current;
    for (const t of e.nativeEvent.changedTouches) {
      const id = String(t.identifier);
      const x = t.pageX;
      const y = t.pageY;
      if (inCircle(x, y, fireC, FIRE.r)) s.fireIds.add(id);
      else if (inCircle(x, y, misC, MISSILE.r)) s.missileIds.add(id);
      else if (inCircle(x, y, spC, SPECIAL_R)) s.specialIds.add(id);
      else if (x > width * 0.42 && s.stickId === null) {
        s.stickId = id;
        s.origin = { x, y };
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
      let dx = t.pageX - s.origin.x;
      let dy = t.pageY - s.origin.y;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        // Drag the base along so the stick never "runs out".
        const over = d - STICK_R;
        s.origin.x += (dx / d) * over;
        s.origin.y += (dy / d) * over;
        dx = t.pageX - s.origin.x;
        dy = t.pageY - s.origin.y;
      }
      s.knob = { x: s.origin.x + dx, y: s.origin.y + dy };
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
      if (id === s.stickId) s.stickId = null;
    }
    // Safety: if no touches remain, release everything.
    if (e.nativeEvent.touches.length === 0) {
      s.fireIds.clear();
      s.missileIds.clear();
      s.specialIds.clear();
      s.stickId = null;
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
      {view.stick ? (
        <>
          <View pointerEvents="none" style={[styles.base, { left: view.stick.ox - STICK_R, top: view.stick.oy - STICK_R }]} />
          <View pointerEvents="none" style={[styles.knob, { left: view.stick.kx - 26, top: view.stick.ky - 26 }]} />
        </>
      ) : (
        <View pointerEvents="none" style={[styles.hint, { right: 24, top: height - 150 }]}>
          <Text style={styles.hintText}>Drag to fly</Text>
        </View>
      )}
      <View
        pointerEvents="none"
        style={[styles.btn, { width: FIRE.r * 2, height: FIRE.r * 2, borderRadius: FIRE.r, left: fireC.x - FIRE.r, top: fireC.y - FIRE.r }, view.fire && styles.btnDown]}
      >
        <Text style={styles.btnText}>FIRE</Text>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.btn, styles.missileBtn,
          { width: MISSILE.r * 2, height: MISSILE.r * 2, borderRadius: MISSILE.r, left: misC.x - MISSILE.r, top: misC.y - MISSILE.r },
          view.missile && styles.btnDown, missiles === 0 && styles.btnEmpty,
        ]}
      >
        <Text style={styles.btnTextSmall}>MSL</Text>
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
        <Text style={styles.btnTextSmall}>{specialLabel}</Text>
        {specialCd > 0 ? <Text style={styles.btnTextSmall}>{Math.ceil(specialCd)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { position: 'absolute', width: STICK_R * 2, height: STICK_R * 2, borderRadius: STICK_R, backgroundColor: 'rgba(0,0,0,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  knob: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.75)' },
  hint: { position: 'absolute', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)' },
  hintText: { color: 'white', fontWeight: '600' },
  btn: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(230,57,70,0.6)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)' },
  missileBtn: { backgroundColor: 'rgba(255,159,28,0.6)' },
  specialBtn: { backgroundColor: 'rgba(76,201,240,0.65)', overflow: 'hidden' },
  cdFill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  btnDown: { transform: [{ scale: 0.92 }], backgroundColor: 'rgba(255,255,255,0.55)' },
  btnEmpty: { opacity: 0.4 },
  btnText: { color: 'white', fontWeight: '900', fontSize: 16 },
  btnTextSmall: { color: 'white', fontWeight: '900', fontSize: 12 },
});
