
/**
 * @file src/systems/environment/EnvironmentSystem.ts
 * Implements logic for environmental effects, including weather modifiers on spells
 * and terrain movement costs.
 */

import {
  WeatherState,
  TerrainRule,
  SpellModifier,
  Precipitation,
  WindSpeed,
  EnvironmentalHazard
} from '../../types/environment';
import { Spell, DamageType } from '../../types/spells';
import { BattleMapTerrain } from '../../types/combat';
import { NATURAL_HAZARDS } from './hazards';

export { NATURAL_HAZARDS };
export * from './hazards';

/**
 * Standard movement costs for base terrain types.
 */
export const TERRAIN_RULES: Record<BattleMapTerrain, TerrainRule> = {
  grass: {
    id: 'grass',
    name: 'Grass',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  rock: {
    id: 'rock',
    name: 'Rocky Ground',
    movementCost: 1, // Uneven but solid
    cover: 'none',
    stealthAdvantage: false
  },
  water: {
    id: 'water',
    name: 'Deep Water',
    movementCost: 2, // Swimming is difficult terrain usually
    cover: 'three_quarters', // Submerged
    stealthAdvantage: true,
    // Example: Water could have 'Strong Current' in specific maps,
    // but base water is just difficult.
    // We can leave this optional or add a low-level hazard if needed.
  },
  difficult: {
    id: 'difficult',
    name: 'Difficult Terrain',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  wall: {
    id: 'wall',
    name: 'Wall',
    movementCost: 999, // Impassable
    cover: 'total',
    stealthAdvantage: true
  },
  floor: {
    id: 'floor',
    name: 'Stone Floor',
    movementCost: 1,
    cover: 'none',
    stealthAdvantage: false
  },
  sand: {
    id: 'sand',
    name: 'Deep Sand',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  },
  mud: {
    id: 'mud',
    name: 'Thick Mud',
    movementCost: 2,
    cover: 'none',
    stealthAdvantage: false
  }
};

/**
 * Calculates how weather conditions affect a specific spell.
 * @param weather The current weather state.
 * @param spell The spell being cast.
 * @returns Array of modifiers to apply to the spell.
 */
export function getWeatherModifiers(
  weather: WeatherState,
  spell: Spell
): SpellModifier[] {
  const modifiers: SpellModifier[] = [];

  // 1. Precipitation Effects on Fire/Cold/Lightning
  if (spell.effects.some(e => e.type === 'DAMAGE')) {
     const damageEffects = spell.effects.filter(e => e.type === 'DAMAGE');
     const hasFire = damageEffects.some(e => (e as any).damage.type === 'Fire');
     const hasCold = damageEffects.some(e => (e as any).damage.type === 'Cold');
     const hasLightning = damageEffects.some(e => (e as any).damage.type === 'Lightning');

     if (hasFire && (weather.precipitation === 'heavy_rain' || weather.precipitation === 'storm')) {
       modifiers.push({
         type: 'damage',
         value: 0.5,
         reason: 'Heavy rain dampens fire magic'
       });
     }

     if (hasCold && weather.temperature === 'freezing') {
       // Cold spells might be more potent or unchanged, 5e usually doesn't boost,
       // but strictly speaking, heavy snow imposes disadvantage on ranged attacks.
     }

     if (hasLightning && weather.precipitation === 'storm') {
        // Thematic bonus, perhaps? Standard 5e is conservative, but let's add a small mechanic for flavor/tactics.
        // Actually, Call Lightning specifically benefits from storms.
        if (spell.name === 'Call Lightning') {
           modifiers.push({
             type: 'damage',
             value: 1.5, // Or +1d10 per spell desc, simplified here as multiplier
             reason: 'Existing storm boosts Call Lightning'
           });
        }
     }
  }

  // 2. Wind Effects on Ranged Attacks
  if (spell.attackType === 'ranged') {
    if (weather.wind.speed === 'strong' || weather.wind.speed === 'gale') {
      modifiers.push({
        type: 'attack',
        value: -2, // Flat penalty to hit
        reason: 'Strong winds buffet the projectile'
      });
    }
  }

  // 3. Visibility Effects on Range
  if (weather.visibility === 'heavily_obscured') {
     // Heavy fog/blizzard
     // Technically affects LoS, but we can model a range penalty if LoS isn't fully blocked
  }

  return modifiers;
}

/**
 * Gets the movement cost for a specific terrain type.
 */
export function getTerrainMovementCost(terrain: BattleMapTerrain): number {
  return TERRAIN_RULES[terrain]?.movementCost ?? 1;
}

/**
 * Determines cover provided by a terrain type.
 */
export function getTerrainCover(terrain: BattleMapTerrain): string {
  return TERRAIN_RULES[terrain]?.cover ?? 'none';
}

/**
 * Gets the intrinsic hazards for a terrain type.
 */
export function getTerrainHazards(terrain: BattleMapTerrain): EnvironmentalHazard[] {
  return TERRAIN_RULES[terrain]?.hazards || [];
}

/**
 * Default safe weather state.
 */
export const DEFAULT_WEATHER: WeatherState = {
  precipitation: 'none',
  temperature: 'temperate',
  wind: { direction: 'north', speed: 'calm' },
  visibility: 'clear'
};
