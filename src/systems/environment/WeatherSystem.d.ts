/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:48:37
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/environment/WeatherSystem.ts
 * Manages weather transitions and climate definitions.
 * Ecologist System: Weather should change dynamically based on the environment.
 */
import { WeatherState, Precipitation, WindSpeed, Temperature } from '../../types/environment';
import { TimeOfDay } from '../../utils/core';
import { SeededRandom } from '../../utils/random';
type RandomSource = Pick<SeededRandom, 'next'>;
/**
 * Defines the probability distribution for weather in a specific climate.
 */
export interface ClimateProfile {
    id: string;
    name: string;
    precipitationChances: Record<Precipitation, number>;
    temperatureChances: Record<Temperature, number>;
    windChances: Record<WindSpeed, number>;
}
/**
 * Standard climate definitions mapped to biome IDs.
 */
export declare const CLIMATES: Record<string, ClimateProfile>;
/**
 * Gets the climate profile for a given biome ID.
 * Defaults to 'plains' if biome is unknown.
 */
export declare function getClimateForBiome(biomeId: string): ClimateProfile;
/**
 * Updates the weather state based on the current biome's climate.
 * Should be called at the start of a new round or significant time interval.
 *
 * @param currentWeather The current weather state.
 * @param biomeId The ID of the current biome.
 * @param timeOfDay The current time of day (optional, defaults to Day if unknown)
 * @param rng The random source used for weather transitions. When omitted, the
 *            current weather snapshot is hashed into a deterministic fallback
 *            so legacy callers do not reintroduce ambient randomness.
 * @returns The new WeatherState (may be same as current).
 */
export declare function updateWeather(currentWeather: WeatherState, biomeId: string, timeOfDay?: TimeOfDay, rng?: RandomSource): WeatherState;
export {};
