/**
 * @file src/types/environment/weather.ts
 *
 * Defines the types for the Mechanical Weather System.
 * This system provides concrete gameplay effects based on environmental conditions,
 * rather than just flavor text.
 */

export type PrecipitationType = 'none' | 'light_rain' | 'heavy_rain' | 'storm' | 'snow' | 'blizzard';
export type WindSpeed = 'calm' | 'light' | 'moderate' | 'strong' | 'gale';
export type VisibilityLevel = 'clear' | 'lightly_obscured' | 'heavily_obscured';
export type TemperatureBand = 'freezing' | 'cold' | 'temperate' | 'hot' | 'scorching';

export interface WindCondition {
  speed: WindSpeed;
  direction: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
}

export interface WeatherState {
  precipitation: PrecipitationType;
  wind: WindCondition;
  visibility: VisibilityLevel;
  temperature: TemperatureBand;
}

/**
 * Represents a mechanical modifier applied by the environment.
 */
export interface EnvironmentModifier {
  /** Multiplier for movement cost (e.g., 2.0 = double cost / difficult terrain) */
  movementCostMultiplier?: number;

  /** Multiplier for damage of certain types (e.g., 0.5 for fire in rain) */
  damageMultiplier?: {
    type: string; // e.g., 'fire', 'cold', 'lightning'
    value: number;
  }[];

  /** Penalty or bonus to attack rolls (e.g., -2 for ranged attacks in strong wind) */
  attackModifier?: {
    type: 'ranged' | 'melee' | 'spell';
    value: number;
  };

  /** Percentage chance of spell failure (concentration checks etc could be modeled elsewhere, this is raw failure) */
  spellFailureChance?: number;

  /** Description of the effect for UI */
  description: string[];
}
