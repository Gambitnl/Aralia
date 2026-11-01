/**
 * Rocks round 18 (the ocean gauntlet): THE ROLLER CLIMBS ONLY WHERE THE CREST STRIKES, THE WASH-OVER HAS A PLACE
 * (the top's net by a priority flood and its sheet of the weir's water, moved by the slope and Manning's friction),
 * and THE EDGE TEARS (the march's Kolmogorov field: its spectrum, its unit variance, its lognormal multiplier of
 * mean 1, the intensity by the gradient closure). The Kalaloch rock's lobes are the clip's measure (rocks.ts):
 * a test here checks the wide low cluster they make.
 */
import { describe, expect, it } from 'vitest';
import {
  ROCK_BODY_MAX,
  ROCK_ROLLER_AREA_PER_L2,
  ROCK_ROLLER_PER_H,
  ROCK_SHEET_MAX_M,
  ROCK_TOP_INFLOW_AIR,
  ROCK_WEIR_C,
  RockSurf,
  RockTopSheet,
  buildRockMesh,
  checkRockLobes,
  rockBodyCensus,
  rockFaceTable,
  rockRollerBodies,
  rockTopNet,
  type RockSeaParams,
  type RockSpec,
} from '../oceanRocksMath';
import {
  SPLASH_BODY_STRIDE,
  SPLASH_TURB_AXIS_I,
  SPLASH_TURB_NOISE_VAR,
  SPLASH_TURB_OCTAVES,
  splashTurbAmplitudes,
  splashTurbField,
  splashTurbHash,
  splashTurbIntensity,
  splashTurbMultiplier,
  splashTurbNoise,
} from '../oceanSplashMath';
import { GRAVITY_MS2 } from '../oceanConfig';

const SPEC: RockSpec = {
  xM: 0, zM: -40, halfLengthM: 3, halfWidthM: 2, headingRad: 0.3, topM: 1.6, baseM: 3,
  squareness: 2.6, flatness: 3.2, taper: 0.25, tiltAlong: 0.05, tiltAcross: -0.03,
  lumps: 0.08, creaseM: 0.08, seed: 11,
};
/** The Kalaloch rock of rocks.ts (round 18), as solved from the clip's silhouette (rocks/r18/lobes18.ts). */
const KALALOCH: RockSpec = {
  xM: 0, zM: -60, halfLengthM: 3.0, halfWidthM: 2.2, headingRad: 0.18, topM: 2.27, baseM: 4.5,
  squareness: 3.2, flatness: 4.5, taper: 0.12, tiltAlong: 0, tiltAcross: 0,
  lumps: 0.07, creaseM: 0.14, seed: 101, facets: 14,
  lobes: [
    { dxM: 0.45, dzM: 0.9, halfLengthM: 2.2, halfWidthM: 2.4, upM: 2.2, downM: 4.5, headingRad: 0, squareness: 5, flatness: 5.5 },
    { dxM: -0.85, dzM: 0.3, halfLengthM: 2.12, halfWidthM: 1.25, upM: 2.27, downM: 4.5, headingRad: 0, squareness: 4.5, flatness: 5 },
    { dxM: -2.25, dzM: 0.3, halfLengthM: 2.7, halfWidthM: 1.4, upM: 2.06, downM: 4.5, headingRad: 0.07, squareness: 3.8, flatness: 4.2 },
    { dxM: 1.6, dzM: -1.05, halfLengthM: 2.0, halfWidthM: 1.85, upM: 1.9, downM: 4.5, headingRad: -0.11, squareness: 4.2, flatness: 4.5 },
  ],
};
const SEA: RockSeaParams = { hsM: 4.2, peakLengthM: 123, crestSpeedMs: 9.7, windDirRad: Math.PI + 0.35, windSpeedMs: 20 };

describe('rocks round 18: the Kalaloch rock is a wide low cluster (GG-418)', () => {
  it('holds the rock\'s center in every lobe and stands about four times wider than its height over the judged water', () => {
    expect(() => checkRockLobes(KALALOCH)).not.toThrow();
    const m = buildRockMesh(KALALOCH, 4);
    let x0 = Infinity; let x1 = -Infinity; let top = -Infinity;
    for (let v = 0; v < m.vertexCount; v += 1) {
      const y = m.positions[v * 3 + 1];
      top = Math.max(top, y);
      // Over the judged instant's water (1.4 m), seen along +z: its width across the view.
      if (y > 1.4) { x0 = Math.min(x0, m.positions[v * 3]); x1 = Math.max(x1, m.positions[v * 3]); }
    }
    expect(top).toBeLessThan(2.4);
    // The silhouette's 4.96 m over 1.19 m in the frame (the clip's 4.07 with the top's depth foreshortened):
    // the stone over the water is at least 5 times wider than it is high.
    expect((x1 - x0) / (top - 1.4)).toBeGreaterThan(5);
  });
});

describe('rocks round 18: the roller climbs only where the crest strikes', () => {
  it('lays no face roller from the sea\'s own breaking share alone; the struck share lays it', () => {
    const tab = rockFaceTable(SPEC, buildRockMesh(SPEC, 4));
    const sim = new RockSurf([tab], SEA);
    for (const st of sim.rocks[0].sectors) { st.etaM = 0.6; st.standingM = 1.0; st.swashM = 1.5; st.breaking = 1; st.faceBreak = 0; st.bodyAir = 1; st.bodyY90 = 0.3; }
    const out = new Float32Array(ROCK_BODY_MAX * SPLASH_BODY_STRIDE);
    rockRollerBodies(sim, 0, out);
    expect(rockBodyCensus.face).toBe(0);
    sim.rocks[0].sectors[3].faceBreak = 1;
    rockRollerBodies(sim, 0, out);
    expect(rockBodyCensus.face).toBeGreaterThan(0);
  });
});

describe('rocks round 18: the top\'s net (a priority flood; Barnes et al. 2014)', () => {
  const tab = rockFaceTable(SPEC, buildRockMesh(SPEC, 4));
  const net = rockTopNet(tab);
  it('fills every pit: no cell under its stone, and every cell drains to the edge down its filled height', () => {
    expect(net.grid.length).toBeGreaterThan(50);
    for (let c = 0; c < net.grid.length; c += 1) expect(net.hFill[c]).toBeGreaterThanOrEqual(net.h[c] - 1e-6);
    // From every interior cell some neighbor stands lower (the flood's 1e-4 m step), so a walk down ends on the edge.
    const NB = [-1, 1, -net.n, net.n, -net.n - 1, -net.n + 1, net.n - 1, net.n + 1];
    for (let c = 0; c < net.grid.length; c += 1) {
      if (net.edge[c]) continue;
      let lower = false;
      for (const o of NB) { const d = net.slot[net.grid[c] + o]; if (d >= 0 && net.hFill[d] < net.hFill[c]) lower = true; }
      expect(lower).toBe(true);
    }
  });
  it('gives every sector edge cells for the sea\'s water to enter by', () => {
    for (let s = 0; s < tab.sectors; s += 1) expect(net.entry[s].length).toBeGreaterThan(0);
  });
});

describe('rocks round 18: the wash-over sheet (the weir\'s water; Manning on the top\'s slope)', () => {
  const tab = rockFaceTable(KALALOCH, buildRockMesh(KALALOCH, 4));
  const net = rockTopNet(tab);
  const pour = (head: number) => {
    const sheet = new RockTopSheet(net);
    const q = new Float64Array(tab.sectors); const v = new Float64Array(tab.sectors); const out = new Float64Array(tab.sectors); const tot = new Float64Array(tab.sectors);
    for (let s = 0; s < tab.sectors; s += 1) if (tab.normalZ[s] > 0.5) { q[s] = ROCK_WEIR_C * head ** 1.5 * tab.widthM[s]; v[s] = Math.sqrt(GRAVITY_MS2 * (2 / 3) * head); }
    const zero = new Float64Array(tab.sectors);
    let vin = 0;
    const dt = 1 / 60;
    for (let k = 0; k < 600; k += 1) {
      const qq = k * dt < 0.5 ? q : zero;
      sheet.step(qq, v, tab.normalX, tab.normalZ, dt, out);
      for (let s = 0; s < tab.sectors; s += 1) { vin += qq[s] * dt; tot[s] += out[s]; }
    }
    let on = 0; for (let c = 0; c < sheet.depth.length; c += 1) on += sheet.depth[c] * net.cellM ** 2;
    let struck = 0; let lee = 0;
    for (let s = 0; s < tab.sectors; s += 1) { if (tab.normalZ[s] > 0.5) struck += tot[s]; if (tab.normalZ[s] < -0.5) lee += tot[s]; }
    return { vin, on, out: tot.reduce((a, b) => a + b, 0), struck, lee, sheet };
  };
  it('keeps the water: what came in is on the top or left over an edge', () => {
    for (const h of [0.2, 0.6]) {
      const r = pour(h);
      expect(Math.abs(r.vin - r.on - r.out - r.sheet.dropped) / r.vin).toBeLessThan(1e-5);
    }
  });
  it('sends a weak wash-over back off the struck side and a strong one across the top to the lee', () => {
    const weak = pour(0.2); const strong = pour(0.6);
    expect(weak.lee / weak.out).toBeLessThan(0.05);
    expect(strong.lee / strong.out).toBeGreaterThan(0.1);
  });
  it('lets the water in white only by the struck bore\'s roller share, 0.11 x 0.9', () => {
    expect(ROCK_TOP_INFLOW_AIR).toBeCloseTo(ROCK_ROLLER_AREA_PER_L2 * ROCK_ROLLER_PER_H, 12);
    expect(ROCK_SHEET_MAX_M).toBeGreaterThan(0);
  });
});

describe('rocks round 18: the edge tears (a Kolmogorov field; Spalding\'s closure)', () => {
  it('hashes to 0 to 1 and draws a value noise of -1 to 1', () => {
    for (let k = 0; k < 2000; k += 1) {
      const h = splashTurbHash(k * 1.7, k * 0.3 - 5, k * 2.9 + 1);
      expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1);
      const n = splashTurbNoise(k * 0.37, k * 0.11, k * 0.53);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
    }
    expect(SPLASH_TURB_NOISE_VAR).toBeGreaterThan(0.05);
    expect(SPLASH_TURB_NOISE_VAR).toBeLessThan(0.34);
  });
  it('scales the octaves to unit variance, 2^(-k/3) each, down to the cell', () => {
    const a = new Float32Array(SPLASH_TURB_OCTAVES);
    const K = splashTurbAmplitudes(3.2, 0.1, a);
    expect(K).toBe(6);
    let v = 0; for (let k = 0; k < SPLASH_TURB_OCTAVES; k += 1) v += a[k] * a[k];
    expect(v * SPLASH_TURB_NOISE_VAR).toBeCloseTo(1, 5);
    expect(a[1] / a[0]).toBeCloseTo(2 ** (-1 / 3), 5);
    expect(a[6]).toBe(0);
    // The field's own variance over many points is near 1.
    let s = 0; let s2 = 0; const n = 6000;
    for (let k = 0; k < n; k += 1) { const g = splashTurbField(k * 0.913, k * 0.377 + 3, k * 0.611 - 7, 3.2, a); s += g; s2 += g * g; }
    expect(s2 / n - (s / n) ** 2).toBeGreaterThan(0.8);
    expect(s2 / n - (s / n) ** 2).toBeLessThan(1.2);
  });
  it('has the -5/3 spectrum along a line between the integral scale and the cell', () => {
    const a = new Float32Array(SPLASH_TURB_OCTAVES);
    splashTurbAmplitudes(6.4, 0.1, a);
    const N = 4096; const dx = 0.025;
    const reps = 8; const P = new Float64Array(N / 2);
    for (let r = 0; r < reps; r += 1) {
      const f = new Float64Array(N);
      for (let i = 0; i < N; i += 1) f[i] = splashTurbField(i * dx, 1.3 + r * 7.1, 2.7 - r * 3.3, 6.4, a);
      // A plain DFT at log-spaced wavenumbers (no FFT library in the test).
      for (let k = 2; k < N / 2; k = Math.ceil(k * 1.25)) {
        let re = 0; let im = 0;
        for (let i = 0; i < N; i += 1) { const ph = (2 * Math.PI * k * i) / N; re += f[i] * Math.cos(ph); im -= f[i] * Math.sin(ph); }
        P[k] += (re * re + im * im) / reps;
      }
    }
    // The slope between wavelengths of 2 m and 0.25 m (inside the octaves 6.4 m to 0.1 m).
    const xs: number[] = []; const ys: number[] = [];
    for (let k = 2; k < N / 2; k = Math.ceil(k * 1.25)) {
      const lam = (N * dx) / k;
      if (lam <= 2 && lam >= 0.25 && P[k] > 0) { xs.push(Math.log(k)); ys.push(Math.log(P[k])); }
    }
    const mx = xs.reduce((p, q) => p + q, 0) / xs.length; const my = ys.reduce((p, q) => p + q, 0) / ys.length;
    let sxy = 0; let sxx = 0; for (let i = 0; i < xs.length; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const slope = sxy / sxx;
    expect(slope).toBeGreaterThan(-5 / 3 - 0.45);
    expect(slope).toBeLessThan(-5 / 3 + 0.45);
  });
  it('gives the axis the turbulence intensity, grows toward the edge with the mean\'s gradient, and keeps the mean', () => {
    expect(splashTurbIntensity(0, 2)).toBeCloseTo(SPLASH_TURB_AXIS_I, 12);
    expect(splashTurbIntensity(1, 2)).toBeGreaterThan(2);
    // A Gaussian's edge at two widths (|grad ln rho| = r / s^2 = 2 / s, L = s): about 2.
    expect(splashTurbIntensity(2 / 1.5, 1.5)).toBeCloseTo(Math.sqrt(0.04 + 4), 9);
    // The lognormal multiplier of a unit Gaussian G has mean 1 (sampled by Box-Muller on a fixed lattice).
    for (const I of [0.2, 1, 2]) {
      let m = 0; const n = 20000;
      for (let k = 0; k < n; k += 1) {
        const u1 = (k + 0.5) / n; const u2 = ((k * 0.6180339887) % 1);
        const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        m += splashTurbMultiplier(g, I) / n;
      }
      expect(m).toBeGreaterThan(0.93); expect(m).toBeLessThan(1.07);
    }
  });
});
