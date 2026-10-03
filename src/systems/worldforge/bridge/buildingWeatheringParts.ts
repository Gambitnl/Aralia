// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 00:39:13
 * Dependents: systems/world3d/buildingSceneModel.ts, systems/worldforge/bridge/interiorParts.ts
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
  RoofPlane,
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
  | 'north-wall-grime'
  | 'roof-patina-edge'
  | 'roof-valley-grime'
  | 'roof-soot-patch'
  | 'roof-repair-patch';

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
const ROOF_MARK_HEIGHT_FT = 0.06;

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

/** Read a roof plane's height at one footprint point without changing the roof. */
function planeHeightAt(plane: RoofPlane, xFt: number, yFt: number): number {
  const points = plane.pts;
  if (points.length < 3) return points[0]?.[2] ?? 0;
  const [ax, ay, az] = points[0];

  // Roof faces are planar, but some contain four corners. Find any three
  // non-collinear corners so the same calculation works for triangles and quads.
  for (let second = 1; second < points.length; second++) {
    const [bx, by, bz] = points[second];
    for (let third = second + 1; third < points.length; third++) {
      const [cx, cy, cz] = points[third];
      const determinant = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(determinant) < 1e-9) continue;
      const dx = xFt - ax;
      const dy = yFt - ay;
      const alongB = (dx * (cy - ay) - dy * (cx - ax)) / determinant;
      const alongC = (dy * (bx - ax) - dx * (by - ay)) / determinant;
      return az + alongB * (bz - az) + alongC * (cz - az);
    }
  }

  return az;
}

/** Test whether one footprint point is covered by a solved roof face. */
function pointInRoofPlane(xFt: number, yFt: number, plane: RoofPlane): boolean {
  let inside = false;
  const points = plane.pts;
  for (let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index++) {
    const [x, y] = points[index];
    const [previousX, previousY] = points[previous];
    const crosses = (y > yFt) !== (previousY > yFt)
      && xFt < ((previousX - x) * (yFt - y)) / (previousY - y) + x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Find the highest solved roof surface at one footprint point. */
function roofHeightAt(blueprint: BlueprintPlan, xFt: number, yFt: number): number {
  let heightFt = 0;
  for (const plane of blueprint.roof?.planes ?? []) {
    if (pointInRoofPlane(xFt, yFt, plane)) {
      heightFt = Math.max(heightFt, planeHeightAt(plane, xFt, yFt));
    }
  }
  return heightFt;
}

/** Shift a generated roof color into related repair stock, never a random hue. */
function repairPatchColor(baseHex: string, variation: number): string {
  const normalized = baseHex.startsWith('#') ? baseHex.slice(1) : baseHex;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return baseHex;
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16));
  const toward = variation < 0.5 ? 44 : 214;
  const amount = 0.07 + Math.abs(variation - 0.5) * 0.05;
  return `#${channels.map((channel) =>
    Math.round(channel + (toward - channel) * amount)
      .toString(16).padStart(2, '0')).join('')}`;
}

/** Place one shallow horizontal mark directly on the solved roof surface. */
function roofSurfacePart(
  blueprint: BlueprintPlan,
  kind: WeatheringDetailKind,
  xFt: number,
  yFt: number,
  widthFt: number,
  depthFt: number,
  wallTopFt: number,
  colorHex: string,
): BuildingWeatheringPart {
  const origin = blueprintSiteOrigin(blueprint);
  return {
    x: (xFt - origin.x) * FT,
    z: (yFt - origin.y) * FT,
    w: widthFt * FT,
    d: depthFt * FT,
    h: ROOF_MARK_HEIGHT_FT * FT,
    // A tiny overlap keeps flat patch boxes seated on pitched faces rather
    // than floating above them at the camera's oblique inspection angle.
    baseY: (wallTopFt + roofHeightAt(blueprint, xFt, yFt) - 0.04) * FT,
    colorHex,
    tag: WEATHERING_PART_TAG,
    weatheringDetailKind: kind,
  };
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
  // BURIED-DRESSING FIX (town-look-slice1 follow-up, 2026-07-18): structural
  // wall boxes grow OUTWARD from the run line by the FULL thickness (runBox in
  // buildingModels.ts — the line is the wall's INNER face). The former fixed
  // 0.16 ft center offset therefore sank every patina band, weather streak,
  // and roof-edge trace deep inside a wall slab that is around 1.5 ft thick:
  // the weathering receipt resolved, but nothing ever rendered. Matching
  // materialPartOnRun (buildingMaterialParts.ts) and facadePartOnRun
  // (interiorParts.ts), full thickness plus half the mark's own depth lands
  // each mark's inner face exactly on the wall's outer face. Offset only: the
  // patina palettes stay muted material tones by design (no contrast-tone
  // derivation), and sizes, hash placement, and the weathering receipt are
  // unchanged.
  const outwardFt = run.thicknessFt + DETAIL_DEPTH_FT / 2;
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
      z: (run.y1 - origin.y + run.ny * outwardFt) * FT,
      w: alongLengthFt * FT,
      d: DETAIL_DEPTH_FT * FT,
    };
  }

  return {
    ...common,
    x: (run.x1 - origin.x + run.nx * outwardFt) * FT,
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
  const aboveGradeStoreys = Math.max(
    1,
    blueprint.floors.filter((floor) => floor.level >= 0).length,
  );
  const wallTopFt = aboveGradeStoreys * storeyHeightFt;
  const markCount = Math.min(runs.length, weathering.intensity + 1);
  const firstRunIndex = Math.floor(hashFraction(
    `${weathering.weatheringVariant}|wall:start`,
  ) * runs.length);
  const walkedRuns = Array.from({ length: markCount }, (_, index) =>
    runs[(firstRunIndex + index) % runs.length]);
  const northRun = runs.find((run) => run.ny < -0.5);

  // Damp north faces are the first crevice to weather. Keep the hashed walk for
  // every other mark, but guarantee a real visible north wall participates when
  // the canonical footprint provides one. Hidden party walls were filtered out.
  const selectedRuns = northRun
    ? [northRun, ...walkedRuns.filter((run) => run !== northRun)].slice(0, markCount)
    : walkedRuns;

  // Each selected wall receives a low patina band plus, on older buildings, a
  // narrow vertical streak. Both remain below normal window sills.
  for (let index = 0; index < selectedRuns.length; index++) {
    // Walking around the outer-run list from a hashed start guarantees distinct
    // walls within one building while still varying the first exposed face.
    const run = selectedRuns[index];
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

  // One extra shallow smear makes the north-face preference legible as grime,
  // rather than relying on the generic band name to carry that meaning.
  if (northRun) {
    const [northLo, northHi] = runSpan(northRun);
    const northLength = Math.min(
      northHi - northLo,
      0.8 + weathering.coverage * (northHi - northLo) * 0.45,
    );
    parts.push(partOnRun(
      blueprint,
      northRun,
      'north-wall-grime',
      northLo + northLength / 2,
      northLength,
      0.03,
      0.2 + weathering.intensity * 0.1,
      WALL_PATINA_COLOR[weathering.wallPatina],
    ));
  }

  // A short trace at the wall top makes the roof's exposure legible from town
  // scale. True slope-following overlays remain a separate roof-surface task.
  const roofRun = runs[Math.floor(hashFraction(
    `${weathering.weatheringVariant}|roof-edge`,
  ) * runs.length)];
  const [roofLo, roofHi] = runSpan(roofRun);
  const roofLength = roofHi - roofLo;
  const roofTraceLength = Math.max(1, Math.min(roofLength, roofLength * weathering.coverage));
  parts.push(partOnRun(
    blueprint,
    roofRun,
    'roof-patina-edge',
    (roofLo + roofHi) / 2,
    roofTraceLength,
    Math.max(0.1, wallTopFt - 0.22),
    0.18,
    ROOF_PATINA_COLOR[weathering.roofPatina],
  ));

  const roof = blueprint.roof;
  if (!roof) return parts;

  // Soot gathers beside one real chimney. Roofs without a chimney use their
  // highest ridge as the documented roof-top fallback, so age still remains
  // visible on structures that never received a hearth flue.
  const sootAnchor = roof.chimneys.length > 0
    ? roof.chimneys[Math.floor(hashFraction(
      `${weathering.weatheringVariant}|soot:chimney`,
    ) * roof.chimneys.length)]
    : [...roof.ridges].sort((left, right) => right.zFt - left.zFt)[0]
      ? (() => {
        const ridge = [...roof.ridges].sort((left, right) => right.zFt - left.zFt)[0];
        return { x: (ridge.x1 + ridge.x2) / 2, y: (ridge.y1 + ridge.y2) / 2 };
      })()
      : undefined;
  if (sootAnchor) {
    const sootCount = weathering.intensity;
    for (let mark = 0; mark < sootCount; mark++) {
      const angle = hashFraction(
        `${weathering.weatheringVariant}|soot:angle:${mark}`,
      ) * Math.PI * 2;
      const radiusFt = 0.85 + mark * 0.35;
      const xFt = sootAnchor.x + Math.cos(angle) * radiusFt;
      const yFt = sootAnchor.y + Math.sin(angle) * radiusFt;
      parts.push(roofSurfacePart(
        blueprint,
        'roof-soot-patch',
        xFt,
        yFt,
        0.65 + weathering.intensity * 0.12,
        0.65 + weathering.intensity * 0.12,
        wallTopFt,
        '#35312f',
      ));
    }
  }

  // Valley grime follows the real solved seam as a short chain of patches.
  // The chain count rises with age but remains independent of roof area.
  if (roof.valleys.length > 0) {
    const valley = roof.valleys[Math.floor(hashFraction(
      `${weathering.weatheringVariant}|valley:index`,
    ) * roof.valleys.length)];
    const valleyCount = weathering.intensity;
    for (let mark = 0; mark < valleyCount; mark++) {
      const along = (mark + 1) / (valleyCount + 1);
      const xFt = valley.x1 + (valley.x2 - valley.x1) * along;
      const yFt = valley.y1 + (valley.y2 - valley.y1) * along;
      parts.push(roofSurfacePart(
        blueprint,
        'roof-valley-grime',
        xFt,
        yFt,
        0.55 + weathering.intensity * 0.14,
        0.55 + weathering.intensity * 0.14,
        wallTopFt,
        ROOF_PATINA_COLOR[weathering.roofPatina],
      ));
    }
  }

  // Old roofs occasionally show one or two mismatched repairs. The solved face
  // and stable variant choose their location and related stock color; no shared
  // generator draw is consumed and the patch count never scales with roof area.
  if (weathering.intensity >= 2 && roof.planes.length > 0) {
    const patchCount = weathering.intensity - 1;
    for (let patch = 0; patch < patchCount; patch++) {
      const plane = roof.planes[Math.floor(hashFraction(
        `${weathering.weatheringVariant}|repair:plane:${patch}`,
      ) * roof.planes.length)];
      const center = plane.pts.reduce(
        (sum, point) => ({ x: sum.x + point[0], y: sum.y + point[1] }),
        { x: 0, y: 0 },
      );
      const xFt = center.x / plane.pts.length;
      const yFt = center.y / plane.pts.length;
      const variation = hashFraction(
        `${weathering.weatheringVariant}|repair:stock:${patch}`,
      );
      parts.push(roofSurfacePart(
        blueprint,
        'roof-repair-patch',
        xFt,
        yFt,
        0.65 + variation * 0.35,
        0.5 + (1 - variation) * 0.25,
        wallTopFt,
        repairPatchColor(blueprint.styleResolved!.roofColor, variation),
      ));
    }
  }

  return parts;
}
