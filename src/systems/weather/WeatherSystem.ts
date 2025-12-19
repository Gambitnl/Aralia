/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/weather/WeatherSystem.ts
 * Manages dynamic weather generation based on seasons and biomes.
 */

import { Season } from '../../utils/timeUtils';
import {
    WeatherState,
    Precipitation,
    Temperature,
    WindSpeed,
    VisibilityLevel,
    WindCondition
} from '../../types/environment';
import { SeededRandom } from '../../utils/seededRandom';

/**
 * Probability tables for weather conditions based on Season.
 * Represents the chance of a condition occurring given the season.
 * Note: These are simplified baselines for a Temperate/Continental region.
 */
type WeatherProbabilities = {
    precipitation: Record<Precipitation, number>;
    temperature: Record<Temperature, number>;
    wind: Record<WindSpeed, number>;
};

const SEASONAL_PROBABILITIES: Record<Season, WeatherProbabilities> = {
    [Season.Spring]: {
        precipitation: {
            'none': 0.5,
            'light_rain': 0.3,
            'heavy_rain': 0.15,
            'storm': 0.05,
            'snow': 0.0,
            'blizzard': 0.0
        },
        temperature: {
            'freezing': 0.05,
            'cold': 0.2,
            'temperate': 0.7,
            'hot': 0.05,
            'extreme_heat': 0.0
        },
        wind: {
            'calm': 0.3,
            'light': 0.4,
            'moderate': 0.2,
            'strong': 0.1,
            'gale': 0.0
        }
    },
    [Season.Summer]: {
        precipitation: {
            'none': 0.7,
            'light_rain': 0.2,
            'heavy_rain': 0.05,
            'storm': 0.05,
            'snow': 0.0,
            'blizzard': 0.0
        },
        temperature: {
            'freezing': 0.0,
            'cold': 0.0,
            'temperate': 0.3,
            'hot': 0.6,
            'extreme_heat': 0.1
        },
        wind: {
            'calm': 0.5,
            'light': 0.4,
            'moderate': 0.1,
            'strong': 0.0,
            'gale': 0.0
        }
    },
    [Season.Autumn]: {
        precipitation: {
            'none': 0.5,
            'light_rain': 0.3,
            'heavy_rain': 0.15,
            'storm': 0.05,
            'snow': 0.0,
            'blizzard': 0.0
        },
        temperature: {
            'freezing': 0.1,
            'cold': 0.4,
            'temperate': 0.5,
            'hot': 0.0,
            'extreme_heat': 0.0
        },
        wind: {
            'calm': 0.2,
            'light': 0.3,
            'moderate': 0.3,
            'strong': 0.2,
            'gale': 0.0
        }
    },
    [Season.Winter]: {
        precipitation: {
            'none': 0.4,
            'light_rain': 0.1, // Sleet/Freezing rain
            'heavy_rain': 0.0,
            'storm': 0.1, // Winter storm
            'snow': 0.3,
            'blizzard': 0.1
        },
        temperature: {
            'freezing': 0.6,
            'cold': 0.4,
            'temperate': 0.0,
            'hot': 0.0,
            'extreme_heat': 0.0
        },
        wind: {
            'calm': 0.2,
            'light': 0.3,
            'moderate': 0.3,
            'strong': 0.15,
            'gale': 0.05
        }
    }
};

/**
 * Selects a key from a weighted map.
 */
function weightedSelect<T extends string>(rng: SeededRandom, weights: Record<T, number>): T {
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w as number), 0);
    let randomValue = rng.next() * totalWeight;

    for (const key in weights) {
        const weight = weights[key];
        if (randomValue < weight) {
            return key;
        }
        randomValue -= weight;
    }

    // Fallback
    return Object.keys(weights)[0] as T;
}

/**
 * Derives visibility from other weather factors.
 */
function calculateVisibility(precipitation: Precipitation, wind: WindSpeed): VisibilityLevel {
    if (precipitation === 'blizzard' || precipitation === 'storm') return 'heavily_obscured';
    if (precipitation === 'heavy_rain' || precipitation === 'snow') return 'lightly_obscured';
    // Fog logic could go here based on humidity/temp, but simplifying for now
    return 'clear';
}

/**
 * Generates the daily weather based on the season.
 * Uses the previous weather to influence the new weather (Markov-lite) to prevent jarring shifts,
 * but primarily driven by seasonal probabilities.
 */
export function generateDailyWeather(
    season: Season,
    previousWeather: WeatherState,
    rng: SeededRandom
): WeatherState {
    const probabilities = SEASONAL_PROBABILITIES[season];

    // 1. Determine Precipitation
    // Bias towards continuity: Increase weight of current precipitation state
    const precipWeights = { ...probabilities.precipitation };
    if (precipWeights[previousWeather.precipitation]) {
        precipWeights[previousWeather.precipitation] += 0.3; // 30% bonus to stay same
    }
    const precipitation = weightedSelect(rng, precipWeights);

    // 2. Determine Temperature
    // Temperature doesn't fluctuate wildly day-to-day usually
    const tempWeights = { ...probabilities.temperature };
    if (tempWeights[previousWeather.temperature]) {
        tempWeights[previousWeather.temperature] += 0.5; // Strong bias to persist
    }
    const temperature = weightedSelect(rng, tempWeights);

    // 3. Determine Wind
    const windSpeed = weightedSelect(rng, probabilities.wind);

    // Wind direction tends to prevail but can shift
    const directions: Array<WindCondition['direction']> = ['north', 'south', 'east', 'west'];
    let direction = previousWeather.wind.direction;
    if (rng.next() < 0.3) { // 30% chance to change direction
        direction = directions[Math.floor(rng.next() * directions.length)];
    }

    // 4. Calculate Visibility
    const visibility = calculateVisibility(precipitation, windSpeed);

    return {
        precipitation,
        temperature,
        wind: {
            speed: windSpeed,
            direction
        },
        visibility
    };
}

/**
 * Generates a descriptive string for the weather change.
 * Returns null if the change isn't significant enough to log.
 */
export function describeWeatherChange(oldWeather: WeatherState, newWeather: WeatherState): string | null {
    if (oldWeather.precipitation !== newWeather.precipitation) {
        switch (newWeather.precipitation) {
            case 'none': return "The skies clear up.";
            case 'light_rain': return "A light rain begins to fall.";
            case 'heavy_rain': return "Heavy rain pours down.";
            case 'storm': return "A thunderous storm rolls in.";
            case 'snow': return "Snow begins to fall softly.";
            case 'blizzard': return "A blinding blizzard engulfs the land.";
        }
    }

    if (oldWeather.temperature !== newWeather.temperature) {
        if (newWeather.temperature === 'freezing') return "The temperature drops below freezing.";
        if (newWeather.temperature === 'hot') return "A wave of heat washes over the land.";
    }

    if (newWeather.wind.speed === 'gale' && oldWeather.wind.speed !== 'gale') {
        return "Gale force winds begin to howl.";
    }

    return null;
}
