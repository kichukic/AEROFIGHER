export type PlaneType = 'interceptor' | 'fighter' | 'bomber' | 'stealth' | 'gunship';
export type GameMode = 'ffa' | 'tdm' | 'ctf';
export type PickupKind = 'repair' | 'shield' | 'missiles' | 'boost';
export type MapId = 'farmland' | 'ocean' | 'desert' | 'arctic' | 'canyon' | 'night' | 'mountain' | 'forest' | 'city';
export type SpecialKind = 'dash' | 'flare' | 'flak' | 'cloak' | 'overdrive';
export type Weapon = 'gun' | 'missile' | 'zone' | 'crash' | 'flak';

/** Player intent for one tick. `aim` is the desired heading in radians, or null to keep flying straight. */
export interface Input {
  aim: number | null;
  throttle: number; // 0..1 (0 = min speed, 1 = max speed)
  fire: boolean;
  missile: boolean;
  special: boolean;
}

export const IDLE_INPUT: Input = { aim: null, throttle: 0.5, fire: false, missile: false, special: false };

export interface Plane {
  id: string;
  name: string;
  team: number; // 0 or 1 in team modes, -1 in FFA
  type: PlaneType;
  isBot: boolean;
  x: number;
  y: number;
  angle: number;
  speed: number;
  vx: number;
  vy: number;
  bank: number;
  hp: number;
  alive: boolean;
  respawnAt: number; // world time when the plane respawns (if dead)
  fireCd: number;
  missileCd: number;
  missiles: number;
  specialCd: number;
  shieldUntil: number;
  boostUntil: number;
  dashUntil: number;
  flareUntil: number;
  spawnProtectUntil: number;
  hitFlashUntil: number;
  outOfBoundsTime: number;
  inCloud: boolean;
  kills: number;
  deaths: number;
  caps: number; // flag captures (CTF)
  streak: number; // current killstreak without dying
  lastKillTime: number; // world time of last kill (for multi-kills)
  multiKills: number; // rapid kills count within window
  perk?: { kind: AirDropPerk; until: number };
}

export type AirDropPerk = 'twin_vulcan' | 'energy_shield' | 'cluster_missile' | 'overdrive';

export interface SupplyCrate {
  id: number;
  x: number;
  y: number;
  perk: AirDropPerk;
  descentY: number;
  landed: boolean;
  beaconPhase: number;
  life: number;
}

export interface Bullet {
  id: number;
  owner: string;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  flak?: boolean;
}

export interface Missile {
  id: number;
  owner: string;
  team: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  target: string | null;
  life: number;
  lostLock?: boolean;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

export interface Cloud {
  x: number;
  y: number;
  r: number;
}

export interface Flag {
  team: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  carrier: string | null;
  droppedAt: number | null; // world time it was dropped, null if home or carried
}

export type FlagAction = 'take' | 'drop' | 'return' | 'capture';

export type GameEvent =
  | { t: 'kill'; killer: string | null; victim: string; weapon: Weapon }
  | { t: 'explode'; x: number; y: number; big: boolean; ground?: boolean }
  | { t: 'hit'; x: number; y: number; dmg?: number }
  | { t: 'pickup'; id: string; kind: PickupKind }
  | { t: 'special'; id: string; kind: SpecialKind; x: number; y: number }
  | { t: 'flag'; team: number; action: FlagAction; by: string | null }
  | { t: 'accolade'; id: string; title: string; subtitle?: string; color?: string; sound?: 'streak' | 'ace' | 'shutdown' }
  | { t: 'pickup_crate'; id: string; perk: AirDropPerk; x: number; y: number }
  | { t: 'end'; winner: string | null; winnerTeam: number | null };

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface MatchConfig {
  mode: GameMode;
  map: MapId;
  timeLimit: number; // seconds
  killLimit: number;
  captureLimit: number;
  arenaW: number;
  arenaH: number;
  botDifficulty?: BotDifficulty;
}

export interface World {
  tick: number;
  time: number;
  config: MatchConfig;
  planes: Plane[];
  bullets: Bullet[];
  missiles: Missile[];
  pickups: Pickup[];
  crates: SupplyCrate[];
  flags: Flag[];
  obstacles: Obstacle[];
  clouds: Cloud[];
  nextId: number;
  nextPickupAt: number;
  nextCrateAt: number;
  seed: number;
  ended: boolean;
  winner: string | null;
  winnerTeam: number | null;
  teamScores: [number, number];
  /** Events produced during the most recent step(s); consumers drain this. */
  events: GameEvent[];
}

export interface PlayerSlot {
  id: string;
  name: string;
  team: number;
  type: PlaneType;
  isBot: boolean;
}

export const isTeamMode = (m: GameMode) => m !== 'ffa';
