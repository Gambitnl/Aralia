/**
 * These tests pin wall-mounted history evidence to the structural wall's OUTER
 * face (town-look-slice1 follow-up, 2026-07-18).
 *
 * Structural wall boxes grow OUTWARD from the run line by the FULL thickness
 * (runBox in buildingModels.ts — the run line is the wall's INNER face), so a
 * projector that treats the line as a centerline buries its evidence inside
 * the slab: history receipts without pixels. Features injected onto a sampled
 * production wall run prove every sealed doorway, wall patch, fire scar, and
 * abandonment board seats its inner face exactly on the wall's outer face —
 * outside the slab, still attached to the building.
 */

import { describe, expect, it } from 'vitest';
import type {
  BlueprintPlan,
  BuildingType,
  RoofPlane,
  StyleContext,
  WallRun,
} from '../../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../../interior/blueprintTypes';
import { generateBuilding } from '../../interior/generateBuilding';
import { rootSeedPath } from '../../seedPath';
import type { SitePart } from '../interiorParts';
import {
  buildBuildingHistoryParts,
  HISTORY_PART_TAG,
} from '../buildingHistoryParts';

const FT = 0.3048;

// ============================================================================
// Production Fixture
// ============================================================================
// The sample mirrors the weathering suite: full production generation, then a
// deterministic injected feature so exactly one known run carries evidence.
// ============================================================================

function styledBuilding(seed: number): BlueprintPlan {
  const types: BuildingType[] = ['cottage', 'shop', 'smithy', 'inn', 'manor', 'temple'];
  const style: StyleContext = {
    cultureType: 'Generic',
    climate: 'temperate',
    wealth: 'common',
    ageBand: 'ancient',
    architecture: {
      settlementKey: 'burg:31',
      districtKey: 'district:harbor',
      buildingKey: `plot:${seed}`,
    },
  };
  return generateBuilding({
    buildingId: seed + 1,
    type: types[seed % types.length],
    seedPath: rootSeedPath(6200 + seed),
    storeys: 1 + (seed % 3),
    style,
  });
}

/** First seed whose ground floor stores a long outer run (and a window). */
function sampledBuilding(): {
  blueprint: BlueprintPlan;
  runIndex: number;
  run: WallRun;
} {
  for (let seed = 0; seed < 24; seed++) {
    // generateBuilding memoizes plans; clone before the tests mutate history.
    const blueprint = structuredClone(styledBuilding(seed));
    const ground = blueprint.floors.find((floor) => floor.level === 0)!;
    if (ground.windows.length === 0) continue;
    const runIndex = ground.wallRuns.findIndex((run) => {
      const lengthFt = run.axis === 'x'
        ? Math.abs(run.x2 - run.x1)
        : Math.abs(run.y2 - run.y1);
      return run.kind === 'outer' && lengthFt >= 10;
    });
    if (runIndex < 0) continue;
    // Injected features must be the ONLY history so every emitted part maps to
    // the sampled run without guessing feature-to-part ownership.
    delete blueprint.backstory;
    delete blueprint.liveHistory;
    return { blueprint, runIndex, run: ground.wallRuns[runIndex] };
  }
  throw new Error('no sampled production building with a long outer run + window');
}

/** Signed distance (m, along the outward normal) from the run's OUTER wall
 *  face to the part's inner face. Zero = flush on the face; negative = buried
 *  inside the slab; positive = floating off the wall. */
function outwardSeatM(
  blueprint: BlueprintPlan,
  run: WallRun,
  part: SitePart,
): number {
  const origin = blueprintSiteOrigin(blueprint);
  const alongX = run.axis === 'x';
  const n = alongX ? run.ny : run.nx;
  const line = alongX ? run.y1 : run.x1;
  const wallOuterM = (line - (alongX ? origin.y : origin.x)
    + n * run.thicknessFt) * FT;
  const planeM = alongX ? part.z : part.x;
  const innerFaceM = planeM - n * ((alongX ? part.d : part.w) / 2);
  return n * (innerFaceM - wallOuterM);
}

// ============================================================================
// Burial Regression
// ============================================================================

describe('buildBuildingHistoryParts wall evidence', () => {
  it.each([
    ['sealed-door', 4],
    ['patched-wall', 3],
    ['fire-scar', 3],
  ] as const)('%s parts seat on the outer wall face, outside the slab', (
    kind,
    expectedParts,
  ) => {
    const { blueprint, runIndex, run } = sampledBuilding();
    const [lo, hi] = run.axis === 'x'
      ? [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)]
      : [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)];
    blueprint.backstory = {
      ageBand: 'ancient',
      phases: blueprint.masses.map(() => 0),
      wear: [kind],
      historySignature: 'burial-regression-proof',
      features: [{
        kind,
        floorLevel: 0,
        wallRunIndex: runIndex,
        alongFt: (lo + hi) / 2,
        widthFt: 3,
        baseFt: 0.4,
        heightFt: 6,
        colorHex: '#7c6f5d',
      }],
    };

    const parts = buildBuildingHistoryParts(blueprint, 3);
    // Panel + seams/jambs/lintel counts are part of the deterministic contract.
    expect(parts).toHaveLength(expectedParts);
    for (const part of parts) {
      expect(part.tag).toBe(HISTORY_PART_TAG);
      expect(part.historyKind).toBe(kind);
      const seat = outwardSeatM(blueprint, run, part);
      // Outside the slab (inner face at or beyond the wall's outer face) AND
      // flush against it — true for every depth the feature emits, because the
      // projector offsets each box by full thickness + half its own depth.
      expect(seat).toBeGreaterThanOrEqual(-1e-6);
      expect(Math.abs(seat)).toBeLessThanOrEqual(1e-6);
    }
  });

  it('abandonment boards seat on the outer wall face of the window run', () => {
    const { blueprint } = sampledBuilding();
    const ground = blueprint.floors.find((floor) => floor.level === 0)!;
    const window = ground.windows[0];
    blueprint.liveHistory = {
      lastDay: 40,
      eventsApplied: 1,
      status: 'abandoned',
      renovatedBackstory: false,
      features: [{ kind: 'boarded-window', floorLevel: 0, windowIndex: 0 }],
      historySignature: 'burial-regression-proof-live',
    };

    // Resolve the outer run the stored window sits on — the same rule the
    // projector uses, restated here so the test owns its own oracle.
    const run = ground.wallRuns.find((candidate) => {
      if (candidate.kind !== 'outer' || candidate.axis !== window.axis) return false;
      const fixed = candidate.axis === 'x' ? candidate.y1 : candidate.x1;
      const windowFixed = window.axis === 'x' ? window.y : window.x;
      const along = window.axis === 'x' ? window.x : window.y;
      const [lo, hi] = candidate.axis === 'x'
        ? [Math.min(candidate.x1, candidate.x2), Math.max(candidate.x1, candidate.x2)]
        : [Math.min(candidate.y1, candidate.y2), Math.max(candidate.y1, candidate.y2)];
      return Math.abs(fixed - windowFixed) < 1e-6 && along >= lo && along <= hi;
    });
    expect(run).toBeDefined();

    const parts = buildBuildingHistoryParts(blueprint, 3);
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part.tag).toBe(HISTORY_PART_TAG);
      expect(part.historyKind).toBe('boarded-window');
      const seat = outwardSeatM(blueprint, run!, part);
      expect(seat).toBeGreaterThanOrEqual(-1e-6);
      expect(Math.abs(seat)).toBeLessThanOrEqual(1e-6);
    }
  });

  // ==========================================================================
  // Sloped-Plane Seating (agora-8783)
  // ==========================================================================
  // Roof dressing used to sit at ONE height — the plane's mean rise, or the
  // ridge line — so a repair patch floated at its low edge and sank at its
  // high edge, and a sag dipped the ridge while the skin beside it stayed
  // rigid. These pin the dressing to each plane's solved height field.
  // ==========================================================================

  /** The corner triple that spreads widest in plan. Wing valleys clip roof
   *  planes into 5- and 6-gons whose FIRST three corners are often collinear
   *  in plan, so a fixed triple is not a usable normal. */
  function widestTriple(plane: RoofPlane): {
    a: readonly number[];
    b: readonly number[];
    c: readonly number[];
    cross: number;
  } {
    let best = { a: plane.pts[0], b: plane.pts[1], c: plane.pts[2], cross: 0 };
    for (let i = 0; i < plane.pts.length; i++) {
      for (let j = i + 1; j < plane.pts.length; j++) {
        for (let k = j + 1; k < plane.pts.length; k++) {
          const [a, b, c] = [plane.pts[i], plane.pts[j], plane.pts[k]];
          const cross = Math.abs(
            (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
          if (cross > best.cross) best = { a, b, c, cross };
        }
      }
    }
    return best;
  }

  /** True when a plane is seen face-on from above and can carry dressing. */
  function hasPlanArea(plane: RoofPlane): boolean {
    return widestTriple(plane).cross > 1e-6;
  }

  /** z (ft above wall-top) of a solved plane at one plan point, fitted here
   *  independently of the projector so the test owns its own oracle. */
  function planeRiseAt(plane: RoofPlane, xFt: number, yFt: number): number {
    const { a, b, c, cross } = widestTriple(plane);
    expect(cross).toBeGreaterThan(1e-6);
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    return a[2] - (nx * (xFt - a[0]) + ny * (yFt - a[1])) / nz;
  }

  /** The first sampled building whose solved roof carries a pitched plane. */
  function pitchedRoofBuilding(): {
    blueprint: BlueprintPlan;
    planeIndex: number;
    plane: RoofPlane;
  } {
    for (let seed = 0; seed < 24; seed++) {
      const blueprint = structuredClone(styledBuilding(seed));
      const planes = blueprint.roof?.planes ?? [];
      const planeIndex = planes.findIndex((plane) => {
        const zs = plane.pts.map(([, , z]) => z);
        return hasPlanArea(plane) && Math.max(...zs) - Math.min(...zs) > 1;
      });
      if (planeIndex < 0) continue;
      delete blueprint.backstory;
      delete blueprint.liveHistory;
      return { blueprint, planeIndex, plane: planes[planeIndex] };
    }
    throw new Error('no sampled production building with a pitched roof plane');
  }

  function withReRoofed(
    blueprint: BlueprintPlan,
    planeIndex: number,
  ): BlueprintPlan {
    blueprint.backstory = {
      ageBand: 'ancient',
      phases: blueprint.masses.map(() => 0),
      wear: ['re-roofed'],
      historySignature: 'slope-projection-proof',
      features: [{ kind: 're-roofed', planeIndex, colorHex: '#6b6257' }],
    };
    return blueprint;
  }

  it('re-roofing courses ride the plane slope instead of one mean height', () => {
    const { blueprint, planeIndex, plane } = pitchedRoofBuilding();
    withReRoofed(blueprint, planeIndex);
    const origin = blueprintSiteOrigin(blueprint);
    const storeyHeightM = 3;
    const wallTopM = blueprint.floors.filter((floor) => floor.level >= 0).length
      * storeyHeightM;

    const parts = buildBuildingHistoryParts(blueprint, storeyHeightM);
    expect(parts.length).toBeGreaterThanOrEqual(3);

    const bases: number[] = [];
    for (const part of parts) {
      expect(part.tag).toBe(HISTORY_PART_TAG);
      expect(part.historyKind).toBe('re-roofed');
      // Undo the envelope-centering shift to get back to plan feet.
      const xFt = part.x / FT + origin.x;
      const yFt = part.z / FT + origin.y;
      const surfaceM = wallTopM + planeRiseAt(plane, xFt, yFt) * FT;
      const baseY = part.baseY!;
      bases.push(baseY);
      // Each course straddles the solved skin beneath its own footprint:
      // seated at or just under it, and tall enough to reach back up to it.
      expect(baseY).toBeLessThanOrEqual(surfaceM + 0.12);
      expect(baseY + part.h).toBeGreaterThanOrEqual(surfaceM);
    }
    // The whole point: the courses are NOT all at one height.
    expect(Math.max(...bases) - Math.min(...bases)).toBeGreaterThan(0.05);
  });

  it('re-roofing keeps its plan footprint on the targeted plane', () => {
    const { blueprint, planeIndex, plane } = pitchedRoofBuilding();
    withReRoofed(blueprint, planeIndex);
    const origin = blueprintSiteOrigin(blueprint);
    const xs = plane.pts.map(([x]) => x);
    const ys = plane.pts.map(([, y]) => y);

    for (const part of buildBuildingHistoryParts(blueprint, 3)) {
      const xFt = part.x / FT + origin.x;
      const yFt = part.z / FT + origin.y;
      expect(xFt).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-6);
      expect(xFt).toBeLessThanOrEqual(Math.max(...xs) + 1e-6);
      expect(yFt).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6);
      expect(yFt).toBeLessThanOrEqual(Math.max(...ys) + 1e-6);
    }
  });

  it('a ridge sag dips the planes it carries, deepest at mid-span', () => {
    const { blueprint } = pitchedRoofBuilding();
    const ridges = blueprint.roof?.ridges ?? [];
    expect(ridges.length).toBeGreaterThan(0);
    const deflectionFt = 0.9;
    blueprint.backstory = {
      ageBand: 'ancient',
      phases: blueprint.masses.map(() => 0),
      wear: ['sagging-ridge'],
      historySignature: 'slope-projection-proof',
      features: [{
        kind: 'sagging-ridge', ridgeIndex: 0, deflectionFt, colorHex: '#5a5148',
      }],
    };
    const ridge = ridges[0];
    const origin = blueprintSiteOrigin(blueprint);
    const storeyHeightM = 3;
    const wallTopM = blueprint.floors.filter((floor) => floor.level >= 0).length
      * storeyHeightM;
    const ridgeTopM = wallTopM + ridge.zFt * FT;

    const parts = buildBuildingHistoryParts(blueprint, storeyHeightM);
    // Five ridge caps, plus a dip skirt on each plane the ridge carries.
    expect(parts.length).toBeGreaterThan(5);
    for (const part of parts) expect(part.historyKind).toBe('sagging-ridge');

    // Caps: every one at or below the solved ridge, and the deepest sits
    // near mid-span, not at an end — a deflected beam, not three blocks.
    const caps = parts.filter((part) =>
      Math.abs(part.x / FT + origin.x - (ridge.x1 + ridge.x2) / 2)
        < Math.abs(ridge.x2 - ridge.x1) / 2 + 1e-6
      && part.h === 0.12);
    expect(caps.length).toBe(5);
    for (const cap of caps) expect(cap.baseY!).toBeLessThanOrEqual(ridgeTopM + 1e-9);
    const deepest = caps.reduce((low, cap) => (cap.baseY! < low.baseY! ? cap : low));
    expect(ridgeTopM - deepest.baseY!).toBeGreaterThan(deflectionFt * FT * 0.9);
    expect(caps.indexOf(deepest)).toBe(2); // the middle of five samples

    // Skirts: the roof skin beside the ridge moved too.
    const skirts = parts.filter((part) => part.h === 0.1);
    expect(skirts.length).toBeGreaterThan(0);
  });

  it('a sag with zero deflection leaves the skin exactly on the solved roof', () => {
    const { blueprint } = pitchedRoofBuilding();
    blueprint.backstory = {
      ageBand: 'ancient',
      phases: blueprint.masses.map(() => 0),
      wear: ['sagging-ridge'],
      historySignature: 'slope-projection-proof',
      features: [{
        kind: 'sagging-ridge', ridgeIndex: 0, deflectionFt: 0, colorHex: '#5a5148',
      }],
    };
    const planes = blueprint.roof!.planes;
    const origin = blueprintSiteOrigin(blueprint);
    const storeyHeightM = 3;
    const wallTopM = blueprint.floors.filter((floor) => floor.level >= 0).length
      * storeyHeightM;

    for (const part of buildBuildingHistoryParts(blueprint, storeyHeightM)) {
      if (part.h !== 0.1) continue; // caps sit on the ridge, not on a plane
      const xFt = part.x / FT + origin.x;
      const yFt = part.z / FT + origin.y;
      // Undeflected, every skirt box must land on SOME solved plane's surface.
      const onSurface = planes.filter(hasPlanArea).some((plane) =>
        Math.abs(wallTopM + planeRiseAt(plane, xFt, yFt) * FT - part.baseY!) < 1e-6);
      expect(onSurface).toBe(true);
    }
  });

  it('every solved roof plane is dressable — none is edge-on from above', () => {
    // The projector needs a height field per plane and THROWS without one, so
    // the solver must never hand it a plane with no plan area. Vertical
    // closures belong to `skirts`, which this bridge never touches.
    let planesChecked = 0;
    for (let seed = 0; seed < 8; seed++) {
      for (const plane of structuredClone(styledBuilding(seed)).roof?.planes ?? []) {
        expect(hasPlanArea(plane)).toBe(true);
        planesChecked += 1;
      }
    }
    expect(planesChecked).toBeGreaterThan(100);
  });

  it('a plane with no plan area fails loudly rather than flattening', () => {
    const { blueprint, planeIndex } = pitchedRoofBuilding();
    withReRoofed(blueprint, planeIndex);
    // Collapse the target to a vertical sliver: every corner on one plan line.
    blueprint.roof!.planes[planeIndex] = {
      pts: [[10, 4, 0], [10, 4, 6], [10, 4, 3]],
    };
    expect(() => buildBuildingHistoryParts(blueprint, 3))
      .toThrow(/no plan area/);
  });

  it('projects identical evidence on replay (deterministic)', () => {
    const { blueprint, runIndex, run } = sampledBuilding();
    const [lo, hi] = run.axis === 'x'
      ? [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)]
      : [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)];
    blueprint.backstory = {
      ageBand: 'ancient',
      phases: blueprint.masses.map(() => 0),
      wear: ['patched-wall'],
      historySignature: 'burial-regression-proof',
      features: [{
        kind: 'patched-wall',
        floorLevel: 0,
        wallRunIndex: runIndex,
        alongFt: (lo + hi) / 2,
        widthFt: 3,
        baseFt: 0.4,
        heightFt: 6,
        colorHex: '#7c6f5d',
      }],
    };
    expect(buildBuildingHistoryParts(blueprint, 3))
      .toEqual(buildBuildingHistoryParts(blueprint, 3));
  });
});
