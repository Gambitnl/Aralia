/**
 * The river mouth's laws, ledger and seam (river mouth round 1, ADR 0006).
 * Each test names the law or the claim it holds.
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';
import { oceanBandPeriodS, oceanShelfDepthCpu } from '../oceanBathymetry';
import { IncidentWaves, beachToWorld, forcingCascades } from '../oceanBeachMath';
import { seabedPointAt, valleyCutAt } from '../oceanSeabedMath';
import {
  COAST_BEACH_GRID, HG_DEPTH_C, HG_WIDTH_A, MouthClock, bandPeriodS, bandShareCpu, channelNormalDepthM, createMouthSim,
  currentShare, deriveMouthDesign, envelopeHoldCpu, groupSpeed, holdShareCpu, jetAt, jetFrontFoam, jetTakeover, mouthHandoverAt, mouthHandoverLengthM, mouthSwashWalls,
  packMouthState, riverColumnTransCpu, turbidOptics,
} from '../oceanMouthMath';

const cascades = oceanSeaState('surf');
const seed = 0x0cea9;
// A short sea measure keeps the test quick; the page measures 1200 s.
const design = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades, n: OCEAN_FFT_N, seed, statsSpanS: 120, place: 'creek', mouthA: 40, barLaw: 'break' });

describe('the design', () => {
  it('takes the channel from the discharge by hydraulic geometry (Leopold and Maddock 1953; Moody and Troutman 2002)', () => {
    expect(design.dischargeM3S).toBe(1.5);
    expect(design.widthM).toBeCloseTo(HG_WIDTH_A * 1.5 ** 0.5, 9);
    expect(design.depthM).toBeCloseTo(HG_DEPTH_C * 1.5 ** 0.4, 9);
    // Continuity: the mouth's mean speed is the discharge over the section.
    expect(design.u0MS * design.areaM2).toBeCloseTo(1.5, 9);
  });

  it('cuts a channel as wide as the hydraulic geometry at the mean sea level at the mouth', () => {
    const v = design.valley;
    // Walk across the axis at the mouth; the cut stands at 0 m at the channel's edge.
    const half = v.widthM / 2;
    const at = (n: number) => valleyCutAt(v, v.mouthX - v.inZ * n, v.mouthZ + v.inX * n);
    expect(at(0)).toBeCloseTo(-v.depthM, 9);
    expect(at(half)).toBeCloseTo(0, 9);
    expect(at(-half)).toBeCloseTo(0, 9);
  });

  it('holds the bar to the sea bathymetry shelf law on its axis', () => {
    const b = design.bar!;
    expect(b).not.toBeNull();
    const shelf = [{ xM: b.xM, zM: b.zM, innerM: b.innerM, outerM: b.outerM, depthM: b.depthM, farDepthM: b.floorDepthM }];
    // Over the crest on the axis the floor and the shelf law stand at one depth. Round 6: across the axis the
    // crest falls by the deposit's Gaussian (laterM; oceanMouthRound6.test.ts), and the mouth no longer lays
    // the bar as a shelf, so the off-axis points of round 5 are taken along the axis.
    for (const r of [0, b.innerM * 0.99]) {
      const x = b.xM + design.valley.inX * r;
      const z = b.zM + design.valley.inZ * r;
      expect(seabedPointAt(design.params, x, z).depthM).toBeCloseTo(b.depthM, 6);
      expect(oceanShelfDepthCpu(shelf, x, z)).toBeCloseTo(b.depthM, 6);
    }
    // Round 3: the crest stands where the sea's wave, held to the floor there (H = 0.55 d), breaks in full (H / d = 0.75).
    expect(b.depthM).toBeCloseTo(Math.min(design.hsM, 0.55 * b.floorDepthM) / 0.75, 9);
  });

  it('keeps the band period law equal to the bathymetry module\'s', () => {
    for (const c of cascades) expect(bandPeriodS(c)).toBeCloseTo(oceanBandPeriodS(c), 12);
  });

  it('walls off exactly the swash cells under the mouth grid', () => {
    const wall = mouthSwashWalls(design, COAST_BEACH_GRID);
    const g = COAST_BEACH_GRID;
    let n = 0;
    for (let j = 0; j < g.na; j += 1) for (let i = 0; i < g.ns; i += 1) n += wall[j * g.ns + i];
    const rows = Math.round((design.grid.na * design.grid.da) / g.da);
    expect(n).toBe(rows * g.ns);
    // The judged bank (a -24 to 30) is not walled.
    for (let j = 0; j < g.na; j += 1) {
      const a = g.a0 + (j + 0.5) * g.da;
      if (a < 30) expect(wall[j * g.ns + 10]).toBe(0);
    }
  });
});

describe('the wave laws', () => {
  it('gives the group speed its deep and shallow limits (linear theory)', () => {
    const w = 2;
    expect(groupSpeed(w, 2000)).toBeCloseTo(9.81 / (2 * w), 3);
    expect(groupSpeed(0.3, 0.2) / Math.sqrt(9.81 * 0.2)).toBeGreaterThan(0.99);
  });

  it('follows wave action on a current (Bretherton and Garrett 1968) and blocks at U = -cg', () => {
    expect(currentShare(0)).toBe(1);
    expect(currentShare(0.4)).toBeCloseTo(1 / Math.sqrt(0.6), 12);
    expect(currentShare(-1)).toBeCloseTo(1 / Math.sqrt(2), 12);
    expect(currentShare(1)).toBe(0);
    expect(currentShare(0.999)).toBeLessThan(0.01);
    // A band meeting a current of minus its own group speed is gone.
    const b = design.bands.find((x) => !x.forced)!;
    const cg = groupSpeed(b.omega, 2);
    expect(bandShareCpu(b, 2, b.dirX * -cg, b.dirZ * -cg, 0)).toBe(0);
  });

  it('holds the FFT to nothing where the river is alone (the bed over the mean sea level)', () => {
    expect(holdShareCpu(0.3, 0)).toBe(0);
    expect(holdShareCpu(-0.3, 0)).toBe(0);
    // Deep water keeps the whole wave.
    expect(holdShareCpu(1.0, 1000)).toBe(1);
    // A broken crest keeps H = 0.55 d.
    expect(holdShareCpu(1.0, 1.0) * 1.0).toBeCloseTo((0.55 * 1.0) / 1.8, 12);
  });

  it('hands the forced bands over to the grid and keeps the unforced ones', () => {
    const forced = design.bands.find((x) => x.forced)!;
    const free = design.bands.find((x) => !x.forced)!;
    expect(bandShareCpu(forced, 1000, 0, 0, 1)).toBe(0);
    expect(bandShareCpu(free, 1000, 0, 0, 1)).toBe(1);
  });
});

describe('the turbid water (Kirk 1994; Gordon et al. 1975; Maritorena et al. 1994)', () => {
  it('attenuates and reflects as its stated load sets', () => {
    const o = turbidOptics(40);
    // Mineral sediment absorbs blue most: blue's Kd is the largest, red's reflectance the largest.
    expect(o.kdRGB[2]).toBeGreaterThan(o.kdRGB[0]);
    expect(o.rInfRGB[0]).toBeGreaterThan(o.rInfRGB[2]);
    // Clear water: almost no reflectance, little attenuation in green.
    const c = turbidOptics(0);
    expect(c.rInfRGB[1]).toBeLessThan(0.01);
    expect(riverColumnTransCpu(o, 0)[0]).toBe(1);
    expect(riverColumnTransCpu(o, 0.3)[0]).toBeCloseTo(Math.exp(-2 * o.kdRGB[0] * 0.3), 12);
  });
});

describe('the plume (round 3: the friction-dominated jet, Ozsoy and Unluata 1982)', () => {
  const integrate = (x: number) => {
    let flux = 0;
    let mom = 0;
    const reach = 3 * (design.widthM / 2 + 0.2 * x);
    const dy = reach / 2e5;
    for (let y = -reach + dy / 2; y < reach; y += dy) {
      const j = jetAt(design, x, y);
      flux += j.deltaM * j.u * j.c * dy;
      mom += j.deltaM * j.u * j.u * dy;
    }
    return { flux, mom };
  };
  it('carries the discharge as its river water at the mouth and at every distance', () => {
    for (const x of [0, design.coreM / 2, design.coreM, 2 * design.coreM, 300]) {
      expect(integrate(x).flux / design.dischargeM3S).toBeCloseTo(1, 3);
    }
  });
  it('starts with the outflow momentum and loses it to the bed stress (round 3)', () => {
    const m0 = design.u0MS ** 2 * design.areaM2;
    expect(integrate(0).mom / m0).toBeCloseTo(1, 3);
    const j = design.jet;
    // Across the jet the momentum flux is the table's at every x; the table's falls.
    for (const x of [design.coreM / 2, design.coreM, 3 * design.coreM]) {
      let i = 0;
      while (i + 1 < j.n && j.xM[i + 1] <= x) i += 1;
      expect(integrate(j.xM[i]).mom / j.mM4S2[i]).toBeCloseTo(1, 2);
    }
    for (let i = 1; i < j.n; i += 1) expect(j.mM4S2[i]).toBeLessThanOrEqual(j.mM4S2[i - 1]);
    expect(jetAt(design, 0, 0).um).toBeCloseTo(design.u0MS, 9);
    expect(jetAt(design, 0, 0).c).toBeCloseTo(1, 6);
  });
});

describe('the envelope hold (round 1c: the horizontal displacement folds nothing)', () => {
  it('keeps the whole wave in deep water and none where the sea depth is 0', () => {
    expect(envelopeHoldCpu(2.4, 1000)).toBe(1);
    expect(envelopeHoldCpu(2.4, 0)).toBe(0);
  });
  it('keeps the broken wave at H = 0.55 d once the local height breaks in full (H / d over 0.75)', () => {
    const d = 2;
    expect(envelopeHoldCpu(2.4, d) * 2.4).toBeCloseTo(0.55 * d, 9);
  });
  it('falls with the depth and never rises along a shoaling profile', () => {
    let prev = 1;
    for (let d = 20; d >= 0; d -= 0.05) {
      const k = envelopeHoldCpu(2.4, d);
      expect(k).toBeLessThanOrEqual(prev + 1e-12);
      prev = k;
    }
  });
  it('gives each band of the coast its measured significant height (the hold reads them)', () => {
    for (const b of design.bands) {
      if (b.forced) expect(b.hsM).toBeGreaterThan(0.05);
      expect(Number.isFinite(b.hsM)).toBe(true);
    }
    // In quadrature the bands make the sea's own Hs within 15% (the cross terms of a short record).
    const sum = Math.sqrt(design.bands.reduce((a, b) => a + b.hsM * b.hsM, 0));
    expect(Math.abs(sum - design.hsM) / design.hsM).toBeLessThan(0.15);
  });
});

describe('the near field', () => {
  const sim = createMouthSim(design, cascades, OCEAN_FFT_N, seed);
  const clock = new MouthClock(sim);

  it('packs the river\'s own slope over wet cells only: no slope on a dry cell, none of a wet edge\'s jump (round 1c)', () => {
    const f = sim.field;
    clock.advanceTo(42);
    const pack = packMouthState(design, f, mouthHandoverLengthM(cascades));
    const c = pack.c as Uint16Array;
    // Round 2: four channels a cell (the slope, then the wind-locked band's local shares).
    expect(c.length).toBe(design.grid.ns * design.grid.na * 4);
    const half = (x: number) => {
      const s = (x & 0x8000) ? -1 : 1;
      const e = (x >> 10) & 0x1f;
      const m = x & 0x3ff;
      return e === 0 ? s * 2 ** -14 * (m / 1024) : s * 2 ** (e - 15) * (1 + m / 1024);
    };
    let wet = 0;
    let maxWet = 0;
    for (let k = 0; k < design.grid.ns * design.grid.na; k += 1) {
      const sx = half(c[k * 4]);
      const sz = half(c[k * 4 + 1]);
      if (f.h[k] <= 1e-3) {
        expect(Math.abs(sx)).toBe(0);
        expect(Math.abs(sz)).toBe(0);
      } else {
        wet += 1;
        maxWet = Math.max(maxWet, Math.hypot(sx, sz));
      }
    }
    expect(wet).toBeGreaterThan(1000);
    // Round 1's GPU difference across the swash's wet edge on the banks reached 0.9.
    // The water's own slope on the face stays near the face's (1:11) and the bores' fronts.
    expect(maxWet).toBeLessThan(0.6);
  }, 60000);

  it('closes its water ledger: river in = change on the grid + net out to the sea + out at the side edges, to 1e-9 of the volume', () => {
    const f = sim.field;
    f.restore(sim.start);
    const v0 = f.volume();
    const r0 = f.tracerVolume();
    clock.advanceTo(30, Infinity);
    const l = f.ledger;
    expect(l.clipped).toBe(0);
    const v1 = f.volume();
    // Round 2: the side edges on land are outflow edges (\`sideOut\`).
    // Round 5 (GG-394): the banks' sand takes its intake (\`soaked\`).
    const err = l.riverIn - ((v1 - v0) + (l.seaOut - l.seaIn) + l.sideOut + (l.soaked ?? 0));
    expect(Math.abs(err) / v1).toBeLessThan(1e-9);
    // And the river's own water: in at the head = change + out at the sea.
    const errR = l.riverIn - ((f.tracerVolume() - r0) + (l.tracerOut - l.tracerIn) + l.tracerSideOut + l.tracerClipped + (l.tracerSoaked ?? 0));
    expect(Math.abs(errR) / v1).toBeLessThan(1e-9);
  }, 120000);

  it('runs the river at its normal depth up the valley (Manning)', () => {
    const f = sim.field;
    f.restore(sim.start);
    const g = design.grid;
    const i = Math.floor((design.mouthS + 40 - g.s0) / g.ds);
    const c = (g.na / 2) * g.ns + i;
    expect(f.h[c]).toBeGreaterThan(channelNormalDepthM(design) * 0.85);
    expect(f.h[c]).toBeLessThan(channelNormalDepthM(design) * 1.15);
  });

  it('reproduces a pinned time from its fixed start', () => {
    clock.advanceTo(3.0);
    const a = sim.field.h.slice();
    clock.advanceTo(9.0);
    clock.advanceTo(3.0);
    expect(Array.from(sim.field.h)).toEqual(Array.from(a));
  }, 60000);

  it('reports the river alone where its bed stands over the mean sea level (sea depth 0)', () => {
    const f = sim.field;
    f.restore(sim.start);
    const pack = packMouthState(design, f, mouthHandoverLengthM(cascades));
    const g = design.grid;
    const half = (x: number) => {
      // Half float to number.
      const s = (x & 0x8000) ? -1 : 1;
      const e = (x >> 10) & 0x1f;
      const m = x & 0x3ff;
      return e === 0 ? s * 2 ** -14 * (m / 1024) : s * 2 ** (e - 15) * (1 + m / 1024);
    };
    let n = 0;
    for (let j = 0; j < g.na; j += 1) for (let i = 0; i < g.ns; i += 1) {
      const c = j * g.ns + i;
      if (f.h[c] > 0.01 && f.bed[c] > 0) { expect(half(pack.a[c * 4 + 1])).toBe(0); n += 1; }
    }
    expect(n).toBeGreaterThan(100);
  });

  it('draws one height across its sea edge: within 1 mm, and the normal within 0.5 degrees in the mean', () => {
    // THE COMPOSITION the surface draws (oceanSurface.ts, setRiver): the
    // forced bands' FFT height times (1 - hand-over), plus the hand-over times
    // the grid's surface. The FFT is the CPU sea at the same modes.
    const f = sim.field;
    clock.advanceTo(20);
    const g = design.grid;
    const blend = mouthHandoverLengthM(cascades);
    const rows: number[] = [];
    for (let j = 4; j < g.na - 4; j += 1) rows.push(j);
    const eps = 0.001;
    const dS = 0.05;
    const pts: [number, number][] = [];
    for (const j of rows) {
      const a = g.a0 + (j + 0.5) * g.da;
      for (const s of [g.s0 - dS, g.s0 - eps, g.s0 + eps, g.s0 + dS]) pts.push(beachToWorld(design.frame, s, a));
    }
    const sea = new IncidentWaves({
      cascades, n: OCEAN_FFT_N, seed, use: forcingCascades(cascades), share: 0.95, maxModes: 700,
      px: Float64Array.from(pts.map((p) => p[0])), pz: Float64Array.from(pts.map((p) => p[1])),
    });
    const fft = new Float64Array(pts.length);
    sea.heights(f.step * f.dt, fft);
    let jump = 0;
    let angle = 0;
    rows.forEach((j, k) => {
      const a = g.a0 + (j + 0.5) * g.da;
      const eta = f.bed[j * g.ns] + f.h[j * g.ns];
      const y = [g.s0 - dS, g.s0 - eps, g.s0 + eps, g.s0 + dS].map((s, q) => {
        const w = mouthHandoverAt(design, blend, s, a);
        return fft[k * 4 + q] * (1 - w) + w * eta;
      });
      jump = Math.max(jump, Math.abs(y[2] - y[1]));
      const sOut = (y[1] - y[0]) / (dS - eps);
      const sIn = (y[3] - y[2]) / (dS - eps);
      angle += Math.abs(Math.atan(sIn) - Math.atan(sOut)) * (180 / Math.PI);
    });
    expect(jump).toBeLessThan(0.001);
    expect(angle / rows.length).toBeLessThan(0.5);
  }, 60000);

  it('draws one color and one foam across its sea edge: the river share, column and foam change under 1% there', () => {
    // THE READER'S RULE (oceanMouth.ts, \`sample\` and \`foamSource\`), on the
    // CPU: inside the grid share and column are mix(jet, grid, w), the foam is
    // max(grid foam times w, jet front foam); past the grid edge the jet alone.
    // The lead (mouth round 1): the hand-over must hold in height, slope,
    // foam AND color. Height and slope are the test above.
    const f = sim.field;
    clock.advanceTo(30);
    const g = design.grid;
    const blend = mouthHandoverLengthM(cascades);
    const eps = 0.001;
    let dShare = 0;
    let dCol = 0;
    let dFoam = 0;
    let maxFoamIn = 0;
    for (let j = 4; j < g.na - 4; j += 1) {
      const a = g.a0 + (j + 0.5) * g.da;
      const c = j * g.ns;
      const h = f.h[c];
      const gShare = h > 1e-3 ? f.hc[c] / h : 0;
      const gCol = h > 1e-3 ? f.hc[c] : 0;
      const gFoam = f.foam[c];
      maxFoamIn = Math.max(maxFoamIn, gFoam);
      const drawn = (s: number) => {
        const w = mouthHandoverAt(design, blend, s, a);
        const jp = jetAt(design, design.mouthS - s, a - design.mouthA);
        const [x, z] = beachToWorld(design.frame, s, a);
        const depth = Math.max(seabedPointAt(design.params, x, z).depthM, 0);
        const k = jetTakeover(design, jp.um, depth);
        const jShare = jp.c * k;
        const jCol = Math.min(jp.deltaM, depth) * jp.c * k;
        const jFoam = jetFrontFoam(design, jp) * k;
        return { share: jShare * (1 - w) + gShare * w, col: jCol * (1 - w) + gCol * w, foam: Math.max(gFoam * w, jFoam) };
      };
      const o = drawn(g.s0 - eps);
      const i = drawn(g.s0 + eps);
      dShare = Math.max(dShare, Math.abs(i.share - o.share));
      dCol = Math.max(dCol, Math.abs(i.col - o.col));
      dFoam = Math.max(dFoam, Math.abs(i.foam - o.foam));
    }
    // The grid holds bores at its edge (foam to keep), and the drawn foam still meets the sea's.
    expect(maxFoamIn).toBeGreaterThan(0);
    expect(dShare).toBeLessThan(0.01);
    expect(dCol).toBeLessThan(0.01 * Math.max(design.depthM, 0.01));
    expect(dFoam).toBeLessThan(0.01);
  }, 60000);
});
