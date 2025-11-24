/**
 * @file src/utils/locationUtils.ts
 * This file contains utility functions related to game locations,
 * such as determining dynamic NPCs.
 */
import { Location, MapData, MapMarker, MapTile, PointOfInterest } from '../types';

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

/**
 * Determines whether tile-space coordinates are inside the currently loaded world map grid.
 * Keeping this check centralized ensures both the minimap and full map avoid out-of-bounds
 * reads when panning or rendering markers.
 */
export function isCoordinateWithinMap(coords: { x: number; y: number }, mapData: MapData | null): boolean {
  if (!mapData) return false;
  return coords.x >= 0 && coords.x < mapData.gridSize.cols && coords.y >= 0 && coords.y < mapData.gridSize.rows;
}

/**
 * Convenience accessor for a specific map tile using world-map coordinates. All map rendering
 * code should funnel through this helper so the bounds logic stays consistent and heavily
 * commented in one place.
 */
export function getTileAtCoordinates(mapData: MapData | null, coords: { x: number; y: number }): MapTile | null {
  if (!isCoordinateWithinMap(coords, mapData)) {
    return null;
  }
  return mapData?.tiles[coords.y]?.[coords.x] ?? null;
}

/**
 * Builds the concrete marker list used by both the minimap canvas and the main MapPane grid.
 * Markers become "discovered" once their underlying tile is explored or if the player is
 * currently standing on that tile. Keeping this derivation here avoids duplicating the same
 * visibility rules in multiple components.
 */
export function buildPoiMarkers(pois: PointOfInterest[], mapData: MapData | null): MapMarker[] {
  if (!mapData) return [];

  return pois
    .filter(poi => isCoordinateWithinMap(poi.coordinates, mapData))
    .map(poi => {
      const tile = getTileAtCoordinates(mapData, poi.coordinates);
      const isDiscovered = Boolean(tile?.discovered || tile?.isPlayerCurrent);

      return {
        id: poi.id,
        coordinates: poi.coordinates,
        icon: poi.icon,
        label: poi.name,
        category: poi.category,
        isDiscovered,
        relatedLocationId: poi.locationId,
      } satisfies MapMarker;
    });
}
