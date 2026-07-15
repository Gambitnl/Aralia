// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 22:16:04
 * Dependents: components/Worldforge/TownPlanView.tsx, systems/worldforge/town/townEngine.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file courtyardSpaces.ts - resolves the open space shared by interior-block
 * buildings after all collision filtering has finished.
 *
 * The town engine owns building geometry; this module owns the durable receipt
 * for the space that geometry encloses. Keeping the receipt separate lets the
 * 2D map, artifact adapter, 3D prop layer, and tactical extraction consume the
 * same court and amenity instead of independently guessing from plot centers.
 */
import { fnv1a, rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { pointInPolygon, polygonBounds, type Pt } from '../submap/submapEngine';
import type { TownArchitectureDistrict } from './architectureDistricts';
import type { WardWealth } from './population';

// ---------------------------------------------------------------------------
// Canonical receipt
// ---------------------------------------------------------------------------

/** A district-appropriate use for the open center of a residential block. */
export type CourtyardAmenity = 'well' | 'wash-yard' | 'work-yard' | 'garden';

/** Shared open space enclosed by a ward's court-facing interior buildings. */
export interface TownCourtyardSpace {
  /** Stable identity inside one generated town. */
  id: string;
  /** Owning ward and ensemble block identities. */
  wardIndex: number;
  blockKey: string;
  /** Center and usable radius in the town plan's current coordinate frame. */
  center: Pt;
  radius: number;
  /** District identity survives even when no style family has been resolved. */
  districtKey: string;
  wealth: WardWealth;
  amenity: CourtyardAmenity;
  /** Compact deterministic evidence used by inspectors and regression tests. */
  courtyardSignature: string;
}

/** Minimal structural input keeps this resolver independent of townEngine.ts. */
export interface CourtyardWardInput {
  block: Pt[];
  plots: Array<{
    kind?: 'frontage' | 'interior';
    courtyardIndex?: number;
    polygon: Pt[];
    ensemble?: { blockKey: string };
  }>;
  wealth?: WardWealth;
  architectureDistrict?: TownArchitectureDistrict;
}

// ---------------------------------------------------------------------------
// Geometry and district use
// ---------------------------------------------------------------------------

/** Vertex-average center is stable for the convex-ish Voronoi blocks here. */
function polygonCenter(points: Pt[]): Pt {
  if (points.length === 0) return [0, 0];
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point[0];
    y += point[1];
  }
  return [x / points.length, y / points.length];
}

/**
 * Derive the same bounded court centers for packing and receipt resolution.
 * Multiple centers follow the block's long axis; offsets collapse toward the
 * center when an irregular convex-ish block would otherwise place one outside.
 */
export function courtyardCentersForBlock(block: Pt[], count: number): Pt[] {
  const center = polygonCenter(block);
  const total = Math.max(1, Math.min(3, Math.floor(count)));
  if (total === 1) return [center];
  const bounds = polygonBounds(block);
  const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
  const longSpan = horizontal
    ? bounds.maxX - bounds.minX
    : bounds.maxY - bounds.minY;
  const spacing = longSpan * (total === 2 ? 0.14 : 0.18);
  return Array.from({ length: total }, (_, index) => {
    const ordinal = index - (total - 1) / 2;
    let scale = 1;
    let candidate: Pt = horizontal
      ? [center[0] + ordinal * spacing, center[1]]
      : [center[0], center[1] + ordinal * spacing];
    while (!pointInPolygon(candidate, block) && scale > 0.125) {
      scale *= 0.5;
      candidate = horizontal
        ? [center[0] + ordinal * spacing * scale, center[1]]
        : [center[0], center[1] + ordinal * spacing * scale];
    }
    return candidate;
  });
}

/** Euclidean distance from a point to one polygon edge. */
function pointSegmentDistance(point: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const length2 = vx * vx + vy * vy;
  if (length2 === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1,
    ((point[0] - a[0]) * vx + (point[1] - a[1]) * vy) / length2,
  ));
  return Math.hypot(point[0] - (a[0] + vx * t), point[1] - (a[1] + vy * t));
}

/** Nearest wall edge bounds the usable central court. */
function distanceToPolygon(point: Pt, polygon: Pt[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i++) {
    nearest = Math.min(nearest, pointSegmentDistance(point, polygon[i], polygon[(i + 1) % polygon.length]));
  }
  return nearest;
}

/**
 * Social tier narrows the amenity vocabulary while the district seed chooses a
 * bounded variation. This mirrors the architecture rule: coherent local
 * language, but not every district or town receives the same center feature.
 */
function amenityFor(
  wealth: WardWealth,
  districtKey: string,
  courtKey: string,
  seedPath: SeedPath,
  previous?: CourtyardAmenity,
): CourtyardAmenity {
  const rng = rngFromPath(streamPath(seedPath, `courtyard-amenity:${districtKey}:${courtKey}`));
  const options: CourtyardAmenity[] = wealth === 'wealthy'
    ? ['garden', 'well']
    : wealth === 'poor'
      ? ['wash-yard', 'work-yard']
      : ['well', 'work-yard'];
  const preferred = options[rng.next() < (wealth === 'wealthy' ? 0.62 : wealth === 'poor' ? 0.58 : 0.52) ? 0 : 1];
  // Avoid a visually cloned run of courts while staying inside the district's
  // social vocabulary. Architecture remains district-coherent; public-space
  // use gains the bounded local distinction this goal calls for.
  return preferred === previous ? options.find((option) => option !== previous) ?? preferred : preferred;
}

// ---------------------------------------------------------------------------
// Public resolver
// ---------------------------------------------------------------------------

/**
 * Resolve one real shared court per surviving interior cluster. A single shed
 * is not called a courtyard, and a center swallowed by collision/filtering is
 * deliberately omitted.
 */
export function resolveCourtyardSpaces(
  wards: CourtyardWardInput[],
  seedPath: SeedPath,
): TownCourtyardSpace[] {
  const spaces: TownCourtyardSpace[] = [];
  wards.forEach((ward, wardIndex) => {
    const interior = ward.plots.filter((plot) => plot.kind === 'interior');
    if (interior.length < 2 || ward.block.length < 3) return;
    const byCourt = new Map<number, typeof interior>();
    for (const plot of interior) {
      const index = plot.courtyardIndex ?? 0;
      const group = byCourt.get(index) ?? [];
      group.push(plot);
      byCourt.set(index, group);
    }
    const courtCount = Math.max(...byCourt.keys()) + 1;
    const centers = courtyardCentersForBlock(ward.block, courtCount);
    const bounds = polygonBounds(ward.block);
    const span = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const wealth = ward.wealth ?? 'common';
    const districtKey = ward.architectureDistrict?.key ?? `wealth:${wealth}`;
    for (const [courtIndex, plots] of [...byCourt].sort(([a], [b]) => a - b)) {
      if (plots.length < 2) continue;
      const center = centers[courtIndex];
      if (!center || !pointInPolygon(center, ward.block)) continue;
      if (plots.some((plot) => pointInPolygon(center, plot.polygon))) continue;
      const nearestWall = Math.min(...plots.map((plot) => distanceToPolygon(center, plot.polygon)));
      const radius = Math.min(nearestWall * 0.82, span * (courtCount === 1 ? 0.22 : 0.14));
      if (!Number.isFinite(radius) || radius < span * 0.035) continue;

      const blockKey = plots[0].ensemble?.blockKey
        ?? (courtCount === 1
          ? `ward:${wardIndex}:courtyard`
          : `ward:${wardIndex}:courtyard:${courtIndex}`);
      const amenity = amenityFor(
        wealth,
        districtKey,
        blockKey,
        seedPath,
        spaces[spaces.length - 1]?.amenity,
      );
      spaces.push({
        id: courtCount === 1
          ? `ward:${wardIndex}:court`
          : `ward:${wardIndex}:court:${courtIndex}`,
        wardIndex,
        blockKey,
        center,
        radius,
        districtKey,
        wealth,
        amenity,
        courtyardSignature: `court-${fnv1a(
          `${districtKey}|${amenity}|${wardIndex}|${courtIndex}`,
        ).toString(36)}`,
      });
    }
  });
  return spaces;
}
