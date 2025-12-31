/**
 * @file src/systems/environment/TerrainSystem.ts
 * Defines the mechanical rules for different terrain types.
 * Maps BattleMapTerrain identifiers to Movement Costs, Cover, and other tactical properties.
 */

import { TerrainRule, CoverType, WeatherState } from '../../types/environment';
import { BattleMapTerrain } from '../../types/combat';
import { NATURAL_HAZARDS } from './hazards';

// Extended type to support legacy/richer terrain types locally without polluting global enum
export type ExtendedTerrain = BattleMapTerrain | 'dirt' | 'road' | 'forest' | 'dense_forest' | 'rocky_terrain' | 'boulder_field' | 'dunes' | 'snow' | 'shallow_water' | 'ice';

/**
 * Registry of terrain rules.
 * Maps BattleMapTerrain and extended keys to mechanical properties.
 */
export const TERRAIN_RULES: Record<ExtendedTerrain, TerrainRule> = {
  // Base Terrain (Enum)
  grass: {
    id: 'grass',
    name: 'Grassland',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  floor: {
    id: 'floor',
    name: 'Stone Floor',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  rock: {
    id: 'rock',
    name: 'Rocky Ground',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  mud: {
    id: 'mud',
    name: 'Deep Mud',
    movementCost: 3,
    cover: 'none',
    stealthAdvantage: false
  },
  difficult: {
    id: 'difficult',
    name: 'Difficult Terrain',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  water: {
    id: 'water',
    name: 'Deep Water',
    movementCost: 2,
    cover: 'three_quarters',
    stealthAdvantage: true
  },
  wall: {
    id: 'wall',
    name: 'Wall',
    movementCost: 999,
    cover: 'total',
    stealthAdvantage: true
  },

  // Extended / Legacy Types (Restored)
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
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  forest: {
    id: 'forest',
    name: 'Forest Floor',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: true
  },
  dense_forest: {
    id: 'dense_forest',
    name: 'Dense Forest',
    movementCost: 2,
    cover: 'half',
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
  dunes: {
    id: 'dunes',
    name: 'Sand Dunes',
    movementCost: 2,
    cover: 'half',
    stealthAdvantage: true
  },
  snow: {
    id: 'snow',
    name: 'Deep Snow',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  shallow_water: {
    id: 'shallow_water',
    name: 'Shallow Water',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  ice: {
    id: 'ice',
    name: 'Slippery Ice',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false,
    hazards: [NATURAL_HAZARDS['slippery_ice']]
  }
};

/**
 * Gets the movement cost for a specific terrain type.
 * Defaults to 1 if unknown.
 */
export function getTerrainMovementCost(terrainId: string): number {
  const rule = TERRAIN_RULES[terrainId as ExtendedTerrain];
  return rule ? rule.movementCost : 1;
}

/**
 * Gets the cover bonus provided by the terrain itself.
 * Note: This is ground cover (e.g. waist-high water, tall grass),
 * distinct from Objects (walls, trees).
 */
export function getTerrainCover(terrainId: string): CoverType {
  const rule = TERRAIN_RULES[terrainId as ExtendedTerrain];
  return rule ? rule.cover : 'none';
}

/**
 * Determines if a terrain type grants advantage on Stealth checks.
 */
export function terrainGrantsStealth(terrainId: string): boolean {
  const rule = TERRAIN_RULES[terrainId as ExtendedTerrain];
  return rule ? rule.stealthAdvantage : false;
}

// [Ecologist] Implemented dynamic weather-terrain interactions
/**
 * Calculates the effective terrain properties given the current weather.
 * E.g., Heavy rain turns dirt into mud; Freezing turns water into ice.
 */
export function getEffectiveTerrain(
  baseTerrain: string,
  weather: WeatherState
): TerrainRule {
  const baseRule = TERRAIN_RULES[baseTerrain as ExtendedTerrain];
  if (!baseRule) return TERRAIN_RULES['grass']; // Fallback

  // Copy rule to modify
  const effectiveRule = { ...baseRule, hazards: [...(baseRule.hazards || [])] };

  // 1. Mud Mechanics (Rain + Earth)
  if (
    (baseTerrain === 'dirt' || baseTerrain === 'grass' || baseTerrain === 'road' || baseTerrain === 'forest' || baseTerrain === 'sand') &&
    (weather.precipitation === 'heavy_rain' || weather.precipitation === 'storm')
  ) {
    // Dirt/Road/Sand becomes Mud
    if (baseTerrain === 'dirt' || baseTerrain === 'road' || baseTerrain === 'sand') {
      return TERRAIN_RULES['mud'];
    }
    // Grass/Forest gets muddy (Cost +1)
    effectiveRule.movementCost = Math.min(3, effectiveRule.movementCost + 1);
    effectiveRule.name = `Muddy ${baseRule.name}`;
  }

  // 2. Ice Mechanics (Freezing + Water/Wet)
  if (weather.temperature === 'freezing') {
    if (baseTerrain === 'water' || baseTerrain === 'shallow_water') {
      // Water freezes
      return TERRAIN_RULES['ice'];
    }
    // Wet surfaces become slippery
    if (weather.precipitation === 'light_rain' || weather.precipitation === 'heavy_rain') {
        if (!effectiveRule.hazards?.some(h => h.id === 'slippery_ice')) {
            effectiveRule.hazards?.push(NATURAL_HAZARDS['slippery_ice']);
            effectiveRule.name = `Frozen ${effectiveRule.name}`;
        }
    }
  }

  // 3. Snow Mechanics (Snow + Open Ground)
  if ((weather.precipitation === 'snow' || weather.precipitation === 'blizzard') &&
      (baseTerrain === 'grass' || baseTerrain === 'dirt' || baseTerrain === 'road' || baseTerrain === 'rock')) {
      // Accumulating snow increases difficulty
      effectiveRule.movementCost = Math.max(effectiveRule.movementCost, 2);
      effectiveRule.name = `Snow-covered ${baseRule.name}`;
  }

  return effectiveRule;
}
