import { describe, it, expect } from 'vitest';
import {
  generateTreeGeometry,
  generateTreeVariantSet,
  TREE_SPECIES,
  TREE_FORMS,
  VARIANTS_PER_SPECIES,
  SPECIES_HEIGHT_M,
  treeVariantPlan,
} from '../treeMeshGenerator';
import type { TreeGeometryData } from '../treeMeshGenerator';

/**
 * Outline signature: the widest canopy radius in each of 5 height bands,
 * normalized to the tree's own widest point. Two trees that differ only in
 * scale share a signature; two trees with genuinely different silhouettes
 * (a narrow spire vs a high wide umbrella) do not. This is what "trees differ
 * in outline, not just size" has to mean to be testable.
 */
const outlineSignature = (g: TreeGeometryData, bands = 5): string => {
  const widest = new Array(bands).fill(0);
  let maxY = 0;
  for (let i = 1; i < g.positions.length; i += 3) maxY = Math.max(maxY, g.positions[i]);
  for (let i = 0; i < g.positions.length; i += 3) {
    const r = Math.hypot(g.positions[i], g.positions[i + 2]);
    const band = Math.min(bands - 1, Math.floor((g.positions[i + 1] / maxY) * bands));
    if (band >= 0) widest[band] = Math.max(widest[band], r);
  }
  const peak = Math.max(...widest) || 1;
  // Quantized so trivial jitter does not read as a different silhouette.
  return widest.map((w) => Math.round((w / peak) * 4)).join('-');
};

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

  it('declares at least two forms per species', () => {
    for (const species of TREE_SPECIES) {
      expect(TREE_FORMS[species].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each declared form builds a valid unit-frame mesh', () => {
    for (const species of TREE_SPECIES) {
      for (const form of TREE_FORMS[species]) {
        const g = generateTreeGeometry(species, 31, form);
        let minY = Infinity;
        let maxY = -Infinity;
        let maxR = 0;
        for (let i = 0; i < g.positions.length; i += 3) {
          minY = Math.min(minY, g.positions[i + 1]);
          maxY = Math.max(maxY, g.positions[i + 1]);
          maxR = Math.max(maxR, Math.hypot(g.positions[i], g.positions[i + 2]));
        }
        expect(minY).toBeGreaterThanOrEqual(-0.15);
        expect(minY).toBeLessThanOrEqual(0.05);
        expect(maxY).toBeGreaterThan(species === 'scrub' ? 0.45 : 0.8);
        expect(maxY).toBeLessThanOrEqual(1.15);
        expect(maxR).toBeLessThan(0.8);
        expect(g.indices.length % 3).toBe(0);
        expect(g.normals.length).toBe(g.positions.length);
        expect(g.colors.length).toBe(g.positions.length);
      }
    }
  });

  it('forms of one species have genuinely different outlines', () => {
    for (const species of TREE_SPECIES) {
      const signatures = TREE_FORMS[species].map(
        (form) => outlineSignature(generateTreeGeometry(species, 77, form)),
      );
      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });

  it('a variant set covers more than one outline per species', () => {
    // Variety has to survive the path the world actually uses. If every variant
    // landed on the same form, the world would show one tree shape at assorted
    // scales — which is the look this replaced.
    // Signature-diversity alone is too weak — per-tree jitter alone can satisfy
    // it. Demand that EVERY declared form actually shows up in the set, checked
    // against the exact seeds the set builds from.
    const seed = 2026;
    const set = generateTreeVariantSet(seed);
    for (const species of TREE_SPECIES) {
      const plan = treeVariantPlan(species, seed);
      expect(plan).toHaveLength(set[species].length);
      // Every declared form is scheduled...
      expect(new Set(plan.map((p) => p.form))).toEqual(new Set(TREE_FORMS[species]));
      // ...and each scheduled variant is the geometry that form+seed produces.
      const setSignatures = set[species].map((g) => outlineSignature(g));
      plan.forEach((p, v) => {
        expect(
          setSignatures[v],
          `${species} variant ${v} should be the "${p.form}" outline`,
        ).toBe(outlineSignature(generateTreeGeometry(species, p.seed, p.form)));
      });
      // And the scheduled forms really are different outlines from each other.
      const perForm = TREE_FORMS[species].map(
        (form) => outlineSignature(generateTreeGeometry(species, seed, form)),
      );
      expect(new Set(perForm).size).toBe(perForm.length);
    }
  });

  it('form choice is deterministic', () => {
    for (const species of TREE_SPECIES) {
      for (const form of TREE_FORMS[species]) {
        const a = generateTreeGeometry(species, 5, form);
        const b = generateTreeGeometry(species, 5, form);
        expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
      }
    }
  });

  it('species world heights are ordered conifer > broadleaf > scrub', () => {
    expect(SPECIES_HEIGHT_M.conifer).toBeGreaterThan(SPECIES_HEIGHT_M.broadleaf);
    expect(SPECIES_HEIGHT_M.broadleaf).toBeGreaterThan(SPECIES_HEIGHT_M.scrub);
  });
});
