/**
 * @file oceanFoam.test.ts — the CPU half of the persistent foam, checked.
 *
 * The foam store lives on the GPU and vitest has none. What is proved here is
 * everything the GPU kernels mirror and everything that decides when they
 * run: the exact fixed-step decay, the breaker's trail and its direction, the
 * residual's bookkeeping, the toroidal clipmap, the stepping plan that makes
 * a pinned capture repeat, the lace's hash and its measured uniformity, and
 * the direction this pipeline's waves travel.
 */
import { describe, it, expect } from 'vitest';
import {
  foamBreakerLifeDecay,
  foamBreakerTurn,
  foamBreakerCurve,
  foamSegmentGain,
  foamSegmentNoise,
  FOAM_BREAKER_CURVE_RAD,
  FOAM_SEG_ACROSS_M,
  FOAM_SEG_ALONG_M,
  FOAM_SEG_DEPTH,
  FOAM_SEG_HI,
  FOAM_SEG_LO,
  FOAM_DEPOSIT_POW,
  foamLotteryNoise,
  FOAM_BREAKER_LIFE_VAR,
  FOAM_BREAKER_TAU_S,
  FOAM_BREAKER_TURN_RAD,
  foamDiffusionK,
  FOAM_DIFFUSION_M2S,
  FOAM_BREAKER_SPEED_FRACTION,
  FOAM_DEFICIT_HI,
  FOAM_DEFICIT_LO,
  FOAM_DRIFT_FRACTION,
  FOAM_DT_S,
  FOAM_FRAME_STEPS_MAX,
  FOAM_LACE_CDF_KNOTS,
  FOAM_LEVELS,
  FOAM_MAX,
  FOAM_PRODUCTION_PER_S,
  FOAM_TAU_S,
  FOAM_WARMUP_S,
  foamBreakerStep,
  foamBreakerVelocity,
  foamCellOf,
  foamCrestSpeedMs,
  foamDecayPerStep,
  foamDriftVelocity,
  foamGroupNoise,
  foamLaySource,
  foamLayStep,
  FOAM_LAY_TAU_S,
  FOAM_FOLD_LAY,
  FOAM_LAY_TEX,
  FOAM_SEED_TEX,
  FOAM_LAY_HI,
  FOAM_LAY_LO,
  foamFleckAlpha,
  foamFleckLevel,
  foamStreakCoverage,
  FOAM_FLECK_LEVELS,
  FOAM_FLECK_PX,
  FOAM_FLECK_WIDTH_M,
  FOAM_STREAK_MAX,
  foamInWindow,
  foamLaceAlpha,
  foamLaceCdfTable,
  foamLaceLayerMeans,
  foamLaceMeanAlpha,
  foamLaceRaw,
  foamLaceLayers,
  foamTileCurl,
  foamTileFiber,
  foamTileWisp,
  foamTileDot,
  foamTileWispFine,
  FOAM_DOT_DENSITY,
  FOAM_LACE_FRINGE,
  FOAM_LACE_YOUNG_FINE,
  FOAM_LACE_OLD_FINE,
  FOAM_LACE_WISP_FINE,
  FOAM_LACE_HAIR,
  FOAM_LACE_HAIR_FINE,
  FOAM_LACE_YOUNG_HAIR,
  FOAM_LACE_OLD_HAIR,
  FOAM_LACE_FRINGE_HAIR,
  foamTileHair,
  foamTileHairFine,
  foamAgeStep,
  FOAM_AGE_TAU_S,
  FOAM_AGE_B0,
  FOAM_AGE_B1,
  foamTearNoise,
  FOAM_TEAR_ALONG_M,
  FOAM_TEAR_ACROSS_M,
  FOAM_LACE_CURL,
  FOAM_LACE_WISP,
  FOAM_LACE_OLD,
  FOAM_LACE_OLD_ABOVE,
  FOAM_LACE_YOUNG,
  FOAM_LACE_YOUNG_ABOVE,
  FOAM_LACE,
  foamLaceUniform,
  foamPropagationDir,
  foamReferenceStep,
  foamResidualStep,
  foamSource,
  foamSteadyState,
  foamStep,
  foamSwellGain,
  foamSwellIndex,
  foamTexelOfCell,
  foamValueNoise,
  foamWindSea,
  foamWindowCenter,
  foamWindowFor,
  pcgHash01,
  planFoamStep,
  type FoamLevel,
} from '../oceanFoamMath';
import { GRAVITY_MS2 } from '../oceanConfig';
import { OCEAN_SEA_STATES } from '../oceanSeaStates';
import { jonswapPeakOmega } from '../oceanSpectrum';

const STORM = OCEAN_SEA_STATES.storm;
const WARMUP_STEPS = Math.round(FOAM_WARMUP_S / FOAM_DT_S);

describe('the fixed step', () => {
  it('decays exactly as the exponential it stands for', () => {
    // 120 steps of 1/30 s is 4 s, one fade time: F falls by e.
    let f = 1;
    for (let i = 0; i < 120; i += 1) f = foamStep(f, 0);
    expect(f).toBeCloseTo(Math.exp(-4 / FOAM_TAU_S), 12);
    expect(foamDecayPerStep()).toBeCloseTo(Math.exp(-FOAM_DT_S / FOAM_TAU_S), 15);
  });

  it('settles under a constant signal at P dt S / (1 - decay), under the cap', () => {
    const prod = 0.5 * FOAM_DT_S;
    let f = 0;
    // Twenty fade times: the start is forgotten to e^-20.
    for (let i = 0; i < Math.ceil((20 * FOAM_TAU_S) / FOAM_DT_S); i += 1) f = foamStep(f, 0.4, foamDecayPerStep(), prod);
    expect(f).toBeCloseTo(foamSteadyState(0.4, foamDecayPerStep(), prod), 6);
    // For small dt that is P tau S.
    expect(foamSteadyState(0.4, foamDecayPerStep(), prod)).toBeCloseTo(0.5 * FOAM_TAU_S * 0.4, 1);
    // A strong, lasting signal holds at the cap.
    let g = 0;
    for (let i = 0; i < 3000; i += 1) g = foamStep(g, 1, foamDecayPerStep(), 1);
    expect(g).toBe(FOAM_MAX);
  });

  it('keeps the stronger of the upstream breaker and the fold', () => {
    expect(foamBreakerStep(1, 0, 0.9)).toBeCloseTo(0.9, 12);
    expect(foamBreakerStep(0.2, 0.7, 0.9)).toBe(0.7);
  });

  it('moves what F loses into the residual, all of it at yield 1', () => {
    const decay = foamDecayPerStep();
    let f = 1;
    let r = 0;
    for (let i = 0; i < 10; i += 1) {
      const fNew = foamStep(f, 0);
      // With no decay of the residual itself, F + R is conserved.
      r = foamResidualStep(r, f, decay, 1, 1);
      f = fNew;
    }
    expect(f + r).toBeCloseTo(1, 12);
  });
});

describe('the breaking signal', () => {
  it('ramps from the deficit ramp and is 0 and 1 outside it', () => {
    expect(foamSource(FOAM_DEFICIT_LO - 0.01, 0)).toBe(0);
    expect(foamSource(FOAM_DEFICIT_HI + 0.01, 0)).toBe(1);
    const mid = foamSource((FOAM_DEFICIT_LO + FOAM_DEFICIT_HI) / 2, 0);
    expect(mid).toBeCloseTo(0.5, 12);
  });

  it('is raised on a swell crest, lowered in a trough, and never negative', () => {
    const d = (FOAM_DEFICIT_LO + FOAM_DEFICIT_HI) / 2;
    expect(foamSource(d, 0.05)).toBeGreaterThan(foamSource(d, 0));
    expect(foamSource(d, -0.05)).toBeLessThan(foamSource(d, 0));
    expect(foamSwellGain(-1)).toBe(0);
    expect(foamSwellGain(0)).toBe(1);
  });

  it('names the wind sea and the swell of the storm', () => {
    expect(foamWindSea(STORM).name).toBe('wind-sea');
    expect(STORM[foamSwellIndex(STORM) as number].name).toBe('swell');
    // Every cascade of waterpro but the distant swell drives foam.
    const wp = OCEAN_SEA_STATES.waterpro;
    expect(wp[foamSwellIndex(wp) as number].name).toBe('swell');
  });
});

describe('which way the sea runs', () => {
  it('runs toward -windDir, and the foam drifts and breaks that way', () => {
    const w = foamWindSea(STORM);
    const [px, pz] = foamPropagationDir(STORM);
    expect(px).toBeCloseTo(-Math.cos(w.windDirRad), 12);
    expect(pz).toBeCloseTo(-Math.sin(w.windDirRad), 12);
    const [dx, dz] = foamDriftVelocity(STORM);
    expect(Math.hypot(dx, dz)).toBeCloseTo(FOAM_DRIFT_FRACTION * w.windSpeedMs, 12);
    expect(dx * px + dz * pz).toBeGreaterThan(0);
    const cp = GRAVITY_MS2 / jonswapPeakOmega(w.windSpeedMs, w.fetchM);
    expect(foamCrestSpeedMs(STORM)).toBeCloseTo(cp, 12);
    const [bx, bz] = foamBreakerVelocity(STORM);
    expect(Math.hypot(bx, bz)).toBeCloseTo(FOAM_BREAKER_SPEED_FRACTION * cp, 12);
    expect(bx * px + bz * pz).toBeGreaterThan(0);
  });
});

describe('the toroidal clipmap', () => {
  const lv: FoamLevel = { n: 16, texelM: 0.5 };

  it('maps every cell to one texel of the window and back', () => {
    const win = foamWindowFor(lv, -3.2, 7.9);
    const seen = new Set<string>();
    for (let cell = 0; cell < lv.n * lv.n; cell += 1) {
      const [wx, wz] = foamTexelOfCell(lv, win, cell);
      expect(foamInWindow(lv, win, wx, wz)).toBe(true);
      expect(foamCellOf(lv, wx, wz)).toBe(cell);
      seen.add(`${wx},${wz}`);
    }
    expect(seen.size).toBe(lv.n * lv.n);
  });

  it('keeps the cell of a texel when the window moves over it', () => {
    const a = foamWindowFor(lv, 0, 0);
    const b = foamWindowFor(lv, 2.6, -1.1);
    for (let wz = b.oz; wz < b.oz + lv.n; wz += 1) {
      for (let wx = b.ox; wx < b.ox + lv.n; wx += 1) {
        if (!foamInWindow(lv, a, wx, wz)) continue;
        const cell = foamCellOf(lv, wx, wz);
        expect(foamTexelOfCell(lv, a, cell)).toEqual([wx, wz]);
        expect(foamTexelOfCell(lv, b, cell)).toEqual([wx, wz]);
      }
    }
  });

  it('puts the window where the view meets the water, within reach', () => {
    // Straight down: the camera's own ground point.
    expect(foamWindowCenter([4, 100, -2], [0, -1, 0])).toEqual([4, -2]);
    // 45 degrees down from 10 m, looking -Z: 10 m ahead.
    const c = foamWindowCenter([0, 10, 0], [0, -Math.SQRT1_2, -Math.SQRT1_2]);
    expect(c[0]).toBeCloseTo(0, 12);
    expect(c[1]).toBeCloseTo(-10, 12);
    // At the horizon the reach limit holds it: 70% of the fine half size.
    const reach = FOAM_LEVELS[0].n * FOAM_LEVELS[0].texelM * 0.5 * 0.7;
    expect(foamWindowCenter([0, 10, 0], [0, 0, -1])[1]).toBeCloseTo(-reach, 12);
  });
});

describe('the stepping plan', () => {
  it('warms up from rest before a pinned time, and replays nothing when nothing changed', () => {
    const p = planFoamStep(null, 42, true, false);
    expect(p.clear).toBe(true);
    expect(p.restepSea).toBe(true);
    // 42 s is exactly step 1260 at 1/30 s; floating point must not lose it.
    expect(p.firstStep + p.steps).toBe(1260);
    expect(p.steps).toBe(WARMUP_STEPS);
    const q = planFoamStep(1260, 42, true, false);
    expect(q.steps).toBe(0);
    expect(q.clear).toBe(false);
  });

  it('warms up again when a pinned view moves the window', () => {
    const p = planFoamStep(1260, 42, true, true);
    expect(p.clear).toBe(true);
    expect(p.steps).toBe(WARMUP_STEPS);
  });

  it('continues a live run, re-stepping the sea only on a catch-up', () => {
    const p = planFoamStep(1260, 42 + 2 * FOAM_DT_S, false, false);
    expect(p).toEqual({ clear: false, restepSea: false, firstStep: 1260, steps: 2 });
    const q = planFoamStep(1260, 42 + (FOAM_FRAME_STEPS_MAX + 3) * FOAM_DT_S, false, false);
    expect(q.restepSea).toBe(true);
  });

  it('starts a live run from rest after a jump back or a long gap, with no warm-up', () => {
    expect(planFoamStep(1260, 10, false, false)).toMatchObject({ clear: true, steps: 0 });
    expect(planFoamStep(1260, 42 + FOAM_WARMUP_S + 1, false, false)).toMatchObject({ clear: true, steps: 0 });
    expect(planFoamStep(null, 5, false, false)).toMatchObject({ clear: true, steps: 0 });
  });
});

describe('the kernel on the CPU', () => {
  const lv: FoamLevel = { n: 64, texelM: 0.25 };
  const win = foamWindowFor(lv, 0, 0);
  const cx = 0;
  const cz = 0;

  it('leaves a breaker trail behind the crest, the way the breaker moves', () => {
    // A fold that lives 0.3 s at one spot and starts a breaker there. No
    // spread here: this test is about the breaker's transport alone (the
    // spread has its own test below).
    const shift: [number, number] = [1, 0];
    let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
    let prev: typeof win | null = null;
    for (let s = 0; s < 40; s += 1) {
      const on = s < 9;
      st = foamReferenceStep(lv, st, win, prev, (x, z) => {
        const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
        return [hit, hit];
      }, shift, { diffusionM2S: 0 });
      prev = win;
    }
    // Foam lies downstream of the fold (+x, the breaker's way) and none
    // upstream of it.
    const fAt = (xm: number) => st[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(cz / lv.texelM))];
    expect(fAt(4)).toBeGreaterThan(0.05);
    expect(fAt(-3)).toBe(0);
    // Denser near the break than far along the trail.
    expect(fAt(0.5)).toBeGreaterThan(fAt(7));
    // The deposit power path (FOAM_DEPOSIT_POW, round 5; the shipped value
    // is 1 again since round 6): at power 2 the tail (where B has decayed)
    // is thinner against the head than at power 1, and at the head, where
    // B is 1, the two lay alike.
    expect(FOAM_DEPOSIT_POW).toBe(1);
    const runPow = (depositPow: number) => {
      let st1: Float64Array = new Float64Array(3 * lv.n * lv.n);
      prev = null;
      for (let s = 0; s < 40; s += 1) {
        const on = s < 9;
        st1 = foamReferenceStep(lv, st1, win, prev, (x, z) => {
          const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
          return [hit, hit];
        }, shift, { diffusionM2S: 0, depositPow });
        prev = win;
      }
      return (xm: number) => st1[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(cz / lv.texelM))];
    };
    const f1At = runPow(1);
    const f2At = runPow(2);
    expect(f2At(7) / f2At(0.5)).toBeLessThan(f1At(7) / f1At(0.5));
    expect(f2At(7)).toBeLessThan(f1At(7));
    // The shipped power lays what power 1 lays.
    expect(fAt(7)).toBe(f1At(7));
  });

  it('lays foam where the fold is, with no transport, at the lay share (FOAM_FOLD_LAY)', () => {
    // The lay ramp is softer than the breaker's: it starts under the
    // breaker's ramp and reaches 1 where the breaker's does or before.
    expect(FOAM_LAY_LO).toBeLessThan(FOAM_DEFICIT_LO);
    expect(FOAM_LAY_HI).toBeLessThanOrEqual(FOAM_DEFICIT_HI);
    expect(foamLaySource(FOAM_LAY_LO, 0)).toBe(0);
    expect(foamLaySource(FOAM_LAY_HI, 0)).toBe(1);
    expect(foamLaySource(0.5 * (FOAM_LAY_LO + FOAM_LAY_HI), 0)).toBeCloseTo(0.5, 12);
    // G is a per-point field (`foamLayStep`): under a fold of 1 for 15
    // steps it gains P dt share a step less its fade, then fades alone with
    // FOAM_LAY_TAU_S, faster than F. The shipped share lays nothing.
    const dLay = Math.exp(-FOAM_DT_S / FOAM_LAY_TAU_S);
    expect(FOAM_LAY_TAU_S).toBeLessThan(FOAM_TAU_S);
    let g = 0;
    for (let s = 0; s < 15; s += 1) g = foamLayStep(g, 1, dLay, FOAM_PRODUCTION_PER_S * FOAM_DT_S, 1);
    let expected = 0;
    for (let s = 0; s < 15; s += 1) expected = expected * dLay + FOAM_PRODUCTION_PER_S * FOAM_DT_S;
    expect(g).toBeCloseTo(expected, 12);
    expect(foamLayStep(g, 0, dLay)).toBeCloseTo(g * dLay, 12);
    expect(foamLayStep(0.5, 1, dLay, FOAM_PRODUCTION_PER_S * FOAM_DT_S, 0.5)).toBeCloseTo(0.5 * dLay + 0.5 * FOAM_PRODUCTION_PER_S * FOAM_DT_S, 12);
    expect(foamLayStep(0.5, 1)).toBeCloseTo(0.5 * dLay + FOAM_FOLD_LAY * FOAM_PRODUCTION_PER_S * FOAM_DT_S, 12);
    expect(foamLayStep(FOAM_MAX, 1, 1, 1, 1)).toBe(FOAM_MAX);
    // F takes none of the lay signal: a fold that starts no breaker lays
    // no F, whatever its lay signal.
    const shift: [number, number] = [1, 0];
    let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
    let prev: typeof win | null = null;
    for (let s = 0; s < 20; s += 1) {
      st = foamReferenceStep(lv, st, win, prev, (x, z) => {
        const hit = Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
        return [0, 0, hit];
      }, shift, { diffusionM2S: 0 });
      prev = win;
    }
    expect(st[3 * foamCellOf(lv, 0, 0)]).toBe(0);
  });

  it('lays a breaker trail only where the crest folds under it, at the texture share (FOAM_LAY_TEX)', () => {
    // A breaker started by a fold, running over water whose lay signal is
    // 1 on the first half of its run and 0 on the second: at layTex 1 the
    // trail ends where the lay signal ends, at 0 it runs the breaker's
    // whole life, and at 0.5 the far half is laid at half.
    const shift: [number, number] = [1, 0];
    const run = (layTex: number) => {
      let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
      let prev: typeof win | null = null;
      for (let s = 0; s < 40; s += 1) {
        const on = s < 9;
        st = foamReferenceStep(lv, st, win, prev, (x, z) => {
          const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
          return [hit, hit, x < 3 ? 1 : 0];
        }, shift, { diffusionM2S: 0, layTex });
        prev = win;
      }
      return (xm: number) => st[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(cz / lv.texelM))];
    };
    const f0 = run(0);
    const f1 = run(1);
    const fHalf = run(0.5);
    expect(f0(1.5)).toBeGreaterThan(0.05);
    expect(f1(1.5)).toBe(f0(1.5));
    expect(f0(6)).toBeGreaterThan(0.02);
    expect(f1(6)).toBe(0);
    expect(fHalf(6)).toBeCloseTo(f0(6) * 0.5, 12);
    // The shipped share lays what round 4 laid.
    expect(run(FOAM_LAY_TEX)(6)).toBeCloseTo(f0(6) * (1 - FOAM_LAY_TEX), 12);
  });

  it('seeds a breaker with the fold under it at the seed share (FOAM_SEED_TEX)', () => {
    // A fold with a lay signal of 0.4 under it: at seedTex 1 the breaker
    // starts at 0.4 of the gate and its whole trail is laid at 0.4; at 0
    // the gate seeds it whole; at 0.5 at 0.7.
    const shift: [number, number] = [1, 0];
    const run = (seedTex: number) => {
      let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
      let prev: typeof win | null = null;
      for (let s = 0; s < 40; s += 1) {
        const on = s < 9;
        st = foamReferenceStep(lv, st, win, prev, (x, z) => {
          const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
          return [hit, hit, 0.4 * hit];
        }, shift, { diffusionM2S: 0, seedTex });
        prev = win;
      }
      return (xm: number) => st[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(cz / lv.texelM))];
    };
    const f0 = run(0);
    const f1 = run(1);
    const fHalf = run(0.5);
    expect(f0(6)).toBeGreaterThan(0.02);
    expect(f1(6)).toBeCloseTo(f0(6) * 0.4, 12);
    expect(fHalf(6)).toBeCloseTo(f0(6) * 0.7, 12);
    expect(run(FOAM_SEED_TEX)(6)).toBeCloseTo(f0(6) * (1 - FOAM_SEED_TEX + FOAM_SEED_TEX * 0.4), 12);
    // A fourth source element is the seed's own signal, apart from the lay.
    let st4: Float64Array = new Float64Array(3 * lv.n * lv.n);
    let prev4: typeof win | null = null;
    for (let s = 0; s < 40; s += 1) {
      const on = s < 9;
      st4 = foamReferenceStep(lv, st4, win, prev4, (x, z) => {
        const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
        return [hit, hit, 0.4 * hit, 0.25 * hit];
      }, shift, { diffusionM2S: 0, seedTex: 1 });
      prev4 = win;
    }
    expect(st4[3 * foamCellOf(lv, Math.floor(6 / lv.texelM), 0)]).toBeCloseTo(f0(6) * 0.25, 12);
  });

  it('turns the trail of a breaker with its heading (FOAM_BREAKER_TURN_RAD)', () => {
    // The same fold as above, its breaker turned a quarter turn: the trail
    // runs along +z, not +x.
    const shift: [number, number] = [1, 0];
    let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
    let prev: typeof win | null = null;
    for (let s = 0; s < 30; s += 1) {
      const on = s < 9;
      st = foamReferenceStep(lv, st, win, prev, (x, z) => {
        const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
        return [hit, hit];
      }, shift, { diffusionM2S: 0, turn: () => Math.PI / 2 });
      prev = win;
    }
    const fAt = (xm: number, zm: number) => st[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(zm / lv.texelM))];
    expect(fAt(0, 4)).toBeGreaterThan(0.05);
    expect(fAt(4, 0)).toBe(0);
    // The field the GPU reads: bounded by the turn, and it varies.
    let lo = 0; let hi = 0;
    for (let k = 0; k < 400; k += 1) {
      const t = foamBreakerTurn(k * 7.3, k * 3.1);
      expect(Math.abs(t)).toBeLessThanOrEqual(FOAM_BREAKER_TURN_RAD + 1e-12);
      lo = Math.min(lo, t); hi = Math.max(hi, t);
    }
    expect(hi - lo).toBeGreaterThan(FOAM_BREAKER_TURN_RAD);
  });

  it('gives each breaker its own life (FOAM_BREAKER_LIFE_VAR): a lucky one runs farther', () => {
    // The decay at lottery noise 0 is the shipped one; at +1 the life is
    // doubled, at -1 halved; the noise the kernel reads stays in -1..1.
    const plain = Math.exp(-FOAM_DT_S / FOAM_BREAKER_TAU_S);
    expect(foamBreakerLifeDecay(0)).toBeCloseTo(plain, 15);
    expect(foamBreakerLifeDecay(1, 1)).toBeCloseTo(Math.exp(-FOAM_DT_S / (2 * FOAM_BREAKER_TAU_S)), 15);
    expect(foamBreakerLifeDecay(-1, 1)).toBeCloseTo(Math.exp(-FOAM_DT_S / (FOAM_BREAKER_TAU_S / 2)), 15);
    // The shipped spread (0) gives every breaker the plain decay.
    expect(foamBreakerLifeDecay(1)).toBeCloseTo(plain, 15);
    expect(foamBreakerLifeDecay(1, 0)).toBeCloseTo(plain, 15);
    // The shipped spread is 0 since round 6 (one life, round 4's); the
    // path is checked at a spread of 1 below.
    expect(FOAM_BREAKER_LIFE_VAR).toBe(0);
    let lo = 0; let hi = 0;
    for (let k = 0; k < 400; k += 1) {
      const n = foamLotteryNoise(k * 5.3, k * 2.7);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      lo = Math.min(lo, n); hi = Math.max(hi, n);
    }
    expect(hi - lo).toBeGreaterThan(1);
    // The same fold, one breaker long-lived and one short-lived: after 40
    // steps the long-lived one has laid foam farther along its run.
    const shift: [number, number] = [1, 0];
    const run = (life: number) => {
      let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
      let prev: typeof win | null = null;
      for (let s = 0; s < 40; s += 1) {
        const on = s < 9;
        st = foamReferenceStep(lv, st, win, prev, (x, z) => {
          const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
          return [hit, hit];
        }, shift, { diffusionM2S: 0, breakerDecayAt: () => foamBreakerLifeDecay(life, 1, 1.0) });
        prev = win;
      }
      return (xm: number) => st[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(cz / lv.texelM))];
    };
    const fLong = run(1);
    const fShort = run(-1);
    expect(fLong(6)).toBeGreaterThan(fShort(6) * 2);
    expect(fShort(0.5)).toBeGreaterThan(0);
  });

  it('breaks a crest in segments (FOAM_SEG_DEPTH): a chain of clumps, a bundle of streaks', () => {
    // The gate's factor: 1 over the high knot, 1 - depth under the low
    // one, between them a smoothstep; depth 0 is 1 everywhere. The
    // shipped depth is 0 (round 7: the view from above is carried by G,
    // and the segment alone moves the eye-level frame); the path is
    // checked at a depth of 0.8.
    expect(FOAM_SEG_DEPTH).toBe(0);
    expect(foamSegmentGain(FOAM_SEG_HI, 0.8)).toBe(1);
    expect(foamSegmentGain(1, 0.8)).toBe(1);
    expect(foamSegmentGain(FOAM_SEG_LO, 0.8)).toBeCloseTo(1 - 0.8, 12);
    expect(foamSegmentGain(-1, 0.8)).toBeCloseTo(1 - 0.8, 12);
    expect(foamSegmentGain(0.5 * (FOAM_SEG_LO + FOAM_SEG_HI), 0.8)).toBeCloseTo(1 - 0.5 * 0.8, 12);
    for (let k = -10; k <= 10; k += 1) expect(foamSegmentGain(k / 10)).toBe(1);
    // The field the kernel reads: in -1..1, and anisotropic, fine across
    // the wind and coarse along it: over a lag of one across-cell the
    // value has changed much more than over the same lag along.
    let lo = 0; let hi = 0;
    let dAlong = 0; let dAcross = 0;
    for (let k = 0; k < 400; k += 1) {
      const al = k * 13.7; const bl = k * 4.3;
      const n = foamSegmentNoise(al, bl);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      lo = Math.min(lo, n); hi = Math.max(hi, n);
      dAlong += Math.abs(foamSegmentNoise(al + FOAM_SEG_ACROSS_M, bl) - n);
      dAcross += Math.abs(foamSegmentNoise(al, bl + FOAM_SEG_ACROSS_M) - n);
    }
    expect(hi - lo).toBeGreaterThan(1);
    expect(FOAM_SEG_ALONG_M).toBeGreaterThan(FOAM_SEG_ACROSS_M * 4);
    expect(dAcross).toBeGreaterThan(dAlong * 3);
    // A crest line across z (a fold along x = 0 from z = -3 to 3), cut by
    // the segment factor to 0.2 on its z > 0 half: the trail behind the
    // uncut half is laid whole, the trail behind the cut half at a fifth
    // of the gate, and at depth 0 both halves lay alike (bit for bit
    // against a run with no factor).
    const shift: [number, number] = [1, 0];
    const run = (depth: number) => {
      let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
      let prev: typeof win | null = null;
      for (let s = 0; s < 40; s += 1) {
        const on = s < 9;
        st = foamReferenceStep(lv, st, win, prev, (x, z) => {
          const hit = on && Math.abs(x) < 0.6 && Math.abs(z) < 3 ? 1 : 0;
          const segK = foamSegmentGain(z > 0 ? -1 : 1, depth);
          // The gate argument (0.9 on the crest) times the factor, through
          // the shipped gate ramp: whole at 1, nothing at 0.2.
          const gate = hit * Math.min(Math.max((0.9 * segK - 0.5) / 0.15, 0), 1);
          return [hit, gate];
        }, shift, { diffusionM2S: 0 });
        prev = win;
      }
      return (xm: number, zm: number) => st[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(zm / lv.texelM))];
    };
    const fCut = run(0.8);
    const fNone = run(0);
    expect(fNone(5, -1.5)).toBeGreaterThan(0.05);
    expect(fNone(5, 1.5)).toBe(fNone(5, -1.5));
    expect(fCut(5, -1.5)).toBe(fNone(5, -1.5));
    expect(fCut(5, 1.5)).toBe(0);
    // The shipped depth lays what no factor lays, bit for bit.
    expect(run(FOAM_SEG_DEPTH)(5, 1.5)).toBe(fNone(5, 1.5));
  });

  it('bends a breaker\'s run with the curve field (FOAM_BREAKER_CURVE_RAD)', () => {
    // The curve is bounded by its amplitude and varies. The shipped
    // amplitude is 0 (round 7, with the crest segment); the path is
    // checked at 0.5 rad.
    expect(FOAM_BREAKER_CURVE_RAD).toBe(0);
    let lo = 0; let hi = 0;
    for (let k = 0; k < 400; k += 1) {
      const t = foamBreakerCurve(k * 7.3, k * 3.1, 0.5);
      expect(Math.abs(t)).toBeLessThanOrEqual(0.5 + 1e-12);
      lo = Math.min(lo, t); hi = Math.max(hi, t);
      expect(foamBreakerCurve(k * 7.3, k * 3.1)).toBeCloseTo(0, 15);
    }
    expect(hi - lo).toBeGreaterThan(0.5);
    // 0 times a negative noise value is -0; the kernel's branch skips it.
    expect(foamBreakerCurve(3, 4, 0)).toBeCloseTo(0, 15);
    // A run whose heading turns with x (the curve read in label space,
    // and smooth, as the kernel's field is: a step in the heading would
    // read its upstream B from where none is and stop the breaker): from
    // 0 at x = 1 m to 60 degrees at x = 5 m. The path's z is the integral
    // of tan(heading): 1.9 m at x = 4.5. The trail starts along +x and
    // ends off the axis, where the straight run's trail does not reach.
    const shift: [number, number] = [1, 0];
    const run = (turn: (wx: number, wz: number) => number) => {
      let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
      let prev: typeof win | null = null;
      for (let s = 0; s < 30; s += 1) {
        const on = s < 9;
        st = foamReferenceStep(lv, st, win, prev, (x, z) => {
          const hit = on && Math.hypot(x - cx, z - cz) < 0.6 ? 1 : 0;
          return [hit, hit];
        }, shift, { diffusionM2S: 0, turn });
        prev = win;
      }
      return (xm: number, zm: number) => st[3 * foamCellOf(lv, Math.floor(xm / lv.texelM), Math.floor(zm / lv.texelM))];
    };
    const straight = run(() => 0);
    const bent = run((wx) => Math.min(Math.max((wx * lv.texelM - 1) / 4, 0), 1) * (Math.PI / 3));
    expect(straight(5, 0)).toBeGreaterThan(0.05);
    expect(straight(4.5, 1.9)).toBe(0);
    expect(bent(1, 0)).toBeGreaterThan(0.05);
    expect(bent(4.5, 1.9)).toBeGreaterThan(0.02);
    // A trace of the bilinear reads reaches the axis (1e-5); no trail does.
    expect(bent(5, 0)).toBeLessThan(1e-3);
  });

  it('spreads foam without making or losing any (FOAM_DIFFUSION_M2S)', () => {
    // One line of foam across x = 0, no fade, no source, no breaker: after
    // 3 s the line is wider and holds the same total.
    const st0 = new Float64Array(3 * lv.n * lv.n);
    for (let z = win.oz; z < win.oz + lv.n; z += 1) st0[3 * foamCellOf(lv, 0, z)] = 1;
    const none = () => [0, 0] as [number, number];
    const k = { decay: 1, residualDecay: 1, residualYield: 0 };
    let st: Float64Array = st0;
    for (let s = 0; s < 90; s += 1) st = foamReferenceStep(lv, st, win, win, none, [0, 0], k);
    const row = (a: Float64Array) => Array.from({ length: lv.n }, (_, i) => a[3 * foamCellOf(lv, win.ox + i, 0)]);
    const sum = (r: number[]) => r.reduce((x, y) => x + y, 0);
    expect(sum(row(st))).toBeCloseTo(sum(row(st0)), 9);
    // The spread's width: sqrt(2 D t), with D the level's own rate (this
    // 0.25 m test level holds the weight at FOAM_DIFFUSION_K_MAX: 1.5 m).
    const r = row(st);
    const var2 = r.reduce((acc, v, i) => acc + v * ((win.ox + i) * lv.texelM) ** 2, 0) / sum(r);
    const dLevel = (foamDiffusionK(lv) * lv.texelM * lv.texelM) / FOAM_DT_S;
    expect(dLevel).toBeLessThanOrEqual(FOAM_DIFFUSION_M2S);
    expect(Math.sqrt(var2)).toBeCloseTo(Math.sqrt(2 * dLevel * 3), 1);
    // The shipped fine level spreads at the full rate.
    expect((foamDiffusionK(FOAM_LEVELS[0]) * 0.25) / FOAM_DT_S).toBeCloseTo(FOAM_DIFFUSION_M2S, 9);
    // With no spread the line stays one texel wide.
    let st2: Float64Array = st0;
    for (let s = 0; s < 90; s += 1) st2 = foamReferenceStep(lv, st2, win, win, none, [0, 0], { ...k, diffusionM2S: 0 });
    expect(row(st2).filter((v) => v > 0).length).toBe(1);
  });

  it('replays bit for bit from rest', () => {
    const run = () => {
      let st: Float64Array = new Float64Array(3 * lv.n * lv.n);
      let prev: typeof win | null = null;
      for (let s = 0; s < 25; s += 1) {
        st = foamReferenceStep(lv, st, win, prev, (x, z) => {
          const v = Math.max(0, Math.sin(x * 1.7 + s * 0.3) * Math.cos(z * 1.3));
          return [v, v * 0.5];
        }, [0.37, -0.12]);
        prev = win;
      }
      return st;
    };
    expect(run()).toEqual(run());
  });

  it('keeps the water that stays in a moved window and clears the water that enters', () => {
    const st0 = foamReferenceStep(lv, new Float64Array(3 * lv.n * lv.n), win, null, () => [1, 0], [0, 0]);
    const moved = { ox: win.ox + 10, oz: win.oz };
    const st1 = foamReferenceStep(lv, st0, moved, win, () => [0, 0], [0, 0]);
    const kept = foamCellOf(lv, win.ox + 20, win.oz + 5);
    const entered = foamCellOf(lv, win.ox + lv.n + 3, win.oz + 5);
    expect(st1[3 * kept]).toBeCloseTo(st0[3 * kept] * foamDecayPerStep(), 12);
    expect(st1[3 * entered]).toBe(0);
  });
});

describe('the lace', () => {
  it('mirrors TSL hash: u32 wrap, on [0, 1)', () => {
    for (let s = 0; s < 1000; s += 1) {
      const h = pcgHash01(s * 7919 - 500000);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    // Pinned values: a change to the CPU hash must be a deliberate one,
    // since the GPU's hash cannot change under it.
    expect(pcgHash01(0)).toBeCloseTo(0.0302, 4);
    expect(pcgHash01(1)).toBeCloseTo(0.65916, 4);
  });

  it('keeps its noise and cell layers in range', () => {
    for (let k = 0; k < 400; k += 1) {
      const x = (k * 0.731) % 57;
      const z = (k * 1.337) % 43;
      const v = foamValueNoise(x, z, 17);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(foamGroupNoise(x * 10, z * 10)).toBeLessThanOrEqual(1);
      const raw = foamLaceRaw(x, z);
      expect(raw).toBeGreaterThanOrEqual(0);
      expect(raw).toBeLessThanOrEqual(1);
    }
    const m = foamLaceLayerMeans(4096);
    for (const v of Object.values(m)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is uniform through its measured CDF, young and old, so the drawn area follows the coverage', () => {
    for (const wt of [FOAM_LACE_YOUNG, FOAM_LACE_OLD]) {
      expect(wt.cell1 + wt.fiber + wt.clump + wt.strand).toBeCloseTo(1, 12);
      const table = foamLaceCdfTable(16384, wt);
      expect(table.length).toBe(FOAM_LACE_CDF_KNOTS);
      expect(table[0]).toBe(0);
      expect(table[table.length - 1]).toBeGreaterThan(0.999);
      for (let i = 1; i < table.length; i += 1) expect(table[i]).toBeGreaterThanOrEqual(table[i - 1]);
      const bins = new Array(10).fill(0);
      const n = 8000;
      for (let k = 0; k < n; k += 1) {
        const u = foamLaceUniform(foamLaceRaw(pcgHash01(3 * k + 1) * 1800, pcgHash01(3 * k + 2) * 1800, wt), table);
        bins[Math.min(9, Math.floor(u * 10))] += 1;
      }
      for (const b of bins) expect(Math.abs(b / n - 0.1)).toBeLessThan(0.025);
    }
  });

  it('bakes the curls in range, in every direction, apart from the aligned fibers (FOAM_LACE_CURL)', () => {
    // In range, and not the aligned channel: different salts and shape.
    let differ = 0;
    let lo = 1; let hi = 0;
    for (let k = 0; k < 400; k += 1) {
      const s = pcgHash01(k * 3 + 1); const t = pcgHash01(k * 3 + 2);
      const c = foamTileCurl(s, t);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      lo = Math.min(lo, c); hi = Math.max(hi, c);
      if (Math.abs(c - foamTileFiber(s, t)) > 1e-6) differ += 1;
    }
    expect(lo).toBeLessThan(0.2);
    expect(hi).toBeGreaterThan(0.9);
    expect(differ).toBeGreaterThan(300);
    // The bend: a straight fiber of the curl shape and the bent one are
    // not the same channel; the aligned shape has no bend.
    expect(FOAM_LACE_CURL.fiberBend).toBeGreaterThan(0);
    expect(FOAM_LACE.fiberBend).toBe(0);
    expect(FOAM_LACE_CURL.fiberSpreadRad).toBeGreaterThan(FOAM_LACE.fiberSpreadRad * 3);
    // The curl lace is uniform through its own CDF, as the young lace is.
    const table = foamLaceCdfTable(16384, FOAM_LACE_YOUNG, FOAM_LACE, true);
    expect(table[0]).toBeLessThan(0.02);
    expect(table[FOAM_LACE_CDF_KNOTS - 1]).toBeCloseTo(1, 6);
    const side = 64;
    const hist = new Array(10).fill(0);
    for (let j = 0; j < side; j += 1) {
      for (let i = 0; i < side; i += 1) {
        const a = ((i + 0.5) / side) * 400 + 1000;
        const b = ((j + 0.5) / side) * 400 + 1000;
        const u = foamLaceUniform(foamLaceRaw(a, b, FOAM_LACE_YOUNG, FOAM_LACE, true), table);
        hist[Math.min(9, Math.floor(u * 10))] += 1;
      }
    }
    for (const h of hist) expect(h / (side * side)).toBeCloseTo(0.1, 1);
  });

  it('bakes the wisps in range, wider and longer than the curls, on the fibers\' tile period (FOAM_LACE_WISP)', () => {
    // The wisp lattice's period is the fiber lattice's, so both channels
    // share one tile coordinate and one fetch.
    expect(FOAM_LACE_WISP.fiberCellM * FOAM_LACE_WISP.fiberCount).toBe(FOAM_LACE.fiberCellM * FOAM_LACE.fiberCount);
    // A wisp is wider and longer than a curl, in meters, and bent.
    expect(FOAM_LACE_WISP.fiberHalfWCells * FOAM_LACE_WISP.fiberCellM).toBeGreaterThan(2 * FOAM_LACE_CURL.fiberHalfWCells * FOAM_LACE_CURL.fiberCellM);
    expect(FOAM_LACE_WISP.fiberLenLoCells * FOAM_LACE_WISP.fiberCellM).toBeGreaterThan(FOAM_LACE_CURL.fiberLenHiCells * FOAM_LACE_CURL.fiberCellM);
    expect(FOAM_LACE_WISP.fiberBend).toBeGreaterThan(0);
    // In range, and not the curl channel.
    let differ = 0;
    let lo = 1; let hi = 0;
    for (let k = 0; k < 400; k += 1) {
      const s = pcgHash01(k * 3 + 1); const t = pcgHash01(k * 3 + 2);
      const w = foamTileWisp(s, t);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      lo = Math.min(lo, w); hi = Math.max(hi, w);
      if (Math.abs(w - foamTileCurl(s, t)) > 1e-6) differ += 1;
    }
    expect(lo).toBeLessThan(0.2);
    expect(hi).toBeGreaterThan(0.9);
    expect(differ).toBeGreaterThan(300);
    // The from-above weights sum to 1 and carry the wisps; the layers
    // carry a wisp only when asked, and the mix counts it only then.
    const sum = (w: typeof FOAM_LACE_YOUNG_ABOVE) => w.cell1 + w.fiber + w.clump + w.strand + (w.wisp ?? 0);
    expect(sum(FOAM_LACE_YOUNG_ABOVE)).toBeCloseTo(1, 12);
    expect(sum(FOAM_LACE_OLD_ABOVE)).toBeCloseTo(1, 12);
    expect(FOAM_LACE_YOUNG_ABOVE.wisp).toBeGreaterThan(0);
    expect(FOAM_LACE_OLD_ABOVE.wisp).toBeGreaterThan(FOAM_LACE_YOUNG_ABOVE.wisp ?? 0);
    expect(foamLaceLayers(12.3, 45.6, FOAM_LACE, true).wisp).toBeUndefined();
    expect(foamLaceLayers(12.3, 45.6, FOAM_LACE, true, true).wisp).toBeDefined();
    expect(foamLaceRaw(12.3, 45.6, FOAM_LACE_YOUNG, FOAM_LACE, true, true)).toBe(foamLaceRaw(12.3, 45.6, FOAM_LACE_YOUNG, FOAM_LACE, true));
    // The from-above laces are uniform through their own CDFs.
    for (const weights of [FOAM_LACE_YOUNG_ABOVE, FOAM_LACE_OLD_ABOVE]) {
      const table = foamLaceCdfTable(16384, weights, FOAM_LACE, true, true);
      expect(table[0]).toBeLessThan(0.02);
      expect(table[FOAM_LACE_CDF_KNOTS - 1]).toBeCloseTo(1, 6);
      const side = 64;
      const hist = new Array(10).fill(0);
      for (let j = 0; j < side; j += 1) {
        for (let i = 0; i < side; i += 1) {
          const a = ((i + 0.5) / side) * 400 + 1000;
          const b = ((j + 0.5) / side) * 400 + 1000;
          const u = foamLaceUniform(foamLaceRaw(a, b, weights, FOAM_LACE, true, true), table);
          hist[Math.min(9, Math.floor(u * 10))] += 1;
        }
      }
      for (const h of hist) expect(h / (side * side)).toBeCloseTo(0.1, 1);
    }
  });

  it('bakes the bubbles as sparse round bits whose count follows the coverage (foamTileDot, FOAM_LACE_FRINGE)', () => {
    // In range; 0 only near a point and 1 clear of every point, so most
    // of the tile is 1 (the points are sparse) and a small share is low.
    const side = 128;
    let lo = 1; let hi = 0; let low = 0; let one = 0;
    for (let j = 0; j < side; j += 1) {
      for (let i = 0; i < side; i += 1) {
        // A 16 m square of the 64 m tile, sampled finer than a dot cell.
        const d = foamTileDot((i + 0.5) / side / 4, (j + 0.5) / side / 4);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(1);
        lo = Math.min(lo, d); hi = Math.max(hi, d);
        if (d < 0.3) low += 1;
        if (d >= 1) one += 1;
      }
    }
    expect(lo).toBeLessThan(0.1);
    expect(hi).toBe(1);
    const n = side * side;
    // The share under 0.3 is the discs of radius 0.3 x 0.7 cells around
    // the points, about density x pi x 0.21^2 of the area: a few percent.
    expect(low / n).toBeGreaterThan(0.01);
    expect(low / n).toBeLessThan(FOAM_DOT_DENSITY * Math.PI * 0.21 ** 2 * 1.5);
    expect(one / n).toBeGreaterThan(0.3);
    // The fringe weights sum to 1 and lead with the bubbles; the layers
    // carry a dot only when asked, and the mix counts it only then. The
    // fine regime's tables (round 8) sum to 1, lead with the wisps and
    // carry little net.
    const w = FOAM_LACE_FRINGE;
    expect(w.cell1 + w.fiber + w.clump + w.strand + (w.wisp ?? 0) + (w.dot ?? 0) + (w.wispFine ?? 0)).toBeCloseTo(1, 12);
    expect(w.dot).toBeGreaterThan(w.cell1);
    for (const f of [FOAM_LACE_YOUNG_FINE, FOAM_LACE_OLD_FINE]) {
      expect(f.cell1 + f.fiber + f.clump + f.strand + (f.wisp ?? 0) + (f.dot ?? 0) + (f.wispFine ?? 0)).toBeCloseTo(1, 12);
      expect(f.wispFine ?? 0).toBeGreaterThan(0.4);
      expect(f.cell1).toBeLessThanOrEqual(0.1);
      const tf = foamLaceCdfTable(16384, f, FOAM_LACE, true, true, true);
      expect(tf[0]).toBeLessThan(0.02);
      expect(tf[FOAM_LACE_CDF_KNOTS - 1]).toBeCloseTo(1, 6);
    }
    // The fine regime's own wisp (round 8): a wider spread and a deeper
    // bend than round 7's, on its own salts, so it is a different channel
    // and round 7's tables are untouched; in range.
    expect(FOAM_LACE_WISP_FINE.fiberSpreadRad).toBeGreaterThan(FOAM_LACE_WISP.fiberSpreadRad);
    expect(FOAM_LACE_WISP_FINE.fiberBend).toBeGreaterThan(FOAM_LACE_WISP.fiberBend);
    let differF = 0;
    for (let k = 0; k < 400; k += 1) {
      const s = pcgHash01(k * 3 + 1); const t = pcgHash01(k * 3 + 2);
      const v = foamTileWispFine(s, t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (Math.abs(v - foamTileWisp(s, t)) > 1e-6) differF += 1;
    }
    // Both channels are 1 clear of every wisp, a quarter of the tile.
    expect(differF).toBeGreaterThan(200);
    expect(foamLaceLayers(12.3, 45.6, FOAM_LACE, true, true, true).wispFine).toBeDefined();
    expect(foamLaceLayers(12.3, 45.6, FOAM_LACE, true, true).wispFine).toBeUndefined();
    expect(foamLaceLayers(12.3, 45.6, FOAM_LACE, true, true).dot).toBeUndefined();
    expect(foamLaceLayers(12.3, 45.6, FOAM_LACE, true, true, true).dot).toBeDefined();
    expect(foamLaceRaw(12.3, 45.6, FOAM_LACE_YOUNG, FOAM_LACE, true, true, true)).toBe(foamLaceRaw(12.3, 45.6, FOAM_LACE_YOUNG, FOAM_LACE, true, true));
    // The fringe lace is uniform through its own CDF, so its drawn area
    // follows the coverage and a fading edge draws the bits nearest the
    // points first.
    const table = foamLaceCdfTable(16384, w, FOAM_LACE, true, true, true);
    expect(table[0]).toBeLessThan(0.02);
    expect(table[FOAM_LACE_CDF_KNOTS - 1]).toBeCloseTo(1, 6);
    const hist = new Array(10).fill(0);
    const s2 = 64;
    for (let j = 0; j < s2; j += 1) {
      for (let i = 0; i < s2; i += 1) {
        const a = ((i + 0.5) / s2) * 400 + 1000;
        const b = ((j + 0.5) / s2) * 400 + 1000;
        const u = foamLaceUniform(foamLaceRaw(a, b, w, FOAM_LACE, true, true, true), table);
        hist[Math.min(9, Math.floor(u * 10))] += 1;
      }
    }
    for (const h of hist) expect(h / (s2 * s2)).toBeCloseTo(0.1, 1);
  });

  it('bakes the hair with a floor per fiber, so the count of filaments follows the threshold (FOAM_LACE_HAIR, round 9)', () => {
    // A depth and a floor of 0 leave the fiber generator bit for bit: the
    // older channels compile the same code and bake the same tile.
    for (let k = 0; k < 200; k += 1) {
      const s = pcgHash01(k * 5 + 1); const t = pcgHash01(k * 5 + 2);
      expect(foamTileFiber(s, t, { ...FOAM_LACE, fiberDepth: 0, fiberFloor: 0 })).toBe(foamTileFiber(s, t));
    }
    // In range, and the fine hair never under its floor unless clear (1).
    const side = 96;
    const share = (f: (s: number, t: number) => number, thr: number) => {
      let n = 0;
      for (let j = 0; j < side; j += 1) {
        for (let i = 0; i < side; i += 1) {
          // A 16 m square of the 64 m tile, sampled at 0.17 m.
          const v = f((i + 0.5) / side / 4 + 0.5, (j + 0.5) / side / 4 + 0.25);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
          if (v < thr) n += 1;
        }
      }
      return n / (side * side);
    };
    expect(share(foamTileHairFine, FOAM_LACE_HAIR_FINE.fiberFloor ?? 0)).toBe(0);
    // The drawn share rises with the threshold, and at a low threshold
    // only the long hairs exist (the fuzz is floored above it), so a
    // fringe frays into long single hairs before the fuzz fills in.
    const h1 = share(foamTileHair, 0.15); const h2 = share(foamTileHair, 0.4); const h3 = share(foamTileHair, 0.7);
    expect(h1).toBeGreaterThan(0.005);
    expect(h2).toBeGreaterThan(h1 * 1.5);
    expect(h3).toBeGreaterThan(h2 * 1.2);
    expect(share(foamTileHairFine, 0.25)).toBe(0);
    expect(share(foamTileHairFine, 0.7)).toBeGreaterThan(0.05);
    // Two channels apart, the long hairs longer, thicker and straighter
    // than the fuzz, both within the fibers' tile period.
    expect(FOAM_LACE_HAIR.fiberCellM * FOAM_LACE_HAIR.fiberCount).toBe(FOAM_LACE.fiberCellM * FOAM_LACE.fiberCount);
    expect(FOAM_LACE_HAIR.fiberLenHiCells * FOAM_LACE_HAIR.fiberCellM).toBeGreaterThan(FOAM_LACE_HAIR_FINE.fiberLenHiCells * FOAM_LACE_HAIR_FINE.fiberCellM);
    expect(FOAM_LACE_HAIR.fiberSpreadRad).toBeLessThan(FOAM_LACE_HAIR_FINE.fiberSpreadRad);
    // The layers carry the hair (the min of both) only when asked, and the
    // mix counts it only for a weight that has it.
    const l = foamLaceLayers(12.3, 45.6, FOAM_LACE, true, true, true, true);
    expect(l.hair).toBeDefined();
    expect(foamLaceLayers(12.3, 45.6, FOAM_LACE, true, true, true).hair).toBeUndefined();
    expect(foamLaceRaw(12.3, 45.6, FOAM_LACE_YOUNG_FINE, FOAM_LACE, true, true, true, true)).toBe(foamLaceRaw(12.3, 45.6, FOAM_LACE_YOUNG_FINE, FOAM_LACE, true, true, true));
    // The hair tables sum to 1, lead with the hair, and are uniform through
    // their own CDF, so the drawn area follows the coverage.
    for (const w of [FOAM_LACE_YOUNG_HAIR, FOAM_LACE_OLD_HAIR, FOAM_LACE_FRINGE_HAIR]) {
      expect(w.cell1 + w.fiber + w.clump + w.strand + (w.wisp ?? 0) + (w.dot ?? 0) + (w.wispFine ?? 0) + (w.hair ?? 0)).toBeCloseTo(1, 12);
      expect(w.hair ?? 0).toBeGreaterThanOrEqual(0.65);
      const table = foamLaceCdfTable(16384, w, FOAM_LACE, true, true, true, true);
      expect(table[0]).toBeLessThan(0.02);
      expect(table[FOAM_LACE_CDF_KNOTS - 1]).toBeCloseTo(1, 6);
      const hist = new Array(10).fill(0);
      const s2 = 48;
      for (let j = 0; j < s2; j += 1) {
        for (let i = 0; i < s2; i += 1) {
          const a = ((i + 0.5) / s2) * 400 + 1000;
          const b = ((j + 0.5) / s2) * 400 + 1000;
          const u = foamLaceUniform(foamLaceRaw(a, b, w, FOAM_LACE, true, true, true, true), table);
          hist[Math.min(9, Math.floor(u * 10))] += 1;
        }
      }
      for (const h of hist) expect(h / (s2 * s2)).toBeCloseTo(0.1, 1);
    }
  });

  it('keeps its strands long along the wind and narrow across it', () => {
    // The strand channel's autocorrelation falls to a half within a much
    // longer lag along the wind than across it.
    const corrAt = (da: number, db: number) => {
      let m = 0; let v = 0; let c = 0; const n = 3000; const vals: number[] = []; const shifted: number[] = [];
      for (let k = 0; k < n; k += 1) {
        const a = pcgHash01(2 * k + 5) * 700; const b = pcgHash01(2 * k + 6) * 700;
        vals.push(foamLaceLayers(a, b).strand); shifted.push(foamLaceLayers(a + da, b + db).strand);
      }
      for (const x of vals) m += x; m /= n;
      for (let k = 0; k < n; k += 1) { v += (vals[k] - m) ** 2; c += (vals[k] - m) * (shifted[k] - m); }
      return c / v;
    };
    // Measured (the long fibers of round 4): a half at about 2.3 m along the
    // wind and 0.19 m across it.
    expect(corrAt(1.5, 0)).toBeGreaterThan(0.5);
    expect(corrAt(0, 0.3)).toBeLessThan(0.5);
  });

  it('draws nothing at no coverage, everything at full, and its mean rises with coverage', () => {
    for (const tex of [0, 0.2, 0.5, 0.9, 1]) {
      expect(foamLaceAlpha(0, tex, 0.12)).toBe(0);
      expect(foamLaceAlpha(1, tex, 0.12)).toBe(1);
    }
    let last = -1;
    for (let c = 0; c <= 1.0001; c += 0.05) {
      const m = foamLaceMeanAlpha(c, 0.12);
      expect(m).toBeGreaterThanOrEqual(last);
      last = m;
      // The closed form against the mean over a uniform texture.
      let mc = 0;
      for (let k = 0; k < 2000; k += 1) mc += foamLaceAlpha(c, (k + 0.5) / 2000, 0.12);
      expect(m).toBeCloseTo(mc / 2000, 3);
    }
    expect(foamLaceMeanAlpha(0.5, 0.12)).toBeCloseTo(0.5, 12);
    // The mean stays near the coverage, so a pixel too coarse for the lace
    // (which shows the mean) draws about as much foam as the lace would.
    for (const c of [0.1, 0.3, 0.7, 0.9]) expect(Math.abs(foamLaceMeanAlpha(c, 0.12) - c)).toBeLessThan(0.1);
  });
});

describe('the streaks and the flecks', () => {
  it('lays streaks only from force 7 up, most at force 9', () => {
    expect(foamStreakCoverage(11.5)).toBe(0);
    expect(foamStreakCoverage(13.9)).toBe(0);
    expect(foamStreakCoverage(20)).toBeGreaterThan(0.4 * FOAM_STREAK_MAX);
    expect(foamStreakCoverage(24.4)).toBeCloseTo(FOAM_STREAK_MAX, 12);
    expect(foamStreakCoverage(30)).toBeCloseTo(FOAM_STREAK_MAX, 12);
  });

  it('draws the size class whose strokes are FOAM_FLECK_PX pixels wide', () => {
    const px = FOAM_FLECK_WIDTH_M / FOAM_FLECK_PX;
    expect(foamFleckLevel(px)).toBeCloseTo(0, 12);
    expect(foamFleckLevel(px * 4)).toBeCloseTo(2, 12);
    expect(FOAM_FLECK_LEVELS).toBeGreaterThan(2);
  });

  it('draws no fleck at no coverage, and more of the water as coverage rises', () => {
    const area = (c: number, level: number) => {
      let a = 0;
      const n = 120;
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) a += foamFleckAlpha(i * 0.05 * 2 ** level, j * 0.05 * 2 ** level, c, 0.02 * 2 ** level, level);
      }
      return a / (n * n);
    };
    expect(area(0, 0)).toBe(0);
    const lo = area(0.1, 0);
    const hi = area(0.6, 0);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(2 * lo);
    // A class twice as coarse covers about the same share of the water: the
    // strokes scale with the cell, so the look holds as the view zooms.
    const lo1 = area(0.1, 1);
    expect(lo1 / lo).toBeGreaterThan(0.5);
    expect(lo1 / lo).toBeLessThan(2);
  });
});

describe('the age clock and the windrow tear (round 9)', () => {
  it('decays exactly as the exponential it stands for, and a breaker sets it', () => {
    // 120 steps of 1/30 s is 4 s, one fade time: A falls by e.
    let a = 1;
    for (let i = 0; i < 120; i += 1) a = foamAgeStep(a, 0);
    expect(a).toBeCloseTo(Math.exp(-4 / FOAM_AGE_TAU_S), 12);
    // A breaker at or over B1 sets 1 whatever A held; its bilinear rim
    // under B0 sets nothing.
    expect(foamAgeStep(0.2, FOAM_AGE_B1)).toBe(1);
    expect(foamAgeStep(0.2, 1)).toBe(1);
    expect(foamAgeStep(0.2, FOAM_AGE_B0)).toBeCloseTo(0.2 * Math.exp(-FOAM_DT_S / FOAM_AGE_TAU_S), 12);
    expect(foamAgeStep(0, 0.02)).toBe(0);
    // A is the larger of the two, never less than the decayed value.
    expect(foamAgeStep(0.9, 0.2)).toBeGreaterThan(0.89);
  });

  it('clocks a trail: the point the breaker passed last is the freshest', () => {
    // A breaker of strength 1 passes three points 1, 3 and 6 s before now.
    const ageAt = (secondsAgo: number) => {
      let a = 0;
      const steps = Math.round(secondsAgo / FOAM_DT_S);
      a = foamAgeStep(a, 1);
      for (let i = 0; i < steps; i += 1) a = foamAgeStep(a, 0);
      return a;
    };
    const a1 = ageAt(1); const a3 = ageAt(3); const a6 = ageAt(6);
    expect(a1).toBeGreaterThan(a3);
    expect(a3).toBeGreaterThan(a6);
    expect(a1).toBeCloseTo(Math.exp(-1 / FOAM_AGE_TAU_S), 10);
    // Where F cannot: F laid at the same rate over a breaker's run is one
    // density along it (the store's cap holds it), A is 0.29 at the birth
    // end of a 5 s run against 1 at the head.
    expect(ageAt(5)).toBeCloseTo(Math.exp(-5 / FOAM_AGE_TAU_S), 10);
    expect(ageAt(5)).toBeLessThan(0.3);
  });

  it('tears along the wind: the tear noise holds far along it and changes across it', () => {
    const corrAt = (da: number, db: number) => {
      let m = 0; let v = 0; let c = 0; const n = 3000; const vals: number[] = []; const shifted: number[] = [];
      for (let k = 0; k < n; k += 1) {
        const a = pcgHash01(2 * k + 5) * 700; const b = pcgHash01(2 * k + 6) * 700;
        const x = foamTearNoise(a, b); const y = foamTearNoise(a + da, b + db);
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(x).toBeLessThanOrEqual(1);
        vals.push(x); shifted.push(y);
      }
      for (const x of vals) m += x; m /= n;
      for (let k = 0; k < n; k += 1) { v += (vals[k] - m) ** 2; c += (vals[k] - m) * (shifted[k] - m); }
      return c / v;
    };
    expect(FOAM_TEAR_ALONG_M).toBeGreaterThan(4 * FOAM_TEAR_ACROSS_M);
    // A third of a cell along the wind is still the same streak; one cell
    // across it is the next streak or the gap between.
    expect(corrAt(FOAM_TEAR_ALONG_M / 3, 0)).toBeGreaterThan(0.5);
    expect(corrAt(0, FOAM_TEAR_ACROSS_M)).toBeLessThan(0.3);
  });
});
