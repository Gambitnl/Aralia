/**
 * @file worldStore.test.ts - tests for Worldforge world creation and storage.
 *
 * B4 ties the artifact adapter and delta layer together. These tests make sure
 * the game can create the same world from the same identity inputs, store only
 * the compact seed/options/delta recipe, and rebuild the visible world view by
 * regenerating the artifact instead of baking the large cell array into saves.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_GEN_OPTIONS, type WorldGenOptions } from '../../adapter/worldGenOptions';
import {
  WORLD_DELTA_OPERATION_VERSION,
  WORLD_DELTA_SCHEMA_VERSION,
  type WorldDelta,
} from '../../delta/types';
import { createWorld } from '../createWorld';
import { WORLD_STORE_SCHEMA_VERSION, WorldStore } from '../worldStore';

// ---------------------------------------------------------------------------
// Small deterministic world identity
// ---------------------------------------------------------------------------
// seedStr feeds the FMG generator; worldSeed feeds the Worldforge seed-path
// root. Both are part of identity, so every test keeps both explicit.
// ---------------------------------------------------------------------------

const SEED_STR = 'aralia-fmg-golden-1';
const WORLD_SEED = 12345;
const OPTIONS: WorldGenOptions = {
  ...DEFAULT_WORLD_GEN_OPTIONS,
  width: 320,
  height: 180,
  cellsDesired: 1000,
};

function makeDelta(id: string, sequence: number): WorldDelta {
  return {
    id,
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: `wf:${WORLD_SEED}`,
    entityKey: `feature:${sequence}`,
    sequence,
    operation: {
      kind: 'remove-feature',
      featureId: sequence,
    },
  };
}

// ---------------------------------------------------------------------------
// createWorld
// ---------------------------------------------------------------------------
// The entry point should be a deterministic recipe: FMG seed string + spine
// world seed + creation options always produce the same frozen atlas artifact.
// ---------------------------------------------------------------------------

describe('createWorld', () => {
  it('creates deterministic worlds from the same seed string, world seed, and options', () => {
    const first = createWorld(SEED_STR, WORLD_SEED, OPTIONS);
    const second = createWorld(SEED_STR, WORLD_SEED, OPTIONS);

    expect(first).toEqual(second);
    expect(Object.isFrozen(first.options)).toBe(true);
    expect(first.artifact.options).toBe(first.options);
  });
});

// ---------------------------------------------------------------------------
// WorldStore
// ---------------------------------------------------------------------------
// The store owns the base artifact and accumulated deltas for one world. Its
// save form must stay compact: no generated cells should be serialized.
// ---------------------------------------------------------------------------

describe('WorldStore', () => {
  it('round-trips through serialize/deserialize and rebuilds the same view', () => {
    const store = new WorldStore(SEED_STR, WORLD_SEED, OPTIONS);
    store.appendDelta(makeDelta('remove-1', 1));
    store.appendDelta(makeDelta('remove-2', 2));
    store.appendDelta(makeDelta('remove-3', 3));

    const restored = WorldStore.deserialize(store.serialize());

    expect(restored.view()).toEqual(store.view());
  });

  it('invalidates the cached view when a delta is appended', () => {
    const store = new WorldStore(SEED_STR, WORLD_SEED, OPTIONS);
    const first = store.view();
    const cached = store.view();

    store.appendDelta(makeDelta('remove-1', 1));
    const afterAppend = store.view();

    expect(cached).toBe(first);
    expect(afterAppend).not.toBe(first);
  });

  it('serializes only identity, options, and deltas, not the baked artifact cells', () => {
    const store = new WorldStore(SEED_STR, WORLD_SEED, OPTIONS);
    store.appendDelta(makeDelta('remove-1', 1));
    store.appendDelta(makeDelta('remove-2', 2));
    store.appendDelta(makeDelta('remove-3', 3));

    const serialized = store.serialize();
    const parsed = JSON.parse(serialized);

    expect(parsed).toMatchObject({
      schemaVersion: WORLD_STORE_SCHEMA_VERSION,
      seedStr: SEED_STR,
      worldSeed: WORLD_SEED,
    });
    expect(serialized).not.toContain('"cells"');
    expect(serialized.length).toBeLessThan(3000);
  });
});
