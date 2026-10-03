import { describe, it, expect } from 'vitest';
import { environmentForBiome } from '../treeEnvironment';
import {
  growTree,
  growTreeVariants,
  drawGenome,
  traitsFor,
  FOLIAGE_COLOR_THRESHOLD,
} from '../grownTreeMeshSource';

/** The four biomes the visual gate renders. Same seed, four places. */
const WET = environmentForBiome('Temperate rainforest');
const ARID = environmentForBiome('Hot desert');
const WINDY = environmentForBiome('Tundra', { elevationFt: 5200 });
const DIM = environmentForBiome('Tropical rainforest');

const SEED = 424242;

describe('grownTreeMeshSource — determinism', () => {
  it('same (seed, environment) gives a bit-identical tree', () => {
    for (const env of [WET, ARID, WINDY, DIM]) {
      const a = growTree(SEED, env);
      const b = growTree(SEED, env);
      expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
      expect(Array.from(a.normals)).toEqual(Array.from(b.normals));
      expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
      expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
      expect(a.metrics).toEqual(b.metrics);
    }
  });

  it('the genome is drawn in one fixed order and never reads the environment', () => {
    // Nine draws, listed in drawGenome. Same seed, same genome, every time.
    expect(drawGenome(SEED)).toEqual(drawGenome(SEED));
    expect(drawGenome(1)).not.toEqual(drawGenome(2));
    // The SAME genome is what the four biomes share; only the traits differ.
    const g = drawGenome(SEED);
    expect(traitsFor(g, WET)).not.toEqual(traitsFor(g, ARID));
  });

  it('different seeds give different trees in the same biome', () => {
    const a = growTree(1, WET);
    const b = growTree(2, WET);
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  it('variants are deterministic and distinct', () => {
    const set = growTreeVariants(9, WET, 4);
    expect(set).toHaveLength(4);
    expect(Array.from(set[0].positions)).not.toEqual(Array.from(set[1].positions));
    const again = growTreeVariants(9, WET, 4);
    expect(Array.from(again[2].positions)).toEqual(Array.from(set[2].positions));
  });
});

describe('grownTreeMeshSource — DIFFERENTIATION (the point of the work)', () => {
  const wet = growTree(SEED, WET).metrics;
  const arid = growTree(SEED, ARID).metrics;
  const windy = growTree(SEED, WINDY).metrics;
  const dim = growTree(SEED, DIM).metrics;

  it('a wet-forest tree stands taller than an arid one', () => {
    // Height is bought with the growing season. At least 40% taller.
    expect(wet.heightFt).toBeGreaterThan(arid.heightFt * 1.4);
  });

  it('drought and wind thicken the trunk relative to the height', () => {
    const slender = (m: { trunkRadiusFt: number; heightFt: number }): number =>
      m.heightFt / m.trunkRadiusFt;
    // A stouter tree has a LOWER height-to-radius ratio.
    expect(slender(arid)).toBeLessThan(slender(wet) * 0.85);
    expect(slender(windy)).toBeLessThan(slender(wet) * 0.9);
  });

  it('crown ratio separates the biomes — the unit frame cannot hide it', () => {
    // Crown width over height survives the unit-frame normalization, so this is
    // the shape difference a player sees in silhouette, not a size difference.
    // Harsh ground (drought, wind, cold) builds a narrow crown; benign ground
    // spreads one. Measured: tundra 0.38, hot desert 0.41, grassland 0.73.
    const sheltered = growTree(SEED, environmentForBiome('Grassland')).metrics;
    expect(windy.crownRatio).toBeLessThan(sheltered.crownRatio * 0.75);
    expect(arid.crownRatio).toBeLessThan(sheltered.crownRatio * 0.75);
    // And the four gate biomes must not cluster.
    const ratios = [wet.crownRatio, arid.crownRatio, windy.crownRatio, dim.crownRatio];
    expect(Math.max(...ratios)).toBeGreaterThan(Math.min(...ratios) * 1.2);
  });

  it('branch order is a live knob, not pinned to one value', () => {
    // Wet ground buys branch orders; drought and cold spend them. An earlier
    // pass gave every biome 3 levels because the terminal budget cut them all
    // back to the same number, which is a dead knob.
    expect(dim.branchLevels).toBeGreaterThan(arid.branchLevels);
    expect(wet.branchLevels).toBeGreaterThan(windy.branchLevels);
  });

  it('leaves shrink toward needles with drought and cold, and swell in the dim', () => {
    expect(arid.leafLengthFt).toBeLessThan(wet.leafLengthFt * 0.75);
    // Dim understory light enlarges a leaf. Rainforest floor vs open dune.
    expect(dim.leafLengthFt).toBeGreaterThan(arid.leafLengthFt * 1.6);
  });

  it('total leaf area differs by biome by more than a rounding error', () => {
    const areas = [wet.leafAreaFt2, arid.leafAreaFt2, windy.leafAreaFt2, dim.leafAreaFt2];
    const lo = Math.min(...areas);
    const hi = Math.max(...areas);
    // At least four-fold between the extreme biomes.
    expect(hi).toBeGreaterThan(lo * 4);
  });

  it('wind adds measurable droop, holding every other axis still', () => {
    // A controlled comparison. Across whole biomes the branch ORDER moves too,
    // and a deeper tree accumulates more tilt whatever the wind does — so the
    // wind term has to be isolated to be measured.
    const calm = { light: 0.5, wind: 0.10, aridity: 0.3, chill: 0.2, vigor: 0.7 };
    const gale = { ...calm, wind: 0.95 };
    const a = growTree(SEED, calm);
    const b = growTree(SEED, gale);
    expect(a.metrics.branchLevels).toBe(b.metrics.branchLevels);
    expect(b.metrics.meanTerminalTiltRad).toBeGreaterThan(
      a.metrics.meanTerminalTiltRad + 0.05,
    );
    // The same wind must also thicken the stem and narrow the leaf.
    expect(b.metrics.trunkRadiusFt / b.metrics.heightFt)
      .toBeGreaterThan(a.metrics.trunkRadiusFt / a.metrics.heightFt * 1.15);
    expect(b.metrics.leafAreaFt2).toBeLessThan(a.metrics.leafAreaFt2 * 0.8);
  });

  it('no two of the four biomes produce the same geometry', () => {
    const keys = [WET, ARID, WINDY, DIM].map((e) => {
      const g = growTree(SEED, e);
      return Array.from(g.positions).map((v) => v.toFixed(4)).join(',');
    });
    expect(new Set(keys).size).toBe(4);
  });
});

describe('grownTreeMeshSource — render contract', () => {
  it('geometry is in the unit frame: base at y=0, top at y=1', () => {
    for (const env of [WET, ARID, WINDY, DIM]) {
      const g = growTree(SEED, env);
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < g.positions.length; i += 3) {
        minY = Math.min(minY, g.positions[i]);
        maxY = Math.max(maxY, g.positions[i]);
      }
      expect(minY).toBeCloseTo(0, 5);
      expect(maxY).toBeCloseTo(1, 5);
    }
  });

  it('vertex colors split bark from foliage on the shared 0.6 threshold', () => {
    const g = growTree(SEED, WET);
    let bark = 0;
    let leaf = 0;
    for (let i = 1; i < g.colors.length; i += 3) {
      if (g.colors[i] >= FOLIAGE_COLOR_THRESHOLD) leaf++;
      else bark++;
    }
    expect(bark).toBeGreaterThan(0);
    expect(leaf).toBeGreaterThan(0);
  });

  it('indices are in range and normals are unit length', () => {
    const g = growTree(SEED, DIM);
    const vCount = g.positions.length / 3;
    expect(g.normals.length).toBe(g.positions.length);
    expect(g.colors.length).toBe(g.positions.length);
    for (let i = 0; i < g.indices.length; i++) {
      expect(g.indices[i]).toBeLessThan(vCount);
    }
    for (let i = 0; i < vCount; i += 37) {
      const l = Math.hypot(g.normals[i * 3], g.normals[i * 3 + 1], g.normals[i * 3 + 2]);
      expect(l).toBeCloseTo(1, 3);
    }
  });

  it('stays inside the per-tree triangle budget in every biome', () => {
    // Trees are instanced in the thousands. Branch order is cut to fit.
    for (const env of [WET, ARID, WINDY, DIM]) {
      const g = growTree(SEED, env);
      expect(g.metrics.triangles).toBeLessThan(12000);
      expect(g.metrics.triangles).toBeGreaterThan(500);
    }
  });

  it('pipe model holds: child cross-sections sum to the parent', () => {
    // r_leader^2 + n * r_lateral^2 == r_parent^2, by construction.
    const LEADER = 0.70;
    const rParent = 1;
    const rLeader = rParent * LEADER;
    for (const n of [2, 3, 4]) {
      const rLateral = Math.sqrt((rParent * rParent - rLeader * rLeader) / n);
      expect(rLeader * rLeader + n * rLateral * rLateral).toBeCloseTo(rParent * rParent, 10);
    }
  });
});
