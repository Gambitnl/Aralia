/**
 * @file townRiverCourse.ts — the burg's river in the normalized town frame, at
 * TRUE scale.
 *
 * The old path fed the town generator `cellWaterPolylines`, which rides
 * `canonAffine` — the burg CELL's bounding box normalized to CANON_TOWN_SPAN.
 * A cell is tens of thousands of feet across and a town ~2,900 ft, so that
 * transform shrank every inherited feature by ~30x. Epicea's river genuinely
 * runs 4,045 ft from the burg, well outside a 2,936 ft town, and was drawn
 * 135 ft from town center with four bridges over it.
 *
 * This module instead generates the SAME course the region tier generates and
 * carves, then maps it into the normalized frame by the INVERSE of the town
 * placement. The town and the wilderness now draw one continuous river.
 *
 * IDENTITY IS THE WHOLE POINT. `generateRiverCourse` is pure, so the two tiers
 * agree only if they are handed identical inputs: the same full unclipped
 * anchor line, the same height sampler, the same target segment length, the
 * same width, and — the subtle one — the same attractor set. Every one of those
 * is built by a helper shared with `generateRegion.ts` (`riverAnchorsFt`,
 * `makeAtlasNaturalHeight`, `buildRiverAttractors`) rather than restated here,
 * because a restatement is exactly how the two tiers would drift back into
 * drawing two different rivers.
 */
import { clipPolylineToPolygon, type Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';
import { generateRiverCourse } from '../region/riverCourse';
import { riverWidthFt } from '../region/riverWidth';
import { makeAtlasNaturalHeight } from '../region/regionTerrainField';
import {
  buildRiverAttractors,
  riverAnchorsFt,
  type AttractorBurg,
  type RiverAttractor,
} from '../region/riverAttractors';
import { townSpanFtForPeople, POPULATION_RATE, CANON_TOWN_SPAN } from './townScale';
import { FEET_PER_FMG_PIXEL } from '../adapter/atlasArtifact';
import type { Feet } from '../units';

/** Minimal atlas surface this module reads (satisfied by FmgWorldResult). */
type TownAtlas = Pick<FmgWorldResult, 'pack'>;

/**
 * The region heightfield resolution the bridge generates every region at
 * (`legacySubmapBridge` passes `resolutionFt: 100`). It sets both the noise
 * wavelength and the course's point spacing, so the town must use the same
 * number or it routes over a different surface at a different resolution.
 */
const REGION_RESOLUTION_FT = 100;

/**
 * Cache the world-pure pieces per atlas. The height sampler holds every cell
 * center in the world and the attractor map scans every burg; both are pure
 * functions of the atlas, so rebuilding them per burg would be wasted work.
 */
interface AtlasRiverContext {
  naturalHeight: (x: Feet, y: Feet) => number;
  attractors: Map<number, RiverAttractor[]>;
  /**
   * Generated courses by river id. A course is a property of the RIVER, not of
   * whichever burg asked for it, so every burg on the same river shares one —
   * and `getCanonicalTownWaterFeatures` is not memoized, so without this the
   * course was regenerated on every call at ~170 ms a time.
   */
  courses: Map<number, Array<[Feet, Feet]>>;
}
const contextCache = new WeakMap<object, Map<number, AtlasRiverContext>>();

function contextFor(atlas: TownAtlas, worldSeed: number): AtlasRiverContext {
  let bySeed = contextCache.get(atlas as object);
  if (!bySeed) { bySeed = new Map(); contextCache.set(atlas as object, bySeed); }
  const hit = bySeed.get(worldSeed);
  if (hit) return hit;

  const pack = atlas.pack as unknown as {
    cells: { p: Array<[number, number]>; h: ArrayLike<number>; r?: ArrayLike<number> };
    burgs?: AttractorBurg[];
    rivers?: Array<{ i: number; cells: number[] }>;
  };
  const context: AtlasRiverContext = {
    naturalHeight: makeAtlasNaturalHeight(
      pack.cells.p,
      pack.cells.h,
      FEET_PER_FMG_PIXEL,
      worldSeed,
      REGION_RESOLUTION_FT,
    ),
    attractors: buildRiverAttractors(
      pack.burgs ?? [],
      pack.cells.p,
      pack.cells.r,
      pack.rivers ?? [],
      FEET_PER_FMG_PIXEL,
    ),
    courses: new Map(),
  };
  bySeed.set(worldSeed, context);
  return context;
}

/**
 * The burg's river in the normalized town frame (origin at town center,
 * CANON_TOWN_SPAN across), clipped to the town square. Empty when the burg's
 * cell carries no river — a dry town gets no river rather than an invented one.
 */
export interface TownRiverCourse {
  /** River polylines in the normalized town frame, clipped to the town square. */
  lines: Pt[][];
  /**
   * The river's OWN width in normalized town units.
   *
   * This exists because everything downstream used to size the river against the
   * TOWN instead: the 2D ribbon was `span * 0.06` and the bridge deck was
   * `span * 0.11`, so a brook and a great river drew identically and every bridge
   * was a fixed 11% of the town regardless of what it crossed. Carrying the real
   * width lets the ribbon and the deck both follow the river.
   */
  widthCanon: number;
}

const EMPTY_COURSE: TownRiverCourse = { lines: [], widthCanon: 0 };

export function townRiverCourseCanon(
  atlas: TownAtlas,
  worldSeed: number,
  burgId: number,
): TownRiverCourse {
  const pack = atlas.pack as unknown as {
    cells: { p: Array<[number, number]>; r?: ArrayLike<number> };
    burgs?: Array<{ i?: number; x: number; y: number; cell: number; removed?: boolean; population?: number }>;
    rivers?: Array<{ i: number; cells: number[]; discharge: number }>;
  };
  const burg = pack.burgs?.[burgId];
  if (!burg || burg.removed) return EMPTY_COURSE;
  const riverId = pack.cells.r?.[burg.cell];
  if (!riverId) return EMPTY_COURSE;

  const river = (pack.rivers ?? []).find((r) => r.i === Number(riverId));
  if (!river) return EMPTY_COURSE;

  const anchors = riverAnchorsFt(river.cells, pack.cells.p, FEET_PER_FMG_PIXEL);
  if (anchors.length < 2) return EMPTY_COURSE;

  const context = contextFor(atlas, worldSeed);

  // Identical inputs to the region tier's `generateRiverBanks` call, so the two
  // tiers produce the identical course and the town river IS the world river.
  // Shared with the region tier via riverWidthFt, so the town
  // ribbon and the wilderness ribbon are the same river at the same width.
  const widthFt = riverWidthFt(river.discharge);
  let course = context.courses.get(Number(riverId));
  if (!course) {
    course = generateRiverCourse(anchors, {
      sampleHeight: context.naturalHeight,
      attractors: context.attractors.get(Number(riverId)) ?? [],
      targetSegmentFt: REGION_RESOLUTION_FT * 2,
      widthFt,
    });
    context.courses.set(Number(riverId), course);
  }

  // Inverse of the town placement: world feet -> normalized town frame. The
  // region pass centers a burg's envelope on exactly this point (generateRegion
  // `generateCivData`), so undoing the placement here lands the course where the
  // 3D bake will put the town.
  const spanFt = townSpanFtForPeople((burg.population ?? 0) * POPULATION_RATE);
  const cxFt = burg.x * FEET_PER_FMG_PIXEL;
  const cyFt = burg.y * FEET_PER_FMG_PIXEL;
  const k = CANON_TOWN_SPAN / spanFt;
  const canon: Pt[] = course.map(([x, y]) => [(x - cxFt) * k, (y - cyFt) * k]);

  // Clip to the town square so a river that only grazes the town does not drag
  // the generator's dock/bridge search across empty ground.
  const half = CANON_TOWN_SPAN / 2;
  const square: Pt[] = [[-half, -half], [half, -half], [half, half], [-half, half]];
  return {
    lines: clipPolylineToPolygon(canon, square).filter((seg) => seg.length >= 2),
    widthCanon: widthFt * k,
  };
}
