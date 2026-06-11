/**
 * @file rankCells.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: `rankCells()` in public/main.js (not yet modularized on the TS
 * branch). See ./ATTRIBUTION.md.
 *
 * Assesses cell suitability (pack.cells.s) and rural population
 * (pack.cells.pop) — the inputs for culture centers and burg placement.
 * Draw-free: only d3 median/max/mean statistics, verified against upstream.
 */
import { max, mean, median } from "./d3Shim";
import { normalize } from "./utils/numberUtils";
import type { Pack } from "./features";
import type { BiomesData } from "./biomes";

// assess cells suitability to calculate population and rand cells for culture center and burgs placement
export function rankCells(pack: Pack, biomesData: BiomesData) {
  const { cells, features } = pack;
  cells.s = new Int16Array(cells.i.length); // cell suitability array
  cells.pop = new Float32Array(cells.i.length); // cell population array

  const meanFlux = median(Array.from(cells.fl!).filter((f) => f)) || 0;
  const maxFlux =
    (max(cells.fl! as unknown as Iterable<number>) as number) +
    (max(cells.conf! as unknown as Iterable<number>) as number); // to normalize flux
  const meanArea = mean(cells.area! as unknown as Iterable<number>) as number; // to adjust population by cell area

  const scoreMap: Record<string, number> = {
    estuary: 15,
    ocean_coast: 5,
    save_harbor: 20,
    freshwater: 30,
    salt: 10,
    frozen: 1,
    dry: -5,
    sinkhole: -5,
    lava: -30,
  };

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue; // no population in water
    let score = biomesData.habitability[cells.biome![i]]; // base suitability derived from biome habitability
    if (!score) continue; // uninhabitable biomes has 0 suitability

    if (meanFlux)
      score += normalize(cells.fl![i] + cells.conf![i], meanFlux, maxFlux) * 250; // big rivers and confluences are valued
    score -= (cells.h[i] - 50) / 5; // low elevation is valued, high is not;

    if (cells.t![i] === 1) {
      if (cells.r![i]) score += scoreMap.estuary;
      const feature = features[cells.f![cells.haven![i]]];
      if (feature.type === "lake") {
        score += scoreMap[feature.group] || 0;
      } else {
        score += scoreMap.ocean_coast;
        if (cells.harbor![i] === 1) score += scoreMap.save_harbor;
      }
    }

    cells.s[i] = score / 5; // general population rate
    // cell rural population is suitability adjusted by cell area
    cells.pop[i] = cells.s[i] > 0 ? (cells.s[i] * cells.area![i]) / meanArea : 0;
  }
}
