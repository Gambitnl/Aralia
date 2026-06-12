/**
 * @file lakes.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: .tmp/azgaar-src/src/modules/lakes.ts. See ./ATTRIBUTION.md.
 *
 * Ported (generation logic): getHeight, detectCloseLakes; slice 2 added
 * defineClimateData and cleanupLakeData (river-integration steps used by
 * Rivers.generate); slice 3 added defineNames/getName (upstream runs
 * Lakes.defineNames after Rivers.specify in main.js generate()).
 * The grid-level lake helpers addLakesInDeepDepressions and
 * openNearSeaLakes live in upstream public/main.js, not this module; they
 * are ported in ./generateBase.ts.
 *
 * Adaptations (cosmetic only): `grid`, `pack`, the lake elevation limit and
 * the height exponent are explicit parameters (upstream reads the globals
 * `grid`/`pack` and the `lakeElevationLimitOutput` (default 20) /
 * `heightExponentInput` (default 2) DOM inputs).
 */
import { mean, min } from "./d3Shim";
import { rn } from "./utils";
import type { Grid } from "./utils/graphUtils";
import type { Pack, PackedGraphFeature } from "./features";

export class LakesModule {
  private LAKE_ELEVATION_DELTA = 0.1;

  getHeight(feature: PackedGraphFeature, pack: Pack) {
    const heights = pack.cells.h;
    const minShoreHeight =
      min(feature.shoreline.map((cellId) => heights[cellId])) || 20;
    return rn(minShoreHeight - this.LAKE_ELEVATION_DELTA, 2);
  }

  cleanupLakeData = (pack: Pack) => {
    for (const feature of pack.features) {
      if (feature.type !== "lake") continue;
      delete feature.river;
      delete feature.enteringFlux;
      delete feature.outCell;
      delete feature.closed;
      feature.height = rn(feature.height, 3);

      const inlets = feature.inlets?.filter((r) =>
        pack.rivers!.find((river) => river.i === r),
      );
      if (!inlets || !inlets.length) delete feature.inlets;
      else feature.inlets = inlets;

      const outlet =
        feature.outlet &&
        pack.rivers!.find((river) => river.i === feature.outlet);
      if (!outlet) delete feature.outlet;
    }
  };

  defineClimateData(
    heights: number[] | Uint8Array,
    grid: Grid,
    pack: Pack,
    heightExponent: number, // upstream: Number(heightExponentInput.value)
  ) {
    const { cells, features } = pack;
    const lakeOutCells = new Uint16Array(cells.i.length);

    const getFlux = (lake: PackedGraphFeature) => {
      return lake.shoreline.reduce(
        (acc, c) => acc + grid.cells.prec![cells.g![c]],
        0,
      );
    };

    const getLakeTemp = (lake: PackedGraphFeature) => {
      if (lake.cells < 6) return grid.cells.temp![cells.g![lake.firstCell]];
      return rn(
        mean(
          lake.shoreline.map((c) => grid.cells.temp![cells.g![c]]),
        ) as number,
        1,
      );
    };

    const getLakeEvaporation = (lake: PackedGraphFeature) => {
      const height = (lake.height - 18) ** heightExponent; // height in meters
      const evaporation =
        ((700 * (lake.temp + 0.006 * height)) / 50 + 75) / (80 - lake.temp); // based on Penman formula, [1-11]
      return rn(evaporation * lake.cells);
    };

    const getLowestShoreCell = (lake: PackedGraphFeature) => {
      return lake.shoreline.sort((a, b) => heights[a] - heights[b])[0];
    };

    features.forEach((feature) => {
      if (feature.type !== "lake") return;
      feature.flux = getFlux(feature);
      feature.temp = getLakeTemp(feature);
      feature.evaporation = getLakeEvaporation(feature);
      if (feature.closed) return; // no outlet for lakes in depressed areas

      feature.outCell = getLowestShoreCell(feature);
      lakeOutCells[feature.outCell as number] = feature.i;
    });

    return lakeOutCells;
  }

  // check if lake can be potentially open (not in deep depression)
  detectCloseLakes(
    h: number[] | Uint8Array,
    pack: Pack,
    elevationLimit: number,
  ) {
    const { cells } = pack;
    const ELEVATION_LIMIT = elevationLimit; // upstream: +byId("lakeElevationLimitOutput").value

    pack.features.forEach((feature) => {
      if (feature.type !== "lake") return;
      delete feature.closed;

      const MAX_ELEVATION = feature.height + ELEVATION_LIMIT;
      if (MAX_ELEVATION > 99) {
        feature.closed = false;
        return;
      }

      let isDeep = true;
      const lowestShorelineCell = feature.shoreline.sort(
        (a, b) => h[a] - h[b],
      )[0];
      const queue = [lowestShorelineCell];
      const checked: boolean[] = [];
      checked[lowestShorelineCell] = true;

      while (queue.length && isDeep) {
        const cellId: number = queue.pop() as number;

        for (const neibCellId of cells.c[cellId]) {
          if (checked[neibCellId]) continue;
          if (h[neibCellId] >= MAX_ELEVATION) continue;

          if (h[neibCellId] < 20) {
            const nFeature = pack.features[cells.f![neibCellId]];
            if (nFeature.type === "ocean" || feature.height > nFeature.height)
              isDeep = false;
          }

          checked[neibCellId] = true;
          queue.push(neibCellId);
        }
      }

      feature.closed = isDeep;
    });
  }

  /* ---- slice-3 naming stage (upstream Lakes.defineNames, runs after
     Rivers.specify in main.js generate()) ---- */

  defineNames(
    pack: Pack,
    names: import("./names-generator").NamesGenerator,
  ) {
    pack.features.forEach((feature: PackedGraphFeature) => {
      if (!feature || feature.type !== "lake") return;
      feature.name = this.getName(feature, pack, names);
    });
  }

  getName(
    feature: PackedGraphFeature,
    pack: Pack,
    names: import("./names-generator").NamesGenerator,
  ): string {
    const landCell = feature.shoreline[0];
    const culture = pack.cells.culture![landCell];
    return names.getCulture(culture);
  }
}

/** Module-level singleton, mirroring upstream `window.Lakes`. */
export const Lakes = new LakesModule();
