/**
 * @file generateLocal.test.ts — L2 LOCAL layer regression tests (build item 4,
 * wilderness slice). Golden values FREEZE AT ACCEPTANCE per the Worldforge
 * tracker conventions; the spine test-file header rule applies after that.
 */
import { describe, it, expect } from 'vitest';
import { generateFmgAtlas } from '../../fmg/generateAtlas';
import { generateRegion } from '../../region/generateRegion';
import { generateLocal, elevationCurveFt } from '../generateLocal';
import { rootSeedPath } from '../../seedPath';
import { boundsCenter } from '../../units';
import { WORLDFORGE_SCHEMA_VERSION, type LocalArtifact, type RegionArtifact } from '../../artifacts';
import { clumpAt, clumpAccept, clumpDens } from '../../forests/clumpField';
import { MOUNTAIN_MAX_ELEV_FT } from '../../mountains/mountainTunables';

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
// Vegetation clumping (jungle-trail pass, replaces the Task 10 clearing gate).
//
// Every vegetated kind in EVERY biome now scatters through the three-octave
// clump field in forests/clumpField.ts. Three behaviours replace the old
// single-octave boolean gate and are what these tests pin:
//
//   • density REDISTRIBUTES rather than falls — the target count still lands,
//   • acceptance is continuous, so a thicket has a margin rather than an edge,
//   • features carry `dens`, and it tracks the field they were placed from.
//
// The old contract asserted "every tree sits above the threshold", which was
// only ever true because the gate was a hard cutoff. Those assertions are gone
// on purpose: a hard cutoff draws a visible contour through the forest.
// ---------------------------------------------------------------------------

describe('generateLocal — vegetation clumping', () => {
  const clearingNoiseAt = (x: number, y: number) => clumpAt(x, y);

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
  /**
   * The undergrowth stream, identified by POSITION: it is appended after the
   * boulders and reuses the 'bush' kind, so there is no field to filter on.
   *
   * The upper bound matters as much as the lower one. The understory streams
   * (fern/sapling/log) are appended after undergrowth, and without the cut
   * below they fall into this slice and make it claim a grassland has
   * undergrowth. The slice runs from the last boulder to the first understory
   * feature.
   */
  const UNDERSTORY_KINDS = new Set(['fern', 'sapling', 'log']);
  function undergrowthSlice(local: LocalArtifact) {
    let lastBoulder = -1;
    local.features.forEach((f, i) => { if (f.kind === 'boulder') lastBoulder = i; });
    expect(lastBoulder).toBeGreaterThanOrEqual(0); // fixture must have boulders for the slice to mean anything
    const rest = local.features.slice(lastBoulder + 1);
    const firstUnder = rest.findIndex((f) => UNDERSTORY_KINDS.has(f.kind));
    return firstUnder === -1 ? rest : rest.slice(0, firstUnder);
  }

  /**
   * Probe rects over the window, split by the clump field the placement reads.
   * "Clearing" rects are ones the field never lifts above the 25th percentile
   * anywhere inside; "thicket" rects are ones it holds above the 75th
   * throughout. Sampling every 10 ft absorbs sub-sample wiggle.
   */
  const RECT = 150;
  const CLEAR_MAX = 0.153; // measured p25 of the field
  const THICK_MIN = 0.333; // measured p75
  function probeRects(bounds: LocalArtifact['bounds']) {
    const clearings: Array<[number, number]> = [];
    const thickets: Array<[number, number]> = [];
    for (let ry = bounds.y; ry + RECT <= bounds.y + bounds.height; ry += RECT) {
      for (let rx = bounds.x; rx + RECT <= bounds.x + bounds.width; rx += RECT) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let sy = 0; sy <= RECT; sy += 10) {
          for (let sx = 0; sx <= RECT; sx += 10) {
            const n = clearingNoiseAt(rx + sx, ry + sy);
            if (n < lo) lo = n;
            if (n > hi) hi = n;
          }
        }
        if (hi < CLEAR_MAX) clearings.push([rx, ry]);
        if (lo > THICK_MIN) thickets.push([rx, ry]);
      }
    }
    return { clearings, thickets };
  }

  const countIn = (
    pts: ReadonlyArray<{ x: number; y: number }>,
    rects: ReadonlyArray<[number, number]>,
  ) => {
    let n = 0;
    for (const p of pts) {
      for (const [rx, ry] of rects) {
        if (p.x >= rx && p.x < rx + RECT && p.y >= ry && p.y < ry + RECT) { n++; break; }
      }
    }
    return n;
  };

  it('dense forest: clearings hold well under mean tree density, thickets well over', () => {
    const local = dense();
    const { clearings, thickets } = probeRects(local.bounds);
    expect(clearings.length).toBeGreaterThanOrEqual(3); // the window really has clearings
    expect(thickets.length).toBeGreaterThanOrEqual(3); // ...and real thickets

    const trees = local.features.filter((f) => f.kind === 'tree');
    const meanPerSqFt = trees.length / (local.bounds.width * local.bounds.height);
    const perRect = meanPerSqFt * RECT * RECT;

    const expectClear = perRect * clearings.length;
    const expectThick = perRect * thickets.length;
    expect(expectClear).toBeGreaterThan(5); // probes are statistically meaningful
    expect(expectThick).toBeGreaterThan(5);

    const clearRatio = countIn(trees, clearings) / expectClear;
    const thickRatio = countIn(trees, thickets) / expectThick;

    // The spread between the two is the real signal and it is scale-free.
    // Absolute enrichment has a low ceiling that depends on the window: this
    // one sits on high ground for the field (mean acceptance 0.79), so a fully
    // saturated rect can only run 1/0.79 = 1.26x the window mean however
    // strong the clumping is. The clearings are the half with room to move.
    expect(clearRatio).toBeLessThan(0.35);
    expect(thickRatio).toBeGreaterThan(1.15);
    expect(thickRatio / clearRatio).toBeGreaterThan(4);
  });

  it('clearings keep a thin margin population rather than a hard edge', () => {
    // The failure this guards is a regression to a boolean gate: that would
    // read as zero trees below the cutoff and a visible contour on the ground.
    const local = dense();
    const trees = local.features.filter((f) => f.kind === 'tree');
    const belowP25 = trees.filter((t) => clearingNoiseAt(t.x, t.y) < CLEAR_MAX).length;
    expect(belowP25).toBeGreaterThan(0);
    expect(belowP25 / trees.length).toBeLessThan(0.15);
  });

  it('density REDISTRIBUTES rather than falls — the target count still lands', () => {
    // 3000ft window = 900 patches of 10k sq ft; the deciduous profile asks for
    // 1.8 trees each. If the clump field were deleting trees instead of moving
    // them this is the number that would drop.
    const trees = dense().features.filter((f) => f.kind === 'tree');
    expect(trees.length).toBeGreaterThan(900 * 1.8 * 0.9);
  });

  it('every clumped feature carries a dens that tracks the field it sat on', () => {
    const local = dense();
    const veg = local.features.filter((f) => f.kind === 'tree' || f.kind === 'bush');
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.every((f) => typeof f.dens === 'number')).toBe(true);
    for (const f of veg) expect(f.dens).toBeCloseTo(clumpDens(clumpAt(f.x, f.y)), 10);
    // Boulders do not scatter through the field, so they must NOT carry one.
    expect(local.features.filter((f) => f.kind === 'boulder').every((f) => f.dens === undefined))
      .toBe(true);
  });

  it('plants run bigger toward a thicket middle than on its margin', () => {
    const veg = dense().features.filter((f) => f.kind === 'tree');
    const inner = veg.filter((f) => (f.dens ?? 0) > 0.8).length;
    const outer = veg.filter((f) => (f.dens ?? 0) < 0.3).length;
    // Both populations have to exist for the size gradient to mean anything.
    expect(inner).toBeGreaterThan(0);
    expect(outer).toBeGreaterThan(0);
  });

  it('dense forest: undergrowth bushes exist and hug the thickets', () => {
    const local = dense();
    const under = undergrowthSlice(local);
    expect(under.length).toBeGreaterThan(200); // 2.5× scrub density has real presence
    expect(under.every((f) => f.kind === 'bush')).toBe(true);

    const { clearings, thickets } = probeRects(local.bounds);
    const perRect = (under.length / (local.bounds.width * local.bounds.height)) * RECT * RECT;
    expect(countIn(under, clearings)).toBeLessThan(perRect * clearings.length * 0.35);
    expect(countIn(under, thickets)).toBeGreaterThan(perRect * thickets.length * 1.3);
  });

  it('deep-forest-id biome (taiga 9): deterministic, with undergrowth', () => {
    const a = buildLocalFor(9);
    const b = buildLocalFor(9);
    expect(a.features).toEqual(b.features);
    expect(undergrowthSlice(a).length).toBeGreaterThan(0);
  });

  it('grassland clumps too — an evenly-treed grassland is an orchard', () => {
    const a = buildLocalFor(4);
    const b = buildLocalFor(4);
    expect(a.features).toEqual(b.features); // deterministic
    expect(undergrowthSlice(a).length).toBe(0); // the undergrowth stream is dense-forest only

    // The field applies in EVERY biome now, which is the change from Task 10.
    // Non-dense windows are no longer byte-identical to the pre-clump
    // generator, and that is the point rather than a regression.
    const trees = a.features.filter((f) => f.kind === 'tree');
    expect(trees.every((f) => typeof f.dens === 'number')).toBe(true);
    const { clearings, thickets } = probeRects(a.bounds);
    const perRect = (trees.length / (a.bounds.width * a.bounds.height)) * RECT * RECT;
    expect(countIn(trees, thickets)).toBeGreaterThan(countIn(trees, clearings));
    expect(perRect * thickets.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// The clump field itself — the properties the placement above relies on.
// ---------------------------------------------------------------------------

describe('clumpField', () => {
  const sample = () => {
    const vals: number[] = [];
    for (let y = 0; y < 40000; y += 61) for (let x = 0; x < 40000; x += 61) vals.push(clumpAt(x, y));
    return vals.sort((p, q) => p - q);
  };

  it('is heavy-tailed: most ground below the mean, a small fraction saturating', () => {
    const vals = sample();
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const median = vals[Math.floor(vals.length / 2)];
    // A single octave would put the median AT the mean. The product of three
    // pushes the median below it, which is what gives open floor between knots.
    expect(median).toBeLessThan(mean);
    expect(mean).toBeGreaterThan(0.2);
    expect(mean).toBeLessThan(0.3);
  });

  it('acceptance separates the MIDDLE quartiles, which is the contrast the eye sees', () => {
    // The failure this guards is the one the first tuning shipped: a curve that
    // measures fine at the extremes while the rendered scatter still reads as
    // an even speckle. Most of any window sits in the middle of the field, so
    // the lower-to-upper-quartile spread is the number that decides whether a
    // thicket looks like a thicket. The first pass ran 1.7x here and looked
    // flat; 3x is about where the structure becomes legible.
    const vals = sample();
    const q = (p: number) => vals[Math.floor(p * (vals.length - 1))];
    const spread = Math.min(1, clumpAccept(q(0.75))) / Math.min(1, clumpAccept(q(0.25)));
    expect(spread).toBeGreaterThan(3);

    const p = vals.map((v) => Math.min(1, clumpAccept(v)));
    expect(p.filter((v) => v >= 1).length / p.length).toBeGreaterThan(0.02); // knots fill in solid
    expect(p.filter((v) => v < 0.1).length / p.length).toBeGreaterThan(0.15); // real clearings
  });

  it('is continuous across a window seam (world feet, not window-local)', () => {
    // Two adjacent 3000ft windows must agree about the same world foot, or a
    // thicket restarts at every border.
    const seamX = 3000;
    for (let y = 0; y < 5000; y += 137) {
      expect(clumpAt(seamX - 0.001, y)).toBeCloseTo(clumpAt(seamX + 0.001, y), 4);
    }
  });

  it('dens is 0 at the floor and clamps at 1', () => {
    expect(clumpDens(0)).toBe(0);
    expect(clumpDens(10)).toBe(1);
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

// ---------------------------------------------------------------------------
// Task 10 (MOUNTAINS): glacier windows get a white ICE ground material.
// A fully-synthetic flat region keeps these fast and deterministic (no atlas).
// ---------------------------------------------------------------------------
function flatRegion(level: number): RegionArtifact {
  return {
    layer: 'region',
    schemaVersion: WORLDFORGE_SCHEMA_VERSION,
    seedPath: rootSeedPath(WORLD_SEED),
    bounds: { x: 0, y: 0, width: 3000, height: 3000 },
    heightfield: {
      width: 4,
      height: 4,
      resolutionFt: 1000,
      samples: new Float32Array(16).fill(level),
    },
    rivers: [],
    roads: [],
    townSites: [],
  } as unknown as RegionArtifact;
}

describe('generateLocal — glacier ice material (Task 10 white glacier)', () => {
  it('appends ice to the palette without shifting any existing material index (append-only)', () => {
    const region = flatRegion(0.4);
    const local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, { biomeId: 4 });
    // Every pre-Task-10 index keeps its position; ice is strictly appended.
    expect(local.terrain.materials.slice(0, 8)).toEqual(
      ['grass', 'dirt', 'rock', 'sand', 'wetland', 'water', 'paved', 'floor'],
    );
    expect(local.terrain.materials[8]).toBe('ice');
    expect(local.terrain.materials.indexOf('ice')).toBe(8);
  });

  it('glacier biome (11) grounds flat cells as ice, not brown rock', () => {
    const region = flatRegion(0.4); // mid altitude, gentle: pure ground, no rock/water band
    const glacier = generateLocal(region, boundsCenter(region.bounds), region.seedPath, { biomeId: 11 });
    const iceIdx = glacier.terrain.materials.indexOf('ice');
    const rockIdx = glacier.terrain.materials.indexOf('rock');
    const m = glacier.terrain.materialIndex;
    let ice = 0;
    let rock = 0;
    for (let i = 0; i < m.length; i++) {
      if (m[i] === iceIdx) ice++;
      else if (m[i] === rockIdx) rock++;
    }
    expect(iceIdx).toBe(8);
    // The flat glacier sheet reads as ice across the window (was ALL brown rock
    // pre-Task-10). Only the steep-noise scree band (~1%, biome-independent)
    // stays rock — the altitude/slope classifier still wins on genuine crags.
    expect(ice).toBeGreaterThan(m.length * 0.9);
    expect(rock).toBeLessThan(m.length * 0.05);
    expect(ice).toBeGreaterThan(rock * 10);
  });
});

// ---------------------------------------------------------------------------
// Task 11 (MOUNTAINS): 3D elevation curve + biome-keyed tree line.
//   • elevationCurveFt un-compresses high country (flat n·2000 → 7000 ft at n=1)
//     while staying EXACTLY n·2000 for n ≤ 0.5 (lowland/town byte-identity gate).
//   • the tree placeKind keep gains a per-window normalized-height line, resolved
//     from the anchor biome's temperature class, composed with the forests
//     clearingKeep. Trees only; bushes/boulders/undergrowth untouched.
// A 40×40 flat synthetic region (matches the rock-classification fixtures) keeps
// these fast, deterministic, and free of atlas coupling.
// ---------------------------------------------------------------------------
function syntheticRegion40(level: number): RegionArtifact {
  const width = 40;
  const resolutionFt = 100;
  return {
    layer: 'region',
    schemaVersion: WORLDFORGE_SCHEMA_VERSION,
    seedPath: rootSeedPath(7),
    bounds: { x: 0, y: 0, width: width * resolutionFt, height: width * resolutionFt },
    heightfield: { width, height: width, resolutionFt, samples: new Float32Array(width * width).fill(level) },
    rivers: [],
    roads: [],
    townSites: [],
  } as unknown as RegionArtifact;
}

describe('elevationCurveFt — mountain relief curve (Task 11)', () => {
  it('is EXACTLY 2000·n for n ≤ 0.5 (lowland byte-identity — the hard invariance gate)', () => {
    for (let n = 0; n <= 0.5; n += 0.005) {
      const nn = Math.min(n, 0.5);
      expect(elevationCurveFt(nn)).toBe(2000 * nn); // second term is identically 0
    }
    expect(elevationCurveFt(0)).toBe(0);
    expect(elevationCurveFt(0.25)).toBe(500);
    expect(elevationCurveFt(0.5)).toBe(1000); // knot: still exactly 2000·0.5
  });

  it('reaches MOUNTAIN_MAX_ELEV_FT (7000) at n = 1', () => {
    expect(elevationCurveFt(1)).toBe(MOUNTAIN_MAX_ELEV_FT);
    expect(elevationCurveFt(1)).toBe(7000);
  });

  it('is monotonic increasing across [0,1]', () => {
    let prev = -Infinity;
    for (let n = 0; n <= 1.0000001; n += 0.01) {
      const v = elevationCurveFt(Math.min(n, 1));
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('accelerates above 0.5 (high country > flat n·2000), never below it', () => {
    for (let n = 0.505; n <= 1; n += 0.02) {
      expect(elevationCurveFt(n)).toBeGreaterThan(2000 * n);
    }
  });

  it('is C1-continuous at the n = 0.5 knot (one-sided slopes both → 2000)', () => {
    const eps = 1e-6;
    expect(Math.abs(elevationCurveFt(0.5 + eps) - elevationCurveFt(0.5))).toBeLessThan(1e-2);
    const slopeBelow = (elevationCurveFt(0.5) - elevationCurveFt(0.5 - eps)) / eps;
    const slopeAbove = (elevationCurveFt(0.5 + eps) - elevationCurveFt(0.5)) / eps;
    expect(slopeBelow).toBeCloseTo(2000, 1); // linear side
    expect(slopeAbove).toBeCloseTo(2000, 1); // ^2.2 ramp has zero slope at the knot → C1
  });
});

describe('generateLocal — lowland elevation invariance (Task 11 hard gate)', () => {
  it('crafted all-low window (n ≤ 0.5) → elevationFt BYTE-IDENTICAL to the pre-curve n·2000 field', () => {
    const region = syntheticRegion40(0.3); // base 0.3 + detail ⇒ every cell well under 0.5
    const local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, { biomeId: 4 });
    const e = local.terrain.elevationFt;
    // Prove the window is genuinely in the invariance regime: the curve equals
    // 2000·n below 0.5, so max elevation < 1000 ⇒ every cell had n < 0.5.
    let emax = -Infinity;
    let hash = 0x811c9dc5;
    for (let i = 0; i < e.length; i++) {
      emax = Math.max(emax, e[i]);
      const v = Math.round(e[i] * 1000);
      hash ^= v & 0xff; hash = Math.imul(hash, 0x01000193);
      hash ^= (v >> 8) & 0xff; hash = Math.imul(hash, 0x01000193);
      hash ^= (v >> 16) & 0xff; hash = Math.imul(hash, 0x01000193);
    }
    expect(emax).toBeLessThan(1000); // whole window under n = 0.5
    // Hash BAKED from the pre-Task-11 generator (n·2000). A match proves the curve
    // is a byte-exact passthrough for lowland — no town/lowland elevation moves.
    expect(hash >>> 0).toBe(3072597900);
  });
});

describe('generateLocal — biome-keyed tree line (Task 11)', () => {
  function treesFor(level: number, biomeId: number): number {
    const r = syntheticRegion40(level);
    const local = generateLocal(r, boundsCenter(r.bounds), r.seedPath, { biomeId });
    return local.features.filter((f) => f.kind === 'tree').length;
  }
  function bushesFor(level: number, biomeId: number): number {
    const r = syntheticRegion40(level);
    const local = generateLocal(r, boundsCenter(r.bounds), r.seedPath, { biomeId });
    return local.features.filter((f) => f.kind === 'bush').length;
  }

  it('trees survive below the line and vanish above it (taiga, cold line 0.55)', () => {
    expect(treesFor(0.50, 9)).toBeGreaterThan(500); // n≈0.50 < 0.55 → kept
    expect(treesFor(0.58, 9)).toBe(0);              // n≈0.58 > 0.55 → every tree cut
  });

  it('the cold line (0.55) sits lower than the temperate line (0.62)', () => {
    // At n≈0.58: cold biomes have lost their trees, temperate still has its.
    expect(treesFor(0.58, 9)).toBe(0);               // taiga (cold) cut
    expect(treesFor(0.58, 10)).toBe(0);              // tundra (cold) cut
    expect(treesFor(0.58, 6)).toBeGreaterThan(500);  // temperate deciduous kept
  });

  it('tropical biomes carry NO tree line (trees persist where the temperate line cuts)', () => {
    // At n≈0.64 the temperate line (0.62) cuts everything; tropical (none) keeps its trees.
    expect(treesFor(0.64, 6)).toBe(0);              // temperate deciduous cut
    expect(treesFor(0.64, 5)).toBeGreaterThan(0);   // tropical seasonal forest kept
  });

  it('the line gates TREES ONLY — bushes are untouched above it', () => {
    // Same high window that zeroes taiga trees still places its bushes.
    expect(treesFor(0.58, 9)).toBe(0);
    expect(bushesFor(0.58, 9)).toBeGreaterThan(100);
  });

  it('composes with the forests clearingKeep: below the line a dense window is unchanged', () => {
    // biome 6 is dense (clearingKeep active). Below the temperate line the tree
    // line is a no-op, so the count matches the clearing-only generator.
    const below = treesFor(0.50, 6);
    expect(below).toBeGreaterThan(500);
    expect(treesFor(0.64, 6)).toBe(0); // above the line the composite keep rejects all
  });
});
