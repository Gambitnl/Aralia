export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'heatwave' | 'ashfall';
export type WindCondition = 'calm' | 'breezy' | 'windy' | 'gale';
export type TemperatureCondition = 'freezing' | 'cold' | 'mild' | 'warm' | 'hot' | 'scorching';

export interface WeatherState {
  condition: WeatherCondition;
  wind: WindCondition;
  temperature: TemperatureCondition;
  description: string;
  /** Multiplier for travel time. > 1.0 means slower travel. */
  travelModifier: number;
  /** Multiplier for visibility range. < 1.0 means reduced visibility. */
  visibilityModifier: number;
  /** Game day when this weather was generated */
  lastUpdatedDay: number;
}
