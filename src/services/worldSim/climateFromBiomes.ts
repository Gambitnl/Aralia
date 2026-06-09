// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 04:12:09
 * Dependents: state/migrations/worldDataMigration.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file climateFromBiomes.ts
 * @description Deterministic biome-based fallback climate derivation for legacy world snapshots.
 *
 * Why this is built this way:
 * - The migration path already recovers terrain relief from biome ids when Azgaar climate data
 *   is missing. This helper uses the same authored biome metadata to recover temperature and
 *   moisture instead of dropping back to flat constants.
 * - The mapping is intentionally coarse. It gives downstream systems a believable climate field
 *   without pretending to recreate the full Azgaar climate solver.
 *
 * Known limitations:
 * - This is a banded approximation, not a latitude or season model.
 * - The primary Azgaar-derived path remains the source of richer climate variation.
 */

import { BIOMES } from '@/data/biomes';
import type { Biome } from '@/types';
import { SeededRandom } from '@/utils/random';

type ClimateBand = NonNullable<Biome['climate']>;
type MoistureBand = NonNullable<Biome['moisture']>;
type ElevationBand = NonNullable<Biome['elevation']>;

type ClimateField = {
  temperatures: number[];
  moisture: number[];
};

const DEFAULT_CLIMATE: ClimateBand = 'temperate';
const DEFAULT_MOISTURE: MoistureBand = 'temperate';
const DEFAULT_ELEVATION: ElevationBand = 'low';

const TEMPERATURE_BASE: Record<ClimateBand, number> = {
  tropical: 34,
  subtropical: 29,
  temperate: 21,
  arid: 27,
  polar: 6,
};

const TEMPERATURE_JITTER: Record<ClimateBand, number> = {
  tropical: 4,
  subtropical: 6,
  temperate: 6,
  arid: 7,
  polar: 5,
};

const TEMPERATURE_ELEVATION_OFFSET: Record<ElevationBand, number> = {
  aquatic: -2,
  subterranean: -1,
  low: 0,
  mid: -4,
  high: -8,
};

const MOISTURE_BASE: Record<MoistureBand, number> = {
  arid: 6,
  dry: 12,
  temperate: 22,
  wet: 32,
  saturated: 40,
};

const MOISTURE_JITTER: Record<MoistureBand, number> = {
  arid: 4,
  dry: 5,
  temperate: 6,
  wet: 7,
  saturated: 5,
};

const MOISTURE_ELEVATION_OFFSET: Record<ElevationBand, number> = {
  aquatic: 6,
  subterranean: 1,
  low: 0,
  mid: -2,
  high: -4,
};

const TEMPERATURE_SALT = 0x51c1a11e;
const MOISTURE_SALT = 0x51c1a12f;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const centeredRoll = (base: number, span: number, rng: SeededRandom): number =>
  Math.round(base - span / 2 + rng.next() * span);

/**
 * Derives a deterministic temperature and moisture field from biome ids.
 *
 * @param biomeIds Row-major biome id per cell.
 * @param cols Grid width.
 * @param rows Grid height.
 * @param seed World seed used to keep the output reproducible.
 */
export function climateFromBiomes(
  biomeIds: string[],
  cols: number,
  rows: number,
  seed: number,
): ClimateField {
  const cells = cols * rows;
  const temperatures = new Array<number>(cells);
  const moisture = new Array<number>(cells);
  const temperatureRng = new SeededRandom((seed ^ TEMPERATURE_SALT) >>> 0);
  const moistureRng = new SeededRandom((seed ^ MOISTURE_SALT) >>> 0);

  for (let i = 0; i < cells; i++) {
    const biome = BIOMES[biomeIds[i]] ?? {};
    const climate = biome.climate ?? DEFAULT_CLIMATE;
    const moistureBand = biome.moisture ?? DEFAULT_MOISTURE;
    const elevation = biome.elevation ?? DEFAULT_ELEVATION;

    const temperatureBase = TEMPERATURE_BASE[climate] + TEMPERATURE_ELEVATION_OFFSET[elevation];
    const moistureBase = MOISTURE_BASE[moistureBand] + MOISTURE_ELEVATION_OFFSET[elevation];

    temperatures[i] = clamp(
      centeredRoll(temperatureBase, TEMPERATURE_JITTER[climate], temperatureRng),
      0,
      45,
    );
    moisture[i] = clamp(
      centeredRoll(moistureBase, MOISTURE_JITTER[moistureBand], moistureRng),
      0,
      45,
    );
  }

  return { temperatures, moisture };
}
