/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:29:03
 * Dependents: None (Orphan)
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { UnderdarkState, LightSource, LightSourceType } from '../types/underdark';
/**
 * Calculates the current light level based on depth and active light sources.
 *
 * @param state The current Underdark state
 * @returns The calculated light level
 */
export declare const calculateLightLevel: (state: UnderdarkState) => "bright" | "dim" | "darkness" | "magical_darkness";
/**
 * Updates the state of light sources, reducing duration.
 *
 * @param state The current Underdark state
 * @param minutesPassed Number of minutes to advance
 * @returns Updated UnderdarkState
 */
export declare const tickLightSources: (state: UnderdarkState, minutesPassed: number) => UnderdarkState;
/**
 * Updates sanity based on light level and depth.
 *
 * @param state The current Underdark state
 * @param minutesPassed Number of minutes spent
 * @returns Updated UnderdarkState
 */
export declare const updateSanity: (state: UnderdarkState, minutesPassed: number) => UnderdarkState;
export declare const createLightSource: (name: string, type: LightSourceType, radius: number, durationMinutes: number) => LightSource;
