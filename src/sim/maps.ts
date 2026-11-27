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
  ocean: {
    id: 'ocean',
    label: 'Open Ocean',
    description: 'Wide open sky, no obstacles',
    w: 3200,
    h: 2200,
    cloudDensity: 0.45,
    palette: {
      sky: '#4f9fe0', grid: 'rgba(255,255,255,0.08)', cloud: 'rgba(255,255,255,0.55)', zone: 'rgba(200,30,30,0.28)',
      border: 'rgba(255,60,60,0.9)', rock: '#2e8b57', rockEdge: '#1d5c39', rockTop: '#e9d8a6',
    },
    // Small islands are decoration only (r = 0 means not solid); keep sky clear.
    obstacles: [],
  },
  desert: {
    id: 'desert',
    label: 'Desert Mesas',
    description: 'Rock mesas to dodge around',
    w: 3200,
    h: 2200,
    cloudDensity: 0.2,
    palette: {
      sky: '#e0b872', grid: 'rgba(120,60,0,0.10)', cloud: 'rgba(255,250,235,0.45)', zone: 'rgba(160,20,20,0.30)',
      border: 'rgba(190,30,30,0.9)', rock: '#b5651d', rockEdge: '#7a3e0e', rockTop: '#d98c4a',
    },
    obstacles: [
      { x: 1600, y: 1100, r: 150 },
      { x: 950, y: 600, r: 90 },
      { x: 2250, y: 1600, r: 90 },
      { x: 950, y: 1650, r: 70 },
      { x: 2250, y: 550, r: 70 },
    ],
  },
  arctic: {
    id: 'arctic',
    label: 'Arctic Peaks',
    description: 'Big icy map with a few peaks',
    w: 3600,
    h: 2400,
    cloudDensity: 0.55,
    palette: {
      sky: '#bfe3f2', grid: 'rgba(20,60,90,0.08)', cloud: 'rgba(255,255,255,0.7)', zone: 'rgba(200,30,30,0.25)',
      border: 'rgba(220,40,40,0.9)', rock: '#8fb8cc', rockEdge: '#4f7a90', rockTop: '#ffffff',
    },
    obstacles: [
      { x: 1200, y: 800, r: 120 },
      { x: 2400, y: 1600, r: 120 },
      { x: 1800, y: 1200, r: 80 },
    ],
  },
  canyon: {
    id: 'canyon',
    label: 'Red Canyon',
    description: 'Tight rock pillars, close combat',
    w: 3000,
    h: 2000,
    cloudDensity: 0.1,
    palette: {
      sky: '#c2603c', grid: 'rgba(60,10,0,0.12)', cloud: 'rgba(255,230,210,0.35)', zone: 'rgba(80,0,0,0.35)',
      border: 'rgba(255,220,80,0.9)', rock: '#6b2d1a', rockEdge: '#3f160b', rockTop: '#9a4a2c',
    },
    obstacles: [
      { x: 1500, y: 1000, r: 110 },
      { x: 900, y: 500, r: 75 }, { x: 2100, y: 500, r: 75 },
      { x: 900, y: 1500, r: 75 }, { x: 2100, y: 1500, r: 75 },
      { x: 1500, y: 350, r: 60 }, { x: 1500, y: 1650, r: 60 },
      { x: 600, y: 1000, r: 55 }, { x: 2400, y: 1000, r: 55 },
    ],
  },
  night: {
    id: 'night',
    label: 'Night Raid',
    description: 'Dark skies over the city towers',
    w: 3000,
    h: 2000,
    cloudDensity: 0.25,
    palette: {
      sky: '#14213d', grid: 'rgba(120,160,255,0.08)', cloud: 'rgba(160,170,200,0.25)', zone: 'rgba(160,0,40,0.35)',
      border: 'rgba(255,60,120,0.9)', rock: '#2b2d42', rockEdge: '#0d0e1a', rockTop: '#fca311',
    },
    obstacles: [
      { x: 1500, y: 600, r: 80 },
      { x: 1500, y: 1400, r: 80 },
    ],
  },
};

export const MAP_IDS: MapId[] = ['ocean', 'desert', 'arctic', 'canyon', 'night'];
