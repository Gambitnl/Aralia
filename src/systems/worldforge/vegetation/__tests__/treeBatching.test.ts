import { describe, it, expect } from 'vitest';
import { buildTreeBatches, MAX_TREE_BATCHES, treeBatchKey } from '../treeBatching';
import type { TreeBatchInput } from '../treeBatching';
import { TREE_SPECIES, VARIANTS_PER_SPECIES, SPECIES_HEIGHT_M } from '../treeMeshGenerator';

/** A chunk scatter with `n` trees on a deterministic spread of positions. */
const makeChunk = (
  n: number,
  offset: readonly [number, number, number],
  castShadow = false,
  withColor = true,
): TreeBatchInput => {
  const positions = new Float32Array(n * 3);
  const scales = new Float32Array(n);
  const rotations = new Float32Array(n);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Spread widely so the position hashes land across species and variants.
    positions[i * 3] = (i % 17) * 3.1;
    positions[i * 3 + 1] = 0.5;
    positions[i * 3 + 2] = Math.floor(i / 17) * 4.7 + (i % 5);
    scales[i] = 0.8 + (i % 4) * 0.1;
    rotations[i] = (i % 8) * 0.4;
    colors[i * 3] = 0.2;
    colors[i * 3 + 1] = 0.45;
    colors[i * 3 + 2] = 0.2;
  }
  return {
    scatter: {
      positions, scales, rotations,
      ...(withColor ? { colors } : {}),
      cacheKey: `chunk-${offset.join(',')}-${n}`,
    },
    offset,
    castShadow,
  };
};

describe('treeBatching', () => {
  it('collapses many chunks into a bounded number of batches', () => {
    // The bug this fixes: one instanced mesh per (species, variant) per chunk.
    // 20 chunks used to mean up to 20 × species × variants meshes; a live frame
    // measured 379 of them for 2,340 trees.
    const chunks = Array.from({ length: 20 }, (_, c) => makeChunk(60, [c * 100, 0, 0]));
    const perChunkMeshCount = 20 * TREE_SPECIES.length * VARIANTS_PER_SPECIES;

    const batches = buildTreeBatches(chunks);

    expect(batches.length).toBeLessThanOrEqual(MAX_TREE_BATCHES);
    expect(batches.length).toBeLessThan(perChunkMeshCount / 4);
  });

  it('keeps every tree — no instance is dropped or duplicated', () => {
    const chunks = [makeChunk(40, [0, 0, 0]), makeChunk(25, [128, 0, 0]), makeChunk(11, [0, 0, 128])];
    const expected = 40 + 25 + 11;

    const batches = buildTreeBatches(chunks);

    expect(batches.reduce((sum, b) => sum + b.count, 0)).toBe(expected);
    for (const b of batches) {
      expect(b.position.length).toBe(b.count * 3);
      expect(b.scale.length).toBe(b.count);
      expect(b.rotation.length).toBe(b.count);
    }
  });

  it('places instances in world space by adding the chunk offset', () => {
    const offset = [1000, 7, -250] as const;
    const [batch] = buildTreeBatches([makeChunk(1, offset)]);

    const chunk = makeChunk(1, offset);
    expect(batch.position[0]).toBeCloseTo(chunk.scatter.positions[0] + offset[0]);
    expect(batch.position[1]).toBeCloseTo(chunk.scatter.positions[1] + offset[1]);
    expect(batch.position[2]).toBeCloseTo(chunk.scatter.positions[2] + offset[2]);
  });

  it('bakes the species world height into the scale', () => {
    const batches = buildTreeBatches([makeChunk(60, [0, 0, 0])]);
    for (const b of batches) {
      const baseH = SPECIES_HEIGHT_M[b.species];
      // Input scales are 0.8..1.1, so every output scale must be that × height.
      for (const s of b.scale) {
        expect(s).toBeGreaterThanOrEqual(0.8 * baseH - 1e-4);
        expect(s).toBeLessThanOrEqual(1.1 * baseH + 1e-4);
      }
    }
  });

  it('never mixes shadow-casting and non-casting trees in one batch', () => {
    // One InstancedMesh has a single castShadow flag. Mixing tiers would either
    // push the whole forest through the shadow pass or lose nearby shadows.
    const batches = buildTreeBatches([
      makeChunk(30, [0, 0, 0], true),
      makeChunk(30, [500, 0, 0], false),
    ]);

    const near = batches.filter((b) => b.castShadow);
    const far = batches.filter((b) => !b.castShadow);
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    expect(near.reduce((s, b) => s + b.count, 0)).toBe(30);
    expect(far.reduce((s, b) => s + b.count, 0)).toBe(30);
  });

  it('is deterministic and stably keyed', () => {
    const build = () => buildTreeBatches([makeChunk(45, [0, 0, 0]), makeChunk(45, [128, 0, 0], true)]);
    const a = build();
    const b = build();

    expect(a.map(treeBatchKey)).toEqual(b.map(treeBatchKey));
    expect(new Set(a.map(treeBatchKey)).size).toBe(a.length); // keys unique
    a.forEach((batch, i) => {
      expect(Array.from(batch.position)).toEqual(Array.from(b[i].position));
      expect(Array.from(batch.scale)).toEqual(Array.from(b[i].scale));
    });
  });

  it('emits colors when any chunk has a palette, and keeps them aligned', () => {
    const withColor = buildTreeBatches([makeChunk(20, [0, 0, 0], false, true)]);
    for (const b of withColor) {
      expect(b.color).toBeDefined();
      expect(b.color!.length).toBe(b.count * 3);
    }

    const without = buildTreeBatches([makeChunk(20, [0, 0, 0], false, false)]);
    for (const b of without) expect(b.color).toBeUndefined();
  });

  it('returns nothing for no chunks and skips empty scatters', () => {
    expect(buildTreeBatches([])).toEqual([]);
    expect(buildTreeBatches([makeChunk(0, [0, 0, 0])])).toEqual([]);
  });
});
