/**
 * @file generateBase.ts — headless entry for the ported FMG physical-world
 * base (Worldforge build-order item 2, slice 1): jittered-grid points →
 * Delaunay/Voronoi graph → template-driven heightmap → grid-level water
 * features (ocean/lake/island detection + depression lakes + near-sea lake
 * breaching).
 *
 * Orchestration order is FMG's own (upstream public/main.js `generate()`):
 *   1. seed PRNG                      (setSeed)
 *   2. grid = generateGrid()          (re-seeds Alea internally)
 *   3. grid.cells.h = HeightmapGenerator.generate(grid)  (re-seeds)
 *   4. Features.markupGrid()          (re-seeds)
 *   5. addLakesInDeepDepressions()
 *   6. openNearSeaLakes()
 * Later upstream stages (OceanLayers, climate, reGraph, Features.markupPack,
 * rivers, ...) belong to the next slices.
 *
 * addLakesInDeepDepressions and openNearSeaLakes are exact ports of the
 * functions of the same names in upstream public/main.js (they were not yet
 * moved into a module on the TypeScript refactor branch).
 *
 * RNG CONTRACT: like upstream, the stages communicate through the global
 * Math.random (each stage re-assigns `Math.random = Alea(seed)` itself, so
 * the per-stage draw order is provably identical to upstream). This runner
 * scopes the override: the original Math.random is restored in a finally
 * block. Single-threaded JS means no other code can observe the override
 * mid-run.
 */
import Alea from "alea";
import { min } from "./d3Shim";
import { generateGrid, type Grid } from "./utils/graphUtils";
import { HeightmapGenerator } from "./heightmap-generator";
import { heightmapTemplates } from "./heightmap-templates";
import { Features, type GridFeature } from "./features";

export interface FmgBaseOptions {
  /** Map width in FMG map units (upstream: browser window width). Default 960. */
  width?: number;
  /** Map height in FMG map units (upstream: browser window height). Default 540. */
  height?: number;
  /**
   * Desired cell count before jittering (upstream: "points" option,
   * density 4 ⇒ 10000 cells). Must be one of FMG's supported densities
   * (1000..100000) for the blob/line power tables to have exact entries.
   * Default 10000.
   */
  cellsDesired?: number;
  /**
   * Heightmap template key from ./heightmap-templates (upstream randomizes
   * via template probabilities in the UI; pass explicitly here).
   * Default "continents".
   */
  template?: string;
  /**
   * Depression depth threshold for adding lakes (upstream DOM input
   * `lakeElevationLimitOutput`, default 20; 80 disables the step).
   */
  lakeElevationLimit?: number;
}

export interface FmgBaseResult {
  seed: string;
  graphWidth: number;
  graphHeight: number;
  template: string;
  /**
   * The FMG grid: points/boundary, Voronoi cells & vertices, plus the
   * generation outputs — cells.h (heights 0-100), cells.t (distance field),
   * cells.f (feature ids) and features (index 0 is a literal 0 placeholder,
   * as upstream).
   */
  grid: Grid;
}

/**
 * Add lakes on land cells in deep depressions that cannot pour out.
 * Exact port of `addLakesInDeepDepressions` from upstream public/main.js.
 */
export function addLakesInDeepDepressions(
  grid: Grid,
  elevationLimit: number,
): void {
  if (elevationLimit === 80) return;

  const cells = grid.cells;
  const features = grid.features!;
  const { c, h, b } = cells;

  for (const i of cells.i) {
    if (b[i] || h![i] < 20) continue;

    const minHeight = min(c[i].map((c) => h![c])) as number;
    if (h![i] > minHeight) continue;

    let deep = true;
    const threshold = h![i] + elevationLimit;
    const queue: number[] = [i];
    const checked: boolean[] = [];
    checked[i] = true;

    // check if elevated cell can potentially pour to water
    while (deep && queue.length) {
      const q = queue.pop() as number;

      for (const n of c[q]) {
        if (checked[n]) continue;
        if (h![n] >= threshold) continue;
        if (h![n] < 20) {
          deep = false;
          break;
        }

        checked[n] = true;
        queue.push(n);
      }
    }

    // if not, add a lake
    if (deep) {
      const lakeCells = [i as number].concat(
        c[i].filter((n) => h![n] === h![i]),
      );
      addLake(lakeCells);
    }
  }

  function addLake(lakeCells: number[]) {
    const f = features.length;

    lakeCells.forEach((i) => {
      cells.h![i] = 19;
      cells.t![i] = -1;
      cells.f![i] = f;
      // UPSTREAM BUG PRESERVED: main.js writes `cells.t[c] = 1` where `c` is
      // the whole neighbors array-of-arrays, which only sets a junk
      // string-keyed property on the Int8Array (no element is modified).
      // Replicated verbatim so the observable state matches upstream.
      c[i].forEach(
        (n) =>
          !lakeCells.includes(n) &&
          ((cells.t as unknown as Record<string, number>)[String(c)] = 1),
      );
    });

    features.push({ i: f, land: false, border: false, type: "lake" });
  }
}

/**
 * Near-sea lakes usually get a lot of water inflow; most of them should
 * break the threshold and flow out to the sea (see Ancylus Lake).
 * Exact port of `openNearSeaLakes` from upstream public/main.js.
 */
export function openNearSeaLakes(grid: Grid, template: string): void {
  // UPSTREAM QUIRK PRESERVED: main.js compares the templateInput VALUE (the
  // template key, e.g. "atoll") against the display name "Atoll", so this
  // early-out never fires for the bundled templates. Kept verbatim.
  if (template === "Atoll") return; // no need for Atolls

  const cells = grid.cells;
  const features = grid.features!;
  if (!features.find((f) => f.type === "lake")) return; // no lakes
  const LIMIT = 22; // max height that can be breached by water

  for (const i of cells.i) {
    const lakeFeatureId = cells.f![i];
    if (features[lakeFeatureId].type !== "lake") continue; // not a lake

    check_neighbours: for (const c of cells.c[i]) {
      if (cells.t![c] !== 1 || cells.h![c] > LIMIT) continue; // water cannot break this

      for (const n of cells.c[c]) {
        const ocean = cells.f![n];
        if (features[ocean].type !== "ocean") continue; // not an ocean
        removeLake(c, lakeFeatureId, ocean);
        break check_neighbours;
      }
    }
  }

  function removeLake(
    thresholdCellId: number,
    lakeFeatureId: number,
    oceanFeatureId: number,
  ) {
    cells.h![thresholdCellId] = 19;
    cells.t![thresholdCellId] = -1;
    cells.f![thresholdCellId] = oceanFeatureId;
    cells.c[thresholdCellId].forEach(function (c) {
      if (cells.h![c] >= 20) cells.t![c] = 1; // mark as coastline
    });

    cells.i.forEach((i) => {
      if (cells.f![i] === lakeFeatureId) cells.f![i] = oceanFeatureId;
    });
    features[lakeFeatureId].type = "ocean"; // mark former lake as ocean
  }
}

/**
 * Generate the FMG physical-world base headlessly. Deterministic: the same
 * seed + options always produce the same grid, heights and features.
 */
export function generateFmgBase(
  seed: string,
  options: FmgBaseOptions = {},
): FmgBaseResult {
  const {
    width = 960,
    height = 540,
    cellsDesired = 10000,
    template = "continents",
    lakeElevationLimit = 20,
  } = options;

  if (!(template in heightmapTemplates)) {
    throw new Error(`Unknown heightmap template "${template}"`);
  }

  const originalRandom = Math.random;
  try {
    // setSeed equivalent. Upstream main.js uses the aleaPRNG lib here, but
    // every ported stage below re-seeds with npm `alea` (as the TS-refactor
    // modules do) before drawing, so the stream upstream draws from this
    // assignment (UI option randomization only) never reaches generation.
    Math.random = Alea(seed);

    const grid = generateGrid(seed, width, height, cellsDesired);
    grid.cells.h = HeightmapGenerator.generate(grid, {
      seed,
      template,
      graphWidth: width,
      graphHeight: height,
    });

    Features.markupGrid(grid, seed);
    addLakesInDeepDepressions(grid, lakeElevationLimit);
    openNearSeaLakes(grid, template);

    return { seed, graphWidth: width, graphHeight: height, template, grid };
  } finally {
    Math.random = originalRandom;
  }
}

/** Count grid features by type (placeholder element 0 is skipped). */
export function countFeaturesByType(
  features: GridFeature[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const feature of features) {
    if (!feature) continue;
    counts[feature.type] = (counts[feature.type] || 0) + 1;
  }
  return counts;
}
