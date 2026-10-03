/**
 * @file gate.ts — the placement refinement loop as a SURFACE GATE.
 *
 * Three surfaces place objects on ground: the town surface, the region
 * surface, and the battle map. Each one calls `runPlacementGate` after it
 * scatters and before it renders. The gate returns the corrected objects, the
 * ground pads to bake, and the honest failure list.
 *
 * The gate NEVER drops a failing instance and never quietly nudges it. A
 * failure that survives the budget is returned to the caller, and
 * `throwOnFailure` makes it fatal for a surface that must not ship a floater.
 *
 * Units: FEET at this boundary. The prop engine and World3D hold meters, so
 * `fromMeterInstances` converts once, here.
 */
import { FEET_PER_METER, type SurfaceProbe } from '../terrain/surfaceProbe';
import type { PlacedObject, LocalBoundsFt } from './placedObject';
import { formatFailures, refinePlacements, type RefineReport } from './refineLoop';
import {
  BATTLEMAP_THRESHOLDS,
  REGION_THRESHOLDS,
  TOWN_THRESHOLDS,
  type PlacementThresholds,
  type SpeciesHeightRange,
} from './thresholds';

/** The surfaces that run the gate. Each carries its own thresholds. */
export type PlacementSurface = 'town' | 'region' | 'battlemap';

export const SURFACE_THRESHOLDS: Readonly<Record<PlacementSurface, PlacementThresholds>> =
  Object.freeze({
    town: TOWN_THRESHOLDS,
    region: REGION_THRESHOLDS,
    battlemap: BATTLEMAP_THRESHOLDS,
  });

export interface GateOptions {
  surface: PlacementSurface;
  /** Override the surface profile. Use for a one-off scene, not as a habit. */
  thresholds?: PlacementThresholds;
  heightRanges?: Readonly<Record<string, SpeciesHeightRange>>;
  /**
   * true = throw when any instance still fails at the budget. The battle map
   * sets this: a floating crate there is a referee bug, not a cosmetic one.
   */
  throwOnFailure?: boolean;
  /** Sink for the failure lines. Defaults to `console.warn`. */
  report?: (line: string) => void;
}

export interface GateResult {
  surface: PlacementSurface;
  objects: PlacedObject[];
  report: RefineReport;
  /** One line per unfixed instance. Empty = the scene is clean. */
  failureLines: string[];
}

/**
 * Run the loop as a gate on one surface.
 *
 * Returns the corrected objects in input order. Read `report.patches` to bake
 * the ground co-deformations into the terrain the surface renders.
 */
export function runPlacementGate(
  objects: readonly PlacedObject[],
  probe: SurfaceProbe,
  opts: GateOptions,
): GateResult {
  const thresholds = opts.thresholds ?? SURFACE_THRESHOLDS[opts.surface];
  const report = refinePlacements(objects, probe, {
    thresholds,
    heightRanges: opts.heightRanges,
  });
  const failureLines = formatFailures(report);

  if (failureLines.length > 0) {
    const emit = opts.report ?? ((line: string) => console.warn(`[placement/${opts.surface}] ${line}`));
    emit(
      `${failureLines.length} of ${report.outcomes.length} instances still fail after ${report.budget} iterations`,
    );
    for (const line of failureLines) emit(line);
    if (opts.throwOnFailure) {
      throw new Error(
        `[placement/${opts.surface}] ${failureLines.length} unfixable placements:\n${failureLines.join('\n')}`,
      );
    }
  }

  return {
    surface: opts.surface,
    objects: report.outcomes.map((o) => o.object),
    report,
    failureLines,
  };
}

// ── Adapters ────────────────────────────────────────────────────────────────

/**
 * The minimum a caller must supply per instance when its positions are in
 * METERS (props/placementEngine.ts `PropInstance`, World3D vegetation scatter).
 * Bounds stay in FEET, because a catalog authors sizes in feet.
 */
export interface MeterInstance {
  id: string;
  speciesKey: string;
  xM: number;
  /** Ground-relative origin height in meters. Absent = 0. */
  yM?: number;
  zM: number;
  rotationRad: number;
  scale: number;
  localBoundsFt: LocalBoundsFt;
  transformMutable?: boolean;
  groundMutable?: boolean;
  scaleMutable?: boolean;
}

/** Convert a meter-space scatter result into gate input. Converts ONCE. */
export function fromMeterInstances(instances: readonly MeterInstance[]): PlacedObject[] {
  return instances.map((i) => ({
    id: i.id,
    speciesKey: i.speciesKey,
    positionFt: {
      x: i.xM * FEET_PER_METER,
      y: (i.yM ?? 0) * FEET_PER_METER,
      z: i.zM * FEET_PER_METER,
    },
    rotationRad: i.rotationRad,
    scale: i.scale,
    localBounds: i.localBoundsFt,
    transformMutable: i.transformMutable,
    groundMutable: i.groundMutable,
    scaleMutable: i.scaleMutable,
  }));
}

/**
 * Height range table for prop size classes, keyed the way `speciesKey` expects.
 * A caller holding `PropDefinition.sizeClass` maps 'M' to 'prop-M'.
 */
export function propSpeciesKey(sizeClass: 'S' | 'M' | 'L'): string {
  return `prop-${sizeClass}`;
}
