import {
  WeatherState,
  WeatherCondition,
  WindCondition,
  TemperatureCondition
} from '../../types/weather';
import { GameState } from '../../types';
import { SeededRandom } from '../../utils/seededRandom';
import { Season, getSeason, getGameDay, TimeOfDay, getTimeOfDay } from '../../utils/timeUtils';
import { BIOMES } from '../../data/biomes';

export const WEATHER_CONDITIONS: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'heatwave', 'ashfall'];

interface WeatherProfile {
  weights: Record<WeatherCondition, number>;
}

// Default weather weights for each season (generic)
const SEASONAL_PROFILES: Record<Season, WeatherProfile> = {
  [Season.Spring]: {
    weights: {
      clear: 30, cloudy: 30, rain: 30, storm: 5, fog: 5,
      snow: 0, heatwave: 0, ashfall: 0
    }
  },
  [Season.Summer]: {
    weights: {
      clear: 50, cloudy: 20, rain: 10, storm: 10, heatwave: 10,
      fog: 0, snow: 0, ashfall: 0
    }
  },
  [Season.Autumn]: {
    weights: {
      clear: 30, cloudy: 30, rain: 20, storm: 10, fog: 10,
      snow: 0, heatwave: 0, ashfall: 0
    }
  },
  [Season.Winter]: {
    weights: {
      clear: 20, cloudy: 30, snow: 40, storm: 5, fog: 5,
      rain: 0, heatwave: 0, ashfall: 0
    }
  }
};

// Biome overrides (multipliers applied to base weights)
const BIOME_MODIFIERS: Record<string, Partial<Record<WeatherCondition, number>>> = {
  'desert': {
    rain: 0.1, storm: 0.1, snow: 0, fog: 0, heatwave: 5.0, clear: 2.0
  },
  'swamp': {
    fog: 3.0, rain: 2.0, clear: 0.5
  },
  'mountain': {
    snow: 2.0, storm: 2.0, fog: 1.5
  },
  'cave': {
    // Underground usually has static "weather" or none
    clear: 100, cloudy: 0, rain: 0, storm: 0, snow: 0, fog: 0, heatwave: 0, ashfall: 0
  },
  'dungeon': {
    clear: 100, cloudy: 0, rain: 0, storm: 0, snow: 0, fog: 0, heatwave: 0, ashfall: 0
  },
  'underdark': {
    clear: 100, cloudy: 0, rain: 0, storm: 0, snow: 0, fog: 0, heatwave: 0, ashfall: 0
  }
};

/**
 * Generates the daily weather based on current game state (season, biome).
 */
export function generateDailyWeather(state: GameState, rng: SeededRandom): WeatherState {
  const date = state.gameTime;
  const season = getSeason(date);
  const currentBiomeId = getBiomeId(state);

  // 1. Determine Condition
  const baseProfile = SEASONAL_PROFILES[season];
  const modifiers = BIOME_MODIFIERS[currentBiomeId] || {};

  const weightedConditions: { condition: WeatherCondition; weight: number }[] = [];

  for (const condition of WEATHER_CONDITIONS) {
    let weight = baseProfile.weights[condition] || 0;
    if (modifiers[condition] !== undefined) {
      weight *= modifiers[condition]!;
    }
    if (weight > 0) {
      weightedConditions.push({ condition, weight });
    }
  }

  // Fallback if no weights (shouldn't happen with defaults)
  if (weightedConditions.length === 0) {
      weightedConditions.push({ condition: 'clear', weight: 1 });
  }

  const selectedCondition = weightedSelect(weightedConditions, rng);

  // 2. Determine Wind & Temp based on condition + season
  const { wind, temperature } = deriveAttributes(selectedCondition, season, rng);

  // 3. Determine Effects
  const { travelModifier, visibilityModifier, description } = deriveEffects(selectedCondition, wind, temperature);

  return {
    condition: selectedCondition,
    wind,
    temperature,
    description,
    travelModifier,
    visibilityModifier,
    lastUpdatedDay: getGameDay(date)
  };
}

function getBiomeId(state: GameState): string {
  if (state.mapData && state.currentLocationId) {
    // Parse coords from ID if possible, or look up location
    // Simplified: assume we can get it from mapData using parsed ID
    const parts = state.currentLocationId.split('_');
    if (parts.length >= 3) {
      const x = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (!isNaN(x) && !isNaN(y) && state.mapData.tiles[y]?.[x]) {
        return state.mapData.tiles[y][x].biomeId;
      }
    }
  }
  return 'plains'; // Fallback
}

function weightedSelect(options: { condition: WeatherCondition; weight: number }[], rng: SeededRandom): WeatherCondition {
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
  let randomVal = rng.next() * totalWeight;

  for (const opt of options) {
    randomVal -= opt.weight;
    if (randomVal <= 0) return opt.condition;
  }
  return options[options.length - 1].condition;
}

function deriveAttributes(condition: WeatherCondition, season: Season, rng: SeededRandom): { wind: WindCondition; temperature: TemperatureCondition } {
  let wind: WindCondition = 'calm';
  let temperature: TemperatureCondition = 'mild';

  // Wind logic
  if (condition === 'storm') {
    wind = rng.next() > 0.5 ? 'gale' : 'windy';
  } else if (condition === 'rain' || condition === 'snow') {
    wind = rng.next() > 0.7 ? 'windy' : 'breezy';
  } else {
    wind = rng.next() > 0.8 ? 'breezy' : 'calm';
  }

  // Temperature logic
  switch (season) {
    case Season.Winter:
      temperature = rng.next() > 0.6 ? 'freezing' : 'cold';
      break;
    case Season.Spring:
      temperature = rng.next() > 0.5 ? 'mild' : 'cold';
      break;
    case Season.Summer:
      temperature = rng.next() > 0.3 ? 'warm' : 'hot';
      if (condition === 'heatwave') temperature = 'scorching';
      break;
    case Season.Autumn:
      temperature = rng.next() > 0.5 ? 'mild' : 'cold';
      break;
  }

  if (condition === 'snow') temperature = 'freezing'; // Force freezing for snow

  return { wind, temperature };
}

function deriveEffects(condition: WeatherCondition, wind: WindCondition, temperature: TemperatureCondition): { travelModifier: number; visibilityModifier: number; description: string } {
  let travelModifier = 1.0;
  let visibilityModifier = 1.0;
  let descParts: string[] = [];

  // Condition Effects
  switch (condition) {
    case 'storm':
      travelModifier = 2.0;
      visibilityModifier = 0.5;
      descParts.push("A fierce storm rages.");
      break;
    case 'rain':
      travelModifier = 1.2;
      visibilityModifier = 0.8;
      descParts.push("Rain falls steadily.");
      break;
    case 'snow':
      travelModifier = 1.5;
      visibilityModifier = 0.7;
      descParts.push("Snow blankets the ground.");
      break;
    case 'fog':
      travelModifier = 1.3; // Careful movement
      visibilityModifier = 0.3;
      descParts.push("Thick fog obscures your vision.");
      break;
    case 'heatwave':
      travelModifier = 1.5; // Rest needed
      descParts.push("The heat is oppressive.");
      break;
    case 'cloudy':
      descParts.push("Clouds cover the sky.");
      break;
    case 'clear':
      descParts.push("The sky is clear.");
      break;
  }

  // Wind/Temp Effects
  if (wind === 'gale') descParts.push("Gale-force winds howl.");
  if (temperature === 'freezing') descParts.push("It is freezing cold.");
  else if (temperature === 'scorching') descParts.push("The air burns your skin.");

  return {
    travelModifier,
    visibilityModifier,
    description: descParts.join(' ')
  };
}
