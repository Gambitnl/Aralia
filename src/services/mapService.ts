// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:54
 * Dependents: App.tsx, useGameInitialization.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file mapService.ts
 * This service module handles the generation of the world map for Aralia RPG.
 */
import { MapData, MapTile, Location, Biome } from '../types';
import { SeededRandom } from '@/utils/random';
import { generateAzgaarDerivedMap } from './azgaarDerivedMapService';
import { migrateMapDataToWorldDataV2 } from '@/state/migrations/worldDataMigration';

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
    const map = generateAzgaarDerivedMap(rows, cols, locations, biomes, worldSeed);
    return { ...map, generation: { source: 'azgaar-derived', at: Date.now() } };
  } catch (error) {
    // Capture WHY we fell back so it can be surfaced in the DebugHUD (worldsim-service WSS-004),
    // not just logged to a console nobody reads.
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error('[mapService] Azgaar-source generation failed. Falling back to legacy generator.', error);
    const map = generateLegacyMap(rows, cols, locations, biomes, worldSeed);
    // Overrides the `biome-derived` provenance set inside generateLegacyMap's migration call,
    // because the *root cause* here is the Azgaar generation failure, not merely missing terrain.
    return { ...map, generation: { source: 'legacy-fallback', reason, at: Date.now() } };
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

  // Grid retirement (2026-07-01): authored locations no longer carry grid
  // coordinates, so there is nothing to anchor onto tiles here. The old block
  // seeded predefined-location biomes + starting-tile discovery from
  // `loc.mapCoordinates`; that field is gone.

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
  const legacyResult: MapData = { gridSize: { rows, cols }, tiles };
  return migrateMapDataToWorldDataV2(legacyResult, worldSeed);
}
