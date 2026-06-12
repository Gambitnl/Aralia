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
import type { LocalArtifact, LocalFeature } from '../../artifacts';
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
