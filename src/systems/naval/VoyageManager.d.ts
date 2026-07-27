/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 03:06:22
 * Dependents: state/reducers/navalReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/VoyageManager.ts
 * Logic for managing sea voyages, including daily progression and event resolution.
 */
import { Ship, VoyageState } from '../../types/naval';
import { WeatherState } from '../../types/environment';
import { SeededRandom } from '@/utils/random';
type RandomSource = SeededRandom;
export declare class VoyageManager {
    /**
     * Initializes a new voyage state.
     */
    static startVoyage(ship: Ship, distanceToDestination: number): VoyageState;
    /**
     * Advances the voyage by one day.
     * 1. Updates distance based on speed and weather.
     * 2. Consumes supplies from ship cargo based on rationing.
     * 3. Triggers random event.
     * 4. Updates crew (daily wage/morale).
     */
    static advanceDay(state: VoyageState, ship: Ship, weather: WeatherState, availableFunds?: number, rng?: RandomSource): {
        newState: VoyageState;
        updatedShip: Ship;
        remainingFunds: number;
    };
}
export {};
