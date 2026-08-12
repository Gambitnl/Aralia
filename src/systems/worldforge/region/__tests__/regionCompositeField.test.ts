// src/systems/worldforge/region/__tests__/regionCompositeField.test.ts
//
// Gates for the region-weighted composite height field:
//   1. Determinism — the same (atlas, cell, window) gives a byte-identical grid.
//   2. Seam — two overlapping windows agree exactly, and the field is continuous
//      across a window boundary.
//   3. Atlas authority — the window mean tracks the atlas cell value.
import { describe, it, expect } from 'vitest';
import {
  makeNormalizedMasks,
  makeCompositeHeightField,
  buildWindowComposite,
  rasterizeComposite,
  regionProfileFor,
  heightClassOf,
  computeRegionSpacingFt,
  makePeakOperator,
  makeDuneOperator,
  makeTerraceOperator,
  makeErosionOperator,
  MASK_RADIUS_SPACINGS,
  TERRACE_STEP,
  type RegionSource,
  type WindowFt,
} from '../regionCompositeField';

const SEED = 903674813;
const FEET_PER_PIXEL = 400;

/**
 * A synthetic atlas: a jittered 12x12 point lattice with a mountain ridge, a
 * plain, and a coast. Deterministic by construction — no RNG.
 */
function makeSyntheticAtlas(): {
  points: Array<[number, number]>;
  heights: Uint8Array;
  biomes: Uint8Array;
} {
  const N = 12;
  const points: Array<[number, number]> = [];
  const heights = new Uint8Array(N * N);
  const biomes = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const id = j * N + i;
      // Deterministic jitter so the layout is not a perfect grid.
      const jx = ((id * 37) % 11) / 11 - 0.5;
      const jy = ((id * 53) % 13) / 13 - 0.5;
      points.push([(i + 0.5 + jx * 0.4) * 100, (j + 0.5 + jy * 0.4) * 100]);
      // Left third: ocean and coast. Middle: plain. Right third: mountains.
      let h: number;
      let b: number;
      if (i < 3) { h = 6 + i * 6; b = 0; }            // 6..18, marine
      else if (i === 3) { h = 24; b = 4; }             // coastal grassland
      else if (i < 8) { h = 26 + (i - 4) * 2; b = 4; } // plain
      else { h = 45 + (i - 8) * 14; b = 10; }          // rising to alpine tundra
      heights[id] = Math.min(99, h);
      biomes[id] = b;
    }
  }
  return { points, heights, biomes };
}

const ATLAS = makeSyntheticAtlas();

function windowAt(cx: number, cy: number, resolutionFt = 100): WindowFt {
  const half = 25_000 / 2;
  return {
    // Snap to the global lattice, exactly as computeRegionBounds does.
    x: Math.round((cx - half) / resolutionFt) * resolutionFt,
    y: Math.round((cy - half) / resolutionFt) * resolutionFt,
    width: 25_000,
    height: 25_000,
  };
}

function buildBounds(bounds: WindowFt, resolutionFt = 100) {
  const built = buildWindowComposite(
    ATLAS.points, ATLAS.heights, ATLAS.biomes, FEET_PER_PIXEL, SEED, bounds, resolutionFt,
  );
  return { bounds, ...built };
}

function buildAt(cellId: number, resolutionFt = 100) {
  const p = ATLAS.points[cellId];
  return buildBounds(
    windowAt(p[0] * FEET_PER_PIXEL, p[1] * FEET_PER_PIXEL, resolutionFt),
    resolutionFt,
  );
}

/** A window shifted by `dxFt` from the given cell's window — a real neighbor. */
function buildShifted(cellId: number, dxFt: number, dyFt = 0) {
  const p = ATLAS.points[cellId];
  const b = windowAt(p[0] * FEET_PER_PIXEL, p[1] * FEET_PER_PIXEL);
  return buildBounds({ ...b, x: b.x + dxFt, y: b.y + dyFt });
}

// Cell ids on the three terrain kinds the visual gate also inspects.
const COAST_CELL = 6 * 12 + 3;
const PLAIN_CELL = 6 * 12 + 6;
const MOUNTAIN_CELL = 6 * 12 + 10;

describe('region composite height field — masks', () => {
  const SRC: RegionSource[] = [
    { id: 0, x: 0, y: 0, h: 0.2, biomeId: 4 },
    { id: 1, x: 10000, y: 0, h: 0.8, biomeId: 10 },
    { id: 2, x: 0, y: 10000, h: 0.5, biomeId: 4 },
    { id: 3, x: 10000, y: 10000, h: 0.3, biomeId: 4 },
  ];

  it('normalizes to a partition of unity at every point', () => {
    const masks = makeNormalizedMasks(SRC, 20000);
    for (let x = 0; x <= 10000; x += 617) {
      for (let y = 0; y <= 10000; y += 911) {
        const m = masks(x, y);
        let sum = 0;
        for (let i = 0; i < m.weight.length; i++) sum += m.weight[i];
        expect(sum).toBeCloseTo(1, 12);
      }
    }
  });

  it('is a delta on a region center', () => {
    const masks = makeNormalizedMasks(SRC, 20000);
    const m = masks(10000, 0);
    expect(m.index.length).toBe(1);
    expect(m.index[0]).toBe(1);
    expect(m.weight[0]).toBe(1);
  });

  it('rejects an unsorted source list rather than silently reordering the sum', () => {
    expect(() => makeNormalizedMasks([SRC[1], SRC[0]], 20000)).toThrow(/ascending id/);
  });

  it('throws rather than guessing when no region is in range', () => {
    const masks = makeNormalizedMasks(SRC, 100);
    expect(() => masks(500000, 500000)).toThrow(/no region within mask radius/);
  });

  it('drops a region to exactly zero at the mask radius, with no step', () => {
    const two: RegionSource[] = [
      { id: 0, x: 0, y: 0, h: 0.4, biomeId: 4 },
      { id: 1, x: 9000, y: 0, h: 0.9, biomeId: 4 },
    ];
    const masks = makeNormalizedMasks(two, 5000);
    // Region 1 enters the neighborhood at x = 4,000 (9,000 - 5,000 radius).
    expect(masks(3999, 0).index.length).toBe(1);
    expect(masks(4001, 0).index.length).toBe(2);
    // The weight it carries the instant it arrives must be ~0, so the field
    // does not step when it joins. This is the boundary softening.
    const entering = masks(4001, 0);
    expect(entering.weight[1]).toBeLessThan(1e-6);
  });
});

describe('region composite height field — profiles and operators', () => {
  it('classes height into the documented bands', () => {
    expect(heightClassOf(0.1)).toBe('water');
    expect(heightClassOf(0.3)).toBe('lowland');
    expect(heightClassOf(0.5)).toBe('upland');
    expect(heightClassOf(0.6)).toBe('highland');
    expect(heightClassOf(0.9)).toBe('alpine');
  });

  it('gives a desert lowland dunes and little erosion, a wet upland the reverse', () => {
    const desert = regionProfileFor(1, 0.3);
    const wet = regionProfileFor(12, 0.5);
    expect(desert.operatorWeights.dune).toBeGreaterThan(0);
    expect(wet.operatorWeights.dune).toBeUndefined();
    expect(wet.operatorWeights.erosion!).toBeGreaterThan(desert.operatorWeights.erosion!);
  });

  it('gives peaks only to high country', () => {
    expect(regionProfileFor(4, 0.3).operatorWeights.peak).toBeUndefined();
    expect(regionProfileFor(4, 0.9).operatorWeights.peak).toBeGreaterThan(0);
  });

  it('keeps every operator inside its documented range', () => {
    const peak = makePeakOperator(SEED);
    const dune = makeDuneOperator(SEED);
    const terrace = makeTerraceOperator();
    const erosion = makeErosionOperator(SEED);
    for (let x = 0; x < 20000; x += 337) {
      const h = 0.55;
      expect(Math.abs(peak(x, x * 0.7, h))).toBeLessThanOrEqual(1.0001);
      expect(Math.abs(dune(x, x * 0.7, h))).toBeLessThanOrEqual(1.0001);
      expect(Math.abs(terrace(x, x * 0.7, h))).toBeLessThanOrEqual(1.0001);
      const e = erosion(x, x * 0.7, h);
      expect(e).toBeLessThanOrEqual(0);
      expect(e).toBeGreaterThanOrEqual(-1.0001);
    }
  });

  it('produces a terrace pull that vanishes on a step boundary', () => {
    const terrace = makeTerraceOperator();
    // A height that is an exact multiple of the step needs no pull.
    expect(Math.abs(terrace(0, 0, TERRACE_STEP * 7))).toBeLessThan(1e-9);
  });

  it('makes each operator actually change the surface', () => {
    const dune = makeDuneOperator(SEED);
    const vals = new Set<number>();
    for (let x = 0; x < 5000; x += 100) vals.add(dune(x, 0, 0.3));
    expect(vals.size).toBeGreaterThan(10);
  });
});

// Rasterizing a 250x250 window is real work (tens of regions x 62,500 samples),
// so the window-level suites get a timeout that fits the job.
const WINDOW_TIMEOUT = 60_000;

// ── GATE 1: determinism ──────────────────────────────────────────────────────
describe('GATE 1 — determinism', () => {
  it('produces a byte-identical grid for the same atlas, cell and window', () => {
    const a = buildAt(MOUNTAIN_CELL);
    const b = buildAt(MOUNTAIN_CELL);
    expect(a.heightfield.width).toBe(250);
    expect(a.heightfield.height).toBe(250);
    expect(new Uint8Array(a.heightfield.samples.buffer)).toEqual(
      new Uint8Array(b.heightfield.samples.buffer),
    );
  }, WINDOW_TIMEOUT);

  it('is byte-identical across all three terrain kinds', () => {
    for (const cell of [COAST_CELL, PLAIN_CELL, MOUNTAIN_CELL]) {
      const a = buildAt(cell).heightfield.samples;
      const b = buildAt(cell).heightfield.samples;
      expect(new Uint8Array(a.buffer)).toEqual(new Uint8Array(b.buffer));
    }
  }, WINDOW_TIMEOUT);
});

// ── GATE 2: seam ─────────────────────────────────────────────────────────────
describe('GATE 2 — seam', () => {
  it('gives bit-equal values where two neighboring windows overlap', () => {
    const left = buildAt(PLAIN_CELL);
    // A window shifted by half a window: the streamer's real hand-off case.
    const right = buildShifted(PLAIN_CELL, 12_500, 0);
    // Overlap region of the two windows.
    const x0 = Math.max(left.bounds.x, right.bounds.x);
    const x1 = Math.min(left.bounds.x + left.bounds.width, right.bounds.x + right.bounds.width);
    const y0 = Math.max(left.bounds.y, right.bounds.y);
    const y1 = Math.min(left.bounds.y + left.bounds.height, right.bounds.y + right.bounds.height);
    expect(x1).toBeGreaterThan(x0);
    let checked = 0;
    for (let x = x0; x <= x1; x += 700) {
      for (let y = y0; y <= y1; y += 700) {
        expect(left.field.sample(x, y)).toBe(right.field.sample(x, y));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  }, WINDOW_TIMEOUT);

  it('has no discontinuity on a traverse across a window boundary', () => {
    const left = buildAt(PLAIN_CELL);
    const edge = left.bounds.x + left.bounds.width;
    const y = left.bounds.y + left.bounds.height / 2;
    // A 2 ft step across a 4,000 ft traverse that spans the boundary.
    const STEP = 2;
    let maxJump = 0;
    let prev = left.field.sample(edge - 2000, y);
    for (let x = edge - 2000 + STEP; x <= edge + 2000; x += STEP) {
      const v = left.field.sample(x, y);
      maxJump = Math.max(maxJump, Math.abs(v - prev));
      prev = v;
    }
    // 2 ft of travel must not move the normalized height by more than a
    // continuous surface can. 0.002 normalized is a very steep but real slope.
    expect(maxJump).toBeLessThan(0.002);
  }, WINDOW_TIMEOUT);

  it('has no jump when the window that evaluates the point changes', () => {
    const left = buildAt(PLAIN_CELL);
    // The next window along, sharing an edge with this one.
    const right = buildShifted(PLAIN_CELL, 25_000, 0);
    const edge = left.bounds.x + left.bounds.width;
    const y = left.bounds.y + left.bounds.height / 2;
    // Walk left-window samples up to the edge, then continue in the right
    // window. The hand-off must not show a step.
    const before = left.field.sample(edge - 2, y);
    const at = left.field.sample(edge, y);
    const after = right.field.sample(edge + 2, y);
    expect(right.field.sample(edge, y)).toBe(at);
    expect(Math.abs(at - before)).toBeLessThan(0.002);
    expect(Math.abs(after - at)).toBeLessThan(0.002);
  }, WINDOW_TIMEOUT);

  it('agrees between a 100 ft window grid and a 50 ft one at shared points', () => {
    const coarse = buildAt(PLAIN_CELL, 100);
    const fine = buildAt(PLAIN_CELL, 50);
    for (let i = 0; i < 20; i++) {
      const x = coarse.bounds.x + i * 1000;
      const y = coarse.bounds.y + i * 700;
      expect(coarse.field.sample(x, y)).toBe(fine.field.sample(x, y));
    }
  }, WINDOW_TIMEOUT);
});

// ── GATE 3 support: atlas authority ──────────────────────────────────────────
describe('atlas authority', () => {
  it('keeps the window mean close to the atlas value under the window', () => {
    for (const cell of [COAST_CELL, PLAIN_CELL, MOUNTAIN_CELL]) {
      const { heightfield } = buildAt(cell);
      let sum = 0;
      for (let i = 0; i < heightfield.samples.length; i++) sum += heightfield.samples[i];
      const mean = sum / heightfield.samples.length;
      // The window is far wider than one atlas cell, so the reference is the
      // mask-weighted atlas mean over the window, not one cell's height.
      const atlasMean = atlasWeightedMean(cell);
      if (atlasMean <= 0.7) {
        // Below the summit knee the composite is unbiased: the zero-mean
        // correction returns the atlas value.
        expect(Math.abs(mean - atlasMean)).toBeLessThan(0.03);
      } else {
        // Above 0.7 the soft knee deliberately compresses, exactly as
        // generateHeightfield does, so summits stay ordered instead of
        // clipping into one co-planar mesa. The field may therefore sit BELOW
        // the atlas mean. It must never sit above it, and never by much.
        expect(mean).toBeLessThan(atlasMean);
        expect(atlasMean - mean).toBeLessThan(0.12);
      }
    }
  }, WINDOW_TIMEOUT);

  it('reproduces the atlas ordering: coast below plain below mountain', () => {
    const means = [COAST_CELL, PLAIN_CELL, MOUNTAIN_CELL].map((c) => {
      const { heightfield } = buildAt(c);
      let sum = 0;
      for (let i = 0; i < heightfield.samples.length; i++) sum += heightfield.samples[i];
      return sum / heightfield.samples.length;
    });
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
  }, WINDOW_TIMEOUT);

  it('gives each terrain kind visibly different relief', () => {
    const sd = [COAST_CELL, PLAIN_CELL, MOUNTAIN_CELL].map((c) => {
      const { heightfield } = buildAt(c);
      const s = heightfield.samples;
      let sum = 0;
      for (let i = 0; i < s.length; i++) sum += s[i];
      const m = sum / s.length;
      let v = 0;
      for (let i = 0; i < s.length; i++) v += (s[i] - m) * (s[i] - m);
      return Math.sqrt(v / s.length);
    });
    // The mountain window must be rougher than the plain window.
    expect(sd[2]).toBeGreaterThan(sd[1]);
    // Every window must have real structure, not a flat slab.
    for (const s of sd) expect(s).toBeGreaterThan(0.005);
  }, WINDOW_TIMEOUT);
});

/** Mask-weighted mean of the ATLAS heights over the window — the reference. */
function atlasWeightedMean(cellId: number): number {
  const p = ATLAS.points[cellId];
  const bounds = windowAt(p[0] * FEET_PER_PIXEL, p[1] * FEET_PER_PIXEL);
  const maskRadiusFt = MASK_RADIUS_SPACINGS * computeRegionSpacingFt(ATLAS.points, FEET_PER_PIXEL);
  const sources: RegionSource[] = [];
  for (let id = 0; id < ATLAS.points.length; id++) {
    const q = ATLAS.points[id];
    const x = q[0] * FEET_PER_PIXEL;
    const y = q[1] * FEET_PER_PIXEL;
    if (
      x < bounds.x - maskRadiusFt || x > bounds.x + bounds.width + maskRadiusFt ||
      y < bounds.y - maskRadiusFt || y > bounds.y + bounds.height + maskRadiusFt
    ) continue;
    sources.push({ id, x, y, h: ATLAS.heights[id] / 100, biomeId: ATLAS.biomes[id] });
  }
  const masks = makeNormalizedMasks(sources, maskRadiusFt);
  let acc = 0;
  let n = 0;
  for (let row = 0; row < 250; row++) {
    for (let col = 0; col < 250; col++) {
      const m = masks(bounds.x + col * 100, bounds.y + row * 100);
      let h = 0;
      for (let i = 0; i < m.index.length; i++) h += m.weight[i] * sources[m.index[i]].h;
      acc += h;
      n++;
    }
  }
  return acc / n;
}

describe('rasterizer', () => {
  it('produces the SPEC 250x250 @100 ft L1 grid', () => {
    const { heightfield } = buildAt(PLAIN_CELL);
    expect(heightfield.width).toBe(250);
    expect(heightfield.height).toBe(250);
    expect(heightfield.resolutionFt).toBe(100);
    expect(heightfield.samples.length).toBe(62500);
  }, WINDOW_TIMEOUT);

  it('clamps every sample into 0..1', () => {
    for (const cell of [COAST_CELL, PLAIN_CELL, MOUNTAIN_CELL]) {
      const { heightfield } = buildAt(cell);
      for (let i = 0; i < heightfield.samples.length; i++) {
        expect(heightfield.samples[i]).toBeGreaterThanOrEqual(0);
        expect(heightfield.samples[i]).toBeLessThanOrEqual(1);
      }
    }
  }, WINDOW_TIMEOUT);

  it('rasterizes the same values the point sampler returns', () => {
    const { field, bounds } = buildAt(PLAIN_CELL);
    const hf = rasterizeComposite(field, bounds, 100);
    for (let i = 0; i < 50; i++) {
      const col = (i * 7) % 250;
      const row = (i * 13) % 250;
      expect(hf.samples[row * 250 + col]).toBe(
        Math.fround(field.sample(bounds.x + col * 100, bounds.y + row * 100)),
      );
    }
  }, WINDOW_TIMEOUT);
});

describe('composite plumbing', () => {
  it('zero-means each region so the atlas owns the mean', () => {
    const src: RegionSource[] = [{ id: 0, x: 0, y: 0, h: 0.6, biomeId: 10 }];
    const f = makeCompositeHeightField(src, 8000, SEED);
    expect(f.meanVariation.length).toBe(1);
    expect(Number.isFinite(f.meanVariation[0])).toBe(true);
    // The single region's mask is 1 everywhere in range, so the mean over its
    // own lattice must land on the atlas height.
    let acc = 0;
    let n = 0;
    for (let iy = 0; iy < 5; iy++) {
      for (let ix = 0; ix < 5; ix++) {
        acc += f.sample(-4000 + ix * 2000, -4000 + iy * 2000);
        n++;
      }
    }
    expect(Math.abs(acc / n - 0.6)).toBeLessThan(0.02);
  });
});
