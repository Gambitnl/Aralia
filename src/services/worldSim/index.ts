/**
 * @file index.ts
 * World-sim pipeline entry. Given a heightmap + climate + biome assignment,
 * returns a complete WorldData object with rivers, sites, roads, and polygons.
 *
 * Deterministic for a given seed: rng is constructed from the input seed and
 * passed only into placeSites (the only sub-step that consumes random numbers).
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

const MIN_RIVER_FLOW = 5;
const TOWN_DENSITY = 1 / 80;
const DUNGEON_DENSITY = 1 / 200;
const RUIN_DENSITY = 1 / 150;

export function runWorldSim(input: RunWorldSimInput): WorldData {
  const { seed, templateId, cols, rows, heights, temperatures, moisture, biomeIds } = input;
  const rng = new SeededRandom(seed ^ 0xa5a5a5a5);

  const cells = cols * rows;
  const targets = {
    townTarget: Math.max(2, Math.round(cells * TOWN_DENSITY)),
    dungeonTarget: Math.round(cells * DUNGEON_DENSITY),
    ruinTarget: Math.round(cells * RUIN_DENSITY),
  };

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
