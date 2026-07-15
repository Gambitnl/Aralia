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
 *
 * Called by: interiorParts.ts
 * Depends on: BlueprintPlan history targets and the shared SitePart contract
 */

import type {
  BlueprintPlan,
  BuildingHistoryFeature,
  BuildingLiveHistoryFeature,
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
  const outwardFt = run.thicknessFt / 2 + depthM / FT / 2;
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

  const xs = plane.pts.map(([x]) => x);
  const ys = plane.pts.map(([, y]) => y);
  const zs = plane.pts.map(([, , z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const wallTopM = blueprint.floors.filter((floor) => floor.level >= 0).length
    * storeyHeightM;
  const baseY = wallTopM + (zs.reduce((sum, z) => sum + z, 0) / zs.length) * FT;
  const longAlongX = spanX >= spanY;
  const patchLongFt = Math.max(2.4, (longAlongX ? spanX : spanY) * 0.48);
  const patchShortFt = Math.max(
    1.2,
    Math.min(2.8, (longAlongX ? spanY : spanX) * 0.38),
  );

  // Three tile strips make the repair read as a material patch rather than a
  // single floating slab. They remain shallow and sit only a few centimeters
  // over the solved roof surface.
  // DEBT: SitePart boxes cannot follow a sloped plane. A future roof-dressing
  // mesh should project these tiles onto the plane instead of its mean height.
  return [-1, 0, 1].map((section) => {
    const sectionLongFt = patchLongFt / 3 - 0.08;
    const offsetFt = section * patchLongFt / 3;
    return taggedPart(feature, {
      x: ((minX + maxX) / 2 - blueprint.widthFt / 2
        + (longAlongX ? offsetFt : 0)) * FT,
      z: ((minY + maxY) / 2 - blueprint.depthFt / 2
        + (longAlongX ? 0 : offsetFt)) * FT,
      w: (longAlongX ? sectionLongFt : patchShortFt) * FT,
      d: (longAlongX ? patchShortFt : sectionLongFt) * FT,
      h: 0.08,
      baseY: baseY + 0.025,
      colorHex: feature.colorHex,
    });
  });
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

  const wallTopM = blueprint.floors.filter((floor) => floor.level >= 0).length
    * storeyHeightM;
  const dx = ridge.x2 - ridge.x1;
  const dy = ridge.y2 - ridge.y1;

  // DEBT: The cap communicates a dipped ridge, but the canonical roof planes
  // remain rigid. True structural sag needs subdivided roof-plane geometry.
  return [0, 1, 2].map((section) => {
    const t0 = section / 3;
    const t1 = (section + 1) / 3;
    const centerT = (t0 + t1) / 2;
    const deflectionScale = section === 1 ? 1 : 0.28;
    const segmentXFt = Math.abs(dx) / 3;
    const segmentYFt = Math.abs(dy) / 3;
    return taggedPart(feature, {
      x: (ridge.x1 + dx * centerT - blueprint.widthFt / 2) * FT,
      z: (ridge.y1 + dy * centerT - blueprint.depthFt / 2) * FT,
      w: Math.max(0.18, segmentXFt * FT),
      d: Math.max(0.18, segmentYFt * FT),
      h: 0.12,
      baseY: wallTopM + (ridge.zFt - feature.deflectionFt * deflectionScale) * FT,
      colorHex: feature.colorHex,
    });
  });
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
  const outwardFt = run.thicknessFt / 2 + depthM / FT / 2;
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
  const wallTopM = blueprint.floors.filter((floor) => floor.level >= 0).length
    * storeyHeightM;
  const meanRiseFt = plane.pts.reduce((sum, point) => sum + point[2], 0)
    / plane.pts.length;

  // The canonical roof mesh owns the actual opening. These four charred rim
  // bars retain semantic history metadata and make the damaged edge readable.
  const diameterM = feature.radiusFt * FT * 2;
  const centerX = (feature.x - blueprint.widthFt / 2) * FT;
  const centerZ = (feature.y - blueprint.depthFt / 2) * FT;
  const baseY = wallTopM + meanRiseFt * FT - 0.035;
  const parts: SitePart[] = [];
  for (const axis of ['x', 'z'] as const) {
    for (const side of [-1, 1] as const) {
      parts.push(taggedPart(feature, {
        x: centerX + (axis === 'x' ? side * diameterM / 2 : 0),
        z: centerZ + (axis === 'z' ? side * diameterM / 2 : 0),
        w: axis === 'x' ? 0.09 : diameterM + 0.09,
        d: axis === 'z' ? 0.09 : diameterM + 0.09,
        h: 0.07,
        baseY: baseY + 0.02,
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
