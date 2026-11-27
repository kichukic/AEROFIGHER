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
    w: 3200,
    h: 2200,
    cloudDensity: 0.35,
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
    w: 3200,
    h: 2200,
    cloudDensity: 0.45,
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
    w: 3200,
    h: 2200,
    cloudDensity: 0.18,
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
    w: 3600,
    h: 2400,
    cloudDensity: 0.55,
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
    w: 3000,
    h: 2000,
    cloudDensity: 0.12,
    palette: {
      sky: '#2a0e08', grid: 'rgba(255,100,40,0.09)', cloud: 'rgba(255,200,180,0.3)', zone: 'rgba(220,30,50,0.35)',
      border: 'rgba(255,90,30,0.95)', rock: '#4d1c10', rockEdge: '#260c06', rockTop: '#7a2f1c',
    },
    obstacles: [],
  },
  night: {
    id: 'night',
    label: 'Cyber Recon',
    description: 'Tactical midnight stealth raid with illuminated tarmac',
    w: 3000,
    h: 2000,
    cloudDensity: 0.22,
    palette: {
      sky: '#050c18', grid: 'rgba(0,229,255,0.12)', cloud: 'rgba(120,150,200,0.22)', zone: 'rgba(255,30,80,0.35)',
      border: 'rgba(0,245,212,0.95)', rock: '#111e33', rockEdge: '#070c14', rockTop: '#00f5d4',
    },
    obstacles: [],
  },
};

export const MAP_IDS: MapId[] = ['farmland', 'ocean', 'desert', 'arctic', 'canyon', 'night'];
