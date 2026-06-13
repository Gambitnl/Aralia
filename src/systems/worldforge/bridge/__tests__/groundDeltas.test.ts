/**
 * @file groundDeltas.test.ts - tests the bridge view that gives ground mode a
 * delta-replayed town plan.
 *
 * These tests keep the setup small on purpose: the heavy pipeline tests already
 * prove generated town plans and world-store deltas can round-trip. This file
 * checks the narrower handoff that ground mode needs, using the same persisted
 * WorldDelta envelope as the full pipeline.
 *
 * Called by: Vitest worldforge bridge checks.
 * Depends on: localWithDeltas, WorldDelta version constants, generateInterior.
 */
import { describe, expect, it } from 'vitest';
import type { LocalArtifact, TownPlan } from '../../artifacts';
import {
  WORLD_DELTA_OPERATION_VERSION,
  WORLD_DELTA_SCHEMA_VERSION,
  type WorldDelta,
  type WorldDeltaOperation,
} from '../../delta/types';
import { generateInterior } from '../../interior/generateInterior';
import { rootSeedPath } from '../../seedPath';
import { localWithDeltas } from '../groundDeltas';

// ============================================================================
// Fixed Test Fixtures
// ============================================================================
// The fixture is a tiny LocalArtifact with a hand-authored town plan. It avoids
// the full FMG pipeline while still using real artifact and delta types.
// ============================================================================

const LOCAL_SEED_PATH = rootSeedPath(42);

function makeLocalArtifact(): LocalArtifact {
  // The local terrain is deliberately tiny because town-plan replay does not
  // inspect terrain cells. Keeping it valid prevents unrelated generator cost.
  return {
    layer: 'local',
    schemaVersion: 1,
    seedPath: LOCAL_SEED_PATH,
    bounds: { x: 1_000, y: 2_000, width: 500, height: 500 },
    terrain: {
      widthCells: 2,
      heightCells: 2,
      elevationFt: new Float32Array([0, 1, 2, 3]),
      materialIndex: new Uint8Array([0, 0, 0, 0]),
      materials: ['grass'],
    },
    features: [
      { id: 10, kind: 'tree', x: 1_050, y: 2_050 },
    ],
  };
}

function makeTownPlan(): TownPlan {
  // Two rectangular plots are enough to prove role edits, removal, and
  // add-building upserts without depending on a generated town seed.
  return {
    burgId: 7,
    streets: [
      {
        id: 1,
        centerline: [
          [1_000, 2_025],
          [1_220, 2_025],
        ],
        widthFt: 16,
      },
    ],
    plots: [
      {
        id: 1,
        footprint: [
          [1_020, 2_040],
          [1_080, 2_040],
          [1_080, 2_090],
          [1_020, 2_090],
        ],
        role: 'house',
        storeys: 1,
      },
      {
        id: 2,
        footprint: [
          [1_100, 2_040],
          [1_160, 2_040],
          [1_160, 2_090],
          [1_100, 2_090],
        ],
        role: 'house',
        storeys: 1,
      },
    ],
  };
}

function makeDelta(
  id: string,
  entityKey: string,
  sequence: number,
  operation: WorldDeltaOperation,
): WorldDelta {
  // Match the persisted delta envelope used by the integration pipeline so the
  // bridge tests exercise the same replay filter and version gates.
  return {
    id,
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: LOCAL_SEED_PATH,
    entityKey,
    sequence,
    operation,
  };
}

function snapshotLocal(local: LocalArtifact): unknown {
  // Typed arrays compare cleanly in Vitest, but converting them to normal arrays
  // makes the mutation snapshot easy for future agents to read in failures.
  return {
    ...local,
    terrain: {
      ...local.terrain,
      elevationFt: Array.from(local.terrain.elevationFt),
      materialIndex: Array.from(local.terrain.materialIndex),
    },
  };
}

// ============================================================================
// Delta-Replayed LocalArtifact View
// ============================================================================
// The assertions use aggregate snapshots rather than per-element expectations,
// matching the repo's style for data-heavy Worldforge checks.
// ============================================================================

describe('localWithDeltas', () => {
  it('makes modify-plot role changes visible in the returned town plan', () => {
    const local = makeLocalArtifact();
    const plan = makeTownPlan();

    const replayed = localWithDeltas(local, plan, [
      makeDelta('modify-role', 'plot:1', 1, {
        kind: 'modify-plot',
        plotId: 1,
        role: 'market',
        storeys: 2,
      }),
    ]);

    const changedPlot = replayed.townPlan?.plots.find((plot) => plot.id === 1);

    expect({
      sameArtifactReference: replayed === local,
      burgId: replayed.townPlan?.burgId,
      changedRole: changedPlot?.role,
      changedStoreys: changedPlot?.storeys,
    }).toEqual({
      sameArtifactReference: false,
      burgId: 7,
      changedRole: 'market',
      changedStoreys: 2,
    });
  });

  it('removes plots and materializes added buildings as interior-ready plots', () => {
    const local = makeLocalArtifact();
    const plan = makeTownPlan();
    const addedPlotId = 99;

    const replayed = localWithDeltas(local, plan, [
      makeDelta('remove-plot', 'plot:2', 1, {
        kind: 'remove-plot',
        plotId: 2,
      }),
      makeDelta('add-building', `plot:${addedPlotId}`, 2, {
        kind: 'add-building',
        plotId: addedPlotId,
        buildingId: 500,
        role: 'market',
        storeys: 2,
        footprint: [
          [1_190, 2_040],
          [1_250, 2_040],
          [1_250, 2_090],
          [1_190, 2_090],
        ],
        featureData: { sign: 'fresh-market' },
      }),
    ]);

    const removedPlot = replayed.townPlan?.plots.find((plot) => plot.id === 2);
    const addedPlot = replayed.townPlan?.plots.find(
      (plot) => plot.id === addedPlotId,
    );
    const addedInterior = addedPlot
      ? generateInterior(addedPlot, replayed.seedPath)
      : undefined;

    expect({
      plotIds: replayed.townPlan?.plots.map((plot) => plot.id).sort((a, b) => a - b),
      removedPlotPresent: Boolean(removedPlot),
      addedRole: addedPlot?.role,
      addedStoreys: addedPlot?.storeys,
      addedRoomCount: addedInterior?.rooms.length,
      buildingFeatureData: replayed.features.find((feature) => feature.id === 500)?.data,
    }).toEqual({
      plotIds: [1, 99],
      removedPlotPresent: false,
      addedRole: 'market',
      addedStoreys: 2,
      addedRoomCount: 8,
      buildingFeatureData: {
        plotId: 99,
        role: 'market',
        storeys: 2,
        sign: 'fresh-market',
      },
    });
  });

  it('does not mutate the input local artifact', () => {
    const local = makeLocalArtifact();
    const before = snapshotLocal(local);

    localWithDeltas(local, makeTownPlan(), [
      makeDelta('modify-role', 'plot:1', 1, {
        kind: 'modify-plot',
        plotId: 1,
        role: 'market',
      }),
    ]);

    expect(snapshotLocal(local)).toEqual(before);
  });

  it('is deterministic for the same local artifact, plan, and deltas', () => {
    const local = makeLocalArtifact();
    const plan = makeTownPlan();
    const deltas = [
      makeDelta('modify-role', 'plot:1', 1, {
        kind: 'modify-plot',
        plotId: 1,
        role: 'market',
        storeys: 2,
      }),
      makeDelta('remove-plot', 'plot:2', 1, {
        kind: 'remove-plot',
        plotId: 2,
      }),
    ];

    expect(localWithDeltas(local, plan, deltas)).toEqual(
      localWithDeltas(local, plan, deltas),
    );
  });
});
