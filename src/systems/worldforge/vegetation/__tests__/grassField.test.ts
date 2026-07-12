import { describe, it, expect } from 'vitest';
import { buildGrassField, patchNoise2 } from '../grassField';

/** res x res grid terrain, flat at `height`, painted a single color. */
function makeTerrain(res: number, height: number, color: [number, number, number]) {
  const positions = new Float32Array(res * res * 3);
  const colors = new Float32Array(res * res * 3);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const idx = j * res + i;
      positions[idx * 3] = (i / (res - 1)) * 128;
      positions[idx * 3 + 1] = height;
      positions[idx * 3 + 2] = (j / (res - 1)) * 128;
      colors.set(color, idx * 3);
    }
  }
  return { positions, colors };
}

const OPTS = { chunkSize: 128, samples: 500 };

describe('grassField', () => {
  it('is deterministic for the same chunk', () => {
    const terrain = makeTerrain(17, 10, [0.25, 0.5, 0.2]);
    const a = buildGrassField(terrain, 3, 4, OPTS);
    const b = buildGrassField(terrain, 3, 4, OPTS);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(a.cacheKey).toBe(b.cacheKey);
  });

  it('differs between chunks', () => {
    const terrain = makeTerrain(17, 10, [0.25, 0.5, 0.2]);
    const a = buildGrassField(terrain, 3, 4, OPTS);
    const b = buildGrassField(terrain, 4, 4, OPTS);
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  it('grows on green terrain, at the surface height, inside the chunk', () => {
    const terrain = makeTerrain(17, 42.5, [0.25, 0.5, 0.2]);
    const f = buildGrassField(terrain, 0, 0, OPTS);
    // Patchy density field thins coverage, but full green should still keep
    // a healthy fraction of the requested budget.
    expect(f.count).toBeGreaterThan(250);
    expect(f.count).toBeLessThan(OPTS.samples * 1.6);
    for (let i = 0; i < f.count; i++) {
      expect(f.positions[i * 3]).toBeGreaterThanOrEqual(0);
      expect(f.positions[i * 3]).toBeLessThanOrEqual(128);
      expect(f.positions[i * 3 + 1]).toBeCloseTo(42.5, 5); // flat terrain: exact surface
      expect(f.positions[i * 3 + 2]).toBeGreaterThanOrEqual(0);
      expect(f.positions[i * 3 + 2]).toBeLessThanOrEqual(128);
      expect(f.scales[i]).toBeGreaterThan(0.5);
      expect(f.scales[i]).toBeLessThan(1.5);
    }
    expect(f.tints.length).toBe(f.count * 3);
  });

  it('skips non-green terrain (rock/sand/water paint)', () => {
    const rock = buildGrassField(makeTerrain(17, 10, [0.45, 0.42, 0.4]), 0, 0, OPTS);
    expect(rock.count).toBe(0);
    const sand = buildGrassField(makeTerrain(17, 10, [0.75, 0.68, 0.45]), 0, 0, OPTS);
    expect(sand.count).toBe(0);
    const water = buildGrassField(makeTerrain(17, 10, [0.18, 0.35, 0.6]), 0, 0, OPTS);
    expect(water.count).toBe(0);
  });

  it('has no diagonal-row structure (u,v decorrelated) and is patchy', () => {
    // Regression: the old hash left u,v affinely correlated — (v-u) mod 1
    // collapsed onto a handful of values, so tufts marched in dotted diagonal
    // lines. With decorrelated jitter the (v-u) mod 1 distribution must fill
    // the unit interval roughly uniformly.
    const terrain = makeTerrain(33, 0, [0.25, 0.5, 0.2]);
    const f = buildGrassField(terrain, 14, 8, { chunkSize: 128, samples: 2600 });
    expect(f.count).toBeGreaterThan(1200);
    const buckets = new Array(20).fill(0);
    for (let i = 0; i < f.count; i++) {
      const u = f.positions[i * 3] / 128;
      const v = f.positions[i * 3 + 2] / 128;
      const d = ((v - u) % 1 + 1) % 1;
      buckets[Math.min(19, Math.floor(d * 20))]++;
    }
    const nonEmpty = buckets.filter((b) => b > 0).length;
    expect(nonEmpty).toBe(20); // old sampler filled only ~4-6 buckets
    const max = Math.max(...buckets);
    expect(max).toBeLessThan(f.count * 0.25); // no dominant diagonal band

    // Patchiness: split the chunk into an 8x8 occupancy grid — densities
    // should vary meaningfully (clearings vs thickets), not be flat.
    const occ = new Array(64).fill(0);
    for (let i = 0; i < f.count; i++) {
      const gx = Math.min(7, Math.floor((f.positions[i * 3] / 128) * 8));
      const gz = Math.min(7, Math.floor((f.positions[i * 3 + 2] / 128) * 8));
      occ[gz * 8 + gx]++;
    }
    const mean = f.count / 64;
    expect(Math.min(...occ)).toBeLessThan(mean * 0.6);
    expect(Math.max(...occ)).toBeGreaterThan(mean * 1.4);
  });

  it('interpolates height on sloped terrain (no floating above vertices)', () => {
    const res = 17;
    const terrain = makeTerrain(res, 0, [0.25, 0.5, 0.2]);
    // Ramp: height = x coordinate.
    for (let v = 0; v < res * res; v++) {
      terrain.positions[v * 3 + 1] = terrain.positions[v * 3];
    }
    const f = buildGrassField(terrain, 1, 1, OPTS);
    expect(f.count).toBeGreaterThan(0);
    for (let i = 0; i < f.count; i++) {
      expect(f.positions[i * 3 + 1]).toBeCloseTo(f.positions[i * 3], 4);
    }
  });
});

describe('patchNoise2 — the shared patch/clearing noise (forests Task 10)', () => {
  // Tree thickets (generateLocal) and grass patchiness read the SAME exported
  // field so clearings in the canopy line up with gaps in the grass. These pin
  // the properties the clearing gate relies on.
  it('is deterministic and stays inside [0,1]', () => {
    const a = patchNoise2(263.7, 76.2, 7031, 3);
    expect(patchNoise2(263.7, 76.2, 7031, 3)).toBe(a);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const v = patchNoise2(i * 0.137, i * 0.091, 7031, 3);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.4); // a real field, not a constant
  });

  it('is smooth — a pure function of world-space coords, so adjacent local windows continue the field', () => {
    // The clearing gate samples world feet / 1000. Purity in (u, v) means two
    // windows evaluating the same world foot get the same value by
    // construction; smoothness means the gate carves coherent clearings, not
    // per-sample speckle. Smoothstep-lerped value noise at freq 3 moves well
    // under 0.06 across a 2ft step (0.002 in u).
    for (let i = 0; i < 500; i++) {
      const u = 100 + i * 0.53;
      const v = 40 + i * 0.29;
      const du = Math.abs(patchNoise2(u + 0.002, v, 7031, 3) - patchNoise2(u, v, 7031, 3));
      const dv = Math.abs(patchNoise2(u, v + 0.002, 7031, 3) - patchNoise2(u, v, 7031, 3));
      expect(du).toBeLessThan(0.06);
      expect(dv).toBeLessThan(0.06);
    }
  });

  it('different salts give decorrelated fields', () => {
    let near = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const u = i * 0.31;
      const v = i * 0.17;
      if (Math.abs(patchNoise2(u, v, 7031, 3) - patchNoise2(u, v, 999, 3)) < 0.02) near++;
    }
    expect(near).toBeLessThan(N * 0.15);
  });
});
