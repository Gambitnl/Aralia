/**
 * @file worldDelta.test.ts - regression tests for Worldforge delta-layer contracts.
 *
 * These tests pin the persistence behavior for decision #14: the generated
 * artifact is the deterministic base, and these deltas are the saved changes
 * layered over it. L2 generation is not landed yet, so the fixture below is a
 * small hand-built LocalArtifact that exercises the same `LocalFeature.id`
 * contract future generated local maps will use.
 */
import { describe, expect, it } from 'vitest';
import type { LocalArtifact, LocalFeature, TownPlan } from '../../artifacts';
import { childSeedPath, rootSeedPath } from '../../seedPath';
import { applyDeltas } from '../applyDeltas';
import {
  deserializeDeltas,
  serializeDeltas,
} from '../serialize';
import {
  WORLD_DELTA_SCHEMA_VERSION,
  WORLD_DELTA_OPERATION_VERSION,
  type WorldDelta,
} from '../types';

// ---------------------------------------------------------------------------
// LocalArtifact fixture
// ---------------------------------------------------------------------------
// The fixture uses stable feature ids because those are the keys the save delta
// layer records. Future L2 generation should be able to rebuild this base data,
// then replay the deltas to recover the player's changed world.
// ---------------------------------------------------------------------------

const LOCAL_SEED_PATH = childSeedPath(rootSeedPath(42), 'local:fixture');

function makeFeature(id: number, kind: LocalFeature['kind']): LocalFeature {
  return {
    id,
    kind,
    x: id * 10,
    y: id * 20,
    data: { label: `feature-${id}` },
  };
}

function makeLocalArtifact(): LocalArtifact {
  return {
    layer: 'local',
    schemaVersion: 1,
    seedPath: LOCAL_SEED_PATH,
    bounds: { x: 0, y: 0, width: 500, height: 500 },
    terrain: {
      widthCells: 2,
      heightCells: 2,
      elevationFt: new Float32Array([0.1, 0.2, 0.3, 0.4]),
      materialIndex: new Uint8Array([0, 0, 1, 1]),
      materials: ['grass', 'dirt'],
    },
    features: [
      makeFeature(1, 'tree'),
      makeFeature(2, 'poi'),
    ],
  };
}

// Small TownPlan fixture for B6/B7 town deltas. It keeps plot ids, footprints,
// roles, and storeys explicit so replay expectations are easy to inspect.
function makeTownPlan(): TownPlan {
  return {
    burgId: 77,
    streets: [
      {
        id: 1,
        centerline: [[0, 50], [100, 50]],
        widthFt: 20,
      },
    ],
    plots: [
      {
        id: 1,
        footprint: [[10, 10], [50, 10], [50, 40], [10, 40]],
        role: 'house',
        storeys: 1,
      },
      {
        id: 2,
        footprint: [[60, 10], [100, 10], [100, 40], [60, 40]],
        role: 'market',
        storeys: 2,
      },
    ],
  };
}

function makeLocalArtifactWithTown(): LocalArtifact {
  return {
    ...makeLocalArtifact(),
    townPlan: makeTownPlan(),
  };
}

function delta(
  id: string,
  sequence: number,
  entityKey: string,
  operation: WorldDelta['operation'],
): WorldDelta {
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

function goldenDeltas(): WorldDelta[] {
  return [
    delta('003-set-new-building-open', 30, 'feature:3', {
      kind: 'set-feature-state',
      featureId: 3,
      key: 'open',
      value: true,
    }),
    delta('001-remove-tree', 10, 'feature:1', {
      kind: 'remove-feature',
      featureId: 1,
    }),
    delta('002-add-building', 20, 'feature:3', {
      kind: 'add-feature',
      feature: {
        id: 3,
        kind: 'building',
        x: 300,
        y: 200,
        data: { role: 'shop' },
      },
    }),
  ];
}

// ---------------------------------------------------------------------------
// Delta application
// ---------------------------------------------------------------------------
// These tests freeze the ordering rule: deltas sort by artifact seed path,
// entity key, sequence, then delta id before application. That makes saves
// deterministic even if storage returns records in a different insertion order.
// ---------------------------------------------------------------------------

describe('world delta application', () => {
  it('applies the same delta set deterministically regardless of insertion order', () => {
    const forward = applyDeltas(makeLocalArtifact(), goldenDeltas());
    const reversed = applyDeltas(makeLocalArtifact(), [...goldenDeltas()].reverse());

    expect(forward.warnings).toEqual([]);
    expect(reversed.warnings).toEqual([]);
    expect(forward.artifact).toEqual(reversed.artifact);
  });

  it('GOLDEN: applies remove, add, and set-feature-state to a LocalArtifact fixture', () => {
    const result = applyDeltas(makeLocalArtifact(), goldenDeltas());

    expect(result.artifact.features).toEqual([
      {
        id: 2,
        kind: 'poi',
        x: 20,
        y: 40,
        data: { label: 'feature-2' },
      },
      {
        id: 3,
        kind: 'building',
        x: 300,
        y: 200,
        data: { role: 'shop', open: true },
      },
    ]);
  });

  it('skips unknown operation versions and collects warnings without throwing', () => {
    const unknownVersionDelta: WorldDelta = {
      ...delta('unknown-version', 1, 'feature:1', {
        kind: 'remove-feature',
        featureId: 1,
      }),
      opVersion: 999,
    };

    const result = applyDeltas(makeLocalArtifact(), [unknownVersionDelta]);

    expect(result.artifact).toEqual(makeLocalArtifact());
    expect(result.warnings).toEqual([
      {
        deltaId: 'unknown-version',
        message: 'Skipped delta with unsupported operation version 999.',
      },
    ]);
  });

  it('does not mutate the input artifact', () => {
    const artifact = makeLocalArtifact();
    const before = makeLocalArtifact();

    const result = applyDeltas(artifact, [
      delta('set-state', 1, 'feature:2', {
        kind: 'set-feature-state',
        featureId: 2,
        key: 'visited',
        value: true,
      }),
    ]);

    expect(artifact).toEqual(before);
    expect(result.artifact).not.toBe(artifact);
    expect(result.artifact.features[1].data).toEqual({
      label: 'feature-2',
      visited: true,
    });
  });

  it('applies town plot and building deltas deterministically regardless of insertion order', () => {
    const townDeltas: WorldDelta[] = [
      delta('003-add-building', 30, 'plot:1', {
        kind: 'add-building',
        plotId: 1,
        buildingId: 9001,
        role: 'market',
        storeys: 3,
        featureData: { roof: 'tile' },
      }),
      delta('001-modify-plot', 10, 'plot:1', {
        kind: 'modify-plot',
        plotId: 1,
        role: 'shop',
        storeys: 3,
      }),
      delta('002-remove-plot', 20, 'plot:2', {
        kind: 'remove-plot',
        plotId: 2,
      }),
    ];

    const forward = applyDeltas(makeLocalArtifactWithTown(), townDeltas);
    const reversed = applyDeltas(makeLocalArtifactWithTown(), [...townDeltas].reverse());

    expect(forward.warnings).toEqual([]);
    expect(reversed.warnings).toEqual([]);
    expect(forward.artifact).toEqual(reversed.artifact);
    expect(forward.artifact.townPlan?.plots).toEqual([
      {
        id: 1,
        footprint: [[10, 10], [50, 10], [50, 40], [10, 40]],
        role: 'market',
        storeys: 3,
      },
    ]);
    expect(forward.artifact.features).toContainEqual({
      id: 9001,
      kind: 'building',
      x: 30,
      y: 25,
      data: {
        plotId: 1,
        role: 'market',
        storeys: 3,
        roof: 'tile',
      },
    });
  });

  it('materializes add-building as an interior-ready TownPlan plot when the plot is new', () => {
    const addedBuilding = delta('add-new-interior-plot', 1, 'plot:44', {
      kind: 'add-building',
      plotId: 44,
      buildingId: 9044,
      role: 'market',
      storeys: 2,
      footprint: [[120, 80], [180, 80], [180, 130], [120, 130]],
      featureData: { sign: 'silver-scale' },
    });

    const result = applyDeltas(makeLocalArtifactWithTown(), [addedBuilding]);

    expect(result.warnings).toEqual([]);
    expect(result.artifact.townPlan?.plots.find((plot) => plot.id === 44)).toEqual({
      id: 44,
      footprint: [[120, 80], [180, 80], [180, 130], [120, 130]],
      role: 'market',
      storeys: 2,
    });
    expect(result.artifact.features).toContainEqual({
      id: 9044,
      kind: 'building',
      x: 150,
      y: 105,
      data: {
        plotId: 44,
        role: 'market',
        storeys: 2,
        sign: 'silver-scale',
      },
    });
  });

  it('rejects malformed town operations with warnings and leaves the town plan unchanged', () => {
    const malformedShape = delta('bad-modify-plot-shape', 1, 'plot:1', {
      kind: 'modify-plot',
      plotId: 1,
      role: 44,
      storeys: 'two',
    } as unknown as WorldDelta['operation']);

    const result = applyDeltas(makeLocalArtifactWithTown(), [malformedShape]);

    expect(result.artifact).toEqual(makeLocalArtifactWithTown());
    expect(result.warnings).toEqual([
      {
        deltaId: 'bad-modify-plot-shape',
        message: 'Skipped modify-plot delta because role/storeys values are malformed.',
      },
    ]);
  });

  it('rejects malformed add-building operations before they can create orphan interior plots', () => {
    const malformedShape = delta('bad-add-building-shape', 1, 'plot:3', {
      kind: 'add-building',
      plotId: 3,
      buildingId: 9003,
      role: 42,
      storeys: 'two',
      footprint: [[0, 0], [50, 0], [50, 50]],
    } as unknown as WorldDelta['operation']);

    const result = applyDeltas(makeLocalArtifactWithTown(), [malformedShape]);

    expect(result.artifact).toEqual(makeLocalArtifactWithTown());
    expect(result.warnings).toEqual([
      {
        deltaId: 'bad-add-building-shape',
        message: 'Skipped add-building delta because building values are malformed.',
      },
    ]);
  });

  it('rejects missing plot town operations with warnings and leaves the town plan unchanged', () => {
    const malformed = delta('bad-modify-plot', 1, 'plot:missing', {
      kind: 'modify-plot',
      plotId: 999,
      role: 'shop',
      storeys: 2,
    });

    const result = applyDeltas(makeLocalArtifactWithTown(), [malformed]);

    expect(result.artifact).toEqual(makeLocalArtifactWithTown());
    expect(result.warnings).toEqual([
      {
        deltaId: 'bad-modify-plot',
        message: 'Skipped modify-plot delta because plot 999 does not exist.',
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
// Delta files carry their own schema version. The current reader accepts only
// the current schema, so old/new save envelopes fail closed with warnings
// rather than being partially applied as if they were current.
// ---------------------------------------------------------------------------

describe('world delta serialization', () => {
  it('round-trips deltas through JSON without changing their meaning', () => {
    const serialized = serializeDeltas(goldenDeltas());
    const parsed = deserializeDeltas(serialized);

    expect(parsed.warnings).toEqual([]);
    expect(parsed.deltas).toEqual(goldenDeltas());
  });

  it('round-trips town operation deltas through JSON without changing their meaning', () => {
    const townDeltas: WorldDelta[] = [
      delta('modify-plot-json', 1, 'plot:1', {
        kind: 'modify-plot',
        plotId: 1,
        role: 'inn',
        storeys: 2,
      }),
      delta('add-building-json', 2, 'plot:1', {
        kind: 'add-building',
        plotId: 1,
        buildingId: 44,
        role: 'inn',
        storeys: 2,
        featureData: { sign: 'blue-lantern' },
      }),
    ];

    const parsed = deserializeDeltas(serializeDeltas(townDeltas));

    expect(parsed.warnings).toEqual([]);
    expect(parsed.deltas).toEqual(townDeltas);
  });

  it('rejects unsupported serialized schema versions with a warning', () => {
    const parsed = deserializeDeltas(
      JSON.stringify({
        schemaVersion: 999,
        deltas: goldenDeltas(),
      }),
    );

    expect(parsed.deltas).toEqual([]);
    expect(parsed.warnings).toEqual([
      'Unsupported WorldDelta save schema version 999.',
    ]);
  });
});
