import { Vibration } from 'react-native';
import { angleDiff } from '../sim/math';
import { PLANES } from '../sim/planes';
import { GameEvent, Input, PlaneType } from '../sim/types';
import { findLockTarget } from '../sim/world';
import { playSfx, Sfx } from './audio';
import { GameSession } from './session';

function gunSfxFor(type: PlaneType): Sfx {
  if (type === 'interceptor' || type === 'stealth') return 'shoot_laser';
  if (type === 'bomber' || type === 'gunship') return 'shoot_heavy';
  return 'shoot';
}

export interface FeedbackSettings {
  sound: boolean;
  vibration: boolean;
}

const HEAR_RANGE = 1100;

/** Turns game state + events into sounds and vibration for the local player. */
export class Feedback {
  private lastHp = -1;
  private lastMissiles = -1;
  private lastLockTarget: string | null = null;
  private shootCd = 0;
  private warnCd = 0;
  private vibCd = 0;

  constructor(private session: GameSession, private settings: FeedbackSettings) {}

  private vib(ms: number) {
    if (!this.settings.vibration || this.vibCd > 0) return;
    this.vibCd = 0.12;
    Vibration.vibrate(ms);
  }

  private sfx(name: Parameters<typeof playSfx>[0], vol = 1) {
    if (this.settings.sound) playSfx(name, vol);
  }

  update(dt: number, events: GameEvent[], input: Input, cam: { x: number; y: number }) {
    const w = this.session.world;
    const myId = this.session.myId;
    const me = w.planes.find((p) => p.id === myId);
    this.shootCd -= dt;
    this.warnCd -= dt;
    this.vibCd -= dt;
    const fade = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - cam.x, y - cam.y) / HEAR_RANGE);

    for (const e of events) {
      switch (e.t) {
        case 'explode':
          this.sfx('explode', (e.big ? 1 : 0.6) * fade(e.x, e.y));
          if (e.ground) {
            const pFade = fade(e.x, e.y);
            if (pFade > 0.2) this.vib(Math.round(85 * pFade));
          }
          break;
        case 'hit':
          if (me && Math.hypot(e.x - me.x, e.y - me.y) < 60) this.sfx('hit', 0.8);
          break;
        case 'pickup':
          if (e.id === myId) this.sfx('pickup', 0.8);
          break;
        case 'pickup_crate':
          if (e.id === myId) {
            this.sfx('pickup', 1.0);
            this.vib(160);
          }
          break;
        case 'accolade':
          if (e.id === myId) {
            this.sfx('special', 0.9);
            this.vib(120);
          }
          break;
        case 'special':
          this.sfx('special', e.id === myId ? 0.8 : 0.6 * fade(e.x, e.y));
          break;
        case 'flag':
          this.sfx(e.action === 'capture' ? 'capture' : 'flag', 0.9);
          if (e.by === myId && (e.action === 'take' || e.action === 'capture')) this.vib(e.action === 'capture' ? 300 : 120);
          break;
        case 'kill':
          if (e.victim === myId) {
            this.vibCd = 0;
            this.vib(450);
          } else if (e.killer === myId) {
            this.sfx('kill', 0.9);
            this.vib(75);
          }
          break;
      }
    }

    if (!me || !me.alive) {
      this.lastHp = -1;
      this.lastMissiles = -1;
      this.lastLockTarget = null;
      return;
    }

    // Took damage → short buzz.
    if (this.lastHp >= 0 && me.hp < this.lastHp - 0.5) this.vib(35);
    this.lastHp = me.hp;

    // Missile launched by me.
    if (this.lastMissiles >= 0 && me.missiles < this.lastMissiles) this.sfx('missile', 0.85);
    this.lastMissiles = me.missiles;

    // Radar missile lock acquired chime.
    const lockId = me.missiles > 0 ? findLockTarget(w, me) : null;
    if (lockId && lockId !== this.lastLockTarget) {
      this.sfx('lock', 0.55);
    }
    this.lastLockTarget = lockId;

    // Own gunfire (manual or auto-fire), scaled to aircraft fire interval & weapon type.
    const isFiring = input.fire || this.session.getInput().fire;
    if (isFiring && this.shootCd <= 0) {
      this.shootCd = Math.max(0.08, PLANES[me.type].fireInterval);
      this.sfx(gunSfxFor(me.type), 0.34);
    }

    // Incoming missile warning: any enemy missile close and pointed at us.
    if (this.warnCd <= 0) {
      for (const m of w.missiles) {
        const d = Math.hypot(m.x - me.x, m.y - me.y);
        if (d > 480 || d < 1) continue;
        const toMe = Math.atan2(me.y - m.y, me.x - m.x);
        if (Math.abs(angleDiff(m.angle, toMe)) < 0.45) {
          this.sfx('warn', 0.7);
          this.warnCd = 0.35;
          break;
        }
      }
    }
  }
}
