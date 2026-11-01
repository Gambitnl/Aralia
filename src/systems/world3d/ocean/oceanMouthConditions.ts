/**
 * @file oceanMouthConditions.ts
 * Owns the measured place conditions and their wind and display choices.
 * Records and rules are copied intact from the public mouth facade. This move
 * changes neither the recorded observations nor any place-specific choice.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:30:33
 * Dependents: systems/world3d/ocean/oceanMouthCoast.ts, systems/world3d/ocean/oceanMouthMath.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type MouthDisplayCurve, type MouthPlaceConditions, type MouthPlace } from './oceanMouthTypes';
import { G } from './oceanBeachMath';
import { jonswapPeakOmega } from './oceanSpectrum';

export function mouthDisplayCurve(c: MouthDisplayCurve, l: number): number {
  const y = Math.max(c.exposure * l, 0) ** c.gamma;
  return y / (1 + y);
}
export const SARCELLE_CONDITIONS: MouthPlaceConditions = {
  overcast: 0,
  cloudShare: 0.569,
  reflectedBandLuma: 184,
  sandSrgb: [126, 116, 115],
  chopPeakM: 0.477,
  /* ROUND 8 (law 3): the near field's median fetch RE-MEASURED (mouth8/probe/probeFetch8.ts: 63 m over 2090 wet
   * cells after the spin-up, 60 m at rest; the worker's \`localFetchM\`). Round 4 fit the wind at 117 m, the
   * median of the grid of that time; the band is drawn at the worker's 63 m, so its peak fell to 0.28 m against the
   * clip's 0.477 m, and the drawn chop was the young sea's short tail (8 px highlights across against the clip's
   * 35). At 63 m the peak law gives 11.3 m/s over the water (the surf sea state's own wind is 12 m/s): the drawn
   * peak 0.45 m. A test ties this record to the near field's median. */
  chopFetchM: 63,
  waterRInf: [0.2226, 0.2059, 0.2143],
  // Round 6 (mouth6/deck-fit.txt): tau 5 (a thin deck: 0.56 of the beam through at the 30 degree sun),
  // shape 1.5, air 0.06 (with the 1500 m base an extinction length of 25 km: a 98 km visibility, Koschmieder).
  deckTau: 5,
  deckTauShape: 1.5,
  deckAirK: 0.06,
  deckSunMean: true,
  /* ROUND 10 (law 1): THE CLIP IS SHOT AT LOW WATER. Its bar stands bare across the frame (rows 300 to 345 of
   * mouth/ref/sarcelle-join-t4.png) with the debris of the last high water strewn on it (mouth10/clip/bar2.png), thin
   * sheets of swash over it, and the surf breaking at its seaward edge: the water stands at or under the crest. The
   * record holds no tide gauge; the coast's mean range bounds it: the Caribbean coast's tide is a
   * small mixed tide of about 0.4 m (the lead's bound), so the low water stands half of it under the mean sea level.
   * The level is the bound's low water, -0.20 m, and no more: the clip cannot give a level to the centimeter (its
   * sheets are a few centimeters deep over a crest whose height the image does not give). A crest at round 9's
   * 0.61 m under the mean sea level stays 0.41 m under this water: a tide inside the range cannot bare round 9's
   * bar. The swash bar that the clip shows (`swashBarCrestM`) is drowned by the record's discharge (see
   * `deriveMouthDesign`, THE TIDE AND THE SWASH BAR): the clip's bare bar asks for a low flow on its day. */
  tideM: -0.2,
  tidalRangeM: 0.4,
  /* ROUND 11 (law 1): THE CLIP'S DAY RAN AT LOW WATER AND LOW FLOW. The clip shows the bar bare between the spits:
   * over its crest band (rows 305 to 345, columns 0 to 1000 of mouth/ref/sarcelle-join-t4.png) 0.893 of the pixels
   * are sand (red over blue at least 1.0; the river and the sea under the bar read 0.000 by the same test), with
   * thin swash sheets over it and the last high water's debris on it. By the swash bar's law in the one water
   * (`swashBarCrestM`; the near field out past the bar, mouth11/probe/probeDay11.ts) the bar stands bare where the
   * river's stage behind it stays under the crest, so the crest's bare share with the waves off falls with the flow:
   * 0.992 at 1 m^3/s, 0.969 at 2.36, 0.923 at 3.63, 0.878 at 4.49, 0.817 at 5.57, 0.000 at the mean 31. The day's
   * flow is the one that leaves the clip's share bare: by bisection 4.20 m^3/s (4.15 to 4.26), the river's own sheet
   * over the wet crest cells 2.1 cm (p50). With the waves on at that flow the swash sheets over the crest are 4.5 cm
   * (p50), the clip's thin sheets. A test holds the record to the law. */
  dayDischargeM3S: 4.2,
  barBareShare: 0.893,
  /* ROUND 12 (gap 2; the lead's ruling 2): THE SEA ON THE CLIP'S DAY. The lead asked for the offshore Hs that leaves the
   * clip's bare share (0.893) with the waves ON at the day's discharge (mouth12/probe/probeSea12.ts, the near field as
   * the page builds it): 0.402 / 0.731 / 0.816 / 0.866 / 0.885 at Hs 0.4 / 0.2 / 0.12 / 0.06 / 0.03 m, and the waves
   * off 0.895; the windows' sampling spread is 0.01 to 0.02. The share reaches 0.893 only as the sea goes flat: round
   * 11 spent this measure on the discharge with the waves off, so it cannot fix the sea too (the bisection is in
   * mouth12/probe/sea-bisect.log). The clip carries a second measure: its breakers on the bar's seaward face
   * (mouth12/breakerHeight12.py: the white faces' median height 0.157 / 0.171 / 0.199 m at luma 210 / 190 / 170, rows
   * 309 to 315, about 75 m off). The sea that brings waves of that rms height to the near field's sea edge by the
   * coast's own Battjes and Janssen march (`mouthEdgeBore`, mouth12/probe/breakerSea12.ts): 0.187 / 0.204 / 0.238 m,
   * mid 0.215 m (the mean sea state's 2.43 m: an energy share of 0.0078). At that sea the bar's crest is bare about
   * 0.70 of the time (the clip 0.893): the difference is the bar's own size and height (round 11's open item 1).
   * ROUND 15 (ruling 3; GG-417 closed for this record): THE FACES RE-MEASURED AT THE JUDGED EYE (mouth15/faces15.py).
   * Round 12's faces were read at the old pose's 1.75 m eye; the judged eye stands 1.22 m over the pond, 1.478 m over the
   * low-water sea, so the same rows (median 297.5) stand 1.35 times farther (118 m from the eye, 74 m off the shoreline,
   * inside the band's +-30 m) and the faces 1.35 times taller: p50 0.366 m at luma 170, 190 and 210 alike (p90 0.61 to
   * 0.75). The coast's own march (probe/surf15.ts, the terrace's top at the band's inner edge) brings a significant
   * breaking wave H_s = sqrt(2) Hrms of 0.28 / 0.32 / 0.36 / 0.40 m to the terrace's front for an offshore Hs of 0.215 /
   * 0.25 / 0.29 / 0.33 m: the clip's faces ask 0.29 m (the ratio 1.35 of round 12's 0.215, the eye's own ratio). The
   * band's WIDTH does not fix the sea: on a flat terrace every candidate breaks at the front and its bores die over
   * 10 m (Q_b 0.45 to 0.11 from 54 to 45 m); the white band is the front. Both values stand here: 0.215 (the faces at
   * the wrong eye) and 0.29 (at the judged eye); the record runs the judged eye's. */
  daySeaHsM: 0.29,
  /* ROUND 12 (gap 1; the lead's ruling 1): THE RIVER WATER'S OWN COLOR, measured (mouth12/cdomFit12.py, the renderer as
   * the instrument). At the day's 25 g/m^3 the particles (the mean flow's fit) give R_inf 0.135 / 0.188 / 0.206; each
   * candidate a_g(443) (0, 0.5, 1, 2, 4, 8 1/m) sets R_inf and Kd by Gordon's law (`placeRiverOptics`), and the judged
   * frame's river bands (rows 380 to 900) give their R/G and B/G against the clip's (the two skies agree: R/G 0.856 /
   * 0.843, B/G 1.151 / 1.148). The clip's river is BLUER than green in every band (B/G 1.167 / 1.206 / 1.225 / 1.282),
   * bluer than its own sky; a dissolved absorber takes the blue first, so every a_g over 0 moves the frame away from
   * the clip (B/G at rows 700-900: 1.013 at 0, 0.889 at 0.5, 0.790 at 2). The least squares fall on the bound: a_g = 0,
   * rms log-ratio residual 0.114 (the residual by band, log R/G and log B/G: -0.055 / -0.056, -0.056 / -0.106,
   * -0.032 / -0.145, -0.081 / -0.235: our water is still less blue than the clip's). The clip's river is not brown by
   * its own pixels; its day's water is the catchment's mineral at the day's load, with no tannin. */
  cdomAg443M: 0,
  /* ROUND 13 (law 1; GG-413): THE DRIFT, MEASURED ON THE CLIP (mouth13/clipLines13.py). The clip's pose (vertical fov 50,
   * the horizon at row 285, roll under 0.2 degrees by the far waterline's slope over columns 375 to 1575) takes each
   * image line onto the ground plane. The breakers: the white runs (luma over 190, rows 288 to 325, over 25 px long; ten
   * runs) on the ground lie at -35.3 degrees to the image's x axis (pixel-weighted; the four longest -48.7 / -42.6 /
   * -33.8 / -35.1), each run's far end to the left. The shore: the platform's near edge (the lowest row where the sand's
   * R/B is at least 1, columns 0 to 1000) lies at -9.3 degrees. The breakers stand at 26.0 degrees to the shore (24.5 to
   * 39.4 over the four longest runs): the waves come in from the right of the camera's seaward view and drive the sand
   * to its left, toward -a (looking seaward the right hand is +a). The camera's heading is 9.3 degrees left of the
   * shore's seaward normal, toward the outlet. */
  drift: { breakerAngleDeg: 26.0, sense: -1 },
  /* ROUND 15 (ruling 1): THE DAY'S LOAD, FITTED TO THE CLIP (mouth15/loadFit15.py; set by the fit, see the doc's
   * Round 15 block). Null here means the rating curve's load. */
  dayLoadGM3: null,
  /* ROUND 15 (ruling 3): THE CLIP'S SURF BAND, re-derived at the judged eye (mouth15/clipSurf15.py). The white breaker
   * rows of mouth/ref/sarcelle-join-t4.png (rows 296 to 300: over luma 200 on 2.9 to 5.1 % of each row, then 0.06 % at
   * row 301) stand 54 to 90 m off the mean-sea shoreline for an eye 1.478 m over the low-water sea (1.22 m over the pond,
   * the pond 0.26 m over the low water at a 130, the crest 43.7 m from the eye); round 13's 39 to 64 m projected the
   * same rows at an eye of 1.0 m. The rows lie 0.63 to 0.87 degrees under the horizon: the outer edge carries +-30 m
   * for a 2 px horizon, the inner edge +-8 m. The inner edge is the terrace's top edge (the day's sea breaks at the
   * terrace's front and dies over about 10 m inside it, probe/surf15.ts); the band is the front itself: the face's 1:11
   * from the top at 54 m to the coast's own floor (3.3 m of fall over 36 m, which ends at 90 m, the outer edge). */
  surfBandM: [54, 90],
  /* ROUND 11 (the lead's ruling 3): THE CLIP'S CAMERA CURVE by measure (mouth11/fitCurve11w.py on the judged frame shot
   * with the viewer's curve set to linear, mouth11/shots/f5tone-linear_*-mouth-join9.png): per channel y = (e L)^g,
   * D = y / (1 + y), fitted by least squares on the log of the band means against the clip's displayed linear light,
   * over the sky band (2 to 15 degrees up) and the five river bands (rows 330 to 900): e 2.756, g 1.599, residual by
   * band +0.077 sky, -0.093 / +0.021 / +0.026 / -0.089 / +0.083 (rms 0.072). The bar's band (rows 300 to 330) and the
   * surf's foam do not fit by any curve of the form: our linear light there is under the river's and under the sky's
   * (the foam's top 1 % is 0.90 of the sky band where the clip's is 1.97, the bar band 0.31 where the clip's is 0.54),
   * so their order differs from the clip's; with them in the fit the rms is 0.245 and those two stay at -0.36 and
   * -0.40. That gap is in the light (the surf's foam and the bar's sheets), not in the curve. */
  displayCurve: { exposure: 2.756, gamma: 1.599 },
  source: 'mouth4/skyMeasure.py and skyBand.py, mouth5/calib.py, mouth6/skyDeckMeasure.py and probe/fitDeck6.ts on mouth/ref/sarcelle-join-t4.png',
};
/** The conditions of a place, or null for the open sea's (the creek has no clip yet). */
export function mouthPlaceConditions(place: MouthPlace): MouthPlaceConditions | null {
  return place === 'sarcelle' ? SARCELLE_CONDITIONS : null;
}

/**
 * THE WIND THAT GROWS A YOUNG SEA OF PEAK WAVELENGTH lam AT FETCH X (round 4):
 * the root U of JONSWAP's peak law, jonswapPeakOmega(U, X) = sqrt(2 pi g / lam)
 * (it falls with U), by bisection over 0.5 to 40 m/s.
 */
export function windFromChop(lamM: number, fetchM: number): number {
  const w = Math.sqrt((2 * Math.PI * G) / lamM);
  let lo = 0.5;
  let hi = 40;
  for (let k = 0; k < 80; k += 1) {
    const mid = 0.5 * (lo + hi);
    if (jonswapPeakOmega(mid, fetchM) > w) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}
/** The place's wind over the river, m/s: from the clip's chop, less the outflow under it; null without a measure. */
export function placeRiverWindMS(place: MouthPlace, outflowMS: number): number | null {
  const c = mouthPlaceConditions(place);
  if (c === null || c.chopPeakM === null) return null;
  return Math.max(windFromChop(c.chopPeakM, c.chopFetchM) - outflowMS, 0.5);
}
