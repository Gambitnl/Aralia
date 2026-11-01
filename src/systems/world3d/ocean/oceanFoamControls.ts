/**
 * @file Foam controls: the original uniform objects for the field and surface reader.
 * The factory creates these at the same setup point and shares their references as before.
 * Every default and experiment note is retained; no foam rule is retuned.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 04:08:32
 * Dependents: systems/world3d/ocean/oceanFoam.ts, systems/world3d/ocean/oceanFoamReader.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { uniform } from 'three/tsl';
import { FOAM_SWELL_MODULATION, FOAM_BREAKER_GATE_LO, FOAM_BREAKER_GATE_HI, FOAM_LOTTERY_GAIN, FOAM_LAY_LO, FOAM_LAY_HI, FOAM_LAY_TEX, FOAM_SEED_TEX, FOAM_SEED_LO, FOAM_SEED_HI, FOAM_DT_S, FOAM_LAY_TAU_S, FOAM_CURL_PX_LO, FOAM_CURL_PX_HI, FOAM_AGE_TAU_S, FOAM_AGE_B0, FOAM_AGE_B1, FOAM_BREAKER_TURN_RAD, FOAM_SEG_DEPTH, FOAM_SEG_LO, FOAM_SEG_HI, FOAM_SEG_ACROSS_M, FOAM_SEG_ALONG_M, FOAM_BREAKER_CURVE_RAD, FOAM_BREAKER_LIFE_VAR, FOAM_DEPOSIT_POW, FOAM_FOLD_LAY, FOAM_VEIL_SHARE, FOAM_DEFICIT_LO, FOAM_DEFICIT_HI, FOAM_TAU_S, FOAM_BREAKER_TAU_S, FOAM_RESIDUAL_TAU_S, FOAM_RESIDUAL_YIELD, FOAM_DIFFUSION_M2S, FOAM_PRODUCTION_PER_S, FOAM_MAX } from './oceanFoamMath';

export function createFoamControls(FOAM_DECK_RATIO: number) {

  const tune = {
    modulation: uniform(FOAM_SWELL_MODULATION),
    // Weights of the fold deficits: the wind sea's own, and every shorter
    // foam cascade's (the ripple). Both 1 sums them as the surface does.
    wWind: uniform(1),
    wShort: uniform(1),
    // The wind sea's own fold (times the swell gain) a fold must ride on to
    // start a breaker: see FOAM_BREAKER_GATE_LO.
    gateLo: uniform(FOAM_BREAKER_GATE_LO),
    gateHi: uniform(FOAM_BREAKER_GATE_HI),
    // Round 10: 0.4 (FOAM_GROUP_GAIN 0.3 is round 9's): the whitecaps
    // gather in the wave groups' maxima with open sea between them (sweep
    // c4 to c9; at 0.8 the eye-level near water flooded with flecks).
    groupGain: uniform(0.4),
    // 1: a steep wind-sea crest starts a breaker on its own; 0: only where a fold rides it.
    gateAlone: uniform(1),
    // Coverage from F: c = smoothstep(cov0, cov1, F). 0.4 (round 4, second
    // pass): at 0.15 every texel the store held over 0.15 drew as the same
    // dense lace, so the drawn foam covered 4.1% of the high view's pixels
    // over 100 sRGB against the reference's 1.7% ("one flat gray"); at 0.4
    // it is 3.2% and a trail thins along its length as F decays (0.5 lost
    // the fringes). At 0.1 the thin halo round old patches drew a net of
    // lines over the near water at eye level.
    cov0: uniform(0.4),
    cov1: uniform(1),
    // The residual's coverage ramp and its ceiling: see FOAM_RESIDUAL_TAU_S.
    res0: uniform(0.12),
    res1: uniform(0.6),
    resMax: uniform(0.1),
    // THE ROUND-4 LOOK (see `shade`). The meter-scale modulation of the
    // coverage: `mid` by the clump (a patch thicker and thinner), `holes` by
    // the coarse network in old foam. mid 0.9 (second pass): at 0.6 a patch
    // was one density from its core to its edge; the reference's patches
    // have a dense center band and loose edges.
    mid: uniform(0.9),
    holes: uniform(0.7),
    // How much the lace's soft edge widens at full coverage.
    coreSoft: uniform(0.08),
    // The head: B from coreB0 to coreB1 draws it at up to coreBW, where the
    // foam under it has reached headF0 to headF1.
    coreB0: uniform(0.1),
    coreB1: uniform(0.8),
    coreBW: uniform(1),
    headF0: uniform(0.2),
    headF1: uniform(1.0),
    // B from foldGate0 to foldGate1 lets the fold here draw, near the camera.
    foldGate0: uniform(0.02),
    foldGate1: uniform(0.25),
    // Where the lace is lost (`farU`): the coverage ramp runs to covFar1;
    // the strands at farScale times their size tear the foam by farTear;
    // the coverage is farCov of itself, and farTrough of that off a crest.
    // farCov 1.2 and farTrough 0.4: at 0.6 and 0.55 the far whitecaps of the
    // eye-level view were faint grey smears, "no foam on the crests".
    covFar1: uniform(1.9),
    farScale: uniform(8),
    farTear: uniform(0.8),
    // THE ROLLER'S FRESH FOAM IS THE CREST (mouth round 3, landed as a law 2026-10-12): the far tear models an OLD
    // whitecap trail seen far off; foam a breaker laid fresh is the crest itself, so it keeps its body coverage
    // at every range. 1 = the law; a capture rig may route 0 for the round-10 control.
    freshWhole: uniform(1),
    farCov: uniform(1.2),
    farTrough: uniform(0.4),
    // The light on foam in a trough, against a crest's 1.06.
    troughLight: uniform(0.78),
    // Step side: the breaker lottery's gain (FOAM_LOTTERY_GAIN), and the
    // share of a fold that lays foam where it is (0: only the breaker lays),
    // on its own ramp `layLo` to `layHi` (FOAM_FOLD_LAY, FOAM_LAY_LO/HI).
    lottery: uniform(FOAM_LOTTERY_GAIN),
    layLo: uniform(FOAM_LAY_LO),
    layHi: uniform(FOAM_LAY_HI),
    // How much the breaker's deposit follows the fold under it
    // (FOAM_LAY_TEX): 0 lays the whole gate blob, 1 lays only where the
    // crest folds under the breaker.
    layTex: uniform(FOAM_LAY_TEX),
    // How much the breaker's seed follows the fold's crackle
    // (FOAM_SEED_TEX): 0 seeds the smooth gate blob.
    seedTex: uniform(FOAM_SEED_TEX),
    seedLo: uniform(FOAM_SEED_LO),
    seedHi: uniform(FOAM_SEED_HI),
    // The fold-laid field G's decay a step (FOAM_LAY_TAU_S).
    layDecay: uniform(Math.exp(-FOAM_DT_S / FOAM_LAY_TAU_S)),
    // Read side: G's coverage ramp, its cap, and how much its thinness
    // ages it (holes, the old lace, less light). The cap 0.6 (0.7 in the
    // sweeps q4 to q10): the reference's masses from above are mid-gray
    // (the 90th percentile of the judged crop 46 sRGB); at 0.7 ours were
    // denser (52), at 0.6 46 to 49 (q11).
    // Round 8: the ramp's top 1.5 (1.2 in round 6, 0.8 from above in
    // round 7) and the cap 0.9 at every angle: a narrow ramp saturated the
    // whole mass to one coverage (the "flat stencil" of the round-7
    // verdict); the wide one grades each mass from a dense core where G
    // is fresh to a sparse edge where it has faded.
    layCov0: uniform(0.25),
    layCov1: uniform(1.5),
    layCap: uniform(0.9),
    layAge: uniform(1),
    // The veil's share of the draw where G carries the body: the
    // reference's masses are a soft fibrous veil, and the threshold lace
    // alone drew G as crackle (sweep q4). 0.65 (round 6); 0.8 was no
    // softer to the eye (q11 D3), and at veilShare (0.25) the masses were
    // crackle.
    // 0.35 since round 8 (0.65 in round 6): through the wisp-led fine
    // texture a lower veil share keeps the masses fibrous, not a haze.
    // 0.45 in round 9 (r9h V): through the hair the masses are streaky
    // threads, and a little more veil gives them the reference's soft
    // body between the threads.
    layVeil: uniform(0.45),
    // THE CURL GRAIN (round 6, FOAM_LACE_CURL): 1 draws the curls where
    // the aligned fibers are narrower than curlPxLo to curlPxHi pixels;
    // 0 draws the aligned fibers everywhere (round 4).
    curl: uniform(1),
    curlPxLo: uniform(FOAM_CURL_PX_LO),
    curlPxHi: uniform(FOAM_CURL_PX_HI),
    // Read side: the head's breaking front drawn on the lay ramp, gated by
    // the breaker as the fold is, at this weight over the fold on the
    // breaker's ramp (0: round 4, the peak of the fold only). 1 (round 6):
    // a crackled crest line at the head of each patch from above (0.33%
    // of the judged pixels, q12), nothing at eye level (0.002%).
    headLay: uniform(1),
    // THE VIEW FROM ABOVE (round 7, keyed on `uAbove`, the view's pitch):
    // the head's disc draws at headAbove of its coverage (1: round 6),
    // the crest line under the breaker at headLine of full coverage
    // (0: round 6, the line at the fold's `instW`), and the lace takes
    // the wisps (FOAM_LACE_WISP) at wisp 1 (0: round 6).
    // ROUND 8 (GG-311): the pitch-keyed paths ship at their off values;
    // round 7's values were headAbove 0.5, headLine 0.7, wisp 1,
    // gCapAbove 0.2, gCov1Above -0.4, gVeilAbove -0.3, bodyAbove 0.5,
    // dustAbove 0.4 (foam/finalCaptures8.sh sets them for the off-state
    // check, which reproduces foamR7 to the pixel).
    headAbove: uniform(1),
    headLine: uniform(0),
    wisp: uniform(0),
    // The wisps take the fringe: their table blends in where the trail's
    // coverage is under wispC0 to wispC1.
    wispC0: uniform(0.45),
    wispC1: uniform(0.85),
    // G CARRIES THE VIEW FROM ABOVE (round 7, deltas from round 6, each
    // 0 for round 6 exactly): G's cap, its ramp top and its veil share
    // from above; how much of the breaker trails' body is taken away
    // from above; and the crest crackle with no breaker under it, at this
    // coverage from above (the dusting).
    // Judged values (round 7, sweep r7e E2): the crop from above then has
    // 1.67% of its pixels 70 sRGB over the water's median against the
    // reference's 1.71%, and p99 116 against 111 (foam/lumstats.py).
    // headLine 0.7 and dustAbove 0.4: at 1 and 0.5 the crest lines drew
    // as solid white blobs on the lace (r7d E against r7e E2 at 2x).
    gCapAbove: uniform(0),
    gCov1Above: uniform(0),
    gVeilAbove: uniform(0),
    bodyAbove: uniform(0),
    dustAbove: uniform(0),
    // ROUND 8, AT EVERY ANGLE (GG-311: no pitch key), each 0 for round 7
    // exactly: the crest line under a breaker at lineCov of full coverage;
    // every crest folding on the lay ramp at dust of full coverage with no
    // breaker under it (the small breaks); the head's disc shaped by the
    // fold under it (headShape); the light on thin foam at 1 - tailDim
    // where the trail's coverage is 0.15, full at tailC1; the fringe's
    // threshold texture (bubbles and wisps, FOAM_LACE_FRINGE) where the
    // trail's coverage is under fringeC0 to fringeC1; and the wisps keyed
    // on the aligned fibers' width on screen instead of the pitch.
    // Shipped (round 8, sweeps r8a to r8d): lineCov 0.7 and dust 0.5 (at
    // 0.9 and 1.0 the cores drew as solid white chunks, coverage past
    // 0.85 being solid by design); headShape 0.6; tailDim 0 (it cost the
    // eye-level near flecks; the coverage gradient sparses the tails);
    // fringe 1 where a bubble is under 2.5 px.
    lineCov: uniform(0.7),
    dust: uniform(0.5),
    headShape: uniform(0.6),
    tailDim: uniform(0),
    tailC1: uniform(0.9),
    fringe: uniform(1),
    fringeC0: uniform(0.3),
    fringeC1: uniform(0.7),
    // The fringe draws where a bubble's radius is under fringePx pixels
    // on screen, off over twice that: from above (1 px) the scatter, on
    // the near water at eye level (5 to 15 px) the lace's own fibers, as
    // round 7 drew them.
    fringePx: uniform(2.5),
    wispRes: uniform(0),
    // THE FINE REGIME (round 8, FOAM_LACE_YOUNG_FINE): where the aligned
    // fibers are under 3 px wide, the wisps carry the grain and the
    // anti-aliasing is sized to their width. 0: round 7.
    fine: uniform(1),
    // ROUND 9: THE HAIR AND THE AGE CLOCK, each 0 for round 8 exactly.
    // `hair` 1: in the fine regime the threshold texture is the hair
    // tables (FOAM_LACE_HAIR, its own tile, one fetch) in place of round
    // 8's fine tables, whose 2 m wisp lattice drew "one large cellular
    // lace at one scale" from above; `hairFringe` 1: the fringe's texture
    // is the hair alone (FOAM_LACE_FRINGE_HAIR) where the hair is fetched,
    // in place of the bubbles, "a uniform speckle stipple".
    hair: uniform(1),
    hairFringe: uniform(1),
    // `ageClock` 1: the store keeps the freshness A (FOAM_AGE_TAU_S), set
    // where the breaker is (ageB0 to ageB1 of B) and decaying in place;
    // the read grades by freshA = smoothstep(ageA0, ageA1, A): the light
    // of the trail's body falls to 1 - ageLight where A is 0 (the cores
    // keep theirs), its coverage to 1 - ageCov of itself, and its lace
    // takes the old table by ageTex. Step side: ageClock, ageDecay, ageB0,
    // ageB1 rebuild the store.
    // Shipped (round 9, sweeps r9c to r9i): freshA from A 0.05 to 0.7;
    // the light to 0.65 where old (0.5 left the old windrows too dim
    // against the reference's soft scatter, r9h against r9i W2); the
    // coverage to 0.6; the old lace in full.
    ageClock: uniform(1),
    ageDecay: uniform(Math.exp(-FOAM_DT_S / FOAM_AGE_TAU_S)),
    ageB0: uniform(FOAM_AGE_B0),
    ageB1: uniform(FOAM_AGE_B1),
    ageA0: uniform(0.05),
    ageA1: uniform(0.7),
    // Round 10: 0.5 (0.35 in round 9), with `freshBright` 0.4: old foam
    // dimmer and fresh foam brighter, the verdicts' "one flat mid-gray".
    ageLight: uniform(0.5),
    ageCov: uniform(0.4),
    ageTex: uniform(1),
    // THE HEAD TAKES THE CREST'S MASS (round 9, `headG`): the breaker B is
    // the wind sea's smooth gate blob, 15 to 30 m across on the storm, and
    // the head drawn at coverage 1 over the whole blob was the "oval" of
    // every verdict from above (round 7 halved it from above by the pitch
    // key). The fold-laid G under the head has the crest's own crackled
    // shape, so the head keeps 1 - headG of itself where G is under
    // headG0 and all of itself where G is over headG1. 0: round 8.
    // Shipped 0.8 (r9b to r9i): on its own it moved little, since the
    // saturated trail body under the head draws anyway, but the head's
    // rim now follows the crest's mass where the body is torn.
    headG: uniform(0.8),
    headG0: uniform(0.15),
    headG1: uniform(0.6),
    // OLD FOAM IS TORN INTO WINDROWS (round 9, FOAM_TEAR_ACROSS_M,
    // `foamTearNoise`): the body's coverage loses up to rowTear of itself
    // between the streaks where the freshness is gone; the streaks are
    // where the tear noise is over tearHi, the gaps under tearLo. 0: round 8.
    // Shipped 0.9: with the halo (below) the old trails from above are
    // three or four long thin windrows each (sweeps r9f to r9i), the
    // "long thin windrows" of the round-8 verdict; at 0.7 the gaps were
    // faint.
    rowTear: uniform(0.9),
    tearLo: uniform(-0.3),
    tearHi: uniform(0.3),
    // THE BODY AND THE HEAD AT EVERY ANGLE (round 9): the trail's body
    // (F through its ramp) at bodyScale of its coverage and the head's
    // disc at headScale, at every angle. Round 7 halved both from above
    // by the pitch key (GG-311) and the ovals went; a read-side scale
    // keeps F, so the eye-level near flecks (F 0.5 to 1, under the ramp's
    // top) stay, lacier. 1 and 1: round 8.
    bodyScale: uniform(1),
    headScale: uniform(1),
    // The age effects act on the whole body after G joins it (1), so G's
    // backfill under a trail is aged too; G's own density is its clock
    // (fresh over ageG1, old under ageG0). 0: F's body alone (round 9's
    // first form).
    ageOnBody: uniform(0),
    ageG0: uniform(0.3),
    ageG1: uniform(1.2),
    // THE HALO (round 9): F under the body ramp's foot (cov0 0.4), the
    // spread's skirt round a trail and every trail older than 11 s, drew
    // nothing, so a patch's outline was the 1 to 2 m band where F
    // crosses 0.4 (the "oval") and the sea between the patches was bare;
    // the reference's masses feather over 5 to 15 m of falling filament
    // density and its water is strewn with sparse old wisps. The halo
    // draws F from halo0 to halo1 at up to `halo` coverage, the larger of
    // it and the body's ramp, so F over 0.5 (the eye-level near flecks)
    // keeps its coverage; through the hair fringe the halo is loose
    // hairs, and the age clock dims and tears the old ones. 0: round 8.
    // Shipped 0.5 (r9f to r9i): at 0.4 the old windrows from above were
    // faint scratches beside the reference's soft scatter; at every
    // trail (haloOld 0) 0.4 flooded the eye-level near water with lace
    // (over median+50: 1.35% to 4.6%, sweep r9f), the round-4 "net of
    // lines", because the near water lies under FRESH trails' skirts.
    halo: uniform(0.5),
    halo0: uniform(0.1),
    halo1: uniform(0.5),
    // How much of the halo belongs to OLD foam only: at 1 the halo is
    // (1 - freshness) of itself, so a fresh trail keeps its compact
    // outline (fresh foam is thick and compact; it spreads as it dies)
    // and only the dying trails feather and streak. 0: every trail.
    // Shipped 0.75: a fresh raft keeps a quarter of the halo, a few loose
    // hairs round its edge, and the eye-level near water is unchanged
    // (r9i W1 against V: over median+15, 8.12% against 7.90%).
    haloOld: uniform(0.75),
    // The hair regime's anti-aliasing is sized to hairAA of the long
    // hair's width: under 1 the threshold's soft edge widens and the felt
    // is softer, as the reference's filaments are. Shipped 0.6 (r9h S
    // against F at 2x: the threads lose their hard edge).
    hairAA: uniform(0.6),
    // ROUND 10, each 0 for round 9 exactly (uniform branches).
    // `cells` 1: where the hair is read (the aligned fibers under 3 px wide
    // on screen) the threshold texture is the bubble cells and the streaks
    // (FOAM_LACE_YOUNG_CELLS, FOAM_LACE_OLD_CELLS, FOAM_LACE_FRINGE_CELLS,
    // the fourth tile) in place of the hair, and the anti-aliasing is sized
    // to `cellAAm` meters.
    cells: uniform(1),
    cellAAm: uniform(0.18),
    // `warp` m: the store is read at a point moved along the wind by value
    // noise `warpLenA` m along and `warpLenB` m across (and `warpX` m across
    // the wind on a coarser noise), so a patch's outline is combed into
    // strands of its own foam along the wind and its sides are irregular,
    // in world space; the interior, where F is high all round, keeps its
    // coverage. 0: round 9.
    // Shipped (sweeps c1 to c9): 1.5 m along on noise 14 m by 2.5 m and 2 m
    // across; at 4 m on 8 m by 1.2 m the ends were spiky flames.
    warp: uniform(1.5),
    warpX: uniform(2),
    warpLenA: uniform(14),
    warpLenB: uniform(2.5),
    // `freshBright`: the body's light times 1 + freshBright x the
    // freshness A, so a fresh raft is brighter than an old one by the
    // foam's own age (the round-9 light fell only for old foam). 0: round 9.
    freshBright: uniform(0.4),
    // THE SKIRT (round 10, `skirt`): the reference's masses feather over 5
    // to 15 m into a see-through veil; ours stopped at the lace threshold's
    // edge, "hard, thresholded-noise edges". The coarse level's F (2 m
    // texels, the spread's own blur) from skirt0 to skirt1 draws a veil of
    // up to `skirt` alpha, grained by the lace (`skirtGrain`), the larger
    // of it and the drawn lace. 0: round 9.
    // Shipped (sweeps c3 to c9): 0.45 from F 0.03 to 0.7, grained in full.
    skirt: uniform(0.45),
    skirt0: uniform(0.03),
    skirt1: uniform(0.7),
    skirtGrain: uniform(1),
    // How much of the skirt belongs to OLD foam only (the freshness A):
    // at 1 a fresh raft has none, so the near water at eye level, which lies
    // under fresh trails, keeps round 9's crisp flecks.
    // Shipped 0.5: a fresh raft keeps half its skirt.
    skirtOld: uniform(0.5),
    // The bubble's radius on screen, px, over which the skirt fades out.
    // Shipped 1.5 (off by 3 px): at 2.5 the skirt drew a speckled net
    // over the eye-level water 20 to 40 m out (sweep c7).
    skirtPx: uniform(1.5),
    breakerTurn: uniform(FOAM_BREAKER_TURN_RAD),
    // THE CREST SEGMENT (round 7, FOAM_SEG_*): the gate's argument is cut
    // by up to segDepth where the segment field (fine across the wind at
    // segAcross m, coarse along it at segAlong m, in the breakers' frame)
    // is under segLo, uncut over segHi. 0 leaves the store as round 6.
    segDepth: uniform(FOAM_SEG_DEPTH),
    segLo: uniform(FOAM_SEG_LO),
    segHi: uniform(FOAM_SEG_HI),
    segAcross: uniform(FOAM_SEG_ACROSS_M),
    segAlong: uniform(FOAM_SEG_ALONG_M),
    // THE CURVE (round 7, FOAM_BREAKER_CURVE_RAD): the heading's term read
    // in label space, so a trail bends along its run. 0: round 6.
    curve: uniform(FOAM_BREAKER_CURVE_RAD),
    // Each breaker's own life, as a power of two on the lottery noise
    // (FOAM_BREAKER_LIFE_VAR): 0 gives every breaker the same life.
    lifeVar: uniform(FOAM_BREAKER_LIFE_VAR),
    // The deposit's power on the breaker's strength (FOAM_DEPOSIT_POW).
    depositPow: uniform(FOAM_DEPOSIT_POW),
    inPlace: uniform(FOAM_FOLD_LAY),
    // The veil's share of the drawn foam: FOAM_VEIL_SHARE.
    veilShare: uniform(FOAM_VEIL_SHARE),
    // AT A GRAZING VIEW A WHITECAP IS A VEIL (round 4, second pass). Seen
    // from eye level a breaking crest is a churning mass of bubbles, not a
    // lace lying flat, and the reference draws its mid-distance whitecaps
    // as soft streaky white on the crest face; ours drew a crisp lace
    // lozenge there, "stickers lying on the sea" (a round-3 judge). Where
    // the footprint is grazeLo to grazeHi times longer than wide, the veil
    // takes veilGraze of the draw. From above the ratio is near 1 (72
    // degrees down: 1.05), on the near water at eye level under 2, at the
    // mid distance about 6.
    veilGraze: uniform(0.75),
    grazeLo: uniform(2.5),
    grazeHi: uniform(5),
    // The most coverage a pixel reaches. The reference's densest foam keeps
    // dark specks; at 1 the lace goes solid (`foamLaceAlpha` at c = 1).
    cScale: uniform(0.85),
    // THE HEAD IS SOLID (round 4, second pass): at coreFull 1 the head's
    // coverage runs past cScale to 1, so the breaking front is a near-opaque
    // white with the clump's few specks, and coreBright lifts its light over
    // the trail's. Both round-3 judges asked for "a near-opaque white core
    // at the breaking front" that thins downwind.
    coreFull: uniform(1),
    coreBright: uniform(1.2),
    deficitLo: uniform(FOAM_DEFICIT_LO),
    deficitHi: uniform(FOAM_DEFICIT_HI),
    decay: uniform(Math.exp(-FOAM_DT_S / FOAM_TAU_S)),
    breakerDecay: uniform(Math.exp(-FOAM_DT_S / FOAM_BREAKER_TAU_S)),
    residualDecay: uniform(Math.exp(-FOAM_DT_S / FOAM_RESIDUAL_TAU_S)),
    residualYield: uniform(FOAM_RESIDUAL_YIELD),
    diffusion: uniform(FOAM_DIFFUSION_M2S),
    prodPerStep: uniform(FOAM_PRODUCTION_PER_S * FOAM_DT_S),
    fMax: uniform(FOAM_MAX),
    // Read side.
    deckRatio: uniform(FOAM_DECK_RATIO),
    // Weight of the active fold drawn at the pixel's own resolution, over
    // the store. At 1 the fold drew solid single-pixel flecks (the
    // 'confetti' of GG-280); the store carries the crest a step later.
    instW: uniform(0.5),
    instFar: uniform(0.6),
    // The Beaufort streaks between whitecaps: at 1 they hatched the whole
    // dark water from above, where the reference shows sparse specks. 0.4
    // (round 4, and round 6 again; round 5 tried 0.25 and its judge from
    // above then found "the sea between the patches is dead flat with zero
    // residual foam or wind streaks").
    streakW: uniform(0.4),
    // The windrow lines: their half-width on the |noise| ridge, and how much
    // more foam a line holds than the mean.
    rowWidth: uniform(0.25),
    rowBoost: uniform(1.5),
    // 1 draws the surface's old fold-only ramp and skips the whole read:
    // the perf probe's A/B (see `shade`).
    bypass: uniform(0),
    instWiden: uniform(0.15),
    // THE ROUND-5 CONTROLS (see `shade`), ALL OFF SINCE ROUND 6: thin foam
    // ages (`ageThin`), is torn into islands and holes by the clump channel
    // at `tearScale` times its size (`tear` of the coverage; dense foam
    // `tearDense` as much), the core's rim crumbles on the crackle net
    // (`headTear`), and a fold with no breaker under it draws `foldFree`.
    // Round 5 shipped them at 1, 0.3, 1, 0.3, 0.5, 0.6 and 0.6, and lost
    // both judged views; round 6 restored round 4 (all 0) as its base and
    // works on the source instead (`foldLay`). The paths stay for a probe.
    ageThin: uniform(0),
    tailOld: uniform(0.3),
    tear: uniform(0),
    tearDense: uniform(0.3),
    tearScale: uniform(0.5),
    headTear: uniform(0),
    foldFree: uniform(0),
    // Whether the core (the head and the fold here) takes the clump's
    // `mid` and the net's `holes` with the trail (1, round 4) or stays a
    // whole mass outside them (0, round 5: "copy-like teardrop blobs").
    coreMod: uniform(1),
    // The brightness of old thin foam against fresh (1), and of the
    // texture's holes against its fibers. 0.7 and 0.8 (round 4): at 0.55
    // and 0.72 the old fibers were a dull grey beside the reference's white
    // specks; the fade from fresh to old stays.
    brightThin: uniform(0.7),
    texBright: uniform(0.8),
    // Half-width of the lace's soft edge, on the uniform texture value:
    // the reference's filaments are crisp at 0.15 m a pixel and soft enough
    // not to alias. 0.3 drew a smooth veil; 0.1 a hard stencil.
    edge: uniform(0.08),
    // How much the edge widens per pixel footprint in dot widths: the
    // anti-aliasing. 0.3 smoothed the lace to a veil at 0.15 m a pixel,
    // where the reference sparkles.
    aa: uniform(0.1),
    // 0 shipped; the others draw one term as the alpha, see `shade`.
    debug: uniform(0),
    // ROUND 11 (law 1), read only in a step kernel built with a source that
    // gives `breakerAt`: 1 is the law; 0 is the A/B control (the sea's B and
    // F as round 10 drew them on the same page). `rollerFoam` 0 takes the
    // roller's F floor alone off (`foamRollerFoamFloor`).
    srcBreaker: uniform(1),
    rollerFoam: uniform(1),
    // THE REEF (rocks round 2, folded in by foam round 10): the
    // depth-limited breaking share's weight, read only where the sea has a
    // shelf (oceanBathymetry.ts). 0.4 by the rocks builder's measure: at 1
    // the whole shelf 14 m in front of the daylight camera drew as solid
    // blotches of white, where the references (sl_002 to sl_004, k2) show
    // white water at the rock and its flanks and streaks beyond
    // (rocks/reefProbe.mjs, gains 1, 0.4 and 0.15).
    reefGain: uniform(0.4),
  };
  return tune;
}
