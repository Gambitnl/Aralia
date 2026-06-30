// @dependencies-start
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
// @dependencies-end

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
export function determineActiveDynamicNpcsForLocation(locationId: string, locationsData: Record<string, Location>): string[] | null {
  const location = locationsData[locationId];
  if (location?.dynamicNpcConfig) {
    const config = location.dynamicNpcConfig;
    if (Math.random() < config.baseSpawnChance) {
      const numToSpawn = Math.floor(Math.random() * (config.maxSpawnCount + 1)); // Max is inclusive
      if (numToSpawn === 0 && config.maxSpawnCount > 0) { // Ensure at least 1 spawns if maxSpawnCount > 0 and chance passes.
          // This case can be fine if 0 is a valid outcome. Or adjust logic for min 1.
          // For now, allowing 0 if Math.random gives 0 for numToSpawn.
      }
      // Shuffle possible NPCs and take the required number
      const shuffledNpcIds = [...config.possibleNpcIds].sort(() => 0.5 - Math.random());
      return shuffledNpcIds.slice(0, Math.min(numToSpawn, shuffledNpcIds.length));
    }
    return []; // Spawn chance failed, but config exists, so explicitly empty.
  }
  return null; // No dynamic NPC config for this location.
}

// Grid retirement (2026-06-30): removed the dead legacy 30x20 grid-marker
// cluster — isCoordinateWithinMap, getTileAtCoordinates, and buildPoiMarkers
// (all read mapData.tiles/gridSize and had no remaining callers once the
// minimap and MapPane grid projection were retired). POI markers on the
// cell-native map come from atlasSvg.buildPoiMarkers (atlas pack.markers).
