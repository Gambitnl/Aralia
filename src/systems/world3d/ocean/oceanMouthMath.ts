/**
 * @file oceanMouthMath.ts — the river mouth: a river runs through the beach
 * into the sea, as ONE water (ADR 0006, GG-341). The physics and every
 * number; no three import, so the worker (`oceanMouthWorker.ts`) and the
 * tests run it as the page does.
 *
 * WHY THIS EXISTS (Remy, 2026-09-29: "when it gets to the sea, it's not like
 * two different systems meet"; 2026-10-09: "add the beach and the ocean at
 * the mouth of the river"). Before this file the river reach and the sea
 * were two scenes with two solvers and two looks. Here the river's water
 * reaches the sea on one grid whose sea edge is the FFT sea itself, the sea's
 * surface draws it (`oceanSurface.ts`, `setRiver`), its outflow carries on
 * into the sea as a jet with a plume of turbid water, and its foam goes into
 * the sea's one foam field.
 *
 * WHAT IS IN IT, each part with the law it follows:
 *
 *   THE DESIGN (`deriveMouthDesign`): the channel's width and depth from the
 *   discharge (hydraulic geometry, Leopold and Maddock 1953, with the
 *   coefficients of Moody and Troutman 2002), the river's own slope, shape
 *   and roughness from the judged reach's last reach (`riverReach.ts`), the
 *   banks at the sand's angle of repose, the valley head at the cay's divide,
 *   the sea's significant height and period at the mouth (the FFT sea's own
 *   height, summed on the CPU as the beach does), the jet's core and spread
 *   (Albertson et al. 1950), the ebb bar where the jet drops the sand
 *   (the sand's threshold of motion, the beach's own) with its crest at the
 *   sea's breaking depth (McCowan 1894, as `oceanBathymetry.ts`), and the
 *   turbid water's optics from a stated sediment load (Kirk 1994).
 *
 *   THE NEAR FIELD (`MouthField`): the 2D shallow water equations on a grid
 *   in the beach's own (s, a) frame, from the beach's sea edge to the valley
 *   head. The same scheme as the beach swash and the river reach, face for
 *   face (HLL fluxes, Audusse et al. 2004 hydrostatic reconstruction,
 *   semi-implicit Manning; `hllFaceInto` is the swash's own flux). Its sea
 *   edge is the FFT sea: an absorbing-generating boundary (Kobayashi, Otta
 *   and Roy 1987, the beach's) forced by the sea's height sampled on the CPU
 *   exactly as the beach worker samples it, so sea waves run in, the river's
 *   water runs out, and a reflected wave leaves. A passive tracer carries the
 *   share of river water. The step is fixed, so a pinned time reproduces.
 *
 *   THE PLUME (`jetAt`): the outflow as a momentum jet past the grid,
 *   closed form; the tracer flux it carries is the discharge at every
 *   distance (a test).
 *
 *   THE WAVE LAWS (`bandShareCpu`, `holdShareCpu`): the CPU twins of the
 *   surface's damping of each FFT band by the depth (shoaling, Dean and
 *   Dalrymple 1991; breaking, the bathymetry module's) and by the opposing
 *   current (wave action, Bretherton and Garrett 1968).
 *
 * SHARED OWNERS: oceanMouthLaws holds the constants, oceanMouthOptics the light
 * equations, and oceanMouthField the intact grid and soil. This file preserves
 * the public API; the concern modules own place design and simulation assembly.
 *
 * CPU CONCERNS: coast design, transport, jet, wave math, fine chop, simulation
 * and young-sea rules have named modules. This facade keeps the original public
 * imports and owns only packing the grid state for its existing GPU reader.
 *
 * WHAT IS STILL OPEN: see the "## River mouth" section of
 * `docs/architecture/domains/world3d-ocean.md`.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:30:33
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/mouth.ts, systems/world3d/ocean/oceanMouth.ts, systems/world3d/ocean/oceanMouthWorker.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type MouthDesign, type MouthPack, type YoungSea, type MouthBand } from './oceanMouthTypes';
import { MouthField } from './oceanMouthField';
import { toHalf, BATHY_BORE_GAMMA, MEDIUM_SAND_D50_M, bathyShoalGain } from './oceanBeachMath';
import { youngCellField } from './oceanMouthYoungSea';
import { mouthHandoverAt, localBandShares, battjesStiveGamma, battjesJanssenMarch } from './oceanMouthWaveMath';
import { jetLensM, saltWedgeLengthM } from './oceanMouthJet';
import { channelAlongTable, outletRiverShare } from './oceanMouthSimulation';
import { sandScatterM2PerG, stirredSandLoad } from './oceanMouthTransport';
import { SED_SCATTER_M2_G } from './oceanMouthLaws';

// Public compatibility path: each intact CPU concern has its own named home.
export { type MouthBand, type MouthDesign, type SurfCoast, type MouthPlace, type InfragravityEdge, type MouthSim, type FrictionJet, type JetDeposit, type JetPoint, type LensSpread, type MouthPack, type JetDomain, type MouthPlaceConditions, type MouthDisplayCurve, type LongshoreDrift, type DeflectedSpit, type LowFlowChannel, type DeflectedCourse, type BoreMarch, type FilmSlick, type FinePatch, type StirredLoad, type FrontEddyTable, type RollerCoast, type YoungSea, type YoungFine, type PhaseWarpMap } from './oceanMouthTypes';
export { mouthDisplayCurve, SARCELLE_CONDITIONS, mouthPlaceConditions, windFromChop, placeRiverWindMS } from './oceanMouthConditions';
export { sandFallSpeedMS, deanProfileA, JET_SHEAR_GROWTH, SVR_Z0_M, SAND_D90_PER_D50, SAND_REL_DENSITY, SUSPENDED_D50_M, JET_TABLE_REACH_M, waveBedOrbitalMS, soulsbyWaveFriction, vanRijnCritSpeedMS, soulsbyVanRijnLoad, frictionJet, jetProfileAt, coastBreakRef, jetDeposit, KRONE_TAU_CD_PA, SEA_RHO_KG_M3, kroneDepositShare, waveBedStressPa, shieldsCritical, stirredSandLoad, sandScatterM2PerG } from './oceanMouthTransport';
export { jetAt, jetTakeover, seaDriftMS, seaOrbitalMS, RIVER_WATER_RHO_KG_M3, RIVER_REDUCED_G, buoyantLensM, SALT_WEDGE_FRICTION, saltWedgeLengthM, lensSpreadOf, lensAt, jetLensM, lensShareAt, jetReachM, JET_DOMAIN_MARGIN, JET_DOMAIN_NS, JET_DOMAIN_NA, jetDomain, jetTexelXY, jetUvOf, buildJetPack, jetFrontFoamOf, jetFrontFoam, mouthEdgeBore, KH_MOST_AMPLIFIED_ALPHA, KH_MODES, KH_TABLE_N, frontEddyTable, frontModeEnvelope, frontEnvelopeNorm, frontEddyShiftM } from './oceanMouthJet';
export { ELF_CM_MS, ELF_KM_RAD_M, FINE_SHORT_M, FINE_PATCH_M, FINE_N, FINE_VISCOUS_K, frictionVelocityMS, capillaryPhaseSpeed, elfouhailyBh, elfouhailyDelta, elfouhailySlopeVar, coxMunkMss, COX_MUNK_SLICK_A, COX_MUNK_SLICK_B, FILM_LONGEST_M, SLOPE_VAR_PER_OCTAVE, coxMunkSlickMss, filmSlick, filmBandTake, fineChopPatch, mouthFinePatch } from './oceanMouthFineChop';
export { windLockedBands, bandPeriodS, mouthBands, localBandShares, groupSpeed, currentShare, bandShareCpu, envelopeHoldCpu, holdShareCpu, mouthHandoverLengthM, mouthHandoverStarts, mouthHandoverAt, RUESSINK_B_MAX, ruessinkAsymmetry, LEAN_PER_ASYMMETRY, LEAN_TABLE_DEPTH_M, LEAN_TABLE_N, boreLeanTable, donelanBeta, SECH2_HALF_ENERGY, halfEnergyAngle, bandSlopeOmega, crestStretchOf, erfcAS, reflectedStoppedShareCpu, STOCKDON_DISSIPATIVE_SETUP, swashBarCrestM, BJ_ALPHA, battjesStiveGamma, bjBreakFraction, waveNumberOnCurrent, battjesJanssenMarch, MOUTH_BORE_STEP_M, localPeakCut, SVENDSEN_ROLLER_AREA_PER_H2, DUNCAN_ROLLER_AREA_PER_L2, ROLLER_LENGTH_PER_H, rollerCoastOf, fentonMcKeeK, rollerOnDepth, rollerMeanCoverage, rollerSourceCpu, effectiveFresnelCpu, SLANT_FETCH_DIRS, slantFetchStretch, PLUME_FRONT_SHARE, riverFilmAt, MCCOWAN_GAMMA, depthLimitedBreakShare, sourceBreakingShareCpu, hedgesK, phaseWarpRatio, phaseWarpMap } from './oceanMouthWaveMath';
export { daySeaCascades, daySeaCoast, shorelineSOf, seaStatsAt, COAST_PLACES, deriveSurfCoast, COAST_BEACH_GRID, COAST_RIGHT_BANK_M, COAST_LEFT_BANK_M, coastBeachGrid, MOUTH_CELLS_PER_WAVE, MOUTH_CELLS_PER_CHANNEL, MOUTH_CELL_LATTICE_M, MOUTH_DX_M, mouthCellM, mouthPlaceOf, deriveMouthDesign, mouthFloorDetail, mouthSwashWalls, CERC_K_SIG, SAND_POROSITY, ESCOFFIER_SPEED_MS, YEAR_S, birkemeierClosureM, komarGaughanBreakerM, cercDriftM3S, longshoreDriftOf, channelSectionFull, deflectedSpitOf, LEOPOLD_MADDOCK_AT_A_STATION, atAStationExponents, lowFlowChannelOf, deflectedCourse, sedimentSlopeOf, placeRiverOptics } from './oceanMouthCoast';
export { mouthWaterTable, MOUTH_DT, MOUTH_SPINUP_S, mouthSpinUpS, MOUTH_SPINUP_DT, mouthSpinUpDt, mouthSandManningN, mouthManningCells, MOUTH_IG_FIELD_GAIN, STOCKDON_IG_SWASH, stockdonIgSwashM, hankel0Abs, standingLongWaveIncoming, infragravityEdge, MOUTH_STEADY_CHUNK_S, MOUTH_STEADY_SHARE, MOUTH_STEADY_MAX_S, MOUTH_EDGE_RMS_SPAN_S, MOUTH_EDGE_RMS_ROWS, MOUTH_COARSE_FACTOR, outletSectionCells, outletRiverShare, channelAlongTable, mouthChannelAt, mouthCellWorld, createMouthSim, channelAreaM2, channelNormalDepthM, MouthClock } from './oceanMouthSimulation';
export { riverFetchAlongM, cellSlantStretch, YOUNG_SEA_N, youngSeaMoments, youngSeaOf, YOUNG_SPLIT_TEXELS, YOUNG_FINE_PATCH_RATIO, youngFineOf, youngPlumeExits, youngSeaShare, openBandBlockR, youngBlockedShare, youngFetchWalk, youngCellShares, FRESNEL_EDGE_SIGMA, youngStrainMemoryS, youngCellField, youngFilmRest, youngFilmTake } from './oceanMouthYoungSea';

// Public compatibility path: the laws, optics and intact field now have named homes.
export { HG_WIDTH_A, HG_WIDTH_B, HG_DEPTH_C, HG_DEPTH_F, SAND_REPOSE_RAD, RIVER_OUTLET_S, JET_CORE_SIZES, JET_EDGE_SPREAD, JET_EDGE_SIGMAS, JET_SCALAR_SPREAD, JET_ENTRAINMENT, BLOCK_BREAK_R, RIVER_SEDIMENT_G_M3, CATCHMENT_YIELD_T_KM2_YR, CATCHMENT_RUNOFF_M_YR, RATING_EXPONENT_B, meanSedimentGM3, ratingCurveGM3, SED_SCATTER_M2_G, SED_BACKSCATTER_RATIO, SED_ABSORB_443_M2_G, SED_ABSORB_SLOPE_NM, WATER_ABSORB_RGB, RGB_NM, WATER_TO_AIR_RADIANCE } from './oceanMouthLaws';
export { type TurbidOptics, turbidOptics, turbidRadianceCpu, riverColumnTransCpu, srgbToLinear, sedimentSlopeForHue, CDOM_SLOPE_NM, SED_BACKSCATTER_M2_G, gordonR, gordonX, type RiverIop, turbidOpticsIop, riverIopForReflectance, type SandSeaIop, sandSeaIop, sandSeaCpu, twoWatersCpu } from './oceanMouthOptics';
export { type MouthLedger, MOUTH_H_DRY, MouthSoil, MouthField, type MouthState } from './oceanMouthField';

export function packMouthState(d: MouthDesign, f: MouthField, blendM: number, out?: MouthPack, young: YoungSea | null = null, startS?: ArrayLike<number>): MouthPack {
  const g = d.grid;
  const nc = g.ns * g.na;
  const a = out?.a ?? new Uint16Array(nc * 4);
  const b = out?.b ?? new Uint16Array(nc * 4);
  const cs = out?.c ?? new Uint16Array(nc * 4);
  const ds = f.soil === null ? undefined : (out?.d ?? new Uint16Array(nc * 4));
  if (ds !== undefined && f.soil !== null) {
    for (let c = 0; c < nc; c += 1) {
      ds[c * 4] = toHalf(f.soil.skinSaturation(c));
      ds[c * 4 + 1] = toHalf(Math.min(f.soil.dryS[c], 3600) / 60);
      ds[c * 4 + 2] = toHalf(f.h[c]);
      ds[c * 4 + 3] = toHalf(f.foam[c]);
    }
  }
  const fr = d.frame;
  const loc = d.bands.find((x) => x.local) ?? null;
  // Round 11 (law 2): the open band's and the young sea's shares with the open band's diffraction (`youngCellField`).
  const yField = young === null ? null : youngCellField(d, f, young);
  // The drawn level of each wet cell (NaN when dry), for the slope.
  const lv = new Float64Array(nc);
  for (let j = 0; j < g.na; j += 1) {
    const aa = g.a0 + (j + 0.5) * g.da;
    for (let i = 0; i < g.ns; i += 1) {
      const c = j * g.ns + i;
      lv[c] = f.h[c] > 1e-3 ? mouthHandoverAt(d, blendM, g.s0 + (i + 0.5) * g.ds, aa, startS) * (f.bed[c] + f.h[c]) : Number.NaN;
    }
  }
  const diff = (c: number, cm: number | null, cp: number | null, h: number): number => {
    const m = cm === null ? Number.NaN : lv[cm];
    const p = cp === null ? Number.NaN : lv[cp];
    const okM = !Number.isNaN(m);
    const okP = !Number.isNaN(p);
    if (okM && okP) return (p - m) / (2 * h);
    if (okP) return (p - lv[c]) / h;
    if (okM) return (lv[c] - m) / h;
    return 0;
  };
  for (let j = 0; j < g.na; j += 1) {
    for (let i = 0; i < g.ns; i += 1) {
      const c = j * g.ns + i;
      let gx = 0;
      let gz = 0;
      if (!Number.isNaN(lv[c])) {
        const dS = diff(c, i > 0 ? c - 1 : null, i < g.ns - 1 ? c + 1 : null, g.ds);
        const dA = diff(c, j > 0 ? c - g.ns : null, j < g.na - 1 ? c + g.ns : null, g.da);
        gx = dS * fr.sX + dA * fr.aX;
        gz = dS * fr.sZ + dA * fr.aZ;
      }
      cs[c * 4] = toHalf(-gx);
      cs[c * 4 + 1] = toHalf(-gz);
      /* ROUND 9 (law 1): with the young sea drawn, C.z is the open band's share (height and slope: the sea's own
       * band where it reaches the cell, by the current's law) and C.w the young sea's (\`youngCellShares\`), each
       * held by the water's own depth. */
      if (yField !== null) {
        cs[c * 4 + 2] = toHalf(yField.open[c]);
        cs[c * 4 + 3] = toHalf(yField.young[c]);
        continue;
      }
      // The wind-locked band's local shares (round 2).
      let rh = 1;
      let rsl = 1;
      if (loc !== null && f.h[c] > 1e-3) {
        const fetch = riverFetchM(d, f, i, j, loc);
        if (fetch < loc.fetchM) {
          const hh = f.h[c];
          const ux = (f.hu[c] / hh) * fr.sX + (f.hv[c] / hh) * fr.aX;
          const uz = (f.hu[c] / hh) * fr.sZ + (f.hv[c] / hh) * fr.aZ;
          const wRel = Math.hypot(loc.localWindMS * loc.dirX - ux, loc.localWindMS * loc.dirZ - uz);
          const sh = localBandShares(loc, wRel, fetch);
          rh = sh.h;
          rsl = sh.s;
        }
      }
      // THE WATER'S OWN DEPTH HOLDS THE LOCAL WIND SEA (round 2): a wave
      // keeps H = 0.55 h at most (the bathymetry module's broken-wave law),
      // so on a film of h the band's height and slope fall by
      // min(1, 0.55 h / Hs_local), Hs_local the band's Hs times its share.
      if (loc !== null) {
        const hsLoc = Math.max(loc.hsM * rh, 1e-6);
        const film = f.h[c] > 1e-3 ? Math.min(1, (BATHY_BORE_GAMMA * f.h[c]) / hsLoc) : 0;
        rh *= film;
        rsl *= film;
      }
      cs[c * 4 + 2] = toHalf(rh);
      cs[c * 4 + 3] = toHalf(rsl);
    }
  }
  // Round 12 (gap 1): the lens's thickness by row seaward of the mouth (`jetLensM`, one jet profile a row); upstream
  // of the mouth line the river's layer over the salt wedge (`saltWedgeLengthM`): the mouth's lens, thickening to the
  // whole depth at the wedge's toe (wedgeRow: the share of the wedge's length, 0 at the mouth line).
  const lens0 = jetLensM(d, 0);
  const wedgeL = saltWedgeLengthM(d.jet.hM[0], d.u0MS);
  const lensRow = new Float64Array(g.ns);
  const wedgeRow = new Float64Array(g.ns);
  for (let i = 0; i < g.ns; i += 1) {
    const s = g.s0 + (i + 0.5) * g.ds;
    lensRow[i] = s < d.mouthS ? jetLensM(d, d.mouthS - s) : lens0;
    wedgeRow[i] = s < d.mouthS ? 0 : wedgeL > 0 ? Math.min((s - d.mouthS) / wedgeL, 1) : 1;
  }
  const lensAt = (s: number, h: number): number => {
    const r = Math.min(Math.max(Math.floor((s - g.s0) / g.ds), 0), g.ns - 1);
    return lensRow[r] + Math.max(h - lensRow[r], 0) * wedgeRow[r];
  };
  /* ROUND 13 (law 1): on the deflected course the wedge runs up the channel's own along (`mouthChannelAt`, one table a
   * design), not up s: the reach behind the spit runs along the shore. Seaward of the mouth line the lens as before. */
  const alongTab = d.valley.course ? channelAlongTable(d) : null;
  // ROUND 14 (ruling 3): the wedge's water carries the river's fines at the outlet's river share (see THE SALT WEDGE'S WATER).
  const wedgeShare = outletRiverShare(d, f);
  const insideAt = (c: number, s: number): boolean => (alongTab === null ? s >= d.mouthS : alongTab[c] >= 0);
  const lensAtCell = (c: number, s: number, h: number): number => {
    if (alongTab === null || s < d.mouthS) return lensAt(s, h);
    const share = wedgeL > 0 ? Math.min(Math.max(alongTab[c], 0) / wedgeL, 1) : 1;
    return lens0 + Math.max(h - lens0, 0) * share;
  };
  for (let j = 0; j < g.na; j += 1) {
    const aa = g.a0 + (j + 0.5) * g.da;
    for (let i = 0; i < g.ns; i += 1) {
      const c = j * g.ns + i;
      const s = g.s0 + (i + 0.5) * g.ds;
      const w = mouthHandoverAt(d, blendM, s, aa, startS);
      const hh = f.h[c];
      const bed = f.bed[c];
      const wet = hh > 1e-3;
      // THE SUBCELL WET EDGE (round 2; the lead's point 5). A dry cell held
      // its drawn surface 2 cm under its bed, so the drawn water fell from the
      // wet cell's level to under the dry cell's bed across one cell, and the
      // waterline sat near the dry cell's center: on the 32 degree banks it
      // stepped with the cells (0.5 m in round 1, 1 m on the Sarcelle's
      // grid). A dry cell beside wet ones, whose ground stands over their
      // water, now carries their level flat (the mean of its wet neighbors'
      // surfaces): the drawn surface is the still water surface carried past
      // the cell's center, and the floor's own mesh hides it where the ground
      // rises over it, so the waterline is the ground's contour at the
      // water's level, wherever it falls inside the cell (the drawing's twin
      // of the beach's Chen and Noelle faces). A dry cell with ground under
      // that level (a hollow the water has not reached) keeps the old rule.
      let surf = wet ? bed + hh : Math.min(bed - 0.02, 0);
      if (!wet) {
        let sum = 0;
        let nW = 0;
        const add = (k: number) => { if (f.h[k] > 1e-3) { sum += f.bed[k] + f.h[k]; nW += 1; } };
        if (i > 0) add(c - 1);
        if (i < g.ns - 1) add(c + 1);
        if (j > 0) add(c - g.ns);
        if (j < g.na - 1) add(c + g.ns);
        if (nW > 0 && bed > sum / nW) surf = sum / nW;
      }
      const us = wet ? f.hu[c] / hh : 0;
      const ua = wet ? f.hv[c] / hh : 0;
      const sea = wet ? Math.min(Math.max(-bed, 0), hh) : 0;
      const share = wet ? f.hc[c] / hh : 0;
      const o = c * 4;
      a[o] = toHalf(w * surf);
      a[o + 1] = toHalf(sea);
      a[o + 2] = toHalf(us * fr.sX + ua * fr.aX);
      a[o + 3] = toHalf(us * fr.sZ + ua * fr.aZ);
      b[o] = toHalf(share);
      b[o + 1] = toHalf(w);
      // Round 12 (gap 1): the river's water is the buoyant lens seaward of the mouth line (`jetLensM` on the axis) and
      // the layer over the salt wedge inside it (`saltWedgeLengthM`), at most the tracer's own column.
      // Round 14 (ruling 3): with the wedge's own fines under that layer (its thickness times the outlet's share).
      const layer = wet ? lensAtCell(c, s, hh) : 0;
      const wedgeCol = wet && insideAt(c, s) ? Math.max(hh - layer, 0) * wedgeShare : 0;
      b[o + 2] = toHalf(wet ? Math.min(Math.min(f.hc[c], layer * share) + wedgeCol, hh) : 0);
      b[o + 3] = toHalf(f.foam[c]);
    }
  }
  return { a, b, c: cs, ...(ds !== undefined ? { d: ds } : {}) };
}

/**
 * THE FETCH OVER THE WATER at a near-field cell, m (round 2): the distance
 * upwind (against the band's travel, `dirX`, `dirZ`) over wet cells to the
 * first dry one: the bank the wind leaves. A walk that leaves the grid over
 * water (the sea edge, or a side edge seaward of the shoreline) meets the
 * open sea: the band's own fetch. One cell a step.
 */
export function riverFetchM(d: MouthDesign, f: MouthField, i0: number, j0: number, b: MouthBand): number {
  const g = d.grid;
  const fr = d.frame;
  // The upwind direction in the grid frame, one cell a step.
  const us = -(b.dirX * fr.sX + b.dirZ * fr.sZ);
  const ua = -(b.dirX * fr.aX + b.dirZ * fr.aZ);
  let s = i0 + 0.5;
  let a = j0 + 0.5;
  let last = j0 * g.ns + i0;
  const maxSteps = 4 * (g.ns + g.na);
  for (let k = 1; k <= maxSteps; k += 1) {
    s += us;
    a += ua;
    const i = Math.floor(s);
    const j = Math.floor(a);
    if (i < 0 || j < 0 || i >= g.ns || j >= g.na) {
      // Off the grid: over the sea if the last cell is sea water, else at a bank.
      return f.bed[last] < 0 && f.h[last] > 1e-3 ? b.fetchM : k * g.ds;
    }
    const c = j * g.ns + i;
    if (f.h[c] <= 1e-3) return k * g.ds;
    last = c;
  }
  return b.fetchM;
}
export function stirredRiverColumnM(d: MouthDesign, columnGM2: number, d50M: number): number {
  return (columnGM2 * (sandScatterM2PerG(d50M) / SED_SCATTER_M2_G)) / Math.max(d.sedimentGM3, 1e-6);
}

/**
 * THE STIRRED SAND OVER THE COAST'S FLOOR MAP (one value a texel): the BJ
 * balance down each column of the map (constant world x, the waves running
 * toward -z as the coast faces them), over the map's own depths, from its
 * sea edge with the FFT sea shoaled with no loss, then the stirred load and
 * its river-water column. The jet's current is left out of this march (its
 * near field and plume carry their own water); the river's channel above the
 * mean sea level (depth 0) carries none. Returns the column per texel, m, and
 * the march's Hrms per texel, m.
 */
export function coastStirredColumns(d: MouthDesign, map: { res: number; texelM: number; originX: number; originZ: number; data: Float32Array }): { columnM: Float32Array; hrmsM: Float32Array; qbM: Float32Array } {
  const n = map.res;
  const out = new Float32Array(n * n);
  const hr = new Float32Array(n * n);
  // Round 6: the march's share of breaking waves (Battjes and Janssen's Q_b) per texel: the coast's breakers.
  const qbOut = new Float32Array(n * n);
  const d50 = d.params.island?.grainD50M ?? MEDIUM_SAND_D50_M;
  const hrmsDeep = d.hsM / Math.SQRT2;
  const tS = d.tzS;
  const gamma = battjesStiveGamma(hrmsDeep, tS);
  const xs = new Float64Array(n);
  const hs = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    // Down the column from the sea edge (the largest z) shoreward.
    for (let r = 0; r < n; r += 1) {
      const j = n - 1 - r;
      xs[r] = r * map.texelM;
      hs[r] = Math.max(map.data[(j * n + i) * 4], 0);
    }
    // March while the floor is under the mean sea level; past the shore the rest are dry.
    let last = n;
    for (let r = 0; r < n; r += 1) if (hs[r] <= 0.02) { last = r; break; }
    if (last < 2) continue;
    const march = battjesJanssenMarch({
      xM: xs.subarray(0, last), depthM: hs.subarray(0, last),
      hrms0M: hrmsDeep * bathyShoalGain(tS, Math.max(hs[0], 0.05)), tS, d50M: d50, gamma,
    });
    for (let r = 0; r < last; r += 1) {
      const j = n - 1 - r;
      const ld = stirredSandLoad({ hrmsM: march.hrmsM[r], tS, hM: hs[r], d50M: d50 });
      out[j * n + i] = stirredRiverColumnM(d, ld.columnGM2, d50);
      hr[j * n + i] = march.hrmsM[r];
      qbOut[j * n + i] = march.qb[r];
    }
  }
  return { columnM: out, hrmsM: hr, qbM: qbOut };
}
