import { MapId, Obstacle } from './types';

export interface MapPalette {
  sky: string; // arena background
  grid: string;
  cloud: string;
  zone: string; // outside-the-arena tint
  border: string;
  rock: string; // obstacle fill
  rockEdge: string;
  rockTop: string; // highlight
}

export interface MapDef {
  id: MapId;
  label: string;
  description: string;
  w: number;
  h: number;
  cloudDensity: number; // clouds per 100k px²
  palette: MapPalette;
  obstacles: Obstacle[];
}

export const MAPS: Record<MapId, MapDef> = {
  farmland: {
    id: 'farmland',
    label: 'Farmland Basin',
    description: 'Emerald agricultural river valley & defense perimeter',
    w: 4160,
    h: 2860,
    cloudDensity: 0.05,
    palette: {
      sky: '#142a1b', grid: 'rgba(0,245,212,0.06)', cloud: 'rgba(255,255,255,0.45)', zone: 'rgba(220,30,50,0.32)',
      border: 'rgba(0,245,212,0.85)', rock: '#2d3b24', rockEdge: '#172212', rockTop: '#4e6b3c',
    },
    obstacles: [],
  },
  ocean: {
    id: 'ocean',
    label: 'Naval Trench',
    description: 'Deep naval abyss, coastal reef shallows & defense platforms',
    w: 4160,
    h: 2860,
    cloudDensity: 0.06,
    palette: {
      sky: '#091c33', grid: 'rgba(0,229,255,0.08)', cloud: 'rgba(255,255,255,0.5)', zone: 'rgba(255,40,60,0.32)',
      border: 'rgba(0,229,255,0.9)', rock: '#123652', rockEdge: '#081a29', rockTop: '#00f0ff',
    },
    obstacles: [],
  },
  desert: {
    id: 'desert',
    label: 'Desert Outpost',
    description: 'Scorched military test range & sand dune ridges',
    w: 4160,
    h: 2860,
    cloudDensity: 0.02,
    palette: {
      sky: '#332110', grid: 'rgba(255,180,50,0.08)', cloud: 'rgba(255,240,220,0.35)', zone: 'rgba(220,30,50,0.32)',
      border: 'rgba(255,180,0,0.9)', rock: '#543419', rockEdge: '#301c0c', rockTop: '#8c592b',
    },
    obstacles: [],
  },
  arctic: {
    id: 'arctic',
    label: 'Glacial Fortress',
    description: 'Polar ice floes, frozen fjords & sub-zero dogfights',
    w: 4680,
    h: 3120,
    cloudDensity: 0.05,
    palette: {
      sky: '#0d2235', grid: 'rgba(120,220,255,0.08)', cloud: 'rgba(255,255,255,0.65)', zone: 'rgba(255,50,70,0.30)',
      border: 'rgba(76,201,240,0.9)', rock: '#22435f', rockEdge: '#102333', rockTop: '#e0f7fa',
    },
    obstacles: [],
  },
  canyon: {
    id: 'canyon',
    label: 'Volcanic Gorge',
    description: 'Red iron canyon rift, thermal updrafts & high-speed chases',
    w: 3900,
    h: 2600,
    cloudDensity: 0.02,
    palette: {
      sky: '#2a0e08', grid: 'rgba(255,100,40,0.09)', cloud: 'rgba(255,200,180,0.3)', zone: 'rgba(220,30,50,0.35)',
      border: 'rgba(255,90,30,0.95)', rock: '#4d1c10', rockEdge: '#260c06', rockTop: '#7a2c1c',
    },
    obstacles: [],
  },
  night: {
    id: 'night',
    label: 'Cyber Recon',
    description: 'Tactical midnight stealth raid with illuminated tarmac',
    w: 3900,
    h: 2600,
    cloudDensity: 0.03,
    palette: {
      sky: '#050c18', grid: 'rgba(0,229,255,0.12)', cloud: 'rgba(120,150,200,0.22)', zone: 'rgba(255,30,80,0.35)',
      border: 'rgba(0,245,212,0.95)', rock: '#111e33', rockEdge: '#070c14', rockTop: '#00f5d4',
    },
    obstacles: [],
  },
  mountain: {
    id: 'mountain',
    label: 'Highland Peaks',
    description: 'Snow‑capped mountains with thin air and turbulent updrafts',
    w: 4420,
    h: 3120,
    cloudDensity: 0.07,
    palette: {
      sky: '#0a1a2b', grid: 'rgba(200,200,255,0.07)', cloud: 'rgba(255,255,255,0.55)', zone: 'rgba(200,30,50,0.30)',
      border: 'rgba(180,200,255,0.85)', rock: '#3b4f2a', rockEdge: '#252f19', rockTop: '#c0d9b5',
    },
    obstacles: [],
  },
  forest: {
    id: 'forest',
    label: 'Dense Woodland',
    description: 'Thick canopy, low visibility, hidden valleys',
    w: 4160,
    h: 2860,
    cloudDensity: 0.06,
    palette: {
      sky: '#123331', grid: 'rgba(0,180,150,0.07)', cloud: 'rgba(240,250,240,0.40)', zone: 'rgba(30,150,70,0.25)',
      border: 'rgba(0,200,180,0.9)', rock: '#2c5c3e', rockEdge: '#1a3a29', rockTop: '#4e8a5b',
    },
    obstacles: [],
  },
  city: {
    id: 'city',
    label: 'Urban Canyon',
    description: 'Skyscrapers create wind tunnels and low‑altitude combat',
    w: 3900,
    h: 2600,
    cloudDensity: 0.05,
    palette: {
      sky: '#2c3e5d', grid: 'rgba(180,210,255,0.08)', cloud: 'rgba(220,220,220,0.45)', zone: 'rgba(80,80,90,0.30)',
      border: 'rgba(150,180,255,0.9)', rock: '#4a4a4a', rockEdge: '#2e2e2e', rockTop: '#777777',
    },
    obstacles: [],
  },
};

export const MAP_IDS: MapId[] = ['farmland', 'ocean', 'desert', 'arctic', 'canyon', 'night', 'mountain', 'forest', 'city'];