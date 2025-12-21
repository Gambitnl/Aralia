/**
 * @file src/systems/environment/TerrainSystem.ts
 * Defines the mechanical rules for different terrain types.
 * Maps string identifiers to Movement Costs, Cover, and other tactical properties.
 */

import { TerrainRule, CoverType } from '../../types/environment';

/**
 * Registry of terrain rules.
 * Maps the string keys used in BattleMap to mechanical properties.
 */
export const TERRAIN_RULES: Record<string, TerrainRule> = {
  // Base Terrain
  grass: {
    id: 'grass',
    name: 'Grassland',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  dirt: {
    id: 'dirt',
    name: 'Packed Dirt',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  road: {
    id: 'road',
    name: 'Road',
    movementCost: 1, // Could potentially be 0.5 in future deep systems, but 1 is standard
    cover: 'none',
    stealthAdvantage: false
  },

  // Difficult Terrain
  forest: {
    id: 'forest',
    name: 'Forest Floor',
    movementCost: 2, // D&D is usually 2, but we use 1.5 for "light" clutter sometimes. Sticking to integer math: 2
    cover: 'none',
    stealthAdvantage: true // Leaf litter, shadows
  },
  dense_forest: {
    id: 'dense_forest',
    name: 'Dense Forest',
    movementCost: 2,
    cover: 'half', // Trees provide some natural cover
    stealthAdvantage: true
  },
  rocky_terrain: {
    id: 'rocky_terrain',
    name: 'Rocky Ground',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  boulder_field: {
    id: 'boulder_field',
    name: 'Boulder Field',
    movementCost: 2,
    cover: 'half',
    stealthAdvantage: true
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  dunes: {
    id: 'dunes',
    name: 'Sand Dunes',
    movementCost: 2,
    cover: 'half', // You can hide behind the crest
    stealthAdvantage: true
  },
  snow: {
    id: 'snow',
    name: 'Deep Snow',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },

  // Aquatic / Special
  shallow_water: {
    id: 'shallow_water',
    name: 'Shallow Water',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false // Noise splash
  },
  water: {
    id: 'water',
    name: 'Deep Water',
    movementCost: 2, // Swimming (requires swim speed or costs 2x)
    cover: 'three_quarters', // Submerged
    stealthAdvantage: true // Under surface
  },
  mud: {
    id: 'mud',
    name: 'Deep Mud',
    movementCost: 3, // Very difficult
    cover: 'none',
    stealthAdvantage: false
  }
};

/**
 * Gets the movement cost for a specific terrain type.
 * Defaults to 1 if unknown.
 */
export function getTerrainMovementCost(terrainId: string): number {
  const rule = TERRAIN_RULES[terrainId];
  return rule ? rule.movementCost : 1;
}

/**
 * Gets the cover bonus provided by the terrain itself.
 * Note: This is ground cover (e.g. waist-high water, tall grass),
 * distinct from Objects (walls, trees).
 */
export function getTerrainCover(terrainId: string): CoverType {
  const rule = TERRAIN_RULES[terrainId];
  return rule ? rule.cover : 'none';
}

/**
 * Determines if a terrain type grants advantage on Stealth checks.
 */
export function terrainGrantsStealth(terrainId: string): boolean {
  const rule = TERRAIN_RULES[terrainId];
  return rule ? rule.stealthAdvantage : false;
}
