// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 21:20:42
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
 * This file turns permanent backstory and live building events into visible
 * 3D parts.
 *
 * The blueprint already records exact wall-run, roof-plane, ridge, and mass
 * targets. This bridge only projects those facts into site-local meter boxes:
 * extension seams, sealed openings, wall repairs, scorch marks, boarded
 * windows, charred breach rims, and replacement roof strips. The shared roof
 * builder owns actual holes and ridge deformation; this module keeps the
 * remaining additive evidence tagged so tactical extraction can ignore it.
 * Roof dressing is projected onto each plane's SOLVED height field, so repair
 * courses and sag hollows ride the real pitch instead of one mean height
 * (agora-8783).
 *
 * Called by: interiorParts.ts
 * Depends on: BlueprintPlan history targets and the shared SitePart contract
 */

import type {
  BlueprintPlan,
  BuildingHistoryFeature,
  BuildingLiveHistoryFeature,
  RoofPlane,
  WallRun,
} from '../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../interior/blueprintTypes';
import type { SitePart } from './interiorParts';
import { isNonOwnerPartyWallRun } from './buildingPartyWalls';

// ============================================================================
// Public Classification
// ============================================================================
// Renderers and tactical consumers use this tag instead of inferring history
// from color or dimensions.
// ============================================================================

export const HISTORY_PART_TAG = 'building-history';

const FT = 0.3048;
const CELL_FT = 5;
const WALL_SURFACE_DEPTH_M = 0.07;
const HISTORY_SEAM_DEPTH_M = 0.1;

/** Add the semantic tag shared by every box emitted for one history feature. */
type AnyHistoryFeature = BuildingHistoryFeature | BuildingLiveHistoryFeature;

function taggedPart(
  feature: AnyHistoryFeature,
  part: Omit<SitePart, 'tag' | 'historyKind'>,
): SitePart {
  return {
    ...part,
    tag: HISTORY_PART_TAG,
    historyKind: feature.kind,
  };
}

// ============================================================================
// Wall-Run Projection
// ============================================================================
// These helpers mirror facade projection: plan x/y becomes centered site x/z,
// and the outward normal moves the dressing beyond the structural wall face.
// ============================================================================

function requireWallRun(
  blueprint: BlueprintPlan,
  feature: Extract<
    BuildingHistoryFeature,
    { kind: 'sealed-door' | 'patched-wall' | 'fire-scar' }
  >,
): WallRun {
  const floor = blueprint.floors.find((candidate) =>
    candidate.level === feature.floorLevel);
  const run = floor?.wallRuns[feature.wallRunIndex];
  if (!run || run.kind !== 'outer') {
    throw new Error(
      `buildBuildingHistoryParts: ${feature.kind} targets missing outer wall ` +
      `${feature.floorLevel}:${feature.wallRunIndex}`,
    );
  }
  return run;
}

function wallSurfacePart(
  blueprint: BlueprintPlan,
  feature: Extract<
    BuildingHistoryFeature,
    { kind: 'sealed-door' | 'patched-wall' | 'fire-scar' }
  >,
  run: WallRun,
  storeyHeightM: number,
  alongFt: number,
  widthFt: number,
  baseFt: number,
  heightFt: number,
  colorHex: string,
  depthM = WALL_SURFACE_DEPTH_M,
): SitePart {
  // BURIED-DRESSING FIX (town-look-slice1 follow-up, 2026-07-18): structural
  // wall boxes grow OUTWARD from the run line by the FULL thickness (runBox in
  // buildingModels.ts: center = line + n*thickness/2 — the line is the wall's
  // INNER face, not its centerline). The former half-thickness offset therefore
  // centered every sealed-door infill, wall patch, and char streak INSIDE the
  // wall slab: the history receipts existed but no pixel ever showed. Matching
  // materialPartOnRun (buildingMaterialParts.ts) and facadePartOnRun
  // (interiorParts.ts), the full-thickness offset lands each part's inner face
  // exactly on the wall's outer face, so deeper trim (sealed-door jambs and
  // lintel pass depthM + 0.025) still reads proud of the flush infill panel.
  // Offset only: sizes, colors, tags, feature targets, and the frozen
  // historySignature receipts are unchanged.
  const outwardFt = run.thicknessFt + depthM / FT / 2;
  const baseY = feature.floorLevel * storeyHeightM + baseFt * FT;
  const common = {
    h: heightFt * FT,
    baseY,
    colorHex,
  };

  if (run.axis === 'x') {
    return taggedPart(feature, {
      ...common,
      x: (alongFt - blueprint.widthFt / 2) * FT,
      z: (run.y1 + run.ny * outwardFt - blueprint.depthFt / 2) * FT,
      w: widthFt * FT,
      d: depthM,
    });
  }

  return taggedPart(feature, {
    ...common,
    x: (run.x1 + run.nx * outwardFt - blueprint.widthFt / 2) * FT,
    z: (alongFt - blueprint.depthFt / 2) * FT,
    w: depthM,
    d: widthFt * FT,
  });
}

function sealedDoorParts(
  blueprint: BlueprintPlan,
  feature: Extract<BuildingHistoryFeature, { kind: 'sealed-door' }>,
  run: WallRun,
  storeyHeightM: number,
): SitePart[] {
  const trimColor = blueprint.styleResolved?.trimColor ?? feature.colorHex;
  const borderFt = 0.28;
  const parts = [
    wallSurfacePart(
      blueprint,
      feature,
      run,
      storeyHeightM,
      feature.alongFt,
      feature.widthFt,
      feature.baseFt,
      feature.heightFt,
      feature.colorHex,
    ),
  ];

  // The lintel and jambs make this read as a former doorway with masonry infill
  // rather than an arbitrary rectangular wall patch.
  for (const side of [-1, 1] as const) {
    parts.push(wallSurfacePart(
      blueprint,
      feature,
      run,
      storeyHeightM,
      feature.alongFt + side * (feature.widthFt / 2 + borderFt / 2),
      borderFt,
      feature.baseFt,
      feature.heightFt + borderFt,
      trimColor,
      WALL_SURFACE_DEPTH_M + 0.025,
    ));
  }
  parts.push(wallSurfacePart(
    blueprint,
    feature,
    run,
    storeyHeightM,
    feature.alongFt,
    feature.widthFt + borderFt * 2,
    feature.baseFt + feature.heightFt,
    borderFt,
    trimColor,
    WALL_SURFACE_DEPTH_M + 0.025,
  ));
  return parts;
}

function patchedWallParts(
  blueprint: BlueprintPlan,
  feature: Extract<BuildingHistoryFeature, { kind: 'patched-wall' }>,
  run: WallRun,
  storeyHeightM: number,
): SitePart[] {
  const parts = [wallSurfacePart(
    blueprint,
    feature,
    run,
    storeyHeightM,
    feature.alongFt,
    feature.widthFt,
    feature.baseFt,
    feature.heightFt,
    feature.colorHex,
  )];

  // Two narrow seams expose the repaired boundary at town-camera distance.
  const seamColor = blueprint.styleResolved?.trimColor ?? feature.colorHex;
  for (const side of [-1, 1] as const) {
    parts.push(wallSurfacePart(
      blueprint,
      feature,
      run,
      storeyHeightM,
      feature.alongFt + side * feature.widthFt / 2,
      0.12,
      feature.baseFt,
      feature.heightFt,
      seamColor,
      WALL_SURFACE_DEPTH_M + 0.018,
    ));
  }
  return parts;
}

function fireScarParts(
  blueprint: BlueprintPlan,
  feature: Extract<BuildingHistoryFeature, { kind: 'fire-scar' }>,
  run: WallRun,
  storeyHeightM: number,
): SitePart[] {
  // Uneven narrow char streaks read as rising flame damage while leaving most
  // of the district wall material visible around them.
  return [-0.32, 0, 0.34].map((offset, index) => wallSurfacePart(
    blueprint,
    feature,
    run,
    storeyHeightM,
    feature.alongFt + feature.widthFt * offset,
    Math.max(0.18, feature.widthFt * (index === 1 ? 0.18 : 0.12)),
    feature.baseFt,
    feature.heightFt * (index === 1 ? 1 : index === 0 ? 0.72 : 0.84),
    feature.colorHex,
    WALL_SURFACE_DEPTH_M + 0.012,
  ));
}

// ============================================================================
// Footprint-Mass And Roof Evidence
// ============================================================================
// Later additions mark their actual mass boundary. Roof features use the exact
// plane or ridge selected in the backstory and sit just above the solved roof.
// ============================================================================

function constructionPhaseParts(
  blueprint: BlueprintPlan,
  feature: Extract<AnyHistoryFeature, { kind: 'later-phase' | 'extension-phase' }>,
): SitePart[] {
  const mass = blueprint.masses[feature.massIndex];
  if (!mass) {
    throw new Error(
      `buildBuildingHistoryParts: later phase targets missing mass ${feature.massIndex}`,
    );
  }

  const x0 = mass.x * CELL_FT;
  const y0 = mass.y * CELL_FT;
  const widthFt = mass.w * CELL_FT;
  const depthFt = mass.h * CELL_FT;
  const xCenterM = (x0 + widthFt / 2 - blueprint.widthFt / 2) * FT;
  const zCenterM = (y0 + depthFt / 2 - blueprint.depthFt / 2) * FT;
  const bandHeightM = (0.45 + feature.phase * 0.08) * FT;

  return [
    taggedPart(feature, {
      x: xCenterM,
      z: (y0 - blueprint.depthFt / 2) * FT,
      w: widthFt * FT,
      d: HISTORY_SEAM_DEPTH_M,
      h: bandHeightM,
      colorHex: feature.colorHex,
    }),
    taggedPart(feature, {
      x: xCenterM,
      z: (y0 + depthFt - blueprint.depthFt / 2) * FT,
      w: widthFt * FT,
      d: HISTORY_SEAM_DEPTH_M,
      h: bandHeightM,
      colorHex: feature.colorHex,
    }),
    taggedPart(feature, {
      x: (x0 - blueprint.widthFt / 2) * FT,
      z: zCenterM,
      w: HISTORY_SEAM_DEPTH_M,
      d: depthFt * FT,
      h: bandHeightM,
      colorHex: feature.colorHex,
    }),
    taggedPart(feature, {
      x: (x0 + widthFt - blueprint.widthFt / 2) * FT,
      z: zCenterM,
      w: HISTORY_SEAM_DEPTH_M,
      d: depthFt * FT,
      h: bandHeightM,
      colorHex: feature.colorHex,
    }),
  ];
}

// ============================================================================
// Sloped-Plane Projection (agora-8783)
// ============================================================================
// A SitePart is an axis-aligned box: roof dressing cannot tilt. Before this,
// every re-roofing strip sat at the plane's MEAN rise and every sag cap sat on
// the ridge line, so on a steep gable one repair patch floated clear of the
// tiles along its low edge and sank into them along its high edge, and a
// sagging ridge dipped only at the ridge while the roof skin beside it stayed
// rigid. These helpers solve each plane's real height field and STEP the
// dressing down it: short courses laid across the fall line, each seated on
// the surface beneath its own downhill edge and tall enough to reach the
// surface at its uphill edge, the way laid tile laps.
//
// Scope: the canonical roof mesh, roof forms, and roof variety are untouched
// (keep-roof ruling agora-8a7f.21). This is additive dressing only.
// ============================================================================

/**
 * One roof plane's height field, centered on its own plan centroid:
 * z(x, y) = gradX * (x - cxFt) + gradY * (y - cyFt) + meanRiseFt, in feet
 * above wall-top.
 */
interface RoofSlope {
  gradX: number;
  gradY: number;
  cxFt: number;
  cyFt: number;
  meanRiseFt: number;
}

/**
 * Least-squares fit of a plane's corner rises. Solver output is planar by
 * construction, so this fit is exact; centering on the centroid drops the
 * constant term out and leaves a 2x2 solve.
 *
 * Every plane the roof solver emits is seen face-on from above — even a hip
 * end triangle tilts, and vertical closures go in `skirts`, not `planes`
 * (probed across the sampled production buildings, 2026-09-20). A plane with
 * no plan area therefore means the solver is broken, so this throws rather
 * than flattening the dressing back onto a mean rise.
 */
function solveRoofSlope(plane: RoofPlane, planeIndex: number): RoofSlope {
  const count = plane.pts.length;
  const cxFt = plane.pts.reduce((sum, point) => sum + point[0], 0) / count;
  const cyFt = plane.pts.reduce((sum, point) => sum + point[1], 0) / count;
  const meanRiseFt = plane.pts.reduce((sum, point) => sum + point[2], 0) / count;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sxz = 0;
  let syz = 0;
  for (const [x, y, z] of plane.pts) {
    const px = x - cxFt;
    const py = y - cyFt;
    const pz = z - meanRiseFt;
    sxx += px * px;
    sxy += px * py;
    syy += py * py;
    sxz += px * pz;
    syz += py * pz;
  }
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) <= 1e-9 * Math.max(sxx * syy, 1)) {
    throw new Error(
      `buildBuildingHistoryParts: roof plane ${planeIndex} has no plan area, `
      + 'so it carries no height field to seat roof dressing on',
    );
  }
  return {
    gradX: (sxz * syy - syz * sxy) / det,
    gradY: (syz * sxx - sxz * sxy) / det,
    cxFt,
    cyFt,
    meanRiseFt,
  };
}

/** Rise of the solved plane, in feet above wall-top, at one plan point. */
function riseAt(slope: RoofSlope, xFt: number, yFt: number): number {
  return slope.gradX * (xFt - slope.cxFt)
    + slope.gradY * (yFt - slope.cyFt)
    + slope.meanRiseFt;
}

/** Meters of wall below the roof: every at-or-above-grade storey. */
function roofBaseM(blueprint: BlueprintPlan, storeyHeightM: number): number {
  return blueprint.floors.filter((floor) => floor.level >= 0).length * storeyHeightM;
}

/** Clear of the solved roof skin without floating off it. */
const ROOF_DRESSING_CLEARANCE_M = 0.025;
/** Laid thickness of one replacement tile course. */
const REPAIR_COURSE_THICKNESS_M = 0.08;
/** Plan gap between courses, in feet, so the lap line stays readable. */
const REPAIR_COURSE_GAP_FT = 0.05;
/**
 * Most rise one course may span before the patch is split again, in feet.
 * About one tile lap: below this the stepped courses read as a continuous
 * sloped patch at town-camera distance.
 */
const REPAIR_COURSE_RISE_FT = 0.35;
const REPAIR_MIN_COURSES = 3;
const REPAIR_MAX_COURSES = 9;

function reRoofedParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
  feature: Extract<BuildingHistoryFeature, { kind: 're-roofed' }>,
): SitePart[] {
  const plane = blueprint.roof?.planes[feature.planeIndex];
  if (!plane) {
    throw new Error(
      `buildBuildingHistoryParts: re-roofing targets missing plane ${feature.planeIndex}`,
    );
  }

  const slope = solveRoofSlope(plane, feature.planeIndex);
  const xs = plane.pts.map(([x]) => x);
  const ys = plane.pts.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const wallTopM = roofBaseM(blueprint, storeyHeightM);

  // Courses run ACROSS the fall line and stack UP it. The patch keeps its
  // former proportions (long across the fall, short down it), so only the
  // seating height moved, not how much roof one repair covers.
  const fallAlongX = Math.abs(slope.gradX) >= Math.abs(slope.gradY);
  const spanAcross = fallAlongX ? spanY : spanX;
  const spanDown = fallAlongX ? spanX : spanY;
  const courseLengthFt = Math.max(2.4, spanAcross * 0.48);
  const patchDownFt = Math.max(1.2, Math.min(2.8, spanDown * 0.38));
  const gradDown = fallAlongX ? slope.gradX : slope.gradY;

  // Enough courses that no single one spans more than one tile lap of rise.
  const courses = Math.min(
    REPAIR_MAX_COURSES,
    Math.max(
      REPAIR_MIN_COURSES,
      Math.ceil(Math.abs(gradDown) * patchDownFt / REPAIR_COURSE_RISE_FT),
    ),
  );
  const stepFt = patchDownFt / courses;
  // Moving this way along the fall axis loses height. Each course is seated
  // on the solved surface under its own downhill edge.
  const downhillSign = gradDown > 0 ? -1 : 1;
  const courseRiseM = Math.abs(gradDown) * stepFt * FT;

  return Array.from({ length: courses }, (_unused, index) => {
    const offsetFt = (index - (courses - 1) / 2) * stepFt;
    const lowEdgeFt = offsetFt + downhillSign * stepFt / 2;
    const sampleX = fallAlongX ? centerX + lowEdgeFt : centerX;
    const sampleY = fallAlongX ? centerY : centerY + lowEdgeFt;
    return taggedPart(feature, {
      x: (centerX + (fallAlongX ? offsetFt : 0) - blueprint.widthFt / 2) * FT,
      z: (centerY + (fallAlongX ? 0 : offsetFt) - blueprint.depthFt / 2) * FT,
      w: (fallAlongX ? stepFt - REPAIR_COURSE_GAP_FT : courseLengthFt) * FT,
      d: (fallAlongX ? courseLengthFt : stepFt - REPAIR_COURSE_GAP_FT) * FT,
      // Tall enough to meet the skin again at the uphill edge, so stepped
      // courses stay continuous instead of leaving a sliver of bare roof.
      h: REPAIR_COURSE_THICKNESS_M + courseRiseM,
      baseY: wallTopM + riseAt(slope, sampleX, sampleY) * FT
        + ROOF_DRESSING_CLEARANCE_M,
      colorHex: feature.colorHex,
    });
  });
}

/** Samples a sag is cut into along the ridge. */
const SAG_RIDGE_SEGMENTS = 5;
/** Courses each ridge sample drops down the planes beside it. */
const SAG_PLANE_STEPS = 3;
/** Fraction of a plane's fall run the dip reaches before the skin is flat. */
const SAG_PLANE_REACH = 0.55;
const SAG_CAP_THICKNESS_M = 0.12;
const SAG_SKIRT_THICKNESS_M = 0.1;
const SAG_MIN_BOX_M = 0.18;
const RIDGE_TOUCH_FT = 1e-3;

/**
 * Deflected-beam profile along a ridge: zero at both bearing ends, full at
 * mid-span. A rafter run sags as one continuous curve, so the former
 * full/quarter/full step pattern read as three separate dropped blocks.
 */
function ridgeSagProfile(t: number): number {
  return Math.sin(Math.PI * t);
}

type RoofRidge = NonNullable<BlueprintPlan['roof']>['ridges'][number];

/** Planes whose skin this ridge carries: two of their corners sit on it. */
function planesOnRidge(
  blueprint: BlueprintPlan,
  ridge: RoofRidge,
): Array<{ plane: RoofPlane; index: number }> {
  const dx = ridge.x2 - ridge.x1;
  const dy = ridge.y2 - ridge.y1;
  const lengthSq = dx * dx + dy * dy;
  const onRidge = (point: readonly [number, number, number]): boolean => {
    if (Math.abs(point[2] - ridge.zFt) > RIDGE_TOUCH_FT) return false;
    if (lengthSq <= 0) {
      return Math.abs(point[0] - ridge.x1) <= RIDGE_TOUCH_FT
        && Math.abs(point[1] - ridge.y1) <= RIDGE_TOUCH_FT;
    }
    const t = ((point[0] - ridge.x1) * dx + (point[1] - ridge.y1) * dy) / lengthSq;
    if (t < -RIDGE_TOUCH_FT || t > 1 + RIDGE_TOUCH_FT) return false;
    const perpX = point[0] - (ridge.x1 + dx * t);
    const perpY = point[1] - (ridge.y1 + dy * t);
    return Math.hypot(perpX, perpY) <= RIDGE_TOUCH_FT;
  };
  return (blueprint.roof?.planes ?? [])
    .map((plane, index) => ({ plane, index }))
    .filter(({ plane }) => plane.pts.filter(onRidge).length >= 2);
}

function saggingRidgeParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
  feature: Extract<AnyHistoryFeature, { kind: 'sagging-ridge' | 'ruin-sag' }>,
): SitePart[] {
  const ridge = blueprint.roof?.ridges[feature.ridgeIndex];
  if (!ridge) {
    throw new Error(
      `buildBuildingHistoryParts: sag targets missing ridge ${feature.ridgeIndex}`,
    );
  }

  const wallTopM = roofBaseM(blueprint, storeyHeightM);
  const dx = ridge.x2 - ridge.x1;
  const dy = ridge.y2 - ridge.y1;
  const ridgeLengthFt = Math.hypot(dx, dy);
  const segmentFt = ridgeLengthFt / SAG_RIDGE_SEGMENTS;
  const ridgeUx = ridgeLengthFt > 0 ? dx / ridgeLengthFt : 1;
  const ridgeUy = ridgeLengthFt > 0 ? dy / ridgeLengthFt : 0;
  const samples = Array.from({ length: SAG_RIDGE_SEGMENTS }, (_unused, index) => {
    const t = (index + 0.5) / SAG_RIDGE_SEGMENTS;
    return { t, xFt: ridge.x1 + dx * t, yFt: ridge.y1 + dy * t };
  });

  // The ridge cap itself: one continuous dipped curve along the bearing run.
  const parts: SitePart[] = samples.map((sample) => taggedPart(feature, {
    x: (sample.xFt - blueprint.widthFt / 2) * FT,
    z: (sample.yFt - blueprint.depthFt / 2) * FT,
    w: Math.max(SAG_MIN_BOX_M, Math.abs(ridgeUx) * segmentFt * FT),
    d: Math.max(SAG_MIN_BOX_M, Math.abs(ridgeUy) * segmentFt * FT),
    h: SAG_CAP_THICKNESS_M,
    baseY: wallTopM
      + (ridge.zFt - feature.deflectionFt * ridgeSagProfile(sample.t)) * FT,
    colorHex: feature.colorHex,
  }));

  // The skin this ridge carries dips WITH it. Every plane on the ridge takes
  // a short run of sunken courses that follow its own fall line downhill and
  // fade back to the solved surface before the eave, so the sag reads as a
  // soft hollow in the roof instead of a dropped stick over a rigid plane.
  for (const { plane, index } of planesOnRidge(blueprint, ridge)) {
    const slope = solveRoofSlope(plane, index);
    const gradLength = Math.hypot(slope.gradX, slope.gradY);
    if (gradLength <= 0) continue; // a flat plane has no fall line to walk
    const downX = -slope.gradX / gradLength;
    const downY = -slope.gradY / gradLength;
    const reachFt = Math.max(...plane.pts.map(([x, y]) =>
      (x - ridge.x1) * downX + (y - ridge.y1) * downY));
    if (reachFt <= 0) continue; // this ridge bounds the plane's DOWNHILL edge
    const dipRunFt = reachFt * SAG_PLANE_REACH;
    const stepFt = dipRunFt / SAG_PLANE_STEPS;

    for (const sample of samples) {
      const sagFt = feature.deflectionFt * ridgeSagProfile(sample.t);
      for (let step = 0; step < SAG_PLANE_STEPS; step += 1) {
        const distFt = stepFt * (step + 0.5);
        // Cosine taper: full dip at the ridge, flat where the dip run ends.
        const taper = 0.5 * (1 + Math.cos(Math.PI * (distFt / dipRunFt)));
        const xFt = sample.xFt + downX * distFt;
        const yFt = sample.yFt + downY * distFt;
        parts.push(taggedPart(feature, {
          x: (xFt - blueprint.widthFt / 2) * FT,
          z: (yFt - blueprint.depthFt / 2) * FT,
          w: Math.max(
            SAG_MIN_BOX_M,
            (Math.abs(ridgeUx) * segmentFt + Math.abs(downX) * stepFt) * FT,
          ),
          d: Math.max(
            SAG_MIN_BOX_M,
            (Math.abs(ridgeUy) * segmentFt + Math.abs(downY) * stepFt) * FT,
          ),
          h: SAG_SKIRT_THICKNESS_M,
          baseY: wallTopM + (riseAt(slope, xFt, yFt) - sagFt * taper) * FT,
          colorHex: feature.colorHex,
        }));
      }
    }
  }

  return parts;
}

// ============================================================================
// Replayed Live Condition
// ============================================================================
// Event-derived features use the same semantic tag as permanent history so
// tactical extraction ignores all cosmetic evidence. Targets are already
// resolved by applyHistory; this bridge performs no random placement.
// ============================================================================

function scorchedRoomParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
  feature: Extract<BuildingLiveHistoryFeature, { kind: 'scorched-room' }>,
): SitePart[] {
  const floor = blueprint.floors.find((candidate) =>
    candidate.level === feature.floorLevel);
  const room = floor?.rooms.find((candidate) => candidate.id === feature.roomId);
  if (!room) {
    throw new Error(
      `buildBuildingHistoryParts: scorch targets missing room ` +
      `${feature.floorLevel}:${feature.roomId}`,
    );
  }
  const insetM = 0.08;
  return room.cells.map((cell) => taggedPart(feature, {
    x: (cell.cx * CELL_FT + CELL_FT / 2 - blueprint.widthFt / 2) * FT,
    z: (cell.cy * CELL_FT + CELL_FT / 2 - blueprint.depthFt / 2) * FT,
    w: CELL_FT * FT - insetM,
    d: CELL_FT * FT - insetM,
    h: 0.025 + feature.intensity * 0.012,
    baseY: feature.floorLevel * storeyHeightM + 0.018,
    colorHex: feature.intensity >= 3 ? '#1f1714' : '#3a2922',
  }));
}

function windowRun(
  blueprint: BlueprintPlan,
  feature: Extract<BuildingLiveHistoryFeature, { kind: 'boarded-window' }>,
): { floor: BlueprintPlan['floors'][number]; run: WallRun } {
  const floor = blueprint.floors.find((candidate) =>
    candidate.level === feature.floorLevel);
  const window = floor?.windows[feature.windowIndex];
  if (!floor || !window) {
    throw new Error(
      `buildBuildingHistoryParts: boards target missing window ` +
      `${feature.floorLevel}:${feature.windowIndex}`,
    );
  }
  const run = floor.wallRuns.find((candidate) => {
    if (candidate.kind !== 'outer' || candidate.axis !== window.axis) return false;
    const fixed = candidate.axis === 'x' ? candidate.y1 : candidate.x1;
    const windowFixed = window.axis === 'x' ? window.y : window.x;
    const along = window.axis === 'x' ? window.x : window.y;
    const [lo, hi] = candidate.axis === 'x'
      ? [Math.min(candidate.x1, candidate.x2), Math.max(candidate.x1, candidate.x2)]
      : [Math.min(candidate.y1, candidate.y2), Math.max(candidate.y1, candidate.y2)];
    return Math.abs(fixed - windowFixed) < 1e-6 && along >= lo && along <= hi;
  });
  if (!run) {
    throw new Error(
      `buildBuildingHistoryParts: boards cannot resolve outer wall for ` +
      `${feature.floorLevel}:${feature.windowIndex}`,
    );
  }
  return { floor, run };
}

function boardedWindowParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
  feature: Extract<BuildingLiveHistoryFeature, { kind: 'boarded-window' }>,
): SitePart[] {
  const { floor, run } = windowRun(blueprint, feature);
  const window = floor.windows[feature.windowIndex];
  const depthM = 0.09;
  // BURIED-DRESSING FIX (town-look-slice1 follow-up, 2026-07-18): same
  // full-thickness outward offset as wallSurfacePart above — the run line is
  // the wall's INNER face, so the former half-thickness offset nailed every
  // abandonment board inside the structural slab. The stored boarded-window
  // targets and board sizes are unchanged; only the projection moved.
  const outwardFt = run.thicknessFt + depthM / FT / 2;
  const boardColor = blueprint.styleResolved?.trimColor ?? '#674a31';

  return [0, 1, 2].map((index) => {
    const common = {
      h: 0.16,
      baseY: feature.floorLevel * storeyHeightM + 0.92 + index * 0.38,
      colorHex: boardColor,
    };
    if (window.axis === 'x') {
      return taggedPart(feature, {
        ...common,
        x: (window.x - blueprint.widthFt / 2) * FT,
        z: (window.y + run.ny * outwardFt - blueprint.depthFt / 2) * FT,
        w: 1.08,
        d: depthM,
      });
    }
    return taggedPart(feature, {
      ...common,
      x: (window.x + run.nx * outwardFt - blueprint.widthFt / 2) * FT,
      z: (window.y - blueprint.depthFt / 2) * FT,
      w: depthM,
      d: 1.08,
    });
  });
}

function roofHoleParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
  feature: Extract<BuildingLiveHistoryFeature, { kind: 'roof-hole' }>,
): SitePart[] {
  const plane = blueprint.roof?.planes[feature.planeIndex];
  if (!plane) {
    throw new Error(
      `buildBuildingHistoryParts: roof hole targets missing plane ${feature.planeIndex}`,
    );
  }
  const wallTopM = roofBaseM(blueprint, storeyHeightM);
  const slope = solveRoofSlope(plane, feature.planeIndex);

  // The canonical roof mesh owns the actual opening. These four charred rim
  // bars retain semantic history metadata and make the damaged edge readable.
  // Each bar is seated at the rise of ITS OWN side of the hole (agora-8783):
  // on a pitched plane the uphill and downhill rims sit at different heights,
  // so the former single mean-rise seat buried one bar and floated another.
  const diameterM = feature.radiusFt * FT * 2;
  const centerX = (feature.x - blueprint.widthFt / 2) * FT;
  const centerZ = (feature.y - blueprint.depthFt / 2) * FT;
  const parts: SitePart[] = [];
  for (const axis of ['x', 'z'] as const) {
    for (const side of [-1, 1] as const) {
      const barXFt = feature.x + (axis === 'x' ? side * feature.radiusFt : 0);
      const barYFt = feature.y + (axis === 'z' ? side * feature.radiusFt : 0);
      parts.push(taggedPart(feature, {
        x: centerX + (axis === 'x' ? side * diameterM / 2 : 0),
        z: centerZ + (axis === 'z' ? side * diameterM / 2 : 0),
        w: axis === 'x' ? 0.09 : diameterM + 0.09,
        d: axis === 'z' ? 0.09 : diameterM + 0.09,
        h: 0.07,
        baseY: wallTopM + riseAt(slope, barXFt, barYFt) * FT - 0.015,
        colorHex: '#2b1d18',
      }));
    }
  }
  return parts;
}

// ============================================================================
// Public Projection
// ============================================================================
// Feature order follows the stored blueprint. This keeps output byte-stable and
// makes a history signature easy to compare with its exact rendered evidence.
// ============================================================================

export function buildBuildingHistoryParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
): SitePart[] {
  const permanentFeatures = (blueprint.backstory?.features ?? []).filter((feature) =>
    !blueprint.liveHistory?.renovatedBackstory || feature.kind === 'later-phase');
  const parts: SitePart[] = [];

  for (const feature of permanentFeatures) {
    if (feature.kind === 'later-phase') {
      parts.push(...constructionPhaseParts(blueprint, feature));
      continue;
    }
    if (feature.kind === 're-roofed') {
      parts.push(...reRoofedParts(blueprint, storeyHeightM, feature));
      continue;
    }
    if (feature.kind === 'sagging-ridge') {
      parts.push(...saggingRidgeParts(blueprint, storeyHeightM, feature));
      continue;
    }

    const run = requireWallRun(blueprint, feature);
    // The stored history fact remains part of this building's chronology, but
    // a neighbor-owned party wall is not an exterior surface this renderer may
    // decorate. The owning building can still carry its own visible history.
    if (isNonOwnerPartyWallRun(blueprint, run)) continue;
    if (feature.kind === 'sealed-door') {
      parts.push(...sealedDoorParts(blueprint, feature, run, storeyHeightM));
    } else if (feature.kind === 'patched-wall') {
      parts.push(...patchedWallParts(blueprint, feature, run, storeyHeightM));
    } else {
      parts.push(...fireScarParts(blueprint, feature, run, storeyHeightM));
    }
  }

  for (const feature of blueprint.liveHistory?.features ?? []) {
    if (feature.kind === 'scorched-room') {
      parts.push(...scorchedRoomParts(blueprint, storeyHeightM, feature));
    } else if (feature.kind === 'roof-hole') {
      parts.push(...roofHoleParts(blueprint, storeyHeightM, feature));
    } else if (feature.kind === 'boarded-window') {
      parts.push(...boardedWindowParts(blueprint, storeyHeightM, feature));
    } else if (feature.kind === 'extension-phase') {
      parts.push(...constructionPhaseParts(blueprint, feature));
    } else {
      parts.push(...saggingRidgeParts(blueprint, storeyHeightM, feature));
    }
  }

  // History projectors use the long-standing envelope-centered frame. Shift
  // their finished evidence together so scars and construction seams remain
  // attached after a one-sided extension changes that envelope's midpoint.
  const origin = blueprintSiteOrigin(blueprint);
  const offsetX = (blueprint.widthFt / 2 - origin.x) * FT;
  const offsetZ = (blueprint.depthFt / 2 - origin.y) * FT;
  return parts.map((part) => ({
    ...part,
    x: part.x + offsetX,
    z: part.z + offsetZ,
  }));
}
