/**
 * @file waterfallTypes.ts — the seven Norway falls as data, and the laws every fall obeys.
 *
 * WHY THIS FILE EXISTS (2026-10-11). Remy sent a clip ("7 of the Most Epic
 * Waterfalls in Norway!!", TheSlowTraveler) and asked for the different kinds
 * of waterfall in it on the Water page. Seven falls, six kinds. Each one here
 * is a record of what the clip shows: its drop, the slope of the rock its
 * water follows, how many streams, how many ledges, and the discharge in the
 * clip's season. The references (still frames, private, nothing ships) are in
 * `.agent/scratch/ocean-gauntlet/waterfall/ref/`.
 *
 * THE LAWS are the ones a free jet and a sliding sheet are known to follow.
 * Every number the scene draws comes from them and from the record, never
 * from a look number:
 *   - a free jet's outer edge spreads at about 3.8% of the distance fallen
 *     (Ervine and Falvey 1987, turbulent jets at 3% turbulence intensity);
 *   - its solid core is gone after the break-up length (Ervine, Falvey and
 *     Withers 1997, full law since 2026-11-01); past L_b the jet is drops in
 *     the air it drags, and air drag and the air's eddies act on the drops
 *     (brokenJetCloud, the ocean splash's drop laws, 2026-11-01);
 *   - a sheet that slides on rock entrains air from the inception point
 *     (Wood, Ackers and Loveless 1983) and carries a mean air concentration
 *     C = 0.9 sin(slope) (Chanson 1993, self-aerated chute flow);
 *   - the water's speed along the fall is sqrt(v0^2 + 2 g s_vertical), less
 *     friction on a rock face (a Manning slide reaches a terminal speed);
 *   - the mist at an impact scales with the impact power rho g Q h; the
 *     cloud's height is taken as 0.3 of the drop (Steinsdalsfossen's cloud
 *     reaches about a third of its 46 m in the clip's frame).
 *
 * Preserved: nothing of the river page's waterfall module is touched; this is
 * the Water page's own scene, the one water's "Loose water" class drawn over
 * a procedural rock face. Deferred: the pool as a shallow-flow grid, wind on
 * the ribbons, the sun through the mist as a rainbow.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 05/11/2026, 11:29:02
 * Dependents: components/World3D/water/riverLandingSpray.ts, components/World3D/water/riverSpillView.ts, components/World3D/water/riverWaterfallView.ts, systems/world3d/river/riverSpillTransfer.ts, systems/world3d/river/waterfallTerrainProfiles.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SPLASH_AIR_RHO, SPLASH_Q_EXT, SPLASH_STABLE_DROP_M, splashCoupledShare, splashCoupledStableDrop, splashDragPerSpeed, splashTerminalSpeedMs, splashTurbulentSigma } from '../ocean/oceanSplashLaws';

export const G = 9.81;
export const RHO_WATER = 1000;

export type FallKind = 'plunge' | 'ribbons' | 'twin' | 'tiers' | 'chute' | 'horsetail' | 'gorge';

export interface FallType {
  readonly id: string;
  /** The fall's name as the clip names it. */
  readonly name: string;
  readonly place: string;
  /** Where in the clip (mm:ss) the reference frame was taken. */
  readonly clipAt: string;
  readonly kind: FallKind;
  /** Total height of the fall, m. */
  readonly dropM: number;
  /** Mean slope of the rock face the water follows, degrees; 90 is a free fall. */
  readonly slopeDeg: number;
  /** Discharge in the clip's season, m^3/s (summer melt for the big ones). */
  readonly dischargeM3S: number;
  /** Width of the water at the lip, m. */
  readonly lipWidthM: number;
  /** Separate streams at the lip. */
  readonly streams: number;
  /** Ledges the water steps over (tiers); 0 for a smooth face. */
  readonly ledges: number;
  /** For a twin fall, each chute's lean from the vertical toward the center, degrees. */
  readonly convergeDeg: number;
  /** A lip that overhangs, with a path behind the sheet. */
  readonly overhang: boolean;
  /** What the clip shows, in one line. */
  readonly note: string;
}

/** The seven falls of the clip, in the clip's order. */
export const FALL_TYPES: readonly FallType[] = [
  {
    id: 'storfossen', name: 'Waterfall Walk', place: 'Storfossen, Geiranger', clipAt: '0:22', kind: 'gorge',
    dropM: 36, slopeDeg: 38, dischargeM3S: 25, lipWidthM: 14, streams: 1, ledges: 5, convergeDeg: 0, overhang: false,
    note: 'A river drops through a rock gorge in five steps; every step is white, and the water never leaves the rock.',
  },
  {
    id: 'seven-sisters', name: 'Seven Sisters', place: 'De syv søstrene, Geirangerfjord', clipAt: '1:15', kind: 'ribbons',
    dropM: 250, slopeDeg: 80, dischargeM3S: 6, lipWidthM: 3, streams: 7, ledges: 0, convergeDeg: 0, overhang: false,
    note: 'Seven thin ribbons down a fjord wall; each one widens into mist long before the water below.',
  },
  {
    id: 'steinsdalsfossen', name: 'Steinsdalsfossen', place: 'Steine, Hardanger', clipAt: '1:27', kind: 'plunge',
    dropM: 46, slopeDeg: 90, dischargeM3S: 12, lipWidthM: 9, streams: 1, ledges: 0, convergeDeg: 0, overhang: true,
    note: 'One free sheet over an overhung lip; a path runs behind it; a spray cloud hides the pool.',
  },
  {
    id: 'latefossen', name: 'Låtefossen', place: 'Odda, Hardanger', clipAt: '2:13', kind: 'twin',
    dropM: 165, slopeDeg: 62, dischargeM3S: 40, lipWidthM: 10, streams: 2, ledges: 0, convergeDeg: 22, overhang: false,
    note: 'Two chutes lean toward each other and meet at the base in white rapids under a stone road bridge.',
  },
  {
    id: 'tvindefossen', name: 'Tvindefossen', place: 'Voss', clipAt: '2:47', kind: 'tiers',
    dropM: 150, slopeDeg: 70, dischargeM3S: 8, lipWidthM: 6, streams: 3, ledges: 9, convergeDeg: 0, overhang: false,
    note: 'The water fans over nine rock ledges into dozens of braided streams; the base is a wide white apron.',
  },
  {
    id: 'stigfossen', name: 'Stigfossen', place: 'Trollstigen, Rauma', clipAt: '3:34', kind: 'chute',
    dropM: 180, slopeDeg: 55, dischargeM3S: 15, lipWidthM: 8, streams: 2, ledges: 3, convergeDeg: 0, overhang: false,
    note: 'A steep chute down a rock gully, white end to end, with spray that drifts over the road.',
  },
  {
    id: 'langfossen', name: 'Langfossen', place: 'Åkrafjorden, Etne', clipAt: '4:23', kind: 'horsetail',
    dropM: 612, slopeDeg: 45, dischargeM3S: 30, lipWidthM: 20, streams: 1, ledges: 0, convergeDeg: 0, overhang: false,
    note: 'One wide sheet slides 612 m down smooth rock, white the whole way, and fans out toward the fjord.',
  },
];

export function fallById(id: string): FallType {
  const f = FALL_TYPES.find((t) => t.id === id);
  if (!f) throw new Error(`[waterfall] no fall "${id}"`);
  return f;
}

/** Depth of the water at the lip for a critical-flow lip, m: d_c = (q^2 / g)^(1/3). */
export function lipDepthM(dischargeM3S: number, lipWidthM: number, streams: number): number {
  const q = dischargeM3S / Math.max(0.5, lipWidthM * Math.max(1, streams)) ;
  return Math.cbrt((q * q) / G);
}

/** Speed at the lip for a critical-flow lip, m/s: v_c = sqrt(g d_c). */
export function lipSpeedMS(dischargeM3S: number, lipWidthM: number, streams: number): number {
  return Math.sqrt(G * lipDepthM(dischargeM3S, lipWidthM, streams));
}

/** Free-fall speed after a vertical drop s with launch speed v0, m/s. */
export function fallSpeedMS(v0: number, verticalDropM: number): number {
  return Math.sqrt(v0 * v0 + 2 * G * Math.max(0, verticalDropM));
}

/**
 * The outer spread of a turbulent free jet (Ervine and Falvey 1987): the edge
 * moves out at about 3.8% of the distance fallen on each side, at 3%
 * turbulence intensity. Width at distance s along the jet.
 */
export const JET_SPREAD = 0.038;
export function jetWidthM(w0: number, alongM: number): number {
  return w0 + 2 * JET_SPREAD * alongM;
}

/** Turbulence intensity u'/V of the water at a natural lip: Castillo (2006) measured 1.2 % at weir nappes. */
export const LIP_TURBULENCE = 0.012;

/**
 * Break-up length of a free jet (Ervine, Falvey and Withers 1997):
 * L_b / (d0 Fr^2) = 1.05 / C^0.82, with C = 1.14 Tu Fr^2 and Fr = v0 / sqrt(g d0).
 * Past it the core is gone.
 *
 * FIX (2026-11-01): the earlier form, L_b = 1.05 Fr^0.82 d0, dropped the Fr^2
 * and the turbulence term C. At Steinsdalsfossen (v0 about 1 m/s, d0 about
 * 0.08 m) it gave 0.09 m, so the sheet was white at the lip. The full law with
 * Tu = 1.2 % gives about 3.0 m; Horeni's field formula for nappes,
 * L_b = 6 q^0.32 (q < 0.25 m^2/s), gives 2.7 m for the same q = 0.08 m^2/s.
 */
export function breakupLengthM(v0: number, d0: number, tu = LIP_TURBULENCE): number {
  const d = Math.max(1e-3, d0);
  const fr2 = (v0 * v0) / (G * d);
  return (1.05 * d * fr2) / Math.pow(1.14 * Math.max(1e-4, tu) * Math.max(1e-6, fr2), 0.82);
}

/**
 * How white a free jet is at distance s along it: the solid core shrinks
 * linearly to nothing at L_b; the spray envelope round it is white from the
 * start. Returns the air-water share 0..1 that the surface draws as white.
 */
export function jetWhiteness(alongM: number, breakupM: number): number {
  const core = Math.max(0, 1 - alongM / Math.max(1e-3, breakupM));
  return 0.25 + 0.75 * (1 - core);
}

/**
 * The outer spread rate of a coherent jet per side, from its turbulence
 * (Ervine and Falvey 1987, eq. 1): delta / X = 0.38 u'/U. At the lip's
 * Tu = 1.2 % (the break-up law's own value) this is 0.46 % of the distance.
 * JET_SPREAD (3.8 %) is the same law at Tu = 10 %; the headwaters fall still
 * uses it (2026-11-01: not changed there, a follow-up for that fall).
 */
export function coherentSpreadRate(tu = LIP_TURBULENCE): number {
  return 0.38 * tu;
}

/**
 * THE BROKEN JET'S DROP CLOUD (2026-11-01, GG-572). Past its break-up
 * length a free jet is no longer a sheet: it is a cloud of drops in the air
 * it drags with it. These are the ocean splash's own drop laws
 * (oceanSplashLaws.ts), so the falls and the sea use one water:
 *  - THE DROPS. A drop cannot outlive its fall: the population ends at the
 *    stable drop D_s (5.4 mm), and in a dense spray at
 *    D_cap = D_s / sqrt(1 - kappa) (splashCoupledStableDrop).
 *  - THE AIR. A dense spray drags its own air (two-way coupling; Faeth 1987,
 *    Marble 1970). The water's mass loading is phi = c / rho_a, with c the
 *    water's mass over the cloud's depth. The air takes the share kappa of
 *    the water's speed (splashCoupledShare), so the drag acts on the slip
 *    (1 - kappa) u only. Just past break-up the water outweighs its air
 *    hundreds of times and falls as one body. Lower down the cloud is deep,
 *    phi falls, and the drops slow toward their terminal speed.
 *  - THE SPREAD. The jet's air is a turbulent jet, and its eddies carry the
 *    drops sideways (Taylor dispersion, splashTurbulentSigma: the plane
 *    jet's spread S = 0.10, Pope 2000; the drop's inertia, Hinze 1975).
 *    sigma is the rms offset per axis, both along the lip and through the
 *    cloud's depth.
 * The drag time is the drop's Newton-regime relaxation time tau = v_t / g;
 * the drag rate at the terminal slip is 1 / tau. One pass with D_s gives
 * kappa, then D_cap sets the drop and its sigma (no iteration).
 * NOT MODELED: wind, and the air's own transport away from the cloud.
 */
export interface BrokenJetCloud {
  /** rms offset of the drops per axis since break-up, m. */
  sigmaM: number;
  /** Water mass over air mass in the cloud's depth. */
  loading: number;
  /** The air's share of the water's speed, 0..1. */
  airShare: number;
  /** The drop diameter that carries the water, m. */
  dropM: number;
}
export function brokenJetCloud(pathSinceBreakM: number, ageSinceBreakS: number, speedMs: number, qM2S: number): BrokenJetCloud {
  const path = Math.max(0, pathSinceBreakM), age = Math.max(0, ageSinceBreakS), speed = Math.max(0.1, speedMs);
  const sheetM = Math.max(1e-6, qM2S) / speed;
  const tauOf = (d: number) => splashTerminalSpeedMs(d) / G;
  const loadingAt = (sigma: number) => (RHO_WATER * sheetM) / (SPLASH_AIR_RHO * (sheetM + Math.sqrt(2 * Math.PI) * sigma));
  const tauS = tauOf(SPLASH_STABLE_DROP_M);
  const loading0 = loadingAt(splashTurbulentSigma(path, speed, tauS));
  const airShare = splashCoupledShare(loading0, age, 1 / tauS);
  const dropM = splashCoupledStableDrop(airShare);
  const sigmaM = splashTurbulentSigma(path, speed, tauOf(dropM));
  return { sigmaM, loading: loadingAt(sigmaM), airShare, dropM };
}

/**
 * The air-drag acceleration on broken water that moves at `velocity` through
 * still air (BROKEN JET'S DROP CLOUD): the drops feel the slip
 * (1 - kappa) u, at the Schiller and Naumann drag of their diameter
 * (splashDragPerSpeed). Returns m/s^2 per axis.
 */
export function brokenJetDrag(velocity: readonly [number, number, number], cloud: BrokenJetCloud): [number, number, number] {
  const k = 1 - cloud.airShare;
  const slip: [number, number, number] = [velocity[0] * k, velocity[1] * k, velocity[2] * k];
  const rate = splashDragPerSpeed(cloud.dropM, Math.hypot(...slip));
  return [-rate * slip[0], -rate * slip[1], -rate * slip[2]];
}

/**
 * The optical depth of a drop cloud, face on: tau = (3/2) Q_ext L / D, with
 * L the water's column length (m of water per m^2 of view) and Q_ext = 2
 * (SPLASH_Q_EXT, drops far larger than the light's wavelength).
 */
export function dropCloudOpticalDepth(columnM: number, dropM: number): number {
  return (1.5 * SPLASH_Q_EXT * Math.max(0, columnM)) / Math.max(1e-6, dropM);
}

/**
 * Inception point of self-aeration on a rough slope (Wood, Ackers and
 * Loveless 1983): L_i / k_s = 13.6 (sin a)^0.0796 Fr*^0.713, with
 * Fr* = q / sqrt(g sin a k_s^3). Natural rock k_s about 0.3 m.
 */
export const ROCK_KS_M = 0.3;
export function inceptionLengthM(qM2S: number, slopeDeg: number): number {
  const s = Math.sin((slopeDeg * Math.PI) / 180);
  const frStar = qM2S / Math.sqrt(G * Math.max(0.05, s) * ROCK_KS_M ** 3);
  return 13.6 * Math.pow(Math.max(0.05, s), 0.0796) * Math.pow(Math.max(0.1, frStar), 0.713) * ROCK_KS_M;
}

/** Mean air concentration of a self-aerated sheet on a slope (Chanson 1993): C = 0.9 sin a, capped at 0.9. */
export function sheetAirShare(slopeDeg: number): number {
  return Math.min(0.9, 0.9 * Math.sin((slopeDeg * Math.PI) / 180));
}

/**
 * A sheet that slides on rock does not fall freely: friction holds it to a
 * terminal speed. Manning on a steep rough face: v_t = (1/n) R^(2/3) S^(1/2),
 * n = 0.05 for a rough rock chute, R about the sheet's depth.
 */
export function slideTerminalMS(qM2S: number, slopeDeg: number): number {
  const slope = Math.tan((slopeDeg * Math.PI) / 180);
  // depth from q = v d with v = (1/n) d^(2/3) S^(1/2): d = (q n / S^(1/2))^(3/5)
  const n = 0.05;
  const d = Math.pow((qM2S * n) / Math.sqrt(Math.max(0.05, slope)), 0.6);
  return (1 / n) * Math.pow(Math.max(0.02, d), 2 / 3) * Math.sqrt(Math.max(0.05, slope));
}

/** Impact power at the foot of a drop, W: rho g Q h. */
export function impactPowerW(dischargeM3S: number, dropM: number): number {
  return RHO_WATER * G * dischargeM3S * dropM;
}

/** The spray cloud's height over the impact, m: 0.3 of the drop that lands there (the clip's Steinsdalsfossen). */
export function mistHeightM(dropM: number): number {
  return 0.3 * dropM;
}

/**
 * The mist budget at an impact: sprites per second, from the impact power.
 * One sprite stands for about 25 kW of impact power (Steinsdalsfossen, 12
 * m^3/s over 46 m = 5.4 MW, gives ~220 sprites a second; a 6 s life keeps
 * about 1,300 in the air). The number is a drawing budget, not a mass.
 */
export function mistRatePerS(dischargeM3S: number, dropM: number): number {
  return Math.min(900, Math.max(20, impactPowerW(dischargeM3S, dropM) / 25_000));
}
