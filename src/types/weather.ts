export type Temperature = 'freezing' | 'cold' | 'moderate' | 'hot' | 'scorching';
export type Precipitation = 'none' | 'light_rain' | 'heavy_rain' | 'storm' | 'snow' | 'blizzard';
export type WindSpeed = 'calm' | 'light' | 'moderate' | 'strong' | 'gale';
export type VisibilityLevel = 'clear' | 'lightly_obscured' | 'heavily_obscured';
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface WindCondition {
  direction: Direction;
  speed: WindSpeed;
}

/**
 * Current weather conditions affecting gameplay.
 * Weather affects visibility, travel, and spell effectiveness.
 */
export interface WeatherState {
  precipitation: Precipitation;
  temperature: Temperature;
  wind: WindCondition;
  visibility: VisibilityLevel;
  // Future extensibility: magical weather effects
  specialCondition?: 'none' | 'magical_darkness' | 'acid_rain' | 'psychic_mist';
}

export interface WeatherEffect {
  type: 'movement_cost' | 'visibility' | 'damage_modifier' | 'attack_penalty' | 'save_modifier';
  value: number;
  condition?: string; // e.g. "fire_damage", "ranged_attack"
  description: string;
}
