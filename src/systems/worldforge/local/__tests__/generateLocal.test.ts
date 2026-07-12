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
import { WORLDFORGE_SCHEMA_VERSION, type LocalArtifact, type RegionArtifact } from '../../artifacts';
import { patchNoise2 } from '../../vegetation/grassField';
import { CLEARING_FREQ, CLEARING_SALT, CLEARING_THRESHOLD } from '../../forests/forestTunables';

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

describe('generateLocal — altitude/slope rock classification', () => {
  /** Flat synthetic region at a uniform normalized height (real gradients are
   * near-zero at 5ft scale anyway — detail noise dominates, see the 2026-07-01
   * rock-fraction measurement). */
  function syntheticRegion(level: number): RegionArtifact {
    const width = 40;
    const height = 40;
    const resolutionFt = 100;
    return {
      layer: 'region',
      schemaVersion: WORLDFORGE_SCHEMA_VERSION,
      seedPath: rootSeedPath(7),
      bounds: { x: 0, y: 0, width: width * resolutionFt, height: height * resolutionFt },
      heightfield: { width, height, resolutionFt, samples: new Float32Array(width * height).fill(level) },
      rivers: [],
      roads: [],
      townSites: [],
    };
  }

  function rockFraction(level: number, biomeId = 4): number {
    const region = syntheticRegion(level);
    const local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, { biomeId });
    const rockIdx = local.terrain.materials.indexOf('rock');
    let rock = 0;
    const m = local.terrain.materialIndex;
    for (let i = 0; i < m.length; i++) if (m[i] === rockIdx) rock++;
    return rock / m.length;
  }

  it('high mountains (FMG h≈80) read as mostly rock', () => {
    expect(rockFraction(0.8)).toBeGreaterThan(0.9);
  });

  it('the mid-altitude band (FMG h≈58) mixes rock into the biome ground', () => {
    const f = rockFraction(0.58);
    expect(f).toBeGreaterThan(0.2);
    expect(f).toBeLessThan(0.9);
  });

  it('lowlands (FMG h≈35) stay essentially rock-free', () => {
    expect(rockFraction(0.35)).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// Forest thickets, clearings, undergrowth (forests campaign Task 10).
// Trees in DENSE-forest windows gate through the shared patch noise
// (patchNoise2 over world feet / 1000): low-noise zones become clearings,
// and an extra keep-gated 'undergrowth' stream crowds bushes into the
// thickets. Non-dense windows must stay byte-identical to the pre-Task-10
// generator.
// ---------------------------------------------------------------------------

describe('generateLocal — forest thickets, clearings, undergrowth (Task 10)', () => {
  const clearingNoiseAt = (x: number, y: number) =>
    patchNoise2(x / 1000, y / 1000, CLEARING_SALT, CLEARING_FREQ);

  function buildLocalFor(biomeId: number): LocalArtifact {
    const region = buildRegion();
    const center = boundsCenter(region.bounds);
    return generateLocal(region, center, region.seedPath ?? rootSeedPath(WORLD_SEED), { biomeId });
  }

  let cachedDense: LocalArtifact | null = null;
  /** Temperate deciduous forest (biome 6, treeDensity 1.8 ≥ 1.4 → dense). */
  const dense = () => (cachedDense ??= buildLocalFor(6));

  /**
   * Features after the artifact's last boulder. placeKind pushes in call
   * order (trees, bushes, boulders, then undergrowth), so this slice is
   * exactly the 'undergrowth' stream's output — empty when the stream
   * never ran.
   */
  function undergrowthSlice(local: LocalArtifact) {
    let lastBoulder = -1;
    local.features.forEach((f, i) => { if (f.kind === 'boulder') lastBoulder = i; });
    expect(lastBoulder).toBeGreaterThanOrEqual(0); // fixture must have boulders for the slice to mean anything
    return local.features.slice(lastBoulder + 1);
  }

  it('dense forest: low-noise probe rects hold < 20% of mean tree density (clearings)', () => {
    const local = dense();
    const { bounds } = local;
    // Find clearing probe rects straight from the noise the gate reads:
    // 150ft rects whose 10ft-sampled noise never reaches the threshold
    // (0.03 margin absorbs sub-sample wiggle).
    const RECT = 150;
    const rects: Array<[number, number]> = [];
    for (let ry = bounds.y; ry + RECT <= bounds.y + bounds.height; ry += RECT) {
      for (let rx = bounds.x; rx + RECT <= bounds.x + bounds.width; rx += RECT) {
        let maxNoise = -Infinity;
        for (let sy = 0; sy <= RECT; sy += 10) {
          for (let sx = 0; sx <= RECT; sx += 10) {
            const n = clearingNoiseAt(rx + sx, ry + sy);
            if (n > maxNoise) maxNoise = n;
          }
        }
        if (maxNoise < CLEARING_THRESHOLD - 0.03) rects.push([rx, ry]);
      }
    }
    expect(rects.length).toBeGreaterThanOrEqual(3); // the window really has clearings to probe

    const trees = local.features.filter((f) => f.kind === 'tree');
    const meanPerSqFt = trees.length / (bounds.width * bounds.height);
    const expectedInRects = meanPerSqFt * RECT * RECT * rects.length;
    let inRects = 0;
    for (const t of trees) {
      for (const [rx, ry] of rects) {
        if (t.x >= rx && t.x < rx + RECT && t.y >= ry && t.y < ry + RECT) { inRects++; break; }
      }
    }
    expect(expectedInRects).toBeGreaterThan(5); // probe is statistically meaningful
    expect(inRects).toBeLessThan(expectedInRects * 0.2);
  });

  it('dense forest: every tree sits above the clearing threshold (gate wired to the shared noise)', () => {
    const trees = dense().features.filter((f) => f.kind === 'tree');
    expect(trees.length).toBeGreaterThan(300);
    let below = 0;
    for (const t of trees) if (clearingNoiseAt(t.x, t.y) <= CLEARING_THRESHOLD) below++;
    expect(below).toBe(0);
  });

  it('dense forest: undergrowth bushes exist and all hug the thickets (same keep as trees)', () => {
    const under = undergrowthSlice(dense());
    expect(under.length).toBeGreaterThan(200); // 2.5× scrub density has real presence
    expect(under.every((f) => f.kind === 'bush')).toBe(true);
    let below = 0;
    for (const f of under) if (clearingNoiseAt(f.x, f.y) <= CLEARING_THRESHOLD) below++;
    expect(below).toBe(0); // clearings stay open — undergrowth never lands in them
  });

  it('deep-forest-id biome (taiga 9): deterministic, with undergrowth', () => {
    const a = buildLocalFor(9);
    const b = buildLocalFor(9);
    expect(a.features).toEqual(b.features);
    expect(undergrowthSlice(a).length).toBeGreaterThan(0);
  });

  it('grassland (non-dense) output is BYTE-IDENTICAL to the pre-Task-10 generator', () => {
    const a = buildLocalFor(4);
    const b = buildLocalFor(4);
    expect(a.features).toEqual(b.features); // deterministic
    expect(undergrowthSlice(a).length).toBe(0); // the undergrowth stream never ran
    // FNV-1a over the exact feature JSON (ids, kinds, full-precision coords).
    // Snapshot BAKED PRE-CHANGE (RED run, 2026-07-11): a post-change match
    // proves non-dense windows still get the same streams in the same order —
    // no keep gate, no extra call, identical bytes.
    const s = JSON.stringify(a.features);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    expect({
      featureHash: h >>> 0,
      featureCount: a.features.length,
      counts: {
        tree: a.features.filter((f) => f.kind === 'tree').length,
        bush: a.features.filter((f) => f.kind === 'bush').length,
        boulder: a.features.filter((f) => f.kind === 'boulder').length,
      },
    }).toMatchSnapshot('grassland-task10-byte-identity');
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
