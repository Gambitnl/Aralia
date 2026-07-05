import { describe, it, expect } from 'vitest';
import { partitionTreeInstances, classifySpecies } from '../treeInstancePartition';
import { TREE_SPECIES, VARIANTS_PER_SPECIES } from '../treeMeshGenerator';

function makeScatter(n: number, color?: [number, number, number]) {
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (i * 13.7) % 128;
    positions[i * 3 + 2] = (i * 29.3) % 128;
  }
  let colors: Float32Array | undefined;
  if (color) {
    colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set(color, i * 3);
  }
  return { positions, colors };
}

describe('treeInstancePartition', () => {
  it('is deterministic and partitions every instance exactly once', () => {
    const scatter = makeScatter(200, [0.25, 0.45, 0.2]);
    const a = partitionTreeInstances(scatter);
    const b = partitionTreeInstances(scatter);
    expect(a).toEqual(b);
    const total = a.reduce((s, bk) => s + bk.instanceIndices.length, 0);
    expect(total).toBe(200);
    const seen = new Set(a.flatMap((bk) => bk.instanceIndices));
    expect(seen.size).toBe(200);
  });

  it('emits a stable full bucket list (species x variants)', () => {
    const buckets = partitionTreeInstances(makeScatter(10));
    expect(buckets).toHaveLength(TREE_SPECIES.length * VARIANTS_PER_SPECIES);
    for (const bk of buckets) {
      expect(bk.variant).toBeGreaterThanOrEqual(0);
      expect(bk.variant).toBeLessThan(VARIANTS_PER_SPECIES);
    }
  });

  it('classifies dark green palettes as mostly conifer', () => {
    const buckets = partitionTreeInstances(makeScatter(300, [0.1, 0.22, 0.12]));
    const count = (sp: string) =>
      buckets.filter((b) => b.species === sp).reduce((s, b) => s + b.instanceIndices.length, 0);
    expect(count('conifer')).toBeGreaterThan(count('broadleaf'));
    expect(count('scrub')).toBe(0);
  });

  it('classifies bright temperate green as mostly broadleaf', () => {
    const buckets = partitionTreeInstances(makeScatter(300, [0.25, 0.5, 0.22]));
    const count = (sp: string) =>
      buckets.filter((b) => b.species === sp).reduce((s, b) => s + b.instanceIndices.length, 0);
    expect(count('broadleaf')).toBeGreaterThan(count('conifer'));
  });

  it('classifies yellow-shifted dry palettes as scrub', () => {
    expect(classifySpecies(0.55, 0.5, 0.25, 0.1)).toBe('scrub');
  });

  it('mixes species with no colors present (hash fallback)', () => {
    const buckets = partitionTreeInstances(makeScatter(400));
    const species = new Set(
      buckets.filter((b) => b.instanceIndices.length > 0).map((b) => b.species),
    );
    expect(species.size).toBeGreaterThanOrEqual(2);
  });
});
