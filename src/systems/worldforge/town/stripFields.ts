/**
 * @file stripFields.ts — STRIP FIELDS: farm parcels cut into narrow strips
 * that run back from the nearest road (GG-551).
 *
 * WHY THIS EXISTS (town-look pass, 2026-10-31). The outskirts were 18 to 80
 * flat Voronoi parcels of farm, pasture and scrub. Watabou shows groups of
 * narrow strip fields near the town, the open-field look of worked land. Each
 * FARM parcel is now cut into strips; pasture and scrub stay whole.
 *
 * THE RULE. A strip's long side runs away from the road that serves the field
 * (a field is ploughed from its headland at the road). When no road passes
 * near the parcel, the strips run out from the town instead. The cut lines are
 * half-planes, so each strip is an exact piece of its convex Voronoi parcel.
 * Width is about two-thirds of a chain (44 ft), varied per strip.
 *
 * Pure: no React, no DOM, no import of `townEngine` at run time.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 05:24:20
 * Dependents: systems/worldforge/town/townEngine.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { Pt } from '../submap/submapEngine';
import { clipHalfPlanes, signedArea } from './townLots';
import type { TownOutskirt } from './townEngine';

/** Nominal strip width in feet: two-thirds of a 66 ft chain. */
export const STRIP_FIELD_WIDTH_FT = 44;

function centroid(poly: readonly Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / (poly.length || 1), y / (poly.length || 1)];
}

/** Unit tangent of the road segment nearest to `p`, and its distance; null with no roads. */
function nearestRoad(p: Pt, roads: readonly Pt[][]): { t: Pt; d: number } | null {
  let best: { t: Pt; d: number } | null = null;
  for (const line of roads) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) continue;
      const f = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
      const d = Math.hypot(p[0] - (a[0] + dx * f), p[1] - (a[1] + dy * f));
      if (!best || d < best.d) {
        const L = Math.sqrt(L2);
        best = { t: [dx / L, dy / L], d };
      }
    }
  }
  return best;
}

/**
 * Cut every farm parcel into strips (see the file header). Non-farm parcels
 * pass through unchanged and keep their order; each farm parcel is replaced in
 * place by its strips.
 */
export function stripFarmParcels(args: {
  outskirts: readonly TownOutskirt[];
  /** Candidate3 homesteads need the actual pre-strip agricultural source area. */
  retainParentParcels?: boolean;
  /** Roads the fields are served from (plan units). */
  roads: readonly Pt[][];
  /** Town center: strips with no road nearby run out from it. */
  center: Pt;
  /** Strip width in plan units, before the roll. */
  stripWidth: number;
  /** A road farther than this from a parcel's center does not serve it. */
  roadReach: number;
  seedPath: SeedPath;
}): TownOutskirt[] {
  const { outskirts, roads, center, stripWidth, roadReach, seedPath } = args;
  const out: TownOutskirt[] = [];
  outskirts.forEach((parcel, index) => {
    if (parcel.kind !== 'farm' || parcel.polygon.length < 3 || !(stripWidth > 0)) {
      out.push(parcel);
      return;
    }
    const parentStamp=()=>args.retainParentParcels?{farmParent:{id:'farm-parent:'+index,polygon:parcel.polygon.map(([x,y])=>[x,y] as Pt)}}:{};
    const c = centroid(parcel.polygon);
    const road = nearestRoad(c, roads);
    // `axis` runs ALONG the road: strips are stacked along it, each running
    // back from the road. With no road in reach, stack them around the town.
    let axis: Pt;
    if (road && road.d <= roadReach) {
      axis = road.t;
    } else {
      const rx = c[0] - center[0], ry = c[1] - center[1];
      const rl = Math.hypot(rx, ry) || 1;
      axis = [-ry / rl, rx / rl];
    }
    let sMin = Infinity, sMax = -Infinity;
    for (const p of parcel.polygon) {
      const sv = axis[0] * p[0] + axis[1] * p[1];
      if (sv < sMin) sMin = sv;
      if (sv > sMax) sMax = sv;
    }
    const rng = rngFromPath(streamPath(seedPath, `strip:${index}`));
    const furrowAngle = Math.atan2(axis[0], -axis[1]); // the long side: across `axis`
    const minArea = (stripWidth * stripWidth) * 0.5;
    let s = sMin;
    const strips: TownOutskirt[] = [];
    while (s < sMax - 1e-9) {
      let w = stripWidth * (0.7 + rng.next() * 0.7);
      if (sMax - (s + w) < stripWidth * 0.5) w = sMax - s;
      const piece = clipHalfPlanes(parcel.polygon, [
        { nx: -axis[0], ny: -axis[1], c: -s },
        { nx: axis[0], ny: axis[1], c: s + w },
      ]);
      s += w;
      if (piece.length >= 3 && Math.abs(signedArea(piece)) >= minArea) {
        strips.push({ polygon: piece, kind: 'farm', furrowAngle, ...parentStamp() });
      }
    }
    if (strips.length === 0) out.push(args.retainParentParcels?{...parcel,...parentStamp()}:parcel);
    else out.push(...strips);
  });
  return out;
}
