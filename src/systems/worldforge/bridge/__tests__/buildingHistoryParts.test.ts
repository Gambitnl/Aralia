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
