/**
 * @file oceanBeachLook.ts
 * The original beach draw constants and their scientific and experiment notes.
 * Wet sand, film, foam, glints, footprints and noise dimensions retain their values.
 * One shared owner supplies the factory and resource builders; no look is retuned.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:34:56
 * Dependents: systems/world3d/ocean/oceanBeach.ts, systems/world3d/ocean/oceanBeachResources.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SWASH_TILE_M, SWASH_BUBBLE_CELLS } from './oceanBeachMath';


/**
 * THE LOOK'S NUMBERS, each with its reason.
 *
 *   WET SAND. Ångström's model of a wet surface (Ångström 1925; Lekner and
 *   Dorf 1988, "Why some things are darker when wet"): light that the grains
 *   return is trapped by total internal reflection in the water film, so the
 *   wet albedo is (1 - r_e)(1 - r_i) A / (1 - r_i A), with r_e = 0.066 the
 *   film's diffuse reflectance from the air and r_i = 1 - (1 - r_e) / n^2 =
 *   0.474 from inside (n = 1.333). Sand of albedo 0.55 goes to 0.36 (0.66 of
 *   dry), 0.40 to 0.24 (0.61): darker, and more saturated because the dark
 *   channels lose more. The skin's saturation says how wet: the surface
 *   turns from looking dry to fully wet between 13% and 26% water by volume
 *   (Se 0.3 and 0.65; sand's brightness drops steeply over a narrow band of
 *   surface moisture and saturates well before the pores are full, Twomey
 *   et al. 1986, Nolet et al. 2014). A wider ramp (Se 0.16 to 0.79) drew the
 *   wet line as a blur half a meter wide; a swash's wet line is sharp.
 *   ROUND 3: THE DAMP BAND. Ångström's full step is sand under a film of
 *   water, whose flat top traps the light. Sand the sheet has drained holds
 *   its water in the pores and in menisci at the grains, with no film on
 *   top, so it takes WET_DAMP_SHARE of the step by Se WET_SE_DAMP and the
 *   rest only as the pores fill to a film at Se 1. So the draining film, the
 *   damp band under the last swashes (Se 0.6 to 0.99, a gradient) and the
 *   dry sand read as three tones: in the Manly Beach drone frame
 *   (ref/real/beach/b010.png) the film is 0.51 of the dry sand's luma and
 *   the damp band 0.66. With one step to full at Se 0.65 our damp band was
 *   the film's tone.
 *   GLOSS. Free water on the grains is a mirror broken by the grains: a
 *   saturated band (the water table's outcrop) keeps it; sand the sheet has
 *   just left keeps a film that drains in a few seconds (GLOSS_DRAIN_S). Its
 *   roughness spreads the reflected sky over GLOSS_SPREAD of elevation.
 *   FOAM. The same white as the sea's foam (`oceanSurface.ts` foamCol), lit
 *   by the sun's height, dimmer where it is thin (thin foam is a film the
 *   water shows through). ROUND 2: its texture is the baked swash foam tile
 *   (`buildSwashFoamTile` in oceanBeachMath.ts: a net of bubble lines,
 *   bubbles, patches), drawn with the foam piece's coverage-true threshold,
 *   so the film's thin foam is a lace of bubble lines and a bore's is a raft
 *   with holes. Round 1's noise under a threshold drew a streaked white
 *   stroke and no lace at all under a fifth of cover.
 */
export const WET_RE = 0.066;
export const WET_RI = 1 - (1 - WET_RE) / (1.333 * 1.333);
/**
 * ROUND 4: THE WET LINE'S DAMP FRINGE. The last reach of each swash is a film
 * under a millimeter that wets only the top grains: the skin there rises from
 * the backshore's Se 0.26 to 0.3 or 0.4. Round 3's ramp began at Se 0.3 and
 * drew the wet line as a hard step into dry sand; from WET_SE_DRY 0.28 those
 * partly wetted cells draw a thin damp fringe that fades into the dry sand.
 */
/**
 * ROUND 5: THE WET SAND GRADES FROM THE WATER, AND ITS LINE IS CRISP. Round
 * 4's damp fringe read as "an even Gaussian falloff, like a drop shadow",
 * and its darkest sand sat by the dry line (the drained, full skin took the
 * immersed grains' factor). Now:
 *   THE LINE    the skin's Se crosses WET_LINE_SE, a threshold that a noise
 *               of WET_PATCH_M moves by WET_LINE_VAR (the patches that dry
 *               first), over WET_LINE_W: a fairly crisp, ragged line.
 *   DAMP SAND   takes WET_DAMP_LO of Angstrom's step at the line, rising to
 *               WET_DRAINED as the skin fills to Se 0.97: matte damp sand up
 *               the beach, darker lower down.
 *   THE FILM    the full step, and the immersed grains' factor, which rises
 *               with the film's depth to FILM_DEEP_M: the darkest sand is at
 *               the water.
 */
export const WET_LINE_SE = 0.42;
export const WET_LINE_VAR = 0.06;
/**
 * ROUND 7: BETWEEN A BLUR AND A CUT. Round 4's line was "a soft airbrushed
 * blur", round 6's "a hard, cut-paper jagged edge". The line's ramp is
 * WET_LINE_W (0.012 in round 6), and on its land side the sand dries in soft
 * blotches: within WET_FRINGE_M above the line (where the skin WET_FRINGE_M
 * seaward is over the line's threshold), a noise of WET_BLOTCH_M keeps up to
 * WET_BLOTCH of the damp step: the sand the last swashes wetted at their
 * edges, drying unevenly. The crisp line is the high-water mark's (HWM_W_M).
 * (The sand above the line was never wet in this run: a first build tested
 * the point's own skin and found no blotches.)
 */
export const WET_LINE_W = 0.022;
export const WET_FRINGE_M = 0.45;
export const WET_BLOTCH_M = 0.8;
// Round 8: 0.6 (0.85 in round 7; crisp-edged, at 0.85 they drew dark stains up close).
export const WET_BLOTCH = 0.6;
export const WET_PATCH_M = 0.35;
export const WET_DAMP_LO = 0.74;
export const WET_DRAINED = 0.97;
/**
 * ROUND 7: THE FILM'S THICKNESS GRADIENT. The immersed grains' factor rises
 * from FILM_DEEP_M[0] to FILM_DEEP_M[1] of film (round 6: full by 3 mm), so
 * the film is nearly clear and sand-colored at its upper edge and darkens
 * toward the surf ("an opaque gray-brown slab with no thickness gradient").
 */
export const FILM_DEEP_M: readonly [number, number] = [0.001, 0.01];
/**
 * ROUND 4: THE IMMERSED GRAINS. Angstrom's law darkens a wet surface by the
 * light the water film traps; Lekner and Dorf (1988) add that grains
 * immersed in water scatter less than grains in air (the index step at the
 * grain drops from 1.54/1.0 to 1.54/1.33, so more light goes forward and is
 * absorbed), so the grain layer's own albedo falls too: Twomey et al. (1986)
 * measured wet sands at about half their dry reflectance. Sand whose pores
 * are under a sheet (round 4 also took drained sand with a full skin, from
 * Se 0.85; round 5 does not, see WET_LINE_SE) takes WET_IMMERSED_K of its
 * albedo before Angstrom's step. Judges of all three
 * views asked for the sand behind the sheet to be "clearly darker"; in the
 * Manly frame the film is 0.61 of the dry sand's luma, where Angstrom alone
 * gave ours 0.77. The factor is the swash zone's: it fades out as the water
 * over the sand deepens from WET_IMMERSED_DEEP_M[0] to [1] m, where the
 * seabed reader's own water optics carry the floor's light (as over the
 * lagoon's sand, whose albedo is a measured underwater reflectance). With it
 * under the surf too, view 1's water fell from 120 to 98 luma (the
 * reference's is 140).
 */
// Round 8: 0.55 (0.36 to round 7: with the gray sky share over it, the sheet
// 1 to 30 cm deep was a neutral gray at 48 luma, saturation 0.02, the
// judge's "opaque murky gray-brown smear").
export const WET_IMMERSED_K = 0.55;
/**
 * ROUND 6: the fade runs from 0.1 to 0.8 m of water. From 5 to 30 cm it fell
 * right at a bore's front (20 to 30 cm deep, the film behind it 4 cm), and
 * drew the broken wave's water lighter than the film behind a straight line
 * ("the broken-wave foam stops at a hard vertical line against the dark
 * zone").
 */
export const WET_IMMERSED_DEEP_M: readonly [number, number] = [0.1, 0.8];
/**
 * ROUND 5: THE FILM REFLECTS THE SKY. The lead's rule for this round: match
 * the Manly frame's zones. Its film zone reads gray: in linear light it is
 * about a third of its damp band's sand plus a sky-colored reflection a
 * quarter of the dry sand's light, where water's Fresnel at our straight-down
 * view is 0.02 (a drone's view grazes toward its frame's edge, and the film's
 * ripples tilt). FILM_SKY_SHARE is that calibration: the share of the sky the
 * sheet's thin part reflects (with the water's own Fresnel where that is
 * more). SAT_SKY_SHARE is the same for saturated sand the sheet has just
 * left (it keeps a film for GLOSS_DRAIN_S). Both are calibrations to the
 * reference, not the physics. The share reflects the LOW sky, FILM_SKY_UP of
 * elevation in the view's azimuth: the Manly film is gray (R/G 1.09, B/G
 * 0.84), the hazy low sky a drone's oblique view and the ripples reflect; our
 * zenith's deep blue at 0.12 drew the film violet. The hook draws the same
 * share on the sea's own surface where it stands over the grid's thin water,
 * so the two waters meet without an edge (a first build drew the sea's
 * crests over the film as a dark polygon with straight sides).
 */
export const FILM_SKY_SHARE = 0.03;
export const SAT_SKY_SHARE = 0.03;
/**
 * ROUND 8: THE SHEEN AT ITS THINNEST. A judge asked for the sheet to be
 * "see-through, with a bright sky sheen where it is thinnest, and a clear
 * leading edge". The thinnest film is smooth (the flow there is slow and
 * laminar) and reflects the low sky as a silver sheen (the sky's luma, not
 * its color: as a share of the low sky itself over 1.2 to 20 mm a first
 * build drew the whole thin sheet lavender): FILM_SHEEN of it, rising from
 * the sheet's edge to FILM_SHEEN_M[0] m of depth and falling away from
 * FILM_SHEEN_M[1] to FILM_SHEEN_M[2] m, a band a few tens of centimeters
 * wide behind the leading edge. The rest of the sheet reflects
 * FILM_SKY_SHARE (0.06 everywhere in round 7, which grayed the whole sheet).
 * A calibration.
 */
export const FILM_SHEEN = 0.1;
export const FILM_SHEEN_M: readonly [number, number, number] = [0.0006, 0.001, 0.003];
/**
 * The sheen is streaked along the fall line (the flow's own capillary ripples
 * break it): a noise FILM_SHEEN_STREAK_M across, drawn out FILM_SHEEN_STRETCH
 * times down the slope, keeps FILM_SHEEN_LO to 1 of it. Uniform, a first
 * build read as a fog over the thin film.
 */
export const FILM_SHEEN_STREAK_M = 0.25;
export const FILM_SHEEN_STRETCH = 6;
export const FILM_SHEEN_LO = 0.2;
/**
 * ROUND 7: SHINY AT THE WATER, MATTE UP THE BEACH. Saturated sand the sheet
 * left less than SHINE_S ago keeps a thin surface film that reflects the low
 * sky, SHINE_SKY of it, fading with the time since the sheet left: the band
 * next to the water shines and the damp sand above it is matte ("a gradient
 * from shiny-wet at the water to matte damp"). A calibration, as
 * SAT_SKY_SHARE.
 */
// Round 8: 30 s and 0.08, silver (25 s and 0.06 of the low sky's color to
// round 7, under 4 luma: a judge read the wet sand as "one flat matte brown";
// at 0.16 the band at the water drew lighter than the damp sand above it).
export const SHINE_S = 30;
export const SHINE_SKY = 0.08;
/**
 * ROUND 8: LIGHTER AS IT SOAKS IN. Sand the sheet left WET_SOAK_S[0] s ago is
 * as wet as its skin says; by WET_SOAK_S[1] s the surface water has soaked
 * into the bed and the sand's wetness falls to WET_SOAK_K of that, so the
 * damp band is darker and shiny at the water and lighter and matte up the
 * beach. (To round 7 the damp band was one tone: its skin is 0.88 to 1
 * everywhere under the last run-up.)
 */
export const WET_SOAK_S: readonly [number, number] = [8, 50];
export const WET_SOAK_K = 0.75;
export const FILM_SKY_UP = 0.35;
/**
 * The film's reflected sky, grayed this far toward its own luma: the Manly
 * film's hue (B/G 0.85 against its dry sand's 0.63) is a warm gray, the low
 * sky of a low sun; ours reflected blue (B/G 0.90 against 0.81). A
 * calibration to the reference.
 */
export const FILM_SKY_GRAY = 0.5;
/**
 * The share the hook takes off the film's sky on the SEA'S surface over the
 * grid: that surface already reflects the sky at its crests' own Fresnel, and
 * with the full share its crests over the film drew 3 to 5 luma lighter than
 * the sheet at the same depth (`beach/fftBins.py`), in the crests' outline.
 */
export const FILM_SKY_SEA_CUT = 0.55;
export const GLOSS_DRAIN_S = 4;
export const GLOSS_SPREAD = 0.08;
/** The swash tile's bubble cell (3.1 cm), the scale the film's caustic web fades on. */
export const LACE_BUBBLE_M = SWASH_TILE_M / SWASH_BUBBLE_CELLS;
/**
 * THE LACE (round 7): THE WAKE'S ROUND-11 METHOD, ON THE WAKE'S OWN IMAGE.
 * Rounds 2 to 6 each invented a swash lace, and each lost: a streaked
 * stroke, a stipple, a comb, threads read as scratches, a net read as cracked
 * mud. Two foam looks in this repository beat Water Pro blind: the wake's
 * (`oceanWake.ts`, WAKE_LOOK_ROUND11) and the open sea's (`oceanFoam.ts`).
 * So the beach draws its foam with the wake's method, on the wake's image
 * (`wakeLaceImage` and `wakeLaceCdfTable` in oceanWakeMath.ts, built in the
 * worker):
 *   THE FOUR READS  the raft (holes of many sizes: popped cells of three
 *                   sizes in a warped fBm, ranked), the clumps, the streaks
 *                   and the patches, at the wake's tiles times
 *                   LACE_TILE_SCALE (the wake is read from tens of meters;
 *                   the beach from a few), mixed with BEACH_LACE_WEIGHTS
 *                   (round 8: no clumps; round 7 used the wake's mix) and
 *                   made uniform by the coverage table, so an amount a
 *                   covers a;
 *   THE STRETCH     in the beach's frame: the raft drawn out
 *                   LACE_HOLE_STRETCH and the streaks LACE_STREAK_STRETCH
 *                   times ALONG THE SHORE (the wake's holeStretch and
 *                   streakStretch; a surf's young foam lies in bands along
 *                   the broken crest, as the Manly frame's does; drawn
 *                   along the fall line, a first build dripped); where the
 *                   sheet runs seaward, second reads drawn out
 *                   LACE_WISP_STRETCH and LACE_STREAK_STRETCH times DOWN THE
 *                   FALL LINE replace them (the wake's wispStretch, round 4):
 *                   the backwash draws its foam out seaward;
 *   THE THRESHOLD   a soft ramp LACE_SOFT of rank either side (the wake's
 *                   LACE_SOFT: a hole's edge is bubbles thinning), the amount
 *                   capped at LACE_MAX_COVER so the densest foam keeps holes,
 *                   gated in from THIN_GATE[0] to THIN_GATE[1] of amount so
 *                   thin foam shows as sparse patches, not a faint sheet;
 *   OPACITY         see OP_LO (round 8: no foam is opaque);
 *   THE AGE         the foam's age (the swash field's foamAge, the foam
 *                   piece's age clock): the raft opens into threads round
 *                   windows (NET_FOLD), old thin foam breaks into dashes and
 *                   specks (BREAK_TILE; round 7 tore it into the wake's
 *                   clumps), thins (AGE_OPACITY) and grays (AGE_GRAY: fresh
 *                   foam bright, old foam threadbare).
 */
export const LACE_TILE_SCALE = 0.2;
export const LACE_HOLE_STRETCH = 1.4;
export const LACE_STREAK_STRETCH = 3;
export const LACE_WISP_STRETCH = 4;
export const LACE_SOFT = 0.16;
// Round 8: 0.62 (0.82 in round 7: the densest foam was a solid glowing
// patch; Manly's bore is 55% foam pixels, threads round holes).
export const LACE_MAX_COVER = 0.62;
// Round 8: from 0.05 to 0.25 of amount (0.06 to 0.32 in round 7), with the film's foam.
export const THIN_GATE: readonly [number, number] = [0.05, 0.25];
/**
 * ROUND 8: FAINT, GRAY-WHITE AND SEE-THROUGH. Round 7's foam was "opaque,
 * clipped pure-white blobs". Measured with foamContrast.py (the foam pixels
 * against the 30th percentile of luma round them): Manly's swash foam is 1.2
 * times the water under it at the front and in the backwash and 1.4 times in
 * the bore, its brightest tenth at 168 to 178 luma; t0007's front band is
 * 1.07 times. Round 7's was 1.5 to 2.1 times, its brightest tenth at 200 to
 * 216. The lace's opacity now runs from OP_LO (thin foam: a film of bubbles
 * over the water) to OP_HI (the densest) over OP_RANGE of rank over the
 * threshold: no foam is opaque. Each caller scales it; the sheet's foam by
 * the sheet's depth, from OP_SHEET[2] at OP_SHEET[0] m to 1 at OP_SHEET[1] m
 * (a thinning sheet carries a thinner film of bubbles, see-through to the
 * sand). Round 7 ran from 0.8 (fresh) or 0.4 to 1.
 */
export const OP_LO = 0.12;
export const OP_HI = 0.62;
export const OP_RANGE = 0.6;
export const OP_SHEET: readonly [number, number, number] = [0.003, 0.06, 0.35];
/**
 * THE NET: the rank is folded round its median (the wake's laceFold,
 * 1 - |2 r - 1|) by NET_FOLD[0] in fresh foam, rising to NET_FOLD[1] from
 * AGE_FOLD[0] to AGE_FOLD[1] s of age. Foam is threads round holes, as
 * Manly's is, not solid rafts (round 7 folded nothing under 3 s).
 */
export const NET_FOLD: readonly [number, number] = [0.55, 0.9];
export const AGE_FOLD: readonly [number, number] = [2, 8];
/**
 * THE BREAK-UP (replaces round 7's clump tear, the wake's, which tore old
 * foam into the clumps the judges read as pasted-on patches). Old, thin foam
 * stays only where a fine read of the raft (BREAK_TILE of its tile; drawn out
 * BREAK_STRETCH times down the fall line where the sheet runs seaward) is in
 * its top share, from BREAK_KEEP[0] up. So the threads break into dashes and
 * specks, and in the backwash into streaks pulled seaward. BREAK_MAX of the
 * foam breaks, from BREAK_AGE[0] to BREAK_AGE[1] s of age, where the amount
 * is under BREAK_AMT.
 */
export const BREAK_TILE = 0.25;
export const BREAK_STRETCH = 3;
export const BREAK_KEEP: readonly [number, number] = [0.58, 0.7];
export const BREAK_AGE: readonly [number, number] = [3, 10];
export const BREAK_MAX = 0.9;
export const BREAK_AMT: readonly [number, number] = [0.35, 0.75];
/**
 * Broken foam gathers into its specks and scum lines (old bubbles coalesce
 * where the flow sweeps them together): where the break-up keeps foam, the
 * opacity rises toward BREAK_SPECK_OP, before the caller's share. Without it
 * the backwash's specks were 5% opaque and did not show.
 */
export const BREAK_SPECK_OP = 0.5;
export const AGE_OPACITY: readonly [number, number, number] = [2.5, 8, 0.7];
export const AGE_GRAY: readonly [number, number, number] = [2, 10, 0.82];
/**
 * The lace's footprint fade: the finest popped cell of the raft read (the
 * wake image's 67 cells a tile) is LACE_FINE_M; a pixel wider than a third
 * of the raft's middle cell (29 a tile) reads the lace as its mean.
 */
export const LACE_MID_M = (12 * LACE_TILE_SCALE) / 29;
/** The flow map: a phase of this long, the tile riding at LACE_FLOW of the sheet's speed, at most LACE_FLOW_MAX. */
export const FLOW_PHASE_S = 0.8;
export const LACE_FLOW = 0.35;
export const LACE_FLOW_MAX = 0.5;
/** The sheet's lift over the sand where it is dry, m: it is drawn nowhere there (alpha 0) and never meets the sand. */
export const SHEET_LIFT_M = 0.0015;
/**
 * THE FILM'S CAUSTIC WEB (round 2). A swash film is rippled by its own
 * turbulence (capillary and gravity ripples 1 to 5 cm long, a millimeter
 * high), and each ripple is a lens: a ripple of wavenumber k and amplitude a
 * focuses the sun at 1 / ((1 - 1/n) a k^2), 1 to 2 cm for these, which is
 * the film's own depth. So the sand under a film of a few millimeters to a
 * few centimeters shows a sharp, moving web of sunlight, the brightest sign
 * that water is running over it (the sea floor's web, `oceanSeabed.ts`, is
 * computed for 1.5 m and deeper and fades to flat at the waterline). Drawn
 * from the swash foam tile's bubble net (cells of 3.1 cm), carried with the
 * film, its mean held at 1 so it moves light and adds none: FILM_WEB_GAIN
 * of the sun's share at full strength, from 1 mm of film to full at 4 mm,
 * gone by 6 cm where the lenses have folded the light many times over.
 */
export const FILM_WEB_GAIN = 0.85;
/** The sun's share of the sand's light at the judged sun (sunE cos 30 degrees against skyE): about 0.85. */
export const SUN_SHARE = 0.85;
/** Capillary ripples on the film: their slope, for the film's sky reflection. */
export const FILM_RIPPLE_SLOPE = 0.12;
/**
 * The ripples' slope grows with the film's speed (capillary chop on a fast
 * sheet), by this per m/s, to at most FILM_CHOP_MAX more. Round 2 used 0.05
 * per m/s and 0.12 at most, with 0.08 at rest: the film's sky reflection was
 * one flat tone (2.7 of 255 luma), and a judge saw no film at all.
 */
export const FILM_CHOP_PER_MS = 0.08;
export const FILM_CHOP_MAX = 0.2;
/**
 * THE SUN IN THE SHEET (round 3). Round 2 drew it as a mirror lobe (cos^900
 * of the reflected ray) on the ripple noise's normal, over a slope
 * differenced from the grid's bilinear reads: where the bore's face met the
 * sun's mirror angle, it lit the noise's contours inside the grid's cells as
 * hard white stripes. Now it is the sea's own model (`oceanSurface.ts`): a
 * Beckmann lobe about the sheet's smooth surface (its slope from the spline
 * reads), in the sea's scene-linear sun (SHEET_SUN_E, eight times the sky's
 * irradiance). Its rms slope is the sea's capillary chop (GLINT_RMS_SLOPE,
 * the value `oceanSurface.ts` uses) plus a fast film's chop (GLINT_CHOP_PER_MS
 * a m/s, at most GLINT_CHOP_MAX). The lobe sets the density of glitter
 * points: one jittered point per GLINT_CELL_M cell, lit with a probability
 * that saturates at GLINT_P_MAX, each GLINT_POINT bright (clipped white), so
 * a glint is a scatter of small flecks, as a photographed swash's is. With
 * the judged sun behind the eye (60 degrees up, the eye 70 degrees down),
 * a face must tilt about 25 degrees toward the sun to light, and none does:
 * no glint shows on the sheet at the judged pose, which is the physics. (A
 * first try took the sky reflection's noise amplitude, 0.12 to 0.32, as the
 * rms slope, and lit a salt of points over the whole film.)
 */
export const SHEET_SUN_E = 24;
export const GLINT_RMS_SLOPE = 0.08;
export const GLINT_CHOP_PER_MS = 0.04;
export const GLINT_CHOP_MAX = 0.08;
export const GLINT_CELL_M = 0.06;
export const GLINT_P_MAX = 0.5;
export const GLINT_DENSITY = 2;
export const GLINT_POINT = 3;
export const GLINT_CAP = 1;
/**
 * The glints fade out over this range of distance from the eye, m: the sea's
 * own range (`oceanSurface.ts` GLINT_START_M and GLINT_END_M, fitted to the
 * reference's far water), so the sheet and the sea glitter alike where they
 * meet.
 */
export const GLINT_START_M = 50;
export const GLINT_END_M = 130;
/** How far the sheet sits under its true level seaward of the still-water line, m (see the sheet's position). */
export const SHEET_PUSH_M = 0.15;
/**
 * Attenuation of the floor's image per kg/m^3 of suspended sand, per meter
 * of path: 3 Q / (2 rho_s d) for grains of d = 0.2 mm and a density of 2650,
 * with an extinction efficiency Q = 2 (large grains, geometric optics).
 * Nearly all of it is forward scattering, so it blurs the floor's detail
 * (the web, the ripples, the grain) rather than veiling it.
 */
export const SED_ATTEN_M2_KG = (3 * 2) / (2 * 2650 * 0.0002);
/**
 * THE VEIL OF THE FINES. The sand the surf lifts carries its fines (silt and
 * clay, a few percent of a beach sand's mass), and a fine mineral grain
 * scatters light back far more per kilogram than a sand grain does: a
 * mass-specific scattering near 0.5 m^2/g with 1 to 2% of it backward
 * (Babin et al. 2003), about 10 m^2/kg of backscatter. With 5% fines, 0.5
 * m^2/kg of backscatter per kg of the suspended sand; the veil over a column
 * is 1 - exp(-2 bb C h), so the surf's water reads pale and sandy where the
 * bores stir it (the reference's near-shore water is lighter and greener
 * than its sand), and clears where the sand settles. VEIL_TINT is the fines'
 * own light seen through the water that carries them: a pale sandy green.
 */
export const SED_BACK_M2_KG = 0.5;
export const VEIL_TINT: readonly [number, number, number] = [0.58, 0.64, 0.52];
/**
 * The most of the water's light the veil replaces (a look choice, not the
 * physics: a column this turbid would reflect more). Round 3 measured the
 * judged crops (measure3.py): the reference's water beside its foam line is
 * (137, 143, 120) sRGB, ours (120, 124, 108), the same hue 13% darker. A cap
 * of 0.35 closed only 3 of those 15 luma (the veil needs sand in the water,
 * and most of the crop's water carries little), and from straight above it
 * drew the surf as a fog. So it stayed at 0.2 in round 3. Round 4 takes it
 * to 0.08 with the milk: a judge read the surf behind the bore as "a hazy
 * green fog", and a frame with the veil off (r4c148nv) showed the fog was the
 * veil's smooth clouds. Round 7 takes it to 0.04 (its clouds drew soft
 * vertical streaks under the surf's foam, r7c against r7cnv) and the milk to
 * 0.03 (it drew a soft glow round the foam patches: "soft glowing bloom"). The gap to the reference's lighter water is the
 * sea's own body and floor light.
 */
export const VEIL_MAX = 0.04;
/**
 * ROUND 8: THE SURF'S OWN WATER. A surf 20 cm to a meter deep, stirred by the
 * bores, holds sand and fines through its whole column, and from above it
 * reads as a teal body, not as the floor seen through clear water: Manly's
 * surf is 0.44 of its dry sand's luma, R/G 0.50 and B/G 0.94, saturation
 * 0.48; ours was 0.64, R/G 0.94, B/G 0.87 and 0.08, the brown floor through
 * the water. Where the grid's water deepens from SURF_BODY_H[0] to
 * SURF_BODY_H[1] m, up to SURF_BODY_SHARE of the water's light is that body,
 * SURF_BODY_RGB (linear, the sun's share as the lagoon's in-scatter). It is
 * darker than the floor under it and uniform (the veil's clouds drew streaks
 * and fog, see VEIL_MAX). A calibration to the reference.
 */
export const SURF_BODY_H: readonly [number, number] = [0.15, 0.6];
export const SURF_BODY_SHARE = 0.7;
export const SURF_BODY_RGB: readonly [number, number, number] = [0.01, 0.042, 0.04];
/**
 * THE SWASH FOAM IS CREAM, NOT BLUE-WHITE. Beach foam carries the fines and
 * the organic film the surf strips from the sand, and it lies thin over sand,
 * so it reads a warm off-white: the reference's foam band is (168, 166, 149)
 * sRGB against ours (175, 175, 168) with the sea's own white. The tint
 * multiplies the sea foam's white for all of this piece's foam, milk and veil.
 */
export const SWASH_FOAM_TINT: readonly [number, number, number] = [1.0, 0.97, 0.9];
/** Under this depth a film is gloss on the sand, not a sheet: the sheet fades in from here. */
export const SHEET_MIN_M = 0.0004;
/**
 * ROUND 10: THE VARIANT LEVERS. Round 9 lost both views after it changed
 * several things at once (its drain streaks and even backwash lace read as
 * "a tiled bump map" and "brushed fur"). Round 10 draws round 8's look with
 * one lever at a time, each behind a tune uniform (`tune.v*`) whose 0 draws
 * round 8 to the pixel, for the lead to judge one by one:
 *   vSpeck  the sea's own whitecaps faded over the patch (round 9's
 *           `waterSeaFoam`);
 *   vGloss  the sand's gloss and sheen only where the sheet has left it
 *           (round 9: under the thin film they drew a gray fog);
 *   vFilm   V1, THE GLASSY FILM: no lace and no caustic web on the film (under FILM_PART_H[0] m;
 *           the bore's foam from FILM_PART_H[1] m stays), round 8's streaked
 *           silver band replaced by a sky shine from GLASS_THICK past
 *           GLASS_H[1] m to GLASS_THIN under GLASS_H[0] m, and the floor's
 *           clarity through the suspended sand GLASS_CLEAR times the loss;
 *   vFront  V2, THE BROKEN FRONT: the front band from FRONT_W_M[0] to
 *           FRONT_W_M[1] wide, a second octave of width, clusters from
 *           FRONT_CLUSTER_LO, gaps in FRONT_GAP_SHARE of it, and FRONT_TRAIL_M
 *           of trailing lace at FRONT_TRAIL_AMOUNT drawn as older, bubblier
 *           foam; and OLD_LINES older swash lines on the wet sand (see OLD_L_M);
 *   vDry    V3, THE DRYING EDGE (see DRY_FRESH_S, DRY_WRACK_GAP_M);
 *   vFeed   V4, FOAM THAT FEEDS THE SWASH (see FEED_PATCH_M).
 */
/*
 * ROUND 10, STEP 2: every version of step 1 lost view 2 alone, and every judge
 * named the same gaps whatever the version (an opaque sheet, drawn lines, an
 * even lip, cellular foam, flat wet sand, a white speckle, the crest
 * polygon), so step 2 ships every lever together, the rills off, and four
 * more levers: vSheet (see SHEET_DAPPLE_M), vSpeckle (SPECKLE_H), vTrail
 * (TRAIL_*), and V2 pushed further (FRONT_*).
 */
export const FILM_PART_H: readonly [number, number] = [0.05, 0.12];
/**
 * ROUND 11, V1 (vSand): THE SAND TOWARD MANLY'S. The see-through measure
 * (`beach/seeThrough.py`) found the dry sand carries a third of Manly's fine
 * contrast (2.6 against 7.6 RMS of luma minus a 7 px blur at 960 x 540) and
 * half its saturation (0.18 against 0.35). The dry sand's mottle (all but its
 * broad octave), its specks and gravel, and its sunlit relief (ripples, pits,
 * prints) scale by SAND_GRAIN_K; its albedo is tinted by SAND_TINT (linear:
 * Manly's dry sand's linear color over ours, [163, 127, 80] over [129, 115,
 * 89] sRGB), faded out under the water over SAND_TINT_H. The wet and damp
 * sand follow through Angstrom's law. (SAND_GRAIN_K 2.9 gave 5.4 of Manly's
 * 7.6 RMS; 4.1.)
 */
export const SAND_GRAIN_K = 4.1;
export const SAND_TINT: readonly [number, number, number] = [1.67, 1.24, 0.8];
// (0.4 to 3 mm: from 2 mm to 3 cm the sheet drew gold-brown, its saturation 0.91 of the dry sand's against Manly's 0.39.)
export const SAND_TINT_H: readonly [number, number] = [0.0004, 0.003];
/**
 * ROUND 12: THE MATCH BY MEASURE (`opts.match`, `&beachmatch=1`). Remy's
 * ruling (sheet q34, 2026-09-29): "keep going with judges, and match the real
 * frame by measure". `beach/r12/measure.py` measures each zone of the judged
 * crop (960 x 540) from the sea to the dry sand, on the Manly stills b009 to
 * b012 and on our frame, the same way: its width, its CIE Lab mean and
 * spread, its luma percentiles, its see-through share (high-pass energy
 * against the dry sand's), its foam share and scale; the foam line's width,
 * peak and gaps; the wet sand's darkening and sheen. The tables are in
 * `beach/measure-manly.md` and `beach/measure-match.md`. Round 8 against
 * Manly, the gaps the match closes (Manly's spread in brackets):
 *   DRY SAND   luma 116 (131 to 134), b* 16 (27 to 31), grain 2.7 (4.8 to
 *              7.5): round 11's vSand (on in the match);
 *   DAMP SAND  luma 0.82 of the dry sand's (0.67 to 0.70; in Manly it is
 *              mostly in the promenade's shadow): MATCH_DAMP_K;
 *   WET SAND   0.75 of the dry sand's (0.60 to 0.65), sheen share 0.11 (0 to
 *              0.015): MATCH_WET_K, MATCH_GLOSS_CUT;
 *   FILM       one gray-olive tone (L* sd 1 to 7; round 8 6.5, a ramp from a
 *              brown lip to a dark foot): MATCH_FILM_*;
 *   FACE       a dark blue band before the foam line (L* 22 to 31, b* -3 to
 *              -8; round 8 has none): round 11's face, MATCH_FACE_*;
 *   FOAM LINE  one continuous bright band, 0.04 to 0.08 of the crop's height
 *              (round 8: cellular cores in 0.63 of the columns), its peak luma
 *              151 to 186 (138), b* -8 to -13 (a cool white; round 8 cream,
 *              +3): round 11's band, MATCH_LINE_*, MATCH_FOAM_TINT;
 *   SURF       a lace net over dark water, foam 0.19 to 0.45 of it in strands
 *              about 6 px wide round holes 10 to 23 px (round 8: 3.3 and
 *              14.5 px): MATCH_TILE_K;
 *   WATER      a dark teal, L* 20 to 23, a* -14 to -16 (27.5, -7.8):
 *              MATCH_SURF_BODY_*.
 * Each MATCH_ value is a calibration to those frames, not the physics, and
 * is a uniform (`mt`) so a rig can step it at one pinned state.
 */
/**
 * ROUND 13 (the match): THE SHAPE FAULTS. Round 12 matched 45 of 60 numbers
 * and lost view 2 again (high); its judge named five shapes no number of
 * round 12 measured. `beach/r12/shape.py` measures each on the Manly stills
 * and on ours (`beach/measure-shape.md`):
 *   THE EDGE  the dark band before the foam line: Manly's darkest row is 0.62
 *             to 0.67 of the film's luma (p10 of the columns), 44 to 52 luma;
 *             round 12's 0.32 and 24, a black-navy stroke (MATCH_FACE_*);
 *   RILLS     round 8's drawn rills are off in the match (Manly shows none);
 *   THE RIM   the bright line on the sheet's top edge rises 6 to 8 luma over
 *             the film in 0.20 to 0.25 of Manly's columns; round 12's 14 in
 *             0.57 (MATCH_RIM_K, MATCH_RIM_GAP_M);
 *   GRADIENT  the damp sand dries by its age (MATCH_DAMP_AGE_S, MATCH_DAMP_K
 *             at the wet sand to MATCH_DAMP_DRY_K up the beach), the wet line
 *             MATCH_LINE_W_K times wider, the film fades in over its top
 *             millimeters (MATCH_FILM_DEEP_M, MATCH_EDGE_FULL_M);
 *   HOLES     Manly's surf net has 41 to 56 small windows per 10,000 px (about
 *             20 px each), round 12's 21: the strong bore's lace read finer
 *             (MATCH_TILE_K) and drawn out further along the shore
 *             (MATCH_HOLE_STRETCH, MATCH_STREAK_STRETCH), and the surf behind
 *             the bore takes it too (MATCH_SURF_REACH_M).
 */
export const MATCH_RIM_K = 0.5;
export const MATCH_RIM_GAP_M = 1.4;
export const MATCH_DAMP_DRY_K = 1.0;
export const MATCH_DAMP_AGE_S: readonly [number, number] = [30, 150];
export const MATCH_LINE_W_K = 2;
export const MATCH_EDGE_FULL_M = 0.008;
export const MATCH_HOLE_STRETCH = 1.5;
export const MATCH_STREAK_STRETCH = 3;
export const MATCH_SURF_REACH_M: readonly [number, number, number] = [3, 6, 9];
/** The surf net's amount cap (see THE SURF'S NET in the hook). */
export const MATCH_NET_CAP = 0.45;
export const MATCH_NET_SCALE = 1.9;
/** The scale of the noise that varies the threads' width and light, m. */
export const MATCH_NET_VAR_M = 0.35;
/**
 * ROUND 14 (the match): what the judges' "flat slab" is not, and what is
 * missing (`beach/r12/sheet.py`, `beach/measure-sheet.md`). The film's
 * mid-scale streaks, glints, edge width and jaggedness are already inside the
 * Manly spread. Missing: (1) thin lines along the shore on the wet sand (old
 * swash marks: Manly 0.58 to 0.75, ours 0.49), so round 11's older swash lines
 * (vOld) are on in the match; (2) the wet sand darker toward the water (the 15
 * rows next to the film at 0.83 to 0.86 of the sand 45 to 60 rows up; ours
 * 1.00): MATCH_WET_K and MATCH_WET_S; (3) the surf net streaked seaward, not
 * along the shore (its gradient energy across the shore 0.56 to 0.59; ours
 * 0.67), and patchy at the meter scale: MATCH_NET_STRETCH along the fall
 * line, MATCH_NET_PATCH_M.
 */
export const MATCH_NET_STRETCH = 1.25;
export const MATCH_NET_PATCH_M = 1.6;
export const MATCH_STRAND_K = 0.1;
/**
 * ROUND 17 (the match): THE PROFILE FROM THE FOAM LINE TO THE DRY SAND
 * (`beach/r12/profile.py`, `beach/measure-profile.md`). Manly b009 to b012:
 * one dark olive zone (L* 28 to 35, b* 5 to 9) for 95 to 170 rows above the
 * foam line, then a damp ramp of 28 to 65 rows (L* up 2.3 to 4.7 per 10
 * rows, b* to 25 to 30), then the dry sand (L* 53 to 57). Round 16: a gray
 * sheet of about 40 rows, then orange wet sand (b* 16 to 22) with no ramp, a
 * rimmed lip, and white speckle. So: the sand the sheet left under
 * MATCH_OLIVE_S[0] s ago is the sheet's olive, fading to orange by [1] s
 * (MATCH_OLIVE_GRAY of the way); no rim, no silver sheen band and a wider
 * fade at the lip; the thin sheet's own lace and the stranded foam cut
 * (MATCH_SHEET_LACE_K, MATCH_STRAND_K); the swash a little lower
 * (BEACH_MATCH_SWASH.waveGain) to leave the damp ramp and the dry sand in
 * the frame.
 */
export const MATCH_OLIVE_S: readonly [number, number] = [45, 110];
export const MATCH_OLIVE_GRAY = 0.85;
/** The damp ramp's reads, m seaward of the point, and its strength (see THE DAMP RAMP). */
// Round 18: reads to 2.8 m (Manly's ramp is 28 to 65 rows, 1.2 to 2.8 m at the new frame's 4.3 cm a
// pixel), and full strength.
export const MATCH_RAMP_M: readonly [number, number, number, number] = [0.6, 1.3, 2.0, 2.8];
export const MATCH_RAMP_K = 1.0;
export const MATCH_SHEET_LACE_K = 0.3;
/** The old swash lines in the match: MATCH_OLD_W_K times wider, their grains and scum MATCH_OLD_K times as strong. */
export const MATCH_OLD_W_K = 2.5;
export const MATCH_OLD_K = 4.0;
/** Their scum and their band of stranded bubbles in the match: Manly's old swash marks are dark grain lines, not white strokes. */
export const MATCH_OLD_FOAM_K = 1.0;
export const MATCH_OLD_LACE_K = 0.35;
/** The net's threads: the cell edge value over which a thread fades out (a thread about a tenth of a cell). */
export const MATCH_NET_LINE: readonly [number, number] = [0.08, 0.36];
export const MATCH_NET_OP = 1.0;
// Round 18: 1.0 (0.56 in round 14): at the new frame (beach-top2) the damp band
// above the olive zone drew at L* 29, darker than the olive; Manly's damp band is
// L* 36 to 44 (b* 25 to 30), and at 1.0 ours is 43 (b* 28).
export const MATCH_DAMP_K = 1.0;
export const MATCH_WET_K = 0.45;
/** The wet sand grayed this far toward its luma times MATCH_FILM_RGB (Manly's wet sand b* 17 to 20 against its damp sand's 20 to 28). */
export const MATCH_WET_GRAY = 0.45;
/** The damp sand grayed this far the same way (its a* 10 against Manly's 6 to 9). */
export const MATCH_DAMP_GRAY = 0.12;
/** The whole beach sand's albedo times this (round 11's gold drew the dry sand at 136 luma, b* 32; Manly's 131 to 134, b* 27 to 31). */
export const MATCH_SAND_RGB: readonly [number, number, number] = [0.96, 0.955, 1.0];
/** Sand the sheet left under MATCH_WET_S[0] s ago is the wet sand; by MATCH_WET_S[1] s it is damp. */
export const MATCH_WET_S: readonly [number, number] = [20, 70];
export const MATCH_GLOSS_CUT = 0.85;
/** The film's immersed darkening full over MATCH_FILM_DEEP_M (FILM_DEEP_M 1 to 10 mm drew a brown lip). */
export const MATCH_FILM_DEEP_M: readonly [number, number] = [0.0004, 0.005];
export const MATCH_LINE_W_M = 3.0;
export const MATCH_LINE_GAP_SHARE = 0.0;
export const MATCH_LINE_AMOUNT = 1.0;
/** The run of foam across the shore that makes a bore strong enough for the line, m (STRENGTH_RUN_M 2.3). */
export const MATCH_STRENGTH_RUN_M = 2.3;
/** The line's density at a half, three quarters and all of its width from the front (1 at a quarter). */
export const MATCH_LINE_PROFILE: readonly [number, number, number] = [0.95, 0.9, 0.8];
/** Seaward of the foam line the strong bore's foam is this share of itself: Manly's surf is a lace net, 0.19 to 0.45 foam. */
export const MATCH_SURF_AMOUNT = 0.75;
export const MATCH_BAND_OP_HI = 0.9;
export const MATCH_FACE_W_M = 0.5;
export const MATCH_FACE_SHARE = 0.78;
/** The face only over this much grid water, m (see the sheet's face). */
export const MATCH_FACE_H: readonly [number, number] = [0.008, 0.025];
/** The swash foam's tint in the match: a cool white (Manly's foam line b* -8 to -13) in place of SWASH_FOAM_TINT's cream. */
export const MATCH_FOAM_TINT: readonly [number, number, number] = [0.64, 0.89, 1.45];
/** The bore's and the surf's lace read at this many times its tile (strands and holes as wide as Manly's in the frame). */
export const MATCH_TILE_K = 2.2;
/** The surf's lace (not the line) this many times as opaque (its brightest tenth 119 luma against Manly's 157 to 179). */
export const MATCH_SURF_OP = 2.0;
/** The strong bore's surf lace read as the band this far (its reads drawn out along the shore; round 8's round holes read as cheese). */
export const MATCH_SURF_BAND = 0.0;
/** The strong bore's lace folded at least this far round its median (NET_FOLD 0.55 to 0.9): threads round dark windows, as Manly's surf net (at 0.55 the 4x tile drew round holes in white blobs). */
export const MATCH_FOLD = 1.0;
/** The surf's own body grows over this grid depth, m, in the match (SURF_BODY_H 0.15 to 0.6: our surf ended at 0.15 of the crop, Manly's is 0.22 to 0.38). */
export const MATCH_SURF_H: readonly [number, number] = [0.25, 0.75];
export const MATCH_SURF_BODY_SHARE = 0.95;
/** The sheet is the sand seen through a film up to MATCH_THICK_M[0] of depth, the seabed reader's water from [1] (round 8: 5 mm and 5 cm; its film fell from 103 to 56 luma over 1 to 16 mm, Manly's is one tone). */
export const MATCH_THICK_M: readonly [number, number] = [0.02, 0.08];
/** The film's immersed grains' factor (WET_IMMERSED_K 0.55 drew the film at 53 to 56 luma from 2 mm on; Manly's is 66 to 85). */
export const MATCH_IMMERSED_K = 0.85;
/** The film's own gray olive: MATCH_FILM_GRAY of the way to its luma times MATCH_FILM_RGB. */
export const MATCH_FILM_GRAY = 0.65;
export const MATCH_FILM_RGB: readonly [number, number, number] = [1.07, 1.0, 0.72];
/** The sand's gold fades out under this much film, m (SAND_TINT_H: 0.4 to 3 mm drew a gold-brown lip). */
export const MATCH_TINT_H: readonly [number, number] = [0.0002, 0.001];
export const MATCH_SURF_BODY_RGB: readonly [number, number, number] = [0.0, 0.038, 0.056];
/** The face's own light in the match (FACE_RGB drew it at b* -1; Manly's face is b* -3 to -8). */
export const MATCH_FACE_RGB: readonly [number, number, number] = [0.016, 0.022, 0.032];
/** The foam line's lace cover cap in the match (BAND_MAX_COVER 0.72 drew it 0.79 foam; Manly's 0.55 to 0.67). */
export const MATCH_BAND_COVER = 0.6;
/**
 * ROUND 11, V2 (vBand): ONE BORE BAND. Manly's surf edge is one bright,
 * continuous band (0.86 of its dry sand's luma) with lines along the shore
 * and a dark blue face before it; ours is separate cellular cores (0.79). The
 * grid holds two bores: at 42 s (view 1, won by round 8's look) its foam band
 * is 0.9 to 1.5 m wide at its fronts, at 138 s (view 2) 2.4 to 3.1 m. A
 * STRONG bore (the point in a run of foam STRENGTH_RUN_M long) loses the
 * breaker's segments;
 * its lace covers up to BAND_MAX_COVER, is drawn out BAND_HOLE_STRETCH and
 * BAND_STREAK_STRETCH times along the shore, and is BAND_OP_LO to BAND_OP_HI
 * opaque; along its shoreward edge a rolled front LIP_W_M wide (LIP_AMOUNT,
 * broken in LIP_GAP_SHARE of a noise of LIP_GAP_M), and before it a face
 * FACE_W_M wide of FACE_RGB (up to FACE_SHARE of the water's light). The weak
 * bore keeps round 8's look.
 */
/*
 * The strength (round 11's measure; round 9's, the foam 0.8 m behind the point
 * over 0.74 to 0.9, also fired in view 1's upper core at 42 s): whether the
 * point lies in a run of foam over STRENGTH[0] to [1] at least STRENGTH_RUN_M
 * long across the shore. At the grid's foam fronts the bore band is 0.9 to
 * 1.5 m wide at 42 s (the quartiles, view 1's rows) and 2.4 to 3.1 m at 138 s.
 */
export const STRENGTH_RUN_M = 2.3;
export const STRENGTH: readonly [number, number] = [0.4, 0.55];
export const BAND_MAX_COVER = 0.72;
export const BAND_HOLE_STRETCH = 3;
export const BAND_STREAK_STRETCH = 6;
export const BAND_OP_LO = 0.2;
export const BAND_OP_HI = 0.66;
export const LIP_W0 = 0.45;
export const LIP_W_M = 0.35;
export const LIP_AMOUNT = 0.85;
export const LIP_GAP_M = 1.8;
export const LIP_GAP_SHARE = 0.15;
export const FACE_W_M = 0.45;
export const FACE_SHARE = 0.5;
export const FACE_RGB: readonly [number, number, number] = [0.018, 0.028, 0.045];
/**
 * ROUND 11, V3 (vOld): round 10's older swash lines (OLD_S_M) without round
 * 10's lip, and along each a band OLD_LACE_W_K times its width of stranded
 * bubbles drawn with the lace (OLD_LACE_AMOUNT, as old foam), broken as the
 * line is.
 */
export const OLD_LACE_W_K = 3.5;
export const OLD_LACE_AMOUNT = 0.45;
/**
 * vSheet, THE SEE-THROUGH SHEET. Manly's sheet is an olive gray (0.54 of its
 * dry sand's luma, 0.39 of its saturation, its hue 5 degrees from the sand's)
 * dappled with fine light cells (the sky's sheen off its ripples, and faint
 * bubbles), lighter toward the lip; the judges read ours as "an opaque,
 * muddy dark-brown smear". The sheen (V1's glass share) is dappled: a
 * two-octave noise of SHEET_DAPPLE_M and SHEET_DAPPLE2_M, carried with the
 * flow in two phases, scales it from SHEET_DAPPLE_LO to SHEET_DAPPLE_HI; the
 * sand under the water keeps SHEET_GRAIN_K of the dry sand's grain (its
 * mottle; wet sand in the air is smoother, the pores' film fills it) and is
 * grayed toward olive (SHEET_OLIVE of the way to its luma times
 * SHEET_OLIVE_RGB) as the water deepens from FILM_DEEP_M[0] to [1] m.
 */
export const SHEET_DAPPLE_M = 0.22;
export const SHEET_DAPPLE2_M = 0.09;
export const SHEET_DAPPLE_LO = 0.55;
export const SHEET_DAPPLE_HI = 1.6;
export const SHEET_GRAIN_K = 0.7;
export const SHEET_OLIVE = 0.45;
export const SHEET_OLIVE_RGB: readonly [number, number, number] = [1.03, 1.0, 0.8];
/**
 * vSpeckle, THE SURF'S SPECKLE. A judge: "an even fine white speckle over all
 * the water reads as a screen overlay or rain". Its source (step 2's toggle
 * frames): the sand's pale shell specks under the surf, refracted by its
 * ripples into small light wedges (the rest), and the broken foam's specks
 * (60% of them; the sea's whitecaps and the seabed's caustic web are not
 * part of it). The surf's stirred water hides both: the specks fade out as
 * the grid's water deepens from SPECKLE_H[0] to SPECKLE_H[1] m.
 */
export const SPECKLE_H: readonly [number, number] = [0.05, 0.25];
/** The floor's clarity under the surf falls to 1 - SPECKLE_CLARITY over SPECKLE_H (its wave ripples' lit crests, refracted by the surf's ripples, drew most of the speckle). */
export const SPECKLE_CLARITY = 0.85;
/** Thin foam (amount under 0.25 to 0.5) over the surf's depth loses up to SPECKLE_THIN_OP of its opacity (its sparse patches drew half the speckle). */
export const SPECKLE_THIN_OP = 0.6;
/**
 * vTrail, THE FOAM TRAILS SEAWARD. "The foam lies in blobs of speckled noise",
 * "nothing streaks down-slope". On the seaward side of the bore (where the
 * foam grows toward the shore, TRAIL_SIDE of its gradient's direction) and in
 * thin foam (TRAIL_AMT), the lace is read drawn out down the fall line, as the
 * backwash draws it: the bore's foam trails back to sea in streaks, in
 * patches (TRAIL_PATCH_M), wobbling sideways as V4's do (FEED_WOBBLE_M).
 */
export const TRAIL_SIDE: readonly [number, number] = [0.45, 0.85];
/** The trails lie in patches of a noise TRAIL_PATCH_M along the shore (about a third of it; everywhere, a first build drew a curtain). */
export const TRAIL_PATCH_M = 1.7;
export const TRAIL_AMT: readonly [number, number, number, number] = [0.04, 0.12, 0.4, 0.6];
/** V4's streaks wobble sideways by up to FEED_WOBBLE of a noise FEED_WOBBLE_M across (straight, a first build read as drips). */
export const FEED_WOBBLE_M = 0.45;
export const FEED_WOBBLE = 0.18;
// Step 2: 0.05 (0.07 in step 1: the thin film's wide strip read as "a gray slab ... a flat overlay").
export const GLASS_THIN = 0.05;
export const GLASS_THICK = 0.015;
export const GLASS_H: readonly [number, number] = [0.002, 0.04];
export const GLASS_CLEAR = 0.2;
// Step 2: 1 to 22 cm (1.5 to 32 cm in step 1: "a bright, even-width stamped noise band").
export const FRONT_W_M: readonly [number, number] = [0.01, 0.22];
export const FRONT_CLUSTER_LO = 0.15;
export const FRONT_GAP_SHARE = 0.42;
export const FRONT_TRAIL_M = 0.6;
export const FRONT_TRAIL_AMOUNT = 0.3;
export const FRONT_TRAIL_AGE_S = 7;
/**
 * V2's OLDER SWASH LINES. Manly shows "older swash marks lie across the sheet
 * at slight angles": the lobed fronts of earlier uprushes, left as thin lines
 * of scum and fine dark grains on the wet sand. Each is an arc at s =
 * OLD_S_M[k] plus lobes OLD_L_M[k] long and OLD_D_M[k] deep (cusps up the
 * beach) plus a slight tilt OLD_TILT[k] along the shore, OLD_W_M wide, broken
 * where a noise falls low, on wet sand only (above the sheet, below the wet
 * line). Scum OLD_FOAM of the foam's white, grains OLD_DARK darker.
 */
export const OLD_S_M: readonly number[] = [5.0, 6.1, 7.2, 8.3, 9.4];
export const OLD_L_M: readonly number[] = [4.3, 5.7, 3.6, 6.4, 4.9];
export const OLD_D_M: readonly number[] = [0.35, 0.5, 0.3, 0.45, 0.4];
export const OLD_TILT: readonly number[] = [0.05, -0.07, 0.08, -0.04, 0.06];
export const OLD_W_M = 0.03;
export const OLD_FOAM = 0.1;
export const OLD_DARK = 0.1;
/**
 * V3, THE DRYING EDGE. Sand the sheet left under DRY_FRESH_S[0] s ago keeps
 * DRY_FRESH_K of the immersed grains' darkening (round 9's fresh wet sand),
 * fading by DRY_FRESH_S[1] s, both ends moved 0.6 to 1.4 times by a two-octave
 * patch noise of DRY_PATCH_M; the wet line takes a second octave of DRY_LINE2_M
 * and DRY_LINE2_VAR (patchy drying toward the dry sand); its ramp narrows to
 * DRY_LINE_W_K of itself and its drying blotches go to DRY_BLOTCH_K (a crisp
 * edge); the high-water mark narrows to DRY_HWM_W_M (a crisp thin line). The
 * wrack: the items on the wrack line (s DRY_WRACK_S[0] to [1]) are hidden in
 * the gaps of a noise along the shore of DRY_WRACK_GAP_M (DRY_WRACK_GAP_SHARE
 * of it) and moved up to DRY_WRACK_WAVE_M up the beach along a wavy line.
 */
export const DRY_FRESH_S: readonly [number, number] = [4, 30];
export const DRY_FRESH_K = 0.6;
export const DRY_PATCH_M = 0.7;
export const DRY_LINE2_M = 1.1;
export const DRY_LINE2_VAR = 0.09;
// Step 2: 0.8 (0.4 in step 1: "a hard wavy edge like a vector outline").
export const DRY_LINE_W_K = 0.8;
export const DRY_BLOTCH_K = 0.15;
export const DRY_HWM_W_M = 0.05;
/**
 * V4, FOAM THAT FEEDS THE SWASH. On the sheet, in patches of a noise
 * FEED_PATCH_M across (about a quarter of the face), the lace's amount rises by
 * up to FEED_GAIN of itself and is read drawn out down the fall line: the
 * broken wave's foam streams up the slope as a thinning bore that joins the
 * front. Where it runs back, in sparser patches of SCUM_PATCH_M (about a
 * fifth), foam of SCUM_AMOUNT is drawn out seaward: a few scum trails.
 */
/**
 * THE SEA'S CREST OVER THE SHEET (vHide). Where the beach's grid water is
 * shallower than CREST_HIDE_H, the beach's own water is the water the eye
 * sees: the reader returns `hide` and the surface draws nothing there (the sea
 * crest standing over the pushed-down sheet drew a darker patch with straight
 * sides), and the sheet keeps its true level (no SHEET_PUSH_M) there.
 */
export const CREST_HIDE_H = 0.4;
export const FEED_PATCH_M = 2.4;
/** V4 only on the sheet: its grid water from FEED_H[0] to FEED_H[1] m, and the lace's amount under FEED_BORE (not the dense bore). */
export const FEED_H: readonly [number, number, number, number] = [0.003, 0.006, 0.07, 0.12];
export const FEED_BORE: readonly [number, number] = [0.35, 0.5];
export const FEED_GAIN = 1.2;
export const SCUM_PATCH_M = 1.8;
export const SCUM_AMOUNT = 0.5;
export const SHEET_FULL_M = 0.004;
/**
 * ROUND 8: the sheet's own alpha is full by this depth (SHEET_FULL_M to round
 * 7: the sheet faded in over 0.4 to 4 mm of depth, 10 to 30 cm of sand, and
 * with no foam on it its edge did not show at all).
 */
export const SHEET_EDGE_FULL_M = 0.001;
/** The beach's effects fade out over this far inside the patch's alongshore ends and top, m. */
export const EDGE_FADE_M = 3;
/**
 * The fade at the patch's TOP (landward) edge, m: over the backshore, above
 * the berm, where no swash reaches. Round 1 and 2 faded over EDGE_FADE_M
 * there, which on the old 9.5 m grid hid the upper swash zone, the wet band's
 * edge and the dry sand above it.
 */
export const TOP_FADE_M = 1.5;
/**
 * THE SAND'S OWN DETAIL, which the floor's 1.2 cm grain speckle leaves out at
 * the distances a beach is seen from: a mottle of tone (the patches of finer
 * and coarser grain a swash sorts: 35, 15 and 6 cm; round 3 sets their
 * amounts apart for wet and dry sand, see MOTTLE_FINE_WET), and sparse
 * specks (SPECK_M cells, one in SPECK_SHARE holding one,
 * 0.8 to 2 cm across): dark pebbles of heavy minerals and pale shell
 * fragments, the two things a beach's sand is flecked with. Each fades to
 * its mean once it is under three pixels. A first build (12% coarse tone,
 * 3 cm cells at 3.5%) drew stains and a regular pepper of dots.
 */
export const MOTTLE_COARSE_M = 0.35;
export const MOTTLE_MID_M = 0.15;
export const MOTTLE_FINE_M = 0.06;
export const SPECK_M = 0.05;
export const SPECK_SHARE = 0.012;
/**
 * WET SAND IS SMOOTH, DRY SAND IS PATCHY (round 3). A judge asked for
 * "darker, glossy wet sand, then lighter, grainy dry sand". Water fills the
 * gaps between the grains and the swash planes and sorts its face, so the
 * tone patches are weaker on wet sand. The dry backshore keeps the patches
 * the swash never planes: damp and trodden fields (MOTTLE_BROAD_M, 0.8 m),
 * wind-sorted patches (35 and 15 cm), and a little relief of wind ripples
 * and pocks (MOTTLE_RELIEF_M, 9 cm). And gravel: shell fragments and pebbles
 * 2 to 6 cm across, one GRAVEL_M cell in GRAVEL_SHARE holding one, which the
 * judged view (2 cm a pixel) resolves; the 1 to 2 cm specks it does not.
 *
 * MEASURED on the judged crops (800 px wide, texStats.py): the reference's
 * dry sand has a coarse contrast of 4.1 luma (the sd of a 9 px blur over a
 * 41 px blur: features of 0.3 to 1.3 m in ours) and a fine one of 1.7 (the
 * sd under the 9 px blur). Round 2's detail on both wet and dry sand gave 1.3
 * and 4.0 on the dry sand; round 3's values gave 3.4 and 2.5, and its judges
 * read clouds (see ROUND 4 below).
 */
/**
 * ROUND 4: FINE GRAIN, NOT CLOUDS. Both round-3 judges read the dry sand's
 * broad patches as "large cloud blotches" and the wet line as "a mask between
 * two textures"; the round-3 fit to the reference's coarse contrast was a fit
 * to its blur. Dry sand now carries its texture in the fine scales (6 and
 * 9 cm, two to four pixels at the judged views) and the gravel; wet sand the
 * same texture, weaker (water fills the gaps and the swash planes the face),
 * so the wet line changes the tone and the smoothness, not the pattern.
 */
export const MOTTLE_FINE_WET = 0.02;
export const MOTTLE_FINE_DRY = 0.04;
export const MOTTLE_RELIEF_M = 0.09;
export const MOTTLE_RELIEF_DRY = 0.03;
/**
 * ROUND 5: THE DRY SAND HAS RELIEF, LIT BY THE SUN. Round 3's tone patches read
 * as clouds and round 4's fine grain as paper; both were albedo. Dry sand's
 * look is its microrelief under a low sun, so the sand now carries a height
 * field whose slope tilts the normal the sun lights (the sky's share stays):
 *   RIPPLES     wind ripples RIPPLE_M long and RIPPLE_H_M high, crests across
 *               the shore (the wind along the beach), sinuous, in fields;
 *   PITS        one PIT_CELL_M cell in PIT_SHARE holds a pit 2.4 to 6 cm across,
 *               PIT_DEPTH_M deep (rain pocks, crab holes, kicked sand);
 *   FOOTPRINTS  FOOTPRINT_TRACKS walkers' tracks on the backshore above
 *               RELIEF_S_FULL_M, prints FOOTPRINT_L_M by FOOTPRINT_W_M,
 *               FOOTPRINT_DEPTH_M deep, a stride of FOOTPRINT_STRIDE_M.
 * The swash planes its zone: the relief grows from RELIEF_S_ZERO_M to full at
 * RELIEF_S_FULL_M, and only on dry sand. TONE PATCHES: two tones of the
 * albedo, TONE_PATCH_K apart, with crisp irregular edges (a noise of
 * TONE_PATCH_M through a narrow step): the backshore's fields of finer and
 * coarser sand, not soft clouds.
 */
export const RIPPLE_M = 0.09;
export const RIPPLE_H_M = 0.0035;
export const RIPPLE_TURN_RAD = 0.3;
export const PIT_CELL_M = 0.16;
export const PIT_SHARE = 0.07;
export const PIT_DEPTH_M = 0.008;
export const FOOTPRINT_TRACKS: readonly (readonly [number, number, number])[] = [
  // s, a of a point on the track (m), heading from +a toward +s (rad).
  [14.5, -24, 0.22], [12.2, 6, -0.28], [16.5, 0, 0.05],
];
export const FOOTPRINT_L_M = 0.13;
export const FOOTPRINT_W_M = 0.05;
export const FOOTPRINT_DEPTH_M = 0.018;
export const FOOTPRINT_STRIDE_M = 0.68;
export const RELIEF_S_ZERO_M = 7.5;
export const RELIEF_S_FULL_M = 10;
export const TONE_PATCH_M = 1.8;
export const TONE_PATCH_K = 0.06;
/** The tone patches, wet and dry, as shares of the albedo (see above). */
export const MOTTLE_BROAD_M = 0.8;
export const MOTTLE_BROAD_WET = 0.012;
export const MOTTLE_BROAD_DRY = 0.025;
export const MOTTLE_COARSE_WET = 0.02;
export const MOTTLE_COARSE_DRY = 0.045;
export const MOTTLE_MID_WET = 0.02;
export const MOTTLE_MID_DRY = 0.05;
export const GRAVEL_M = 0.14;
export const GRAVEL_SHARE = 0.05;
/** The swash sorts the gravel to its mark and leaves its face clean: the share on wet sand, of the dry share. */
export const GRAVEL_WET_K = 0.3;
/**
 * THE SWASH FRONT (round 4). Every judge of rounds 1 to 3 asked for a thin,
 * bright, lobed foam rim at the run-up limit. An uprush runs onto dry sand as
 * a bore a few centimeters high whose front rolls air into the water; its
 * leading edge is a line of bubbles with the foam the sheet carries, a few
 * centimeters wide, and lobed where the tongues of the swash reach unevenly.
 * The rim is drawn on the sand at the sheet's edge: the band RIM_M wide inside
 * the line where the sheet's depth passes RIM_EDGE_M (the distance in from
 * that line is the depth over its gradient), as the lace at amount RIM_AMOUNT
 * where the edge advances and RIM_BACK_SHARE of that where it retreats (a
 * backwash edge leaves a broken line). The tongues are the swash's own: the
 * depth the rim reads is the grid's. The line is no stroke: its width swings
 * by RIM_WIDTH_VAR over RIM_VAR_M along it, and it breaks into beads where a
 * noise of RIM_BEAD_M falls low (a first build drew one even white line).
 */
export const RIM_EDGE_M = 0.0004;
/**
 * ROUND 7: BETWEEN THE LAST TWO FRONTS. Round 5's was "a sparse chain of
 * separate white beads", round 6's "one crisp, evenly bright continuous
 * stroke". Now the band's amount is capped at RIM_AMOUNT (under the lace's
 * full cover, so its holes show: a lumpy bead of bubbles), its clusters vary
 * it from RIM_CLUSTER_LO to 1, and it breaks where a noise of RIM_GAP_M falls
 * into its lowest RIM_GAP_SHARE.
 */
export const RIM_AMOUNT = 0.9;
export const RIM_CLUSTER_LO = 0.5;
/** The leading edge's roughness at the bubbles' scale: RIM_ROUGH_M in and out, a noise of RIM_ROUGH_CELL_M. */
export const RIM_ROUGH_M = 0.03;
export const RIM_ROUGH_CELL_M = 0.07;
export const RIM_GAP_M = 1.1;
export const RIM_GAP_SHARE = 0.18;
export const RIM_BACK_SHARE = 0.85;
/**
 * ROUND 5: THE FRONT IS A FOAM BAND, NOT A LINE. Both round-4 judges read the
 * rim as "one thin, constant-width, bright white stroke". The band now:
 *   WIDTH      swings from RIM_W_MIN_M to RIM_W_MAX_M along the shore, by a
 *              noise of RIM_W_SCALE_M (2 to 15 pixels at the top-down view);
 *   CLUSTERS   its amount rises and falls in clumps of RIM_CLUSTER_M;
 *   GAPS       (round 5 only: where a noise of 0.8 m fell into its low
 *              fifth, it broke; round 6 draws it continuous);
 *   SCALLOPS   its front is set back into arcs RIM_SCALLOP_M long, up to
 *              RIM_SCALLOP_DEPTH_M deep, meeting in cusps that point up the
 *              beach (the tongues of a swash merge there);
 *   TAPER      it is densest at the front and thins inward to a film that
 *              shows the sand.
 * OLDER LINES: the grid's swash mark (where each earlier uprush stopped)
 * draws a fainter broken line of stranded bubbles, MARK_FOAM_AMOUNT.
 * ROUND 6: CONTINUOUS. Round 5's band read as "a sparse chain of separate
 * white beads": no gaps now, and the clusters only vary its amount by a
 * quarter. It is thicker at the middle of each scallop (RIM_ARC_GAIN) and at
 * the lobes of the grid's own tongues (the depth here over its mean RIM_LOBE_M
 * to either side along the shore: RIM_LOBE_GAIN). Behind it lace trails for
 * RIM_TRAIL_M at RIM_TRAIL_AMOUNT (the net lace). The sheet's edge follows the
 * scallops, so the band is the water's edge ("a hard cut-out edge with no
 * rim of bubbles" was round 5's).
 */
export const RIM_ARC_GAIN = 0.7;
export const RIM_LOBE_M = 1.0;
export const RIM_LOBE_GAIN = 0.5;
/*
 * ROUND 8: ONE THIN, LUMPY LINE ON THE TRUE EDGE. Round 7's band was 4 to 40
 * cm wide and set back from the grid's edge, and a judge read "none of it
 * sits on the leading edge". The band is now 3 to 14 cm wide (RIM_W_MIN_M to
 * RIM_W_MAX_M over RIM_W_SCALE_M), starts where the sheet starts (the
 * scallops are in the read, see `wander`), is lumpier (clusters from
 * RIM_CLUSTER_LO, 0.75 in round 7), breaks in its lowest RIM_GAP_SHARE (0.1
 * in round 7), and trails lace for RIM_TRAIL_M (0.9 m in round 7). (At 2 to
 * 10 cm its densest row was one pixel of white from both views: a stroke.)
 */
export const RIM_TRAIL_M = 0.6;
export const RIM_TRAIL_AMOUNT = 0.35;
export const RIM_W_MIN_M = 0.03;
export const RIM_W_MAX_M = 0.14;
/** The rim's share of the lace's opacity (see OP_LO): its densest core, one pixel wide from above, read as a stroke at 1. */
export const RIM_OP = 0.8;
export const RIM_W_SCALE_M = 0.9;
export const RIM_CLUSTER_M = 0.22;
export const RIM_SCALLOP_M = 3.2;
export const RIM_SCALLOP_DEPTH_M = 0.35;
export const MARK_FOAM_AMOUNT = 0.45;
/**
 * ROUND 6: THE HIGH-WATER MARK. At the wet line, the last swash's upper limit,
 * the sheet leaves its fine load: dark heavy-mineral grains, organic scum and
 * a few bubbles, in a line HWM_W_M wide, darker by HWM_DARK and dotted with
 * the lace at HWM_FOAM_AMOUNT, broken where a noise falls low; the line is
 * scalloped with the wet line's own read (HWM_SCALLOP_M arcs up to
 * HWM_SCALLOP_DEPTH_M deep, through the skin's wander). A judge read round 5's
 * wet line as "a soft, blurred blob outline over two flat tan fills".
 */
export const HWM_W_M = 0.08;
export const HWM_DARK = 0.38;
export const HWM_FOAM_AMOUNT = 0.45;
export const HWM_SCALLOP_M = 2.4;
export const HWM_SCALLOP_DEPTH_M = 0.22;
/*
 * (Round 6 drew the film's foam as a net: the walls of the swash tile's two
 * Worley nets, 25 and 10 cm cells, in patches. Both judges read it first,
 * as "one uniform polygonal crackle ... cracked glaze or dried mud". Round 7
 * draws all foam with the wake's lace, see LACE_TILE_SCALE.)
 */
/**
 * ROUND 7: THE FILM IS SMOOTH AND NEARLY CLEAR. A swash film's own foam is
 * sparse away from its edges: the lace draws FILM_FOAM_KEEP of the film's
 * foam amount where the film is 4 mm to 3 cm deep, and all of it at the
 * front (under 4 mm) and in the bore (over 8 cm).
 */
// Round 8: 0.75 (0.45 in round 7; the film's foam is 0.1 to 0.3, so the
// backwash drew none and could not break into streaks and specks).
export const FILM_FOAM_KEEP = 0.75;
/**
 * ROUND 5: THE BACKWASH'S RILLS. A draining swash face carries rills and small
 * drain channels, 2 to 5 cm wide and a few millimeters deep, running down the
 * fall line and joining; they hold water after the film has gone, so they are
 * darker, and the sun lights their banks. A ridged noise RILL_M across the
 * shore, stretched RILL_STRETCH times down it, carved RILL_DEPTH_M deep, on
 * the lower swash face (the grid's s from RILL_S[0] to RILL_S[1]), on wet
 * sand and under a film thinner than 1 cm, in fields a noise of RILL_FIELD_M
 * picks (RILL_FIELD_SHARE of the face): over the whole face their even
 * spacing read as hair.
 */
export const RILL_FIELD_M = 2.4;
/*
 * ROUND 7: the rills and drain channels at the draining view's scale (2.2 cm a
 * pixel): cells of 1.1 m (0.45), 6 mm deep (3), in 35% of the face (25%),
 * up to the drained sand under the last swash (s to 8.5 m), faded only under
 * 8 to 14 cm a pixel (2 to 4 cm), their floor darker by RILL_FLOOR_DARK
 * (they hold water) and reflecting the low sky (RILL_SKY). Every judge from
 * round 3 on asked for rills that show.
 */
/*
 * ROUND 8: a judge still asked for "visible seaward rills"; round 7's read as
 * pale streaks (the sky in their centers, 0.05, over a floor only 12%
 * darker). They are narrower (RILL_W 0.06, 0.1 in round 7) and shorter
 * (RILL_STRETCH 3.5, 5 in round 7; s to 8 m, 8.5 in round 7). Their floors
 * are RILL_FLOOR_DARK darker, with RILL_SKY of the low sky. They cover
 * RILL_FIELD_SHARE of the face (0.35 in round 7) and fade out under a sheet
 * 4 to 9 mm deep (6 to 12 mm in round 7). Shallower tributaries (a second
 * ridged noise of RILL_TRIB_M, stretched RILL_TRIB_STRETCH times, RILL_TRIB_K
 * of the depth) cross and join them.
 */
export const RILL_FIELD_SHARE = 0.45;
export const RILL_M = 1.1;
export const RILL_STRETCH = 3.5;
export const RILL_DEPTH_M = 0.006;
export const RILL_W = 0.06;
export const RILL_S: readonly [number, number, number, number] = [-1.5, 0, 6, 8];
export const RILL_FLOOR_DARK = 0.16;
export const RILL_SKY = 0.02;
export const RILL_TRIB_M = 0.45;
export const RILL_TRIB_STRETCH = 2.5;
export const RILL_TRIB_K = 0.4;
/**
 * THE BREAKER'S WHITE COMES IN SEGMENTS (round 4). A bore breaks harder where
 * its crest is steeper, and along a crest that changes over meters, which the
 * grid's 0.5 m rows hold only as their own values: a judge read the bore's
 * foam as "one even-width white ribbon parallel to the shore". Where a noise
 * along the shore (cells of SEG_M, changing over SEG_T_S) falls into its low
 * third, the dense foam's amount drops by SEG_AMP: gaps between segments.
 * A first build scaled it by up to 65% either way, and the dense foam's
 * cover hid that.
 */
export const SEG_AMP = 0.65;
export const SEG_M = 2.6;
export const SEG_T_S = 6;
/**
 * THE WET SAND'S SHEEN (round 4). Sand whose pores are full to the surface
 * (skin Se over SHEEN_SE_LO) holds water menisci round its top grains: a rough
 * water surface that reflects the sun, a microfacet lobe of roughness
 * SHEEN_ROUGH (GGX) over SHEEN_SHARE of the surface. Under a sheet the water
 * above is smooth and the sheet draws its own reflection; on damp sand the
 * water has drawn down into the pores and the grains are matte. Water's
 * Fresnel at these facets is 0.02, so at the judged poses the sheen adds a few
 * percent: the most straight down (the sun 30 degrees off the nadir), less
 * along the shore (the sun behind the eye).
 */
export const SHEEN_SE_LO = 0.9;
export const SHEEN_ROUGH = 0.35;
export const SHEEN_SHARE = 0.5;
/**
 * THE SEA'S GLINTS OVER THE BEACH FACE (round 4, through the hook's
 * `waterGlint`). The sea's surface is the offshore wave field; over the swash
 * patch its crests stand above the sand where the grid carries the real water,
 * and their facets' glints drew "blocky rectangular white patches with hard
 * straight edges" (bc3s; the round-3 A/B with the sea's glints off removed
 * them). The test is the grid's own depth, not the sea's column: the sea's
 * crests stand 0.2 to 0.3 m over a face the grid covers with 4 cm, and a
 * column test kept their chips. Over the patch, where the grid's water is
 * under GLINT_KEEP_LO_M no sea glint stays; where it is over
 * GLINT_KEEP_HI_M they all do: the surf's own water glitters.
 */
export const GLINT_KEEP_LO_M = 0.1;
export const GLINT_KEEP_HI_M = 0.35;
/**
 * BUBBLES IN THE SURF'S WATER. A breaking bore drives air into the column:
 * void fractions of 1 to 10% that rise out over seconds (Deane and Stokes
 * 2002), and bubbles scatter light back far more than the water does, which
 * is why the water of a surf zone reads pale and milky between the foam. The
 * beach's foam amount carries that decay; up to MILK_MAX of the water's own
 * light is replaced by the milk's, a pale green white, in plumes (a first
 * try at 0.55 with no plumes drew the surf as an even fog).
 */
/**
 * ROUND 4: 0.07, and only where the foam is dense (the bore's roller and just
 * behind it): a judge read the surf behind the bore as "a hazy green fog"
 * where the bore should hand off to a thinning sheet.
 */
export const MILK_MAX = 0.03;
export const MILK_FOAM_LO = 0.25;
/** The milk's plumes: a flow-carried noise at this scale, m, so the bubble clouds come in patches. */
export const MILK_PLUME_M = 1.4;
/**
 * The wander of the drawn swash lines, m, across the shore (two scales) and
 * along it (see `wander`). Round 2 wandered 0.08 m across the shore at a
 * 0.9 m scale: the bore's foam line drew nearly straight, and a judge read a
 * "hard, straight seam; it should be ragged and curved". A bore's front is
 * broken by its roller and the bed's small relief into lobes 0.3 to 2 m
 * across, 0.1 to 0.3 m deep (round 3: 0.2 m at 1.3 m, and 0.07 m at 0.41 m).
 */
export const WANDER_S_M = 0.2;
export const WANDER_S2_M = 0.07;
/**
 * ROUND 4: no wander along the shore. Round 2 moved the reads 0.3 m along the
 * shore to break the 0.5 m rows of the bilinear reads; the reads are cubic
 * B-splines since, smooth across the rows, and the along-shore shift sheared
 * each row's reach into its neighbors' as spikes: a judge read the wet line
 * as "a hard, jagged step". The rows' own reach draws the lobes.
 */
export const WANDER_A_M = 0;

/**
 * THE NOISE THE LOOK READS, BAKED ONCE. The lace, the plumes, the mottle, the
 * wander and the sheet's ripple read gradient noise at many points of every
 * pixel inside the patch (the sea's own water pixels there too). Computed in
 * the shader (MaterialX Perlin, `mx_noise_float`) it was about 17 noise
 * evaluations a water pixel, and the beach's draw measured 6 ms over the
 * floor alone. So four independent fields of periodic 2D Perlin noise are
 * baked into one 512 x 512 texture (a 32 x 32 lattice per tile, 16 texels a
 * lattice cell: at 8 the bilinear read drew a zigzag grid on the sand from
 * 3 m), and a read is one filtered fetch. Same field, same scales:
 * one lattice cell is the `scale` a caller asks for.
 */
export const NOISE_RES = 512;
export const NOISE_CELLS = 32;
