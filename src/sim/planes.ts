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
    minSpeed: 110,
    maxSpeed: 250,
    accel: 190,
    turnRate: 3.3,
    hp: 70,
    radius: 16,
    fireInterval: 0.09,
    bulletSpeed: 640,
    bulletDamage: 6,
    bulletLife: 1.15,
    missiles: 2,
  },
  fighter: {
    label: 'Fighter',
    description: 'Balanced all-rounder',
    minSpeed: 95,
    maxSpeed: 215,
    accel: 150,
    turnRate: 2.9,
    hp: 100,
    radius: 18,
    fireInterval: 0.12,
    bulletSpeed: 610,
    bulletDamage: 8,
    bulletLife: 1.25,
    missiles: 3,
  },
  bomber: {
    label: 'Bomber',
    description: 'Slow tank, heavy guns',
    minSpeed: 80,
    maxSpeed: 175,
    accel: 110,
    turnRate: 2.3,
    hp: 160,
    radius: 22,
    fireInterval: 0.2,
    bulletSpeed: 570,
    bulletDamage: 15,
    bulletLife: 1.45,
    missiles: 5,
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
