
/**
 * @file src/systems/environment/WeatherSystem.ts
 * Manages weather transitions and climate definitions.
 * Ecologist System: Weather should change dynamically based on the environment.
 */

import { WeatherState, Precipitation, WindSpeed, Temperature, VisibilityLevel } from '../../types/environment';
import { TimeOfDay } from '../../utils/timeUtils';

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
 * Shifts the temperature index based on time of day and biome modifiers.
 */
function adjustTemperatureForTime(baseTemp: Temperature, timeOfDay: TimeOfDay, biomeId: string): Temperature {
    const temps: Temperature[] = ['freezing', 'cold', 'temperate', 'hot', 'extreme_heat'];
    const idx = temps.indexOf(baseTemp);

    let newIdx = idx;

    // Night makes it colder
    if (timeOfDay === TimeOfDay.Night) {
        newIdx = Math.max(0, idx - 1);
    }
    // Desert days are hotter
    else if (biomeId.includes('desert') && timeOfDay === TimeOfDay.Day) {
        newIdx = Math.min(temps.length - 1, idx + 1);
    }

    return temps[newIdx];
}

/**
 * Determines the base visibility from weather conditions.
 */
function calculateBaseVisibility(precipitation: Precipitation, windSpeed: WindSpeed, biomeId: string): VisibilityLevel {
    if (precipitation === 'heavy_rain' || precipitation === 'snow') {
        return 'lightly_obscured';
    } else if (precipitation === 'storm' || precipitation === 'blizzard') {
        return 'heavily_obscured';
    } else if (windSpeed === 'gale' && (biomeId.includes('desert'))) {
        return 'heavily_obscured'; // Sandstorm
    }
    return 'clear';
}

/**
 * Adjusts visibility based on Time of Day and precipitation.
 */
function adjustVisibilityForTime(baseVisibility: VisibilityLevel, timeOfDay: TimeOfDay): VisibilityLevel {
    // Night is always heavy darkness
    if (timeOfDay === TimeOfDay.Night) {
        return 'heavily_obscured';
    }

    // Dawn/Dusk is dim light (lightly obscured), unless already heavy (e.g. storm)
    if ((timeOfDay === TimeOfDay.Dawn || timeOfDay === TimeOfDay.Dusk)) {
        if (baseVisibility === 'clear') {
            return 'lightly_obscured';
        }
    }

    return baseVisibility;
}


/**
 * Updates the weather state based on the current biome's climate.
 * Should be called at the start of a new round or significant time interval.
 *
 * @param currentWeather The current weather state.
 * @param biomeId The ID of the current biome.
 * @param timeOfDay The current time of day (optional, defaults to Day if unknown)
 * @returns The new WeatherState (may be same as current).
 */
export function updateWeather(currentWeather: WeatherState, biomeId: string, timeOfDay: TimeOfDay = TimeOfDay.Day): WeatherState {
    const climate = getClimateForBiome(biomeId);

    // Determines if we are keeping the current "base" weather pattern
    const keepBaseWeather = Math.random() > 0.2;

    let basePrecipitation = currentWeather.precipitation;
    let baseTemp = currentWeather.baseTemperature || currentWeather.temperature; // Fallback for migration
    let baseWind = currentWeather.wind;
    let baseVisibility: VisibilityLevel;

    if (!keepBaseWeather) {
        // Generate NEW base weather
        basePrecipitation = weightedRandom(climate.precipitationChances);
        baseTemp = weightedRandom(climate.temperatureChances);
        const newWindSpeed = weightedRandom(climate.windChances);
        baseWind = {
            direction: currentWeather.wind.direction,
            speed: newWindSpeed
        };

        baseVisibility = calculateBaseVisibility(basePrecipitation, newWindSpeed, biomeId);
    } else {
        // Keep existing base
        // If baseVisibility is missing (migration), calculate it from CURRENT precip/wind
        // This fixes the bug where "Storm" (implied heavy obscured) migrated to "Clear" base.
        baseVisibility = currentWeather.baseVisibility || calculateBaseVisibility(basePrecipitation, baseWind.speed, biomeId);
    }

    // Now apply Time of Day modifiers to the BASE values
    const effectiveTemp = adjustTemperatureForTime(baseTemp, timeOfDay, biomeId);
    const effectiveVisibility = adjustVisibilityForTime(baseVisibility, timeOfDay);

    return {
        precipitation: basePrecipitation,
        temperature: effectiveTemp,
        wind: baseWind,
        visibility: effectiveVisibility,
        baseTemperature: baseTemp,
        baseVisibility: baseVisibility
    };
}

// TODO(Ecologist): Integrate this system into useTurnManager.ts to update environment on round start.
// Example:
// if (isNewRound) {
//    const timeOfDay = getTimeOfDay(currentState.time);
//    const newWeather = updateWeather(currentWeather, currentBiomeId, timeOfDay);
//    if (newWeather !== currentWeather) updateEnvironmentState(newWeather);
// }
