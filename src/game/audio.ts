import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const SOURCES = {
  shoot: require('../../assets/sfx/shoot.wav'),
  shoot_heavy: require('../../assets/sfx/shoot_heavy.wav'),
  shoot_laser: require('../../assets/sfx/shoot_laser.wav'),
  hit: require('../../assets/sfx/hit.wav'),
  explode: require('../../assets/sfx/explode.wav'),
  missile: require('../../assets/sfx/missile.wav'),
  pickup: require('../../assets/sfx/pickup.wav'),
  special: require('../../assets/sfx/special.wav'),
  flag: require('../../assets/sfx/flag.wav'),
  capture: require('../../assets/sfx/capture.wav'),
  warn: require('../../assets/sfx/warn.wav'),
  lock: require('../../assets/sfx/lock.wav'),
  kill: require('../../assets/sfx/kill.wav'),
} as const;

const BGM_SOURCE = require('../../assets/sfx/bgm.wav');

export type Sfx = keyof typeof SOURCES;

/** Voices per sound so rapid repeats can overlap. */
const VOICES: Partial<Record<Sfx, number>> = {
  shoot: 4,
  shoot_heavy: 4,
  shoot_laser: 4,
  hit: 3,
  explode: 3,
};

let pools: Partial<Record<Sfx, { players: AudioPlayer[]; next: number }>> = {};
let bgmPlayer: AudioPlayer | null = null;
let ready = false;

export async function initAudio() {
  if (ready) return;
  ready = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  } catch {
    // Older/limited devices: continue with defaults.
  }
  for (const key of Object.keys(SOURCES) as Sfx[]) {
    const players: AudioPlayer[] = [];
    for (let i = 0; i < (VOICES[key] ?? 1); i++) {
      try {
        players.push(createAudioPlayer(SOURCES[key]));
      } catch {
        // ignore a failed voice
      }
    }
    pools[key] = { players, next: 0 };
  }
}

export function playSfx(name: Sfx, volume = 1) {
  const pool = pools[name];
  if (!pool || pool.players.length === 0 || volume <= 0.02) return;
  const p = pool.players[pool.next];
  pool.next = (pool.next + 1) % pool.players.length;
  try {
    p.volume = Math.max(0, Math.min(1, volume));
    p.seekTo(0);
    p.play();
  } catch {
    // never let audio crash the game
  }
}

export function startBgm(volume = 0.22) {
  try {
    if (!bgmPlayer) {
      bgmPlayer = createAudioPlayer(BGM_SOURCE);
      bgmPlayer.loop = true;
    }
    bgmPlayer.volume = Math.max(0, Math.min(1, volume));
    bgmPlayer.play();
  } catch {
    // ignore audio failures
  }
}

export function stopBgm() {
  try {
    bgmPlayer?.pause();
  } catch {
    // ignore
  }
}

export function disposeAudio() {
  for (const pool of Object.values(pools)) for (const p of pool?.players ?? []) {
    try { p.remove(); } catch { /* ignore */ }
  }
  try {
    bgmPlayer?.remove();
  } catch {
    // ignore
  }
  bgmPlayer = null;
  pools = {};
  ready = false;
}
