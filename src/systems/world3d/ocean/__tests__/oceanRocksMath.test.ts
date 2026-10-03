/**
 * Tests for the rocks' model (oceanRocksMath.ts): the face relations, the
 * gates that keep a calm sea quiet, and the determinism of the fixed-step
 * simulation that a pinned capture relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  ROCK_DT_S,
  ROCK_JET_GAIN,
  ROCK_JET_MAX_MS,
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
  rockFaceImpact,
  rockFaceTable,
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
  SPLASH_VOLUME_GAIN,
  SPLASH_VOLUME_SUN_FLOOR,
  splashLight,
  sunThroughAir,
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

const newImpact = (): RockFaceImpact => ({ inflowMs: 0, breaking: 0, runUpM: 0, standingM: 0, jet: 0, jetMs: 0, overtopM2s: 0, struck: 0 });

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
    const sinA = Math.sin(tab.slopeRad[s]);
    expect(big.jetMs).toBeCloseTo(Math.min(ROCK_JET_GAIN * big.inflowMs * Math.sqrt(sinA), ROCK_JET_MAX_MS), 5);
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
  });

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
  });

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

  it('draws a plume as one volume: dense at its base, lit on top, grey in its core (round 3)', () => {
    const pool = new SplashPool(8192, 5);
    // A column of sheets: many at its base (0 to 1 m up), few at its top (3 to 4 m).
    for (let k = 0; k < 600; k += 1) {
      const u = pool.random(); const v = pool.random(); const w = pool.random();
      pool.emit(SPLASH_SHEET, (u - 0.5) * 1.2, v, (w - 0.5) * 1.2, 0, 0, 0, 0.3, 0);
    }
    for (let k = 0; k < 20; k += 1) {
      const u = pool.random(); const v = pool.random(); const w = pool.random();
      pool.emit(SPLASH_SHEET, (u - 0.5) * 1.2, 3 + v, (w - 0.5) * 1.2, 0, 0, 0, 0.3, 0);
    }
    // A particle of another owner, and a fall, add nothing.
    pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 0, 0, 0.3, 1);
    pool.emit(SPLASH_FALL, 0, 1, 0, 0, 0, 0, 0.05, 0);
    const vol = new SplashVolume({ nx: 24, ny: 32, nz: 24, cellM: 0.2 });
    vol.build(pool, 0, () => 0.9);
    expect(vol.empty).toBe(false);
    const { nx, ny } = vol.spec;
    const at = (x: number, y: number, z: number) => {
      const ix = Math.floor((x - vol.ox) / 0.2); const iy = Math.floor((y - vol.oy) / 0.2); const iz = Math.floor((z - vol.oz) / 0.2);
      return (iz * ny + iy) * nx + ix;
    };
    // Dense and opaque at its base: over 0.4 m the base is more than 90% opaque.
    expect(vol.sigma[at(0, 0.5, 0)]).toBeGreaterThan(6);
    expect(vol.sigma[at(0, 0.5, 0)]).toBeGreaterThan(4 * vol.sigma[at(0, 3.5, 0)]);
    // The mass is kept by the splat (a sheet's cross-section over the cell volume, summed).
    let total = 0;
    for (const s of vol.sigma) total += s;
    const expected = 620 * SPLASH_VOLUME_GAIN[SPLASH_SHEET] * (1.6 * 0.3 * 0.3 * 0.9) / 0.008;
    expect(total).toBeGreaterThan(expected * 0.97);
    expect(total).toBeLessThan(expected * 1.03);
    // Lit from above: the top gets more sun and sky than the base's core.
    vol.light(0, 1, 0);
    const lAt = (x: number, y: number, z: number) => {
      const ix = Math.floor((x - vol.ox) / 0.4); const iy = Math.floor((y - vol.oy) / 0.4); const iz = Math.floor((z - vol.oz) / 0.4);
      return (iz * vol.ly + iy) * vol.lx + ix;
    };
    expect(vol.sun[lAt(0, 4.5, 0)]).toBeGreaterThan(0.9);
    expect(vol.sun[lAt(0, 3.8, 0)]).toBeGreaterThan(vol.sun[lAt(0, 0.3, 0)] + 0.1);
    expect(vol.sun[lAt(0, 0.3, 0)]).toBeLessThan(0.35);
    expect(vol.sun[lAt(0, 0.3, 0)]).toBeGreaterThanOrEqual(SPLASH_VOLUME_SUN_FLOOR - 1e-6);
    expect(vol.sky[lAt(0, 0.3, 0)]).toBeLessThan(vol.sky[lAt(0, 3.8, 0)]);
    // Pure: the same pool gives the same grids.
    const again = new SplashVolume({ nx: 24, ny: 32, nz: 24, cellM: 0.2 });
    again.build(pool, 0, () => 0.9);
    again.light(0, 1, 0);
    expect(Array.from(again.sigma)).toEqual(Array.from(vol.sigma));
    expect(Array.from(again.sun)).toEqual(Array.from(vol.sun));
    // An owner with no water leaves the grid empty.
    const none = new SplashVolume({ nx: 8, ny: 8, nz: 8, cellM: 0.2 });
    none.build(pool, 2, () => 1);
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

  it('draws a fast parcel out along its flight and keeps its mass', () => {
    const pool = new SplashPool(64, 3);
    pool.emit(SPLASH_SHEET, 0, 2, 0, 0, 10, 0, 0.3, 0);
    const vol = new SplashVolume({ nx: 24, ny: 40, nz: 24, cellM: 0.2 });
    vol.build(pool, 0, () => 1);
    const { nx, ny, nz } = vol.spec;
    let total = 0; let spanY = 0; let spanX = 0;
    let yLo = Infinity; let yHi = -Infinity; let xLo = Infinity; let xHi = -Infinity;
    for (let z = 0; z < nz; z += 1) for (let y = 0; y < ny; y += 1) for (let x = 0; x < nx; x += 1) {
      const v = vol.sigma[(z * ny + y) * nx + x];
      if (v <= 0) continue;
      total += v;
      yLo = Math.min(yLo, y); yHi = Math.max(yHi, y); xLo = Math.min(xLo, x); xHi = Math.max(xHi, x);
    }
    spanY = yHi - yLo + 1; spanX = xHi - xLo + 1;
    expect(spanY).toBeGreaterThan(2 * spanX);
    expect(total).toBeCloseTo((1.6 * 0.3 * 0.3 * SPLASH_VOLUME_GAIN[SPLASH_SHEET]) / 0.008, 3);
    // The flight axis is straight up.
    expect(vol.axisY).toBeCloseTo(1, 6);
  });
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
