/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:04
 * Dependents: spatial/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/locationUtils.ts
 * This file contains utility functions related to game locations,
 * such as determining dynamic NPCs.
 */
import { Location } from '../../types';
/**
 * Determines active dynamic NPCs for a given location based on its configuration.
 * @param {string} locationId - The ID of the location.
 * @param {Record<string, Location>} locationsData - The map of all location data.
 * @returns {string[] | null} An array of active dynamic NPC IDs, an empty array if spawn chance fails but config exists, or null if no config.
 */
export declare function determineActiveDynamicNpcsForLocation(locationId: string, locationsData: Record<string, Location>): string[] | null;
