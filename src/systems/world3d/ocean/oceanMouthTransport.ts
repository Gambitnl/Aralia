/**
 * @file oceanMouthTransport.ts
 * The mouth jet transport laws: settling, bed stress, load and deposition.
 * These intact equations provide the physical inputs for coast design and the
 * plume. Constants, scientific notes and arithmetic order are preserved.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/10/2026, 02:30:33
 * Dependents: systems/world3d/ocean/oceanMouthCoast.ts, systems/world3d/ocean/oceanMouthJet.ts, systems/world3d/ocean/oceanMouthMath.ts, systems/world3d/ocean/oceanMouthWaveMath.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SEA_WATER_NU_M2S, G, BATHY_BORE_GAMMA, waveNumberAt, type BeachFrame, BATHY_BREAK_FULL } from './oceanBeachMath';
import { JET_EDGE_SPREAD, JET_CORE_SIZES, JET_EDGE_SIGMAS, JET_SCALAR_SPREAD, JET_ENTRAINMENT } from './oceanMouthLaws';
import { type FrictionJet, type JetDeposit, type StirredLoad } from './oceanMouthTypes';
import { type SeabedParams, seabedPointAt } from './oceanSeabedMath';


/**
 * THE SAND'S FALL SPEED, m/s (Ferguson and Church 2004, natural grains:
 * w = R g D^2 / (C1 nu + (0.75 C2 R g D^3)^(1/2)), C1 = 18, C2 = 1.0,
 * R = 1.65 for quartz in water).
 */
export function sandFallSpeedMS(d50M: number, nuM2S = SEA_WATER_NU_M2S): number {
  const r = 1.65;
  return (r * G * d50M * d50M) / (18 * nuM2S + Math.sqrt(0.75 * 1.0 * r * G * d50M ** 3));
}

/**
 * Dean's (1987) profile scale from the fall speed: A = 0.067 w^0.44, w in
 * cm/s, A in m^(1/3). 0.35 mm sand: w 5.0 cm/s, A 0.136.
 */
export function deanProfileA(d50M: number): number {
  return 0.067 * (sandFallSpeedMS(d50M) * 100) ** 0.44;
}

/* ------------------------------------------------------------------ */
/* The plume                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* The friction-dominated jet and its bar (round 3)                      */
/* ------------------------------------------------------------------ */

/**
 * ROUND 3, THE JET'S REGIME (the lead's point 1). Wright (1977, "Sediment
 * transport and deposition at river mouths", GSA Bulletin 88) sorts river
 * mouths by what slows the outflow: its own inertia (a deep basin; the jet
 * spreads as a free turbulent jet, Albertson et al. 1950), the BED'S FRICTION
 * (a shallow shelf: the jet fills the water column, friction takes its
 * momentum fast and it spreads fast) or its buoyancy. A mouth 40 m wide and
 * 1.07 m deep on a shelf of 1 to 3 m is the friction-dominated case (Wright
 * and Coleman 1974): the jet slows within a few widths and drops its sand
 * there as a middle-ground bar, round which the channel splits. Round 2 drew
 * the inertia-dominated jet (momentum held over a 248 m core, then U0 x0 / x)
 * and put the bar where that jet fell to the sand's threshold, 799 m out: the
 * breakers then stood at the coast's own surf zone, not on a bar at the mouth.
 *
 * THE JET OVER THE SHELF (Ozsoy and Unluata 1982, the plane turbulent jet with
 * bed friction; depth-filling, so the layer is the water column h(x) on the
 * axis, the coast's own floor without the bar). Across the axis the speed is
 * a core of half-width rc at the core speed uc with Gaussian shoulders of
 * sigma (u = uc e^(-s^2 / (2 sigma^2)), s the distance past the core's edge):
 *   volume flux    Q = h uc (2 rc + sigma sqrt(2 pi)),  dQ/dx = 2 alpha h uc
 *                  (the entrainment at the two edges, Morton, Taylor and
 *                  Turner 1956; alpha the module's JET_ENTRAINMENT);
 *   momentum flux  M = h uc^2 (2 rc + sigma sqrt(pi)),  dM/dx = -tau_m / rho
 *                  times the same width integral of u^2: the bed's mean stress;
 *   the shear layers grow at Albertson's rate (JET_SHEAR_GROWTH) while a core
 *   is left; Q and M then give uc and rc. Where rc reaches 0 the flow is
 *   established: a Gaussian whose uc and sigma Q and M give.
 * THE BED STRESS: the current's own, tau_c = rho cf uc^2 with cf = g n^2 /
 * h^(1/3) (Manning, the near field's own roughness: one water, one bed law),
 * raised by the waves' stirring to the mean stress of the combined flow,
 * tau_m = tau_c (1 + 1.2 (tau_w / (tau_c + tau_w))^3.2) (Soulsby 1995, the
 * DATA2 fit), tau_w = rho fw uw^2 / 2 from the waves' orbital speed at the bed
 * (`waveBedOrbitalMS`) and Soulsby's (1997) wave friction factor
 * (`soulsbyWaveFriction`).
 * THE SAND: the total load of the combined flow at each point across the jet,
 * Soulsby and van Rijn (1997): the waves stir (their rms orbital speed in the
 * stirring term), the current carries (the leading U); integrated across the
 * jet it is the jet's sand flux Qs(x), and where Qs falls the jet drops sand:
 * the deposition -dQs/dx. THE BAR is the first deposition lobe seaward of the
 * mouth: its center of mass, its length (where the deposition stands over half
 * its peak: the full crest; where it ends: the toe).
 */
export const JET_SHEAR_GROWTH = (JET_EDGE_SPREAD + 0.5 / JET_CORE_SIZES) / JET_EDGE_SIGMAS;
/** Soulsby and van Rijn's (1997) bed roughness for the drag in their total-load formula, m (their own fixed value). */
export const SVR_Z0_M = 0.006;
/**
 * The sand's d90 over its d50: STATED (a well-sorted natural sand; the beach's
 * sand has one grain size, MEDIUM_SAND_D50_M). It enters only van Rijn's
 * threshold speed, through log10(4 h / d90).
 */
export const SAND_D90_PER_D50 = 2;
/** Quartz over water: the relative density of the sand (the beach's R = 1.65 plus 1). */
export const SAND_REL_DENSITY = 2.65;
/**
 * THE PLUME'S SEDIMENT SETTLES (round 3). The river water stays in the sea,
 * but the turbid look is its suspended load, and the load falls out of the
 * column as the plume travels: along the jet's axis dC / dt = -ws C / h, so
 * the share left at x is exp(-int ws / (h uc) dx) (the plume's settling,
 * Syvitski, Asprey and Leblanc 1988's first-order removal). ws is the fall
 * speed (`sandFallSpeedMS`, Ferguson and Church 2004, Stokes' law at this
 * size) of the load's median grain, STATED as medium silt, 16 um (the wash
 * load of a small wet-tropical river is silt and clay; the catchment's yield
 * is stated the same way). With the jet filling the water column, a share of
 * the river water alone would draw the plume opaque for kilometers.
 */
export const SUSPENDED_D50_M = 16e-6;
/**
 * The jet's table runs to the sea surface's own radius (OCEAN_RADIUS_M in
 * oceanSurface.ts, 9 km; that module imports three, so the number is copied):
 * no water is drawn past it.
 */
export const JET_TABLE_REACH_M = 9000;

/**
 * The waves' orbital speed amplitude at the bed, m/s (linear theory):
 * pi H / (T sinh k h), H the rms wave Hs / sqrt(2) (Rayleigh heights,
 * Longuet-Higgins 1952) held to the broken wave's H = 0.55 h in the surf zone
 * (the bathymetry module's bore), T the zero-crossing period.
 */
export function waveBedOrbitalMS(hsM: number, tzS: number, hM: number): number {
  const h = Math.max(hM, 0.05);
  const hrms = Math.min(hsM / Math.SQRT2, BATHY_BORE_GAMMA * h);
  const omega = (2 * Math.PI) / tzS;
  const kh = Math.min(waveNumberAt(omega, h) * h, 20);
  return (Math.PI * hrms) / (tzS * Math.sinh(kh));
}

/** Soulsby's (1997) rough-bed wave friction factor: fw = 1.39 (A / z0)^-0.52, A = uw T / (2 pi), z0 = d50 / 12. */
export function soulsbyWaveFriction(uwMS: number, tzS: number, d50M: number): number {
  const a = Math.max((uwMS * tzS) / (2 * Math.PI), 1e-6);
  return 1.39 * (a / (d50M / 12)) ** -0.52;
}

/**
 * Van Rijn's (1984) threshold depth-mean speed for 0.1 to 0.5 mm sand, m/s:
 * U_cr = 0.19 d50^0.1 log10(4 h / d90) (Soulsby and van Rijn 1997's form).
 */
export function vanRijnCritSpeedMS(hM: number, d50M: number): number {
  return 0.19 * d50M ** 0.1 * Math.log10((4 * Math.max(hM, 0.05)) / (SAND_D90_PER_D50 * d50M));
}

/**
 * THE TOTAL LOAD OF A CURRENT WITH WAVES, m^2/s of sand per meter of width
 * (Soulsby and van Rijn 1997; Soulsby 1997, eq. 136a):
 *   q = As U (sqrt(U^2 + (0.018 / CD) Urms^2) - U_cr)^2.4   (0 under U_cr),
 *   As = Asb + Ass, Asb = 0.005 h (d50 / h)^1.2 / ((s - 1) g d50)^1.2,
 *   Ass = 0.012 d50 D*^-0.6 / ((s - 1) g d50)^1.2,
 *   CD = (0.40 / (ln(h / z0) - 1))^2, z0 = 6 mm,
 * U the current, Urms the waves' rms orbital speed at the bed. The flat bed's
 * form (no slope term).
 */
export function soulsbyVanRijnLoad(uMS: number, urmsMS: number, hM: number, d50M: number, nuM2S = SEA_WATER_NU_M2S): number {
  const h = Math.max(hM, 0.05);
  const sg = (SAND_REL_DENSITY - 1) * G * d50M;
  const dStar = d50M * ((G * (SAND_REL_DENSITY - 1)) / (nuM2S * nuM2S)) ** (1 / 3);
  const asb = (0.005 * h * (d50M / h) ** 1.2) / sg ** 1.2;
  const ass = (0.012 * d50M * dStar ** -0.6) / sg ** 1.2;
  const cd = (0.4 / Math.max(Math.log(h / SVR_Z0_M) - 1, 0.5)) ** 2;
  const e = Math.sqrt(uMS * uMS + (0.018 / cd) * urmsMS * urmsMS) - vanRijnCritSpeedMS(h, d50M);
  return e > 0 ? (asb + ass) * Math.abs(uMS) * e ** 2.4 : 0;
}

/** Root of k s u^2 - Q u + M = 0 that keeps the core (the smaller); s = sigma. */
function zofeCoreSpeed(qp: number, mp: number, sigma: number): number {
  const k = Math.sqrt(2 * Math.PI) - Math.sqrt(Math.PI);
  if (sigma * k < 1e-9) return mp / qp;
  const disc = qp * qp - 4 * k * sigma * mp;
  if (disc <= 0) return qp / (2 * k * sigma);
  return (qp - Math.sqrt(disc)) / (2 * k * sigma);
}

/**
 * THE FRICTION-DOMINATED JET (see the section's note): marched seaward from
 * the mouth line, a top-hat outflow at x = 0 (Q, M = U0^2 A: the core's speed
 * is U0 and its width the section's area over the depth there).
 */
export function frictionJet(o: {
  dischargeM3S: number;
  u0MS: number;
  areaM2: number;
  manningN: number;
  hsM: number;
  tzS: number;
  d50M: number;
  depthAt: (x: number) => number;
  /** How far to march, m (the plume's drawn reach is shorter; `jetReachM`). */
  reachM?: number;
  /** The suspended load's fall speed, m/s (the plume's settling). Absent: no settling. */
  fallMS?: number;
}): FrictionJet {
  const reach = o.reachM ?? JET_TABLE_REACH_M;
  const ws = o.fallMS ?? 0;
  let settleLn = 0;
  const xs: number[] = [];
  for (let x = 0; x < 200; x += 0.25) xs.push(x);
  for (let x = 200; x <= reach; x *= 1.005) xs.push(x);
  const n = xs.length;
  const out = {
    xM: Float64Array.from(xs), ucMS: new Float64Array(n), rcM: new Float64Array(n), sigmaM: new Float64Array(n),
    hM: new Float64Array(n), qM3S: new Float64Array(n), mM4S2: new Float64Array(n), cmShare: new Float64Array(n),
    lamE: new Float64Array(n), qsM3S: new Float64Array(n), depositM2S: new Float64Array(n), stirGain: new Float64Array(n),
    settle: new Float64Array(n),
  };
  const q0 = o.dischargeM3S;
  let q = q0;
  let m = o.u0MS * o.u0MS * o.areaM2;
  let established = false;
  const lam = JET_SCALAR_SPREAD;
  const rhoStar = lam / Math.sqrt(1 + lam * lam);
  const s2p = Math.sqrt(2 * Math.PI);
  for (let i = 0; i < n; i += 1) {
    const x = xs[i];
    const h = Math.max(o.depthAt(x), 0.05);
    const qp = q / h;
    const mp = Math.max(m / h, 1e-9);
    let uc: number;
    let rc: number;
    let sigma: number;
    if (!established) {
      sigma = JET_SHEAR_GROWTH * x;
      uc = zofeCoreSpeed(qp, mp, sigma);
      const a = qp / uc - sigma * s2p;
      if (a > 0) {
        rc = a / 2;
      } else {
        established = true;
        rc = 0;
        uc = (Math.SQRT2 * mp) / qp;
        sigma = qp / (uc * s2p);
      }
    } else {
      rc = 0;
      uc = (Math.SQRT2 * mp) / qp;
      sigma = qp / (uc * s2p);
    }
    // The river water: share 1 on the core; on the shoulders a Gaussian of lamE sigma, wide enough that
    // the river water's flux is the discharge (at the mouth all the jet's water is the river's), then
    // Fischer's 1.2 sigma with the axis share falling (the jet's flux grows by the sea water it takes in).
    let cm = 1;
    let lamE = lam;
    if (sigma > 1e-6) {
      const rho = (q0 / (h * uc) - 2 * rc) / (sigma * s2p);
      if (rho >= rhoStar) lamE = Math.min(rho / Math.sqrt(Math.max(1 - rho * rho, 1e-6)), 50);
      else cm = q0 / (h * uc * (2 * rc + sigma * s2p * rhoStar));
    } else {
      lamE = 50;
    }
    // The waves' stirring and the bed's stress.
    const uw = waveBedOrbitalMS(o.hsM, o.tzS, h);
    const fw = soulsbyWaveFriction(uw, o.tzS, o.d50M);
    const cf = (G * o.manningN * o.manningN) / h ** (1 / 3);
    const tc = cf * uc * uc;
    const tw = 0.5 * fw * uw * uw;
    const phi = 1 + 1.2 * (tw / Math.max(tc + tw, 1e-12)) ** 3.2;
    // The sand flux across the jet: the core, and the two shoulders (48 points to 4 sigma).
    const urms = uw / Math.SQRT2;
    let qs = 2 * rc * soulsbyVanRijnLoad(uc, urms, h, o.d50M);
    const ns = 48;
    for (let k = 0; k < ns; k += 1) {
      const sOff = ((k + 0.5) / ns) * 4 * sigma;
      qs += 2 * soulsbyVanRijnLoad(uc * Math.exp(-(sOff * sOff) / (2 * sigma * sigma)), urms, h, o.d50M) * ((4 * sigma) / ns);
    }
    out.ucMS[i] = uc; out.rcM[i] = rc; out.sigmaM[i] = sigma; out.hM[i] = h; out.qM3S[i] = q; out.mM4S2[i] = m;
    out.cmShare[i] = Math.min(cm, 1); out.lamE[i] = lamE; out.qsM3S[i] = qs; out.stirGain[i] = phi;
    out.settle[i] = Math.exp(settleLn);
    if (i + 1 < n) {
      const dx = xs[i + 1] - x;
      // ROUND 4: the silt settles only where the bed's stress stands under its critical stress for
      // deposition (Krone 1962, `kroneDepositShare`): the waves' and the current's mean stress here.
      settleLn -= (ws / (h * Math.max(uc, 1e-4))) * dx * kroneDepositShare(SEA_RHO_KG_M3 * (tc * phi + tw));
      q += 2 * JET_ENTRAINMENT * h * uc * dx;
      m = Math.max(m - cf * phi * uc * uc * (2 * rc + sigma * Math.sqrt(Math.PI)) * dx, 0);
      if (m <= 0) { m = 1e-12; }
    }
  }
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(i - 1, 0);
    const b = Math.min(i + 1, n - 1);
    out.depositM2S[i] = b > a ? -(out.qsM3S[b] - out.qsM3S[a]) / (out.xM[b] - out.xM[a]) : 0;
  }
  return { n, ...out };
}

/** The jet's values at distance x (linear between samples; held at the ends). */
export function jetProfileAt(j: FrictionJet, x: number): { uc: number; rc: number; sigma: number; h: number; cm: number; lamE: number; settle: number } {
  const xs = j.xM;
  if (x <= xs[0]) return { uc: j.ucMS[0], rc: j.rcM[0], sigma: j.sigmaM[0], h: j.hM[0], cm: j.cmShare[0], lamE: j.lamE[0], settle: j.settle[0] };
  const last = j.n - 1;
  if (x >= xs[last]) return { uc: j.ucMS[last], rc: j.rcM[last], sigma: j.sigmaM[last], h: j.hM[last], cm: j.cmShare[last], lamE: j.lamE[last], settle: j.settle[last] };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  const L = (a: Float64Array) => a[lo] + (a[hi] - a[lo]) * t;
  return { uc: L(j.ucMS), rc: L(j.rcM), sigma: L(j.sigmaM), h: L(j.hM), cm: L(j.cmShare), lamE: L(j.lamE), settle: L(j.settle) };
}

/* ------------------------------------------------------------------ */
/* Round 6: the surf zone's roller dissipation                           */
/* ------------------------------------------------------------------ */

/**
 * THE COAST'S BREAKING REFERENCE (round 6, law 2): on the coast's own floor,
 * away from the valley (300 m along the shore from the mouth), the depth
 * where the sea's significant wave breaks in full (H / d = 0.75, McCowan
 * 1894, BATHY_BREAK_FULL), the floor's slope there, and the surf zone's width
 * (the distance from the shoreline out to that depth).
 */
export function coastBreakRef(params: SeabedParams, frame: BeachFrame, mouthS: number, mouthA: number, hsM: number): { depthM: number; slope: number; widthM: number } {
  const depthB = hsM / BATHY_BREAK_FULL;
  const a = mouthA - 300;
  const at = (s: number) => {
    const x = frame.originX + s * frame.sX + a * frame.aX;
    const z = frame.originZ + s * frame.sZ + a * frame.aZ;
    return seabedPointAt(params, x, z).depthM;
  };
  let s = mouthS;
  while (s > mouthS - 2000 && at(s) < depthB) s -= 1;
  const slope = Math.max((at(s - 2) - at(s + 2)) / 4, 1e-4);
  let s0 = mouthS + 50;
  while (s0 > s && at(s0) <= 0) s0 -= 0.5;
  return { depthM: depthB, slope, widthM: s0 - s };
}

export function jetDeposit(j: FrictionJet): JetDeposit | null {
  const d = j.depositM2S;
  // The lobe holds the fastest rise of the bed (Exner 1925: the bed rises at
  // the deposition over the bed's solid share), so the crest grows there; the
  // lobe runs out from it each way to where the jet stops dropping sand.
  let ip = -1;
  for (let i = 0; i < j.n; i += 1) if (d[i] > 0 && (ip < 0 || d[i] > d[ip])) ip = i;
  if (ip < 0) return null;
  let i0 = ip;
  while (i0 - 1 >= 0 && d[i0 - 1] > 0) i0 -= 1;
  let i1 = ip;
  while (i1 + 1 < j.n && d[i1 + 1] > 0) i1 += 1;
  let mass = 0;
  let mx = 0;
  let peak = 0;
  for (let i = i0; i <= i1; i += 1) {
    const dx = (j.xM[Math.min(i + 1, j.n - 1)] - j.xM[Math.max(i - 1, 0)]) / 2;
    mass += d[i] * dx;
    mx += d[i] * j.xM[i] * dx;
    peak = Math.max(peak, d[i]);
  }
  let h0 = i1;
  let h1 = i0;
  for (let i = i0; i <= i1; i += 1) if (d[i] >= peak / 2) { h0 = Math.min(h0, i); h1 = Math.max(h1, i); }
  return { xM: mx / mass, halfFromM: j.xM[h0], halfToM: j.xM[h1], fromM: j.xM[i0], toM: j.xM[i1], peakM2S: peak, sandM3S: mass };
}

/* ------------------------------------------------------------------ */
/* Round 4: the sea beyond the bar is turbid too                         */
/* ------------------------------------------------------------------ */

/**
 * THE SILT STAYS UP WHERE THE WAVES STIR THE BED (river mouth round 4, the
 * lead's point 2a). Round 3's plume lost its load at dC/dt = -ws C / h all
 * along the axis. A cohesive silt settles onto the bed only where the bed's
 * stress stands under its critical stress for deposition, at the share
 * 1 - tau_b / tau_cd (Krone 1962, the deposition law of fine sediment;
 * tau_cd = 0.06 Pa, Krone's San Francisco Bay mud, the value Mehta 1984
 * carries), so over the surf zone and the shelf where the waves' bed stress
 * (Soulsby 1997's tau_w = rho fw ub^2 / 2, the jet's own wave friction)
 * exceeds it the load does not settle at all.
 */
export const KRONE_TAU_CD_PA = 0.06;
/** Sea water's density, kg/m^3 (the bed stresses). */
export const SEA_RHO_KG_M3 = 1025;
/** The share of the settling Krone's law keeps at a bed stress tau (Pa). */
export function kroneDepositShare(tauPa: number): number {
  return Math.max(1 - tauPa / KRONE_TAU_CD_PA, 0);
}

/**
 * THE WAVES' BED STRESS, Pa, of the rms wave Hrms on depth h (Soulsby 1997:
 * tau_w = rho fw ub^2 / 2, ub = pi Hrms / (T sinh k h), fw his rough-bed
 * friction factor for the sand's d50).
 */
export function waveBedStressPa(hrmsM: number, tS: number, hM: number, d50M: number): number {
  const h = Math.max(hM, 0.05);
  const kh = Math.min(waveNumberAt((2 * Math.PI) / tS, h) * h, 20);
  const ub = (Math.PI * hrmsM) / (tS * Math.sinh(kh));
  const fw = Math.min(soulsbyWaveFriction(ub, tS, d50M), 0.3);
  return 0.5 * SEA_RHO_KG_M3 * fw * ub * ub;
}

/**
 * THE WAVE-STIRRED SAND (the lead's point 2b), the beach's own 0.35 mm sand
 * lifted by the waves over the shelf and the surf zone, apart from the river's
 * load:
 *   - THE BED: van Rijn's (1984) reference concentration at a = max(0.01 h,
 *     2 d50 ... his 0.01 h for a flat bed), c_a = 0.015 d50 T^1.5 / (a D*^0.3),
 *     T = (tau_w - tau_cr) / tau_cr, tau_cr from Soulsby and Whitehouse's
 *     (1997) Shields curve, theta_cr = 0.30 / (1 + 1.2 D*) + 0.055 (1 - e^(-0.02 D*));
 *   - THE COLUMN: the breaking waves' mixing over the depth, van Rijn (1993):
 *     eps = 0.035 alpha_br h Hs / T, alpha_br = 1 + (Hs / h - 0.4)^0.5 over
 *     Hs / h = 0.4 (1 under it); the concentration falls from the reference
 *     height as c(z) = c_a e^(-ws (z - a) / eps) (the steady balance of
 *     settling and mixing, Rouse's with a constant eps), ws the sand's fall
 *     speed (`sandFallSpeedMS`).
 * It returns the load at the surface, the depth mean and the column, g/m^3
 * and g/m^2.
 */
export function shieldsCritical(d50M: number, nuM2S = SEA_WATER_NU_M2S): number {
  const dStar = d50M * ((G * (SAND_REL_DENSITY - 1)) / (nuM2S * nuM2S)) ** (1 / 3);
  return 0.3 / (1 + 1.2 * dStar) + 0.055 * (1 - Math.exp(-0.02 * dStar));
}
export function stirredSandLoad(o: { hrmsM: number; tS: number; hM: number; d50M: number; nuM2S?: number }): StirredLoad {
  const h = Math.max(o.hM, 0.05);
  const nu = o.nuM2S ?? SEA_WATER_NU_M2S;
  const dStar = o.d50M * ((G * (SAND_REL_DENSITY - 1)) / (nu * nu)) ** (1 / 3);
  const tauCr = shieldsCritical(o.d50M, nu) * (SAND_REL_DENSITY - 1) * SEA_RHO_KG_M3 * G * o.d50M;
  const tauW = waveBedStressPa(o.hrmsM, o.tS, h, o.d50M);
  const a = 0.01 * h;
  const tt = Math.max((tauW - tauCr) / tauCr, 0);
  // Held to van Rijn's (2007) upper bound on the reference concentration, 0.05 by volume.
  const caVol = Math.min((0.015 * o.d50M * tt ** 1.5) / (a * dStar ** 0.3), 0.05);
  const hs = o.hrmsM * Math.SQRT2;
  const r = hs / h;
  const alphaBr = r > 0.4 ? 1 + Math.sqrt(r - 0.4) : 1;
  const eps = Math.max(0.035 * alphaBr * h * (hs / o.tS), 1e-6);
  const ws = sandFallSpeedMS(o.d50M, nu);
  const rhoS = SAND_REL_DENSITY * 1e6;
  const caG = caVol * rhoS;
  const decay = ws / eps;
  const span = Math.max(h - a, 0);
  const column = decay * span > 1e-9 ? (caG * (1 - Math.exp(-decay * span))) / decay : caG * span;
  return { tauWPa: tauW, tauCrPa: tauCr, caVol, aM: a, epsM2S: eps, surfGM3: caG * Math.exp(-decay * span), meanGM3: column / h, columnGM2: column };
}

/**
 * THE SAND'S LIGHT AGAINST THE SILT'S. Kirk's specific scattering (0.5 m^2/g,
 * SED_SCATTER_M2_G) is for the fine mineral suspensoids of a turbid river; a
 * grain scatters by its cross-section, twice its geometric area for a large
 * grain (the extinction paradox, van de Hulst 1957), so per gram a grain of
 * diameter d scatters 3 / (rho_s d): 3.2e-3 m^2/g for the 0.35 mm sand, a
 * 155th of the silt's. The stirred sand's column goes to the surface as the
 * column of river water that holds the same scattering:
 *   H_eq = M_sand (b*_sand / b*_silt) / C_river.
 */
export function sandScatterM2PerG(d50M: number): number {
  return 3 / (SAND_REL_DENSITY * 1e6 * d50M);
}
