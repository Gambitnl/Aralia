/**
 * @file The original surface read of lasting foam: coverage, lace and light.
 * Reads the same field/texture/uniform references after the factory has allocated them.
 * The factory retains all compute, baking, stepping and disposal ownership.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 04:08:32
 * Dependents: systems/world3d/ocean/oceanFoam.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { float, texture, vec2, min, smoothstep, floor, int, bitAnd, mix, max, If, sqrt, select, dFdx, dFdy, clamp, vec3 } from 'three/tsl';
import { FOAM_LEVELS, FOAM_WINDROW_SPACING_M, FOAM_WINDROW_STRETCH, FOAM_SALT_WINDROW, FOAM_WINDROW_DEPTH, FOAM_TEAR_ALONG_M, FOAM_TEAR_ACROSS_M, FOAM_TEAR_SALT, FOAM_LACE, FOAM_LACE_WISP, FOAM_DOT_RADIUS, FOAM_DOT_COUNT, FOAM_LACE_HAIR, FOAM_CELLS_ALONG_M, FOAM_CELLS_S_COUNT, FOAM_CELLS_ACROSS_M, FOAM_CELLS_L_COUNT, FOAM_LACE_STREAK, FOAM_LACE_YOUNG, FOAM_LACE_OLD, FOAM_LACE_YOUNG_ABOVE, FOAM_LACE_OLD_ABOVE, FOAM_LACE_YOUNG_FINE, FOAM_LACE_OLD_FINE, FOAM_LACE_YOUNG_HAIR, FOAM_LACE_OLD_HAIR, FOAM_LACE_YOUNG_CELLS, FOAM_LACE_OLD_CELLS, FOAM_LACE_FRINGE, FOAM_LACE_FRINGE_HAIR, FOAM_LACE_FRINGE_CELLS } from './oceanFoamMath';
import { oceanSkyDeckLight } from './oceanSky';
import type * as THREE from 'three/webgpu';
import type { OceanField } from './oceanField';
import type { OceanSampler } from './oceanSampler';
import type { FoamLevel, FoamLaceLayers } from './oceanFoamMath';
import type { createFoamControls } from './oceanFoamControls';
import type { TslNode, OceanFoamReader } from './oceanFoamReaderTypes';

// Only the display fields are required; the factory keeps the complete mutable level state.
interface FoamDisplayLevel { readonly level: FoamLevel; readonly ro: TslNode; readonly uOrigin: TslNode; readonly dispTex: THREE.StorageTexture; readonly dispTex2: THREE.StorageTexture; }
type LevelGpu = FoamDisplayLevel;
interface FoamReaderContext {
  uDrift: TslNode;
  uReadT: TslNode;
  levels: readonly FoamDisplayLevel[];
  tune: ReturnType<typeof createFoamControls>;
  wA: TslNode;
  wB: TslNode;
  valueNoise: TslNode;
  samplerR: OceanSampler;
  windIdx: number;
  windSea: OceanField['cascades'][number];
  swellIdx: number | null;
  cascades: OceanField['cascades'];
  hsM: number;
  bufs: OceanField['buffers'];
  uAbove: TslNode;
  streakLevel: number;
  laceLayers: TslNode;
  mixLace: TslNode;
  cdfRead: TslNode;
  layerMeans: FoamLaceLayers;
  laceTile: THREE.StorageTexture;
  deckRO: TslNode;
  uOvercast: TslNode;
  uSun: TslNode;
  FOAM_WARP_SALT: number;
  SURFACE_FOAM_NO_SUN: number;
  deckIsSet: (dl: { airGain: TslNode }) => boolean;
}

export function createFoamReader(context: FoamReaderContext): OceanFoamReader {
  const { uDrift, uReadT, levels, tune, wA, wB, valueNoise, samplerR, windIdx, windSea, swellIdx, cascades, hsM, bufs, uAbove, streakLevel, laceLayers, mixLace, cdfRead, layerMeans, laceTile, deckRO, uOvercast, uSun, FOAM_WARP_SALT, SURFACE_FOAM_NO_SUN, deckIsSet } = context;

  /* --- the read -------------------------------------------------------- */

  /** Bilinear read of one level at a foam-frame point, and its window weight. */
  /**
   * The display texture of a level at a foam-frame point: (F, R, gain,
   * wind-sea fold) filtered, and the window weight `w`. Sampled at level 0:
   * the texture has no mips, and the read fades the fine level out before
   * its texels are much finer than the pixel.
   */
  const sampleDisplay = (lv: LevelGpu, y: TslNode): { t: TslNode; uv: TslNode; w: TslNode } => {
    const n = lv.level.n;
    const q = y.div(float(lv.level.texelM));
    const uv = q.div(float(n)).toVar();
    const t = texture(lv.dispTex, uv).level(float(0));
    const lo = q.sub(float(0.5)).sub(vec2(lv.uOrigin.x, lv.uOrigin.y));
    const edge = min(min(lo.x, lo.y), min(float(n - 2).sub(lo.x), float(n - 2).sub(lo.y)));
    return { t, uv, w: smoothstep(float(0), float(24), edge) };
  };

  /** `f` is the vec2 (F, R) there times `w`, the window weight. */
  const readLevel = (lv: LevelGpu, y: TslNode): { f: TslNode; w: TslNode } => {
    const n = lv.level.n;
    const q = y.div(float(lv.level.texelM)).sub(float(0.5));
    const b = floor(q);
    const fr = q.sub(b);
    const ix = int(b.x);
    const iz = int(b.y);
    const m = int(n - 1);
    const at = (xi: TslNode, zi: TslNode) => {
      const v4 = lv.ro.element(bitAnd(zi, m).mul(int(n)).add(bitAnd(xi, m)));
      return vec2(v4.x, v4.z);
    };
    const v = mix(
      mix(at(ix, iz), at(ix.add(int(1)), iz), fr.x),
      mix(at(ix, iz.add(int(1))), at(ix.add(int(1)), iz.add(int(1))), fr.x),
      fr.y,
    );
    // Texels from the window's nearest edge; the level fades out over the
    // outer 24 texels, and is 0 outside, where its cells hold other water.
    const lo = q.sub(vec2(lv.uOrigin.x, lv.uOrigin.y));
    const edge = min(min(lo.x, lo.y), min(float(n - 2).sub(lo.x), float(n - 2).sub(lo.y)));
    const w = smoothstep(float(0), float(24), edge);
    return { f: v.mul(w), w };
  };

  const reader: OceanFoamReader = {
    coverageAt(sample) {
      const y = sample.sub(uDrift.mul(uReadT));
      const r0 = readLevel(levels[0], y);
      const r1 = readLevel(levels[1], y);
      const f = mix(r1.f.x, r0.f.x.div(max(r0.w, float(1e-4))), r0.w);
      return smoothstep(tune.cov0, tune.cov1, f).mul(tune.cScale);
    },
    shade({ sample, deficit, longM, shortM }) {
      // THE PERF PROBE'S BYPASS: `bypass` over 0.5 draws the surface's old
      // fold-only ramp and skips every read below, so one page can time the
      // frame with and without the foam read (a uniform branch; the GPU
      // skips it whole).
      const alphaV = float(0).toVar();
      const brightV = float(1).toVar();
      If(tune.bypass.lessThan(float(0.5)), () => {
      // The fragment in the drifting foam frame.
      const y = sample.sub(uDrift.mul(uReadT)).toVar();
      const yA = y.dot(wA).toVar();
      const yB = y.dot(wB).toVar();

      // THE STORE: (F, R, B, gain), the fine level where it holds this water
      // and the pixel is not much coarser than its texel, else the coarse.
      // THE STORE'S READ POINT (round 10, `warp`): moved along the wind by
      // streaky value noise, so the outline is combed into strands. At
      // warp 0 it is y exactly.
      const yS = y.toVar();
      If(tune.warp.greaterThan(float(0)).or(tune.warpX.greaterThan(float(0))), () => {
        const n1 = valueNoise(yA.div(tune.warpLenA), yB.div(tune.warpLenB), FOAM_WARP_SALT);
        const n2 = valueNoise(yA.div(tune.warpLenA.mul(0.45)).add(3.7), yB.div(tune.warpLenB.mul(0.5)).add(1.3), FOAM_WARP_SALT + 1);
        const n3 = valueNoise(yA.div(tune.warpLenA.mul(1.5)).add(7.1), yB.div(tune.warpLenB.mul(4)).add(5.9), FOAM_WARP_SALT + 2);
        yS.addAssign(wA.mul(n1.add(n2.mul(0.5)).mul(tune.warp)).add(wB.mul(n3.mul(tune.warpX))));
      });
      const d0 = sampleDisplay(levels[0], yS);
      const d1 = sampleDisplay(levels[1], yS);
      const t0 = FOAM_LEVELS[0].texelM;
      const fineW = d0.w.mul(float(1).sub(smoothstep(float(t0 * 2), float(t0 * 6), longM))).toVar();
      const both = mix(d1.t.xy.mul(d1.w), d0.t.xy, fineW).toVar();
      const fAmt = both.x;
      // The fold-laid foam G here (round 6), the same level blend. The
      // two fetches run only while the fold lays (`inPlace` over 0): a
      // uniform branch, as the read's `bypass` is, so the share at 0 costs
      // nothing and an ablation can time G's fetches alone.
      const gAmt = float(0).toVar();
      // THE FRESHNESS A (round 9, `ageClock`): the same fetch's z, the
      // level blend G's. 0 where the clock is off.
      const aAmt = float(0).toVar();
      If(tune.inPlace.greaterThan(float(0)), () => {
        const g1 = texture(levels[1].dispTex2, d1.uv).level(float(0));
        const g0 = texture(levels[0].dispTex2, d0.uv).level(float(0));
        gAmt.assign(mix(g1.x.mul(d1.w), g0.x, fineW));
        If(tune.ageClock.greaterThan(float(0)), () => {
          aAmt.assign(mix(g1.z.mul(d1.w), g0.z, fineW));
        });
      });
      // How fresh the foam here is, 0 old to 1 laid by a breaker within
      // the last moments (`foamAgeStep`): the read's world-space clock.
      const freshA = smoothstep(tune.ageA0, tune.ageA1, aAmt).toVar();
      // The whole body's freshness (`ageOnBody`): the breaker's clock or
      // G's own density, whichever says fresher.
      const freshW = max(freshA, smoothstep(tune.ageG0, tune.ageG1, gAmt)).toVar();
      const held = max(d0.w, d1.w);
      const gainHere = mix(float(1), mix(d1.t.w, d0.t.w, d0.w), held);
      const breakerHere = mix(float(0), mix(d1.t.z, d0.t.z, d0.w), held).toVar();
      // AGE, 0 fresh to 1 old: the share of the foam here that is residual,
      // the part F has already lost (`foamResidualStep`). Under a passing
      // breaker F grows and R is small; behind it F drains into R.
      const age = both.y.div(fAmt.add(both.y).add(0.03)).toVar();

      // THE WINDROWS (FOAM_WINDROW_SPACING_M): old foam is swept by the
      // Langmuir cells into lines along the wind; the residual and the
      // streaks between whitecaps gather there.
      const rows = valueNoise(yA.div(FOAM_WINDROW_SPACING_M * FOAM_WINDROW_STRETCH), yB.div(FOAM_WINDROW_SPACING_M), FOAM_SALT_WINDROW).abs();
      const rowsK = float(1).sub(smoothstep(float(0), tune.rowWidth, rows));
      const rowsGain = mix(float(1 - FOAM_WINDROW_DEPTH), float(1).add(tune.rowBoost), rowsK);

      // THE THREE KINDS OF FOAM (round 4). Both round-3 judges asked for
      // foam "born on the crests as a bright core" that "ages downwind into
      // stretched, fraying lace".
      //   core:  the crest breaking now, where the surface folds and the
      //          store holds an active breaker. Near-opaque and bright.
      //   trail: what the breaker laid down behind it (F), a lace whose
      //          texture ages from fine to holes and strands.
      //   old:   the residual on the windrows and the Beaufort streaks
      //          between whitecaps, thin strands only.
      const far = smoothstep(float(0.5), float(4), longM).toVar();
      // THE WAVE HERE, from the wind sea and the swell: the height over Hs
      // (`crest`, 0 in a trough to 1 on a crest) and the slope, for where a
      // whitecap sits and how its foam is lit.
      const hW = samplerR.sampleCascade(samplerR.disp, sample, windIdx, windSea.patchM).y;
      const nW = samplerR.sampleCascade(samplerR.norm, sample, windIdx, windSea.patchM);
      let hSum: TslNode = hW;
      let slope: TslNode = vec2(nW.x, nW.y).div(max(nW.z, float(0.3)));
      if (swellIdx !== null) {
        hSum = hSum.add(samplerR.sampleCascade(samplerR.disp, sample, swellIdx, cascades[swellIdx].patchM).y);
        const nS = samplerR.sampleCascade(samplerR.norm, sample, swellIdx, cascades[swellIdx].patchM);
        slope = slope.add(vec2(nS.x, nS.y).div(max(nS.z, float(0.3))));
      }
      const crest = smoothstep(float(-0.4), float(0.7), hSum.div(float(hsM))).toVar();
      const upness = float(1).div(sqrt(float(1).add(slope.dot(slope))));
      const g = gainHere;
      // THE FAR CREST IS A MEAN: its ramp widens with the footprint.
      const iLo = tune.deficitLo.sub(far.mul(tune.instWiden));
      const iHi = tune.deficitHi.add(far.mul(tune.instWiden));
      // Near the camera a fold of the ripple alone is micro-breaking, the
      // 'confetti' of GG-280: the core draws only where the store holds an
      // active breaker, which the wind sea's own fold starts. Far out, where
      // the ripple is gone, the gate opens.
      // `foldGate0` to `foldGate1` of B: at 0.02 to 0.25 (round 3) every
      // ripple crest inside a breaker's patch drew, a white scribble over
      // the near water at eye level.
      // `foldFree` (round 5): a fold with no breaker under it still draws a
      // little, the dusting of single bits the reference strews over its
      // crests; the mass of the fold still needs the breaker.
      const gateHere = mix(max(smoothstep(tune.foldGate0, tune.foldGate1, breakerHere), tune.foldFree), float(1), far);
      // THE CORE is the crest folding here now: the surface's own fold at
      // this pixel's resolution, the breaking front. It joins the lace's
      // coverage at up to `instW`, so the front is the densest, brightest
      // fibers of its patch and frays the way the patch does. Drawn as a
      // separate opaque layer (round 4, first try) it pasted flat grey chips
      // with hard rims onto the fibers.
      // THE FRONT ON THE LAY RAMP (round 6, `headLay`): the crest folding
      // under the breaker along its whole line, not only its peak, so a
      // head carries a crest line and a dense breaking edge. max(x, 0) at
      // headLay 0: round 4 exactly.
      const lLo = tune.layLo.sub(far.mul(tune.instWiden));
      const lHi = tune.layHi.add(far.mul(tune.instWiden));
      const coreLay = smoothstep(lLo, lHi, deficit.mul(g)).mul(gateHere).mul(tune.headLay);
      const coreFold = max(smoothstep(iLo, iHi, deficit.mul(g)).mul(gateHere), coreLay);
      const instW = mix(tune.instW, tune.instW.mul(tune.instFar), far);
      // Near the camera the wind sea's texel (its patch over the grid, 0.38 m
      // in the storm) spans many pixels, and a threshold on its bilinear fold
      // drew triangles and diamonds on the near water at eye level. The fold
      // fades where the pixel is under a quarter of that texel.
      const windTexelM = windSea.patchM / bufs.n;
      const magK = smoothstep(float(windTexelM * 0.1), float(windTexelM * 0.25), shortM);
      const cFold = coreFold.mul(instW).mul(magK).toVar();
      // THE CREST LINE FROM ABOVE (round 7, `headLine`): the fold on the
      // lay ramp under the breaker at up to headLine of full coverage in a
      // view from above, over the fold's `instW` share. Uniform branch.
      If(tune.headLine.greaterThan(float(0)).and(uAbove.greaterThan(float(0))), () => {
        cFold.assign(max(cFold, coreLay.mul(tune.headLine).mul(uAbove).mul(magK)));
      });
      // THE DUSTING (round 7, `dustAbove`): from above, every crest
      // folding on the lay ramp draws, breaker or none, at dustAbove of
      // full coverage: the crest lines of every fold and the single bits
      // the reference strews over its water. (Near the camera at eye
      // level the same fold is the confetti of GG-280, so it stays gated
      // there.) Uniform branch.
      If(tune.dustAbove.greaterThan(float(0)).and(uAbove.greaterThan(float(0))), () => {
        cFold.assign(max(cFold, smoothstep(lLo, lHi, deficit.mul(g)).mul(tune.dustAbove).mul(uAbove).mul(magK)));
      });
      // ROUND 8, AT EVERY ANGLE: the crest line under a breaker at
      // `lineCov` (the verdict's "bright, crisp break line along a
      // crest"), and every crest folding on the lay ramp at `dust` with
      // no breaker under it (the small crest breaks between the big
      // patches; `magK` keeps GG-280's confetti off the near water).
      If(tune.lineCov.greaterThan(float(0)), () => {
        cFold.assign(max(cFold, coreLay.mul(tune.lineCov).mul(magK)));
      });
      If(tune.dust.greaterThan(float(0)), () => {
        cFold.assign(max(cFold, smoothstep(lLo, lHi, deficit.mul(g)).mul(tune.dust).mul(magK)));
      });
      // THE HEAD: the whitecap the store's breaker marks around that front.
      // B spans the breaking crest's width and runs with it. The head is
      // drawn by the same lace as its trail, at high coverage, so it is
      // dense white with dark specks and its edge frays into the trail as B
      // falls off. Drawn as a separate opaque layer (round 4, first try) it
      // was a smooth white blob on the lace: the "sprite decal" of round 3.
      // Far out (farT) the head fades to the trail alone: there B's patch
      // drew a flat white oval, "patches of snow or stickers lying on the
      // sea" (a round-3 judge), where the trail and the fold here draw a
      // soft veil with a broken bright crest.
      const farT = smoothstep(float(1.5), float(8), longM).toVar();
      // (Read from the coarse level's B instead, round 4, the head's rim was
      // no softer from above, and the 2 m texels drew bilinear diamonds on
      // the near water at eye level.) The head needs foam under it (F from `headF0` to `headF1`): a
      // breaker just born is a fold and nothing more, and its B alone drew a
      // round patch the size of its gate.
      const cHead = smoothstep(tune.coreB0, tune.coreB1, breakerHere).mul(tune.coreBW).mul(float(1).sub(farT))
        .mul(smoothstep(tune.headF0, tune.headF1, fAmt)).toVar();
      // THE HEAD FROM ABOVE (round 7, `headAbove`): the disc at headAbove
      // of its coverage in a view from above (`uAbove`), so the crest line
      // shows through it (round 4's disc was the smooth oval's head from
      // above; at eye level it is the churning mass the judges praised).
      // Uniform branch: at headAbove 1 or from eye level, round 6 exactly.
      If(tune.headAbove.lessThan(float(1)).and(uAbove.greaterThan(float(0))), () => {
        cHead.mulAssign(mix(float(1), tune.headAbove, uAbove));
      });
      // THE HEAD TAKES THE CREST'S SHAPE (round 8, `headShape`): the disc
      // keeps 1 - headShape of itself where the crest is not folding
      // under it now, all of itself where it is, so a head is the fold's
      // line with a softer disc around it, at every angle.
      If(tune.headShape.greaterThan(float(0)), () => {
        cHead.mulAssign(mix(float(1).sub(tune.headShape), float(1), smoothstep(lLo, lHi, deficit.mul(g))));
      });
      // THE HEAD TAKES THE CREST'S MASS (round 9, `headG`): the disc keeps
      // 1 - headG of itself where the fold-laid G is low. Uniform branch.
      If(tune.headG.greaterThan(float(0)), () => {
        cHead.mulAssign(mix(float(1).sub(tune.headG), float(1), smoothstep(tune.headG0, tune.headG1, gAmt)));
      });
      If(tune.headScale.lessThan(float(1)), () => {
        cHead.mulAssign(tune.headScale);
      });
      // Far out the ramp runs to `covFar1`, so a far trail thins all along
      // its length from the head instead of lying flat white for most of it.
      const cov1 = mix(tune.cov1, tune.covFar1, farT);
      // THE TRAIL'S BODY is the store's F through the coverage ramp; the
      // CORE is the head and the fold here. Kept apart (round 5): the body
      // is aged and torn, the core stays a whole mass.
      // THE FOLD-LAID FOAM (round 6) joins the body: G through its own ramp
      // and cap, so a crest's fold lies as a mass of the crest's own shape
      // at every size, and thins in place as G fades. At G 0: round 4.
      // G FROM ABOVE (round 7): its cap, ramp top and veil share take
      // their deltas in a view from above; the trails' body gives up
      // `bodyAbove` of itself there. Each a uniform branch on its delta.
      const layCapH = tune.layCap.toVar();
      const layCov1H = tune.layCov1.toVar();
      const layVeilH = tune.layVeil.toVar();
      If(uAbove.greaterThan(float(0)), () => {
        If(tune.gCapAbove.abs().greaterThan(float(0)), () => { layCapH.addAssign(tune.gCapAbove.mul(uAbove)); });
        If(tune.gCov1Above.abs().greaterThan(float(0)), () => { layCov1H.addAssign(tune.gCov1Above.mul(uAbove)); });
        If(tune.gVeilAbove.abs().greaterThan(float(0)), () => { layVeilH.addAssign(tune.gVeilAbove.mul(uAbove)); });
      });
      const cLay = smoothstep(tune.layCov0, layCov1H, gAmt).mul(layCapH).toVar();
      const cBodyF = smoothstep(tune.cov0, cov1, fAmt).toVar();
      If(tune.bodyAbove.greaterThan(float(0)).and(uAbove.greaterThan(float(0))), () => {
        cBodyF.mulAssign(float(1).sub(tune.bodyAbove.mul(uAbove)));
      });
      // THE TRAIL THINS WITH ITS AGE (round 9, `ageCov`): the body's
      // coverage falls to 1 - ageCov of itself where the freshness is
      // gone, in world space, so a trail is a dense head and a tail that
      // thins to loose hairs over its run; the head (cHead, the breaker
      // here) and G (its own clock) are untouched. Uniform branch.
      If(tune.bodyScale.lessThan(float(1)), () => {
        cBodyF.mulAssign(tune.bodyScale);
      });
      // THE HALO (round 9, `halo`): thin F draws as sparse hairs. Uniform branch.
      If(tune.halo.greaterThan(float(0)), () => {
        const fr = select(tune.ageOnBody.greaterThan(float(0.5)), freshW, freshA);
        const haloK = tune.halo.mul(mix(float(1), float(1).sub(fr), tune.haloOld));
        cBodyF.assign(max(cBodyF, smoothstep(tune.halo0, tune.halo1, fAmt).mul(haloK)));
      });
      // The age's factor on the coverage (`ageCov`) and the windrow tear
      // (`rowTear`), on F's body alone (ageOnBody 0, by the breaker's
      // clock) or on the whole body after G joins it (1, by freshW).
      const ageK = float(1).toVar();
      If(tune.ageClock.greaterThan(float(0)).and(tune.ageCov.greaterThan(float(0))), () => {
        const fr = select(tune.ageOnBody.greaterThan(float(0.5)), freshW, freshA);
        ageK.mulAssign(mix(float(1).sub(tune.ageCov), float(1), fr));
      });
      // OLD FOAM IS TORN INTO WINDROWS (round 9, `rowTear`): where the
      // freshness is gone the body keeps its coverage on the streaks of
      // the tear noise (along the wind) and loses up to rowTear of it
      // between them, so an old oval is three or four windrows and a
      // fresh trail is whole. Uniform branch.
      If(tune.ageClock.greaterThan(float(0)).and(tune.rowTear.greaterThan(float(0))), () => {
        const fr = select(tune.ageOnBody.greaterThan(float(0.5)), freshW, freshA);
        const tearN = valueNoise(yA.div(FOAM_TEAR_ALONG_M).add(2.7), yB.div(FOAM_TEAR_ACROSS_M).add(9.1), FOAM_TEAR_SALT);
        const onRow = smoothstep(tune.tearLo, tune.tearHi, tearN);
        ageK.mulAssign(float(1).sub(tune.rowTear.mul(float(1).sub(fr)).mul(float(1).sub(onRow))));
      });
      If(tune.ageOnBody.lessThan(float(0.5)), () => {
        cBodyF.mulAssign(ageK);
      });
      const cBody = max(cBodyF, cLay).toVar();
      If(tune.ageOnBody.greaterThan(float(0.5)), () => {
        cBody.mulAssign(ageK);
      });
      const cCore = max(cHead, cFold).toVar();
      const cTrail = max(cBody, cCore).toVar();
      const cRes = smoothstep(tune.res0, tune.res1, both.y.mul(rowsGain)).mul(tune.resMax);
      const cStreak = float(streakLevel).mul(rowsGain).mul(tune.streakW);
      const cOld = max(cRes, cStreak).toVar();
      // AGE BY DENSITY (round 5). The residual's share does not clock a
      // trail: R and F fade at near the same rate, so their ratio is one
      // value along the whole trail (debug 4 drew every trail uniformly
      // fresh) and the round-4 tails never aged. Thin foam IS old foam:
      // where F has fallen toward cov0 the lace ages toward the old
      // texture, its holes and the tear, by `ageThin`; the core stays fresh.
      const thin = float(1).sub(smoothstep(tune.cov0, cov1, fAmt)).mul(float(1).sub(cCore)).mul(tune.ageThin).toVar();
      // G AGES BY ITS DENSITY (round 6): G fades in place from the moment
      // its crest folded, so a thin G is an old one; where G carries the
      // body, its thinness opens the holes and takes the old lace by
      // `layAge`. The share of G in the body keeps F's own clock elsewhere.
      const gShare = cLay.div(cBodyF.add(cLay).add(1e-3));
      const ageG = float(1).sub(smoothstep(tune.layCov0, tune.layCov1, gAmt)).mul(float(1).sub(cCore)).mul(tune.layAge).mul(gShare).toVar();
      // The lace's mix: a thin tail takes `tailOld` of the old lace (all of
      // it, in the first round-5 pass, drew the old strands as parallel
      // scratches from above); its holes and the tear take all of `thin`.
      const ageL = mix(max(max(age, thin.mul(tune.tailOld)), ageG), float(1), cOld.div(cTrail.add(cOld).add(1e-3))).toVar();
      // THE LACE AGES WITH THE CLOCK (round 9, `ageTex`): where the
      // freshness is gone the trail takes the old lace (the strands, a
      // tail combed along the wind) by ageTex; the core stays young.
      If(tune.ageClock.greaterThan(float(0)).and(tune.ageTex.greaterThan(float(0))), () => {
        const fr = select(tune.ageOnBody.greaterThan(float(0.5)), freshW, freshA);
        ageL.assign(max(ageL, float(1).sub(fr).mul(tune.ageTex).mul(float(1).sub(cCore))));
      });
      const ageH = max(ageL, thin).toVar();

      // THE FOOTPRINT, per axis in the wind's frame: a layer whose cells are
      // under about two pixels on either axis goes to its mean.
      const gx = dFdx(y);
      const gy = dFdy(y);
      const ea = max(gx.dot(wA).abs(), gy.dot(wA).abs()).add(1e-5);
      const eb = max(gx.dot(wB).abs(), gy.dot(wB).abs()).add(1e-5);
      const cellsPx = (alongM: number, acrossM: number): TslNode => min(float(alongM).div(ea), float(acrossM).div(eb));
      const L = FOAM_LACE;
      const rCell1 = smoothstep(float(1.5), float(4), cellsPx(L.cell1AcrossM * L.cell1Stretch, L.cell1AcrossM)).toVar();
      // The fibers hold while a mean fiber is at least 0.4 of a pixel wide
      // on both axes (at the reference's 0.14 m a pixel from above it is
      // one); thinner, they would alias into sparkle.
      const fiberW = 2 * L.fiberHalfWCells * L.fiberCellM;
      // (A fade by the footprint's shape, for grazing views, was tried in
      // round 4 and dropped: a derivative is constant over a triangle, and on
      // the near water at eye level, where a triangle spans a hundred
      // pixels, the fade drew the mesh's facets.)
      const rFiber = smoothstep(float(0.4), float(1), cellsPx(fiberW, fiberW)).toVar();
      // Where the aligned fibers take over from the curls (round 6): at
      // least curlPxLo to curlPxHi pixels wide.
      const rAligned = smoothstep(tune.curlPxLo, tune.curlPxHi, cellsPx(fiberW, fiberW)).toVar();
      // The wisps (round 7) hold while a wisp is 0.4 of a pixel wide.
      const wispW = 2 * FOAM_LACE_WISP.fiberHalfWCells * FOAM_LACE_WISP.fiberCellM;
      const rWisp = smoothstep(float(0.4), float(1), cellsPx(wispW, wispW)).toVar();
      // The bubbles (round 8) hold while a bubble's radius is 0.4 px.
      const dotM = (FOAM_DOT_RADIUS * FOAM_LACE.fiberCellM * FOAM_LACE.fiberCount) / FOAM_DOT_COUNT;
      const rDot = smoothstep(float(0.4), float(1), cellsPx(dotM, dotM)).toVar();
      // The hair (round 9) holds while a long hair is 0.4 px wide.
      const hairWm = 2 * FOAM_LACE_HAIR.fiberHalfWCells * FOAM_LACE_HAIR.fiberCellM;
      const rHair = smoothstep(float(0.4), float(1), cellsPx(hairWm, hairWm)).toVar();
      // The clump's finer octave is half its cell.
      const rClump = smoothstep(float(1.5), float(4), cellsPx(L.clumpAcrossM * L.clumpStretch * 0.5, L.clumpAcrossM * 0.5)).toVar();
      const rStrand = smoothstep(float(1.2), float(3), cellsPx(L.strandAcrossM * L.strandStretch, L.strandAcrossM)).toVar();

      // THE LACE: the young and the old lace, each made uniform by its own
      // measured CDF, blended by age.
      // The bubble cells and the streaks (round 10): each goes to its mean
      // under about a pixel and a half of cell, or 0.4 px of streak width.
      const rCellS = smoothstep(float(1.0), float(2.5), cellsPx(FOAM_CELLS_ALONG_M / FOAM_CELLS_S_COUNT, FOAM_CELLS_ACROSS_M / FOAM_CELLS_S_COUNT)).toVar();
      const rCellL = smoothstep(float(1.0), float(2.5), cellsPx(FOAM_CELLS_ALONG_M / FOAM_CELLS_L_COUNT, FOAM_CELLS_ACROSS_M / FOAM_CELLS_L_COUNT)).toVar();
      const streakWm = 2 * FOAM_LACE_STREAK.fiberHalfWCells * (FOAM_CELLS_ACROSS_M / FOAM_LACE_STREAK.fiberCount);
      const rStreak = smoothstep(float(0.4), float(1), cellsPx(streakWm, streakWm)).toVar();
      const lay = laceLayers(yA, yB, rCell1, rFiber, rClump, rStrand, rAligned, rWisp, rDot, rHair, { s: rCellS, l: rCellL, k: rStreak });
      // The young lace's table: the curl table where the curls draw (read
      // only inside the branch on `curl`), and from above (`uAbove`) the
      // table with the wisps (round 7), inside a branch on `wisp`.
      const rawY = mixLace(lay, FOAM_LACE_YOUNG).toVar();
      const texY = cdfRead(rawY, 0).toVar();
      const texO = cdfRead(mixLace(lay, FOAM_LACE_OLD), 1).toVar();
      // The fringe's weight (round 8): where the trail's coverage is under
      // fringeC0 to fringeC1, the threshold texture blends to the bubbles
      // and wisps (FOAM_LACE_FRINGE) after the tables below.
      const fringeW = float(0).toVar();
      If(tune.fringe.greaterThan(float(0)), () => {
        const small = float(1).sub(smoothstep(tune.fringePx, tune.fringePx.mul(2), cellsPx(dotM, dotM)));
        fringeW.assign(tune.fringe.mul(float(1).sub(smoothstep(tune.fringeC0, tune.fringeC1, cTrail))).mul(rDot).mul(small));
      });
      If(tune.curl.greaterThan(float(0.5)).and(rAligned.lessThan(float(1))), () => {
        const tC = cdfRead(rawY, 2).toVar();
        If(tune.wisp.greaterThan(float(0.5)).and(uAbove.greaterThan(float(0))), () => {
          // The fringe: where the trail's coverage is under wispC0..C1.
          const fringe = uAbove.mul(float(1).sub(smoothstep(tune.wispC0, tune.wispC1, cTrail)));
          tC.assign(mix(tC, cdfRead(mixLace(lay, FOAM_LACE_YOUNG_ABOVE), 3), fringe));
          texO.assign(mix(texO, cdfRead(mixLace(lay, FOAM_LACE_OLD_ABOVE), 4), fringe.mul(float(1).sub(rAligned))));
        });
        // THE WISPS BY RESOLUTION (round 8, `wispRes`, GG-311): the same
        // tables where the aligned fibers are under 3 px wide on screen
        // (1 - rAligned, where the curls draw), at every angle.
        If(tune.wispRes.greaterThan(float(0.5)), () => {
          const fringeR = float(1).sub(rAligned).mul(float(1).sub(smoothstep(tune.wispC0, tune.wispC1, cTrail)));
          tC.assign(mix(tC, cdfRead(mixLace(lay, FOAM_LACE_YOUNG_ABOVE), 3), fringeR));
          texO.assign(mix(texO, cdfRead(mixLace(lay, FOAM_LACE_OLD_ABOVE), 4), fringeR));
        });
        // THE FINE REGIME (round 8, `fine`): the whole patch, not only the
        // fringe, takes the wisp-led tables where the aligned fibers are
        // under 3 px wide, at every angle. With the hair on (round 9) the
        // hair tables take its place and these reads are skipped.
        If(tune.fine.greaterThan(float(0)).and(tune.hair.lessThan(float(0.5))), () => {
          const fineK = tune.fine.mul(float(1).sub(rAligned));
          tC.assign(mix(tC, cdfRead(mixLace(lay, FOAM_LACE_YOUNG_FINE), 6), fineK));
          texO.assign(mix(texO, cdfRead(mixLace(lay, FOAM_LACE_OLD_FINE), 7), fineK));
        });
        // THE HAIR (round 9, `hair`): where the aligned fibers are under
        // 3 px wide, the hair tables, at every angle.
        If(tune.hair.greaterThan(float(0)), () => {
          const hairK = tune.hair.mul(float(1).sub(rAligned));
          tC.assign(mix(tC, cdfRead(mixLace(lay, FOAM_LACE_YOUNG_HAIR), 8), hairK));
          texO.assign(mix(texO, cdfRead(mixLace(lay, FOAM_LACE_OLD_HAIR), 9), hairK));
        });
        // THE BUBBLE CELLS (round 10, `cells`): where the aligned fibers are
        // under 3 px wide and the large cells resolve, the cell tables, at
        // every angle.
        If(tune.cells.greaterThan(float(0)), () => {
          const cellK = tune.cells.mul(float(1).sub(rAligned)).mul(rCellL);
          tC.assign(mix(tC, cdfRead(mixLace(lay, FOAM_LACE_YOUNG_CELLS), 11), cellK));
          texO.assign(mix(texO, cdfRead(mixLace(lay, FOAM_LACE_OLD_CELLS), 12), cellK));
        });
        texY.assign(mix(tC, texY, rAligned));
      });
      If(tune.fringe.greaterThan(float(0)), () => {
        const tF = cdfRead(mixLace(lay, FOAM_LACE_FRINGE), 5).toVar();
        // The fringe as hair (round 9, `hairFringe`) where the hair is
        // fetched (the aligned fibers under 3 px); where they are wider
        // the bubbles stay, as round 8 drew them.
        If(tune.hairFringe.greaterThan(float(0)), () => {
          tF.assign(mix(tF, cdfRead(mixLace(lay, FOAM_LACE_FRINGE_HAIR), 10), tune.hairFringe.mul(float(1).sub(rAligned)).mul(rHair)));
        });
        // The fringe as streaks and large cells (round 10, `cells`).
        If(tune.cells.greaterThan(float(0)), () => {
          tF.assign(mix(tF, cdfRead(mixLace(lay, FOAM_LACE_FRINGE_CELLS), 13), tune.cells.mul(float(1).sub(rAligned)).mul(rCellL)));
        });
        texY.assign(mix(texY, tF, fringeW));
        texO.assign(mix(texO, tF, fringeW));
      });
      const tex = mix(texY, texO, ageL).toVar();
      const resolvedY = rCell1.mul(FOAM_LACE_YOUNG.cell1).add(rFiber.mul(FOAM_LACE_YOUNG.fiber)).add(rClump.mul(FOAM_LACE_YOUNG.clump));
      const resolvedO = rCell1.mul(FOAM_LACE_OLD.cell1).add(rFiber.mul(FOAM_LACE_OLD.fiber)).add(rStrand.mul(FOAM_LACE_OLD.strand))
        .add(rClump.mul(FOAM_LACE_OLD.clump));
      const resolved = mix(resolvedY, resolvedO, ageL).toVar();

      // THE METER SCALE ACTS ON THE COVERAGE, not on the threshold (round 4,
      // FOAM_LACE): the clump makes a patch thicker and thinner (`mid`), and
      // the coarse network opens holes in old foam (`holes`), soft-edged. A
      // threshold on them drew the net and the blobs the judges named. The
      // streaks old foam is torn into are its threshold texture, the long
      // fibers (FOAM_LACE_OLD).
      const midK = float(1).add(tune.mid.mul(lay.clump.sub(layerMeans.clump).mul(2)));
      const holeK = float(1).sub(tune.holes.mul(ageH).mul(smoothstep(float(0.45), float(0.85), lay.cell1)));
      // THE TEAR (round 5). Thin foam is torn into islands and holes: where
      // the clump channel at `tearScale` times its size (1.2 m across, 3 m
      // along at 0.5) is over its mean, the coverage falls by up to `tear`
      // of itself, so the tail of a trail breaks into islands and ends in
      // loose bits. Dense foam is torn `tearDense` as much. Where the clump
      // is finer than the pixel the tear is off, so the far veils keep
      // their mean. The round-4 edges "faded by an even blur instead of
      // breaking into strands and islands" (the verdict from above). Tried
      // first here and dropped: the strand channel (it tore the tails into
      // parallel scratches), and a tear that also doubled the coverage
      // between its holes, to hold the mean (a bit drawn at double
      // coverage was a flat hard-edged chunk, where a wisp is fibrous).
      const tearRaw = texture(laceTile, vec2(
        yA.div(tune.tearScale.mul(L.clumpAcrossM * L.clumpStretch * L.clumpCount)), yB.div(tune.tearScale.mul(L.clumpAcrossM * L.clumpCount)),
      )).level(float(0)).z;
      const rTear = smoothstep(float(1.5), float(4), min(
        tune.tearScale.mul(L.clumpAcrossM * L.clumpStretch * 0.5).div(ea), tune.tearScale.mul(L.clumpAcrossM * 0.5).div(eb),
      ));
      const clumpy = smoothstep(float(layerMeans.clump), float(layerMeans.clump + 0.25), mix(float(layerMeans.clump), tearRaw, rTear));
      const tearK = max(float(1).sub(tune.tear.mul(mix(tune.tearDense, float(1), thin)).mul(clumpy)), float(0));
      // THE CORE'S RIM CRUMBLES (round 5): the head's B is a smooth blob
      // (bilinear, advected), and drawn whole it was "the same feathered
      // oval stamp". The crackle net moves the rim's coverage by up to
      // `headTear` either way, so the mass has an irregular, crest-shaped
      // outline; its center (cHead near 1) stays solid.
      const headK = max(float(1).add(tune.headTear.mul(float(1).sub(cHead.mul(cHead)))
        .mul(float(0.5).sub(smoothstep(float(0.35), float(0.85), lay.cell1))).mul(2)), float(0));
      // THE CORE UNDER THE MODULATION (round 6): with `coreMod` 1 the core
      // takes the clump's `mid` and the net's `holes` as the trail does,
      // in the same order of operations, which is round 4's draw
      // (max(trail, core, old) x mid x holes); at 0 it is round 5's whole
      // mass. select, not mix: mix(1, k, 1) is not k to the ulp.
      const midK0 = max(midK, float(0)).toVar();
      const coreOn = tune.coreMod.greaterThan(float(0.5));
      const cCoreMod = cCore.mul(headK).mul(select(coreOn, midK0, float(1))).mul(select(coreOn, holeK, float(1)));
      const cLace = max(max(cBody.mul(tearK), cOld).mul(midK0).mul(holeK), cCoreMod).toVar();

      // FAR FOAM IS TORN AND THINNER. Past a few meters of footprint the
      // fine layers are gone, and a far whitecap drew as a flat white oval
      // ("patches of snow or stickers lying on the sea"). The strands at
      // eight times their size tear it into streaks along the wind, and the
      // coverage falls to `farCov` of itself.
      // The strands at `farScale` times their size (a uniform, so a probe
      // can sweep it).
      const farStrandRaw = texture(laceTile, vec2(
        yA.div(tune.farScale.mul(L.strandAcrossM * L.strandStretch * L.strandCount)), yB.div(tune.farScale.mul(L.strandAcrossM * L.strandCount)),
      )).level(float(0)).w;
      // The far strands fade to their mean where they are finer than the
      // pixel: read at level 0 they aliased into horizontal hatching.
      const rFar = smoothstep(float(1.2), float(3), min(
        tune.farScale.mul(L.strandAcrossM * L.strandStretch).div(ea), tune.farScale.mul(L.strandAcrossM).div(eb),
      ));
      const farStrand = float(1).sub(smoothstep(float(0.15), float(0.6), mix(float(layerMeans.strand), farStrandRaw, rFar)));
      // The far treatment starts where the lace is lost, not only past a
      // footprint of meters: at 60 to 150 m from the eye-level camera the
      // footprint is under 2 m, the lace had gone to its mean, and a whitecap
      // drew as a flat white lozenge. `farU` is the larger of the two.
      const farU = max(farT, float(1).sub(resolved)).toVar();
      const farK = mix(float(1), tune.farCov.mul(mix(float(1), farStrand.mul(1.4).min(float(1)), tune.farTear)), farU).toVar();

      // Far out a whitecap is seen on the crest that carries it: the far
      // coverage falls to `farTrough` of itself off the crest, so a far
      // patch takes the shape of its wave, not of the store's oval.
      const crestK = mix(float(1), mix(tune.farTrough, float(1), smoothstep(float(0.3), float(0.9), crest)), farU);
      // The head runs past cScale to full coverage (`coreFull`).
      const cCap = mix(tune.cScale, float(1), cHead.mul(tune.coreFull));
      const c = cLace.mul(cCap).mul(farK).mul(crestK).toVar();
      // THE ROLLER'S FRESH FOAM (river mouth round 3, `freshWhole`): foam a breaker or a source laid fresh
      // (the age clock's freshA) is the crest itself, so the far tear and the off-crest cut, which model an
      // old trail seen far off, do not thin it. Uniform branch; at 0 no change.
      If(tune.freshWhole.greaterThan(float(0)), () => {
        c.assign(max(c, freshA.mul(cBodyF).mul(cCap).mul(tune.freshWhole)));
      });

      // `foamDrawnAlpha`: a threshold lace with a little veil, and where the
      // lace is unresolved its mean (`foamDrawnMeanAlpha`, closed form).
      // The lace's soft edge: wider in dense foam, so a core is a soft
      // continuous white with specks, and crisp in thin foam, so a fringe
      // frays into distinct fibers (laceProto7b.py).
      // The anti-aliasing term is sized to the wisp's width in the fine
      // regime (round 8, `fine`): at 0.15 m a pixel the 0.14 m fiber's
      // term softened the threshold to a gray mean where the wisps, 0.36 m
      // wide, are crisp at 2 px.
      const aaW = float(fiberW).toVar();
      If(tune.fine.greaterThan(float(0)), () => {
        aaW.assign(mix(float(fiberW), float(wispW), tune.fine.mul(float(1).sub(rAligned))));
      });
      // Sized to the long hair's width where the hair carries the texture (round 9).
      If(tune.hair.greaterThan(float(0)), () => {
        aaW.assign(mix(float(fiberW), float(hairWm).mul(tune.hairAA), tune.hair.mul(float(1).sub(rAligned))));
      });
      // Sized to `cellAAm` where the cells carry the texture (round 10).
      If(tune.cells.greaterThan(float(0)), () => {
        aaW.assign(mix(aaW, tune.cellAAm, tune.cells.mul(float(1).sub(rAligned))));
      });
      const w = tune.edge.add(tune.coreSoft.mul(c)).add(shortM.div(aaW).mul(tune.aa)).min(float(0.5)).toVar();
      const thr = c.mul(w.mul(2).add(1)).sub(w);
      const laceSharp = clamp(thr.sub(tex).div(w.mul(2)).add(0.5), float(0), float(1));
      const veilSharp = clamp(c.mul(float(1).sub(tex).pow(1.5).mul(1.4).add(0.15)), float(0), float(1));
      const grazeK = smoothstep(tune.grazeLo, tune.grazeHi, longM.div(max(shortM, float(1e-4))));
      // Where G carries the body the veil takes `layVeil` (round 6).
      const share = mix(mix(tune.veilShare, layVeilH, gShare), tune.veilGraze, grazeK).mul(smoothstep(float(0.08), float(0.5), c)).toVar();
      const drawnSharp = mix(laceSharp, veilSharp, share);
      const mLo = thr.sub(w).clamp(float(0), float(1));
      const mHi = thr.add(w).clamp(float(0), float(1));
      const hiEdge = thr.add(w);
      const laceMean = mLo.add(hiEdge.sub(mLo).pow(2).sub(hiEdge.sub(mHi).pow(2)).div(w.mul(4)));
      const veilMean = c.mul(0.15 + 1.4 / 2.5).min(float(1));
      const drawnLace = mix(mix(laceMean, veilMean, share), drawnSharp, resolved).toVar();

      const drawn = drawnLace.toVar();
      // THE SKIRT (round 10): a veil from the coarse store round every
      // patch, in world space. Uniform branch.
      If(tune.skirt.greaterThan(float(0)), () => {
        const fSk = d1.t.x.mul(d1.w);
        // The grain: the SMALL bubble cells' walls and the streaks (the
        // fourth tile, 0.45 m cells, 3 px from above), so the veil is a fine
        // scatter of bubbles combed along the wind, not a haze; the lace's
        // own texture drew the 1.8 m cells as a large net (sweep c6).
        const grainRaw = max(float(1).sub(smoothstep(float(0.05), float(0.5), lay.cellS)),
          float(1).sub(smoothstep(float(0.1), float(0.7), lay.streak)).mul(0.8));
        const grainK = mix(float(1), grainRaw, tune.skirtGrain);
        // THE SKIRT IS THE UNRESOLVED BUBBLES: where a bubble is over
        // skirtPx pixels on screen (the near water at eye level, 5 to 15 px)
        // the lace draws them itself and the veil would be a milky haze over
        // resolved water (sweep c5), so it fades out, as the fringe does
        // (`fringePx`): a key on a texture's size on screen, the same foam.
        const skSmall = float(1).sub(smoothstep(tune.skirtPx, tune.skirtPx.mul(2), cellsPx(dotM, dotM)));
        const skK = tune.skirt.mul(mix(float(1), float(1).sub(freshA), tune.skirtOld)).mul(skSmall);
        drawn.assign(max(drawn, smoothstep(tune.skirt0, tune.skirt1, fSk).mul(skK).mul(grainK).mul(farK)));
      });

      // Debug: 1 coverage, 2 the lace value, 3 the breaker B, 4 the age,
      // 5 the crest, 6 the fold here (ungated), 7 F over its cap, 8 the
      // fold here on the lay ramp (what the store lays in place), 9 G
      // over its cap, 10 the freshness A (round 9).
      const dbg = tune.debug;
      const alpha = select(dbg.greaterThan(float(9.5)), aAmt,
        select(dbg.greaterThan(float(8.5)), gAmt.div(tune.fMax),
        select(dbg.greaterThan(float(7.5)), smoothstep(tune.layLo, tune.layHi, deficit.mul(g)),
        select(dbg.greaterThan(float(6.5)), fAmt.div(tune.fMax),
        select(dbg.greaterThan(float(5.5)), smoothstep(iLo, iHi, deficit.mul(g)),
        select(dbg.greaterThan(float(4.5)), crest,
        select(dbg.greaterThan(float(3.5)), ageL,
        select(dbg.greaterThan(float(2.5)), breakerHere,
          select(dbg.greaterThan(float(1.5)), tex,
            select(dbg.greaterThan(float(0.5)), c, drawn))))))))));

      // THE LIGHT ON FOAM. Fresh foam is white and old foam grey: a core
      // and a young trail return the most, the drained old lace the least.
      // Foam on a crest faces the bright deck and is lit more than foam in a
      // trough, and a face tilted away from the zenith less: a judge found
      // "the white inside each patch is flat and does not respond to light
      // or wave tilt". Read from the wind sea and the swell here (height
      // over Hs, and the slope).
      // The front and the head are the freshest foam: white, and not
      // darkened by the grain.
      const coreShare = max(cFold, cHead).toVar();
      const fresh = max(coreShare, float(1).sub(ageL)).toVar();
      const shape = mix(tune.troughLight, float(1.06), crest).mul(mix(float(0.8), float(1.03), smoothstep(float(0.86), float(0.995), upness)));
      const grain = mix(tune.texBright, float(1), float(1).sub(mix(float(0.5), tex, resolved)));
      const deck = deckRO.element(int(0));
      const deckLight = deck.mul(tune.deckRatio).div(SURFACE_FOAM_NO_SUN);
      // THE FOAM'S LIGHT UNDER A STRATUS DECK (round 11, law 2;
      // `foamDeckFoamGain`): where the sky has a deck, the Lambertian
      // radiance of the dome's whole light and the sun's unscattered share
      // over the surface's foam base, computed once a step (the deck kernel,
      // cell 1), in place of the deck's mean light over the clear day's
      // (`airGain`, mouth round 6). With no deck at build time the node is
      // the constant 1 it was, so no other scene changes.
      const deckL = oceanSkyDeckLight(uOvercast);
      let deckFoamK: TslNode = deckL.airGain;
      if (deckIsSet(deckL)) {
        // Each foam facet by its own normal (the read's wind-sea and swell
        // slope, the same the shape term reads): the dome it sees,
        // (1 + n.y) / 2 of a flat surface's, and the sun on it, n.l
        // (`foamDeckFoamGain`); over the surface's base at that n.l.
        const nF = vec3(slope.x, float(1), slope.y).normalize();
        const ndlF = max(nF.dot(uSun), float(0));
        const sdF = deckL.sunDirect;
        const kF = deckRO.element(int(1)).mul(nF.y.add(1).mul(0.5)).add(deckRO.element(int(2)).mul(ndlF))
          .div(float(0.7).add(ndlF.mul(sdF).mul(0.3)));
        deckFoamK = select(deckRO.element(int(3)).greaterThan(float(0.5)), kF, float(1));
      }
      const bright = mix(tune.brightThin, float(1), fresh).mul(mix(grain, tune.coreBright, coreShare)).mul(shape)
        .mul(mix(float(1), deckLight, uOvercast)).mul(deckFoamK).toVar();
      // BRIGHT CORES, DIM TAILS (round 8, `tailDim`): the light falls with
      // the trail's coverage, to 1 - tailDim at 0.15 and full at tailC1,
      // at every angle; the cores (coverage 1) keep their light.
      If(tune.tailDim.greaterThan(float(0)), () => {
        bright.mulAssign(mix(float(1).sub(tune.tailDim), float(1), smoothstep(float(0.15), tune.tailC1, cTrail)));
      });
      // BRIGHT FRESH, DIM OLD (round 9, `ageLight`): the light falls to
      // 1 - ageLight where the freshness A is gone, by the foam's own age
      // in world space, not by its coverage (round 8's `tailDim`, which
      // dimmed the thin fresh flecks at eye level); the cores keep theirs.
      If(tune.ageClock.greaterThan(float(0)).and(tune.ageLight.greaterThan(float(0))), () => {
        const fr = select(tune.ageOnBody.greaterThan(float(0.5)), freshW, freshA);
        bright.mulAssign(mix(mix(float(1).sub(tune.ageLight), float(1), fr), float(1), coreShare));
      });
      // FRESH IS BRIGHTER (round 10, `freshBright`): by the freshness A,
      // in world space. Uniform branch.
      If(tune.freshBright.greaterThan(float(0)), () => {
        bright.mulAssign(float(1).add(tune.freshBright.mul(freshA)));
      });
      alphaV.assign(alpha);
      brightV.assign(bright);
      }).Else(() => {
        alphaV.assign(smoothstep(float(0.6), float(0.38), float(1).sub(deficit)));
      });
      return { alpha: alphaV, bright: brightV };
    },
  };
  return reader;
}
