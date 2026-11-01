/**
 * Rocks round 17 (the ocean gauntlet): THE ROOT IS A VOLUME (the aerated roller on the struck face, the
 * wash-over, the collar and the pour-off as density in the march grid, by Chanson's self-aerated profile and
 * Duncan's roller), THE CREST PILES OVER THE RIM (the weir's critical depth), and THE PARCEL'S PROFILE IS READ
 * ONCE A STEP (the cost: SplashVolume.layCache).
 */
import { describe, expect, it } from 'vitest';
import {
  ROCK_AIR_C90,
  ROCK_BODY_MAX,
  ROCK_ROLLER_AREA_PER_L2,
  ROCK_ROLLER_BUBBLE_M,
  ROCK_ROLLER_BUBBLE_RISE_MS,
  ROCK_ROLLER_COLUMN,
  ROCK_ROLLER_DPRIME,
  ROCK_ROLLER_PER_H,
  ROCK_ROLLER_VOID,
  RockSurf,
  buildRockMesh,
  rockAirColumn,
  rockAirDiffusivity,
  rockAirMeanC,
  rockAirProfileC,
  rockBodyAirStep,
  rockBodyCensus,
  rockFaceTable,
  rockRollerBodies,
  rockRollerThicknessM,
  type RockSeaParams,
  type RockSpec,
} from '../oceanRocksMath';
import { SPLASH_BODY_STRIDE, SPLASH_DROP, SPLASH_Q_EXT, SPLASH_SHEET, SplashPool, SplashVolume } from '../oceanSplashMath';

const SPEC: RockSpec = {
  xM: 0, zM: -40, halfLengthM: 3, halfWidthM: 2, headingRad: 0.3, topM: 1.6, baseM: 3,
  squareness: 2.6, flatness: 3.2, taper: 0.25, tiltAlong: 0.05, tiltAcross: -0.03,
  lumps: 0.08, creaseM: 0.08, seed: 11,
};
const SEA: RockSeaParams = { hsM: 4.2, peakLengthM: 123, crestSpeedMs: 9.7, windDirRad: Math.PI + 0.35, windSpeedMs: 20 };
const still = { airX: 0, airZ: 0, seaHeight: () => -100 };

describe('rocks round 17: the aerated column (Chanson 1997)', () => {
  it('reaches 0.9 at Y90, rises from the wall to 1 at y\' = 2 D\' K\'', () => {
    for (const d of [0.2, 0.43, 1.2]) {
      expect(rockAirProfileC(1, d)).toBeCloseTo(ROCK_AIR_C90, 9);
      expect(rockAirProfileC(0, d)).toBeLessThan(rockAirProfileC(0.5, d));
      const top = 2 * d * (Math.atanh(Math.sqrt(0.1)) + 1 / (2 * d));
      expect(rockAirProfileC(top + 1e-9, d)).toBe(1);
      let last = -1;
      for (let y = 0; y <= top; y += top / 50) { const c = rockAirProfileC(y, d); expect(c).toBeGreaterThanOrEqual(last - 1e-12); last = c; }
    }
  });
  it('solves D\' for the roller\'s mean void share, and the mean is the integral of the profile', () => {
    expect(rockAirMeanC(ROCK_ROLLER_DPRIME)).toBeCloseTo(ROCK_ROLLER_VOID, 6);
    expect(rockAirDiffusivity(0.3)).toBeLessThan(rockAirDiffusivity(0.6));
    let s = 0; const n = 4000;
    for (let k = 0; k < n; k += 1) s += rockAirProfileC((k + 0.5) / n, ROCK_ROLLER_DPRIME) / n;
    expect(s).toBeCloseTo(ROCK_ROLLER_VOID, 4);
  });
  it('gives the column the optical depth of (Q / 4) 6 C (1 - C) / D over its height: opaque across a roller of decimeters', () => {
    const col = rockAirColumn(ROCK_ROLLER_DPRIME, ROCK_ROLLER_BUBBLE_M);
    expect(col).toEqual(ROCK_ROLLER_COLUMN);
    // Its peak is (Q / 4) 6 / 4 / D at C = 0.5, its integral under that peak times its height.
    expect(col.tauPerM).toBeLessThan(((SPLASH_Q_EXT / 4) * 1.5 / ROCK_ROLLER_BUBBLE_M) * col.top);
    expect(col.tauPerM).toBeGreaterThan(100);
    expect(col.centroid).toBeGreaterThan(0.2);
    expect(col.centroid).toBeLessThan(col.top);
    expect(col.tauPerM * rockRollerThicknessM(3.7)).toBeGreaterThan(50);
  });
  it('makes the roller Duncan\'s 0.11 of Svendsen\'s 0.9 H thick', () => {
    expect(rockRollerThicknessM(3.7)).toBeCloseTo(ROCK_ROLLER_AREA_PER_L2 * ROCK_ROLLER_PER_H * 3.7, 12);
    expect(rockRollerThicknessM(-1)).toBe(0);
  });
  it('keeps the body\'s air while fed and lets it rise out across the body\'s thickness', () => {
    expect(rockBodyAirStep(0.2, true, 0.3, 1 / 60)).toBe(1);
    expect(rockBodyAirStep(1, false, 0.3, 1)).toBeCloseTo(Math.exp(-ROCK_ROLLER_BUBBLE_RISE_MS / 0.3), 12);
  });
});

describe('rocks round 17: the bodies in the march grid (SplashVolume.build)', () => {
  const vol = () => {
    const v = new SplashVolume({ nx: 40, ny: 32, nz: 40, cellM: 0.2, coreN: [60, 40, 60], coreCellM: 0.1 });
    v.setCore(-3, -0.5, -3);
    return v;
  };
  it('lays a body that fits the core grid there with its whole cross-section, and none of it for the sprites', () => {
    const v = vol();
    const pool = new SplashPool(16, 1);
    const b = new Float32Array(SPLASH_BODY_STRIDE);
    b.set([0.13, 1.07, -0.21, 0.1, 0.12, 0.08, 2.5]);
    v.build(pool, 0, undefined, b, 1);
    expect(v.bodyN).toBe(1);
    expect(v.bodyCs).toBeCloseTo(2.5, 6);
    expect(v.coreParcels).toBe(1);
    expect(v.layCoverage).toBeCloseTo(1, 9);
    expect(v.drawEmpty).toBe(false);
    let sum = 0;
    for (let c = 0; c < v.coreDraw.length; c += 1) sum += v.coreDraw[c];
    expect(sum * 0.1 ** 3).toBeCloseTo(2.5, 4);
    // The light takes it too: its cells hold the body's cross-section.
    v.light(0, 1, 0);
    let lit = 0;
    const L = 2 * v.cellM;
    for (let c = 0; c < v.lightSigma.length; c += 1) lit += v.lightSigma[c];
    expect(lit * L * L * L).toBeCloseTo(2.5, 3);
  });
  it('lays a body too wide for the core grid on the light grid for the march', () => {
    const v = vol();
    const b = new Float32Array(SPLASH_BODY_STRIDE);
    b.set([0, 1, 0, 0.4, 0.4, 0.4, 1]);
    v.build(new SplashPool(4, 1), 0, undefined, b, 1);
    expect(v.coreParcels).toBe(0);
    let d = 0;
    for (let c = 0; c < v.drawSigma.length; c += 1) d += v.drawSigma[c];
    expect(d * (2 * v.cellM) ** 3).toBeCloseTo(1, 3);
  });
});

describe('rocks round 17: the rock\'s bodies (rockRollerBodies)', () => {
  const setup = () => {
    const tab = rockFaceTable(SPEC, buildRockMesh(SPEC, 4));
    const sim = new RockSurf([tab], SEA);
    return { tab, sim };
  };
  it('lays none on a calm rock', () => {
    const { sim } = setup();
    const out = new Float32Array(ROCK_BODY_MAX * SPLASH_BODY_STRIDE);
    expect(rockRollerBodies(sim, 0, out)).toBe(0);
  });
  it('lays the face roller from Y90 under the standing water to the swash line, and over the rim to its critical depth', () => {
    const { tab, sim } = setup();
    let rimMax = 0; for (let s = 0; s < tab.sectors; s += 1) rimMax = Math.max(rimMax, tab.rimM[s]);
    const sw = rimMax + 0.9;
    // Round 18: the roller's share is the struck face's breaking share (faceBreak), no longer the sea's whitecap share.
    for (const st of sim.rocks[0].sectors) { st.etaM = 0.6; st.standingM = 1.0; st.swashM = sw; st.faceBreak = 1; st.bodyAir = 1; st.bodyY90 = 0.3; }
    const out = new Float32Array(ROCK_BODY_MAX * SPLASH_BODY_STRIDE);
    const n = rockRollerBodies(sim, 0, out);
    expect(n).toBe(rockBodyCensus.face);
    expect(n).toBeGreaterThan(16);
    let lo = Infinity; let hi = -Infinity;
    for (let k = 0; k < n; k += 1) { const y = out[k * SPLASH_BODY_STRIDE + 1]; lo = Math.min(lo, y); hi = Math.max(hi, y); }
    expect(lo).toBeGreaterThanOrEqual(0.6 - 0.3 - 1e-6);
    // Over each rim the water stands at most at the weir's critical depth, 2/3 of its head.
    expect(hi).toBeLessThanOrEqual(rimMax + (2 / 3) * 0.9 + 1e-6);
    expect(hi).toBeGreaterThan(rimMax);
    // The census holds the column's optical depth over the face (before the grid's bound).
    expect(rockBodyCensus.faceCs).toBeGreaterThan(ROCK_ROLLER_COLUMN.tauPerM * 0.3 * 0.5);
    expect(rockBodyCensus.laidCs).toBeLessThanOrEqual(rockBodyCensus.faceCs + 1e-6);
    // Its air gone, its share gone with it; unbroken green water (no breaking share) is clear.
    for (const st of sim.rocks[0].sectors) st.bodyAir = 0;
    expect(rockRollerBodies(sim, 0, out)).toBe(0);
    for (const st of sim.rocks[0].sectors) { st.bodyAir = 1; st.breaking = 0; st.faceBreak = 0; }
    expect(rockRollerBodies(sim, 0, out)).toBe(0);
  });
  it('lays the collar on the sea round the foot for the backwash roller\'s length', () => {
    const { tab, sim } = setup();
    const st = sim.rocks[0].sectors[3];
    st.etaM = 0.2; st.collarAir = 1; st.collarY90 = rockRollerThicknessM(1);
    const out = new Float32Array(ROCK_BODY_MAX * SPLASH_BODY_STRIDE);
    const n = rockRollerBodies(sim, 0, out);
    expect(rockBodyCensus.collar).toBe(n);
    let rMax = 0;
    for (let k = 0; k < n; k += 1) {
      const o = k * SPLASH_BODY_STRIDE;
      rMax = Math.max(rMax, Math.hypot(out[o] - tab.centerX, out[o + 2] - tab.centerZ));
    }
    expect(rMax).toBeLessThan(tab.waterlineM[3] + 1.2 * ROCK_ROLLER_PER_H * 1 + 0.2);
  });
  it('stays within ROCK_BODY_MAX blobs and counts what it drops', () => {
    const { sim } = setup();
    for (const st of sim.rocks[0].sectors) { st.etaM = 0.5; st.standingM = 0.8; st.swashM = 3; st.faceBreak = 1; st.bodyAir = 1; st.bodyY90 = 0.4; }
    const out = new Float32Array(10 * SPLASH_BODY_STRIDE);
    expect(rockRollerBodies(sim, 0, out)).toBe(10);
    expect(rockBodyCensus.dropped).toBeGreaterThan(0);
  });
  it('feeds the face roller while the run-up climbs on a stepped strike', () => {
    const { tab, sim } = setup();
    // A struck face's state as the step leaves it: the body is fed only while the run-up rises.
    const st = sim.rocks[0].sectors[0];
    st.bodyAir = rockBodyAirStep(0, true, 0.3, 1 / 60);
    expect(st.bodyAir).toBe(1);
    expect(tab.sectors).toBe(16);
  });
});

describe('rocks round 17: the parcel\'s profile is read once a step (SplashVolume.layCache)', () => {
  it('gives the same cross-section, spread and streak as the direct reads, and moves on after a step', () => {
    const pool = new SplashPool(256, 5);
    pool.emit(SPLASH_SHEET, 0, 1, 0, 1, 7, 0, 0.3, 0, 1, 40, 2 / 0.03, 0.03);
    for (let k = 0; k < 20; k += 1) pool.step(1 / 60, still);
    pool.emit(SPLASH_DROP, 0.2, 1.5, 0, 3, 4, 0, 0.01, 0, 1, 0.5, 6 / 0.004, 0.004);
    const c = SplashVolume.layCache(pool);
    for (let a = 0; a < pool.alive; a += 1) {
      const i = pool.aliveIndex[a];
      expect(c.cs[i]).toBeCloseTo(SplashVolume.crossSection(pool, i), 5);
      if (c.cs[i] > 0 && !SplashVolume.isContinuum(pool, i)) expect(c.sigR[i]).toBeCloseTo(pool.spreadSigmaOf(i), 6);
      expect(c.streakM[i]).toBeCloseTo(SplashVolume.streakMeters(pool, i), 6);
    }
    const stamp = c.stamp;
    expect(SplashVolume.layCache(pool).stamp).toBe(stamp);
    pool.step(1 / 60, still);
    expect(SplashVolume.layCache(pool).stamp).not.toBe(stamp);
  });
});
