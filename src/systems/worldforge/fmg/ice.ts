/**
 * @file ice.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: .tmp/azgaar-src/src/modules/ice.ts. See ./ATTRIBUTION.md.
 *
 * Ported: generate() — glaciers (isoline polygons over cold land) and
 * icebergs (per-cell P/rand draws over cold water).
 *
 * RNG CONTRACT (the reason this module must exist even though no later stage
 * reads pack.ice): upstream Ice.generate reseeds `Math.random = Alea(seed)`
 * and then draws P(0.8) for every eligible water cell plus rand() for each
 * kept iceberg. None of rankCells/Cultures/Burgs/States/Routes/Religions
 * reseeds afterwards, so the ENTIRE civilization layer consumes the stream
 * exactly as Ice leaves it. Skipping Ice would shift every later draw.
 *
 * Stripped (editor-only): getNextId gap-filling reuse is KEPT (generate calls
 * it), but addIceberg/removeIce/randomizeIcebergShape/changeIcebergSize
 * (iceberg editor handlers, call redraw* SVG functions) were left behind.
 */
import Alea from "alea";
import { min } from "./d3Shim";
import { clipPoly } from "./utils/commonUtils";
import { getGridPolygon } from "./utils/graphUtils";
import { getIsolines } from "./utils/pathUtils";
import { lerp, minmax, normalize, rn } from "./utils/numberUtils";
import { P, rand } from "./utils/probabilityUtils";
import type { Grid } from "./utils/graphUtils";
import type { Point } from "./voronoi";
import type { Pack } from "./features";

export interface IceElement {
  i: number;
  points: number[][];
  type: "glacier" | "iceberg";
  cellId?: number;
  size?: number;
}

export class IceModule {
  // Find next available id for new ice element idealy filling gaps
  private getNextId(pack: Pack) {
    if (pack.ice!.length === 0) return 0;
    // find gaps in existing ids
    const existingIds = pack.ice!.map((e) => e.i).sort((a, b) => a - b);
    for (let id = 0; id < existingIds[existingIds.length - 1]; id++) {
      if (!existingIds.includes(id)) return id;
    }
    return existingIds[existingIds.length - 1] + 1;
  }

  // Clear all ice
  private clear(pack: Pack) {
    pack.ice = [];
  }

  // Generate glaciers and icebergs based on temperature and height
  public generate({
    seed,
    grid,
    pack,
    graphWidth,
    graphHeight,
  }: {
    seed: string;
    grid: Grid;
    pack: Pack;
    graphWidth: number;
    graphHeight: number;
  }) {
    this.clear(pack);
    const { cells } = grid;
    const features = grid.features!;
    const { temp, h } = cells;
    Math.random = Alea(seed);

    const ICEBERG_MAX_TEMP = 0;
    const GLACIER_MAX_TEMP = -8;
    const minMaxTemp = min(temp! as unknown as Iterable<number>)!;

    // Generate glaciers on cold land
    {
      const type = "iceShield";
      const getType = (cellId: number) =>
        h![cellId] >= 20 && temp![cellId] <= GLACIER_MAX_TEMP ? type : null;
      const isolines = getIsolines(grid, getType, { polygons: true });

      if (isolines[type]?.polygons) {
        isolines[type].polygons.forEach((points: Point[]) => {
          const clipped = clipPoly(points, graphWidth, graphHeight);
          pack.ice!.push({
            i: this.getNextId(pack),
            points: clipped,
            type: "glacier",
          });
        });
      }
    }

    // Generate icebergs on cold water
    for (const cellId of cells.i) {
      const t = temp![cellId];
      if (h![cellId] >= 20) continue; // no icebergs on land
      if (t > ICEBERG_MAX_TEMP) continue; // too warm: no icebergs
      if (features[cells.f![cellId]].type === "lake") continue; // no icebergs on lakes
      if (P(0.8)) continue; // skip most of eligible cells

      const randomFactor = 0.8 + rand() * 0.4; // random size factor
      let baseSize = (1 - normalize(t, minMaxTemp, 1)) * 0.8; // size: 0 = zero, 1 = full
      if (cells.t![cellId] === -1) baseSize /= 1.3; // coastline: smaller icebergs
      const size = minmax(rn(baseSize * randomFactor, 2), 0.1, 1);

      const [cx, cy] = grid.points[cellId];
      const points = getGridPolygon(cellId, grid as never).map(([x, y]: Point) => [
        rn(lerp(cx, x, size), 2),
        rn(lerp(cy, y, size), 2),
      ]);

      pack.ice!.push({
        i: this.getNextId(pack),
        points,
        type: "iceberg",
        cellId,
        size,
      });
    }
  }
}

export const Ice = new IceModule();
