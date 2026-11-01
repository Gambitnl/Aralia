/**
 * @file oceanMouthTypes.ts
 * Shared public contracts for the CPU mouth concerns.
 * These original type declarations contain no runtime initialization. Keeping
 * them together lets the intact algorithms share contracts without value cycles.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/10/2026, 02:30:33
 * Dependents: systems/world3d/ocean/oceanMouthCoast.ts, systems/world3d/ocean/oceanMouthConditions.ts, systems/world3d/ocean/oceanMouthFineChop.ts, systems/world3d/ocean/oceanMouthJet.ts, systems/world3d/ocean/oceanMouthMath.ts, systems/world3d/ocean/oceanMouthSimulation.ts, systems/world3d/ocean/oceanMouthTransport.ts, systems/world3d/ocean/oceanMouthWaveMath.ts, systems/world3d/ocean/oceanMouthYoungSea.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type BeachFrame, type SwashGridSpec } from './oceanBeachMath';
import { type SeabedValley, type SeabedParams, type V3, type SeabedCourse } from './oceanSeabedMath';
import { type TurbidOptics, type RiverIop } from './oceanMouthOptics';
import { type MouthField, type MouthState } from './oceanMouthField';
import { type CascadeParams } from './oceanConfig';


/** One FFT band as the surface's damping laws see it. */
export interface MouthBand {
  readonly name: string;
  /** Angular frequency of the period that carries the band's energy, rad/s (`bandPeriodS`). */
  readonly omega: number;
  /** The FFT's own depth for the band (TMA), m. */
  readonly depth0M: number;
  /** Unit heading the band's waves travel toward (its wind), world XZ. */
  readonly dirX: number;
  readonly dirZ: number;
  /** True when the near-field grid carries this band (it forces the grid's sea edge). */
  readonly forced: boolean;
  /** The band's group speed at its FFT depth, m/s (the shoaling ratio's reference). */
  readonly cg0MS: number;
  /**
   * The band's significant height offshore of the coast, m (4 sigma of the
   * FFT sea's own height on the CPU, `seaStatsAt`, 200 m out). The surface's
   * envelope hold reads it (oceanSurface.ts, setRiver). 0 when the coast
   * did not measure it.
   */
  readonly hsM: number;
  /**
   * ROUND 2, THE RIVER'S OWN SURFACE: true for a band the WIND HOLDS IN
   * PLACE (`windLockedBands`): its waves regrow under the wind over a shorter
   * distance than the river is wide, so on the river its share is the local
   * wind sea's (`localBandShares`), not the sea's waves carried in against
   * the current. False for the bands the grid carries.
   */
  readonly local: boolean;
  /** The band's wind, m/s, its fetch, m, its spectrum's tail power, and its angular frequency range, rad/s. */
  readonly windMS: number;
  /**
   * ROUND 4: the wind over the river at the place (`MouthPlaceConditions`:
   * the clip's chop), m/s, for the local wind sea on the near field; the
   * band's own wind where the place has no measure.
   */
  readonly localWindMS: number;
  readonly fetchM: number;
  readonly tailPower: number;
  readonly omegaLo: number;
  readonly omegaHi: number;
  /**
   * ROUND 3: how far the surface stretches this band's field along its crests
   * on the river (`crestStretchOf`): 1 for every band but a wind-locked one,
   * and 1 until the near field's fetch is known (the worker measures it).
   */
  readonly crestStretch: number;
  /**
   * ROUND 4: THE YOUNG SEA'S PEAK CUT on the river (`localPeakCut`): the box
   * width, m, over which the surface takes the band's mean slope off its own
   * (the band's waves longer than the local sea's peak), and the gain that
   * gives what is left the band's whole slope variance back. Absent: no cut.
   */
  readonly peakCutM?: number;
  readonly peakCutGain?: number;
}

export interface MouthDesign {
  readonly dischargeM3S: number;
  /** Channel top width at the mouth and thalweg depth under the mean sea level there, m. */
  readonly widthM: number;
  readonly depthM: number;
  readonly shapeP: number;
  readonly manningN: number;
  readonly slope: number;
  /** Cross-section area at the mouth, m^2, and the outflow's mean speed there, m/s. */
  readonly areaM2: number;
  readonly u0MS: number;
  readonly bankSlope: number;
  /** The beach's frame; the mouth's axis is its s axis at a = mouthA. */
  readonly frame: BeachFrame;
  readonly mouthS: number;
  readonly mouthA: number;
  readonly mouthX: number;
  readonly mouthZ: number;
  /** The valley head's distance inland of the mouth, m. */
  readonly headM: number;
  /** The sea at the mouth's sea edge: significant height (4 sigma), m; zero-up-crossing period, s; surface orbital speed pi Hs / Tz, m/s. */
  readonly hsM: number;
  readonly tzS: number;
  readonly uOrbMS: number;
  /**
   * The jet: its core's length (round 3: the friction-dominated jet's zone of
   * flow establishment, where the core's half-width reaches 0), m; the sand's
   * threshold speed over the bar's crest (van Rijn 1984), m/s; the bar's
   * distance seaward of the mouth (the jet's first deposition lobe), m.
   */
  readonly coreM: number;
  readonly uCritMS: number;
  readonly barM: number;
  /** ROUND 3: the friction-dominated jet along its axis (`frictionJet`), and the deposit it lays (`jetDeposit`). */
  readonly jet: FrictionJet;
  readonly deposit: JetDeposit | null;
  /** The bar crest's depth, m, and its disc (world XZ, inner and outer radius, m), and the floor's depth there without it. */
  readonly barCrestDepthM: number;
  /**
   * ROUND 10: the still water's height over the mean sea level (the place's tide, `MouthPlaceConditions.tideM`;
   * the floor's `stillLevelM`), m, and the bar's crest law: 'swash' (round 10, the swash bar's crest at the low
   * water's run-up, `swashBarCrestM`) or 'break' (rounds 3 to 9, the crest at the depth its wave breaks in full).
   * The crest's depth (`barCrestDepthM`) is under the mean sea level: negative stands over it.
   */
  readonly tideM: number;
  readonly barLaw: 'swash' | 'break';
  readonly bar: { readonly xM: number; readonly zM: number; readonly innerM: number; readonly outerM: number; readonly depthM: number; readonly floorDepthM: number; readonly laterM: number } | null;
  /**
   * ROUND 6: the coast's surf zone where the sea's waves first break in full
   * (`coastBreakRef`): the breaking depth, m, the floor's slope there and the
   * surf zone's width (the rip spacing law's scale, see THE BAR'S PLANFORM).
   */
  readonly surfRef: { readonly depthM: number; readonly slope: number; readonly widthM: number };
  readonly valley: SeabedValley;
  /** The seabed with the valley and the bar: the beach's and the mouth's one floor. */
  readonly params: SeabedParams;
  readonly grid: SwashGridSpec;
  /** The suspended load, g/m^3 (`ratingCurveGM3` at this flow), and the mean flow the curve is set at, m^3/s. */
  readonly sedimentGM3: number;
  readonly meanDischargeM3S: number;
  readonly place: MouthPlace;
  /** The river water's optics; round 5: with the inherent properties they come from (`iop`). */
  readonly optics: TurbidOptics & { readonly iop?: RiverIop };
  readonly bands: readonly MouthBand[];
  /**
   * ROUND 12 (gap 2): the mean sea's forced significant height offshore (the sea state's, `SurfCoast.hsM`), m, and the
   * day's sea as a share of its forced bands' energy (`daySeaCascades`; 1 for the mean sea). `hsM` is the day's.
   */
  readonly meanSeaHsM?: number;
  readonly seaEnergy?: number;
  /**
   * ROUND 14 (ruling 1): the coast's peak period, s (`SurfCoast.tpS`: the day's sea keeps the mean sea's periods), and
   * whether the near field's sea edge carries the infragravity band (`infragravityEdge`). Absent tpS: no band.
   */
  readonly tpS?: number;
  readonly infragravity?: boolean;
  /** ROUND 14: the band's edge height over the linear law's (`MOUTH_IG_FIELD_GAIN`; a measure rig's switch). */
  readonly infragravityGain?: number;
  /**
   * ROUND 13 (law 1; GG-413): the planform. 'deflected': the spit by the drift law (`spit`), the channel behind it on
   * the valley's course (`valley.course`, `course`); 'straight': rounds 1 to 12's straight valley.
   */
  readonly planform?: 'deflected' | 'straight';
  readonly spit?: DeflectedSpit;
  readonly course?: DeflectedCourse;
  /**
   * ROUND 15 (ruling 2): the day's low-flow channel (`lowFlowChannelOf`) on the deflected reach; absent on the straight
   * valley or with the switch off (`&mouthlow=0`). `u0MS` is then its speed and the day's jet leaves through its section.
   */
  readonly lowFlow?: LowFlowChannel;
  /** ROUND 15 (ruling 1): the rating curve's load at the day's flow, g/m^3, kept beside the record's fitted `sedimentGM3`. */
  readonly ratingLoadGM3?: number;
}

export interface SurfCoast {
  readonly params: SeabedParams;
  /** The sea offshore of the beach: significant height, zero-up-crossing period and the peak band's period, m and s. */
  readonly hsM: number;
  readonly tzS: number;
  readonly tpS: number;
  /** Stockdon's (2006) 2% run-up on the face, m: the berm's height. */
  readonly runup2M: number;
  readonly deanA: number;
  /** Each band's significant height 200 m out, m (`seaStatsAt` on that band alone). */
  readonly bandHsM: Readonly<Record<string, number>>;
}

/** The places that hold a mouth (`COAST_PLACES`), by the name `?mouthplace=` takes. */
export type MouthPlace = 'sarcelle' | 'creek';
export interface InfragravityEdge {
  /** The incoming long wave at the edge, m, one value per sample (periodic over the series' span). */
  readonly etaM: Float64Array;
  /** Its rms, m; the band's mean period, s; z at the edge; the shoreline's rms elevation the law asks, m. */
  readonly rmsM: number;
  readonly periodS: number;
  readonly zEdge: number;
  readonly shoreRmsM: number;
}

export interface MouthSim {
  readonly design: MouthDesign;
  readonly field: MouthField;
  /** The sea edge's incident sea (round 10: the sum of one IncidentWaves a forced band where the edge is warped). */
  readonly waves: { heights(t: number, out: Float64Array): void; readonly points: number };
  /** The start state (after the spin-up), the clock's t = 0. */
  readonly start: MouthState;
  /**
   * ROUND 4: the sea edge's forcing per row: the shoaled series' rms height,
   * the rms height Battjes and Janssen's balance leaves there (`mouthEdgeBore`),
   * and the gain the series takes (their ratio, at most 1), m and 1.
   */
  readonly edgeBore: { readonly hrmsLinearM: Float64Array; readonly hrmsLawM: Float64Array; readonly gain: Float64Array };
  /** ROUND 11 (law 1): each grid row's hand-over start, s (`mouthHandoverStarts` at the edge's law height). */
  readonly handoverS: Float64Array;
  /** ROUND 14 (ruling 1): the infragravity band at the sampled edge rows (`infragravityEdge`; null: none). */
  readonly infragravity: { readonly rows: readonly number[]; readonly edges: readonly InfragravityEdge[] } | null;
  /** ROUND 14: the spin-up this field ran, s (on a deflected coarse pre-run: to the pond's steady level). */
  readonly spinUpS?: number;
}

/** The jet along its axis, sampled seaward of the mouth line (`frictionJet`). */
export interface FrictionJet {
  readonly n: number;
  /** Distance seaward of the mouth line, m. */
  readonly xM: Float64Array;
  /** The core (or centerline) speed, m/s; the core's half-width, m (0 once established); the shoulders' sigma, m. */
  readonly ucMS: Float64Array;
  readonly rcM: Float64Array;
  readonly sigmaM: Float64Array;
  /** The water depth on the axis, m (the coast's floor without the bar). */
  readonly hM: Float64Array;
  /** The jet's volume and momentum flux, m^3/s and m^4/s^2. */
  readonly qM3S: Float64Array;
  readonly mM4S2: Float64Array;
  /** The river water's share on the axis, and its shoulders' sigma over the speed's. */
  readonly cmShare: Float64Array;
  readonly lamE: Float64Array;
  /** The jet's sand flux, m^3/s (Soulsby and van Rijn 1997), and its fall, -dQs/dx, m^2/s. */
  readonly qsM3S: Float64Array;
  readonly depositM2S: Float64Array;
  /** The wave-raised mean stress over the current's own (Soulsby 1995), on the axis. */
  readonly stirGain: Float64Array;
  /** The share of the river's suspended load still in the column (`SUSPENDED_D50_M`). */
  readonly settle: Float64Array;
}

/** The bar the jet lays: its first deposition lobe seaward of the mouth (see the section's note). */
export interface JetDeposit {
  /** The lobe's center of mass, m from the mouth line; where its deposition stands over half its peak; where it ends. */
  readonly xM: number;
  readonly halfFromM: number;
  readonly halfToM: number;
  readonly fromM: number;
  readonly toM: number;
  /** The peak deposition, m^2/s, and the sand the lobe takes from the jet, m^3/s. */
  readonly peakM2S: number;
  readonly sandM3S: number;
}

export interface JetPoint {
  /** Speed along the jet's axis (seaward), m/s. */
  readonly u: number;
  /** River water's share at the surface, 0 to 1. */
  readonly c: number;
  /** The jet layer's thickness, m. */
  readonly deltaM: number;
  /** The centerline speed and share at this distance. */
  readonly um: number;
  readonly cm: number;
  /** The scalar's profile here, 0 to 1 (1 on the axis): the front lies where it is 0.5. */
  readonly gc: number;
  /** Round 3: the share of the suspended load still in the column here (the plume's settling). */
  readonly settle: number;
}
/**
 * THE LENS SPREADS AS A GRAVITY CURRENT (Garvine 1974; Benjamin 1968). Past the mouth the lens's two side fronts run
 * out over the sea's water at a gravity current's front speed, sqrt(2 g' h) (Benjamin's front into a deep ambient),
 * while the lens runs seaward at its own critical speed u = q / h; its width W grows by dW / dx = 2 sqrt(2 g' h) / u,
 * and its flux per unit width q = Q / W falls, so it thins, h = (q^2 / g')^(1/3) (`buoyantLensM`). At the clip's day
 * (4.2 m^3/s from a 40 m mouth) the lens is 0.35 m thick and runs at 0.3 m/s at the mouth, and it widens by nearly
 * three meters for each meter out: a fan of brown water over the sea that thins as it goes (round 11's depth-filling
 * friction jet stayed 30 to 50 m wide, and the near field's own tracer, which spreads on the grid, filled the grid's
 * box: its edge drew as a straight front). The friction jet keeps the flow (its momentum and the bar); the lens is
 * the river WATER's place at the surface. Marched in steps of a fiftieth of the width, to JET_TABLE_REACH_M.
 */
export interface LensSpread { readonly xM: Float64Array; readonly halfWM: Float64Array; readonly hM: Float64Array; readonly uMS: Float64Array }

/* ------------------------------------------------------------------ */
/* The state the GPU reads                                               */
/* ------------------------------------------------------------------ */

/**
 * The near field's two textures, half floats, one texel a cell:
 *   A = (level, sea depth, flow X, flow Z)   level is the drawn lift, m: the
 *       hand-over times the water's surface (a dry cell's surface sinks 2 cm
 *       under its bed, or stays at the mean sea level on land); sea depth
 *       is the water under the mean sea level, 0 to h (0 where the bed stands
 *       over it: the river alone); flow in world XZ, m/s.
 *   B = (river share, hand-over, river column, foam)   the river column is h
 *       times the share, m (the optics' path in river water).
 *   C = (slope X, slope Z)   the drawn level's slope as the surface sums its
 *       bands' slopes, -grad(level), over WET cells only (round 1c): central
 *       differences between wet neighbors, one-sided where one neighbor is
 *       dry, 0 on a dry cell. Round 1 took the slope on the GPU from the level
 *       texture one cell apart, and across a wet edge that differenced a film
 *       on the sand (bed + h, up to 0.45 m) against a dry cell held at the
 *       mean sea level: a slope near 0.9 the water does not have, which
 *       turned the shading normal away and drew the sea-self reflection as a
 *       navy band along the swash's edge on both banks (the lead's seam 3).
 *       ROUND 2: (slope X, slope Z, ripple h, ripple s), the last two the
 *       wind-locked band's local shares of height and slope
 *       (`localBandShares`) at the cell's fetch over the water
 *       (`riverFetchM`) and the wind relative to the water; 1, 1 on a cell
 *       whose fetch runs out to the open sea and on a dry cell.
 */
export interface MouthPack {
  readonly a: Uint16Array; readonly b: Uint16Array; readonly c?: Uint16Array;
  /**
   * ROUND 5 (GG-394), with the banks' sand: the skin's saturation (1 on a
   * saturated cell), the seconds since the water left / 60, the water's depth
   * (m) and its bore foam: the beach's look reads them for its wet band over
   * the mouth's strip (\`OceanBeachOptions.stripSoil\`).
   */
  readonly d?: Uint16Array;
}

/**
 * THE PLUME'S TEXTURE DOMAIN, FITTED TO THE JET (river mouth round 2). Round 1
 * laid the plume on 1 m texels over a rectangle; the Sarcelle's jet reaches
 * 6.3 km and spreads to 1.3 km, which at 1 m is 19 million texels. The jet
 * sets its own scales instead (Albertson et al. 1950): its width grows as
 * w / 2 + x / 5 and its profile is self-similar, so the texture is laid in
 * the jet's own coordinates:
 *   ALONG, u = ln(1 + x / x1) / ln(1 + L / x1), x1 = w (one width): the
 *   texel grows in step with the distance from the mouth (0.26 m at the
 *   mouth, 1.9 m at the core's end, 6.9 m at 1 km for the Sarcelle);
 *   ACROSS, v = 1/2 + y / (2 Y(x)), Y = JET_DOMAIN_MARGIN times the river
 *   water's 5% edge, 1.2 (w / 2 + x / 5): the same count of texels across
 *   the plume at every x, so its edge has the same sharpness in texels
 *   wherever it is.
 * Texel (i, j): u = i / (ns - 1) (i = 0 at the mouth line), v = (j + 0.5) / na.
 * The domain's far column and both side rows are zero, so the texture's
 * clamp-to-edge read draws nothing past them; the reader also tests that a
 * point maps inside the unit square.
 */
export interface JetDomain {
  /** The mouth's line, the beach frame's s, and the axis's a, m. */
  readonly sMouth: number;
  readonly aMouth: number;
  /** The along-axis scale x1 and the reach L, m. */
  readonly x1M: number;
  readonly reachM: number;
  /** Y(x) = yHalf0 + yGrow x: the half-span across, m. */
  readonly yHalf0M: number;
  readonly yGrow: number;
  readonly ns: number;
  readonly na: number;
}

/* ------------------------------------------------------------------ */
/* Round 4: the sea's waves past the bar are bores                       */
/* ------------------------------------------------------------------ */

/**
 * THE PLACE'S CONDITIONS (river mouth round 4, the lead's point 3; Remy,
 * sheet q34: "match the real frame by measure"). A place on the coast judged
 * against a clip carries the conditions of that clip, measured on the clip,
 * not chosen. Measured by `.agent/scratch/ocean-gauntlet/mouth4/skyMeasure.py`
 * and `mouth4/skyBand.py` on the Sarcelle join still (`sarcelle-join-t4.png`):
 *   - THE SKY. Cloud share of the sky pixels 0.569 (a pixel is clear sky when
 *     its blue stands over its red by more than 25 levels); luma p5 / p50 /
 *     p95 124 / 180 / 210; over the band of elevations the river reflects in
 *     the judged view (2 to 15 degrees up) p10 / p50 / p90 138 / 184 / 207.
 *     The viewer's fair sky gives, by the same measures, a cloud share of
 *     0.633 (its baked cumulus) and 161 / 178 / 209 in the reflected band:
 *     the clip's sky is a bright, broken sky, not a deck. The sky's
 *     `overcast` mixes the dome toward the storm deck (a 98 sRGB nimbostratus
 *     base) and takes the sun's beam: at 0.569 (the cloud share put on it,
 *     mouth4/shots/a1) the reflected band fell to 145 / 136 / 165 and at 0.28
 *     (the horizon tone matched, a2) to 145 / 161 / 194, both darker than the
 *     clip. THE OVERCAST is the deck share that keeps the reflected band
 *     nearest the clip's: 0. (Open: a cloud base's radiance by cloud type,
 *     and a cloud over the sun with the dome left bright, are not in the
 *     sky's model.)
 *   - THE SEDIMENT. The river's load is the catchment's own rock, and the
 *     clip's sand is it too: a near-grey volcanic sand (the bar's sand,
 *     median sRGB 126 / 116 / 115, rows 318 to 345). Round 2's specific
 *     absorption (Babin and Stramski 2004: 0.04 m^2/g at 443 nm falling as
 *     exp(-0.0123 (lambda - 443))) is a red-brown soil mineral's; with it the
 *     river's deep-layer reflectance ran red over blue by 3.7 to 1 where the
 *     clip's sand runs 1.22 to 1 in linear light. The place's absorption
 *     slope is the one that gives the turbid water's deep reflectance the
 *     sand's red-over-blue ratio (`sedimentSlopeForHue`, the magnitude at
 *     443 nm kept), the particles and the sand one mineral.
 *   - THE WIND, from the clip's chop (`mouth4/chopWave.py`): the near
 *     river's luma, rows mapped to meters on the water (3 to 9 m from the eye),
 *     has its spectral peak at 0.545 m along the view; the same measure on our
 *     own frame (mouth4/shots/b-nofine2) reads 0.857 m where the law's peak is
 *     0.75 m, so the measure reads 1.14 times long, and the clip's chop peaks
 *     at 0.477 m. The young sea's peak law (JONSWAP, the pipeline's
 *     `jonswapPeakOmega`) at the near field's median fetch over the water
 *     (117 m, round 3) gives the wind relative to the water (`windFromChop`),
 *     and less the outflow's mean speed against it (the mouth's U0) the wind
 *     over the river: about 5 m/s, where the sea state's chop blows 12. The
 *     open sea's bands keep the sea state's wind (a swell coast under a
 *     lighter local breeze: open).
 *   - THE SUN: the clip's file names no time or date: the viewer's.
 */
export interface MouthPlaceConditions {
  /** The sky's overcast, 0 to 1 (`createOceanSky`'s `overcast`). */
  readonly overcast: number;
  /** The clip's measures behind it: its cloud share and the reflected band's median luma. */
  readonly cloudShare: number;
  readonly reflectedBandLuma: number;
  /** The clip's sand, median sRGB (0 to 255): the sediment's hue. */
  readonly sandSrgb: V3;
  /**
   * The clip's chop: the near river's peak wavelength along the view, m, and
   * the fetch over the water it grew on (the near field's median, m). Null:
   * the sea state's wind over the river.
   */
  readonly chopPeakM: number | null;
  readonly chopFetchM: number;
  /**
   * Round 5: the clip's river water-leaving reflectance (the deep layer's R,
   * per RGB channel), measured with our renderer as the instrument
   * (`mouth5/calib.py`; see THE RIVER'S COLOR BY LAW). Null: no measure.
   */
  readonly waterRInf: V3 | null;
  /**
   * Round 6: THE STRATUS DECK the clip was shot under (oceanSkyDeckMath.ts;
   * `OceanSky.setDeck`): the deck's mean optical depth and its gamma shape
   * (Barker, Wielicki and Parker 1996), and the air between the eye and the
   * deck (the base over the air's extinction length), fitted together to the
   * clip's cloud pixels by elevation band (`mouth6/probe/fitDeck6.ts`: luma
   * p10 / p50 / p90 of the cloud pixels in four bands from 2.6 to 15.3
   * degrees, least squares through the viewer's tone map; rms 8.8 levels).
   * The cover is `cloudShare`. Null: no deck (the viewer's sky).
   */
  readonly deckTau: number | null;
  readonly deckTauShape: number;
  readonly deckAirK: number;
  /**
   * The place's direct sun is the deck field's mean share (`OceanSkyDeck.sunMean`): the clip's frame faces
   * away from the sun and does not show where it stands in the deck.
   */
  readonly deckSunMean: boolean;
  /**
   * ROUND 10 (law 1): THE TIDE AT THE CLIP. The still water's height over the mean sea level at the clip's moment, m,
   * and the coast's mean tidal range, m (the floor's `stillLevelM` is `tideM`). See SARCELLE_CONDITIONS.
   */
  readonly tideM: number;
  readonly tidalRangeM: number;
  /**
   * ROUND 11 (law 1; the lead's ruling 1): THE DISCHARGE ON THE CLIP'S DAY, m^3/s, beside the place's MEAN flow (the
   * width's, `COAST_PLACES`: Leopold and Maddock's hydraulic geometry gives the flow that shapes the channel, not
   * the flow on one day). The channel, the bar and the jet that lays the bar are the mean flow's; the near field's
   * inflow, the drawn jet, the load and the wind over the water are the day's. Null: the day is the mean.
   * `barBareShare` is the clip's measure the day is derived from (see SARCELLE_CONDITIONS).
   */
  readonly dayDischargeM3S: number | null;
  readonly barBareShare: number | null;
  /**
   * ROUND 12 (gap 2; the lead's ruling 2): THE SEA ON THE CLIP'S DAY, the forced bands' significant height offshore,
   * m (`deriveMouthDesign`'s `daySeaHsM`, `daySeaCascades`), beside the sea state's mean: the clip's bar stands bare
   * with the waves on (see SARCELLE_CONDITIONS). Null: the sea state's own.
   */
  readonly daySeaHsM: number | null;
  /**
   * ROUND 12 (gap 1; the lead's ruling 1): THE RIVER WATER'S OWN COLOR, the dissolved organic matter's absorption at
   * 443 nm, 1/m (CDOM, tannin: Bricaud, Morel and Prieur 1981, slope CDOM_SLOPE_NM), derived from the clip's river
   * bands by the Gordon water-leaving model with the renderer as the instrument (see SARCELLE_CONDITIONS). The
   * particles keep round 5's fit (the catchment's mineral, `waterRInf` at the mean load). Null: no dissolved term.
   */
  readonly cdomAg443M: number | null;
  /**
   * ROUND 13 (law 1; GG-413): THE LONG-TERM DRIFT AT THE PLACE, measured on the clip: the breakers' angle to the shore,
   * degrees, and the drift's sense along the beach frame's a (+1 or -1), from the clip's breaker lines against its
   * shore (see SARCELLE_CONDITIONS). The place's planform is then the deflected mouth (`deflectedSpitOf`). Null: no
   * measure (a straight mouth).
   */
  readonly drift: { readonly breakerAngleDeg: number; readonly sense: 1 | -1 } | null;
  /**
   * ROUND 15 (ruling 1; the lead's ruling): THE RIVER'S LOAD ON THE CLIP'S DAY IS A MEASURED INPUT, g/m^3: the
   * suspended load fitted to the clip's river bands by the Gordon water-leaving model with the renderer as the
   * instrument (the same rig as round 12's CDOM fit, the load as the free parameter, CDOM at its fitted 0; see
   * SARCELLE_CONDITIONS). Rounds 2 to 14 derived the day's load from the flow by the rating curve (`ratingCurveGM3`:
   * 25 g/m^3 at the day's 4.2 m^3/s), which drew a blue-grey river where the clip's is a neutral grey. Null: the
   * rating curve's load (`MouthDesign.ratingLoadGM3` keeps it beside the fitted one either way).
   */
  readonly dayLoadGM3: number | null;
  /**
   * ROUND 15 (ruling 3): THE CLIP'S SURF BAND, its inner and outer edge off the shoreline, m, measured on the clip
   * (the breakers' rows through the judged pose's geometry; round 13's `clipLines13.py`). The spit's terrace runs out
   * to the band's outer edge (its front is where the day's sea starts to break), and the day's sea is read from the
   * band's decay across it (see SARCELLE_CONDITIONS and `deriveMouthDesign`). Null: no measure (round 14's terrace,
   * the mean sea's surf zone wide).
   */
  readonly surfBandM: readonly [number, number] | null;
  /**
   * ROUND 11 (the lead's ruling 3): THE CLIP'S DISPLAY CURVE, the camera's tone curve that took the clip's scene to
   * its pixels, fitted by measure (`mouthDisplayCurve`; mouth11/fitCurve11.py): the judged page draws the place
   * through it in place of the viewer's ACES curve, so the frame and the clip are compared through one camera.
   * Null: the viewer's curve.
   */
  readonly displayCurve: MouthDisplayCurve | null;
  readonly source: string;
}
/**
 * ROUND 11: A CAMERA'S DISPLAY CURVE, per channel on the scene's linear light L (the renderer's exposure in it):
 * y = (e L)^g, D = y / (1 + y) (Reinhard, Stark, Shirley and Ferwerda 2002's operator on a gamma). Two numbers: the
 * exposure e and the gamma g. The fit tried a third, a white point (D = y (1 + y / w^2) / (1 + y)): it ran to its
 * bound, so the clip asks for no shoulder. `mouthDisplayCurve` is the CPU twin of the GPU's (oceanMouth.ts).
 */
export interface MouthDisplayCurve { readonly exposure: number; readonly gamma: number }
export interface LongshoreDrift {
  /** The breakers' angle to the shore, rad, and the drift's sense along the beach frame's a (+1 or -1). */
  readonly breakerAngleRad: number;
  readonly sense: 1 | -1;
  /** The breaker height (Komar and Gaughan), m; the drift, m^3/s and m^3 a year. */
  readonly hbM: number;
  readonly qM3S: number;
  readonly qM3Yr: number;
}
export interface DeflectedSpit {
  readonly drift: LongshoreDrift;
  /** The platform's crest over the mean sea level, and over the low water (the head the river may stand at), m. */
  readonly crestM: number;
  readonly headM: number;
  /** The platform's width from the mean-sea shoreline to the channel's seaward edge, m. */
  readonly platformWidthM: number;
  /** The channel behind it at the mean flow: its width (Leopold and Maddock), thalweg depth, hydraulic radius, m; its slope. */
  readonly channelWidthM: number;
  readonly channelDepthM: number;
  readonly hydraulicRadiusM: number;
  readonly slope: number;
  /** The spit's length: the deflected reach from the outlet to the root, m (Escoffier's balance). */
  readonly lengthM: number;
  /** The bends' radius and the channel's centerline offset inland of the mean-sea shoreline, m. */
  readonly bendRadiusM: number;
  readonly centerOffsetM: number;
  /** Bruun's ratio: the mean flow's yearly volume over the drift's yearly volume. */
  readonly bruunRatio: number;
}
export interface LowFlowChannel {
  /** The day's channel: width, depth over its thalweg, m; its mean speed, m/s; its flow area, m^2; its hydraulic radius, m. */
  readonly widthM: number;
  readonly depthM: number;
  readonly speedMS: number;
  readonly areaM2: number;
  readonly hydraulicRadiusM: number;
  /** The day's water-surface slope by Manning at the day's speed and radius. */
  readonly slope: number;
  /** The exponents used, and the speed continuity gives through the section (a check on the exponents' sum). */
  readonly exponents: { readonly b: number; readonly f: number; readonly m: number };
  readonly continuityMS: number;
  /** The flows the geometry is taken between, m^3/s. */
  readonly qMeanM3S: number;
  readonly qDayM3S: number;
}
/** The spit's course and where it stands in the beach frame (`deflectedCourse`). */
export interface DeflectedCourse {
  readonly course: SeabedCourse;
  /**
   * ROUND 14: the spit's seaward terrace (`SeabedCourse.terrace`): its top under the low water (the day's closure
   * depth) and under the mean sea level, m, its width from the shoreline (the mean sea's surf zone) and its span
   * along the shore (beach frame a). Null: none.
   */
  readonly terrace: { readonly depthStillM: number; readonly depthMslM: number; readonly widthM: number; readonly a0: number; readonly a1: number } | null;
  /** The beach frame's a of the alongshore reach's end (the root bend's start), m, and the direction from the outlet to it (+1 or -1). */
  readonly aRootM: number;
  readonly dirA: 1 | -1;
  /** The course's along at the root bend's start (the spit's length), m. */
  readonly rootAlongM: number;
}

export interface BoreMarch {
  /** Distance along the waves' path, m. */
  readonly xM: Float64Array;
  /** The rms wave height, m; the share of broken waves; the intrinsic group speed plus the current, m/s. */
  readonly hrmsM: Float64Array;
  readonly qb: Float64Array;
  readonly cgU: Float64Array;
  /** The breaker index used (Battjes and Stive 1985). */
  readonly gamma: number;
}
export interface FilmSlick {
  /** The slope variance the film removes, Cox and Munk's clean less slick. */
  readonly removedVar: number;
  /** The share of the near field's fine chop (drawn and under 2 cm) the film takes, and of the open sea's unresolved constant. */
  readonly kFine: number;
  readonly kBase: number;
  /** What it still takes from the wind-locked band, on the near field and past it. */
  readonly restNearVar: number;
  readonly restFarVar: number;
  /** The band's slope variance at full share (the surface's octave estimate), and its share under FILM_LONGEST_M. */
  readonly bandVarUnit: number;
  readonly bandShortShare: number;
  /**
   * The same share on the near field, where the young sea's peak cut
   * (\`localPeakCut\`) leaves the band's drawn variance on its waves under the
   * local peak (round 4's gain gives it back there): the octaves from the
   * band's shortest wave to the peak.
   */
  readonly bandShortShareNear: number;
}

export interface FinePatch {
  /** RGBA per texel, row-major (z rows, x columns): sx, sz, sx^2, sz^2 (slope as the surface sums it, -grad eta). */
  readonly data: Float32Array;
  readonly n: number;
  readonly patchM: number;
  /** The drawn waves' band, m: shortest and longest. */
  readonly shortM: number;
  readonly longM: number;
  /** The drawn slope variance (measured on the field), and the spectrum's over the same band. */
  readonly drawnVar: number;
  readonly lawVar: number;
  /** The unresolved remainder under the shortest drawn wave (`FINE_VISCOUS_K`). */
  readonly subVar: number;
  /** The slope-variance-weighted mean phase speed of the drawn waves, m/s (the pattern's own drift along the wind). */
  readonly driftMS: number;
  /** The period of the longest drawn wave, s (the pattern renews over it). */
  readonly periodS: number;
  readonly windMS: number;
}
export interface StirredLoad {
  readonly tauWPa: number;
  readonly tauCrPa: number;
  /** van Rijn's reference concentration, by volume, and its height, m. */
  readonly caVol: number;
  readonly aM: number;
  readonly epsM2S: number;
  readonly surfGM3: number;
  readonly meanGM3: number;
  readonly columnGM2: number;
}
export interface FrontEddyTable {
  /** Per texel along the jet's u: tau (s), log2 of the local most-amplified frequency (Hz), delta (m), the core's half-width rc (m). */
  readonly data: Float32Array;
  readonly n: number;
  /** The ladder's top frequency (Hz) and each mode's phases p_m (first KH_MODES) and q_m (the side's, next KH_MODES). */
  readonly f0Hz: number;
  readonly psi: Float64Array;
  /** The x of each texel, m (the jet's log axis: x = x1 ((1 + L / x1)^u - 1)). */
  readonly xM: Float64Array;
}

/** The coast's constants of the roller law (`rollerCoastOf`): one period, the deep k, the breaker index, the deep Rayleigh scale. */
export interface RollerCoast {
  /** The representative period (the sea's Tz, as Battjes and Janssen take it), s. */
  readonly tS: number;
  /** omega^2 / g at that period, 1/m: the deep-water wave number. */
  readonly k0: number;
  /** Battjes and Stive's (1985) breaker index for the sea. */
  readonly gamma: number;
  /** The FFT sea's rms wave height (deep water: the raw crests' Rayleigh scale), m. */
  readonly hrmsDeepM: number;
}
export interface YoungSea {
  /** The wind relative to the water, m/s, and the young sea's heading (its waves' travel, world XZ). */
  readonly windRelMS: number;
  readonly dirX: number;
  readonly dirZ: number;
  /** The fetch over the water, m (the near field's median). */
  readonly fetchM: number;
  /** The young sea's peak: its wavelength, m, its angular frequency, rad/s, and Donelan's beta there. */
  readonly peakM: number;
  readonly omegaP: number;
  readonly betaPeak: number;
  /** The second FFT's cascade (one cascade, YOUNG_SEA_N). */
  readonly cascade: CascadeParams;
  /** The band's significant height, m, its slope variance, and the share of that under FILM_LONGEST_M (deep water). */
  readonly hsM: number;
  readonly slopeVar: number;
  readonly shortShare: number;
  /** The angular frequency band the cascade carries, rad/s. */
  readonly omegaLo: number;
  readonly omegaHi: number;
  /**
   * The OPEN band (the sea's own wind-locked band) that the young sea replaces where the current blocks it:
   * its slope-carrying angular frequency (`bandSlopeOmega`), that wave's deep group speed g / (2 omega), and
   * its heading.
   */
  readonly openOmegaS: number;
  readonly openCgS: number;
  readonly openDirX: number;
  readonly openDirZ: number;
  /** The open band's significant height offshore, m (its depth hold on the near field). */
  readonly openHsM: number;
  /** The place's wind over the ground, world XZ, m/s (a cell's wind over its water is this less the cell's flow). */
  readonly windGroundX: number;
  readonly windGroundZ: number;
  /**
   * THE PLUME PAST THE GRID'S SEA EDGE, one entry a sea-edge cell across (the grid's a cells): the open band's r
   * where a walk leaves the grid there (the jet's drawn speed), and the length over which the jet still blocks
   * the band along the walk (m). Filled by `youngPlumeExits`.
   */
  exitR: Float64Array;
  exitRunM: Float64Array;
}
export interface YoungFine {
  /** The main patch's cascade (its short cut moved to the split) and the second octave's. */
  readonly main: CascadeParams;
  readonly fine: CascadeParams;
  /** The split's wavelength, m, and each part's slope variance (deep water, the law's). */
  readonly splitM: number;
  readonly mainVar: number;
  readonly fineVar: number;
}

/** The warp over the coast's floor map, one band a channel (law 2). */
export interface PhaseWarpMap {
  /** RGBA per texel, the map's layout: W (m, along the band's heading) of bands 0..3; 0 for a band not forced. */
  readonly data: Float32Array;
  /**
   * The distance past the map's edge over which the shader takes each warp back to 0, m: the warp's slope there,
   * W_edge / L, is held to the band's own wave number step on its FFT patch over its carrier, lambda_b / patch_b
   * (the FFT cannot draw a finer change of wave number), the largest over the bands.
   */
  readonly taperM: number;
  /** Each band's largest |W| on the map's edge, m. */
  readonly edgeW: readonly number[];
}
