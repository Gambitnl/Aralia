/**
 * River mouth round 13 (GG-413): THE PLANFORM BY THE LONGSHORE DRIFT LAW.
 *
 * Law 1, the drift: the CERC formula with Komar and Gaughan's breaker height from the mean sea and the record's breaker
 * angle, measured on the clip. The platform: its crest at the swash bar's law, its width at the beach's berm law
 * (Stockdon's R2 over the face's slope). The channel keeps Leopold and Maddock's width at the mean flow; the spit's
 * length is Escoffier's balance (the mean flow at the equilibrium speed under the platform's head). The course and the
 * floor follow from those numbers; the near field takes the river in across its root edge.
 */
import { describe, expect, it } from 'vitest';
import { OCEAN_FFT_N } from '../oceanConfig';
import { oceanSeaState } from '../oceanSeaStates';
import {
  COAST_PLACES, ESCOFFIER_SPEED_MS, HG_WIDTH_A, HG_WIDTH_B, MOUTH_SPINUP_S, SARCELLE_CONDITIONS, SAND_POROSITY, SAND_REL_DENSITY,
  CERC_K_SIG, MCCOWAN_GAMMA, YEAR_S, channelAlongTable, channelSectionFull, cercDriftM3S, coastBeachGrid, deriveMouthDesign,
  deriveSurfCoast, deflectedSpitOf, komarGaughanBreakerM, longshoreDriftOf, mouthChannelAt, mouthSpinUpS, shorelineSOf,
  swashBarCrestM,
} from '../oceanMouthMath';
import { courseNearest, seabedPointAt, valleyCutAt, type SeabedValley } from '../oceanSeabedMath';
import { beachToWorld, G } from '../oceanBeachMath';

const cas = oceanSeaState('surf');
const seed = 0x0cea9;
const coast = deriveSurfCoast(cas, OCEAN_FFT_N, seed, 300);
const d = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast });
const straight = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast, planform: 'straight' });
const sp = d.spit!;

describe('the drift (law 1)', () => {
  it('carries the clip measure in the record and moves the sand to -a', () => {
    expect(SARCELLE_CONDITIONS.drift).toEqual({ breakerAngleDeg: 26.0, sense: -1 });
    expect(sp.drift.sense).toBe(-1);
    expect(sp.drift.breakerAngleRad).toBeCloseTo((26 * Math.PI) / 180, 12);
  });
  it('is the CERC formula on the Komar and Gaughan breaker of the mean sea', () => {
    const hb = 0.39 * G ** 0.2 * (coast.tpS * coast.hsM * coast.hsM) ** 0.4;
    expect(komarGaughanBreakerM(coast.hsM, coast.tpS)).toBeCloseTo(hb, 12);
    expect(sp.drift.hbM).toBeCloseTo(hb, 12);
    const q = (CERC_K_SIG * Math.sqrt(G / MCCOWAN_GAMMA) * hb ** 2.5 * Math.sin((52 * Math.PI) / 180)) / (16 * (SAND_REL_DENSITY - 1) * (1 - SAND_POROSITY));
    expect(sp.drift.qM3S).toBeCloseTo(q, 10);
    expect(sp.drift.qM3Yr).toBeCloseTo(q * YEAR_S, 3);
    // No drift with the waves square to the shore, the most at 45 degrees.
    expect(cercDriftM3S(1, 0)).toBe(0);
    expect(cercDriftM3S(1, Math.PI / 4)).toBeGreaterThan(cercDriftM3S(1, (30 * Math.PI) / 180));
    expect(longshoreDriftOf({ hsM: 1, tpS: 8, breakerAngleDeg: 10, sense: 1 }).sense).toBe(1);
  });
});

describe('the platform and the spit (law 1)', () => {
  it('stands the platform at the swash bar crest and runs it out to the berm reach', () => {
    expect(sp.crestM).toBeCloseTo(swashBarCrestM({ tideM: d.tideM, hsM: coast.hsM, tpS: coast.tpS }), 12);
    expect(sp.headM).toBeCloseTo(sp.crestM - d.tideM, 12);
    expect(sp.platformWidthM).toBeCloseTo(coast.runup2M / coast.params.island!.faceSlope, 10);
  });
  it('keeps the channel width at the mean flow, the same as the straight valley', () => {
    const w = HG_WIDTH_A * COAST_PLACES.sarcelleMouth.dischargeM3S ** HG_WIDTH_B;
    expect(d.widthM).toBeCloseTo(w, 12);
    expect(sp.channelWidthM).toBeCloseTo(w, 12);
    expect(straight.widthM).toBeCloseTo(w, 12);
    expect(d.valley.widthM).toBeCloseTo(straight.valley.widthM, 12);
  });
  it('ends the spit where the mean flow runs at Escoffier speed under the platform head (Manning)', () => {
    const q = d.meanDischargeM3S;
    const sec = channelSectionFull(sp.channelWidthM, sp.channelDepthM, d.shapeP);
    expect(q / sec.areaM2).toBeCloseTo(ESCOFFIER_SPEED_MS, 10);
    const r = sec.areaM2 / sec.wetM;
    const u = (r ** (2 / 3) * Math.sqrt(sp.slope)) / d.manningN;
    expect(u).toBeCloseTo(ESCOFFIER_SPEED_MS, 10);
    expect(sp.lengthM * sp.slope).toBeCloseTo(sp.headM, 10);
    // A longer spit runs the mean flow under the equilibrium speed (it shoals shut).
    const sLonger = sp.headM / (1.5 * sp.lengthM);
    expect((r ** (2 / 3) * Math.sqrt(sLonger)) / d.manningN).toBeLessThan(ESCOFFIER_SPEED_MS);
    // A drift-dominated outlet by Bruun's ratio (under about 20 to 50 a migrating, bar-bypassing outlet).
    expect(sp.bruunRatio).toBeGreaterThan(0);
    const fromParts = deflectedSpitOf({
      qMeanM3S: q, widthM: d.widthM, shapeP: d.shapeP, manningN: d.manningN, tideM: d.tideM, hsM: coast.hsM, tpS: coast.tpS,
      runup2M: coast.runup2M, faceSlope: coast.params.island!.faceSlope, drift: sp.drift,
    });
    expect(fromParts.lengthM).toBeCloseTo(sp.lengthM, 10);
  });
});

describe('the course and the floor (law 1)', () => {
  const c = d.valley.course!;
  it('runs the channel along the shore behind the platform at its offset from the local shoreline', () => {
    for (const a of [120, 180, 250, 300]) {
      const ch = mouthChannelAt(d, shorelineSOf(d, a) + sp.centerOffsetM, a);
      expect(ch.across).toBeLessThan(0.6);
      // Downstream is toward -a (to the outlet at a 40).
      expect(ch.downA).toBeLessThan(-0.95);
    }
  });
  it('caps the ground at the platform crest between the shoreline and the channel along the reach', () => {
    for (const a of [100, 160, 240, 300]) {
      const sh = shorelineSOf(d, a);
      for (let sig = 3; sig <= sp.platformWidthM - 1; sig += 2) {
        const [x, z] = beachToWorld(d.frame, sh + sig, a);
        const ground = -seabedPointAt(d.params, x, z).depthM + d.tideM;
        expect(ground).toBeLessThanOrEqual(sp.crestM + 1e-6);
      }
      // The inland bank keeps the coast's own ground (over the berm).
      const [x2, z2] = beachToWorld(d.frame, sh + sp.centerOffsetM + d.widthM / 2 + 10, a);
      expect(-seabedPointAt(d.params, x2, z2).depthM + d.tideM).toBeGreaterThan(2);
    }
  });
  it('lays the thalweg at the spit depth at the mouth and the spit slope to the root', () => {
    expect(c.thal[1]).toBeCloseTo(-sp.channelDepthM, 12);
    const [x, z] = beachToWorld(d.frame, shorelineSOf(d, 200) + sp.centerOffsetM, 200);
    const q = courseNearest(c, x, z);
    expect(q.thal).toBeCloseTo(-sp.channelDepthM + sp.slope * q.along, 3);
    expect(valleyCutAt(d.valley, x, z)).toBeCloseTo(q.thal, 2);
  });
  it('leaves the straight valley cut unchanged with no course', () => {
    const v: SeabedValley = { ...straight.valley };
    expect(v.course).toBeUndefined();
    const [x, z] = beachToWorld(straight.frame, straight.mouthS + 30, straight.mouthA + 3);
    const along = 30;
    const thal = -v.depthM + v.slope * along;
    expect(valleyCutAt(v, x, z)).toBeCloseTo(thal + v.depthM * (3 / (v.widthM / 2)) ** v.shapeP, 9);
  });
});

describe('the near field on the deflected reach (law 1)', () => {
  it('covers the reach from the outlet far bank to the root bend, with the beach grid at the outlet box', () => {
    const g = d.grid;
    expect(g.a0).toBeLessThan(d.mouthA - d.widthM / 2);
    expect(g.a0 + g.na * g.da).toBeLessThan(d.course!.aRootM);
    expect(g.a0 + g.na * g.da).toBeGreaterThan(d.course!.aRootM - 4);
    const bg = coastBeachGrid(d);
    const bs = coastBeachGrid(straight);
    expect(bg.a0).toBe(bs.a0);
    expect(bg.na).toBe(bs.na);
  });
  it('keeps the straight valley long-wave spin-up rule', () => {
    expect(mouthSpinUpS(straight)).toBeGreaterThanOrEqual(MOUTH_SPINUP_S);
    expect(mouthSpinUpS(d)).toBeGreaterThan(MOUTH_SPINUP_S);
  });
  it('tables the channel along at each cell', () => {
    const t = channelAlongTable(d);
    expect(t.length).toBe(d.grid.ns * d.grid.na);
    expect(channelAlongTable(d)).toBe(t);
  });
});
