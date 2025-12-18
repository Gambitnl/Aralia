
/**
 * @file src/types/environment.ts
 * Defines types and interfaces for the environmental system, including
 * weather, terrain mechanics, and hazards.
 */

import { BattleMapTerrain } from './combat';
import { Spell, DamageType } from './spells';

// --- Weather System ---

export type Precipitation = 'none' | 'light_rain' | 'heavy_rain' | 'storm' | 'snow' | 'blizzard';
export type WindSpeed = 'calm' | 'light' | 'moderate' | 'strong' | 'gale';
export type VisibilityLevel = 'clear' | 'lightly_obscured' | 'heavily_obscured';
export type Temperature = 'freezing' | 'cold' | 'temperate' | 'hot' | 'extreme_heat';

export interface WindCondition {
  direction: 'north' | 'south' | 'east' | 'west' | 'variable';
  speed: WindSpeed;
}

/**
 * Represents the current global weather conditions.
 */
export interface WeatherState {
  precipitation: Precipitation;
  temperature: Temperature;
  wind: WindCondition;
  visibility: VisibilityLevel;
}

// --- Terrain System ---

export type CoverType = 'none' | 'half' | 'three_quarters' | 'total';

/**
 * Defines the mechanical rules for a specific terrain type.
 */
export interface TerrainRule {
  id: BattleMapTerrain;
  name: string;
  movementCost: number; // 1 = normal, 2 = difficult
  cover: CoverType;
  stealthAdvantage: boolean; // Provides natural cover for hiding
  hazards?: EnvironmentalHazard[];
}

// --- Hazard System ---

export interface EnvironmentalHazard {
  id: string;
  name: string;
  description: string;
  trigger: 'enter' | 'start_turn' | 'end_turn';
  effectType: 'damage' | 'status' | 'movement';
  damage?: {
    dice: string;
    type: DamageType;
  };
  saveDC?: number;
}

// --- Interaction Interfaces ---

export interface SpellModifier {
  type: 'damage' | 'attack' | 'range' | 'save_dc';
  value: number; // Multiplier for damage, flat bonus/penalty for others
  reason: string;
}
