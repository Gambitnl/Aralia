/**
 * @file src/systems/weather/WeatherSystem.ts
 * Implements the logic for generating daily weather and determining its effects on travel.
 */

import { WeatherState, Precipitation, Temperature, WindSpeed, VisibilityLevel } from '../../types/environment';
import { Season } from '../../utils/timeUtils';
import { SeededRandom } from '../../utils/seededRandom';

// Define Probabilities for transitions based on Season and Biome
// Simplified model: Each Biome has a 'Climate Profile'
// We will generate the next state based on the current state (persistence) and the profile.

interface ClimateProfile {
  precipitationChance: number; // Base chance of ANY precipitation
  stormChance: number; // Chance that precipitation is a STORM/HEAVY
  tempOffset: number; // relative to season baseline (0)
  windiness: number; // 0-1, chance of high wind
}

const BIOME_CLIMATES: Record<string, ClimateProfile> = {
  forest: { precipitationChance: 0.3, stormChance: 0.2, tempOffset: 0, windiness: 0.2 },
  plains: { precipitationChance: 0.2, stormChance: 0.3, tempOffset: 0, windiness: 0.4 }, // Windy
  mountain: { precipitationChance: 0.4, stormChance: 0.4, tempOffset: -1, windiness: 0.6 }, // Cold, windy
  swamp: { precipitationChance: 0.5, stormChance: 0.1, tempOffset: 1, windiness: 0.1 }, // Humid, still
  desert: { precipitationChance: 0.05, stormChance: 0.1, tempOffset: 2, windiness: 0.3 }, // Dry, Hot
  tundra: { precipitationChance: 0.3, stormChance: 0.5, tempOffset: -2, windiness: 0.5 }, // Cold
  default: { precipitationChance: 0.25, stormChance: 0.2, tempOffset: 0, windiness: 0.2 },
};

/**
 * Generates the weather for a new day.
 * @param previousWeather The weather of the previous day (for persistence).
 * @param biomeId The current biome of the player.
 * @param season The current season.
 * @param rng SeededRandom instance.
 */
export function generateDailyWeather(
  previousWeather: WeatherState,
  biomeId: string,
  season: Season,
  rng: SeededRandom
): WeatherState {
  const profile = BIOME_CLIMATES[biomeId] || BIOME_CLIMATES['default'];

  // 1. Determine Temperature
  // Base temperature by season
  let baseTempVal = 0; // Temperate
  switch (season) {
    case Season.Winter: baseTempVal = -1; break; // Cold
    case Season.Spring: baseTempVal = 0; break;
    case Season.Summer: baseTempVal = 1; break; // Hot
    case Season.Autumn: baseTempVal = 0; break;
  }

  // Adjust by biome
  let finalTempVal = baseTempVal + profile.tempOffset;

  // Random fluctuation (-1, 0, +1)
  const fluctuation = Math.floor(rng.next() * 3) - 1;
  finalTempVal += fluctuation;

  // Clamp -2 (Freezing) to 2 (Extreme Heat)
  // Mapping: -2: freezing, -1: cold, 0: temperate, 1: hot, 2: extreme_heat
  let temperature: Temperature = 'temperate';
  if (finalTempVal <= -2) temperature = 'freezing';
  else if (finalTempVal === -1) temperature = 'cold';
  else if (finalTempVal === 0) temperature = 'temperate';
  else if (finalTempVal === 1) temperature = 'hot';
  else temperature = 'extreme_heat';

  // 2. Determine Precipitation
  // Persistence: If it was raining, 50% chance to continue (modified by profile)
  const isCurrentlyRaining = previousWeather.precipitation !== 'none';
  let precipChance = profile.precipitationChance;

  // Seasonal adjustments
  if (season === Season.Spring || season === Season.Autumn) precipChance += 0.1;
  if (season === Season.Winter && temperature !== 'freezing') precipChance += 0.1; // Winter rain

  // Persistence bonus
  if (isCurrentlyRaining) precipChance += 0.3;

  let precipitation: Precipitation = 'none';
  if (rng.next() < precipChance) {
    // It is precipitating. Determine type and intensity.
    const isStorm = rng.next() < profile.stormChance;

    if (temperature === 'freezing') {
       precipitation = isStorm ? 'blizzard' : 'snow';
    } else {
       if (isStorm) precipitation = 'storm';
       else precipitation = rng.next() < 0.5 ? 'heavy_rain' : 'light_rain';
    }
  }

  // 3. Determine Wind
  let windSpeed: WindSpeed = 'calm';
  let windRoll = rng.next();
  // Modify wind roll by profile
  if (windRoll < profile.windiness) {
     // Windy day
     const severity = rng.next();
     if (severity < 0.5) windSpeed = 'moderate';
     else if (severity < 0.8) windSpeed = 'strong';
     else windSpeed = 'gale';
  } else {
     windSpeed = rng.next() < 0.5 ? 'calm' : 'light';
  }

  // Storms always have at least strong wind
  if (precipitation === 'storm' || precipitation === 'blizzard') {
      if (windSpeed === 'calm' || windSpeed === 'light' || windSpeed === 'moderate') {
          windSpeed = 'strong';
      }
  }

  // 4. Determine Visibility
  let visibility: VisibilityLevel = 'clear';
  if (precipitation === 'heavy_rain' || precipitation === 'snow') visibility = 'lightly_obscured';
  if (precipitation === 'storm' || precipitation === 'blizzard') visibility = 'heavily_obscured';
  if (visibility === 'clear' && rng.next() < 0.1) visibility = 'lightly_obscured'; // Random fog

  return {
    temperature,
    precipitation,
    wind: {
      direction: 'north', // Simplified, could be random
      speed: windSpeed
    },
    visibility
  };
}

/**
 * Returns a travel cost multiplier based on weather conditions.
 * > 1.0 means slower travel.
 */
export function getWeatherTravelModifier(weather: WeatherState): number {
  let multiplier = 1.0;

  // Precipitation
  switch (weather.precipitation) {
    case 'light_rain': multiplier += 0.1; break;
    case 'heavy_rain': multiplier += 0.25; break;
    case 'storm': multiplier += 0.5; break;
    case 'snow': multiplier += 0.25; break;
    case 'blizzard': multiplier += 0.75; break; // Nearly double travel time
    case 'none': break;
  }

  // Wind (Headwinds assumed to cancel out tailwinds on average, but strong winds always slow group cohesion)
  switch (weather.wind.speed) {
    case 'strong': multiplier += 0.1; break;
    case 'gale': multiplier += 0.25; break;
  }

  // Temperature
  if (weather.temperature === 'extreme_heat') multiplier += 0.2; // Frequent rests
  if (weather.temperature === 'freezing') multiplier += 0.1;

  // Visibility (Fog slows down to avoid getting lost)
  if (weather.visibility === 'heavily_obscured') multiplier += 0.3;

  return Number(multiplier.toFixed(2));
}

/**
 * Generates a descriptive string for the weather.
 */
export function getWeatherDescription(weather: WeatherState): string {
  const parts: string[] = [];

  // Temp
  switch (weather.temperature) {
    case 'freezing': parts.push('bitterly cold'); break;
    case 'cold': parts.push('chilly'); break;
    case 'hot': parts.push('swelteringly hot'); break;
    case 'extreme_heat': parts.push('dangerously hot'); break;
    // temperate is omitted (default)
  }

  // Wind
  if (weather.wind.speed === 'strong') parts.push('windy');
  if (weather.wind.speed === 'gale') parts.push('gale-force winds');

  // Precip
  switch (weather.precipitation) {
    case 'light_rain': parts.push('raining lightly'); break;
    case 'heavy_rain': parts.push('pouring rain'); break;
    case 'storm': parts.push('storming violently'); break;
    case 'snow': parts.push('snowing'); break;
    case 'blizzard': parts.push('caught in a blizzard'); break;
  }

  if (parts.length === 0) return "The weather is clear and temperate.";

  return "It is " + parts.join(" and ") + ".";
}
