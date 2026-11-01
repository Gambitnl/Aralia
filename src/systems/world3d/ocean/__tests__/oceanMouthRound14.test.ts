/**
 * River mouth round 14: THE PLATFORM'S STATE, THE TERRACE, THE TURBID POND.
 *
 * Ruling 1, the overwash: the near field's sea edge carries the infragravity band (Stockdon's S_ig through the row's
 * own standing long wave, with the bed's friction, times the field's measured transfer), the coast's sand takes its own
 * Strickler roughness off the channel, and the platform's surface is the washover's (the crest at its seaward edge, the
 * river's mean-flow level at its landward edge). Ruling 2: the spit's seaward terrace at the modal sea's closure depth,
 * as wide as the mean sea's surf zone. Ruling 3: the salt wedge's water carries the river's fines at the outlet's river
 * share. Also: the pond spins up to its steady level.
 */
import { describe, expect, it } from 'vitest';
import { OCEAN_FFT_N } from '../oceanConfig';
import { oceanSeaState } from '../oceanSeaStates';
import {
  MOUTH_IG_FIELD_GAIN, MOUTH_STEADY_SHARE, STOCKDON_IG_SWASH, birkemeierClosureM, coastBreakRef, createMouthSim, daySeaCascades,
  deriveMouthDesign, deriveSurfCoast, hankel0Abs, infragravityEdge, mouthChannelAt, mouthManningCells, mouthSandManningN,
  outletRiverShare, outletSectionCells, packMouthState, shorelineSOf, standingLongWaveIncoming, stockdonIgSwashM,
} from '../oceanMouthMath';
import { courseTerraceDepthAt, islandFrameAt, seabedPointAt } from '../oceanSeabedMath';
import { beachToWorld, G, stricklerManningN } from '../oceanBeachMath';

const cas = oceanSeaState('surf');
const seed = 0x0cea9;
const coast = deriveSurfCoast(cas, OCEAN_FFT_N, seed, 300);
const d = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast });
const flat = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast, washover: false, terrace: false });
const sp = d.spit!;

/** J0 and J1 by their power series (enough terms under x = 4). */
function bessel(x: number): { j0: number; j1: number } {
  let j0 = 0; let j1 = 0; let t0 = 1; let t1 = x / 2;
  for (let k = 0; k < 40; k += 1) {
    j0 += t0; j1 += t1;
    t0 *= -(x * x) / (4 * (k + 1) * (k + 1));
    t1 *= -(x * x) / (4 * (k + 1) * (k + 2));
  }
  return { j0, j1 };
}

describe('the infragravity swash (ruling 1)', () => {
  it('is Stockdon eq. 12 of the day sea', () => {
    const l0 = (G * coast.tpS * coast.tpS) / (2 * Math.PI);
    expect(stockdonIgSwashM(0.215, coast.tpS)).toBeCloseTo(STOCKDON_IG_SWASH * Math.sqrt(0.215 * l0), 12);
    expect(stockdonIgSwashM(0.215, coast.tpS)).toBeCloseTo(0.443, 3);
  });
  it('splits the plane face standing wave J0 into its local waves', () => {
    const beta = 0.045; const dx = 0.5; const n = 61; const w = (2 * Math.PI) / 70;
    const prof = Float64Array.from({ length: n }, (_, i) => beta * i * dx);
    const X = (n - 1) * dx;
    const z = 2 * w * Math.sqrt(X / (G * beta));
    const { j0, j1 } = bessel(z);
    // At the edge eta = J0(z), eta' / k = -J1(z) on a plane face: the incoming wave is sqrt(J0^2 + J1^2) / 2 (within 3 %:
    // the integration holds the depth at 2 cm at least, so its first half meter is a little deeper than the face).
    expect(Math.abs(standingLongWaveIncoming(prof, dx, w) / (Math.hypot(j0, j1) / 2) - 1)).toBeLessThan(0.03);
  });
  it('asks a larger edge wave with the bed friction on a shallow terrace', () => {
    const w = (2 * Math.PI) / 70;
    const ter = Float64Array.from({ length: 26 }, (_, i) => Math.min(0.09 * i, 0.37));
    const no = standingLongWaveIncoming(ter, 1, w);
    const fr = standingLongWaveIncoming(ter, 1, w, { manningN: 0.011, shoreAmpM: 0.157 });
    expect(fr).toBeGreaterThan(no);
    expect(Number.isFinite(fr)).toBe(true);
  });
  it('has a modulus of H0 that matches its asymptote', () => {
    expect(hankel0Abs(20)).toBeCloseTo(Math.sqrt(2 / (Math.PI * 20)), 3);
  });
  it('shapes the band from the groups height envelope at the law rms', () => {
    const n = 2400; const dt = 0.25;
    // Two swells 10 % apart in frequency: groups of 1 / df.
    const s = Float64Array.from({ length: n }, (_, k) => 0.1 * Math.cos((2 * Math.PI * k * dt) / 12.75) + 0.1 * Math.cos((2 * Math.PI * k * dt) / 11.6));
    const prof = Float64Array.from({ length: 26 }, (_, i) => 0.045 * i);
    const e = infragravityEdge({ series: s, dtS: dt, h0M: 0.215, tpS: 12.75, depthM: 1.12, shoreDistM: 25, profileM: prof, profileDxM: 1 });
    let m = 0; let v = 0;
    for (const x of e.etaM) { m += x; v += x * x; }
    m /= n;
    expect(Math.abs(m)).toBeLessThan(1e-9);
    expect(Math.sqrt(v / n)).toBeCloseTo(e.rmsM, 9);
    expect(e.shoreRmsM).toBeCloseTo(stockdonIgSwashM(0.215, 12.75) / 4, 12);
    // The groups' period: 1 / (1 / 11.6 - 1 / 12.75) = 128.6 s.
    expect(e.periodS).toBeGreaterThan(100);
    expect(e.periodS).toBeLessThan(160);
  });
  it('takes the field measured transfer', () => {
    expect(MOUTH_IG_FIELD_GAIN).toBeGreaterThan(1);
    expect(d.infragravity).toBe(true);
    expect(d.tpS).toBeCloseTo(coast.tpS, 12);
  });
});

describe('one sand, one roughness (ruling 1)', () => {
  it('gives the channel the river n and the coast its sand Strickler n', () => {
    const n = mouthManningCells(d);
    const g = d.grid;
    expect(mouthSandManningN(d)).toBeCloseTo(stricklerManningN(0.35e-3), 12);
    let ch = 0; let sand = 0;
    for (let j = 0; j < g.na; j += 7) for (let i = 0; i < g.ns; i += 3) {
      const c = mouthChannelAt(d, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da);
      const v = n[j * g.ns + i];
      if (c.across < d.widthM / 2 && c.along >= -d.valley.seaEndM) { expect(v).toBe(d.manningN); ch += 1; } else { expect(v).toBe(mouthSandManningN(d)); sand += 1; }
    }
    expect(ch).toBeGreaterThan(10);
    expect(sand).toBeGreaterThan(10);
  });
});

describe('the washover surface (ruling 1)', () => {
  it('stands the platform at the crest at its seaward edge and at the river mean level at its landward edge', () => {
    for (const a of [120, 200, 280]) {
      const ch = mouthChannelAt(d, shorelineSOf(d, a) + sp.centerOffsetM, a);
      const along = ch.along;
      const at = (across: number): number => {
        const [x, z] = beachToWorld(d.frame, shorelineSOf(d, a) + sp.centerOffsetM - across, a);
        return -seabedPointAt(d.params, x, z).depthM + d.tideM;
      };
      const inner = d.tideM + sp.slope * along;
      expect(at(sp.channelWidthM / 2 + 0.6)).toBeLessThanOrEqual(inner + (sp.crestM - inner) * (0.6 / sp.platformWidthM) + 0.02);
      expect(at(sp.centerOffsetM - 3)).toBeLessThanOrEqual(sp.crestM + 1e-6);
      expect(at(sp.centerOffsetM - 3)).toBeGreaterThan(at(sp.channelWidthM / 2 + 3));
    }
  });
  it('keeps round 13 flat cap with the washover off', () => {
    const a = 200;
    const [x, z] = beachToWorld(flat.frame, shorelineSOf(flat, a) + flat.spit!.centerOffsetM - flat.widthM / 2 - 3, a);
    expect(-seabedPointAt(flat.params, x, z).depthM + flat.tideM).toBeCloseTo(flat.spit!.crestM, 6);
  });
});

describe('the spit seaward terrace (ruling 2)', () => {
  it('stands at the closure depth of the day sea, as wide as the mean surf zone', () => {
    const dc = birkemeierClosureM(0.215, coast.tpS);
    expect(dc).toBeCloseTo(1.75 * 0.215 - (57.9 * 0.215 * 0.215) / (G * coast.tpS * coast.tpS), 12);
    expect(dc).toBeCloseTo(0.3746, 3);
    const t = d.course!.terrace!;
    expect(t.depthStillM).toBeCloseTo(dc, 12);
    expect(t.widthM).toBeCloseTo(coastBreakRef(coast.params, d.frame, d.mouthS, d.mouthA, coast.hsM).widthM, 9);
    for (const off of [20, 50, 90]) {
      const [x, z] = beachToWorld(d.frame, shorelineSOf(d, 200) - off, 200);
      expect(seabedPointAt(d.params, x, z).depthM).toBeCloseTo(dc, 6);
    }
  });
  it('leaves the jet axis floor and the far coast alone, and the floor bit for bit without it', () => {
    for (const [s, a] of [[-60, 40], [-60, -100], [-60, 600]] as const) {
      const [x, z] = beachToWorld(d.frame, d.mouthS + s, a);
      expect(seabedPointAt(d.params, x, z).depthM).toBe(seabedPointAt(flat.params, x, z).depthM);
    }
    const ter = d.valley.course!.terrace!;
    const [x, z] = beachToWorld(d.frame, shorelineSOf(d, 200) + 5, 200);
    expect(courseTerraceDepthAt(ter, x, z, islandFrameAt(d.params.island!, x, z).s, 1.234)).toBe(1.234);
  });
});

describe('the near field (rulings 1 and 3)', () => {
  const sim = createMouthSim(d, daySeaCascades(cas, d.seaEnergy ?? 1), OCEAN_FFT_N, seed);
  it('spins the pond up to its steady level', () => {
    expect(sim.spinUpS!).toBeGreaterThan(600);
    const f = sim.field;
    const r0 = f.ledger.riverIn;
    let v0 = 0; for (let c = 0; c < f.h.length; c += 1) v0 += f.h[c];
    f.waves = false;
    for (let k = 0; k < Math.round(20 / f.dt); k += 1) f.advance(0);
    let v1 = 0; for (let c = 0; c < f.h.length; c += 1) v1 += f.h[c];
    const rate = (Math.abs(v1 - v0) * d.grid.ds * d.grid.da) / 20;
    expect(rate).toBeLessThan(4 * MOUTH_STEADY_SHARE * d.dischargeM3S + 0.2);
    expect(f.ledger.riverIn - r0).toBeCloseTo(20 * d.dischargeM3S, 3);
    f.restore(sim.start);
    f.waves = true;
  }, 120000);
  it('carries the band on the sampled edge rows', () => {
    const ig = sim.infragravity!;
    expect(ig.edges.length).toBeGreaterThan(10);
    for (const e of ig.edges) { expect(e.rmsM).toBeGreaterThan(0.01); expect(e.rmsM).toBeLessThan(0.2); }
  });
  it('draws the wedge water with the river fines at the outlet share', () => {
    const f = sim.field;
    expect(outletSectionCells(d).length).toBeGreaterThan(20);
    const share = outletRiverShare(d, f);
    expect(share).toBeGreaterThanOrEqual(0);
    expect(share).toBeLessThanOrEqual(1);
    const p = packMouthState(d, f, 6);
    const g = d.grid;
    // In the pond (the channel's center at a 200) the drawn river column is at most the water and over the layer alone.
    const [x, z] = [shorelineSOf(d, 200) + sp.centerOffsetM, 200];
    const i = Math.floor((x - g.s0) / g.ds); const j = Math.floor((z - g.a0) / g.da);
    const c = j * g.ns + i;
    const col = halfToFloat(p.b[c * 4 + 2]);
    expect(col).toBeLessThanOrEqual(f.h[c] + 1e-3);
    expect(col).toBeGreaterThan(0.3);
  });
});

/** IEEE half to float (the pack's channels). */
function halfToFloat(hv: number): number {
  const s = hv & 0x8000 ? -1 : 1;
  const e = (hv >> 10) & 0x1f;
  const m = hv & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (m / 1024);
  if (e === 31) return m ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + m / 1024);
}
