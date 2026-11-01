/**
 * Tests for the rocks' model (oceanRocksMath.ts): the face relations, the
 * gates that keep a calm sea quiet, and the determinism of the fixed-step
 * simulation that a pinned capture relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  ROCK_DISC_S_MAX,
  ROCK_DT_S,
  ROCK_MICRO_ROUGH_M,
  ROCK_REFLECT_SKIN_M,
  ROCK_WATER_NU_M2S,
  rockDrainingFilmM,
  rockFilmMirrorShare,
  rockReflectHoldM,
  rockReflectInside,
  rockRadiusAt,
  rockNusseltFilmM,
  ROCK_EVENT_R_M,
  ROCK_EVENT_SOFT,
  ROCK_JET_MAX_MS,
  ROCK_SHEET_PARCELS_PER_S,
  ROCK_PRIME_S,
  ROCK_REFLECT_A,
  ROCK_ROUGH_GAMMA,
  ROCK_SAMPLE_HZ,
  ROCK_SAMPLE_STRIDE,
  ROCK_WEIR_C,
  RockSeaHistory,
  RockSurf,
  buildRockMesh,
  rockBoreWaterSpeed,
  rockApexClosingSpeed,
  rockFilmMinFlowM2s,
  rockFilmMinThicknessM,
  rockAeratedJetSpeed,
  rockFaceImpact,
  rockFaceTable,
  rockFlipThroughSpeed,
  rockJetMassShare,
  rockWedge,
  ROCK_FRONT_SLOPE_RAD,
  ROCK_REFLECT_RING,
  ROCK_REFLECT_SLOT_STEPS,
  rockFrontClimbSpeed,
  rockLeeEndAt,
  rockLeeOf,
  rockLeeScatter,
  rockBandLambda,
  rockErf,
  rockLeeHalfWidth,
  rockLeeShare,
  rockReflectSpeed,
  rockReflectedWave,
  rockIribarren,
  rockPrimeTimes,
  rockQueryPoints,
  rockReflection,
  rockSeaParams,
  rockFoamSources,
  rockShelves,
  checkRockLobes,
  type RockFaceImpact,
  type RockFaceTable,
  type RockSeaParams,
  type RockSpec,
} from '../oceanRocksMath';
import { oceanSeaState } from '../oceanSeaStates';
import { GRAVITY_MS2 } from '../oceanConfig';
import {
  SPLASH_DROP,
  SPLASH_FALL,
  SPLASH_LIGAMENT,
  SPLASH_MIST,
  SPLASH_SHEET,
  SplashPool,
  SplashVolume,
  SPLASH_CAUCHY,
  SPLASH_DIFFUSION_Z0,
  SPLASH_G,
  SPLASH_GAMMA_N,
  SPLASH_Q_EXT,
  SPLASH_RP_WAVELENGTH,
  SPLASH_WATER_RHO,
  SPLASH_JET_SPREAD,
  splashTurbulentSigma,
  splashTrainCount,
  splashBubbleRaftM2,
  splashTrainOffset,
  SPLASH_TRAIN_MAX,
  splashAsymmetry,
  splashBodyEfficiency,
  splashSpriteColumnMean,
  splashCapillarySpeed,
  splashDragPerSpeed,
  splashDropCount,
  splashGammaVolumeBelow,
  splashLigamentDiameter,
  splashLight,
  splashSauterDiameter,
  splashStokesDiameter,
  splashTwoFlux,
  sunThroughAir,
  splashSpanningHoles,
  splashSheetStats,
  SplashDepthSort,
  SPLASH_SORT_RES_M,
  SPLASH_SHEET_GONE_X,
  SPLASH_BREAK_RING_SHARE,
  SPLASH_JET_DROP_SHARE,
  SPLASH_JET_DROPS_PER_BUBBLE,
  splashBreakupTstar,
  splashBreakupTimeS,
  splashBubbleMist,
} from '../oceanSplashMath';
import {
  OCEAN_DEEP_M,
  oceanBandGainCpu,
  oceanBandPeriodS,
  oceanBandRefDepthM,
  oceanBreakShareCpu,
  oceanShelfDepthCpu,
  oceanShoalGain,
} from '../oceanBathymetry';

const SPEC: RockSpec = {
  xM: 0, zM: -40, halfLengthM: 3, halfWidthM: 2, headingRad: 0.3, topM: 1.6, baseM: 3,
  squareness: 2.6, flatness: 3.2, taper: 0.25, tiltAlong: 0.05, tiltAcross: -0.03,
  lumps: 0.08, creaseM: 0.08, seed: 11,
};

// Round 4: the waves travel toward -X (pi + 0.35), as regularHistory lays
// them and as the tests' struck faces (sector 0, looking toward +X) need:
// a jet now needs a face that looks at the incoming sea.
const SEA: RockSeaParams = {
  hsM: 4.2, peakLengthM: 123, crestSpeedMs: 9.7, windDirRad: Math.PI + 0.35, windSpeedMs: 20,
};

function table(): RockFaceTable {
  return rockFaceTable(SPEC, buildRockMesh(SPEC, 4));
}

/** The same rock on deep water: no surf, so the other relations show alone. */
function deepTable(): RockFaceTable {
  return { ...table(), reefDepthM: 40 };
}

const newImpact = (): RockFaceImpact => ({ inflowMs: 0, breaking: 0, runUpM: 0, standingM: 0, jet: 0, jetMs: 0, jetKgPerMS: 0, jetSheetM: 0, jetGate: 0, meetMs: 0, jetShare: 0, apexMs: 0, reflectShare: 0, overtopM2s: 0, struck: 0 });

/** A regular wave train toward -n of sector 0 at one query: eta = a cos(w t), parcel speed a w cos(w t). */
function regularHistory(tab: RockFaceTable, aM: number, periodS: number, t0: number, t1: number, deficit = 0): RockSeaHistory {
  const q = tab.sectors;
  const h = new RockSeaHistory(q);
  const w = (2 * Math.PI) / periodS;
  for (let t = t0; t <= t1 + 1e-9; t += 1 / ROCK_SAMPLE_HZ) {
    const row = new Float32Array(q * ROCK_SAMPLE_STRIDE);
    for (let s = 0; s < q; s += 1) {
      const o = s * ROCK_SAMPLE_STRIDE;
      // The wave travels toward -X: into the faces that look toward +X.
      const phase = w * t + (tab.centerX + tab.waterlineM[s] * Math.cos(tab.azimuthRad[s])) * (w * w / GRAVITY_MS2);
      row[o] = aM * Math.cos(phase);
      row[o + 1] = -aM * w * Math.cos(phase);
      row[o + 2] = aM * w * Math.sin(phase);
      row[o + 3] = 0;
      row[o + 4] = deficit * Math.max(Math.cos(phase), 0) ** 4;
    }
    h.push(t, row);
  }
  return h;
}

describe('the rock mesh and its faces', () => {
  it('builds a closed rock that stands out of the water and reaches under it', () => {
    const mesh = buildRockMesh(SPEC, 4);
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = 0; i < mesh.vertexCount; i += 1) {
      top = Math.max(top, mesh.positions[i * 3 + 1]);
      bottom = Math.min(bottom, mesh.positions[i * 3 + 1]);
    }
    expect(top).toBeGreaterThan(1.0);
    expect(top).toBeLessThan(3.0);
    expect(bottom).toBeLessThan(-2);
    expect(mesh.indices.length % 3).toBe(0);
    for (let i = 0; i < mesh.vertexCount * 3; i += 1) expect(Number.isFinite(mesh.normals[i])).toBe(true);
  });

  it('tables every face with a waterline, an outward normal, a slope and a rim', () => {
    const tab = table();
    for (let s = 0; s < tab.sectors; s += 1) {
      expect(tab.waterlineM[s]).toBeGreaterThan(1.2);
      expect(tab.waterlineM[s]).toBeLessThan(4.5);
      const outward = tab.normalX[s] * Math.cos(tab.azimuthRad[s]) + tab.normalZ[s] * Math.sin(tab.azimuthRad[s]);
      expect(outward).toBeGreaterThan(0.3);
      expect(tab.slopeRad[s]).toBeGreaterThan(0.3);
      expect(tab.slopeRad[s]).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
      expect(tab.rimM[s]).toBeGreaterThan(0.3);
      expect(tab.rimM[s]).toBeLessThanOrEqual(tab.topM + 1e-9);
    }
    const pts = rockQueryPoints(tab);
    for (let s = 0; s < tab.sectors; s += 1) {
      const r = Math.hypot(pts[s * 2] - tab.centerX, pts[s * 2 + 1] - tab.centerZ);
      expect(r).toBeGreaterThan(tab.waterlineM[s]);
    }
  });
});

describe('the face relations', () => {
  it('reflects most of a wave from a steep face and little from a gentle one (Seelig and Ahrens)', () => {
    const steep = rockReflection(rockIribarren((75 * Math.PI) / 180, 3, 120));
    const gentle = rockReflection(rockIribarren((12 * Math.PI) / 180, 3, 120));
    expect(steep).toBeGreaterThan(0.75);
    expect(steep).toBeLessThanOrEqual(ROCK_REFLECT_A);
    expect(gentle).toBeLessThan(0.45);
  });

  it('runs a crest up the face by its reflection and its velocity head', () => {
    const tab = deepTable();
    const out = newImpact();
    const s = 0;
    const u = 3;
    const w = { etaM: 1, velX: -u * tab.normalX[s], velY: 0, velZ: -u * tab.normalZ[s], deficit: 0 };
    rockFaceImpact(tab, s, w, SEA, out);
    const kr = rockReflection(rockIribarren(tab.slopeRad[s], SEA.hsM, SEA.peakLengthM));
    expect(out.inflowMs).toBeCloseTo(u, 5);
    expect(out.runUpM).toBeCloseTo(1 + kr + (ROCK_ROUGH_GAMMA * u * u) / (2 * GRAVITY_MS2), 5);
    // The same crest passing the lee face (its parcels moving away) stands at the sea's level.
    const lee = rockFaceImpact(tab, s, { etaM: 1, velX: u * tab.normalX[s], velY: 0, velZ: u * tab.normalZ[s], deficit: 0 }, SEA, newImpact());
    expect(lee.runUpM).toBeCloseTo(1, 6);
    expect(lee.jet).toBe(0);
  });

  it('adds the breaking front where the sea whitens at the face', () => {
    const tab = deepTable();
    const s = 0;
    const calm = newImpact();
    const broken = newImpact();
    const base = { etaM: 1, velX: -1 * tab.normalX[s], velY: 0, velZ: -1 * tab.normalZ[s] };
    rockFaceImpact(tab, s, { ...base, deficit: 0 }, SEA, calm);
    rockFaceImpact(tab, s, { ...base, deficit: 0.6 }, SEA, broken);
    expect(broken.breaking).toBe(1);
    expect(broken.inflowMs).toBeCloseTo(calm.inflowMs + 0.4 * SEA.crestSpeedMs, 5);
    expect(broken.runUpM).toBeGreaterThan(calm.runUpM);
  });

  it('makes no jet from a slow or low crest, and a higher plume from a faster, higher one', () => {
    const tab = table();
    const s = 0;
    const at = (eta: number, u: number) => rockFaceImpact(tab, s,
      { etaM: eta, velX: -u * tab.normalX[s], velY: 0, velZ: -u * tab.normalZ[s], deficit: 0 }, SEA, newImpact());
    expect(at(0.1, 6).jet).toBe(0);
    // A slow crest that is low for the reef surges up the face and throws nothing.
    expect(at(0.5, 0.8).jet).toBe(0);
    const mid = at(1.0, 3.5);
    const big = at(1.8, 5.5);
    expect(mid.jet).toBeGreaterThan(0);
    expect(big.jet).toBeGreaterThanOrEqual(mid.jet);
    expect(big.jetMs).toBeGreaterThan(mid.jetMs);
    // Round 7: the launch is the wedge's law, the crest closing at its
    // shallow-water celerity on the reef (the surface does not rise here, so
    // the meeting point runs at the front's contact speed).
    const sinA = Math.sin(tab.slopeRad[s]);
    const close = Math.sqrt(GRAVITY_MS2 * (tab.reefDepthM + 1.8 * 1.8)) * big.struck;
    const wedge = rockWedge(tab.slopeRad[s], 0, close, big.inflowMs);
    // Round 19: the jet leaves at sqrt(1 - C) of the water's speed over the meeting point, C the crest's air share at
    // the face (THE JET'S SPEED CARRIES THE CREST'S AIR, rockAeratedJetSpeed); a clear crest (C 0) is the round-7 law.
    expect(big.jetMs).toBeCloseTo(Math.min(rockAeratedJetSpeed(wedge.vMeetMs, wedge.uRelMs, big.jetAirC ?? 0) * sinA, ROCK_JET_MAX_MS), 5);
    expect(big.jetMs).toBeLessThanOrEqual(Math.min(wedge.wAlongMs * sinA, ROCK_JET_MAX_MS) + 1e-9);
    // Round 9: its mass: the apex's share rho u_A (H - y_P) per meter of face, times the regime
    // gates (y_P = 0 here); the sheet leaves at the Bernoulli speed of the incident's stagnation
    // (wedge.uRelMs). Round 12: u_A is the inflow less K_r h of the shoaled linear wave's water
    // speed (THE APEX MEETS THE REFLECTED LINEAR WAVE; round 9 took (1 - K_r h) u, the heading twice).
    const krF = rockReflection(rockIribarren(tab.slopeRad[s], SEA.hsM, SEA.peakLengthM));
    const uN = rockApexClosingSpeed(big.inflowMs, krF, 1, 1.8, tab.reefDepthM);
    expect(big.apexMs).toBeCloseTo(uN, 9);
    const apex = rockWedge(tab.slopeRad[s], 0, close, uN);
    expect(big.jetShare).toBeCloseTo(apex.share, 9);
    // Round 19: by continuity at the launch the mass rate falls by sqrt(1 - C) too (THE JET'S SPEED CARRIES THE CREST'S AIR).
    expect(big.jetKgPerMS).toBeCloseTo(big.jet * 1025 * uN * big.standingM * apex.share * Math.sqrt(1 - (big.jetAirC ?? 0)), 3);
    expect(big.jetSheetM).toBeCloseTo((uN * big.standingM * apex.share) / wedge.uRelMs, 6);
    // The plume's height is the launch speed's head.
    expect((big.jetMs ** 2) / (2 * GRAVITY_MS2)).toBeGreaterThan((mid.jetMs ** 2) / (2 * GRAVITY_MS2));
  });

  it('throws a jet only from a face the wave meets head on (round 4)', () => {
    const tab = table();
    const s = 0;
    const nx = tab.normalX[s]; const nz = tab.normalZ[s];
    const u = 5.5;
    const headOn = rockFaceImpact(tab, s, { etaM: 1.8, velX: -u * nx, velY: 0, velZ: -u * nz, deficit: 0 }, SEA, newImpact());
    expect(headOn.struck).toBeCloseTo(1, 6);
    expect(headOn.jet).toBeGreaterThan(0.5);
    // The same crest running along the face at 80 degrees off its normal.
    const a = (80 * Math.PI) / 180;
    const tx = -nz; const tz = nx;
    const vx = -u * (Math.cos(a) * nx + Math.sin(a) * tx);
    const vz = -u * (Math.cos(a) * nz + Math.sin(a) * tz);
    const along = rockFaceImpact(tab, s, { etaM: 1.8, velX: vx, velY: 0, velZ: vz, deficit: 0 }, SEA, newImpact());
    expect(along.struck).toBeLessThan(0.2);
    expect(along.jet).toBe(0);
  });

  it('breaks a crest that is high for the reef and throws its bore into the face (McCowan, Stoker)', () => {
    const shallow = table();
    const deep = { ...shallow, reefDepthM: 40 };
    const s = 0;
    const w = { etaM: 1.5, velX: -0.8 * shallow.normalX[s], velY: 0, velZ: -0.8 * shallow.normalZ[s], deficit: 0 };
    const onReef = rockFaceImpact(shallow, s, w, SEA, newImpact());
    const offReef = rockFaceImpact(deep, s, w, SEA, newImpact());
    expect(onReef.breaking).toBeGreaterThan(0.5);
    expect(onReef.inflowMs).toBeGreaterThan(3);
    expect(onReef.jet).toBeGreaterThan(0);
    expect(offReef.breaking).toBe(0);
    expect(offReef.jet).toBe(0);
    // The bore relations: a 2 m bore on a 4 m reef moves its water at 2.9 m/s.
    expect(rockBoreWaterSpeed(2, 4)).toBeCloseTo(2.87, 1);
    expect(rockBoreWaterSpeed(0, 4)).toBe(0);
  });

  it('flows over the top edge by the weir law and not at all under it', () => {
    const tab = table();
    const s = 3;
    const u = 0;
    const under = rockFaceImpact(tab, s, { etaM: tab.rimM[s] * 0.2, velX: u, velY: 0, velZ: u, deficit: 0 }, SEA, newImpact());
    expect(under.overtopM2s).toBe(0);
    const eta = tab.rimM[s];
    const into = { velX: -2 * tab.normalX[s], velY: 0, velZ: -2 * tab.normalZ[s] };
    const over = rockFaceImpact(tab, s, { etaM: eta, ...into, deficit: 0 }, SEA, newImpact());
    const head = over.runUpM - tab.rimM[s];
    expect(head).toBeGreaterThan(0);
    expect(over.overtopM2s).toBeCloseTo(ROCK_WEIR_C * head ** 1.5, 6);
    expect(ROCK_WEIR_C).toBeCloseTo(1.705, 2);
  });
});

describe('the simulation', () => {
  it('reads the sea params of the storm', () => {
    const sea = rockSeaParams(oceanSeaState('storm'), 4.23);
    expect(sea.peakLengthM).toBeGreaterThan(100);
    expect(sea.crestSpeedMs).toBeGreaterThan(8);
    expect(sea.windSpeedMs).toBe(20);
  });

  it('keeps a calm sea quiet: no burst, no particle, no foam', () => {
    const tab = table();
    const sim = new RockSurf([tab], SEA);
    const hist = regularHistory(tab, 0.15, 6, 0, 12);
    sim.reset(0);
    for (let i = 0; i < 12 * 60; i += 1) sim.step(ROCK_DT_S, hist);
    const r = sim.rocks[0];
    expect(r.jetsSeen).toBe(0);
    expect(r.particlesThrown).toBe(0);
    expect(sim.alive).toBe(0);
    let foam = 0;
    for (const f of r.foamAmount) foam += f;
    expect(foam).toBe(0);
    expect(r.topWaterM3).toBe(0);
    // Nothing for the sea's foam field either.
    expect(rockFoamSources(sim, sim.time, 96)).toHaveLength(0);
  });

  it('throws a plume, washes over and lays foam under a big breaking sea', () => {
    const tab = table();
    const sim = new RockSurf([tab], SEA);
    const hist = regularHistory(tab, 2.2, 8, 0, 16, 0.7);
    sim.reset(0);
    let maxAlive = 0;
    for (let i = 0; i < 16 * 60; i += 1) {
      sim.step(ROCK_DT_S, hist);
      maxAlive = Math.max(maxAlive, sim.alive);
    }
    const r = sim.rocks[0];
    expect(r.jetsSeen).toBeGreaterThan(0);
    expect(r.particlesThrown).toBeGreaterThan(50);
    expect(maxAlive).toBeGreaterThan(300);
    // The sheets broke up: strands, drops and mist flew too (the shared model).
    const em = sim.splash.emitted;
    expect(em[SPLASH_LIGAMENT]).toBeGreaterThan(em[SPLASH_SHEET]);
    expect(em[SPLASH_DROP]).toBeGreaterThan(em[SPLASH_SHEET]);
    expect(em[SPLASH_MIST]).toBeGreaterThan(0);
    expect(sim.splash.landedSea).toBeGreaterThan(0);
    // The same white water is handed to the sea's foam field as timed discs.
    const src = rockFoamSources(sim, sim.time, 96);
    expect(src.length).toBeGreaterThan(5);
    expect(src.length).toBeLessThanOrEqual(96);
    for (const s of src) {
      expect(s.s).toBeGreaterThan(0);
      expect(s.s).toBeLessThanOrEqual(1);
      expect(s.t1S).toBeGreaterThan(s.t0S);
    }
    expect(r.peakRunUpM).toBeGreaterThan(tab.rimM[0]);
    let foam = 0;
    for (const f of r.foamAmount) foam += f;
    expect(foam).toBeGreaterThan(1);
    // The swash reached the top: the struck faces are wet to their rims.
    const struck = r.sectors.map((s, i) => s.wetM - tab.rimM[i]);
    expect(Math.max(...struck)).toBeGreaterThanOrEqual(0);
    // (Round 8: the launch throws more jet water, so more parcels; 60 s allowed.)
  }, 60000);

  it('wets a face above the incoming crest: the reflection and the velocity head', () => {
    const tab = table();
    const sim = new RockSurf([tab], SEA);
    const hist = regularHistory(tab, 0.5, 8, 0, 16);
    sim.reset(0);
    for (let i = 0; i < 16 * 60; i += 1) sim.step(ROCK_DT_S, hist);
    const wet = Math.max(...sim.rocks[0].sectors.map((s) => s.wetM));
    expect(wet).toBeGreaterThan(0.8);
    expect(sim.rocks[0].jetsSeen).toBe(0);
  });

  it('replays bit for bit from a pinned start', () => {
    const tab = table();
    const hist = regularHistory(tab, 2.0, 7, 0, 10, 0.6);
    const run = () => {
      const sim = new RockSurf([tab], SEA);
      sim.reset(0);
      for (let i = 0; i < 10 * 60; i += 1) sim.step(ROCK_DT_S, hist);
      return sim;
    };
    const a = run();
    const b = run();
    expect(Array.from(a.splash.pos)).toEqual(Array.from(b.splash.pos));
    expect(Array.from(a.splash.aliveIndex.subarray(0, a.splash.alive))).toEqual(Array.from(b.splash.aliveIndex.subarray(0, b.splash.alive)));
    expect(Array.from(a.rocks[0].foamAmount)).toEqual(Array.from(b.rocks[0].foamAmount));
    expect(rockFoamSources(a, a.time, 96)).toEqual(rockFoamSources(b, b.time, 96));
    expect(a.rocks[0].sectors.map((s) => s.swashM)).toEqual(b.rocks[0].sectors.map((s) => s.swashM));
    // A reset clears everything, so a second run on one object is the same run.
    a.reset(0);
    for (let i = 0; i < 10 * 60; i += 1) a.step(ROCK_DT_S, hist);
    expect(Array.from(a.splash.pos)).toEqual(Array.from(b.splash.pos));
    expect(rockFoamSources(a, a.time, 96)).toEqual(rockFoamSources(b, b.time, 96));
    // (Two runs of 10 s and a third: about 6 s on this machine with the
    // round-8 launch law, round 8: more jet water, more parcels; 60 s allowed.)
  }, 60000);

  it('lays the pinned start on the step lattice, ending exactly at the pinned time', () => {
    const t = rockPrimeTimes(42);
    expect(t.length).toBe(ROCK_PRIME_S * ROCK_SAMPLE_HZ + 1);
    expect(t[t.length - 1]).toBe(42);
    expect(t[0]).toBeCloseTo(42 - ROCK_PRIME_S, 9);
    expect(Math.round((ROCK_PRIME_S / ROCK_DT_S) * 1e6) / 1e6 % 1).toBe(0);
  });

  it('interpolates the history linearly and refuses rows out of order', () => {
    const h = new RockSeaHistory(1);
    h.push(0, Float32Array.from([0, 0, 0, 0, 0]));
    h.push(1, Float32Array.from([2, 1, 0, 0, 0.5]));
    const w = { etaM: 0, velX: 0, velY: 0, velZ: 0, deficit: 0 };
    h.at(0.25, 0, w);
    expect(w.etaM).toBeCloseTo(0.5, 6);
    expect(w.deficit).toBeCloseTo(0.125, 6);
    expect(() => h.push(0.5, new Float32Array(5))).toThrow();
  });
});

describe('the shared splash model', () => {
  const env = { airX: 5, airZ: 0, seaHeight: () => 0 };
  it('breaks a sheet into strands, drops and mist, and lands them in the sea', () => {
    const pool = new SplashPool(4096, 7);
    for (let k = 0; k < 20; k += 1) pool.emit(SPLASH_SHEET, 0, 0.5, 0, 0, 7, 0, 0.3, 0);
    let peak = 0;
    for (let i = 0; i < 4 * 60; i += 1) { pool.step(1 / 60, env); peak = Math.max(peak, pool.alive); }
    expect(pool.emitted[SPLASH_LIGAMENT]).toBeGreaterThan(20);
    expect(pool.emitted[SPLASH_DROP]).toBeGreaterThan(20);
    expect(pool.emitted[SPLASH_MIST]).toBeGreaterThan(0);
    expect(peak).toBeGreaterThan(60);
    expect(pool.landedSea).toBeGreaterThan(20);
    // Everything thrown up has come down or faded in 4 s.
    expect(pool.alive).toBe(0);
  });

  it('replays bit for bit and takes a caller\'s opacity down to its children', () => {
    const run = () => {
      const p = new SplashPool(2048, 11);
      p.emit(SPLASH_SHEET, 0, 0, 0, 1, 6, 0, 0.25, 0, 0.3);
      for (let i = 0; i < 60; i += 1) p.step(1 / 60, env);
      return p;
    };
    const a = run();
    const b = run();
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
    for (let k = 0; k < a.alive; k += 1) expect(a.opacity[a.aliveIndex[k]]).toBeCloseTo(0.3, 6);
  });

  it('lights a plume as a volume: its core gets less sun than its edge', () => {
    const pool = new SplashPool(4096, 3);
    // A dense ball of sheets 1 m across, and one lone drop 3 m to its sunward side.
    for (let k = 0; k < 400; k += 1) {
      const u = pool.random(); const v = pool.random(); const w = pool.random();
      pool.emit(SPLASH_SHEET, (u - 0.5), 2 + (v - 0.5), (w - 0.5), 0, 0, 0, 0.3, 0);
    }
    const lone = pool.emit(SPLASH_DROP, 0, 5, 0, 0, 0, 0, 0.03, 0);
    const core = pool.aliveIndex[0];
    const out = new Float32Array(pool.capacity * 2);
    splashLight(pool, 0, 1, 0, out, () => 1);
    // Sun from straight above: the lone drop over the ball is in full sun.
    expect(out[lone * 2]).toBeGreaterThan(0.95);
    let minSun = 1;
    for (let k = 0; k < 400; k += 1) minSun = Math.min(minSun, out[pool.aliveIndex[k] * 2]);
    expect(minSun).toBeLessThan(0.5);
    expect(out[core * 2 + 1]).toBeGreaterThanOrEqual(0.45);
  });

  it('fills the plume from its water: sigma = Q S_v / 4 summed, dense at its base, dark in its core (round 6)', () => {
    const pool = new SplashPool(8192, 5);
    // A column of drop parcels (1 kg of 8 mm drops each): many at its base (0 to 1 m up), few at its top (3 to 4 m).
    const d32 = 0.008;
    for (let k = 0; k < 600; k += 1) {
      const u = pool.random(); const v = pool.random(); const w = pool.random();
      pool.emit(SPLASH_DROP, (u - 0.5) * 1.2, v, (w - 0.5) * 1.2, 0, 0, 0, 0.3, 0, 1, 1, 6 / d32);
    }
    for (let k = 0; k < 20; k += 1) {
      const u = pool.random(); const v = pool.random(); const w = pool.random();
      pool.emit(SPLASH_DROP, (u - 0.5) * 1.2, 3 + v, (w - 0.5) * 1.2, 0, 0, 0, 0.3, 0, 1, 1, 6 / d32);
    }
    // A particle of another owner, a fall and a particle with no water add nothing.
    pool.emit(SPLASH_DROP, 0, 1, 0, 0, 0, 0, 0.3, 1, 1, 1, 6 / d32);
    pool.emit(SPLASH_FALL, 0, 1, 0, 0, 0, 0, 0.05, 0);
    pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 0, 0, 0.3, 0);
    const vol = new SplashVolume({ nx: 24, ny: 32, nz: 24, cellM: 0.2 });
    vol.build(pool, 0);
    expect(vol.empty).toBe(false);
    // Round 13: the drops' water is laid on the light grid (0.4 m cells; THE SPRITES' WATER IS LAID ON
    // THE LIGHT GRID), which the light marches; the 0.2 m grid holds only the continuum (none here).
    expect(vol.sigma.every((s) => s === 0)).toBe(true);
    vol.light(0, 1, 0);
    const lAt0 = (x: number, y: number, z: number) => {
      const ix = Math.floor((x - vol.ox) / 0.4); const iy = Math.floor((y - vol.oy) / 0.4); const iz = Math.floor((z - vol.oz) / 0.4);
      return (iz * vol.ly + iy) * vol.lx + ix;
    };
    // Dense and opaque at its base: over 0.4 m the base is more than 90% opaque.
    expect(vol.lightSigma[lAt0(0, 0.5, 0)]).toBeGreaterThan(6);
    expect(vol.lightSigma[lAt0(0, 0.5, 0)]).toBeGreaterThan(4 * vol.lightSigma[lAt0(0, 3.5, 0)]);
    // The cross-section is kept by the deposit: sum(sigma) V_cell = 620 Q S_v (m / rho) / 4 = 620 x 3 (m / rho) / D32.
    let total = 0;
    for (const s of vol.lightSigma) total += s;
    const expected = (620 * SPLASH_Q_EXT * SPLASH_CAUCHY * (6 / d32) * (1 / SPLASH_WATER_RHO)) / 0.064;
    expect(total).toBeGreaterThan(expected * 0.97);
    expect(total).toBeLessThan(expected * 1.03);
    expect(vol.massKg).toBeCloseTo(620, 3);
    // The drops counted: N = m / (rho pi <D^3> / 6) for the gamma law.
    expect(vol.drops).toBeCloseTo(620 * splashDropCount(1, d32), -1);
    // Lit from above: the top gets more sun and sky than the base's core.
    vol.light(0, 1, 0);
    const lAt = (x: number, y: number, z: number) => {
      const ix = Math.floor((x - vol.ox) / 0.4); const iy = Math.floor((y - vol.oy) / 0.4); const iz = Math.floor((z - vol.oz) / 0.4);
      return (iz * vol.ly + iy) * vol.lx + ix;
    };
    expect(vol.sun[lAt(0, 4.5, 0)]).toBeGreaterThan(0.9);
    expect(vol.sun[lAt(0, 3.8, 0)]).toBeGreaterThan(vol.sun[lAt(0, 0.3, 0)] + 0.1);
    // No floor (round 6): the direct sun is all but gone in the dense base,
    // and the light scattered many times there is the two-flux share.
    expect(vol.sun[lAt(0, 0.3, 0)]).toBeLessThan(0.05);
    expect(vol.tauCore).toBeGreaterThan(3);
    expect(vol.sunMs[lAt(0, 0.3, 0)]).toBeLessThan(vol.sunMs[lAt(0, 1.0, 0)] + 1e-6);
    expect(vol.sky[lAt(0, 0.3, 0)]).toBeLessThan(vol.sky[lAt(0, 3.8, 0)]);
    // Pure: the same pool gives the same grids.
    const again = new SplashVolume({ nx: 24, ny: 32, nz: 24, cellM: 0.2 });
    again.build(pool, 0);
    again.light(0, 1, 0);
    expect(Array.from(again.lightSigma)).toEqual(Array.from(vol.lightSigma));
    expect(Array.from(again.sun)).toEqual(Array.from(vol.sun));
    // An owner with no water leaves the grid empty.
    const none = new SplashVolume({ nx: 8, ny: 8, nz: 8, cellM: 0.2 });
    none.build(pool, 2);
    expect(none.empty).toBe(true);
  });

  it('reddens a low sun through the air and leaves the test sun as it is', () => {
    const t30 = sunThroughAir(Math.PI / 6);
    for (const c of t30) expect(c).toBeCloseTo(1, 6);
    const t6 = sunThroughAir((6 * Math.PI) / 180);
    expect(t6[0]).toBeGreaterThan(t6[1]);
    expect(t6[1]).toBeGreaterThan(t6[2]);
    expect(t6[2]).toBeLessThan(0.2);
  });
});

describe('the burst\'s shape (round 4)', () => {
  it('leans the jet back over the sea, away from the struck rock', () => {
    const tab = table();
    const sea = { ...SEA };
    const surf = new RockSurf([tab], sea, { seed: 9 });
    const hist = new RockSeaHistory(tab.sectors);
    const s = 0;
    const nx = tab.normalX[s]; const nz = tab.normalZ[s];
    // A high, fast crest meets face 0 head on for a second; every other face sees still water.
    const row = (on: boolean) => {
      const r = new Float32Array(tab.sectors * ROCK_SAMPLE_STRIDE);
      if (on) { r[0] = 1.8; r[1] = -5.5 * nx; r[3] = -5.5 * nz; }
      return r;
    };
    hist.push(0, row(true), 1e9);
    hist.push(1, row(true), 1e9);
    surf.reset(0);
    for (let k = 0; k < 20; k += 1) surf.step(ROCK_DT_S, hist);
    const p = surf.splash;
    let sheets = 0; let out = 0;
    for (let a = 0; a < p.alive; a += 1) {
      const i = p.aliveIndex[a];
      if (p.kind[i] !== SPLASH_SHEET) continue;
      sheets += 1;
      if (p.vel[i * 3] * nx + p.vel[i * 3 + 2] * nz > 0) out += 1;
    }
    expect(sheets).toBeGreaterThan(10);
    // Nearly every fresh sheet leaves seaward (the spread is 0.08 rad about a lean of 0.14 to 0.38).
    expect(out / sheets).toBeGreaterThan(0.95);
  });

  it('spreads a parcel by its drops\' own spread and keeps its cross-section (round 6)', () => {
    const pool = new SplashPool(64, 3);
    const i = pool.emit(SPLASH_DROP, 0, 2, 0, 0, 2, 0, 0.1, 0, 1, 1, 6 / 0.008);
    const vol = new SplashVolume({ nx: 24, ny: 40, nz: 24, cellM: 0.2 });
    const r0 = vol.kernelCells(pool, i);
    pool.age[i] = 0.5;
    const r1 = vol.kernelCells(pool, i);
    // At birth the parcel is its own size (under a cell: the numeric floor); with age its drops spread (jitter |v| a).
    expect(r0).toBeCloseTo(0.9, 6);
    // Round 6: the spread is the capillary (Taylor-Culick) speed of its size, not a share of its speed.
    expect(pool.spreadMs[i]).toBeCloseTo(splashCapillarySpeed(0.008), 6);
    expect(r1).toBeCloseTo(Math.max((0.05 + pool.spreadMs[i] * 0.5) / 0.2, 0.9), 6);
    vol.build(pool, 0);
    // Round 13: a drop parcel's water is laid on the light grid (THE SPRITES' WATER IS LAID ON THE LIGHT
    // GRID): half at each end of its streak, centered on the parcel, its cross-section kept.
    vol.light(0, 1, 0);
    const { lx, ly, lz } = vol;
    let total = 0; let my = 0; let mx = 0;
    for (let z = 0; z < lz; z += 1) for (let y = 0; y < ly; y += 1) for (let x = 0; x < lx; x += 1) {
      const v = vol.lightSigma[(z * ly + y) * lx + x];
      if (v <= 0) continue;
      total += v; my += v * (vol.oy + (y + 0.5) * 0.4); mx += v * (vol.ox + (x + 0.5) * 0.4);
    }
    expect(total * 0.064).toBeCloseTo(SplashVolume.crossSection(pool, i), 6);
    expect(my / total).toBeCloseTo(pool.pos[i * 3 + 1], 6);
    expect(mx / total).toBeCloseTo(pool.pos[i * 3], 6);
  });
});

describe('the plume by its drop count (round 6)', () => {
  it('launches the flip-through jet at w = v_c + sqrt(v_c^2 + c^2) and takes the wedge\'s share of the water', () => {
    // A still surface: the jet leaves at the closing speed (Bernoulli in the meeting point's frame).
    expect(rockFlipThroughSpeed(0, 7)).toBeCloseTo(7, 9);
    // A rising surface adds twice its speed in the limit of a slow crest.
    expect(rockFlipThroughSpeed(3, 0)).toBeCloseTo(6, 9);
    expect(rockFlipThroughSpeed(2, 6)).toBeCloseTo(2 + Math.sqrt(40), 9);
    // Birkhoff's share sin^2(beta / 2), beta = slope - 30 degrees; none on a face gentler than the breaking front.
    expect(rockJetMassShare((25 * Math.PI) / 180)).toBe(0);
    expect(rockJetMassShare((90 * Math.PI) / 180)).toBeCloseTo(Math.sin(Math.PI / 6) ** 2, 9);
    expect(rockJetMassShare((60 * Math.PI) / 180)).toBeLessThan(rockJetMassShare((80 * Math.PI) / 180));
  });

  it('a surface that rises faster than the front\'s contact makes a faster, thinner jet (flip-through, round 7)', () => {
    const tab = table();
    const s = 0;
    const nx = tab.normalX[s]; const nz = tab.normalZ[s];
    const still = rockFaceImpact(tab, s, { etaM: 1.8, velX: -5.5 * nx, velY: 0, velZ: -5.5 * nz, deficit: 0 }, SEA, newImpact());
    const slow = rockFaceImpact(tab, s, { etaM: 1.8, velX: -5.5 * nx, velY: 0.3, velZ: -5.5 * nz, deficit: 0 }, SEA, newImpact());
    const rising = rockFaceImpact(tab, s, { etaM: 1.8, velX: -5.5 * nx, velY: 12, velZ: -5.5 * nz, deficit: 0 }, SEA, newImpact());
    // A rise slower than the front's contact does not move the meeting point: the same jet.
    expect(slow.jetMs).toBeCloseTo(still.jetMs, 9);
    expect(slow.jetKgPerMS).toBeCloseTo(still.jetKgPerMS, 6);
    // A rise faster than it: a faster jet that takes less of the water (Cooker and Peregrine).
    expect(rising.jetMs).toBeGreaterThanOrEqual(still.jetMs);
    expect(rising.jetShare).toBeLessThan(still.jetShare);
    expect(rising.jetKgPerMS).toBeLessThan(still.jetKgPerMS);
    expect(rising.jetSheetM).toBeLessThan(still.jetSheetM);
  });

  it('sets the jet by the wedge: the meeting angle and the closing speed (round 7)', () => {
    const vertical = Math.PI / 2;
    const betaF = vertical - ROCK_FRONT_SLOPE_RAD;
    // A direct impact whose water moves at the front's speed: Birkhoff's steady
    // collapse, w = c (cot beta + csc beta), share sin^2(beta_f / 2), the round-6 share.
    const d = rockWedge(vertical, 0, 6, 6);
    expect(d.vMeetMs).toBeCloseTo(6 / Math.tan(betaF), 9);
    expect(d.wAlongMs).toBeCloseTo(6 * (1 / Math.tan(betaF) + 1 / Math.sin(betaF)), 9);
    expect(d.share).toBeCloseTo(rockJetMassShare(vertical), 9);
    // Water slower than its front meets the face at a smaller angle: a smaller share.
    const slowWater = rockWedge(vertical, 0, 6, 4);
    expect(slowWater.share).toBeLessThan(d.share);
    expect(slowWater.betaRad).toBeLessThan(betaF);
    // The flip-through: the water at the face rises far faster than the front closes.
    const flip = rockWedge(vertical, 30, 6, 4);
    expect(flip.share).toBeLessThan(0.01);
    expect(flip.wAlongMs).toBeGreaterThan(2 * 30);
    expect(flip.share).toBeCloseTo(0.5 * (1 - 30 / Math.hypot(30, 4)), 12);
    // A face gentler than the breaking front throws nothing.
    expect(rockWedge((25 * Math.PI) / 180, 0, 6, 4).share).toBe(0);
    // Round 8: the front's climb is c sin 30 / sin(alpha + 30), bounded on every face
    // (round 7's c / tan(alpha - 30) gave 2.1 c on a 55 degree face and grew without a limit).
    const a55 = (55 * Math.PI) / 180;
    expect(rockFrontClimbSpeed(a55, 6)).toBeCloseTo((6 * 0.5) / Math.sin(a55 + Math.PI / 6), 12);
    expect(rockFrontClimbSpeed(vertical, 6)).toBeCloseTo(6 * Math.tan(Math.PI / 6), 12);
    for (let deg = 31; deg <= 90; deg += 1) {
      const w = rockWedge((deg * Math.PI) / 180, 0, 6, 4);
      expect(w.vMeetMs).toBeLessThanOrEqual(6 * 0.58);
      expect(w.wAlongMs).toBeLessThan(1.7 * 6);
    }
  });

  it('runs the meeting point at the water column\'s rise from the history when it is faster (round 8)', () => {
    const tab = table();
    const s = 0;
    const nx = tab.normalX[s]; const nz = tab.normalZ[s];
    const w0 = { etaM: 1.8, velX: -5.5 * nx, velY: 0, velZ: -5.5 * nz, deficit: 0 };
    const still = rockFaceImpact(tab, s, w0, SEA, newImpact(), 0, 0);
    const parcel = rockFaceImpact(tab, s, { ...w0, velY: 12 }, SEA, newImpact(), 0, 0);
    const column = rockFaceImpact(tab, s, w0, SEA, newImpact(), 0, 12);
    // The column's rise sets the meeting point, the parcel's vertical speed no longer does.
    expect(parcel.jetMs).toBeCloseTo(still.jetMs, 9);
    expect(column.jetMs).toBeGreaterThan(still.jetMs);
    expect(column.jetShare).toBeLessThan(still.jetShare);
  });

  it('ends the jet when the meeting point reaches the crest\'s top: the wedge\'s water is thrown once (round 7)', () => {
    const tab = table();
    const s = 0;
    const nx = tab.normalX[s]; const nz = tab.normalZ[s];
    const sim = new RockSurf([tab], SEA);
    const hist = new RockSeaHistory(tab.sectors);
    // The crest at the face for 3 s, from the still level (round 8: a step from
    // the trough in 0.1 s would be a 23 m/s column rise, a flip-through).
    const row = (eta: number) => {
      const r = new Float32Array(tab.sectors * ROCK_SAMPLE_STRIDE);
      r[0] = eta; r[1] = -5.5 * nx; r[3] = -5.5 * nz;
      return r;
    };
    hist.push(0, row(1.8), 1e9);
    hist.push(3.1, row(1.8), 1e9);
    sim.reset(0);
    for (let k = 0; k < Math.round(3 / ROCK_DT_S); k += 1) sim.step(ROCK_DT_S, hist);
    const st = sim.rocks[0].sectors[s];
    // The gate is still open (the crest stands at the face), but the wedge is spent.
    expect(st.gatePrev).toBeGreaterThan(0);
    expect(st.jetKgPerMS).toBe(0);
    expect(st.meetM).toBeGreaterThan(st.standingM);
    // The water thrown is the wedge's: share rho u H^2 / (2 v_P sin(slope)) per
    // meter (H from the trough), within the gate's ramp and the steps.
    const w = { etaM: 1.8, velX: -5.5 * nx, velY: 0, velZ: -5.5 * nz, deficit: 0 };
    const im = rockFaceImpact(tab, s, w, SEA, newImpact(), 0, 0);
    const H = im.standingM;
    // Round 9: the apex's water arrives at the net speed; round 12: that speed is im.apexMs (rockApexClosingSpeed).
    const perM = im.jetGate * (1025 * im.apexMs * im.jetShare * H * H) / (2 * im.meetMs);
    const thrown = sim.rocks[0].jetKg / tab.widthM[s];
    // (Under the steady figure: the gate ramps up and the crest's top still
    // rises while the meeting point climbs its first part.)
    expect(thrown).toBeGreaterThan(0.6 * perM);
    expect(thrown).toBeLessThan(1.05 * perM);
    // Round 8: the comparison with round 6's three seconds of the bore's flux is gone. Round 6
    // took sin^2((slope - 30 deg) / 2) of it (0.04 on this 53 deg face); the round-8 wedge's
    // share is 0.34 here, so the water swept once is now larger than that figure.
    expect(sim.rocks[0].strikesKg.length + (sim.rocks[0].strikeNow ? 1 : 0)).toBe(1);
  });

  it('opens holes where the bubbles span the sheet, more as it thins (Deane and Stokes; round 7)', () => {
    // A clear sheet has no holes; an aerated one none at its launch (no bubble is larger than it).
    expect(splashSpanningHoles(0.05, 0.08, 0)).toBe(0);
    expect(splashSpanningHoles(0.08, 0.08, 0.5)).toBe(0);
    const a = splashSpanningHoles(0.04, 0.08, 0.5);
    const b = splashSpanningHoles(0.02, 0.08, 0.5);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    // More air, more holes, in proportion.
    expect(splashSpanningHoles(0.02, 0.08, 0.25)).toBeCloseTo(b / 2, 6);
  });

  it('punctures an aerated sheet into its rims\' ligaments and keeps a clear one whole (Taylor-Culick, Avrami; round 7)', () => {
    const fly = (voidShare: number) => {
      const pool = new SplashPool(20000, 4);
      for (let k = 0; k < 20; k += 1) {
        const i = pool.emit(SPLASH_SHEET, 3, 1, 0, 3, 9, 0, 0.2, 0, 1, 8, 2 / 0.04, 0.04);
        pool.markSheet(i, voidShare, 0, 0);
      }
      const env = { airX: 0, airZ: 0, seaHeight: () => -50 };
      let thinnest = Infinity;
      for (let k = 0; k < 150; k += 1) {
        pool.step(1 / 60, env);
        for (let n = 0; n < pool.alive; n += 1) {
          const i = pool.aliveIndex[n];
          if (pool.kind[i] === SPLASH_SHEET && pool.mass[i] > 0) thinnest = Math.min(thinnest, pool.scaleM[i]);
        }
      }
      return { pool, thinnest, stats: splashSheetStats(pool) };
    };
    const clear = fly(0);
    expect(clear.stats.clear).toBe(20);
    expect(clear.stats.gone).toBe(0);
    const aer = fly(0.5);
    expect(aer.stats.gone).toBeGreaterThan(0);
    expect(aer.pool.sheets.rimKg).toBeGreaterThan(0);
    // The sheet thins as it spreads round the axis: h = h0 r0 / r (r grows at 3 m/s from 3 m).
    expect(aer.thinnest).toBeLessThan(0.04 * 0.6);
    // The water is kept.
    const p = aer.pool;
    expect(p.massAlive() + p.massLanded + p.massLost + p.massExpired).toBeCloseTo(p.massEmitted, 3);
    expect(SPLASH_SHEET_GONE_X).toBeCloseTo(1 - Math.exp(-3), 12);
  });

  it('keeps the water: what the jet throws is in the air, landed or lost, as it breaks into strands, drops and mist', () => {
    const pool = new SplashPool(20000, 9);
    for (let k = 0; k < 40; k += 1) pool.emit(SPLASH_SHEET, 0, 0.5, 0, 0.5, 8, 0, 0.3, 0, 1, 8, 2 / 0.05, 0.05);
    const env = { airX: 0, airZ: 0, seaHeight: () => 0 };
    let kinds = new Set<number>();
    for (let k = 0; k < 240; k += 1) {
      pool.step(1 / 60, env);
      for (let a = 0; a < pool.alive; a += 1) kinds.add(pool.kind[pool.aliveIndex[a]]);
      const ledger = pool.massAlive() + pool.massLanded + pool.massLost + pool.massExpired;
      expect(ledger).toBeCloseTo(pool.massEmitted, 2);
    }
    expect(pool.massEmitted).toBeCloseTo(320, 6);
    expect(kinds.has(SPLASH_LIGAMENT) && kinds.has(SPLASH_DROP)).toBe(true);
    kinds = new Set();
  });

  it('tears ligaments at the Weber limit and lays drops as the gamma law round them (Pilch and Erdman, Villermaux)', () => {
    // 12 sigma / (rho_a U^2): 8.8 mm at 9 m/s.
    expect(splashLigamentDiameter(9)).toBeCloseTo((12 * 0.0735) / (1.225 * 81), 9);
    expect(splashLigamentDiameter(15)).toBeLessThan(splashLigamentDiameter(9));
    // D32 = d (n + 2) / n.
    expect(splashSauterDiameter(0.006)).toBeCloseTo(0.006 * (SPLASH_GAMMA_N + 2) / SPLASH_GAMMA_N, 12);
    // A sheet's strand child carries 4 / d at the parent's speed (never thicker than the sheet), its drops 6 / D32.
    const pool = new SplashPool(4096, 2);
    // Round 15: the round-6 law alone (the stable-drop cap off; oceanRocksRound15.test.ts holds the cap).
    pool.lawsOn.stableDrop = false;
    const i = pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 9, 0, 0.3, 0, 1, 8, 2 / 0.05, 0.05);
    for (let k = 0; k < 12; k += 1) pool.step(1 / 60, { airX: 0, airZ: 0, seaHeight: () => -10 });
    let lig = -1; let drop = -1;
    for (let a = 0; a < pool.alive; a += 1) {
      const j = pool.aliveIndex[a];
      if (pool.kind[j] === SPLASH_LIGAMENT && lig < 0) lig = j;
      if (pool.kind[j] === SPLASH_DROP && drop < 0) drop = j;
    }
    expect(lig).toBeGreaterThanOrEqual(0);
    expect(drop).toBeGreaterThanOrEqual(0);
    const dL = 4 / pool.areaV[lig];
    expect(dL).toBeGreaterThan(0.004);
    expect(dL).toBeLessThan(0.012);
    expect(6 / pool.areaV[drop]).toBeGreaterThan(dL);
    expect(pool.mass[i]).toBeLessThan(8);
    // The gamma law's volume share: all of it under a huge size, almost none under a tenth of the mean.
    expect(splashGammaVolumeBelow(1, 0.008)).toBeCloseTo(1, 6);
    expect(splashGammaVolumeBelow(0.0008, 0.008)).toBeLessThan(1e-3);
    // Its share under the mean, by a numeric integral of D^3 D^(n-1) e^(-n D / d).
    let num = 0; let den = 0;
    for (let k = 1; k < 20000; k += 1) {
      const D = (k / 20000) * 0.08;
      const w = D ** (SPLASH_GAMMA_N + 2) * Math.exp((-SPLASH_GAMMA_N * D) / 0.008);
      den += w;
      if (D < 0.008) num += w;
    }
    expect(splashGammaVolumeBelow(0.008, 0.008)).toBeCloseTo(num / den, 3);
  });

  it('counts the drops and their cross-section as n pi r^2 Q', () => {
    const d32 = 0.006;
    const n = SPLASH_GAMMA_N;
    const d = (d32 * n) / (n + 2);
    // N <D^2> pi / 4 Q over the volume equals Q S_v V / 4.
    const N = splashDropCount(1, d32);
    const d2 = (d * d * (n + 1)) / n;
    const pool = new SplashPool(4, 1);
    const i = pool.emit(SPLASH_DROP, 0, 0, 0, 0, 0, 0, 0.1, 0, 1, 1, 6 / d32);
    expect(N * (Math.PI / 4) * d2 * SPLASH_Q_EXT).toBeCloseTo(SplashVolume.crossSection(pool, i), 6);
  });

  it('gives an aerated lump its own shadow, not the sum of its bubbles (van de Hulst)', () => {
    // The thin limit is the sum (k V), the thick limit the shadow (Q = 1).
    expect(splashBodyEfficiency(1e-4)).toBeCloseTo((2 / 3) * 1e-4, 8);
    expect(splashBodyEfficiency(0.01) / ((2 / 3) * 0.01)).toBeCloseTo(1, 2);
    expect(splashBodyEfficiency(300)).toBeGreaterThan(0.99);
    expect(splashBodyEfficiency(300)).toBeLessThanOrEqual(1);
    // The two branches meet at w = 1e-3.
    expect(splashBodyEfficiency(0.000999999) / splashBodyEfficiency(0.001)).toBeCloseTo(1, 4);
    // A 0.2 m churn lump at a void of 0.5 with 1 mm bubbles: water 1025 (1 - e) pi s^3 / 6,
    // area per water volume 6 e / ((1 - e) D_b). Its sum is about 200 times its shadow.
    const s = 0.2; const e = 0.5; const Db = 0.001;
    const kg = SPLASH_WATER_RHO * (1 - e) * (Math.PI / 6) * s ** 3;
    const areaV = (6 * e) / ((1 - e) * Db);
    const pool = new SplashPool(4, 1);
    const i = pool.emit(SPLASH_SHEET, 0, 0, 0, 0, 0, 0, s, 0, 0.8, kg, areaV, s);
    const sum = SPLASH_Q_EXT * SPLASH_CAUCHY * areaV * (kg / SPLASH_WATER_RHO);
    expect(SplashVolume.crossSection(pool, i)).toBeCloseTo(sum, 6);
    pool.markBulk(i);
    const shadow = SplashVolume.crossSection(pool, i);
    expect(shadow / ((Math.PI / 4) * s * s)).toBeCloseTo(1, 2);
    expect(sum / shadow).toBeGreaterThan(150);
    // A thin lump (few bubbles) keeps the sum.
    const j = pool.emit(SPLASH_SHEET, 0, 0, 0, 0, 0, 0, s, 0, 0.8, kg, 0.001, s);
    pool.markBulk(j);
    expect(SplashVolume.crossSection(pool, j) / (SPLASH_Q_EXT * SPLASH_CAUCHY * 0.001 * (kg / SPLASH_WATER_RHO))).toBeCloseTo(1, 3);
  });

  it('keeps the cross-section of a sprite under the chord profile sqrt(1 - u^2) (round 6b)', () => {
    // A numeric mean of the chord over a capsule (the draw's capD), against the closed form.
    for (const [w, len] of [[1, 1], [1, 3], [0.2, 2.5]]) {
      const rad = w / 2; let sum = 0; let n = 0;
      const N = 800;
      for (let a = 0; a < N; a += 1) for (let b = 0; b < N; b += 1) {
        const x = ((a + 0.5) / N - 0.5) * w; const y = ((b + 0.5) / N - 0.5) * len;
        const d = Math.hypot(x, Math.max(Math.abs(y) - (len / 2 - rad), 0)) / rad;
        if (d >= 1) continue;
        sum += Math.sqrt(1 - d * d); n += 1;
      }
      expect(splashSpriteColumnMean(w, len)).toBeCloseTo(sum / n, 2);
    }
    // A round sprite: 2 / 3; a long streak tends to pi / 4.
    expect(splashSpriteColumnMean(1, 1)).toBeCloseTo(2 / 3, 9);
    expect(splashSpriteColumnMean(1, 1000)).toBeCloseTo(Math.PI / 4, 3);
  });

  it('spreads the pieces of a torn sheet at the Taylor-Culick speed of its thickness', () => {
    // sqrt(2 sigma / (rho h)): 4 cm/s for a 9 cm sheet, 0.38 m/s for a 1 mm one.
    expect(splashCapillarySpeed(0.09)).toBeCloseTo(Math.sqrt((2 * 0.0735) / (1025 * 0.09)), 9);
    expect(splashCapillarySpeed(0.001)).toBeGreaterThan(0.3);
    expect(splashCapillarySpeed(0.001)).toBeLessThan(0.45);
    // A fast sheet's children leave within its capillary speed of its own velocity, not 0.22 of its speed.
    const pool = new SplashPool(4096, 4);
    // Round 15: the sheet's own children (the stable-drop cap's bag fragments spread at their own drops' speed).
    pool.lawsOn.stableDrop = false;
    pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 9, 0, 0.3, 0, 1, 8, 2 / 0.05, 0.05);
    for (let k = 0; k < 12; k += 1) pool.step(1 / 60, { airX: 0, airZ: 0, seaHeight: () => -10 });
    let maxSide = 0;
    for (let a = 0; a < pool.alive; a += 1) {
      const j = pool.aliveIndex[a];
      maxSide = Math.max(maxSide, Math.abs(pool.vel[j * 3]), Math.abs(pool.vel[j * 3 + 2]));
    }
    expect(maxSide).toBeLessThan(splashCapillarySpeed(0.05) * 1.01 + 0.05);
  });

  it('sheds only the rim of a sheet (Taylor-Culick): a thick jet sheet keeps most of its water and falls back whole', () => {
    const pool = new SplashPool(8192, 6);
    const i = pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 6, 0, 0.4, 0, 1, 8, 2 / 0.09, 0.09);
    for (let k = 0; k < 60; k += 1) pool.step(1 / 60, { airX: 0, airZ: 0, seaHeight: () => -10 });
    // The rim's share 2 v / lambda each second: 1 - exp(-2 v / 0.4) of 8 kg after 1 s, about 18%.
    const v = splashCapillarySpeed(0.09);
    expect(pool.mass[i]).toBeGreaterThan(8 * Math.exp((-2 * v) / 0.4) * 0.97);
    expect(pool.mass[i]).toBeLessThan(8 * Math.exp((-2 * v) / 0.4) * 1.03);
    // It is still flying (no fixed life ends it in the air).
    expect(pool.age[i]).toBeCloseTo(1, 6);
  });

  it('flies a drop under gravity and its own drag (Stokes for mist, Newton for large drops)', () => {
    // The mist kind's Stokes diameter relaxes in its tau.
    const dM = splashStokesDiameter(0.12);
    expect(1 / splashDragPerSpeed(dM, 1e-4)).toBeCloseTo(0.12, 3);
    // A 5 mm drop falls at about 9 m/s (the measured 9.1 m/s, Gunn and Kinzer 1949, within the sphere law's error).
    let v = 0;
    for (let k = 0; k < 6000; k += 1) v += (9.81 - splashDragPerSpeed(0.005, v) * v) * 0.001;
    expect(v).toBeGreaterThan(8);
    expect(v).toBeLessThan(13);
  });

  it('scatters forward with g = 0.87 for every drop in the plume (Hansen and Travis)', () => {
    expect(splashAsymmetry(0.0002)).toBeCloseTo(0.87, 9);
    expect(splashAsymmetry(0.008)).toBeCloseTo(0.87, 9);
    expect(SPLASH_G).toBeCloseTo(0.87, 9);
    expect(splashAsymmetry(1e-8)).toBeLessThan(0.1);
  });

  it('gives the light scattered many times by the two-flux share, with no floor', () => {
    // A thin plume scatters almost nothing many times.
    expect(splashTwoFlux(0.01, 0.01)).toBeLessThan(0.02);
    // A thick plume: its lit face gets about all of it, its far face z0 / (tau' + 2 z0).
    const tau = 40;
    const tp = (1 - SPLASH_G) * tau;
    expect(splashTwoFlux(0, tau)).toBeGreaterThan(0.85);
    expect(splashTwoFlux(tau, 0)).toBeCloseTo(SPLASH_DIFFUSION_Z0 / (tp + 2 * SPLASH_DIFFUSION_Z0), 6);
    expect(splashTwoFlux(tau / 2, tau / 2)).toBeLessThan(splashTwoFlux(0, tau));
  });

  it('throws the jet\'s water in parcels on the rim\'s Rayleigh-Plateau lattice', () => {
    const tab = table();
    const sim = new RockSurf([tab], SEA);
    const nx = tab.normalX[0]; const nz = tab.normalZ[0];
    const hist = new RockSeaHistory(tab.sectors);
    const row = () => {
      const r = new Float32Array(tab.sectors * ROCK_SAMPLE_STRIDE);
      r[0] = 1.8; r[1] = -5.5 * nx; r[3] = -5.5 * nz;
      return r;
    };
    hist.push(0, row(), 1e9);
    hist.push(1, row(), 1e9);
    sim.reset(0);
    for (let k = 0; k < 6; k += 1) sim.step(ROCK_DT_S, hist);
    const st = sim.rocks[0].sectors[0];
    expect(st.jetKgPerMS).toBeGreaterThan(0);
    // Round 7: the sheet's thickness falls as the meeting point climbs, so each
    // parcel stands on the lattice of its own launch thickness (h0M).
    // Every fresh sheet carries a parcel's water and stands on the lattice (within its rim's width).
    const p = sim.splash;
    let n = 0; let onLattice = 0;
    for (let a = 0; a < p.alive; a += 1) {
      const i = p.aliveIndex[a];
      // Round 9: a jet sheet is one with a launch thickness (markSheet), not a churn lump.
      if (p.kind[i] !== SPLASH_SHEET || p.bulk[i] === 1 || !(p.h0M[i] > 0) || !(p.mass[i] > 0)) continue;
      // Round 7: only the parcels thrown this step (a faster jet moves a parcel off its azimuth within a few steps).
      if (p.age[i] > ROCK_DT_S * 1.01) continue;
      n += 1;
      const az = Math.atan2(p.pos[i * 3 + 2] - tab.centerZ, p.pos[i * 3] - tab.centerX);
      let da = az - tab.azimuthRad[0];
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const arc = da * tab.waterlineM[0];
      const h0 = Math.max(p.h0M[i], 0.005);
      const lambda = SPLASH_RP_WAVELENGTH * h0;
      const off = ((arc - st.rpPhase * lambda) / lambda) % 1;
      const frac = Math.min(Math.abs(off), 1 - Math.abs(off));
      if (frac * lambda <= h0 * 1.5 + 1e-6) onLattice += 1;
    }
    expect(n).toBeGreaterThan(0);
    expect(onLattice / n).toBeGreaterThan(0.9);
  });
});

describe('the sea knows the rock (round 7)', () => {
  it('sends back the face\'s share of the arriving wave, out at the reef\'s long-wave speed, spreading as a convex mirror', () => {
    const tab = table();
    // Round 8: the share comes from the sea's heading, so take the face that looks most squarely at the sea.
    const hSea = (k: number) => Math.max(0, -(tab.normalX[k] * Math.cos(SEA.windDirRad) + tab.normalZ[k] * Math.sin(SEA.windDirRad)));
    let s = 0;
    for (let k = 1; k < tab.sectors; k += 1) if (hSea(k) > hSea(s)) s = k;
    const nx = tab.normalX[s]; const nz = tab.normalZ[s];
    const sim = new RockSurf([tab], SEA);
    const hist = new RockSeaHistory(tab.sectors);
    // A crest that arrives at every face for one step-long pulse, then the sea stands still at 0.
    const row = (eta: number) => {
      const r = new Float32Array(tab.sectors * ROCK_SAMPLE_STRIDE);
      for (let k = 0; k < tab.sectors; k += 1) { r[k * ROCK_SAMPLE_STRIDE] = eta; r[k * ROCK_SAMPLE_STRIDE + 1] = -3 * nx; r[k * ROCK_SAMPLE_STRIDE + 3] = -3 * nz; }
      return r;
    };
    hist.push(0, row(1), 1e9);
    hist.push(5, row(1), 1e9);
    sim.reset(0);
    // Past the ring's length, so the ring holds a steady wave (round 8: one slot per two steps).
    for (let k = 0; k < ROCK_REFLECT_SLOT_STEPS * ROCK_REFLECT_RING + 10; k += 1) sim.step(ROCK_DT_S, hist);
    const im = rockFaceImpact(tab, s, { etaM: 1, velX: -3 * nx, velY: 0, velZ: -3 * nz, deficit: 0 }, SEA, newImpact());
    expect(im.reflectShare).toBeGreaterThan(0);
    // Round 8: the share is K_r times the SEA's heading into the face, whatever the parcel does.
    expect(im.reflectShare).toBeCloseTo(rockReflection(rockIribarren(tab.slopeRad[s], SEA.hsM, SEA.peakLengthM)) * hSea(s), 9);
    const away = rockFaceImpact(tab, s, { etaM: 1, velX: 3 * nx, velY: 0, velZ: 3 * nz, deficit: 0 }, SEA, newImpact());
    expect(away.reflectShare).toBeCloseTo(im.reflectShare, 12);
    // At the skin: K_r h eta, in phase with the incident.
    const az = tab.azimuthRad[s];
    const at = (x: number) => rockReflectedWave(sim, 0, tab.centerX + (tab.waterlineM[s] + x) * Math.cos(az), tab.centerZ + (tab.waterlineM[s] + x) * Math.sin(az));
    // Round 11: no more than the freeboard over the arriving water (A FACE REFLECTS ONLY THE WATER BELOW ITS RIM).
    expect(at(0)).toBeCloseTo(Math.min(im.reflectShare * 1, Math.max(tab.rimM[s] - 1, 0)), 4);
    // Out from the face (a steady wave): the amplitude falls as sqrt(R / (R + 2 x)).
    const R = tab.waterlineM[s];
    expect(at(2) / at(0)).toBeCloseTo(Math.sqrt(R / (R + 4)), 2);
    // Beyond the ring's reach, nothing.
    const c = rockReflectSpeed(tab.reefDepthM);
    const slotS = ROCK_REFLECT_SLOT_STEPS * ROCK_DT_S;
    expect(at(c * ROCK_REFLECT_RING * slotS + 1)).toBe(0);
    // A wave that left the face 10 steps ago is at c * 10 dt now.
    const sim2 = new RockSurf([tab], SEA);
    const h2 = new RockSeaHistory(tab.sectors);
    h2.push(0, row(0), 1e9);
    h2.push(5, row(0), 1e9);
    sim2.reset(0);
    for (let k = 0; k < 30; k += 1) sim2.step(ROCK_DT_S, h2);
    const N = ROCK_REFLECT_RING;
    for (let q = 0; q < tab.sectors; q += 1) sim2.reflectRing[q * N + ((sim2.reflectHead - 10 + N) % N)] = 0.5;
    const at2 = (x: number) => rockReflectedWave(sim2, 0, tab.centerX + (R + x) * Math.cos(az), tab.centerZ + (R + x) * Math.sin(az));
    // 30 steps: round(t / dt) is even, so the newest slot is now (phase 0).
    expect(sim2.reflectPhase).toBe(0);
    const x10 = c * 10 * slotS;
    expect(at2(x10)).toBeCloseTo(0.5 * Math.sqrt(R / (R + 2 * x10)), 4);
    expect(at2(0)).toBe(0);
    expect(at2(c * 20 * slotS)).toBe(0);
  });

  it('keeps the reflected wave continuous in distance and in time (round 8: no step)', () => {
    const tab = table();
    const sim = new RockSurf([tab], SEA);
    const hist = new RockSeaHistory(tab.sectors);
    // A wave at the faces whose parcels turn over every half second (the short waves on the swell).
    for (let k = 0; k <= 300; k += 1) {
      const t = k / ROCK_SAMPLE_HZ;
      const r = new Float32Array(tab.sectors * ROCK_SAMPLE_STRIDE);
      for (let q = 0; q < tab.sectors; q += 1) {
        const flip = Math.sign(Math.sin(2 * Math.PI * t)) || 1;
        r[q * ROCK_SAMPLE_STRIDE] = 1.2 * Math.sin((2 * Math.PI * t) / 9);
        r[q * ROCK_SAMPLE_STRIDE + 1] = -3 * flip * tab.normalX[q];
        r[q * ROCK_SAMPLE_STRIDE + 3] = -3 * flip * tab.normalZ[q];
      }
      hist.push(t, r, 1e9);
    }
    sim.reset(0);
    let worstT = 0;
    let prev: number[] | null = null;
    const pts = Array.from({ length: 40 }, (_, k) => {
      const az = (k / 40) * Math.PI * 2;
      const r = 4 + (k % 8);
      return [tab.centerX + r * Math.cos(az), tab.centerZ + r * Math.sin(az)];
    });
    for (let k = 0; k < Math.round(8 / ROCK_DT_S); k += 1) {
      sim.step(ROCK_DT_S, hist);
      const now = pts.map(([x, z]) => rockReflectedWave(sim, 0, x, z));
      if (prev) for (let j = 0; j < now.length; j += 1) worstT = Math.max(worstT, Math.abs(now[j] - prev[j]));
      prev = now;
    }
    // In time: the wave at a point moves no faster than the incident's own rate allows
    // (1.2 m at 9 s: 0.84 m/s, 1.4 cm a step; K_r h under 1).
    expect(worstT).toBeLessThan(0.016);
    // In distance: along every line out from the rock, a 1 cm step moves the wave by under 1 mm.
    let worstX = 0;
    for (let a = 0; a < 16; a += 1) {
      const az = (a / 16) * Math.PI * 2;
      let last = Number.NaN;
      for (let r = 0; r <= 25; r += 0.01) {
        const v = rockReflectedWave(sim, 0, tab.centerX + r * Math.cos(az), tab.centerZ + r * Math.sin(az));
        if (!Number.isNaN(last) && r > 4) worstX = Math.max(worstX, Math.abs(v - last));
        last = v;
      }
    }
    expect(worstX).toBeLessThan(0.001);
  });

  it('casts a lee behind the rock that fills in down the heading, sooner for a longer band (Fresnel strip)', () => {
    const tab = table();
    const hd = SEA.windDirRad;
    const a = rockLeeHalfWidth(tab, hd);
    expect(a).toBeGreaterThan(1);
    // Round 8: the lee of the rock for the heading (its two edges and its lee waterline).
    const lee = rockLeeOf(tab, hd);
    const at = (s: number, y: number, lam: number) => rockLeeShare(lee, lam,
      tab.centerX + s * Math.cos(hd) - y * Math.sin(hd), tab.centerZ + s * Math.sin(hd) + y * Math.cos(hd));
    // Up the heading (in front of the rock): no lee.
    expect(at(-5, 0, 10)).toBe(1);
    // Round 8: the lee starts at the rock's lee waterline.
    const sEnd0 = rockLeeEndAt(lee, 0);
    expect(Math.max(lee.aMinus, lee.aPlus)).toBeCloseTo(a, 9);
    expect(sEnd0).toBeGreaterThan(0.5);
    expect(at(sEnd0 - 0.2, 0, 10)).toBe(1);
    // Just behind it: nearly full shadow; far down the lee and off to the side: the waves again.
    expect(at(sEnd0 + 0.5, 0, 10)).toBeLessThan(0.02);
    expect(at(40, 0, 10)).toBeGreaterThan(at(5, 0, 10));
    expect(at(5, 4 * a, 10)).toBeGreaterThan(0.98);
    // A longer band fills the lee sooner.
    expect(at(5, 0, 100)).toBeGreaterThan(at(5, 0, 10));
    // Round 8: a body much smaller than the wave casts almost no shadow (MacCamy and Fuchs):
    // Q = (3 pi^2 / 8) (k a)^3 in the long-wave limit, the whole strip's shadow from k a near 0.65.
    expect(rockLeeScatter(254, 3.15)).toBeLessThan(0.01);
    expect(rockLeeScatter(6.5, 3.15)).toBe(1);
    expect(rockLeeScatter(100, 1)).toBeCloseTo(((3 * Math.PI * Math.PI) / 8) * ((2 * Math.PI) / 100) ** 3, 12);
    expect(at(sEnd0 + 0.5, 0, 300)).toBeGreaterThan(0.95);
    // Round 8: no step beside the rock. Down the heading at every offset outside the
    // waterline, a 1 cm step changes the share by under 3% (round 7: 1.00 to 0.06).
    const skinAt = (x: number, z: number) => {
      const dx = x - tab.centerX; const dz = z - tab.centerZ;
      const azp = Math.atan2(dz, dx);
      let best = 0; let bd = Infinity;
      for (let k = 0; k < tab.sectors; k += 1) {
        const dd = Math.abs(Math.atan2(Math.sin(azp - tab.azimuthRad[k]), Math.cos(azp - tab.azimuthRad[k])));
        if (dd < bd) { bd = dd; best = k; }
      }
      return Math.hypot(dx, dz) > tab.waterlineM[best] + 0.3;
    };
    let worst = 0;
    for (const lam of [6.5, 30, 40.6]) {
      for (let y = -1.3 * a; y <= 1.3 * a; y += 0.1) {
        let last = Number.NaN;
        for (let sd = -6; sd <= 12; sd += 0.01) {
          const x = tab.centerX + sd * Math.cos(hd) - y * Math.sin(hd);
          const z = tab.centerZ + sd * Math.sin(hd) + y * Math.cos(hd);
          const v = at(sd, y, lam);
          if (skinAt(x, z) && !Number.isNaN(last)) worst = Math.max(worst, Math.abs(v - last));
          last = skinAt(x, z) ? v : Number.NaN;
        }
      }
    }
    expect(worst).toBeLessThan(0.03);
    // The error function's form.
    expect(rockErf(0.5)).toBeCloseTo(0.5204998778, 6);
    expect(rockErf(-1.2)).toBeCloseTo(-0.9103139782, 6);
    // A band's wavelength lies within the band.
    for (const c of oceanSeaState('surf')) {
      const l = rockBandLambda(c);
      expect(l).toBeGreaterThanOrEqual(c.cutoffLowM);
      expect(l).toBeLessThanOrEqual(c.cutoffHighM);
    }
  });
});

describe('the sprites far to near in linear time (round 7)', () => {
  it('orders by distance to the bucket, stable in the order it is given within one', () => {
    const n = 5000;
    const s = new SplashDepthSort(n);
    let r = 7;
    const rnd = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
    for (let k = 0; k < n; k += 1) { s.dist[k] = 50 + 30 * rnd(); s.slot[k] = k; }
    const out = s.sort(n);
    const seen = new Set<number>();
    for (let k = 0; k < n; k += 1) seen.add(out[k]);
    expect(seen.size).toBe(n);
    for (let k = 1; k < n; k += 1) expect(s.dist[out[k]]).toBeLessThanOrEqual(s.dist[out[k - 1]] + SPLASH_SORT_RES_M);
    // Two at the same distance keep the order they came in.
    const t = new SplashDepthSort(4);
    t.dist.set([3, 5, 3, 5]); t.slot.set([10, 11, 12, 13]);
    expect(Array.from(t.sort(4))).toEqual([11, 13, 10, 12]);
  });
});

describe('the white water as soft discs (round 5)', () => {
  it('lays soft, capped discs that overlap into one collar along the struck face', () => {
    const tab = table();
    const sim = new RockSurf([tab], SEA);
    const hist = regularHistory(tab, 2.2, 8, 0, 16, 0.7);
    sim.reset(0);
    for (let i = 0; i < 16 * 60; i += 1) sim.step(ROCK_DT_S, hist);
    const src = rockFoamSources(sim, sim.time, 256);
    expect(src.length).toBeGreaterThan(5);
    for (const d of src) {
      // No one disc saturates the field (a solid "decal"), and each is a soft cone.
      expect(d.s).toBeLessThanOrEqual(ROCK_DISC_S_MAX + 1e-12);
      expect(d.soft).toBe(ROCK_EVENT_SOFT);
      expect(d.rM).toBe(ROCK_EVENT_R_M);
    }
    // The discs near the waterline (within 2.5 m of it) overlap: every one has a
    // neighbor nearer than its own radius, so the collar has no gap between them.
    const reach = Math.max(...tab.waterlineM) + 2.5;
    const near = src.filter((d) => Math.hypot(d.xM - tab.centerX, d.zM - tab.centerZ) < reach);
    expect(near.length).toBeGreaterThan(2);
    for (const d of near) {
      const others = near.filter((e) => e.xM !== d.xM || e.zM !== d.zM);
      const nearest = Math.min(...others.map((e) => Math.hypot(e.xM - d.xM, e.zM - d.zM)));
      expect(nearest).toBeLessThan(d.rM);
    }
    // (16 s of a breaking sea: round 8: the sim throws more jet water, so more parcels; 60 s allowed.)
  }, 60000);
});

describe('the reef in the sea\'s one bathymetry', () => {
  it('is deep everywhere with no shelf, and shallow on a rock\'s shelf', () => {
    expect(oceanShelfDepthCpu([], 0, 0)).toBe(OCEAN_DEEP_M);
    const shelves = rockShelves([table()]);
    expect(shelves).toHaveLength(1);
    const s = shelves[0];
    expect(oceanShelfDepthCpu(shelves, s.xM, s.zM)).toBeCloseTo(s.depthM, 9);
    expect(oceanShelfDepthCpu(shelves, s.xM + s.outerM + 1, s.zM)).toBeCloseTo(s.farDepthM, 9);
  });

  it('breaks a crest only where it is high for the depth (McCowan, Thornton and Guza)', () => {
    expect(oceanBreakShareCpu(1.5, OCEAN_DEEP_M)).toBe(0);
    expect(oceanBreakShareCpu(0.3, 2.5)).toBe(0);
    expect(oceanBreakShareCpu(1.2, 2.5)).toBe(1);
  });

  it('shoals a long swell over a shelf and leaves deep water alone (linear theory, Green\'s law)', () => {
    // A 12.7 s swell on 2.5 m: Ks about 1.41.
    expect(oceanShoalGain(12.7, 2.5)).toBeGreaterThan(1.3);
    expect(oceanShoalGain(12.7, 2.5)).toBeLessThan(1.55);
    expect(oceanShoalGain(12.7, 500)).toBeCloseTo(1, 2);
    const ref = oceanBandRefDepthM(12.7, 2.5);
    expect(oceanBandGainCpu(ref, 2.5)).toBeCloseTo(oceanShoalGain(12.7, 2.5), 6);
    expect(oceanBandGainCpu(ref, OCEAN_DEEP_M)).toBe(1);
    expect(oceanBandGainCpu(0, 2.5)).toBe(1);
    // The surf sea's swell band carries a 12.7 s period.
    const swell = oceanSeaState('surf').find((c) => c.name === 'swell');
    expect(swell).toBeDefined();
    expect(oceanBandPeriodS(swell!)).toBeGreaterThan(12);
  });

  it('refuses a block that does not hold the rock\'s center', () => {
    expect(() => checkRockLobes({ ...SPEC, lobes: [{ dxM: 5, dzM: 0, halfLengthM: 1, halfWidthM: 1, upM: 1, downM: 1, headingRad: 0, squareness: 2, flatness: 2 }] })).toThrow();
  });
});

describe('the jet by the apex and the parcel budget (round 9)', () => {
  const crestRow = (tab: RockFaceTable, u: number) => {
    const r = new Float32Array(tab.sectors * ROCK_SAMPLE_STRIDE);
    r[0] = 1.8; r[1] = -u * tab.normalX[0]; r[3] = -u * tab.normalZ[0];
    return r;
  };

  it('closes the apex at the net speed into the face: the jet thins as its square, the speed stays the incident\'s', () => {
    const tab = table();
    const s = 0;
    const w = { etaM: 1.8, velX: -5.5 * tab.normalX[s], velY: 0, velZ: -5.5 * tab.normalZ[s], deficit: 0 };
    const im = rockFaceImpact(tab, s, w, SEA, newImpact());
    expect(im.jet).toBeGreaterThan(0);
    expect(im.reflectShare).toBeGreaterThan(0);
    // The same strike on a face that sent nothing back (round 8's law): the share and the mass of the whole inflow.
    const sinA = Math.sin(tab.slopeRad[s]);
    const close = Math.sqrt(GRAVITY_MS2 * (tab.reefDepthM + 1.8 * 1.8)) * im.struck;
    const whole = rockWedge(tab.slopeRad[s], 0, close, im.inflowMs);
    // Round 12: the net speed is the inflow less K_r h of the linear wave's water speed (im.apexMs).
    expect(im.apexMs).toBeGreaterThan(0);
    expect(im.apexMs).toBeLessThan(im.inflowMs);
    const net = rockWedge(tab.slopeRad[s], 0, close, im.apexMs);
    expect(im.jetShare).toBeLessThan(whole.share);
    expect(im.jetShare).toBeCloseTo(net.share, 9);
    // For a small angle the share goes as (u_n / v_P)^2 / 4.
    const small = rockWedge(tab.slopeRad[s], 0, close, 0.1 * net.vMeetMs);
    expect(small.share).toBeCloseTo(0.01 / 4, 3);
    // The launch speed is the stagnation of the incident water (the whole u), not the net; round 19: derated by
    // the crest's air share at the face, sqrt(1 - C) on the water's speed over the meeting point (rockAeratedJetSpeed).
    expect(im.jetMs).toBeCloseTo(Math.min(rockAeratedJetSpeed(whole.vMeetMs, whole.uRelMs, im.jetAirC ?? 0) * sinA, ROCK_JET_MAX_MS), 6);
    // The mass falls by more than the net speed's ratio (the share falls too).
    const roundEight = im.jet * 1025 * im.inflowMs * im.standingM * whole.share;
    expect(im.jetKgPerMS / roundEight).toBeLessThan(im.apexMs / im.inflowMs);
  });

  it('throws a bounded count of parcels: a bigger jet makes heavier parcels, not more', () => {
    const run = (u: number) => {
      const tab = table();
      const sim = new RockSurf([tab], SEA);
      const hist = new RockSeaHistory(tab.sectors);
      hist.push(0, crestRow(tab, u), 1e9);
      hist.push(1, crestRow(tab, u), 1e9);
      sim.reset(0);
      const steps = 30;
      for (let k = 0; k < steps; k += 1) sim.step(ROCK_DT_S, hist);
      // Every sheet this rock threw is a jet sheet (no churn: the crest does not break here).
      return { thrown: sim.splash.emitted[SPLASH_SHEET], kg: sim.rocks[0].jetKg, steps };
    };
    const lo = run(4.5);
    const hi = run(7.5);
    expect(hi.kg).toBeGreaterThan(1.5 * lo.kg);
    // The sheets thrown: at most the budget's count a second over the strike (plus one a face for the carry).
    const cap = ROCK_SHEET_PARCELS_PER_S * hi.steps * ROCK_DT_S + table().sectors;
    expect(hi.thrown).toBeLessThanOrEqual(cap);
    expect(lo.thrown).toBeLessThanOrEqual(cap);
    // The count does not grow with the water: the heavier strike throws heavier parcels.
    expect(hi.thrown).toBeLessThan(1.25 * lo.thrown);
    expect(hi.kg / hi.thrown).toBeGreaterThan(1.3 * (lo.kg / lo.thrown));
  });

  it('thins a clear sheet as it spreads (h0 r0 / r) and tears its rim at the Taylor-Culick speed of its thickness now', () => {
    const pool = new SplashPool(256, 9);
    const h0 = 0.04; const r0 = 3; const m = 8;
    const i = pool.emit(SPLASH_SHEET, r0, 1, 0, 6, 5, 0, SPLASH_RP_WAVELENGTH * h0, 0, 1, m, 2 / h0, h0);
    pool.markSheet(i, 0, 0, 0);
    const env = { airX: 0, airZ: 0, seaHeight: () => -10 };
    for (let k = 0; k < 20; k += 1) pool.step(ROCK_DT_S, env);
    const r = Math.hypot(pool.pos[i * 3], pool.pos[i * 3 + 2]);
    expect(r).toBeGreaterThan(r0 + 1);
    expect(pool.voidShare[i]).toBe(0);
    expect(pool.scaleM[i]).toBeCloseTo((h0 * r0) / r, 3);
    expect(pool.spreadMs[i]).toBeCloseTo(splashCapillarySpeed(pool.scaleM[i]), 6);
    expect(pool.holeX[i]).toBe(0);
    // Its only loss is its rim: it has shed water, and it still holds most of it.
    expect(pool.mass[i]).toBeLessThan(m);
    expect(pool.mass[i]).toBeGreaterThan(0.5 * m);
    // A reused slot starts with no sheet state (round 9: a churn lump drew as a flat sheet).
    pool.reset();
    const j = pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 1, 0, 0.2, 0, 0.8, 2, 30, 0.2);
    expect(pool.h0M[j]).toBe(0);
  });
});

describe('round 10: a parcel is a population, a fast drop breaks, the churn bursts into mist', () => {
  it('times the breakup by Pilch and Erdman, none under the critical Weber number', () => {
    expect(splashBreakupTstar(11.9)).toBe(Infinity);
    expect(splashBreakupTstar(13)).toBeCloseTo(6, 6);
    expect(splashBreakupTstar(28)).toBeCloseTo(2.45 * 2, 6);
    expect(splashBreakupTstar(5000)).toBe(5.5);
    // A 2.4 cm drop at 9 m/s (We 32): t_c = D / U sqrt(rho_w / rho_a), about 0.077 s; T* about 5.2.
    const t = splashBreakupTimeS(0.024, 9);
    expect(t).toBeGreaterThan(0.3);
    expect(t).toBeLessThan(0.5);
    expect(splashBreakupTimeS(0.005, 3)).toBe(Infinity);
  });

  it('bursts a lump\'s bubbles into jet drops of a tenth of their size', () => {
    const [kg, d] = splashBubbleMist(10, 0.5, 0.001);
    expect(d).toBeCloseTo(SPLASH_JET_DROP_SHARE * 0.001, 12);
    expect(kg).toBeCloseTo(10 * SPLASH_JET_DROPS_PER_BUBBLE * SPLASH_JET_DROP_SHARE ** 3, 9);
    expect(splashBubbleMist(10, 0, 0.001)[0]).toBe(0);
  });

  it('gives a jet sheet its own water\'s area and its children their share of it', () => {
    const pool = new SplashPool(4000, 3);
    const i = pool.emit(SPLASH_SHEET, 3, 1, 0, 0, 6, 0, 0.1, 0, 1, 8, 2 / 0.04, 0.04);
    pool.markSheet(i, 0.5, 0, 0);
    expect(pool.supportOf(i)).toBeCloseTo(Math.sqrt(8 / (SPLASH_WATER_RHO * 0.04)), 6);
    const env = { airX: 0, airZ: 0, seaHeight: () => -50 };
    for (let k = 0; k < 30; k += 1) pool.step(1 / 60, env);
    // Every child of the sheet fills its share of the sheet's region, never less than its drawn size;
    // by its water the children's regions are far wider than their drawn sizes.
    let n = 0; let kgSupport = 0; let kgSize = 0; let kg = 0;
    for (let a = 0; a < pool.alive; a += 1) {
      const c = pool.aliveIndex[a];
      if (c === i || pool.mass[c] <= 0) continue;
      n += 1;
      expect(pool.spanM[c]).toBeGreaterThanOrEqual(pool.size0[c]);
      kgSupport += pool.mass[c] * pool.supportOf(c); kgSize += pool.mass[c] * pool.size0[c]; kg += pool.mass[c];
    }
    expect(n).toBeGreaterThan(0);
    expect(kgSupport / kg).toBeGreaterThan(2 * (kgSize / kg));
  });

  it('breaks a fast drop parcel once into ring and bag fragments that do not break again, and keeps the water', () => {
    const pool = new SplashPool(4000, 5);
    // 2.4 cm drops falling at 12 m/s (We 56): the gamma law's tail is over the critical diameter.
    const i = pool.emit(SPLASH_DROP, 0, 40, 0, 0, -12, 0, 0.02, 0, 1, 1, 6 / 0.024, 0.024);
    const env = { airX: 0, airZ: 0, seaHeight: () => -1000 };
    for (let k = 0; k < 60; k += 1) pool.step(1 / 60, env);
    expect(pool.massRingKg).toBeGreaterThan(0);
    expect(pool.massRingKg / (pool.massRingKg + pool.massBagKg)).toBeCloseTo(SPLASH_BREAK_RING_SHARE, 6);
    expect(pool.dMaxM[i]).toBeGreaterThan(0);
    const after = pool.alive;
    // The fragments carry the critical diameter as their largest drop: a few steps more at the same speed make no new parcels.
    for (let k = 0; k < 6; k += 1) pool.step(1 / 60, env);
    expect(pool.alive).toBeLessThanOrEqual(after + 2);
    expect(pool.massAlive() + pool.massLanded + pool.massLost + pool.massExpired).toBeCloseTo(pool.massEmitted, 6);
  });

  it('lands a lump of churn as mist of its bubbles\' jet drops', () => {
    const pool = new SplashPool(4000, 6);
    const e = 0.5; const size = 0.2; const dB = 0.001;
    const kg = SPLASH_WATER_RHO * (1 - e) * (Math.PI / 6) * size ** 3;
    pool.markBulk(pool.emit(SPLASH_SHEET, 0, 0.05, 0, 0, -1, 0, size, 0, 1, kg, (6 * e) / ((1 - e) * dB), size), e);
    const env = { airX: 0, airZ: 0, seaHeight: () => 0 };
    for (let k = 0; k < 10; k += 1) pool.step(1 / 60, env);
    // (The lump sheds a little water as strands in its flight before it lands.)
    expect(Math.abs(pool.massBubbleMistKg / splashBubbleMist(kg, e, dB)[0] - 1)).toBeLessThan(0.02);
    let mist = 0;
    for (let a = 0; a < pool.alive; a += 1) if (pool.kind[pool.aliveIndex[a]] === SPLASH_MIST) mist += pool.mass[pool.aliveIndex[a]];
    expect(mist).toBeGreaterThan(0);
    expect(pool.massAlive() + pool.massLanded + pool.massLost + pool.massExpired).toBeCloseTo(pool.massEmitted, 6);
  });
});

describe('rocks round 11: the rooted plume, the wet stone, the rim', () => {
  it('a face reflects only the water below its rim (the freeboard caps the reflected crest)', () => {
    const tab = table();
    const hSea = (k: number) => Math.max(0, -(tab.normalX[k] * Math.cos(SEA.windDirRad) + tab.normalZ[k] * Math.sin(SEA.windDirRad)));
    let s = 0;
    for (let k = 1; k < tab.sectors; k += 1) if (hSea(k) > hSea(s)) s = k;
    const nx = tab.normalX[s]; const nz = tab.normalZ[s];
    const sent = (eta: number) => {
      const sim = new RockSurf([tab], SEA);
      const hist = new RockSeaHistory(tab.sectors);
      const r = new Float32Array(tab.sectors * ROCK_SAMPLE_STRIDE);
      for (let k = 0; k < tab.sectors; k += 1) { r[k * ROCK_SAMPLE_STRIDE] = eta; r[k * ROCK_SAMPLE_STRIDE + 1] = -3 * nx; r[k * ROCK_SAMPLE_STRIDE + 3] = -3 * nz; }
      hist.push(0, r, 1e9);
      hist.push(5, r, 1e9);
      sim.reset(0);
      sim.step(ROCK_DT_S, hist);
      return sim.reflectNow[s];
    };
    const im = rockFaceImpact(tab, s, { etaM: 0.1, velX: -3 * nx, velY: 0, velZ: -3 * nz, deficit: 0 }, SEA, newImpact());
    // A low crest well under the rim: the whole K_r h eta.
    expect(sent(0.1)).toBeCloseTo(im.reflectShare * 0.1, 6);
    // A crest that would stand over the rim: the freeboard only, so the face's water stands at the rim.
    const high = tab.rimM[s] * 0.9;
    expect(sent(high)).toBeCloseTo(Math.max(tab.rimM[s] - high, 0), 6);
    expect(high + sent(high)).toBeLessThanOrEqual(tab.rimM[s] + 1e-6);
    // A crest over the rim sends no crest back; a trough is not capped.
    expect(sent(tab.rimM[s] + 0.2)).toBe(0);
    expect(sent(-0.4)).toBeCloseTo(im.reflectShare * -0.4, 6);
  });

  it('the jet\'s air disperses a drop by its inertia: linear in the path for the mist, less for a heavy drop', () => {
    // A massless tracer follows the air: sigma = S' s.
    expect(splashTurbulentSigma(4, 6, 0)).toBeCloseTo(SPLASH_JET_SPREAD * 4, 9);
    expect(splashTurbulentSigma(0, 6, 0)).toBe(0);
    // Taylor: the air's sigma doubles with the path.
    expect(splashTurbulentSigma(8, 6, 0) / splashTurbulentSigma(4, 6, 0)).toBeCloseTo(2, 9);
    // The drops' drag times at 6 m/s: 0.1 mm mist, 1 mm, 2 cm.
    const tau = (D: number) => 1 / splashDragPerSpeed(D, 6);
    const mist = splashTurbulentSigma(4, 6, tau(1e-4));
    const fine = splashTurbulentSigma(4, 6, tau(1e-3));
    const big = splashTurbulentSigma(4, 6, tau(0.02));
    expect(mist).toBeGreaterThan(0.9 * SPLASH_JET_SPREAD * 4);
    expect(fine).toBeLessThan(mist);
    expect(big).toBeLessThan(fine);
    expect(big).toBeLessThan(0.3 * SPLASH_JET_SPREAD * 4);
  });

  it('a drop parcel spreads with the path it has flown, and its child keeps the path', () => {
    const pool = new SplashPool(4000, 11);
    const i = pool.emit(SPLASH_DROP, 0, 1, 0, 0, 8, 0, 0.02, 0, 1, 0.5, 6 / 0.001, 0.001);
    const sigma0 = pool.spreadSigmaOf(i);
    const env = { airX: 0, airZ: 0, seaHeight: () => -1000 };
    for (let k = 0; k < 30; k += 1) pool.step(1 / 60, env);
    expect(pool.pathM[i]).toBeGreaterThan(1);
    const turb = pool.turbSigmaOf(i);
    expect(turb).toBeGreaterThan(0.02);
    // The profile adds the air's spread in quadrature to the jitter's.
    const jitter = Math.sqrt(Math.max(pool.spanM[i], pool.scaleM[i]) ** 2 + (2 * pool.spreadMs[i] * pool.age[i]) ** 2) / Math.sqrt(12);
    expect(pool.spreadSigmaOf(i)).toBeCloseTo(Math.hypot(jitter, turb), 9);
    expect(pool.spreadSigmaOf(i)).toBeGreaterThan(sigma0);
    // A sheet is one piece of water: no dispersion.
    const j = pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 8, 0, 0.05, 0, 1, 5, 2 / 0.005, 0.005);
    pool.markSheet(j, 0, 0, -1, 1.2);
    expect(pool.stripM[j]).toBeCloseTo(1.2, 6);
    // Round 19 (THE CURTAIN'S RIM): a 1.2 m strip of 5 mm sheet loses 2 v / W = 0.28 of its water a second at its two
    // ends and cuts a ligament off at a piece of its launch water (m0 / SPLASH_RIM_PIECES, 0.625 kg): the first child
    // comes after about 0.45 s, not at round 6's 44 a second, so the sheet flies 40 steps here (was 10).
    for (let k = 0; k < 40; k += 1) pool.step(1 / 60, env);
    expect(pool.turbSigmaOf(j)).toBe(0);
    // Its children carry its path (they fly in its air).
    let child = -1;
    for (let a = 0; a < pool.alive; a += 1) { const c = pool.aliveIndex[a]; if (c !== i && c !== j && pool.pathM[c] > 0) child = c; }
    expect(child).toBeGreaterThanOrEqual(0);
    expect(pool.pathM[child]).toBeGreaterThan(0.5);
  });

  it('a film is a mirror only when it is thicker than the stone\'s grain (Nusselt, Jeffreys)', () => {
    // Nusselt: (3 nu q / g sin a)^(1/3); q = 0.01 m^2/s on a vertical face: 1.5 mm.
    expect(rockNusseltFilmM(0.01, 1)).toBeCloseTo(Math.cbrt((3 * ROCK_WATER_NU_M2S * 0.01) / GRAVITY_MS2), 12);
    expect(rockNusseltFilmM(0.01, 1)).toBeGreaterThan(0.0012);
    expect(rockNusseltFilmM(0.01, 1)).toBeLessThan(0.002);
    // Jeffreys: a draining film thins as t^(-1/2): a quarter of the time, twice as thick.
    expect(rockDrainingFilmM(1, 1, 1) / rockDrainingFilmM(1, 1, 4)).toBeCloseTo(2, 9);
    // A meter down after a second: 0.35 mm, about the grain; after ten seconds 0.11 mm.
    expect(rockDrainingFilmM(1, 1, 1)).toBeGreaterThan(0.0003);
    expect(rockDrainingFilmM(1, 1, 10)).toBeLessThan(0.00015);
    // The mirror's share (round 14: the share of the grain the film drowns, Rq 2.5 mm; round 11's
    // h / (h + 0.3 mm) gave half at 0.3 mm and 0.84 on the cascade): 0.21 at 0.3 mm, two thirds on a
    // cascade, little on a drained face.
    expect(rockFilmMirrorShare(ROCK_MICRO_ROUGH_M)).toBeCloseTo(0.211, 3);
    expect(rockFilmMirrorShare(rockNusseltFilmM(0.01, 1))).toBeGreaterThan(0.6);
    expect(rockFilmMirrorShare(rockDrainingFilmM(1, 1, 10))).toBeLessThan(0.3);
    expect(rockFilmMirrorShare(0)).toBe(0);
  });
  it('the reflected wave holds over the submerged run of the face, then falls inside the rock', () => {
    const tab = table();
    for (let s = 0; s < tab.sectors; s += 1) {
      const hold = rockReflectHoldM(tab, s);
      // The run from the waterline to the rim, at the face's own slope.
      expect(hold).toBeCloseTo(Math.max(tab.waterlineM[s] - rockRadiusAt(tab, s, tab.rimM[s]), 0), 12);
      expect(hold).toBeGreaterThanOrEqual(0);
      expect(rockReflectInside(0.5, hold)).toBe(1);
      expect(rockReflectInside(-hold, hold)).toBe(1);
      expect(rockReflectInside(-hold - ROCK_REFLECT_SKIN_M, hold)).toBe(0);
    }
    // A face that leans back holds longer than a steep one (a run of rim / tan(slope)).
    let lo = 0; let hi = 0;
    for (let s = 1; s < tab.sectors; s += 1) { if (tab.slopeRad[s] < tab.slopeRad[lo]) lo = s; if (tab.slopeRad[s] > tab.slopeRad[hi]) hi = s; }
    expect(rockReflectHoldM(tab, lo) / tab.rimM[lo]).toBeGreaterThan(rockReflectHoldM(tab, hi) / tab.rimM[hi]);
  });
});

describe('rocks round 12: the apex meets the reflected linear wave', () => {
  it('takes back K_r of the shoaled linear wave once, never the breaking front', () => {
    const g = GRAVITY_MS2;
    // Head on: the inflow less K_r of eta sqrt(g / d).
    expect(rockApexClosingSpeed(4, 0.8, 1, 1.0, 2.5)).toBeCloseTo(4 - 0.8 * Math.sqrt(g / 2.5), 9);
    // No crest, no linear wave to reflect: the front closes the apex at its whole speed.
    expect(rockApexClosingSpeed(3.5, 0.8, 1, 0, 2.5)).toBeCloseTo(3.5, 12);
    // A face that reflects nothing keeps the whole inflow; the speed is never negative.
    expect(rockApexClosingSpeed(3.5, 0, 1, 1.2, 2.5)).toBeCloseTo(3.5, 12);
    expect(rockApexClosingSpeed(0.2, 0.8, 1, 2, 2.5)).toBe(0);
  });

  it('counts the heading once: a flank and a head-on face keep the same share of a front-borne inflow', () => {
    // Round 9's (1 - K_r h) u kept 1 - 0.8 * 0.5 = 60% on a flank of h = 0.5 and 20% head on.
    const front = 4; const kr = 0.8; const eta = 1; const d = 2.5;
    const headOn = rockApexClosingSpeed(front * 1, kr, 1, eta, d) / (front * 1);
    const flank = rockApexClosingSpeed(front * 0.5, kr, 0.5, eta, d) / (front * 0.5);
    expect(flank).toBeCloseTo(headOn, 12);
    // The head-on share sits between round 11's (1 - K_r) and the whole inflow.
    expect(headOn).toBeGreaterThan(1 - kr);
    expect(headOn).toBeLessThan(1);
  });

  it('keeps the same apex share on a face that looks at the sea and on a flank struck by the same water', () => {
    const tab = table();
    // Two faces, the same crest and the same speed along each face's own normal (no front: deficit 0, off the reef's surf).
    const deep = { ...tab, reefDepthM: 30 };
    const im = (s: number) => rockFaceImpact(deep, s, { etaM: 1.8, velX: -5.5 * tab.normalX[s], velY: 0, velZ: -5.5 * tab.normalZ[s], deficit: 0 }, SEA, newImpact());
    let best = 0; let worst = 0;
    const facing = (s: number) => -(tab.normalX[s] * Math.cos(SEA.windDirRad) + tab.normalZ[s] * Math.sin(SEA.windDirRad));
    for (let s = 1; s < tab.sectors; s += 1) { if (facing(s) > facing(best)) best = s; if (facing(s) < facing(worst) && facing(s) > 0.5) worst = s; }
    const a = im(best); const b = im(worst);
    // The apex keeps the same share of the same inflow whatever the sea's heading share (round 9: more on the
    // flank); only K_r differs, by the two faces' slopes (Iribarren), so to 3 places.
    expect(a.apexMs / a.inflowMs).toBeCloseTo(b.apexMs / b.inflowMs, 3);
  });

  it('draws a spread parcel as its drop trains: as many as fit its region, never more than its drops (THE REGION GROWS, THE DROPS DO NOT)', () => {
    // A region four train widths across holds 16 trains by area; the budget caps it.
    expect(splashTrainCount(0.4, 0.1, 1e6)).toBe(SPLASH_TRAIN_MAX);
    expect(splashTrainCount(0.2, 0.1, 1e6)).toBeCloseTo(4, 12);
    // A parcel of three drops is three trains; a fresh parcel (region = train) is one.
    expect(splashTrainCount(0.4, 0.1, 3)).toBeCloseTo(3, 12);
    expect(splashTrainCount(0.1, 0.1, 50)).toBe(1);
    expect(splashTrainCount(0.3, 0, 50)).toBe(1);
    // A train's offset is a fixed draw of the parcel's seed: the same every frame, and the
    // draws are standard normals (mean 0, variance 1 per axis over many parcels).
    const o1 = splashTrainOffset(0.37, 2, new Float64Array(3));
    const o2 = splashTrainOffset(0.37, 2, new Float64Array(3));
    expect(Array.from(o1)).toEqual(Array.from(o2));
    let s = 0; let s2 = 0; const n = 4000; const o = new Float64Array(3);
    for (let k = 0; k < n; k += 1) { splashTrainOffset(k / n, k % 8, o); s += o[0] + o[1] + o[2]; s2 += o[0] * o[0] + o[1] * o[1] + o[2] * o[2]; }
    expect(Math.abs(s / (3 * n))).toBeLessThan(0.05);
    expect(s2 / (3 * n)).toBeGreaterThan(0.9);
    expect(s2 / (3 * n)).toBeLessThan(1.1);
  });

  it('gives a train the spread of its own drops: one drop is the drop, the region is wider than any train', () => {
    // Aerated jet sheets with water (round 7's form): they puncture into strands and drops.
    const pool = new SplashPool(20000, 4);
    for (let k = 0; k < 20; k += 1) {
      const i = pool.emit(SPLASH_SHEET, 3, 1, 0, 3, 9, 0, 0.2, 0, 1, 8, 2 / 0.04, 0.04);
      pool.markSheet(i, 0.5, 0, 0);
    }
    const env = { airX: 0, airZ: 0, seaHeight: () => -50 };
    for (let i = 0; i < 90; i += 1) pool.step(1 / 60, env);
    let checked = 0;
    for (let a = 0; a < pool.alive; a += 1) {
      const i = pool.aliveIndex[a];
      if (pool.mass[i] <= 0 || pool.areaV[i] <= 0) continue;
      if (pool.kind[i] === SPLASH_MIST) { expect(pool.trainSigmaOf(i)).toBe(0); continue; }
      if (pool.kind[i] === SPLASH_SHEET && pool.h0M[i] > 0) { expect(pool.trainSigmaOf(i)).toBe(0); continue; }
      if (pool.bulk[i] === 1) continue;
      expect(pool.trainSigmaOf(i, 1)).toBeCloseTo(pool.scaleM[i] / Math.sqrt(12), 9);
      expect(pool.trainSigmaOf(i)).toBeGreaterThanOrEqual(pool.trainSigmaOf(i, 3));
      expect(pool.trainSigmaOf(i)).toBeLessThanOrEqual(pool.spreadSigmaOf(i) + 1e-12);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('lays a landed lump as the raft of its own bubbles (the collar)', () => {
    // A kilogram at void 0.5 with 1 mm bubbles: (3 / 2)(m / rho) / D_b, about 1.46 m^2.
    expect(splashBubbleRaftM2(1, 0.5, 0.001)).toBeCloseTo((1.5 * (1 / SPLASH_WATER_RHO)) / 0.001, 12);
    // Twice the water, twice the raft; finer bubbles, a larger raft; no air, no raft.
    expect(splashBubbleRaftM2(2, 0.5, 0.001)).toBeCloseTo(2 * splashBubbleRaftM2(1, 0.5, 0.001), 12);
    expect(splashBubbleRaftM2(1, 0.5, 0.0005)).toBeCloseTo(2 * splashBubbleRaftM2(1, 0.5, 0.001), 12);
    expect(splashBubbleRaftM2(1, 0, 0.001)).toBe(0);
  });

  it('keeps a falling film whole over the least wetting rate, and gives it an edge under it (Hartley and Murgatroyd)', () => {
    // About a quarter of a millimeter and 7e-5 m^2/s on a vertical face, for water on wet stone.
    expect(rockFilmMinThicknessM(1)).toBeGreaterThan(0.2e-3);
    expect(rockFilmMinThicknessM(1)).toBeLessThan(0.4e-3);
    expect(rockFilmMinFlowM2s(1)).toBeGreaterThan(3e-5);
    expect(rockFilmMinFlowM2s(1)).toBeLessThan(1.5e-4);
    // delta_min goes as (g sin a)^(-2/5), so q_min as sin(a)^(-1/5): the shader's form.
    expect(rockFilmMinFlowM2s(0.5) / rockFilmMinFlowM2s(1)).toBeCloseTo(0.5 ** -0.2, 9);
    // The least flow is the Nusselt flow of the least thickness.
    const d = rockFilmMinThicknessM(0.8);
    expect(rockFilmMinFlowM2s(0.8)).toBeCloseTo((GRAVITY_MS2 * 0.8 * d ** 3) / (3 * ROCK_WATER_NU_M2S), 12);
  });
});
