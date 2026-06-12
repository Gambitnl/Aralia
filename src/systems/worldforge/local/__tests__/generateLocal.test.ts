/**
 * @file generateLocal.test.ts — L2 LOCAL layer regression tests (build item 4,
 * wilderness slice). Golden values FREEZE AT ACCEPTANCE per the Worldforge
 * tracker conventions; the spine test-file header rule applies after that.
 */
import { describe, it, expect } from 'vitest';
import { generateFmgAtlas } from '../../fmg/generateAtlas';
import { generateRegion } from '../../region/generateRegion';
import { generateLocal } from '../generateLocal';
import { rootSeedPath } from '../../seedPath';
import { boundsCenter } from '../../units';
import type { RegionArtifact } from '../../artifacts';

const SEED = 'world-42';
const WORLD_SEED = 42;
const FMG_OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };
// Anchor cell 110: the C1-verified coastal land cell with rivers.
const ANCHOR_CELL = 110;
const FEET_PER_PIXEL = 1000; // placeholder, matches the C1 test convention (WF-INT-1)

let cachedRegion: RegionArtifact | null = null;
function buildRegion(): RegionArtifact {
  if (cachedRegion) return cachedRegion;
  const atlas = generateFmgAtlas(SEED, FMG_OPTS);
  cachedRegion = generateRegion(atlas, ANCHOR_CELL, rootSeedPath(WORLD_SEED), {
    feetPerPixel: FEET_PER_PIXEL,
  });
  return cachedRegion;
}

function buildLocal() {
  const region = buildRegion();
  const center = boundsCenter(region.bounds);
  return generateLocal(region, center, region.seedPath ?? rootSeedPath(WORLD_SEED), {
    biomeId: 6, // temperate deciduous forest — vegetation-rich profile
  });
}

describe('generateLocal — determinism', () => {
  it('same inputs → byte-equal terrain and identical features', () => {
    const a = buildLocal();
    const b = buildLocal();
    expect(Array.from(a.terrain.elevationFt)).toEqual(Array.from(b.terrain.elevationFt));
    expect(Array.from(a.terrain.materialIndex)).toEqual(Array.from(b.terrain.materialIndex));
    expect(a.features).toEqual(b.features);
    expect(a.seedPath).toBe(b.seedPath);
  });
});

describe('generateLocal — structure & invariants', () => {
  it('grid is 5ft-canon sized and bounds-centered', () => {
    const local = buildLocal();
    expect(local.terrain.widthCells).toBe(600); // 3000ft / 5ft
    expect(local.terrain.heightCells).toBe(600);
    expect(local.bounds.width).toBe(3000);
    expect(local.layer).toBe('local');
  });

  it('no NaN elevations; all material indices valid', () => {
    const { terrain } = buildLocal();
    const maxMat = terrain.materials.length;
    // Aggregate in plain JS — per-element expect() calls are ~100× slower
    // and time the test out at 360k cells.
    let nanCount = 0;
    let badMat = 0;
    for (let i = 0; i < terrain.elevationFt.length; i++) {
      if (Number.isNaN(terrain.elevationFt[i])) nanCount++;
      if (terrain.materialIndex[i] >= maxMat) badMat++;
    }
    expect({ nanCount, badMat }).toEqual({ nanCount: 0, badMat: 0 });
  });

  it('elevation is lattice-smooth (Laplacian guard, the C1 lesson)', () => {
    const { terrain } = buildLocal();
    const { widthCells: w, heightCells: h, elevationFt: e } = terrain;
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let y = 1; y < h - 1; y += 3) {
      for (let x = 1; x < w - 1; x += 3) {
        const c = e[y * w + x];
        const mean = (e[y * w + x - 1] + e[y * w + x + 1] + e[(y - 1) * w + x] + e[(y + 1) * w + x]) / 4;
        sum += Math.abs(c - mean);
        count++;
        if (c < min) min = c;
        if (c > max) max = c;
      }
    }
    const meanLaplacian = sum / count;
    const range = Math.max(1, max - min);
    expect(meanLaplacian / range).toBeLessThan(0.01);
  });

  it('features never stand on water or paved cells', () => {
    const local = buildLocal();
    const { terrain, bounds } = local;
    const waterIdx = terrain.materials.indexOf('water');
    const pavedIdx = terrain.materials.indexOf('paved');
    for (const f of local.features) {
      const cx = Math.min(terrain.widthCells - 1, Math.floor((f.x - bounds.x) / 5));
      const cy = Math.min(terrain.heightCells - 1, Math.floor((f.y - bounds.y) / 5));
      const m = terrain.materialIndex[cy * terrain.widthCells + cx];
      expect(m).not.toBe(waterIdx);
      expect(m).not.toBe(pavedIdx);
    }
  });

  it('forest biome places a substantial feature population with stable ids', () => {
    const local = buildLocal();
    const trees = local.features.filter(f => f.kind === 'tree');
    expect(trees.length).toBeGreaterThan(300); // 1.8/10ksqft × 900 patches, rejection-limited
    const ids = new Set(local.features.map(f => f.id));
    expect(ids.size).toBe(local.features.length); // delta-layer key uniqueness
  });
});

describe('generateLocal — golden snapshot (freeze at acceptance)', () => {
  it('pins terrain hash and feature counts', () => {
    const local = buildLocal();
    let h = 0x811c9dc5;
    const m = local.terrain.materialIndex;
    for (let i = 0; i < m.length; i++) { h ^= m[i]; h = Math.imul(h, 0x01000193); }
    expect({
      materialHash: h >>> 0,
      featureCount: local.features.length,
      treeCount: local.features.filter(f => f.kind === 'tree').length,
      seedPath: local.seedPath,
    }).toMatchSnapshot('local-golden');
  });
});
