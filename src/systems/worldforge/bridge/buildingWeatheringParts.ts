// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 21:20:28
 * Dependents: systems/worldforge/bridge/interiorParts.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file projects a building's weathering receipt onto its real outer walls.
 *
 * It adds shallow wall bands, streaks, and roof-edge traces that make age and
 * local exposure visible in 3D. These boxes are presentation-only, carry their
 * own semantic tag, and deliberately leave the canonical walls, openings, roof
 * mesh, collision, and permanent-history evidence untouched.
 *
 * Called by: interiorParts.ts
 * Depends on: resolved blueprint weathering and canonical outer-wall runs
 */

import type {
  BlueprintPlan,
  RoofPatina,
  WallPatina,
  WallRun,
} from '../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../interior/blueprintTypes';
import { fnv1a } from '../seedPath';
import { isVisibleExteriorRun } from './buildingPartyWalls';

// ============================================================================
// Public Render Contract
// ============================================================================
// The broad SitePart interface lives in interiorParts. Keeping a small local
// shape avoids a runtime cycle while retaining semantic renderer inspection.
// ============================================================================

export const WEATHERING_PART_TAG = 'building-weathering';

export type WeatheringDetailKind =
  | 'wall-patina-band'
  | 'wall-weather-streak'
  | 'roof-patina-edge';

export interface BuildingWeatheringPart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  baseY: number;
  colorHex: string;
  tag: typeof WEATHERING_PART_TAG;
  weatheringDetailKind: WeatheringDetailKind;
}

const FT = 0.3048;
const DETAIL_DEPTH_FT = 0.16;

const WALL_PATINA_COLOR: Readonly<Record<Exclude<WallPatina, 'none'>, string>> = {
  'rain-streaks': '#59615b',
  'salt-bloom': '#c8c9bb',
  lichen: '#68754d',
  'dust-veil': '#a8875e',
  'soot-wash': '#45433f',
};

const ROOF_PATINA_COLOR: Readonly<Record<Exclude<RoofPatina, 'none'>, string>> = {
  moss: '#556b3e',
  'salt-fade': '#aaa999',
  'sun-bleach': '#b28f64',
  'lichen-speckle': '#737b59',
  'soot-darkening': '#3f3b39',
};

// ============================================================================
// Geometry Helpers
// ============================================================================
// Every mark is located along a solved outer run. Hash labels select runs and
// positions independently so adding one detail later cannot reshuffle others.
// ============================================================================

function hashFraction(value: string): number {
  return fnv1a(value) / 0x1_0000_0000;
}

function runSpan(run: WallRun): [number, number] {
  return run.axis === 'x'
    ? [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)]
    : [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)];
}

/** Place one shallow mark just outside an actual exterior wall run. */
function partOnRun(
  blueprint: BlueprintPlan,
  run: WallRun,
  kind: WeatheringDetailKind,
  alongCenterFt: number,
  alongLengthFt: number,
  baseYFt: number,
  heightFt: number,
  colorHex: string,
): BuildingWeatheringPart {
  const origin = blueprintSiteOrigin(blueprint);
  const common = {
    h: heightFt * FT,
    baseY: baseYFt * FT,
    colorHex,
    tag: WEATHERING_PART_TAG,
    weatheringDetailKind: kind,
  } as const;

  if (run.axis === 'x') {
    return {
      ...common,
      x: (alongCenterFt - origin.x) * FT,
      z: (run.y1 - origin.y + run.ny * DETAIL_DEPTH_FT) * FT,
      w: alongLengthFt * FT,
      d: DETAIL_DEPTH_FT * FT,
    };
  }

  return {
    ...common,
    x: (run.x1 - origin.x + run.nx * DETAIL_DEPTH_FT) * FT,
    z: (alongCenterFt - origin.y) * FT,
    w: DETAIL_DEPTH_FT * FT,
    d: alongLengthFt * FT,
  };
}

// ============================================================================
// Public Projection
// ============================================================================
// New buildings and legacy blueprints are strict no-ops. Older buildings gain
// a bounded number of marks, preventing detail count from growing with area.
// ============================================================================

export function buildBuildingWeatheringParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
): BuildingWeatheringPart[] {
  const weathering = blueprint.styleResolved?.weathering;
  if (!weathering || weathering.intensity === 0
    || weathering.wallPatina === 'none' || weathering.roofPatina === 'none') {
    return [];
  }

  const ground = blueprint.floors.find((floor) => floor.level === 0);
  const runs = ground?.wallRuns.filter((run) =>
    isVisibleExteriorRun(blueprint, run)) ?? [];
  if (runs.length === 0) return [];

  const parts: BuildingWeatheringPart[] = [];
  const storeyHeightFt = storeyHeightM / FT;
  const markCount = Math.min(runs.length, weathering.intensity + 1);
  const firstRunIndex = Math.floor(hashFraction(
    `${weathering.weatheringVariant}|wall:start`,
  ) * runs.length);

  // Each selected wall receives a low patina band plus, on older buildings, a
  // narrow vertical streak. Both remain below normal window sills.
  for (let index = 0; index < markCount; index++) {
    // Walking around the outer-run list from a hashed start guarantees distinct
    // walls within one building while still varying the first exposed face.
    const run = runs[(firstRunIndex + index) % runs.length];
    const [lo, hi] = runSpan(run);
    const runLength = hi - lo;
    const lengthScale = 0.2 + weathering.coverage * 0.45;
    const lengthFt = Math.max(0.8, Math.min(runLength, runLength * lengthScale));
    const available = Math.max(0, runLength - lengthFt);
    const centerFt = lo + lengthFt / 2 + available * hashFraction(
      `${weathering.weatheringVariant}|position:${index}`,
    );

    parts.push(partOnRun(
      blueprint,
      run,
      'wall-patina-band',
      centerFt,
      lengthFt,
      0.05,
      0.35 + weathering.intensity * 0.18,
      WALL_PATINA_COLOR[weathering.wallPatina],
    ));

    if (weathering.intensity >= 2) {
      const streakWidthFt = Math.min(lengthFt, 0.25 + weathering.intensity * 0.12);
      parts.push(partOnRun(
        blueprint,
        run,
        'wall-weather-streak',
        centerFt,
        streakWidthFt,
        0.45,
        Math.min(2.1, 0.7 + weathering.intensity * 0.42),
        WALL_PATINA_COLOR[weathering.wallPatina],
      ));
    }
  }

  // A short trace at the wall top makes the roof's exposure legible from town
  // scale. True slope-following overlays remain a separate roof-surface task.
  const roofRun = runs[Math.floor(hashFraction(
    `${weathering.weatheringVariant}|roof-edge`,
  ) * runs.length)];
  const [roofLo, roofHi] = runSpan(roofRun);
  const roofLength = roofHi - roofLo;
  const roofTraceLength = Math.max(1, Math.min(roofLength, roofLength * weathering.coverage));
  const aboveGradeStoreys = Math.max(
    1,
    blueprint.floors.filter((floor) => floor.level >= 0).length,
  );
  parts.push(partOnRun(
    blueprint,
    roofRun,
    'roof-patina-edge',
    (roofLo + roofHi) / 2,
    roofTraceLength,
    Math.max(0.1, aboveGradeStoreys * storeyHeightFt - 0.22),
    0.18,
    ROOF_PATINA_COLOR[weathering.roofPatina],
  ));

  return parts;
}
