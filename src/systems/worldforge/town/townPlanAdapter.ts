/**
 * @file townPlanAdapter.ts — fold a rich `townEngine` TownPlan (organic wards,
 * walls, civic) into the flat `artifacts.ts` TownPlan that the 3D ground bake
 * consumes (streets + plots with role + storeys), plus the wall ring (which the
 * artifact shape has no slot for — the 3D loader renders it separately).
 *
 * Roles map into the buckets the 3D loader keys off
 * (`groundChunkLoader.ts`: `isBiz = role === 'market' || 'workshop'`) and mirror
 * `TownPlanView.describeBuilding` so 2D labels and 3D roles agree.
 */
import type { TownPlan as EngineTownPlan, BuildingPlot, CivicKind } from './townEngine';
import type { TownPlan as ArtifactTownPlan } from '../artifacts';
import type { Pt } from '../submap/submapEngine';
import { isResidential, type BuildingType } from './population';

export interface AdaptedTownPlan {
  plan: ArtifactTownPlan;
  /** Wall ring + gatehouses, plus the river water-gate breaks (TG7). */
  walls: { ring: Pt[]; gatehouses: Pt[]; waterGates: Pt[] };
}

/** Town street default width (feet) when the engine plan carries no per-street width. */
const STREET_WIDTH_FT = 12;

/**
 * Drop only DEGENERATE slivers here (feet). The 3D bake additionally skips any
 * plot that covers no ground tile (so every rendered building gets a level pad);
 * this just removes near-zero-area quads up front.
 */
const MIN_PLOT_SIDE_FT = 3;

/** Side lengths of an oriented quad (corners wound in order). */
function quadSides(q: [Pt, Pt, Pt, Pt]): [number, number] {
  const d = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [d(q[0], q[1]), d(q[1], q[2])];
}

/** BuildingType / ward-civic → the role buckets the 3D loader understands. */
function roleForPlot(plot: BuildingPlot, wardCivic?: CivicKind): string {
  const t = plot.buildingType;
  if (t) {
    if (isResidential(t)) return 'house';
    if (t === 'inn' || t === 'tavern' || t === 'shop') return 'market';
    if (t === 'smithy' || t === 'workshop' || t === 'storehouse') return 'workshop';
    if (t === 'civic') return 'civic';
  }
  // No population pass tagged this plot: bias the market square's ward to shops.
  if (wardCivic === 'plaza') return 'market';
  return 'house';
}

/** Civic STRUCTURE kind → a building role (open spaces render no box → skipped). */
function roleForCivic(kind: CivicKind): string | null {
  switch (kind) {
    case 'temple': return 'temple';
    case 'keep': return 'keep';
    case 'citadel': return 'keep';
    case 'plaza': return null;   // open square — no building
    case 'dock': return null;    // waterfront structure — follow-up
    case 'bridge': return null;
    default: return null;
  }
}

/**
 * Oriented bounding quad (4 corners, wound CCW) aligned to the polygon's
 * longest edge. The 3D pipeline assumes 4-corner convex footprints (oriented-box
 * geometry + point-in-convex-quad pad/coverage tests); townEngine plots may be
 * L-shaped or have extra vertices, so we reduce each to its frontage-aligned
 * rectangle. A clean 4-point rect passes through essentially unchanged.
 */
function orientedQuad(poly: Pt[]): [Pt, Pt, Pt, Pt] {
  // Longest edge → frontage direction.
  let bestLen = -1, ang = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    if (len > bestLen) { bestLen = len; ang = Math.atan2(dy, dx); }
  }
  const cos = Math.cos(-ang), sin = Math.sin(-ang);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const [x, y] of poly) {
    const u = x * cos - y * sin;
    const v = x * sin + y * cos;
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  // Inset by INSET_FRAC toward the rect center so neighbouring buildings never
  // share a ground tile (the terrain-pad pass requires non-overlapping
  // footprints) and a readable street gap remains between plots.
  const INSET_FRAC = 0.12;
  const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
  const iMinU = minU + (midU - minU) * INSET_FRAC, iMaxU = maxU - (maxU - midU) * INSET_FRAC;
  const iMinV = minV + (midV - minV) * INSET_FRAC, iMaxV = maxV - (maxV - midV) * INSET_FRAC;
  // Corners in rotated frame, back-rotated into world space.
  const back = (u: number, v: number): Pt => {
    const c = Math.cos(ang), s = Math.sin(ang);
    return [u * c - v * s, u * s + v * c];
  };
  return [back(iMinU, iMinV), back(iMaxU, iMinV), back(iMaxU, iMaxV), back(iMinU, iMaxV)];
}

/** Stable 0..1 hash from a polygon centroid (deterministic storey variety). */
function centroidHash01(poly: Pt[]): number {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length || 1; cy /= poly.length || 1;
  let h = Math.imul((cx | 0) + 374761393, 668265263) ^ Math.imul((cy | 0) + 1, 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 0xffffffff;
}

/** Storeys by role (taller civic/commercial), with deterministic ±1 for homes. */
export function storeysForRole(role: string, poly: Pt[]): number {
  if (role === 'temple' || role === 'keep') return 3;
  if (role === 'market' || role === 'workshop' || role === 'civic') return 2;
  return centroidHash01(poly) < 0.4 ? 2 : 1; // houses: a minority are two-storey
}

/**
 * Convert an engine TownPlan (any coord frame) into the artifact plan + walls.
 * Coordinates pass through unchanged — convert the frame BEFORE calling this
 * (see `transformTownPlanToFeet`).
 */
export function toArtifactPlan(plan: EngineTownPlan, burgId: number): AdaptedTownPlan {
  const plots: ArtifactTownPlan['plots'] = [];
  let id = 0;

  for (const ward of plan.wards) {
    for (const pl of ward.plots) {
      const quad = orientedQuad(pl.polygon);
      const [w, d] = quadSides(quad);
      if (Math.min(w, d) < MIN_PLOT_SIDE_FT) continue; // sub-tile sliver — skip
      const role = roleForPlot(pl, ward.civic);
      plots.push({
        id: id++,
        footprint: quad,
        role,
        storeys: storeysForRole(role, pl.polygon),
      });
    }
  }

  // Civic structures (keep/temple/citadel) become their own labelled plots so
  // the 3D town shows its landmarks; open spaces (plaza) render no box.
  for (const c of plan.civic) {
    const role = roleForCivic(c.kind);
    if (!role) continue;
    plots.push({
      id: id++,
      footprint: orientedQuad(c.polygon),
      role,
      storeys: storeysForRole(role, c.polygon),
    });
  }

  const streets: ArtifactTownPlan['streets'] = plan.streets
    .filter((s) => s.length >= 2)
    .map((s, i) => ({
      id: i,
      centerline: s.map(([x, y]) => [x, y] as [number, number]),
      widthFt: STREET_WIDTH_FT,
    }));

  return {
    plan: { burgId, streets, plots },
    walls: {
      ring: plan.walls.ring,
      gatehouses: plan.walls.gatehouses,
      waterGates: plan.walls.waterGates ?? [],
    },
  };
}
