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
  BATHY_BORE_GAMMA,
  BATHY_BREAK_FULL,
  BATHY_BREAK_START,
  BATHY_CREST_TO_HEIGHT,
  BEACH_MATCH_SWASH,
  BEACH_MATCH_SWASH_R16,
  BEACH_SAND,
  BEACH_SWASH,
  bathyBoreCrestM,
  bathyBreakShare,
  bathyShoalGain,
  heldIncidentCrest,
  incidentModeGain,
  kozenyCarmanKs,
  stricklerManningN,
  waveNumberAt,
  type BeachMatchSwash,
  BeachClock,
  BeachDebris,
  DEBRIS_STRIDE,
  GRAIN_DENSITY_KG_M3,
  IncidentWaves,
  SwashField,
  SWASH_TILE_N,
  buildSwashFoamTile,
  conductivity,
  createBeachSim,
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
import {
  OCEAN_BORE_GAMMA,
  OCEAN_BREAK_FULL,
  OCEAN_BREAK_START,
  OCEAN_CREST_TO_HEIGHT,
  oceanBoreCrestM,
  oceanBreakShareCpu,
  oceanShoalGain,
} from '../oceanBathymetry';

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

describe("the match look's swash (round 16)", () => {
  // The match ran the same sea with round 16's set (BEACH_MATCH_SWASH_R16): a larger height at the
  // grid's edge and a faster-draining sand. The default must be unchanged,
  // and the match's ledger must close as the default's does.
  const cascades = oceanSeaState('shallow');
  it('leaves the default beach bit for bit unchanged, and closes its own ledger', () => {
    const a = createBeachSim({ cascades, n: 64, seed: 7 });
    const b = createBeachSim({ cascades, n: 64, seed: 7, match: undefined });
    const m = createBeachSim({ cascades, n: 64, seed: 7, match: BEACH_MATCH_SWASH_R16 });
    const v0 = m.field.sheetVolume() + m.field.soakedVolume();
    a.clock.advanceTo(12); b.clock.advanceTo(12); m.clock.advanceTo(12);
    expect(Array.from(b.field.h)).toEqual(Array.from(a.field.h));
    const l = m.field.ledger;
    const lhs = m.field.sheetVolume() + m.field.soakedVolume() - v0 + l.drained + l.evaporated;
    expect(Math.abs(lhs - l.arrived)).toBeLessThan(1e-9 * Math.max(1, Math.abs(l.inflow)));
    expect(l.clipped).toBe(0);
    // A larger swash brings more water in, and the faster sand soaks more of it.
    expect(l.inflow).toBeGreaterThan(a.field.ledger.inflow);
    expect(l.infiltrated).toBeGreaterThan(a.field.ledger.infiltrated);
  }, 120000);
});

describe('the match swash, derived from the sea and the ground (round 20)', () => {
  const cascades = oceanSeaState('shallow');
  /** FNV-1a over the bytes of the swash state at 12 s (n 64, seed 7). */
  const stateHash = (match?: BeachMatchSwash): string => {
    const s = createBeachSim({ cascades, n: 64, seed: 7, ...(match ? { match } : {}) });
    s.clock.advanceTo(12);
    const f = s.field;
    let h = 0x811c9dc5 >>> 0;
    for (const a of [f.h, f.hu, f.hv, f.w1, f.w2, f.foam, f.strand, f.mark, f.sed, f.foamAge]) {
      const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      for (let i = 0; i < b.length; i += 1) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    }
    return h.toString(16).padStart(8, '0');
  };

  it('leaves the default beach and the round-16 match bit for bit as they were before round 20', () => {
    // Hashes taken with the code before the round-20 edit
    // (`.agent/scratch/ocean-gauntlet/beach/r20/golden.ts`).
    expect(stateHash()).toBe('cf5db13b');
    expect(stateHash(BEACH_MATCH_SWASH_R16)).toBe('cb4cf6af');
  }, 120000);

  it('closes the derived match ledger exactly, with nothing clipped', () => {
    const m = createBeachSim({ cascades, n: 64, seed: 7, match: BEACH_MATCH_SWASH });
    const v0 = m.field.sheetVolume() + m.field.soakedVolume();
    m.clock.advanceTo(20);
    const l = m.field.ledger;
    const lhs = m.field.sheetVolume() + m.field.soakedVolume() - v0 + l.drained + l.evaporated;
    expect(Math.abs(lhs - l.arrived)).toBeLessThan(1e-9 * Math.max(1, Math.abs(l.inflow)));
    expect(l.clipped).toBe(0);
    expect(l.infiltrated).toBeGreaterThan(0);
  }, 120000);

  it('derives the sand and the bed from the grain, and the cay carries its grain', () => {
    expect(LAGOON_CAY.grainD50M).toBe(0.35e-3);
    expect(BEACH_MATCH_SWASH.grainD50M).toBe(LAGOON_CAY.grainD50M);
    // Kozeny-Carman at the beach's own porosity: about 1.1e-3 m/s for 0.35 mm.
    expect(BEACH_MATCH_SWASH.ksMS).toBeCloseTo(kozenyCarmanKs(0.35e-3, BEACH_SAND.thetaS), 12);
    expect(BEACH_MATCH_SWASH.ksMS).toBeGreaterThan(1.0e-3);
    expect(BEACH_MATCH_SWASH.ksMS).toBeLessThan(1.2e-3);
    // K grows as d^2.
    expect(kozenyCarmanKs(0.7e-3, 0.4) / kozenyCarmanKs(0.35e-3, 0.4)).toBeCloseTo(4, 9);
    // Strickler: 0.0417 d^(1/6).
    expect(BEACH_MATCH_SWASH.manningN).toBeCloseTo(0.0417 * (0.35e-3) ** (1 / 6), 12);
    expect(stricklerManningN(0.35e-3)).toBeGreaterThan(0.0105);
    expect(stricklerManningN(0.35e-3)).toBeLessThan(0.0115);
  });

  it('copies the laws of the sea-owned reef module exactly', () => {
    expect(BATHY_BREAK_START).toBe(OCEAN_BREAK_START);
    expect(BATHY_BREAK_FULL).toBe(OCEAN_BREAK_FULL);
    expect(BATHY_CREST_TO_HEIGHT).toBe(OCEAN_CREST_TO_HEIGHT);
    expect(BATHY_BORE_GAMMA).toBe(OCEAN_BORE_GAMMA);
    for (const T of [1.5, 2.1, 4, 9.3, 12.7]) for (const d of [0.05, 0.3, 0.74, 2.5, 4.5, 40]) {
      expect(bathyShoalGain(T, d)).toBe(oceanShoalGain(T, d));
    }
    for (const d of [0.2, 0.74, 2]) {
      expect(bathyBoreCrestM(d)).toBe(oceanBoreCrestM(d));
      for (const e of [-0.1, 0, 0.05, 0.2, 0.3, 0.6]) expect(bathyBreakShare(e, d)).toBe(oceanBreakShareCpu(e, d));
    }
  });

  it('shoals and refracts a mode by linear theory, and holds a crest to the depth', () => {
    const w = (2 * Math.PI) / 9.3;
    const k0 = waveNumberAt(w, 4.5);
    // Normal incidence: Ks alone, the ratio of the deep-water gains.
    const ks = oceanShoalGain(9.3, 0.74) / oceanShoalGain(9.3, 4.5);
    expect(incidentModeGain(w, k0, 0, 4.5, 0.74, 1, 0)).toBeCloseTo(ks, 12);
    expect(ks).toBeGreaterThan(1.4);
    // The same depth: no change.
    expect(incidentModeGain(w, k0, 0, 4.5, 4.5, 1, 0)).toBeCloseTo(1, 12);
    // Oblique incidence: refraction spreads the rays, so the gain is lower.
    expect(incidentModeGain(w, k0 * Math.cos(0.8), k0 * Math.sin(0.8), 4.5, 0.74, 1, 0)).toBeLessThan(ks);
    // The held crest: troughs as they are, small crests as they are, high
    // ones toward 0.55 d / 1.8.
    expect(heldIncidentCrest(-0.3, 0.74)).toBe(-0.3);
    expect(heldIncidentCrest(0.1, 0.74)).toBe(0.1);
    expect(heldIncidentCrest(0.6, 0.74)).toBeCloseTo(oceanBoreCrestM(0.74), 12);
    expect(heldIncidentCrest(0.25, 0.74)).toBeLessThan(0.25);
  });

  it('keeps a lake at rest at rest with the subcell faces, and drains a thin film faster than Audusse', () => {
    const ns = 96; const na = 4; const ds = 0.125; const s0 = -6;
    const grid: SwashGridSpec = { s0, ds, ns, a0: 0, da: 0.5, na };
    const bed = new Float64Array(ns * na); const shore = new Float64Array(ns * na);
    for (let j = 0; j < na; j += 1) {
      for (let i = 0; i < ns; i += 1) {
        const s = s0 + (i + 0.5) * ds;
        bed[j * ns + i] = s / 11 + 0.01 * Math.sin(j + i * 0.7);
        shore[j * ns + i] = s;
      }
    }
    const mk = (subcellHR: boolean) => new SwashField({
      grid, bed, shoreDist: shore, dt: 1 / 100, incident: (_t, out) => out.fill(0),
      params: { ...BEACH_SWASH, subcellHR, manningN: 0.011, laminarNuM2S: 1.05e-6 },
    });
    const lake = mk(true);
    const h0 = lake.h.slice();
    for (let k = 0; k < 300; k += 1) lake.advance();
    let maxDh = 0; let maxU = 0;
    for (let c = 0; c < lake.h.length; c += 1) {
      maxDh = Math.max(maxDh, Math.abs(lake.h[c] - h0[c]));
      maxU = Math.max(maxU, Math.abs(lake.hu[c]));
    }
    expect(maxDh).toBeLessThan(1e-9);
    expect(maxU).toBeLessThan(1e-9);
    // A 2 mm film laid on the dry face from s = 2 to 6 m, after 1 s: its mean
    // speed down the slope with the subcell faces against Audusse's (whose
    // thin film feels only 0.5 g h^2 per cell of the slope's pull).
    const speed = (subcellHR: boolean): number => {
      const f = mk(subcellHR);
      for (let j = 0; j < na; j += 1) {
        for (let i = 0; i < ns; i += 1) { const s = s0 + (i + 0.5) * ds; if (s > 2 && s < 6) f.h[j * ns + i] = 0.002; }
      }
      f.restore(f.snapshot(new Float64Array(0)));
      for (let k = 0; k < 100; k += 1) f.advance();
      let m = 0; let v = 0;
      for (let c = 0; c < f.h.length; c += 1) if (f.h[c] > 1e-5 && bed[c] > 0) { m += f.h[c]; v += f.hu[c]; }
      return v / m;
    };
    const sub = speed(true);
    const aud = speed(false);
    expect(sub).toBeLessThan(0);
    expect(sub).toBeLessThan(aud * 1.5);
  });

  it('takes foam from the energy a bore loses: none from a vanishing step, all from a collapse', () => {
    // The relative head loss of the jump (boreFoamSource): 0.05 for a bore
    // twice the depth ahead.
    const loss = (h1: number, h2: number) => ((h2 - h1) ** 3) / (h2 * (4 * h1 * h1 + h2 * (h1 + h2)));
    expect(loss(0.1, 0.2)).toBeCloseTo(0.05, 12);
    expect(loss(0.1, 0.1)).toBe(0);
    expect(loss(1e-6, 0.2)).toBeGreaterThan(0.99);
  });
});
