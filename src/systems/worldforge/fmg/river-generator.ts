/**
 * @file river-generator.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: .tmp/azgaar-src/src/modules/river-generator.ts. See
 * ./ATTRIBUTION.md.
 *
 * Ported (generation logic): generate (alterHeights → detectCloseLakes →
 * resolveDepressions → drainWater → defineRivers → calculateConfluenceFlux →
 * cleanupLakeData → erosion), addMeandering, getRiverPoints, getBorderPoint,
 * getOffset, getSourceWidth, getApproximateLength, getWidth.
 * addMeandering is geometry (river length/width inputs), not drawing — kept.
 *
 * Left behind (render/UI): `lineGen`/`getRiverPath`
 * (d3 curveBasis/curveCatmullRom SVG path building), `remove` (editor UI),
 * `getNextId` (editor helper).
 *
 * Slice 3 adds `specify`/`getName`/`getType`/`riverTypes`/`smallLength`/
 * `getBasin` (upstream runs Rivers.specify after Provinces in generate();
 * it needs the Names generator). PER-RUN NOTE: upstream caches `smallLength`
 * on the session-global window.Rivers, so a regenerated map in the same
 * browser session reuses the previous map's threshold; this port resets the
 * cache at the top of specify() (= upstream's first-map-of-session
 * behavior), keeping generateFmgWorld(seed) a pure function.
 *
 * RNG: `Math.random = Alea(seed)` at the top of generate(), exactly like
 * upstream. The generate() path itself draws NOTHING from Math.random; the
 * `rw` draws in getType belong to the specify stage, which upstream runs on
 * the post-Provinces stream (Provinces reseeds Alea(seed)).
 *
 * Adaptations (cosmetic only): `grid`, `pack`, `seed`, `graphWidth`,
 * `graphHeight` and the DOM inputs (`pointsInput.dataset.cells` →
 * cellsDesired, `resolveDepressionsStepsOutput` → resolveDepressionsSteps
 * (default 250), `lakeElevationLimitOutput` → lakeElevationLimit (default
 * 20), `heightExponentInput` → heightExponent (default 2)) are explicit
 * parameters. A commented-out debug SVG block in drainWater was dropped.
 */
import Alea from "alea";
import { mean, min, sum } from "./d3Shim";
import { each, rn, rw } from "./utils";
import type { Grid } from "./utils/graphUtils";
import type { Point } from "./voronoi";
import type { Pack, PackedGraphFeature } from "./features";
import { Lakes } from "./lakes";

export interface River {
  i: number; // river id
  source: number; // source cell index
  mouth: number; // mouth cell index
  parent: number; // parent river id
  basin: number; // basin river id
  length: number; // river length
  discharge: number; // river discharge in m3/s
  width: number; // mouth width in km
  widthFactor: number; // width scaling factor
  sourceWidth: number; // source width in km
  name: string; // river name
  type: string; // river type
  cells: number[]; // cells forming the river path
}

export interface RiversGenerateOptions {
  seed: string;
  grid: Grid;
  pack: Pack;
  cellsDesired: number; // upstream pointsInput.dataset.cells
  graphWidth: number;
  graphHeight: number;
  resolveDepressionsSteps: number; // upstream resolveDepressionsStepsOutput.value, default 250
  lakeElevationLimit: number; // upstream lakeElevationLimitOutput.value, default 20
  heightExponent: number; // upstream heightExponentInput.value, default 2
  allowErosion?: boolean; // upstream generate(allowErosion = true)
}

class RiverModule {
  private FLUX_FACTOR = 500;
  private MAX_FLUX_WIDTH = 1;
  private LENGTH_FACTOR = 200;
  private LENGTH_STEP_WIDTH = 1 / this.LENGTH_FACTOR;
  private LENGTH_PROGRESSION = [1, 1, 2, 3, 5, 8, 13, 21, 34].map(
    (n) => n / this.LENGTH_FACTOR,
  );

  generate(options: RiversGenerateOptions) {
    const {
      seed,
      grid,
      pack,
      cellsDesired,
      graphWidth,
      graphHeight,
      resolveDepressionsSteps,
      lakeElevationLimit,
      heightExponent,
      allowErosion = true,
    } = options;

    Math.random = Alea(seed);
    const { cells, features } = pack;

    const riversData: { [riverId: number]: number[] } = {};
    const riverParents: { [key: number]: number } = {};

    const addCellToRiver = (cellId: number, riverId: number) => {
      if (!riversData[riverId]) riversData[riverId] = [cellId];
      else riversData[riverId].push(cellId);
    };

    const drainWater = () => {
      const MIN_FLUX_TO_FORM_RIVER = 30;
      const cellsNumberModifier = (cellsDesired / 10000) ** 0.25;

      const prec = grid.cells.prec!;
      const land = cells.i
        .filter((i: number) => h[i] >= 20)
        .sort((a: number, b: number) => h[b] - h[a]);
      const lakeOutCells = Lakes.defineClimateData(
        h,
        grid,
        pack,
        heightExponent,
      );

      for (const i of land) {
        cells.fl![i] += prec[cells.g![i]] / cellsNumberModifier; // add flux from precipitation

        // create lake outlet if lake is not in deep depression and flux > evaporation
        const lakes: PackedGraphFeature[] = lakeOutCells[i]
          ? features.filter(
              (feature: PackedGraphFeature) =>
                i === feature.outCell && feature.flux > feature.evaporation,
            )
          : [];
        for (const lake of lakes) {
          const lakeCell = cells.c[i].find(
            (c: number) => h[c] < 20 && cells.f![c] === lake.i,
          )!;
          cells.fl![lakeCell] += Math.max(lake.flux - lake.evaporation, 0); // not evaporated lake water drains to outlet

          // allow chain lakes to retain identity
          if (cells.r![lakeCell] !== lake.river) {
            const sameRiver = cells.c[lakeCell].some(
              (c: number) => cells.r![c] === lake.river,
            );

            if (sameRiver) {
              cells.r![lakeCell] = lake.river as number;
              addCellToRiver(lakeCell, lake.river as number);
            } else {
              cells.r![lakeCell] = riverNext;
              addCellToRiver(lakeCell, riverNext);
              riverNext++;
            }
          }

          lake.outlet = cells.r![lakeCell];
          flowDown(i, cells.fl![lakeCell], lake.outlet);
        }

        // assign all tributary rivers to outlet basin
        const outlet = lakes[0]?.outlet;
        for (const lake of lakes) {
          if (!Array.isArray(lake.inlets)) continue;
          for (const inlet of lake.inlets) {
            riverParents[inlet] = outlet as number;
          }
        }

        // near-border cell: pour water out of the screen
        if (cells.b[i] && cells.r![i]) {
          addCellToRiver(-1, cells.r![i]);
          continue;
        }

        // downhill cell (make sure it's not in the source lake)
        let min = null;
        if (lakeOutCells[i]) {
          const filtered = cells.c[i].filter(
            (c: number) =>
              !lakes.map((lake) => lake.i).includes(cells.f![c]),
          );
          min = filtered.sort((a: number, b: number) => h[a] - h[b])[0];
        } else if (cells.haven![i]) {
          min = cells.haven![i];
        } else {
          min = cells.c[i].sort((a: number, b: number) => h[a] - h[b])[0];
        }

        // cells is depressed
        if (h[i] <= h[min]) continue;

        if (cells.fl![i] < MIN_FLUX_TO_FORM_RIVER) {
          // flux is too small to operate as a river
          if (h[min] >= 20) cells.fl![min] += cells.fl![i];
          continue;
        }

        // proclaim a new river
        if (!cells.r![i]) {
          cells.r![i] = riverNext;
          addCellToRiver(i, riverNext);
          riverNext++;
        }

        flowDown(min, cells.fl![i], cells.r![i]);
      }
    };

    const flowDown = (toCell: number, fromFlux: number, river: number) => {
      const toFlux = cells.fl![toCell] - cells.conf![toCell];
      const toRiver = cells.r![toCell];

      if (toRiver) {
        // downhill cell already has river assigned
        if (fromFlux > toFlux) {
          cells.conf![toCell] += cells.fl![toCell]; // mark confluence
          if (h[toCell] >= 20) riverParents[toRiver] = river; // min river is a tributary of current river
          cells.r![toCell] = river; // re-assign river if downhill part has less flux
        } else {
          cells.conf![toCell] += fromFlux; // mark confluence
          if (h[toCell] >= 20) riverParents[river] = toRiver; // current river is a tributary of min river
        }
      } else cells.r![toCell] = river; // assign the river to the downhill cell

      if (h[toCell] < 20) {
        // pour water to the water body
        const waterBody = features[cells.f![toCell]];
        if (waterBody.type === "lake") {
          if (
            !waterBody.river ||
            fromFlux > (waterBody.enteringFlux as number)
          ) {
            waterBody.river = river;
            waterBody.enteringFlux = fromFlux;
          }
          waterBody.flux = waterBody.flux + fromFlux;
          if (!waterBody.inlets) waterBody.inlets = [river];
          else waterBody.inlets.push(river);
        }
      } else {
        // propagate flux and add next river segment
        cells.fl![toCell] += fromFlux;
      }

      addCellToRiver(toCell, river);
    };

    const defineRivers = () => {
      // re-initialize rivers and confluence arrays
      cells.r = new Uint16Array(cells.i.length);
      cells.conf = new Uint16Array(cells.i.length);
      pack.rivers = [];

      const defaultWidthFactor = rn(1 / (cellsDesired / 10000) ** 0.25, 2);
      const mainStemWidthFactor = defaultWidthFactor * 1.2;

      for (const key in riversData) {
        const riverCells = riversData[key as unknown as number];
        if (riverCells.length < 3) continue; // exclude tiny rivers

        const riverId = +key;
        for (const cell of riverCells) {
          if (cell < 0 || cells.h[cell] < 20) continue;

          // mark real confluences and assign river to cells
          if (cells.r[cell]) cells.conf[cell] = 1;
          else cells.r[cell] = riverId;
        }

        const source = riverCells[0];
        const mouth = riverCells[riverCells.length - 2];
        const parent = riverParents[key as unknown as number] || 0;

        const widthFactor =
          !parent || parent === riverId
            ? mainStemWidthFactor
            : defaultWidthFactor;
        const meanderedPoints = this.addMeandering(
          riverCells,
          pack,
          graphWidth,
          graphHeight,
        );
        const discharge = cells.fl![mouth]; // m3 in second
        const length = this.getApproximateLength(meanderedPoints);
        const sourceWidth = this.getSourceWidth(cells.fl![source]);
        const width = this.getWidth(
          this.getOffset({
            flux: discharge,
            pointIndex: meanderedPoints.length,
            widthFactor,
            startingWidth: sourceWidth,
          }),
        );

        pack.rivers.push({
          i: riverId,
          source,
          mouth,
          discharge,
          length,
          width,
          widthFactor,
          sourceWidth,
          parent,
          cells: riverCells,
        } as River);
      }
    };

    const downcutRivers = () => {
      const MAX_DOWNCUT = 5;

      for (const i of pack.cells.i) {
        if (cells.h[i] < 35) continue; // don't donwcut lowlands
        if (!cells.fl![i]) continue;

        const higherCells = cells.c[i].filter(
          (c: number) => cells.h[c] > cells.h[i],
        );
        const higherFlux =
          higherCells.reduce(
            (acc: number, c: number) => acc + cells.fl![c],
            0,
          ) / higherCells.length;
        if (!higherFlux) continue;

        const downcut = Math.floor(cells.fl![i] / higherFlux);
        if (downcut) cells.h[i] -= Math.min(downcut, MAX_DOWNCUT);
      }
    };

    const calculateConfluenceFlux = () => {
      for (const i of cells.i) {
        if (!cells.conf![i]) continue;

        const sortedInflux = cells.c[i]
          .filter((c: number) => cells.r![c] && h[c] > h[i])
          .map((c: number) => cells.fl![c])
          .sort((a: number, b: number) => b - a);
        cells.conf![i] = sortedInflux.reduce(
          (acc: number, flux: number, index: number) =>
            index ? acc + flux : acc,
          0,
        );
      }
    };

    cells.fl = new Uint16Array(cells.i.length); // water flux array
    cells.r = new Uint16Array(cells.i.length); // rivers array
    cells.conf = new Uint8Array(cells.i.length); // confluences array
    let riverNext = 1; // first river id is 1

    const h = this.alterHeights(pack);
    Lakes.detectCloseLakes(h, pack, lakeElevationLimit);
    this.resolveDepressions(h, pack, resolveDepressionsSteps);
    drainWater();
    defineRivers();

    calculateConfluenceFlux();
    Lakes.cleanupLakeData(pack);

    if (allowErosion) {
      cells.h = Uint8Array.from(h); // apply gradient
      downcutRivers(); // downcut river beds
    }
  }

  alterHeights(pack: Pack): number[] {
    const { h, c, t } = pack.cells as unknown as {
      h: Uint8Array;
      c: number[][];
      t: Int8Array;
    };
    return Array.from(h).map((h, i) => {
      if (h < 20 || t[i] < 1) return h;
      return h + t[i] / 100 + (mean(c[i].map((c) => t[c])) as number) / 10000;
    });
  }

  // depression filling algorithm (for a correct water flux modeling)
  resolveDepressions(h: number[], pack: Pack, maxIterations: number) {
    const { cells, features } = pack;
    const checkLakeMaxIteration = maxIterations * 0.85;
    const elevateLakeMaxIteration = maxIterations * 0.75;

    const height = (i: number) => features[cells.f![i]].height || h[i]; // height of lake or specific cell

    const lakes = features.filter((feature) => feature.type === "lake");
    const land = cells.i.filter((i: number) => h[i] >= 20 && !cells.b[i]); // exclude near-border cells
    land.sort((a: number, b: number) => h[a] - h[b]); // lowest cells go first

    const progress: number[] = [];
    let depressions: number = Infinity;
    let prevDepressions: number | null = null;
    for (
      let iteration = 0;
      depressions && iteration < maxIterations;
      iteration++
    ) {
      if (progress.length > 5 && sum(progress) > 0) {
        // UPSTREAM QUIRK PRESERVED: this rebinds only the local parameter
        // `h` — the caller's array keeps the partial elevation changes made
        // in earlier iterations (the fresh alterHeights() result is unused
        // because of the immediate break).
        // bad progress, abort and set heights back
        h = this.alterHeights(pack);
        depressions = progress[0];
        break;
      }

      depressions = 0;

      if (iteration < checkLakeMaxIteration) {
        for (const l of lakes) {
          if (l.closed) continue;
          const minHeight = min(
            l.shoreline.map((s: number) => h[s]),
          ) as number;
          if (minHeight >= 100 || l.height > minHeight) continue;

          if (iteration > elevateLakeMaxIteration) {
            l.shoreline.forEach((i: number) => {
              h[i] = cells.h[i];
            });
            l.height =
              (min(l.shoreline.map((s: number) => h[s])) as number) - 1;
            l.closed = true;
            continue;
          }

          depressions++;
          l.height = (minHeight as number) + 0.2;
        }
      }

      for (const i of land) {
        const minHeight = min(
          cells.c[i].map((c: number) => height(c)),
        ) as number;
        if (minHeight >= 100 || h[i] > minHeight) continue;

        depressions++;
        h[i] = minHeight + 0.1;
      }

      prevDepressions !== null && progress.push(depressions - prevDepressions);
      prevDepressions = depressions;
    }
  }

  addMeandering(
    riverCells: number[],
    pack: Pack,
    graphWidth: number,
    graphHeight: number,
    riverPoints: Point[] | null = null,
    meandering = 0.5,
  ): [number, number, number][] {
    const { fl, h } = pack.cells;
    const meandered = [];
    const lastStep = riverCells.length - 1;
    const points = this.getRiverPoints(
      riverCells,
      riverPoints,
      pack,
      graphWidth,
      graphHeight,
    );
    let step = h[riverCells[0]] < 20 ? 1 : 10;

    for (let i = 0; i <= lastStep; i++, step++) {
      const cell = riverCells[i];
      const isLastCell = i === lastStep;

      const [x1, y1] = points[i];

      meandered.push([x1, y1, fl![cell]]);
      if (isLastCell) break;

      const nextCell = riverCells[i + 1];
      const [x2, y2] = points[i + 1];

      if (nextCell === -1) {
        meandered.push([x2, y2, fl![cell]]);
        break;
      }

      const dist2 = (x2 - x1) ** 2 + (y2 - y1) ** 2; // square distance between cells
      if (dist2 <= 25 && riverCells.length >= 6) continue;

      const meander =
        meandering + 1 / step + Math.max(meandering - step / 100, 0);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const sinMeander = Math.sin(angle) * meander;
      const cosMeander = Math.cos(angle) * meander;

      if (step < 20 && (dist2 > 64 || (dist2 > 36 && riverCells.length < 5))) {
        // if dist2 is big or river is small add extra points at 1/3 and 2/3 of segment
        const p1x = (x1 * 2 + x2) / 3 + -sinMeander;
        const p1y = (y1 * 2 + y2) / 3 + cosMeander;
        const p2x = (x1 + x2 * 2) / 3 + sinMeander / 2;
        const p2y = (y1 + y2 * 2) / 3 - cosMeander / 2;
        meandered.push([p1x, p1y, 0], [p2x, p2y, 0]);
      } else if (dist2 > 25 || riverCells.length < 6) {
        // if dist is medium or river is small add 1 extra middlepoint
        const p1x = (x1 + x2) / 2 + -sinMeander;
        const p1y = (y1 + y2) / 2 + cosMeander;
        meandered.push([p1x, p1y, 0]);
      }
    }

    return meandered as [number, number, number][];
  }

  getRiverPoints(
    riverCells: number[],
    riverPoints: Point[] | null,
    pack: Pack,
    graphWidth: number,
    graphHeight: number,
  ): Point[] {
    if (riverPoints) return riverPoints;

    const { p } = pack.cells;
    return riverCells.map((cell, i) => {
      if (cell === -1)
        return this.getBorderPoint(
          riverCells[i - 1],
          pack,
          graphWidth,
          graphHeight,
        );
      return p[cell];
    });
  }

  getBorderPoint(
    i: number,
    pack: Pack,
    graphWidth: number,
    graphHeight: number,
  ): Point {
    const [x, y] = pack.cells.p[i];
    const min = Math.min(y, graphHeight - y, x, graphWidth - x);
    if (min === y) return [x, 0];
    else if (min === graphHeight - y) return [x, graphHeight];
    else if (min === x) return [0, y];
    return [graphWidth, y];
  }

  getOffset({
    flux,
    pointIndex,
    widthFactor,
    startingWidth,
  }: {
    flux: number;
    pointIndex: number;
    widthFactor: number;
    startingWidth: number;
  }) {
    if (pointIndex === 0) return startingWidth;

    const fluxWidth = Math.min(
      flux ** 0.7 / this.FLUX_FACTOR,
      this.MAX_FLUX_WIDTH,
    );
    const lengthWidth =
      pointIndex * this.LENGTH_STEP_WIDTH +
      (this.LENGTH_PROGRESSION[pointIndex] ||
        (this.LENGTH_PROGRESSION.at(-1) as number));
    return widthFactor * (lengthWidth + fluxWidth) + startingWidth;
  }

  getSourceWidth(flux: number) {
    return rn(Math.min(flux ** 0.9 / this.FLUX_FACTOR, this.MAX_FLUX_WIDTH), 2);
  }

  getApproximateLength(points: [number, number, number][]) {
    const length = points.reduce(
      (s, v, i, p) =>
        s + (i ? Math.hypot(v[0] - p[i - 1][0], v[1] - p[i - 1][1]) : 0),
      0,
    );
    return rn(length, 2);
  }

  // Real mouth width examples: Amazon 6000m, Volga 6000m, Dniepr 3000m, Mississippi 1300m, Themes 900m,
  // Danube 800m, Daugava 600m, Neva 500m, Nile 450m, Don 400m, Wisla 300m, Pripyat 150m, Bug 140m, Muchavets 40m
  getWidth(offset: number) {
    return rn((offset / 1.5) ** 1.8, 2); // mouth width in km
  }

  /* ---- slice-3 naming stage (upstream Rivers.specify, runs after
     Provinces.generate in main.js generate()) ---- */

  riverTypes = {
    main: {
      big: { River: 1 },
      small: { Creek: 9, River: 3, Brook: 3, Stream: 1 },
    },
    fork: {
      big: { Fork: 1 },
      small: { Branch: 1 },
    },
  };

  smallLength: number | null = null;

  specify(pack: Pack, names: import("./names-generator").NamesGenerator) {
    this.smallLength = null; // per-run reset, see file header
    const rivers = pack.rivers!;
    if (!rivers.length) return;

    for (const river of rivers) {
      river.basin = this.getBasin(river.i, pack);
      river.name = this.getName(river.mouth, pack, names);
      river.type = this.getType(river, pack);
    }
  }

  getName(
    cell: number,
    pack: Pack,
    names: import("./names-generator").NamesGenerator,
  ) {
    return names.getCulture(pack.cells.culture![cell]);
  }

  getType({ i, length, parent }: River, pack: Pack) {
    if (this.smallLength === null) {
      const threshold = Math.ceil(pack.rivers!.length * 0.15);
      this.smallLength = pack
        .rivers!.map((r) => r.length || 0)
        .sort((a: number, b: number) => a - b)[threshold];
    }

    const isSmall: boolean = length < (this.smallLength as number);
    const isFork = each(3)(i) && parent && parent !== i;
    return rw(
      this.riverTypes[isFork ? "fork" : "main"][isSmall ? "small" : "big"],
    );
  }

  getBasin(riverId: number, pack: Pack): number {
    const parent = pack.rivers!.find((river) => river.i === riverId)?.parent;
    if (!parent || riverId === parent) return riverId;
    return this.getBasin(parent, pack);
  }
}

/** Module-level singleton, mirroring upstream `window.Rivers`. */
export const Rivers = new RiverModule();
