/**
 * @file oceanBeachMath.test.ts — the beach's physics without a renderer: the
 * sand's water numbers come from the registry, a lake at rest stays at rest,
 * every drop is booked, a restored checkpoint reproduces a continuous run bit
 * for bit, the swash runs up about as far as Stockdon's law says, the sheet
 * soaks in and the sand dries top first, the debris moves as its forces
 * say, and the CPU sea at the grid's edge is the GPU sea's own series.
 */
import { describe, expect, it } from 'vitest';
import { Material } from '../../../worldforge/terrain/voxelVolume';
import { SUBSTANCES } from '../../../worldforge/terrain/materials';
import {
  BEACH_SAND,
  BeachClock,
  BeachDebris,
  DEBRIS_STRIDE,
  GRAIN_DENSITY_KG_M3,
  IncidentWaves,
  SwashField,
  SWASH_TILE_N,
  buildSwashFoamTile,
  conductivity,
  equilibriumSaturation,
  stockdonRunup2,
  suction,
  swashFoamCover,
  toHalf,
  type SwashGridSpec,
} from '../oceanBeachMath';
import { LAGOON_CAY, LAGOON_CAY_SEABED, LAGOON_SEABED, islandFrameAt, islandHeightAt, seabedPointAt } from '../oceanSeabedMath';
import { buildCascadeSpectrum } from '../oceanSpectrum';
import { realizeCascade } from '../oceanFieldReference';
import { oceanSeaState } from '../oceanSeaStates';

/** A planar beach of slope `beta` on a small grid, and the field over it. */
function planarBeach(opts: {
  ns?: number; na?: number; beta?: number; s0?: number; ds?: number;
  wave?: (t: number) => number;
}) {
  const ns = opts.ns ?? 96;
  const na = opts.na ?? 4;
  const ds = opts.ds ?? 0.125;
  const s0 = opts.s0 ?? -6;
  const beta = opts.beta ?? 1 / 11;
  const grid: SwashGridSpec = { s0, ds, ns, a0: 0, da: 0.5, na };
  const bed = new Float64Array(ns * na);
  const shore = new Float64Array(ns * na);
  for (let j = 0; j < na; j += 1) {
    for (let i = 0; i < ns; i += 1) {
      const s = s0 + (i + 0.5) * ds;
      bed[j * ns + i] = beta * s;
      shore[j * ns + i] = s;
    }
  }
  const wave = opts.wave ?? (() => 0);
  const field = new SwashField({
    grid, bed, shoreDist: shore, dt: 1 / 100,
    incident: (t, out) => { for (let j = 0; j < na; j += 1) out[j] = wave(t); },
  });
  return { field, grid, beta };
}

describe('the sand', () => {
  it('takes its conductivity and porosity from the registry', () => {
    const sand = SUBSTANCES[Material.Sand];
    expect(BEACH_SAND.ksMS).toBe(sand.permeabilityMS);
    expect(BEACH_SAND.thetaS).toBeCloseTo(1 - sand.densityKgM3 / GRAIN_DENSITY_KG_M3, 12);
    expect(conductivity(BEACH_SAND, 1)).toBeCloseTo(sand.permeabilityMS, 15);
  });

  it('holds the Brooks-Corey curves: full suction at air entry, conductivity falling as Se^6.38', () => {
    expect(suction(BEACH_SAND, 1)).toBeCloseTo(BEACH_SAND.psiBM, 12);
    const k5 = conductivity(BEACH_SAND, 0.5) / BEACH_SAND.ksMS;
    expect(k5).toBeCloseTo(0.5 ** (3 + 2 / BEACH_SAND.lambda), 12);
    // Saturated inside the capillary fringe, drier with height over it.
    expect(equilibriumSaturation(BEACH_SAND, 0.05)).toBe(1);
    expect(equilibriumSaturation(BEACH_SAND, 0.5)).toBeLessThan(equilibriumSaturation(BEACH_SAND, 0.2));
  });
});

describe('the swash field', () => {
  it('keeps a lake at rest at rest over the sloped bed', () => {
    const { field } = planarBeach({});
    const h0 = field.h.slice();
    for (let k = 0; k < 300; k += 1) field.advance();
    let maxDh = 0;
    let maxU = 0;
    for (let c = 0; c < field.h.length; c += 1) {
      maxDh = Math.max(maxDh, Math.abs(field.h[c] - h0[c]));
      maxU = Math.max(maxU, Math.abs(field.hu[c]));
    }
    expect(maxDh).toBeLessThan(1e-9);
    expect(maxU).toBeLessThan(1e-9);
  });

  it('books every drop: arrived = the change in sheet and sand + drained + evaporated', () => {
    const { field } = planarBeach({ wave: (t) => 0.2 * Math.sin((2 * Math.PI * t) / 6) });
    const v0 = field.sheetVolume() + field.soakedVolume();
    for (let k = 0; k < 2000; k += 1) field.advance();
    const l = field.ledger;
    const lhs = field.sheetVolume() + field.soakedVolume() - v0 + l.drained + l.evaporated;
    expect(Math.abs(lhs - l.arrived)).toBeLessThan(1e-9 * Math.max(1, Math.abs(l.inflow)));
    expect(l.clipped).toBe(0);
    expect(l.infiltrated).toBeGreaterThan(0);
  });

  it('reproduces a continuous run bit for bit from a checkpoint', () => {
    const wave = (t: number) => 0.25 * Math.sin((2 * Math.PI * t) / 5) + 0.05 * Math.sin(t * 3.1);
    const a = planarBeach({ wave });
    const b = planarBeach({ wave });
    const noDebris = { data: new Float64Array(0), restore() {}, step() {}, reset() {} };
    for (let k = 0; k < 1234; k += 1) a.field.advance();
    // b runs to a step that is not a multiple of the slow update, checkpoints,
    // runs on, jumps back to the checkpoint, and catches up.
    for (let k = 0; k < 701; k += 1) b.field.advance();
    const snap = b.field.snapshot(new Float64Array(0));
    for (let k = 0; k < 300; k += 1) b.field.advance();
    b.field.restore(snap);
    for (let k = 701; k < 1234; k += 1) b.field.advance();
    for (const key of ['h', 'hu', 'hv', 'w1', 'w2', 'foam', 'strand', 'mark', 'sed'] as const) {
      expect(Array.from(b.field[key])).toEqual(Array.from(a.field[key]));
    }
    expect(b.field.ledger).toEqual(a.field.ledger);
    // The clock makes the same promise across a jump back in time.
    const c = planarBeach({ wave });
    const clock = new BeachClock(c.field, noDebris, 3);
    clock.advanceTo(12.34);
    clock.advanceTo(4.0);
    clock.advanceTo(12.34);
    expect(Array.from(c.field.h)).toEqual(Array.from(a.field.h));
  });

  it('runs up about as far as Stockdon et al. (2006) say', () => {
    // A regular 0.4 m, 8 s wave on a 1:11 face; the top 2% of the run-up
    // heights (the edge where the sheet is 1 cm deep) against R2. Their fit's
    // own scatter is about a third of the value.
    const H = 0.4;
    const T = 8;
    const { field, grid, beta } = planarBeach({ ns: 144, s0: -7, wave: (t) => (H / 2) * Math.sin((2 * Math.PI * t) / T) });
    const heights: number[] = [];
    for (let k = 0; k < 60 / field.dt; k += 1) {
      field.advance();
      if (k * field.dt > 25 && k % 5 === 0) {
        let s = grid.s0;
        for (let i = grid.ns - 1; i >= 0; i -= 1) if (field.h[grid.ns + i] > 0.01) { s = grid.s0 + (i + 1) * grid.ds; break; }
        heights.push(s * beta);
      }
    }
    heights.sort((x, y) => x - y);
    const r2 = heights[Math.floor(heights.length * 0.98)];
    const ref = stockdonRunup2(H, T, beta).r2;
    expect(r2).toBeGreaterThan(ref * 0.67);
    expect(r2).toBeLessThan(ref * 1.33);
  });
});

describe('the sand soaks and dries', () => {
  it('soaks a sheet on dry sand faster than gravity alone, and books it', () => {
    const { field, grid } = planarBeach({ ns: 64, s0: 2 });
    // A 5 mm sheet on sand 0.2 to 0.8 m up, still (a thin pour).
    const c = grid.ns + 20;
    const w0 = field.w1[c] + field.w2[c];
    field.h[c] = 0.005;
    for (let k = 0; k < 100; k += 1) field.advance();
    const soaked = field.w1[c] + field.w2[c] - w0;
    // In one second: more than Ks alone would pass (0.1 mm), no more than
    // the sheet held.
    expect(soaked).toBeGreaterThan(BEACH_SAND.ksMS * 1.0);
    expect(soaked).toBeLessThanOrEqual(0.005 + 1e-12);
  });

  it('dries the top of the beach first', () => {
    const { field, grid } = planarBeach({ ns: 80, s0: 1 });
    // Wet a low cell and a high cell's skin to saturation, then let them drain.
    const low = grid.ns * 1 + 20;
    const high = grid.ns * 1 + 70;
    field.w1[low] = field.cap1[low];
    field.w1[high] = field.cap1[high];
    for (let k = 0; k < 120 / field.dt; k += 1) field.advance();
    expect(field.skinSaturation(high)).toBeLessThan(field.skinSaturation(low));
    expect(field.skinSaturation(high)).toBeLessThan(0.9);
  });
});

describe('the debris', () => {
  it('moves light things more than heavy ones in the same sheet', () => {
    const { field, grid } = planarBeach({ ns: 64, s0: 0, beta: 0 });
    const debris = new BeachDebris({
      grid, seed: 7, counts: { shell: 1, stick: 1, weed: 1 },
      sRange: [3, 3], aRange: [1, 1], wrackS: 3, wrackShare: 0,
    });
    // A uniform 4 cm sheet flowing onshore at 0.35 m/s.
    for (let c = 0; c < field.h.length; c += 1) { field.h[c] = 0.04; field.hu[c] = 0.04 * 0.35; }
    for (let k = 0; k < 50; k += 1) debris.step(field, 0.01);
    const moved = (i: number) => debris.data[i * DEBRIS_STRIDE + 6];
    const byKind = Object.fromEntries(debris.items.map((it, i) => [it.kind, moved(i)]));
    expect(byKind.weed).toBeGreaterThan(byKind.shell);
    expect(byKind.stick).toBeGreaterThan(byKind.shell);
    // The stick is lighter than water in a sheet deeper than itself: afloat.
    const stickI = debris.items.findIndex((it) => it.kind === 'stick');
    const it = debris.items[stickI];
    if (it.heightM < 0.04) expect(debris.data[stickI * DEBRIS_STRIDE + 7]).toBe(1);
  });

  it('holds a shell still on dry sand and under a slow sheet', () => {
    const { field, grid } = planarBeach({ ns: 64, s0: 0 });
    const debris = new BeachDebris({
      grid, seed: 3, counts: { shell: 4, stick: 0, weed: 0 },
      sRange: [4, 5], aRange: [1, 1], wrackS: 3, wrackShare: 0,
    });
    for (let k = 0; k < 100; k += 1) debris.step(field, 0.01);
    for (let i = 0; i < 4; i += 1) expect(debris.data[i * DEBRIS_STRIDE + 6]).toBe(0);
    for (let c = 0; c < field.h.length; c += 1) { field.h[c] = 0.02; field.hu[c] = 0.02 * 0.1; }
    for (let k = 0; k < 100; k += 1) debris.step(field, 0.01);
    for (let i = 0; i < 4; i += 1) expect(debris.data[i * DEBRIS_STRIDE + 6]).toBe(0);
  });
});

describe('the sea at the grid edge', () => {
  it('is the GPU cascade series: all modes summed match the CPU FFT reference at grid points', () => {
    const cascades = oceanSeaState('shallow');
    const n = 32;
    const ci = cascades.findIndex((c) => c.name === 'swell');
    const c = cascades[ci];
    const seed = 0x0cea9;
    const e = c.patchM / n;
    const px = new Float64Array([0, 3 * e, 17 * e]);
    const pz = new Float64Array([0, 5 * e, 29 * e]);
    const waves = new IncidentWaves({ cascades, n, seed, use: ['swell'], share: 1, maxModes: Infinity, px, pz });
    const out = new Float64Array(3);
    const t = 42;
    waves.heights(t, out);
    const ref = realizeCascade(buildCascadeSpectrum(c, n, (seed ^ (ci * 0x9e3779b9)) >>> 0), t);
    const at = (x: number, z: number) => ref.height[z * n + x];
    expect(out[0]).toBeCloseTo(at(0, 0), 6);
    expect(out[1]).toBeCloseTo(at(3, 5), 6);
    expect(out[2]).toBeCloseTo(at(17, 29), 6);
  });
});

describe('the cay', () => {
  it('leaves the lagoon without an island unchanged, and rises out of the water with it', () => {
    expect(LAGOON_SEABED.island).toBeUndefined();
    expect(LAGOON_CAY_SEABED.island).toBe(LAGOON_CAY);
    const isl = LAGOON_CAY;
    const sX = -Math.sin(isl.headingRad);
    const sZ = Math.cos(isl.headingRad);
    const ox = isl.centerX - isl.semiMinorM * sX;
    const oz = isl.centerZ - isl.semiMinorM * sZ;
    const at = (s: number) => islandHeightAt(isl, ox + s * sX, oz + s * sZ);
    const warp = islandFrameAt(isl, ox, oz).s;
    // The face's slope between 1 and 5 m up it, and the step's under the toe.
    expect((at(5 + warp) - at(1 + warp)) / 4).toBeCloseTo(isl.faceSlope, 2);
    expect((at(-12 + warp) - at(-16 + warp)) / 4).toBeCloseTo(isl.terraceSlope, 2);
    // Land on the island, water off it.
    expect(-seabedPointAt(LAGOON_CAY_SEABED, ox + 20 * sX, oz + 20 * sZ).depthM).toBeGreaterThan(0.9);
    expect(seabedPointAt(LAGOON_CAY_SEABED, ox - 15 * sX, oz - 15 * sZ).depthM).toBeGreaterThan(1.5);
  });
});

describe('the half floats', () => {
  it('encodes as IEEE binary16', () => {
    expect(toHalf(1)).toBe(0x3c00);
    expect(toHalf(0.5)).toBe(0x3800);
    expect(toHalf(-2)).toBe(0xc000);
    expect(toHalf(65504)).toBe(0x7bff);
    expect(toHalf(0)).toBe(0);
    // The smallest subnormal, 2^-24.
    expect(toHalf(2 ** -24)).toBe(1);
  });
});

describe('the swash foam tile (round 2)', () => {
  const tile = buildSwashFoamTile(0x0cea9, 128);
  it('has a uniform threshold channel, so the drawn area follows the foam amount', () => {
    const n = 128;
    let lo = 0;
    for (let k = 0; k < n * n; k += 1) if (tile[k * 4 + 3] < 128) lo += 1;
    expect(lo / (n * n)).toBeCloseTo(0.5, 2);
    for (const a of [0.3, 0.5, 0.7]) {
      let s2 = 0;
      for (let k = 0; k < n * n; k += 1) s2 += swashFoamCover(a, tile[k * 4 + 3] / 255, 0.07);
      expect(Math.abs(s2 / (n * n) - a)).toBeLessThan(0.06);
    }
  });
  it('is the same every build (a pure function of the seed)', () => {
    const again = buildSwashFoamTile(0x0cea9, 128);
    expect(Array.from(again.slice(0, 4096))).toEqual(Array.from(tile.slice(0, 4096)));
    expect(SWASH_TILE_N).toBeGreaterThanOrEqual(256);
  });
});
