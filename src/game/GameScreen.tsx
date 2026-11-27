import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Canvas, createPicture, Picture, SkPicture } from '@shopify/react-native-skia';
import { useKeepAwake } from 'expo-keep-awake';
import { finishMatch, leaveToHome, useApp } from '../store/app';
import { GameEvent, IDLE_INPUT, Input } from '../sim/types';
import { SPECIALS } from '../sim/planes';
import { Controls } from './Controls';
import { Hud, KillFeedItem } from './Hud';
import { drawFrame, FxSystem } from './render';
import { Feedback } from './feedback';
import { findAutoFireTarget, findLockTarget } from '../sim/world';

const END_DELAY = 2.5;

export function GameScreen() {
  useKeepAwake();
  const session = useApp((s) => s.session);
  const sound = useApp((s) => s.sound);
  const vibration = useApp((s) => s.vibration);
  const inputRef = useRef<Input>(IDLE_INPUT);
  const { width, height } = useWindowDimensions();
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const [hudTick, setHudTick] = useState(0);
  const [feedView, setFeedView] = useState<KillFeedItem[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [autoFire, setAutoFire] = useState(true);
  const [autoFiring, setAutoFiring] = useState(false);
  const autoFireRef = useRef(true);
  const autoFiringRef = useRef(false);
  const feed = useRef<KillFeedItem[]>([]);
  const size = useRef({ width, height });
  useEffect(() => {
    size.current = { width, height };
  }, [width, height]);
  useEffect(() => {
    autoFireRef.current = autoFire;
  }, [autoFire]);

  useEffect(() => {
    if (!session) return;
    const fx = new FxSystem();
    const feedback = new Feedback(session, { sound, vibration });
    let shake = 0;
    let lastHp = -1;
    const cam = { x: session.world.config.arenaW / 2, y: session.world.config.arenaH / 2 };
    let last = performance.now();
    let raf = 0;
    let hudAcc = 0;
    let endTimer = -1;
    let time = 0;
    let running = true;

    const handleEvents = (events: GameEvent[]) => {
      if (!events.length) return;
      fx.push(events);
      const w = session.world;
      const name = (id: string | null) => (id ? w.planes.find((p) => p.id === id)?.name ?? '?' : null);
      const teamName = (t: number) => (t === 0 ? 'BLUE' : 'RED');
      for (const e of events) {
        if (e.t === 'hit') {
          const dist = Math.hypot(e.x - cam.x, e.y - cam.y);
          if (dist < 80) {
            const impact = Math.min(18, (e.dmg ?? 10) * 0.9);
            shake = Math.max(shake, impact);
          }
        }
        if (e.t === 'explode') {
          const dist = Math.hypot(e.x - cam.x, e.y - cam.y);
          if (dist < 420) {
            const prox = 1 - dist / 420;
            const blastShake = (e.big ? 18 : 9) * prox;
            shake = Math.max(shake, blastShake);
          }
        }
        if (e.t === 'flag' && e.action !== 'drop') {
          const who = name(e.by);
          const verb = e.action === 'take' ? 'took' : e.action === 'capture' ? 'CAPTURED' : 'returned';
          feed.current.unshift({
            key: `${time}-flag-${e.team}-${e.action}`,
            killer: null,
            victim: '',
            weapon: 'gun',
            text: who ? `⚑ ${who} ${verb} the ${teamName(e.team)} flag` : `⚑ ${teamName(e.team)} flag returned`,
            mine: e.by === session.myId,
            at: time,
          });
          feed.current = feed.current.slice(0, 5);
        }
        if (e.t !== 'kill') continue;
        feed.current.unshift({
          key: `${time}-${e.victim}`,
          killer: name(e.killer),
          victim: name(e.victim) ?? '?',
          weapon: e.weapon,
          mine: e.killer === session.myId || e.victim === session.myId,
          at: time,
        });
        feed.current = feed.current.slice(0, 5);
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;

      // Auto-Fire target evaluation for player's plane
      const mePlane = session.world.planes.find((p) => p.id === session.myId);
      if (mePlane && mePlane.alive) {
        const autoTarget = autoFireRef.current ? findAutoFireTarget(session.world, mePlane) : null;
        const inSights = autoTarget?.inSights ?? false;
        if (inSights !== autoFiringRef.current) {
          autoFiringRef.current = inSights;
          setAutoFiring(inSights);
        }
        const shouldFire = inputRef.current.fire || inSights;
        const curInput = session.getInput();
        if (curInput.fire !== shouldFire) {
          session.setInput({ ...curInput, fire: shouldFire });
        }
      }

      const events = session.update(dt);
      handleEvents(events);
      feedback.update(dt, events, inputRef.current, cam);
      fx.update(dt, session.world.planes);

      // Camera follows our plane smoothly.
      const me = session.world.planes.find((p) => p.id === session.myId);
      if (me && me.alive) {
        const pose = session.pose(me);
        const k = 1 - Math.exp(-dt * 8);
        cam.x += (pose.x - cam.x) * k;
        cam.y += (pose.y - cam.y) * k;
        if (lastHp >= 0 && me.hp < lastHp - 0.5) {
          const dmg = lastHp - me.hp;
          const hpShake = dmg >= 20 ? 16 : dmg >= 10 ? 11 : 6;
          shake = Math.max(shake, hpShake);
        }
        lastHp = me.hp;
      } else {
        lastHp = -1;
      }
      shake = Math.max(0, shake - dt * 25);
      const view = shake > 0 ? { x: cam.x + (Math.random() - 0.5) * shake * 2, y: cam.y + (Math.random() - 0.5) * shake * 2 } : cam;

      const { width: vw, height: vh } = size.current;
      setPicture(createPicture((c) => drawFrame(c, session, fx, view, vw, vh, time), { width: vw, height: vh }));

      hudAcc += dt;
      if (hudAcc > 0.1) {
        hudAcc = 0;
        feed.current = feed.current.filter((f) => time - f.at < 6);
        setHudTick((n) => (n + 1) % 1e6);
        setFeedView(feed.current);
      }

      if (session.world.ended) {
        if (endTimer < 0) endTimer = time;
        else if (time - endTimer > END_DELAY) {
          running = false;
          finishMatch();
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [session, sound, vibration]);

  if (!session) return null;
  const me = session.world.planes.find((p) => p.id === session.myId);

  return (
    <View style={{ flex: 1, backgroundColor: '#5aa9e6' }}>
      <Canvas style={StyleSheet.absoluteFill}>{picture ? <Picture picture={picture} /> : null}</Canvas>
      <Hud session={session} feed={feedView} tick={hudTick} />
      {!session.world.ended ? (
        <Controls
          width={width}
          height={height}
          missiles={me?.missiles ?? 0}
          specialLabel={me ? SPECIALS[me.type].label : ''}
          specialCd={me?.specialCd ?? 0}
          specialMax={me ? SPECIALS[me.type].cooldown : 1}
          autoFire={autoFire}
          autoFiring={autoFiring}
          hasMissileLock={me ? findLockTarget(session.world, me) !== null : false}
          onToggleAutoFire={() => setAutoFire((v) => !v)}
          onInput={(i: Input) => {
            inputRef.current = i;
            const mePlane = session.world.planes.find((p) => p.id === session.myId);
            const autoTarget = autoFireRef.current && mePlane ? findAutoFireTarget(session.world, mePlane) : null;
            const shouldFire = i.fire || (autoTarget?.inSights ?? false);
            session.setInput({ ...i, fire: shouldFire });
          }}
        />
      ) : null}
      <Pressable onPress={() => setConfirmLeave(true)} style={styles.menuBtn} hitSlop={10}>
        <Text style={styles.menuText}>II</Text>
      </Pressable>
      {confirmLeave ? (
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              {session.kind === 'host' ? 'End the match for everyone?' : 'Leave the match?'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable style={[styles.dialogBtn, { backgroundColor: '#1d4170' }]} onPress={() => setConfirmLeave(false)}>
                <Text style={styles.dialogBtnText}>RESUME</Text>
              </Pressable>
              <Pressable style={[styles.dialogBtn, { backgroundColor: '#ff4d4d' }]} onPress={leaveToHome}>
                <Text style={styles.dialogBtnText}>LEAVE</Text>
              </Pressable>
            </View>
            {session.kind !== 'solo' ? <Text style={styles.dialogNote}>The game keeps running while this is open.</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  menuBtn: { position: 'absolute', top: 10, left: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  menuText: { color: 'white', fontWeight: '900', fontSize: 14 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  dialog: { backgroundColor: '#14304f', padding: 20, borderRadius: 16, minWidth: 300, alignItems: 'center' },
  dialogTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  dialogBtn: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10 },
  dialogBtnText: { color: 'white', fontWeight: '900' },
  dialogNote: { color: '#9fb3c8', fontSize: 12, marginTop: 10 },
});
