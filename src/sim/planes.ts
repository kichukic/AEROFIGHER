import { PlaneType, SpecialKind } from './types';

export interface PlaneStats {
  label: string;
  description: string;
  minSpeed: number; // px/s
  maxSpeed: number;
  accel: number; // px/s^2
  turnRate: number; // rad/s
  hp: number;
  radius: number;
  fireInterval: number; // s
  bulletSpeed: number;
  bulletDamage: number;
  bulletLife: number; // s
  missiles: number;
}

export const PLANES: Record<PlaneType, PlaneStats> = {
  interceptor: {
    label: 'Interceptor',
    description: 'Fast and agile, light armor',
    minSpeed: 125,
    maxSpeed: 280,
    accel: 220,
    turnRate: 3.5,
    hp: 70,
    radius: 16,
    fireInterval: 0.085,
    bulletSpeed: 590,
    bulletDamage: 6,
    bulletLife: 1.25,
    missiles: 4,
  },
  fighter: {
    label: 'Fighter',
    description: 'Balanced all-rounder',
    minSpeed: 105,
    maxSpeed: 240,
    accel: 180,
    turnRate: 2.9,
    hp: 100,
    radius: 18,
    fireInterval: 0.11,
    bulletSpeed: 540,
    bulletDamage: 8,
    bulletLife: 1.35,
    missiles: 6,
  },
  bomber: {
    label: 'Bomber',
    description: 'Slow tank, heavy guns',
    minSpeed: 90,
    maxSpeed: 195,
    accel: 130,
    turnRate: 2.2,
    hp: 160,
    radius: 22,
    fireInterval: 0.18,
    bulletSpeed: 480,
    bulletDamage: 15,
    bulletLife: 1.55,
    missiles: 8,
  },
};

export const PLANE_TYPES: PlaneType[] = ['interceptor', 'fighter', 'bomber'];

export interface SpecialDef {
  kind: SpecialKind;
  label: string;
  description: string;
  cooldown: number; // seconds
}

/** Each plane has one special ability on its own button. */
export const SPECIALS: Record<PlaneType, SpecialDef> = {
  interceptor: { kind: 'dash', label: 'DASH', description: 'Afterburner burst of speed', cooldown: 7 },
  fighter: { kind: 'flare', label: 'FLARE', description: 'Shake off all missiles locked on you', cooldown: 10 },
  bomber: { kind: 'flak', label: 'FLAK', description: 'Blast bullets in every direction', cooldown: 9 },
};
