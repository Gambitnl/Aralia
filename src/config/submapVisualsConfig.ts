/**
 * @file src/config/submapVisualsConfig.ts
 * Centralizes the configuration for procedural submap visuals.
 */
import { BiomeVisuals, SeededFeatureConfig } from '../types';

export const biomeVisualsConfig: Record<string, BiomeVisuals> = {
  'forest': {
    baseColors: ['rgba(20, 83, 45, 0.7)', 'rgba(21, 94, 51, 0.75)', 'rgba(22, 101, 52, 0.7)', 'rgba(18, 75, 40, 0.72)'],
    pathColor: 'rgba(101, 67, 33, 0.65)',
    pathIcon: '🐾',
    pathAdjacency: {
      color: 'rgba(60, 40, 20, 0.2)',
      scatter: [{ icon: '🌿', density: 0.5, color: 'rgba(22, 101, 52, 0.5)' }, { icon: '▫️', density: 0.2 }],
    },
    seededFeatures: [
      { id: 'pond', name: 'Pond', icon: '💧', color: 'rgba(56, 120, 180, 0.8)', sizeRange: [2, 3], numSeedsRange: [0, 1], adjacency: { color: 'rgba(70, 100, 130, 0.6)', icon: '🐸' }, zOffset: 0, generatesEffectiveTerrainType: 'water', scatterOverride: [{ icon: '🌿', density: 0.3, allowedOn: ['water'] }, { icon: '🐟', density: 0.1, allowedOn: ['water'] }], shapeType: 'circular' },
      { id: 'dense_thicket', name: 'Dense Thicket', icon: '🌳', color: 'rgba(16, 71, 38, 0.9)', sizeRange: [2, 4], numSeedsRange: [1, 2], adjacency: { color: 'rgba(20, 83, 45, 0.8)' }, zOffset: 2, generatesEffectiveTerrainType: 'dense_forest', shapeType: 'circular' },
      { id: 'ancient_stone_circle', name: 'Ancient Stone Circle', icon: '🗿', color: 'rgba(100, 110, 120, 0.7)', sizeRange: [1, 2], numSeedsRange: [0, 1], zOffset: 0.5, generatesEffectiveTerrainType: 'stone_area', shapeType: 'circular' },
      { id: 'glowing_mushroom_grove', name: 'Glowing Mushroom Grove', icon: '🍄', color: 'rgba(150, 50, 200, 0.4)', sizeRange: [1, 2], numSeedsRange: [0, 1], adjacency: { color: 'rgba(120,40,160,0.3)' }, zOffset: 0, scatterOverride: [{ icon: '✨', density: 0.6, color: 'rgba(150,50,200,0.2)' }], shapeType: 'circular' },
      { id: 'village', name: 'Forest Village', icon: '🏘️', color: 'rgba(146, 153, 165, 0.75)', sizeRange: [1, 2], numSeedsRange: [1, 1], zOffset: 0.5, generatesEffectiveTerrainType: 'village_area', scatterOverride: [{ icon: '▫️', density: 0.3, color: 'rgba(176, 183, 195, 0.8)', allowedOn: ['village_area'] }, { icon: '🧍', density: 0.03, allowedOn: ['village_area'] }], shapeType: 'rectangular' },
    ],
    scatterFeatures: [{ icon: '🌲', density: 0.1 }, { icon: '🌳', density: 0.15 }, { icon: '🌿', density: 0.15 }, { icon: '🍄', density: 0.05, color: 'rgba(180,180,180,0.1)' }, { icon: '🦋', density: 0.03 }, { icon: '🐿️', density: 0.02 }],
  },
  'plains': {
    baseColors: ['rgba(130, 180, 90, 0.6)', 'rgba(145, 185, 95, 0.62)', 'rgba(135, 175, 85, 0.58)', 'rgba(150, 190, 105, 0.65)', 'rgba(160, 200, 110, 0.63)', 'rgba(140, 180, 100, 0.67)', 'rgba(170, 210, 120, 0.6)'],
    pathColor: 'rgba(180, 140, 90, 0.55)',
    pathIcon: '▫️',
    pathAdjacency: { scatter: [{ icon: '🌿', density: 0.2, color: 'rgba(120,160,80,0.5)' }, { icon: '·', density: 0.15, color: 'rgba(101, 67, 33, 0.35)' }, { icon: '🐾', density: 0.05, color: 'rgba(101,67,33,0.5)' }] },
    seededFeatures: [
      { id: 'village', name: 'Village', icon: '🏘️', color: 'rgba(156, 163, 175, 0.75)', sizeRange: [1, 2], numSeedsRange: [1, 1], zOffset: 0.5, generatesEffectiveTerrainType: 'village_area', scatterOverride: [{ icon: '▫️', density: 0.3, color: 'rgba(186,193,205,0.8)', allowedOn: ['village_area'] }, { icon: '🧍', density: 0.03, allowedOn: ['village_area'] }], shapeType: 'rectangular' },
      { id: 'small_copse', name: 'Small Copse of Trees', icon: '🌳', color: 'rgba(100, 150, 70, 0.7)', sizeRange: [1, 3], numSeedsRange: [1, 3], zOffset: 2, generatesEffectiveTerrainType: 'sparse_forest', shapeType: 'circular' },
      { id: 'wildflower_patch', name: 'Wildflower Patch', icon: '🌸', color: 'rgba(210, 160, 80, 0.5)', sizeRange: [1, 2], numSeedsRange: [0, 1], scatterOverride: [{ icon: '🌷', density: 0.15 }, { icon: '🌼', density: 0.15 }], zOffset: 0, shapeType: 'circular' },
      { id: 'nomad_campsite_remains', name: 'Nomad Campsite Remains', icon: '🏕️', color: 'rgba(160, 130, 100, 0.5)', sizeRange: [0, 0], numSeedsRange: [0, 1], zOffset: 0.1, generatesEffectiveTerrainType: 'campsite', shapeType: 'rectangular' },
      { id: 'lone_monolith', name: 'Lone Monolith', icon: '🗿', color: 'rgba(130,130,140,0.6)', sizeRange: [0, 1], numSeedsRange: [0, 1], zOffset: 0.5, shapeType: 'rectangular' },
      { id: 'scattered_boulders', name: 'Scattered Boulders', icon: '🪨', color: 'rgba(160, 150, 140, 0.6)', sizeRange: [0, 1], numSeedsRange: [0, 1], adjacency: { color: 'rgba(170,160,150,0.4)' }, zOffset: 0.1, generatesEffectiveTerrainType: 'boulder_field', scatterOverride: [{ icon: '·', density: 0.2, color: 'rgba(101, 67, 33, 0.4)' }], shapeType: 'circular' }
    ],
    scatterFeatures: [{ icon: '🌾', density: 0.08 }, { icon: '·', density: 0.03, color: 'rgba(101, 67, 33, 0.3)' }, { icon: '〃', density: 0.05, color: 'rgba(120, 120, 100, 0.25)' }, { icon: '🌼', density: 0.02 }, { icon: '🌷', density: 0.015 }, { icon: '🌸', density: 0.015 }, { icon: '🦋', density: 0.02 }, { icon: '🐜', density: 0.01 }, { icon: '🦗', density: 0.01 }, { icon: '🐞', density: 0.005 }, { icon: '🌱', density: 0.05, color: 'rgba(100,150,80,0.5)' }, { icon: '〰️', density: 0.03, color: 'rgba(150,120,90,0.3)' }, { icon: '🐇', density: 0.01 }, { icon: '🪱', density: 0.005 }],
  },
  'mountain': {
    baseColors: ['rgba(107, 114, 128, 0.8)', 'rgba(120, 128, 140, 0.85)', 'rgba(130, 140, 150, 0.8)', 'rgba(90, 100, 110, 0.75)'],
    pathColor: 'rgba(90, 90, 90, 0.75)',
    pathIcon: '🧗',
    pathAdjacency: { scatter: [{ icon: '🪨', density: 0.5 }, { icon: '⚠️', density: 0.05 }] },
    seededFeatures: [
      { id: 'rock_outcrop', name: 'Rock Outcrop', icon: '⛰️', color: 'rgba(80, 90, 100, 0.9)', sizeRange: [2, 4], numSeedsRange: [1, 2], adjacency: { color: 'rgba(95, 105, 115, 0.85)' }, zOffset: 2, generatesEffectiveTerrainType: 'rocky_terrain', shapeType: 'circular' },
      { id: 'snow_patch', name: 'Snow Patch', icon: '❄️', color: 'rgba(220, 230, 240, 0.7)', sizeRange: [1, 3], numSeedsRange: [0, 1], scatterOverride: [{ icon: '🥶', density: 0.2 }], zOffset: 0, generatesEffectiveTerrainType: 'snowy_patch', shapeType: 'circular' },
      { id: 'mineral_vein', name: 'Mineral Vein', icon: '💎', color: 'rgba(150,150,180,0.5)', sizeRange: [0, 1], numSeedsRange: [0, 1], zOffset: 0.1, generatesEffectiveTerrainType: 'mineral_area', shapeType: 'circular' },
      { id: 'geothermal_vent', name: 'Geothermal Vent', icon: '♨️', color: 'rgba(200,100,100,0.4)', sizeRange: [0, 1], numSeedsRange: [0, 1], zOffset: 0.1, shapeType: 'circular' },
      { id: 'village', name: 'Mountain Village', icon: '🏘️', color: 'rgba(136, 143, 155, 0.75)', sizeRange: [1, 2], numSeedsRange: [1, 1], zOffset: 0.5, generatesEffectiveTerrainType: 'village_area', scatterOverride: [{ icon: '▫️', density: 0.3, color: 'rgba(166, 173, 185, 0.8)', allowedOn: ['village_area'] }, { icon: '🧍', density: 0.02, allowedOn: ['village_area'] }], shapeType: 'rectangular' },
    ],
    scatterFeatures: [{ icon: '🪨', density: 0.15 }, { icon: '🌲', density: 0.03, allowedOn: ['rocky_terrain', 'default'] }, { icon: '🦅', density: 0.02 }, { icon: '🐐', density: 0.03 }],
  },
  'hills': {
    baseColors: ['rgba(101, 163, 13, 0.65)', 'rgba(110, 170, 20, 0.7)', 'rgba(120, 180, 30, 0.6)', 'rgba(90, 150, 10, 0.68)'],
    pathColor: 'rgba(160, 120, 70, 0.55)',
    pathIcon: '🐾',
    pathAdjacency: { scatter: [{ icon: '🌿', density: 0.3 }, { icon: '▫️', density: 0.15 }] },
    seededFeatures: [
      { id: 'small_forest_patch', name: 'Small Forest Patch', icon: '🌳', color: 'rgba(60, 110, 5, 0.75)', sizeRange: [2, 4], numSeedsRange: [0, 2], zOffset: 2, generatesEffectiveTerrainType: 'sparse_forest', shapeType: 'circular' },
      { id: 'boulder_field', name: 'Boulder Field', icon: '🪨', color: 'rgba(140, 130, 120, 0.7)', sizeRange: [1, 3], numSeedsRange: [0, 1], zOffset: 0, generatesEffectiveTerrainType: 'rocky_terrain', shapeType: 'circular' },
      { id: 'ancient_burial_mound', name: 'Ancient Burial Mound', icon: ' M ', color: 'rgba(100, 140, 80, 0.6)', sizeRange: [1, 2], numSeedsRange: [0, 1], adjacency: { icon: '👻', color: 'rgba(100,140,80,0.4)' }, zOffset: 0.2, shapeType: 'circular' },
      { id: 'village', name: 'Hilltop Village', icon: '🏘️', color: 'rgba(156, 163, 175, 0.75)', sizeRange: [1, 2], numSeedsRange: [1, 1], zOffset: 0.5, generatesEffectiveTerrainType: 'village_area', scatterOverride: [{ icon: '▫️', density: 0.3, color: 'rgba(186, 193, 205, 0.8)', allowedOn: ['village_area'] }, { icon: '🧍', density: 0.03, allowedOn: ['village_area'] }], shapeType: 'rectangular' },
    ],
    scatterFeatures: [{ icon: '🌄', density: 0.05 }, { icon: '🌿', density: 0.2 }, { icon: '🐑', density: 0.05 }, { icon: '🌼', density: 0.08 }, { icon: '🪨', density: 0.05, allowedOn: ['rocky_terrain', 'default'] }],
  },
  'desert': {
    baseColors: ['rgba(250, 204, 21, 0.55)', 'rgba(245, 190, 30, 0.6)', 'rgba(253, 224, 71, 0.5)', 'rgba(230, 180, 40, 0.58)'],
    pathColor: 'rgba(210, 180, 140, 0.65)',
    pathIcon: '👣',
    pathAdjacency: { scatter: [{ icon: '🌵', density: 0.2 }, { icon: '🦴', density: 0.05 }] },
    seededFeatures: [
      { id: 'oasis', name: 'Oasis', icon: '💧', color: 'rgba(60, 179, 113, 0.6)', sizeRange: [1, 2], numSeedsRange: [0, 1], adjacency: { icon: '🌴', color: 'rgba(170, 210, 100, 0.5)' }, zOffset: 0, generatesEffectiveTerrainType: 'oasis', scatterOverride: [{ icon: '🌴', density: 0.5, allowedOn: ['oasis'] }, { icon: '💧', density: 0.2, allowedOn: ['oasis'] }], shapeType: 'circular' },
      { id: 'rocky_mesa', name: 'Rocky Mesa', icon: '🏜️', color: 'rgba(200, 160, 120, 0.7)', sizeRange: [2, 4], numSeedsRange: [0, 1], zOffset: 2, generatesEffectiveTerrainType: 'rocky_terrain', shapeType: 'rectangular' },
      { id: 'sand_dunes', name: 'Sand Dunes', icon: '〰️', color: 'rgba(230,200,150,0.5)', sizeRange: [3, 5], numSeedsRange: [0, 1], zOffset: 0, generatesEffectiveTerrainType: 'dunes', shapeType: 'circular' },
    ],
    scatterFeatures: [{ icon: '🌵', density: 0.08 }, { icon: '🏜️', density: 0.05 }, { icon: '🦴', density: 0.03 }, { icon: '🦂', density: 0.02 }, { icon: '🐍', density: 0.02 }],
  },
  'swamp': {
    baseColors: ['rgba(19, 78, 74, 0.75)', 'rgba(25, 88, 84, 0.8)', 'rgba(15, 56, 53, 0.7)', 'rgba(10, 60, 55, 0.78)'],
    pathColor: 'rgba(70, 50, 30, 0.7)',
    pathIcon: '🪵',
    pathAdjacency: { scatter: [{ icon: '🌿', density: 0.25, color: 'rgba(15,56,53,0.5)' }, { icon: '🦟', density: 0.15 }] },
    seededFeatures: [
      { id: 'murky_pool', name: 'Murky Pool', icon: '💧', color: 'rgba(10, 40, 38, 0.85)', sizeRange: [2, 4], numSeedsRange: [1, 2], adjacency: { color: 'rgba(40,60,55,0.7)', icon: '🐸' }, zOffset: 0, generatesEffectiveTerrainType: 'water', scatterOverride: [{ icon: '🐸', density: 0.2 }, { icon: '🌿', density: 0.5, allowedOn: ['water'] }], shapeType: 'circular' },
      { id: 'dense_reeds', name: 'Dense Reeds', icon: '🌿', color: 'rgba(30, 100, 90, 0.75)', sizeRange: [2, 3], numSeedsRange: [0, 2], zOffset: 0, generatesEffectiveTerrainType: 'dense_reeds', shapeType: 'circular' },
      { id: 'sunken_ruin_fragment', name: 'Sunken Ruin Fragment', icon: '🏛️', color: 'rgba(80,90,85,0.6)', sizeRange: [0, 1], numSeedsRange: [0, 1], zOffset: 0.1, generatesEffectiveTerrainType: 'ruin_fragment', shapeType: 'rectangular' },
    ],
    scatterFeatures: [{ icon: '🌿', density: 0.2 }, { icon: '🦟', density: 0.08 }, { icon: '🐸', density: 0.04 }, { icon: '🐍', density: 0.03, allowedOn: ['dense_reeds', 'default'] }, { icon: '🐊', density: 0.02, allowedOn: ['water', 'default'] }],
  },
  'ocean': {
    baseColors: ['rgba(29, 78, 216, 0.8)', 'rgba(30, 64, 175, 0.85)', 'rgba(59, 130, 246, 0.8)', 'rgba(25, 70, 200, 0.82)'],
    pathColor: 'rgba(29, 78, 216, 0.8)',
    seededFeatures: [
      { id: 'small_island', name: 'Small Island', icon: '🏝️', color: 'rgba(230, 190, 130, 0.8)', sizeRange: [1, 2], numSeedsRange: [0, 1], zOffset: 1, generatesEffectiveTerrainType: 'island', scatterOverride: [{ icon: '🌴', density: 0.5 }, { icon: '🥥', density: 0.2 }], shapeType: 'circular' },
      { id: 'kelp_forest', name: 'Kelp Forest', icon: '🌿', color: 'rgba(30, 100, 80, 0.6)', sizeRange: [2, 4], numSeedsRange: [0, 1], zOffset: 0, generatesEffectiveTerrainType: 'kelp', scatterOverride: [{ icon: '🐠', density: 0.3 }, { icon: '🐙', density: 0.1 }], shapeType: 'circular' },
      { id: 'coral_reef', name: 'Coral Reef', icon: '🌊', color: 'rgba(255, 100, 150, 0.4)', sizeRange: [1, 3], numSeedsRange: [0, 1], zOffset: 0, generatesEffectiveTerrainType: 'reef', scatterOverride: [{ icon: '🐠', density: 0.4, color: 'rgba(255,100,150,0.2)' }, { icon: '🐡', density: 0.2 }], shapeType: 'circular' },
    ],
    scatterFeatures: [{ icon: '🌊', density: 0.2 }, { icon: '🐠', density: 0.05 }, { icon: '🐙', density: 0.02 }, { icon: '🚢', density: 0.01 }, { icon: '🐬', density: 0.02 }, { icon: '⭐', density: 0.01, color: 'rgba(250,250,100,0.3)' }],
  },
  'cave': {
    baseColors: ['rgba(40, 35, 30, 0.95)'], // Deep dark brown/black for fallback
    pathColor: 'rgba(0,0,0,0)', // No paths
    scatterFeatures: [
      { icon: '🪨', density: 0.08, allowedOn: ['floor'] },
      { icon: '💧', density: 0.03, allowedOn: ['floor'] },
      { icon: '✨', density: 0.01, allowedOn: ['floor'], color: 'rgba(200,200,255,0.3)' },
      { icon: '🦇', density: 0.02, allowedOn: ['floor', 'wall'] },
      { icon: '🍄', density: 0.04, allowedOn: ['floor'] }
    ],
    caTileVisuals: {
      'wall': { color: 'rgba(20, 15, 10, 0.98)', icon: null },
      'floor': { color: 'rgba(60, 55, 50, 0.9)', icon: null }
    }
  },
  'dungeon': {
    baseColors: ['rgba(20, 20, 25, 0.95)'], // Very dark grey
    pathColor: 'rgba(0,0,0,0)',
    scatterFeatures: [
      { icon: '💀', density: 0.03, allowedOn: ['floor'] },
      { icon: '🕯️', density: 0.02, allowedOn: ['floor'] },
      { icon: '⛓️', density: 0.04, allowedOn: ['wall'] },
      { icon: '🕸️', density: 0.05, allowedOn: ['wall', 'floor'] },
      { icon: '🏺', density: 0.02, allowedOn: ['floor'] }
    ],
    caTileVisuals: {
      'wall': { color: 'rgba(40, 40, 45, 0.98)', icon: '🧱' },
      'floor': { color: 'rgba(80, 80, 85, 0.9)', icon: null }
    }
  }
};

export const defaultBiomeVisuals: BiomeVisuals = {
  baseColors: ['rgba(107, 114, 128, 0.3)'],
  pathColor: 'rgba(120,120,120,0.5)',
  seededFeatures: [],
  scatterFeatures: [{ icon: '?', density: 1 }],
};

/**
 * Visual definitions for the village canvas system. Each entry bundles a
 * palette and optional texture hints so the renderer can pick deterministic
 * variety without hard-coding colors into the drawing logic.
 */
export const villageBuildingVisuals: Record<string, { colors: string[]; accent: string; pattern?: 'stripe' | 'check' | 'dot' }> = {
  plaza: { colors: ['#f8fafc', '#e2e8f0', '#cbd5e1'], accent: '#94a3b8', pattern: 'check' },
  path: { colors: ['#a16207', '#b45309', '#c08457'], accent: '#78350f', pattern: 'stripe' },
  house_small: { colors: ['#facc15', '#fde047', '#fbbf24'], accent: '#92400e' },
  house_medium: { colors: ['#f97316', '#fb923c', '#fdba74'], accent: '#7c2d12' },
  house_large: { colors: ['#ef4444', '#f87171', '#fca5a5'], accent: '#991b1b', pattern: 'stripe' },
  shop_blacksmith: { colors: ['#475569', '#334155', '#111827'], accent: '#f8fafc', pattern: 'dot' },
  shop_general: { colors: ['#4ade80', '#22c55e', '#15803d'], accent: '#166534', pattern: 'check' },
  shop_tavern: { colors: ['#8b5cf6', '#7c3aed', '#c084fc'], accent: '#4c1d95' },
  shop_temple: { colors: ['#38bdf8', '#0ea5e9', '#67e8f9'], accent: '#0f172a', pattern: 'stripe' },
  guard_post: { colors: ['#3b82f6', '#1d4ed8', '#1e40af'], accent: '#0ea5e9', pattern: 'check' },
  market: { colors: ['#f472b6', '#f9a8d4', '#ec4899'], accent: '#9d174d', pattern: 'stripe' },
  well: { colors: ['#38bdf8', '#0ea5e9', '#0284c7'], accent: '#0f172a', pattern: 'dot' }
};
