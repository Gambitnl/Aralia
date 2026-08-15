/**
 * @file grownTreeWiring.test.ts — the grown trees, as the GAME consumes them.
 *
 * The differentiation gate (grownTreeMeshSource.test.ts) proves one biome grows
 * a different tree from another. This file proves the world can render them:
 * the biome reaches the instancer as data, the buckets split by biome, and the
 * batch scale carries each VARIANT's own measured height.
 */
import { describe, it, expect } from 'vitest';
import {
  GROWN_VARIANTS_PER_BIOME,
  grownTreeHeightM,
  grownTreeVariantsFor,
} from '../grownTreeVariants';
import { partitionGrownTreeInstances } from '../treeInstancePartition';
import { buildGrownTreeBatches, grownTreeBatchKey } from '../treeBatching';
import type { TreeBatchInput } from '../treeBatching';

/** A chunk scatter whose instances all stand in one biome. */
const makeChunk = (
  n: number,
  biomes: readonly string[],
  offset: readonly [number, number, number] = [0, 0, 0],
  castShadow = false,
): TreeBatchInput => {
  const positions = new Float32Array(n * 3);
  const scales = new Float32Array(n);
  const rotations = new Float32Array(n);
  const biomeCodes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // Spread widely so the variant hash lands across all four variants.
    positions[i * 3] = (i % 17) * 3.1;
    positions[i * 3 + 1] = 0.5;
    positions[i * 3 + 2] = Math.floor(i / 17) * 4.7 + (i % 5);
    scales[i] = 0.8 + (i % 4) * 0.1;
    rotations[i] = (i % 8) * 0.4;
    biomeCodes[i] = i % biomes.length;
  }
  return {
    scatter: {
      positions, scales, rotations, biomeCodes, biomeTable: [...biomes],
      cacheKey: `chunk-${offset.join(',')}-${n}`,
    },
    offset,
    castShadow,
  };
};

describe('grownTreeVariants', () => {
  it('grows the same tree twice for the same (biome, variant)', () => {
    const a = grownTreeVariantsFor('Taiga');
    const b = grownTreeVariantsFor('Taiga');
    expect(a).toHaveLength(GROWN_VARIANTS_PER_BIOME);
    // Same cached object, and identical geometry either way.
    expect(a[0].positions).toBe(b[0].positions);
    expect(a[2].metrics.heightFt).toBe(b[2].metrics.heightFt);
  });

  it('gives different biomes measurably different trees', () => {
    const taiga = grownTreeHeightM('Taiga', 0);
    const rainforest = grownTreeHeightM('Tropical rainforest', 0);
    const desert = grownTreeHeightM('Hot desert', 0);
    expect(rainforest).toBeGreaterThan(taiga);
    expect(taiga).toBeGreaterThan(desert);
  });

  it('gives one biome different heights per variant', () => {
    const heights = Array.from(
      { length: GROWN_VARIANTS_PER_BIOME },
      (_, v) => grownTreeHeightM('Temperate deciduous forest', v),
    );
    expect(new Set(heights).size).toBe(GROWN_VARIANTS_PER_BIOME);
  });

  it('THROWS on a treeless biome instead of growing a default tree', () => {
    expect(() => grownTreeVariantsFor('Marine')).toThrow(/no environment mapped/);
  });
});

describe('partitionGrownTreeInstances', () => {
  it('splits instances by the biome they carry, not by any color', () => {
    const { scatter } = makeChunk(60, ['Taiga', 'Hot desert']);
    const buckets = partitionGrownTreeInstances(scatter);
    const biomes = new Set(buckets.map((b) => b.biome));
    expect(biomes).toEqual(new Set(['Taiga', 'Hot desert']));
    // Every instance lands in exactly one bucket.
    const total = buckets.reduce((n, b) => n + b.instanceIndices.length, 0);
    expect(total).toBe(60);
    // The biome of every bucketed instance matches its own code.
    for (const bucket of buckets) {
      for (const i of bucket.instanceIndices) {
        expect(scatter.biomeTable![scatter.biomeCodes![i]]).toBe(bucket.biome);
      }
    }
  });

  it('is deterministic', () => {
    const { scatter } = makeChunk(40, ['Taiga']);
    expect(partitionGrownTreeInstances(scatter))
      .toEqual(partitionGrownTreeInstances(scatter));
  });

  it('THROWS when the scatter carries no biome channel (no fallback)', () => {
    const positions = new Float32Array([0, 0, 0]);
    expect(() => partitionGrownTreeInstances({ positions }))
      .toThrow(/no biome channel/);
  });

  it('THROWS on a code outside the table', () => {
    const { scatter } = makeChunk(4, ['Taiga']);
    scatter.biomeCodes![2] = 7;
    expect(() => partitionGrownTreeInstances(scatter)).toThrow(/outside a table/);
  });
});

describe('buildGrownTreeBatches', () => {
  it('scales every instance by its OWN variant height, not a species table', () => {
    const input = makeChunk(48, ['Taiga']);
    const batches = buildGrownTreeBatches([input]);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      const expected = grownTreeHeightM(batch.biome, batch.variant);
      for (let n = 0; n < batch.count; n++) {
        // Scale = the loader's own instance scale × this variant's height.
        expect(batch.scale[n] / expected).toBeGreaterThan(0.79);
        expect(batch.scale[n] / expected).toBeLessThan(1.21);
      }
    }
    // Different variants really do carry different heights into the scale.
    const perVariant = new Set(batches.map((b) => grownTreeHeightM(b.biome, b.variant)));
    expect(perVariant.size).toBe(batches.length);
  });

  it('merges chunks into one batch per (biome, variant, shadow tier)', () => {
    const batches = buildGrownTreeBatches([
      makeChunk(30, ['Taiga'], [0, 0, 0], true),
      makeChunk(30, ['Taiga'], [64, 0, 0], true),
      makeChunk(30, ['Taiga'], [128, 0, 0], false),
    ]);
    const keys = batches.map(grownTreeBatchKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k.endsWith('near')).length)
      .toBeLessThanOrEqual(GROWN_VARIANTS_PER_BIOME);
    const total = batches.reduce((n, b) => n + b.count, 0);
    expect(total).toBe(90);
  });

  it('offsets chunk-local positions into scene space', () => {
    const [batch] = buildGrownTreeBatches([makeChunk(1, ['Taiga'], [10, 2, -5])]);
    expect(batch.position[0]).toBeCloseTo(10, 5);
    expect(batch.position[1]).toBeCloseTo(2.5, 5);
    expect(batch.position[2]).toBeCloseTo(-5, 5);
  });

  it('keeps two biomes in separate batches so each draws its own tree', () => {
    const batches = buildGrownTreeBatches([makeChunk(40, ['Taiga', 'Savanna'])]);
    const taiga = batches.filter((b) => b.biome === 'Taiga');
    const savanna = batches.filter((b) => b.biome === 'Savanna');
    expect(taiga.length).toBeGreaterThan(0);
    expect(savanna.length).toBeGreaterThan(0);
    for (const b of batches) expect(b.count).toBeGreaterThan(0);
  });
});
