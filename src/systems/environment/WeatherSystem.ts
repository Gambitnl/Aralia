
/**
 * @file src/systems/environment/WeatherSystem.ts
 * Manages weather transitions and climate definitions.
 * Ecologist System: Weather should change dynamically based on the environment.
 */

import { WeatherState, Precipitation, WindSpeed, Temperature, VisibilityLevel } from '../../types/environment';

/**
 * Defines the probability distribution for weather in a specific climate.
 */
export interface ClimateProfile {
    id: string;
    name: string;
    precipitationChances: Record<Precipitation, number>; // 0-1
    temperatureChances: Record<Temperature, number>;
    windChances: Record<WindSpeed, number>;
}

/**
 * Standard climate definitions mapped to biome IDs.
 */
export const CLIMATES: Record<string, ClimateProfile> = {
    'plains': {
        id: 'plains',
        name: 'Temperate Plains',
        precipitationChances: {
            'none': 0.7,
            'light_rain': 0.2,
            'heavy_rain': 0.08,
            'storm': 0.02,
            'snow': 0,
            'blizzard': 0
        },
        temperatureChances: {
            'freezing': 0.05,
            'cold': 0.1,
            'temperate': 0.7,
            'hot': 0.15,
            'extreme_heat': 0
        },
        windChances: {
            'calm': 0.2,
            'light': 0.5,
            'moderate': 0.2,
            'strong': 0.1,
            'gale': 0
        }
    },
    'forest': {
        id: 'forest',
        name: 'Dense Forest',
        precipitationChances: {
            'none': 0.6,
            'light_rain': 0.25,
            'heavy_rain': 0.1,
            'storm': 0.05,
            'snow': 0,
            'blizzard': 0
        },
        temperatureChances: {
            'freezing': 0.05,
            'cold': 0.15,
            'temperate': 0.7,
            'hot': 0.1,
            'extreme_heat': 0
        },
        windChances: {
            'calm': 0.4,
            'light': 0.4,
            'moderate': 0.15,
            'strong': 0.05,
            'gale': 0
        }
    },
    'desert': {
        id: 'desert',
        name: 'Arid Desert',
        precipitationChances: {
            'none': 0.95,
            'light_rain': 0.04,
            'heavy_rain': 0.01,
            'storm': 0,
            'snow': 0,
            'blizzard': 0
        },
        temperatureChances: {
            'freezing': 0.1, // Cold nights
            'cold': 0.1,
            'temperate': 0.2,
            'hot': 0.4,
            'extreme_heat': 0.2
        },
        windChances: {
            'calm': 0.3,
            'light': 0.3,
            'moderate': 0.2,
            'strong': 0.15,
            'gale': 0.05 // Sandstorms
        }
    },
    'tundra': {
        id: 'tundra',
        name: 'Frozen Tundra',
        precipitationChances: {
            'none': 0.5,
            'light_rain': 0.05,
            'heavy_rain': 0,
            'storm': 0.05,
            'snow': 0.3,
            'blizzard': 0.1
        },
        temperatureChances: {
            'freezing': 0.7,
            'cold': 0.25,
            'temperate': 0.05,
            'hot': 0,
            'extreme_heat': 0
        },
        windChances: {
            'calm': 0.1,
            'light': 0.2,
            'moderate': 0.4,
            'strong': 0.2,
            'gale': 0.1
        }
    },
    'swamp': {
        id: 'swamp',
        name: 'Humid Swamp',
        precipitationChances: {
            'none': 0.5,
            'light_rain': 0.3,
            'heavy_rain': 0.15,
            'storm': 0.05,
            'snow': 0,
            'blizzard': 0
        },
        temperatureChances: {
            'freezing': 0.05,
            'cold': 0.15,
            'temperate': 0.5,
            'hot': 0.3,
            'extreme_heat': 0
        },
        windChances: {
            'calm': 0.6,
            'light': 0.3,
            'moderate': 0.1,
            'strong': 0,
            'gale': 0
        }
    }
};

/**
 * Gets the climate profile for a given biome ID.
 * Defaults to 'plains' if biome is unknown.
 */
export function getClimateForBiome(biomeId: string): ClimateProfile {
    // Normalize biome ID (handle variations like 'forest_clearing' -> 'forest')
    const normalizedId = Object.keys(CLIMATES).find(key => biomeId.includes(key)) || 'plains';
    return CLIMATES[normalizedId];
}

/**
 * Helper to select a key from a probability map.
 */
function weightedRandom<T extends string>(probabilities: Record<T, number>): T {
    const rand = Math.random();
    let sum = 0;
    const keys = Object.keys(probabilities) as T[];

    for (const key of keys) {
        sum += probabilities[key];
        if (rand < sum) return key;
    }
    return keys[0]; // Fallback
}

/**
 * Updates the weather state based on the current biome's climate.
 * Should be called at the start of a new round or significant time interval.
 *
 * @param currentWeather The current weather state.
 * @param biomeId The ID of the current biome.
 * @returns The new WeatherState (may be same as current).
 */
export function updateWeather(currentWeather: WeatherState, biomeId: string): WeatherState {
    const climate = getClimateForBiome(biomeId);

    // Simple Markov-like transition:
    // 80% chance to stay same, 20% chance to reroll based on climate weights.
    // This prevents chaotic weather flipping every round.
    if (Math.random() > 0.2) {
        return currentWeather;
    }

    const newPrecipitation = weightedRandom(climate.precipitationChances);
    const newTemperature = weightedRandom(climate.temperatureChances);
    const newWindSpeed = weightedRandom(climate.windChances);

    // Determine visibility based on precipitation
    let newVisibility: VisibilityLevel = 'clear';
    if (newPrecipitation === 'heavy_rain' || newPrecipitation === 'snow') {
        newVisibility = 'lightly_obscured';
    } else if (newPrecipitation === 'storm' || newPrecipitation === 'blizzard') {
        newVisibility = 'heavily_obscured';
    } else if (newWindSpeed === 'gale' && (biomeId.includes('desert'))) {
        newVisibility = 'heavily_obscured'; // Sandstorm
    }

    return {
        precipitation: newPrecipitation,
        temperature: newTemperature,
        wind: {
            direction: currentWeather.wind.direction, // Keep direction for now, or randomize
            speed: newWindSpeed
        },
        visibility: newVisibility
    };
}

// TODO(Ecologist): Integrate this system into useTurnManager.ts or the main Game Loop.
// Example usage in useTurnManager.ts:
// import { updateWeather } from '../../systems/environment/WeatherSystem';
// ...
// if (isNewRound) {
//    const newWeather = updateWeather(currentWeather, currentBiomeId);
//    if (newWeather !== currentWeather) {
//        updateEnvironmentState(newWeather);
//        log("Weather changed to " + newWeather.precipitation);
//    }
// }
