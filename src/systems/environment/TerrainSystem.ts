/**
 * @file src/systems/environment/TerrainSystem.ts
 * Defines the mechanical rules for different terrain types.
 * Maps BattleMapTerrain identifiers to Movement Costs, Cover, and other tactical properties.
 */

import { TerrainRule, CoverType, WeatherState } from '../../types/environment';
import { BattleMapTerrain } from '../../types/combat';
import { NATURAL_HAZARDS } from './hazards';

/**
 * Registry of terrain rules.
 * Maps the BattleMapTerrain keys to mechanical properties.
 */
export const TERRAIN_RULES: Record<BattleMapTerrain, TerrainRule> = {
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

  // Difficult / Natural
  dense_forest: {
    id: 'dense_forest',
    name: 'Dense Forest',
    movementCost: 2,
    cover: 'half', // Trees provide some natural cover
    stealthAdvantage: true
  },
  rock: {
    id: 'rock',
    name: 'Rocky Ground',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  rocky_terrain: {
    id: 'rocky_terrain',
    name: 'Rough Terrain',
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
  difficult: {
    id: 'difficult',
    name: 'Difficult Terrain',
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
    stealthAdvantage: false
  },
  water: {
    id: 'water',
    name: 'Deep Water',
    movementCost: 2,
    cover: 'three_quarters', // Submerged
    stealthAdvantage: true
  },
  mud: {
    id: 'mud',
    name: 'Thick Mud',
    movementCost: 3, // Very difficult
    cover: 'none',
    stealthAdvantage: false
  },
  ice: {
    id: 'ice',
    name: 'Slippery Ice',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  wall: {
    id: 'wall',
    name: 'Wall',
    movementCost: 999,
    cover: 'total',
    stealthAdvantage: true
  }
};

/**
 * Gets the movement cost for a specific terrain type.
 * Defaults to 1 if unknown.
 */
export function getTerrainMovementCost(terrainId: BattleMapTerrain): number {
  const rule = TERRAIN_RULES[terrainId];
  return rule ? rule.movementCost : 1;
}

/**
 * Gets the cover bonus provided by the terrain itself.
 * Note: This is ground cover (e.g. waist-high water, tall grass),
 * distinct from Objects (walls, trees).
 */
export function getTerrainCover(terrainId: BattleMapTerrain): CoverType {
  const rule = TERRAIN_RULES[terrainId];
  return rule ? rule.cover : 'none';
}

/**
 * Determines if a terrain type grants advantage on Stealth checks.
 */
export function terrainGrantsStealth(terrainId: BattleMapTerrain): boolean {
  const rule = TERRAIN_RULES[terrainId];
  return rule ? rule.stealthAdvantage : false;
}

// [Ecologist] Implemented dynamic weather-terrain interactions
/**
 * Calculates the effective terrain properties given the current weather.
 * E.g., Heavy rain turns dirt into mud; Freezing turns water into ice.
 */
export function getEffectiveTerrain(
  baseTerrain: BattleMapTerrain,
  weather: WeatherState
): TerrainRule {
  const baseRule = TERRAIN_RULES[baseTerrain];
  if (!baseRule) return TERRAIN_RULES['grass']; // Fallback

  // Copy rule to modify
  const effectiveRule = { ...baseRule, hazards: [...(baseRule.hazards || [])] };

  // 1. Mud Mechanics (Rain + Earth)
  if (
    (baseTerrain === 'dirt' || baseTerrain === 'grass') &&
    (weather.precipitation === 'heavy_rain' || weather.precipitation === 'storm')
  ) {
    // Dirt becomes Mud
    if (baseTerrain === 'dirt') {
      return TERRAIN_RULES['mud'];
    }
    // Grass gets muddy (Cost 1 -> 2)
    if (baseTerrain === 'grass') {
      effectiveRule.movementCost = 2;
      effectiveRule.name = 'Muddy Grass';
    }
  }

  // 2. Ice Mechanics (Freezing + Water/Wet)
  if (weather.temperature === 'freezing') {
    if (baseTerrain === 'water' || baseTerrain === 'shallow_water') {
      // Water freezes
      return TERRAIN_RULES['ice'];
    }
    // Wet surfaces become slippery
    if (weather.precipitation === 'light_rain' || weather.precipitation === 'heavy_rain') {
       effectiveRule.hazards?.push(NATURAL_HAZARDS['slippery_ice']);
       effectiveRule.name = `Frozen ${effectiveRule.name}`;
    }
  }

  // 3. Snow Mechanics (Snow + Open Ground)
  if ((weather.precipitation === 'snow' || weather.precipitation === 'blizzard') &&
      (baseTerrain === 'grass' || baseTerrain === 'dirt' || baseTerrain === 'road')) {
      // Accumulating snow increases difficulty
      effectiveRule.movementCost = Math.max(effectiveRule.movementCost, 2);
      effectiveRule.name = `Snow-covered ${baseRule.name}`;
  }

  return effectiveRule;
}
