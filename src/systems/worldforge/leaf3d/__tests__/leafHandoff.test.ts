import { describe, it, expect } from 'vitest';
import { buildLeaf3DHandoff, type LeafContext } from '../leafHandoff';
import { rootSeedPath } from '../../seedPath';
import type { Pt } from '../../submap/submapEngine';

const square: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]]; // center (50,50)

const baseLeaf: LeafContext = {
  polygon: square,
  seedPath: rootSeedPath(42),
  biome: 'Temperate deciduous forest',
  features: [{ kind: 'burg', x: 60, y: 40, id: 7, name: 'Bomnogorvan' }],
  polylines: [{ kind: 'river', points: [[0, 50], [100, 50]] }],
};

describe('buildLeaf3DHandoff', () => {
  it('derives ground extent from the leaf bounds × unitScale', () => {
    const h = buildLeaf3DHandoff(baseLeaf, { unitScale: 2 });
    expect(h.groundExtent).toEqual({ width: 200, height: 200 });
    expect(h.biome).toBe('Temperate deciduous forest');
  });

  it('re-centers coords on the leaf (origin at the cell center)', () => {
    const h = buildLeaf3DHandoff(baseLeaf, { unitScale: 1 });
    // Burg at (60,40), center (50,50) → ground-local (10,-10).
    const burg = h.setPieces.find((s) => s.kind === 'burg')!;
    expect(burg.x).toBeCloseTo(10, 6);
    expect(burg.z).toBeCloseTo(-10, 6);
    expect(burg.name).toBe('Bomnogorvan');
    // Spawn lands on the burg.
    expect(h.spawn.x).toBeCloseTo(10, 6);
    expect(h.spawn.z).toBeCloseTo(-10, 6);
  });

  it('spawns at the interior mean when the leaf carries no burg', () => {
    const h = buildLeaf3DHandoff({ ...baseLeaf, features: [] }, {});
    expect(h.spawn.x).toBeCloseTo(0, 6); // vertex mean = center → origin
    expect(h.spawn.z).toBeCloseTo(0, 6);
  });

  it('maps inherited rivers/roads to ground-local paths', () => {
    const h = buildLeaf3DHandoff(baseLeaf, {});
    expect(h.paths).toHaveLength(1);
    expect(h.paths[0].kind).toBe('river');
    // River endpoints (0,50)&(100,50) → (-50,0)&(50,0).
    expect(h.paths[0].points[0]).toEqual({ x: -50, z: 0 });
    expect(h.paths[0].points[1]).toEqual({ x: 50, z: 0 });
  });

  it('places SP4 hidden places, ground-local within the extent', () => {
    const h = buildLeaf3DHandoff(baseLeaf, { hiddenCount: 6 });
    expect(h.hidden.length).toBeGreaterThan(0);
    for (const hp of h.hidden) {
      expect(Math.abs(hp.x)).toBeLessThanOrEqual(h.groundExtent.width / 2 + 1e-6);
      expect(Math.abs(hp.z)).toBeLessThanOrEqual(h.groundExtent.height / 2 + 1e-6);
    }
  });

  it('is deterministic for a given seed-path', () => {
    const a = buildLeaf3DHandoff(baseLeaf, { hiddenCount: 6 });
    const b = buildLeaf3DHandoff(baseLeaf, { hiddenCount: 6 });
    expect(a).toEqual(b);
  });
});
