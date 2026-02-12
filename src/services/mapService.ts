// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 11/02/2026, 12:38:57
 * Dependents: useGameInitialization.ts
 * Imports: 4 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file mapService.ts
 * This service module handles the generation of the world map for Aralia RPG.
 */
import { MapData, MapTile, Location, Biome } from '../types';
import { STARTING_LOCATION_ID } from '../constants';
import { SeededRandom } from '@/utils/random';
import { generateAzgaarDerivedMap } from './azgaarDerivedMapService';

/**
 * Generates a world map with biomes and links to predefined locations.
 * @param {number} rows - Number of rows in the map grid.
 * @param {number} cols - Number of columns in the map grid.
 * @param {Record<string, Location>} locations - Predefined game locations.
 * @param {Record<string, Biome>} biomes - Available biome types.
 * @param {number} worldSeed - The seed for the pseudo-random number generator.
 * @returns {MapData} The generated map data.
 */
export function generateMap(
  rows: number,
  cols: number,
  locations: Record<string, Location>,
  biomes: Record<string, Biome>,
  worldSeed: number,
): MapData {
  // New default: Azgaar-source template + biome world layout.
  // Safety fallback: if this pipeline throws, keep the game bootable via legacy generator.
  try {
    return generateAzgaarDerivedMap(rows, cols, locations, biomes, worldSeed);
  } catch (error) {
    console.error('[mapService] Azgaar-source generation failed. Falling back to legacy generator.', error);
    return generateLegacyMap(rows, cols, locations, biomes, worldSeed);
  }
}

function generateLegacyMap(
  rows: number,
  cols: number,
  locations: Record<string, Location>,
  biomes: Record<string, Biome>,
  worldSeed: number,
): MapData {
  // RALPH: World Forge.
  // Uses a two-step process:
  // 1. Stochastic Filling: Fill grid based on Biome "Weights" (e.g. Grassland is common, Lava is rare).
  // 2. Cellular Automata: Smoothing passes to clump similar biomes together.
  const tiles: MapTile[][] = [];
  const random = new SeededRandom(worldSeed);
  const passableBiomes = Object.values(biomes).filter(b => b.passable);
  const totalWeight = passableBiomes.reduce((sum, b) => sum + (b.spawnWeight ?? 1), 0);
  if (passableBiomes.length === 0 || totalWeight <= 0) {
    throw new Error("No passable biomes defined for map generation.");
  }

  const pickPassableBiomeId = () => {
    const roll = random.next() * totalWeight;
    let acc = 0;
    for (const biome of passableBiomes) {
      acc += biome.spawnWeight ?? 1;
      if (roll <= acc) {
        return biome.id;
      }
    }
    // Fallback to first passable biome (should never hit)
    return passableBiomes[0].id;
  };

  // Initialize all tiles
  for (let r = 0; r < rows; r++) {
    tiles[r] = [];
    for (let c = 0; c < cols; c++) {
      tiles[r][c] = {
        x: c,
        y: r,
        biomeId: pickPassableBiomeId(), // Initial weighted assignment
        discovered: false,
        isPlayerCurrent: false,
      };
    }
  }

  // Place predefined locations and use their biomes as seeds
  Object.values(locations).forEach(loc => {
    if (loc.mapCoordinates && loc.biomeId) {
      const { x, y } = loc.mapCoordinates;
      if (y >= 0 && y < rows && x >= 0 && x < cols) {
        tiles[y][x].biomeId = loc.biomeId;
        tiles[y][x].locationId = loc.id;
        if (loc.id === STARTING_LOCATION_ID) {
          tiles[y][x].isPlayerCurrent = true;
          tiles[y][x].discovered = true; // Discover starting tile
          // Discover adjacent tiles to starting location
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const adjY = y + dy;
              const adjX = x + dx;
              if (adjY >= 0 && adjY < rows && adjX >= 0 && adjX < cols) {
                tiles[adjY][adjX].discovered = true;
              }
            }
          }
        }
      }
    }
  });
  
  // Basic biome clustering pass (simple iteration)
  // This is a very naive approach, more advanced algorithms (Perlin noise, cellular automata) would be better for real zones.
  // TODO(FEATURES): Replace naive clustering with richer biome generation (Perlin/cellular automata) for contiguous regions (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
  // RALPH: Smoothing Logic.
  // Checks neighbors. If a dominant neighbor exists, 50% chance to flip to it.
  // Creates organic-looking blobs instead of TV static.
  for (let i = 0; i < 3; i++) { // Multiple passes for slightly better clustering
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Don't override tiles that are predefined locations
        if (tiles[r][c].locationId && locations[tiles[r][c].locationId!]?.biomeId) {
            continue;
        }

        const neighborCounts: Record<string, number> = {};
        let dominantNeighborBiome: string | null = null;
        let maxCount = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nr = r + dy;
            const nc = c + dx;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const neighborBiomeId = tiles[nr][nc].biomeId;
              neighborCounts[neighborBiomeId] = (neighborCounts[neighborBiomeId] || 0) + 1;
              if (neighborCounts[neighborBiomeId] > maxCount) {
                maxCount = neighborCounts[neighborBiomeId];
                dominantNeighborBiome = neighborBiomeId;
              }
            }
          }
        }
        // If a dominant passable neighbor biome exists, 50% chance to switch to it
        if (dominantNeighborBiome && biomes[dominantNeighborBiome]?.passable && random.next() < 0.5) {
          tiles[r][c].biomeId = dominantNeighborBiome;
        } else if (!biomes[tiles[r][c].biomeId]?.passable) { // Ensure non-location tiles are passable
           tiles[r][c].biomeId = pickPassableBiomeId();
        }
      }
    }
  }

  // TODO(FEATURES): Generate Location metadata for unkeyed tiles and seeded towns (names, descriptions, persistence) during map build (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
  // TODO: Add a connectivity pass that guarantees a walkable path from STARTING_LOCATION_ID to other discoverable tiles (Reason: random clustering can strand the player on unreachable islands; Expectation: every generated map remains explorable without soft-locks).
  return {
    gridSize: { rows, cols },
    tiles,
  };
}
