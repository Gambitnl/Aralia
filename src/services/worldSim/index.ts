/**
 * @file index.ts
 * @description World-sim pipeline entry point. Integrates marching squares (coastlines/lakes),
 * biome zoning, river flow tracing, site placement, and road generation into a unified WorldData schema.
 *
 * Why this is built this way:
 * - A single orchestrator function provides a clean, predictable API for caller services.
 * - Deterministic random seeding ensures that identical map parameters yield identical results,
 *   which is critical for multiplayer sync, save file loading, and procedural chunk generation.
 * - Targets/density values for sites are calculated proportionally to the world grid size, keeping
 *   town and ruin distribution balanced across different map scales.
 *
 * Known limitations/deferred issues:
 * - The pipeline is entirely synchronous. For huge map sizes, we may need to partition execution
 *   or run the pipeline in a Web Worker to keep the main thread responsive.
 */

import { SeededRandom } from '@/utils/random';
import type { WorldData } from './types';
import { extractCoastlines, extractLakes } from './coastlinesAndLakes';
import { extractBiomeZones } from './biomeZones';
import { traceRivers } from './rivers';
import { placeSites } from './sites';
import { generateRoads } from './roads';

export interface RunWorldSimInput {
  seed: number;
  templateId: string;
  cols: number;
  rows: number;
  heights: number[];
  temperatures: number[];
  moisture: number[];
  biomeIds: string[];
}

// Global density rules for world generation (proportionate to grid cells count)
const MIN_RIVER_FLOW = 5;
const TOWN_DENSITY = 1 / 80;
const DUNGEON_DENSITY = 1 / 200;
const RUIN_DENSITY = 1 / 150;

/**
 * Runs the complete world simulation generation pipeline from basic height and biome arrays.
 * Produces fully hydrated, deterministic WorldData.
 */
export function runWorldSim(input: RunWorldSimInput): WorldData {
  const { seed, templateId, cols, rows, heights, temperatures, moisture, biomeIds } = input;
  // Blend seed with salt to avoid correlation between placement RNG and map/heightmap RNG
  const rng = new SeededRandom(seed ^ 0xa5a5a5a5);

  const cells = cols * rows;
  const targets = {
    townTarget: Math.max(2, Math.round(cells * TOWN_DENSITY)),
    dungeonTarget: Math.round(cells * DUNGEON_DENSITY),
    ruinTarget: Math.round(cells * RUIN_DENSITY),
  };

  // Execute pipeline stages in logical topological dependency order
  const coastlines = extractCoastlines(heights, cols, rows);
  const lakes = extractLakes(heights, cols, rows);
  const biomeZones = extractBiomeZones(biomeIds, cols, rows);
  const rivers = traceRivers(heights, cols, rows, MIN_RIVER_FLOW);
  const sites = placeSites(heights, cols, rows, rivers, rng, targets);
  const roads = generateRoads(heights, cols, rows, sites);

  return {
    version: 2,
    seed,
    templateId,
    gridSize: { rows, cols },
    heights,
    temperatures,
    moisture,
    biomeIds,
    rivers,
    roads,
    sites,
    coastlines,
    lakes,
    biomeZones,
  };
}
