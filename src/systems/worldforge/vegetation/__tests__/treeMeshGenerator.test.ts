import { describe, it, expect } from 'vitest';
import {
  generateTreeGeometry,
  generateTreeVariantSet,
  TREE_SPECIES,
  VARIANTS_PER_SPECIES,
  SPECIES_HEIGHT_M,
} from '../treeMeshGenerator';

describe('treeMeshGenerator', () => {
  it('is deterministic: same species+seed gives bit-identical arrays', () => {
    for (const species of TREE_SPECIES) {
      const a = generateTreeGeometry(species, 42);
      const b = generateTreeGeometry(species, 42);
      expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
      expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
      expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
    }
  });

  it('different seeds give different geometry', () => {
    const a = generateTreeGeometry('broadleaf', 1);
    const b = generateTreeGeometry('broadleaf', 2);
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  it('variant set has the declared species and variant counts', () => {
    const set = generateTreeVariantSet(7);
    expect(Object.keys(set).sort()).toEqual([...TREE_SPECIES].sort());
    for (const species of TREE_SPECIES) {
      expect(set[species]).toHaveLength(VARIANTS_PER_SPECIES);
    }
  });

  it('geometry is authored in the unit frame: base near y=0, top near y=1', () => {
    for (const species of TREE_SPECIES) {
      for (let v = 0; v < VARIANTS_PER_SPECIES; v++) {
        const g = generateTreeGeometry(species, 100 + v);
        let minY = Infinity;
        let maxY = -Infinity;
        let maxR = 0;
        for (let i = 0; i < g.positions.length; i += 3) {
          const x = g.positions[i];
          const y = g.positions[i + 1];
          const z = g.positions[i + 2];
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          maxR = Math.max(maxR, Math.hypot(x, z));
        }
        // Base on the ground (small tolerance for jittered blob undersides).
        expect(minY).toBeGreaterThanOrEqual(-0.15);
        expect(minY).toBeLessThanOrEqual(0.05);
        // Height ~1 unit (scrub is bushy; allow a looser top).
        expect(maxY).toBeGreaterThan(species === 'scrub' ? 0.45 : 0.8);
        expect(maxY).toBeLessThanOrEqual(1.15);
        // Sane footprint: never wider than tall-ish.
        expect(maxR).toBeLessThan(0.8);
        // Valid indexed mesh.
        expect(g.indices.length % 3).toBe(0);
        const vertCount = g.positions.length / 3;
        for (const idx of g.indices) expect(idx).toBeLessThan(vertCount);
        expect(g.normals.length).toBe(g.positions.length);
        expect(g.colors.length).toBe(g.positions.length);
      }
    }
  });

  it('bakes both bark (brown) and foliage (near-white) vertex colors', () => {
    for (const species of TREE_SPECIES) {
      const g = generateTreeGeometry(species, 9);
      let hasBark = false;
      let hasFoliage = false;
      for (let i = 0; i < g.colors.length; i += 3) {
        const r = g.colors[i];
        const gg = g.colors[i + 1];
        if (r > gg && r < 0.5) hasBark = true; // brown: red-dominant, dark
        if (gg > 0.6) hasFoliage = true; // near-white/green-dominant bright
      }
      expect(hasBark).toBe(true);
      expect(hasFoliage).toBe(true);
    }
  });

  it('species world heights are ordered conifer > broadleaf > scrub', () => {
    expect(SPECIES_HEIGHT_M.conifer).toBeGreaterThan(SPECIES_HEIGHT_M.broadleaf);
    expect(SPECIES_HEIGHT_M.broadleaf).toBeGreaterThan(SPECIES_HEIGHT_M.scrub);
  });
});
