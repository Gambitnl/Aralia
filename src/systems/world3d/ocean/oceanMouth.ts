/**
 * @file oceanMouth.ts — the river mouth on the GPU: the reader the sea's one
 * surface draws the river, the mouth and the plume through
 * (`oceanSurface.ts`, `setRiver`), the source the mouth's foam goes into the
 * sea's one foam field through (`oceanFoamSources`), and the worker that
 * steps the near field (`oceanMouthWorker.ts`). The physics and every number
 * are `oceanMouthMath.ts`; ADR 0006 is the design.
 *
 * THE READER'S FIELDS, per world XZ:
 *   level     m over the mean sea level that the surface lifts its vertex by:
 *             the near field's water surface times its hand-over (0 at the
 *             grid's sea edge, so the sea there is the FFT's own);
 *   depth     the sea depth the depth laws read, m: the near field's water
 *             under the mean sea level (0 where the bed stands over it: the
 *             river alone), else the coast's floor (the seabed's own map);
 *   velocity  the near field's flow, past it the jet's (`jetAt`), m/s;
 *   plume     the river water's share, 0 to 1;
 *   handover  the near field's share of the bands it carries;
 *   column    the river water's column, m, for the turbid optics;
 *   rippleH, rippleS, rippleW (round 2)  the wind-locked band's local
 *             shares of height and slope on the near field, and their weight.
 *
 * ROUND 2 also: the plume's textures in the jet's own coordinates
 * (`jetDomain`), and the foam source breaks the sea's crests over the coast's
 * floor and carries the swash's bore foam into the one foam field.
 *
 * Three sources, read in this order of trust: the near field's two textures
 * (from the worker, each state), the plume's two static textures (the jet's
 * closed form, built once), and the coast's depth (the floor's map). Past the
 * near field and the plume the water is still (level 0, no flow, no river
 * water) and only the coast's depth acts: the surf's crests are held to the
 * depth along the whole coast, as the sea's own waves are. Past the map its
 * edge's depth carries on (the texture's clamp): along the shore that is the
 * same coast profile, and offshore 11 m, where no crest of this sea is held.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 02:03:47
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/mouth.ts, systems/world3d/ocean/oceanSurface.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { Fn, abs, clamp, cos, exp, float, floor, log, max, min, mix, pow, sin, smoothstep, sqrt, step, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import type { OceanBeachSwash } from './oceanBeach';
import type { OceanField } from './oceanField';
import { FLOOR_LIGHT, type SeabedMap } from './oceanSeabedMath';
import { beachToWorld, forcingCascades } from './oceanBeachMath';
import type { CascadeParams } from './oceanConfig';
import {
  KH_MODES, KH_TABLE_N, LEAN_TABLE_DEPTH_M, LEAN_TABLE_N, MOUTH_DT, frontEddyTable, SED_ABSORB_443_M2_G, SED_ABSORB_SLOPE_NM, WATER_TO_AIR_RADIANCE, boreLeanTable, sandSeaIop, buildJetPack, coastStirredColumns, crestStretchOf, jetDomain, localPeakCut, mouthFinePatch, mouthHandoverLengthM,
  filmSlick, type FilmSlick, type MouthBand, type MouthDesign, type MouthLedger, ROLLER_LENGTH_PER_H, rollerCoastOf,
  PLUME_FRONT_SHARE, depthLimitedBreakShare,
  BLOCK_BREAK_R, YOUNG_SEA_N, phaseWarpMap, youngFineOf, youngStrainMemoryS, youngFilmRest, youngFilmTake, youngPlumeExits, youngSeaOf, type YoungSea,
} from './oceanMouthMath';
import { createOceanYoungFft } from './oceanMouthYoung';
import { createOceanNormalMip, type OceanNormalMip } from './oceanNormalMip';
import type { OceanFoamBreaker, OceanFoamSource } from './oceanFoam';
import { createOceanSampler } from './oceanSampler';
import { OCEAN_BREAK_FULL, OCEAN_BREAK_START, oceanBathymetryFor } from './oceanBathymetry';
import { oceanSkyDeckLight } from './oceanSky';

/**
 * ROUND 2'S WEIGHT OF A DEPTH BREAK IN THE ONE FOAM FIELD: the field's own
 * weight on its reef law (`oceanFoam.ts`, tune.reefGain 0.4), copied. It was
 * INHERITED, not derived, and it put the breaking share on the whole crest,
 * so at 1 the whole 118 m surf zone drew solid white and at 0.4 the breakers
 * did not show at eye level (river mouth round 2, lost: "no breaking line at
 * all"). ROUND 3 does not read it: the coast's breakers are the ROLLER on the
 * front face of each broken crest (`MOUTH_ROLLER_*`, the foam source below).
 * Kept exported for the round-2 frames' record.
 */
export const MOUTH_COAST_BREAK_WEIGHT = 0.4;

/**
 * ROUND 11 (the lead's ruling 3): the place's display curve as a renderer tone-mapping function
 * (`renderer.library.addToneMapping(fn, THREE.CustomToneMapping)`), the GPU twin of `mouthDisplayCurve`: per channel
 * y = (e L x)^g, D = y / (1 + y) (x the renderer's exposure). The curve's two numbers are constants of the function:
 * with uniforms in it, the output pass built once and failed WGSL validation on its next build (struct member
 * nodeUniform0 not found), drawing black; a switch builds a new function (oceanExtras/mouth.ts).
 */
export function mouthDisplayCurveNode(c: { exposure: number; gamma: number }): { fn: TslNode } {
  const fn = Fn(([color, exposure]: [TslNode, TslNode]) => {
    const y = pow(max(color.mul(exposure).mul(c.exposure), vec3(0, 0, 0)), vec3(c.gamma, c.gamma, c.gamma));
    return y.div(y.add(1));
  });
  return { fn };
}

/**
 * The surface's unresolved slope variance under the FFT's finest wave, for the
 * open sea (oceanSurface.ts, `varAcc`'s start: 0.009). Copied: that module
 * imports this one. The near field's fine chop replaces it there.
 */
export const OCEAN_UNRESOLVED_BASE_VAR = 0.009;

/** A TSL node expression (see `oceanSurface.ts` for why this is `any`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

export interface OceanRiverSample {
  readonly level: TslNode;
  readonly depth: TslNode;
  readonly velocity: TslNode;
  readonly plume: TslNode;
  readonly handover: TslNode;
  readonly column: TslNode;
  /**
   * ROUND 2, THE RIVER'S OWN SURFACE: the wind-locked band's local shares of
   * height and of slope (`localBandShares`, packed on the CPU at each cell's
   * fetch over the water); 1 off the near field (the sea's own wind sea).
   */
  readonly rippleH: TslNode;
  readonly rippleS: TslNode;
  /** The near field's hand-over (0 at its sea edge, 1 inside): the weight of the local wind sea. */
  readonly rippleW: TslNode;
  /**
   * ROUND 3, THE BORE'S LEAN: each cascade's kappa (1/m, vec4) at the sea
   * depth here (`boreLeanTable`, Ruessink et al. 2012's asymmetry); the
   * surface steepens each forced band's front by it.
   */
  readonly lean: TslNode;
  /**
   * ROUND 5, THE SEA'S OWN WATER UNDER THE PLUME (vec4): x the shelf's
   * wave-stirred sand as a column of river-water scattering (m), y (ROUND 11) the
   * depth of sea water that column hangs in, h (m; the dilution D = h / H_eq is
   * formed per pixel, `waterLeaving`; rounds 5 to 10 carried D itself),
   * z the river water's share at the surface, w the river film's share (the
   * slick: \`filmSlick\`). Round 5 to 7: w = z (the share). ROUND 8: the film
   * is whole where z is at least PLUME_FRONT_SHARE and 0 past it
   * (\`riverFilmAt\`), so the slick/rough boundary is the front.
   * Absent: round 4's reader (the stirred sand counted in \`column\`).
   */
  readonly sea?: TslNode;
  /**
   * ROUND 9 (law 1, \`youngSeaOf\`): the young sea's slope share here: the near field's pack (C.w: the young sea
   * where the current blocks the open band or a bank shelters the water, at the cell's own fetch, held by its
   * depth), the plume's block share past it (\`youngBlockedShare\` at the open band's r), times the film's root
   * (\`youngFilmTake\`). Absent: no young sea (round 8's reader).
   */
  readonly young?: TslNode;
  /** ROUND 9 (law 1): the open band's slope share by the current past the near field (\`currentShare\` at the slope's r). */
  readonly openCur?: TslNode;
  /**
   * ROUND 9 (law 2, \`phaseWarpMap\`): each forced band's phase warp W, m along its heading (vec4, one band a
   * channel; 0 for a band not forced), and its local wave number over the deep one, k / k0 (Hedges 1976 on the
   * floor's depth plus the march's Hrms; 1 for a band not forced). Absent: no warp.
   */
  readonly warp?: TslNode;
  readonly crestJ?: TslNode;
}

/**
 * ROUND 9 (law 1): THE YOUNG SEA THE SURFACE DRAWS on the river (\`youngSeaOf\`): a second FFT of one cascade
 * (YOUNG_SEA_N) at the wind over the water and the near field's fetch, its normal mip (oceanNormalMip.ts, the same
 * chain and atlas as the sea's), read with the river's flow map (the flow carries it; its own phase runs in the FFT).
 */
export interface OceanRiverYoung {
  readonly mip: OceanNormalMip;
  readonly patchM: number;
  readonly texelM: number;
  /**
   * The flow map's period, s. ROUND 11 (law 2): the young sea's memory of the current's strain (`youngStrainMemoryS`);
   * rounds 9 and 10: the period of the longest wave the young spectrum holds (twice its peak's wavelength).
   */
  readonly periodS: number;
  /** That wave's length, m (the flow map's two reads' correlation length is this over 2 pi). */
  readonly longM: number;
  /** The band's slope variance (deep water, the law's). */
  readonly slopeVar: number;
  /**
   * ROUND 12 (gap 4): the young sea's second octave (`youngFineOf`): its normal mip, patch, cell and longest wave, m
   * (the main patch then holds the waves over that). Absent: rounds 10 and 11's one patch.
   */
  readonly fine?: { readonly mip: OceanNormalMip; readonly patchM: number; readonly texelM: number; readonly longM: number };
}

/**
 * ROUND 4, THE FINE CHOP AS DRAWN ROUGHNESS (`fineChopPatch`, oceanMouthMath.ts):
 * the 2 cm to 10.2 cm waves of the wind sea on one periodic patch, RGBA =
 * (sx, sz, sx^2, sz^2), with a mip chain the GPU builds by averaging (each
 * level's texel holds the mean slope and the mean squared slope under it:
 * LEAN mapping, Olano and Baker 2010). The surface reads it on the near field
 * only (the local sea's weight), at the level of the pixel's footprint, and
 * draws the mean slope; the variance the footprint hides joins the
 * unresolved roughness, with the spectrum's own remainder under 2 cm, in
 * place of the open sea's constant (`baseVar`).
 */
export interface OceanRiverFine {
  readonly texture: THREE.Texture;
  /** The patch's side and texel, m; its levels under level 0. */
  readonly patchM: number;
  readonly texelM: number;
  readonly levels: number;
  /** The drawn waves' own drift along their heading (their slope-weighted phase speed), world XZ, m/s. */
  readonly driftX: number;
  readonly driftZ: number;
  /** The period over which the pattern renews (the longest drawn wave's), s. */
  readonly periodS: number;
  /** The drawn slope variance; the spectrum's remainder under 2 cm; the surface's unresolved constant it replaces. */
  readonly drawnVar: number;
  readonly subVar: number;
  readonly baseVar: number;
}

/** What the sea's one surface reads of a river (`OceanSurface.setRiver`). */
export interface OceanRiverReader {
  /** One per cascade, in the surface's order. */
  readonly bands: readonly MouthBand[];
  sample(xz: TslNode): OceanRiverSample;
  /** Minus the level's gradient at a world XZ (vec2: -d/dx, -d/dz, as the surface sums its band slopes): the river's own slope. */
  slope(xz: TslNode): TslNode;
  /** The turbid water's diffuse attenuation, 1/m, per RGB channel (vec3). */
  readonly kd: TslNode;
  /** The river bed's Manning roughness (the solver's), for the bed shear's surface roughness (round 2). */
  readonly manningN: number;
  /** The turbid water's own upwelling radiance under a sun of height `sunY` (vec3). */
  turbidRadiance(sunY: TslNode, overcast: TslNode): TslNode;
  /**
   * ROUND 5, THE TWO WATERS (\`twoWatersCpu\`, oceanMouthMath.ts): the light the
   * water sends up over a body \`body\` (vec3, the sea's own body as the surface
   * shades it): the river's layer (its column, m) over the sea's own water
   * with its stirred sand (the sample's \`sea\`, passed from the vertex).
   * Absent: round 4's single turbid water.
   */
  waterLeaving?(body: TslNode, sunY: TslNode, overcast: TslNode, riverColumn: TslNode, sea: TslNode): TslNode;
  /**
   * Round 5: the river's film (\`filmSlick\`): what the slick takes of the short
   * waves where the film holds (the sample's \`sea.w\`). Absent: no film.
   */
  readonly slick?: FilmSlick;
  /** Round 4: the fine chop the surface draws on the near field (absent: round 3's surface, node for node). */
  readonly fine?: OceanRiverFine;
  /** Round 9: the young sea (absent: round 8's surface, node for node). */
  readonly young?: OceanRiverYoung;
}

export interface OceanMouthState {
  readonly step: number;
  readonly timeS: number;
  readonly ledger: MouthLedger;
  readonly stats: { steps: number; ms: number; courant: number; volumeM3: number; riverWaterM3: number };
}

export interface OceanMouth {
  readonly reader: OceanRiverReader;
  /** The mouth's foam into the one foam field: the near field's bores and the plume front. */
  readonly foamSource: OceanFoamSource;
  /**
   * Round 5 (GG-394): the near field's sand at a world XZ (TSL, the vertex or
   * the fragment): the grid's weight there (1 inside, 0 off it), the skin's
   * saturation, the seconds since the water left / 60, the water's depth (m)
   * and its bore foam: the beach's look draws its wet band on the mouth's
   * banks from it (\`OceanBeachOptions.stripSoil\`).
   */
  stripSoil(xz: TslNode): { w: TslNode; a: TslNode; b: TslNode };
  update(simTime: number, pinned: boolean, askWorker?: boolean): void;
  /**
   * ROUND 9 (law 1): step the young sea's FFT to the sea's time (one \`renderer.compute\` of its dispatches; a
   * pinned clock steps it once). A pure function of (seed, time), as the sea's.
   */
  stepYoung(renderer: THREE.WebGPURenderer, simTime: number): void;
  dispose(): void;
  readonly probe: Record<string, unknown>;
}

function halfTexture(data: Uint16Array, w: number, h: number, format: THREE.PixelFormat = THREE.RGBAFormat): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, format, THREE.HalfFloatType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

/**
 * ROUND 12 (gap 2; the lead's ruling 2): THE DRAWN SEA RUNS THE PLACE'S DAY. The FFT's forced bands (the bands the
 * near fields carry, `forcingCascades`) take the day's share of their energy (`MouthDesign.seaEnergy`): their initial
 * spectrum h0 times sqrt(energy), so the drawn sea is the same modes and phases at the day's height, as the near
 * fields' sea edges are forced (`daySeaCascades` on the CPU). The wind-locked band (the ripple) is the wind's and
 * keeps its energy. Returns the undo (the spectrum as it was). Energy 1: nothing changes.
 * Kept as the sea state's: the surface's and the foam field's height scales (`significantWaveHeightM`, fixed when the
 * field is built), which normalize the crests' look by the mean sea's height.
 */
export function applyDaySea(field: OceanField, energy: number): () => void {
  if (energy === 1) return () => {};
  const forced = forcingCascades(field.cascades);
  const h0 = field.buffers.h0;
  const arr = h0.array as Float32Array;
  const cells = field.buffers.n * field.buffers.n;
  const before = arr.slice();
  const g = Math.sqrt(energy);
  field.cascades.forEach((c, ci) => {
    if (!forced.includes(c.name)) return;
    const o = ci * cells * 4;
    for (let i = 0; i < cells * 4; i += 1) arr[o + i] *= g;
  });
  h0.needsUpdate = true;
  return () => { arr.set(before); h0.needsUpdate = true; };
}

/** Build the mouth: start its worker, and wait until it has its first state. */
export async function createOceanMouth(o: {
  field: OceanField;
  design: MouthDesign;
  /** The floor's map (the beach's seabed): the coast's depth for the depth laws. */
  map: SeabedMap;
  /** The sea's seed (the FFT's), for the near field's sea edge. */
  seed: number;
  /**
   * The beach's swash grid on the GPU (round 1c; `createOceanBeach` with
   * `seaSlope`): the reader hands it over to the one surface as it hands
   * over the mouth's own grid. Absent: the coast's depth alone past the
   * near field, as in round 1.
   */
  beach?: OceanBeachSwash;
  /** The hand-over length, m (`mouthHandoverLengthM`): the beach grid's ramps. */
  handoverM?: number;
  /** Round 6: false mounts the reader without round 5's film (the control, `&mouthfilm=0`). */
  film?: boolean;
  /**
   * ROUND 12 (gap 2): the sea the near field's sea edge is forced with (the place's day, `daySeaCascades` at the
   * design's `seaEnergy`). Absent: the field's own cascades.
   */
  cascades?: readonly CascadeParams[];
}): Promise<OceanMouth> {
  const { field, design: d } = o;
  const g = d.grid;
  const fr = d.frame;
  const map = o.map;
  /* ROUND 4 / 6 / 8: THE COAST'S MARCH over the floor (the stirred sand, the breaking shares, the march's Hrms; see
   * the coast texture below). ROUND 9 (law 2): THE PHASE WARP over it (`phaseWarpMap`). ROUND 10 (law 1): both are
   * built before the near field starts, because the near field's sea edge, out past the swash bar, is forced at the
   * warp's places there (`createMouthSim`'s `edgeWarpM`). The warp's anchor is the BEACH's sea edge (the line
   * where the beach's grid is forced with the modes at their true place); with no beach grid, the mouth's own. */
  const stirred = coastStirredColumns(d, map);
  const warpAnchorS = o.beach ? o.beach.grid.s0 : g.s0;
  // ROUND 11 (law 1): with the grid's sea edge seaward of the anchor (the swash bar), the mouth's box of the warp:
  // the edge's warp from the coast at its sides, the first arrival landward of it (round the bare crest).
  const warpBox = g.s0 < warpAnchorS - 1e-6 ? { s0: g.s0, a0: g.a0, a1: g.a0 + g.na * g.da } : undefined;
  const warp = phaseWarpMap({ map, hrmsM: stirred.hrmsM, frame: fr, anchorS: warpAnchorS, bands: d.bands, patchM: field.cascades.map((c) => c.patchM), ...(warpBox ? { box: warpBox } : {}) });
  const edgeWarpM: (Float64Array | null)[] = d.bands.map((b, bi) => {
    if (!b.forced || bi > 3 || Math.abs(g.s0 - warpAnchorS) < 1e-6) return null;
    const out = new Float64Array(g.na);
    for (let j = 0; j < g.na; j += 1) {
      const [x, z] = beachToWorld(fr, g.s0, g.a0 + (j + 0.5) * g.da);
      // Bilinear on the map's texel centers, as the GPU's filter reads the warp texture.
      const u = Math.min(Math.max((x - map.originX) / map.texelM, 0), map.res - 1.001);
      const v = Math.min(Math.max((z - map.originZ) / map.texelM, 0), map.res - 1.001);
      const i0 = Math.floor(u);
      const j0 = Math.floor(v);
      const fu = u - i0;
      const fv = v - j0;
      const at = (i: number, jj: number) => warp.data[(jj * map.res + i) * 4 + bi];
      out[j] = (at(i0, j0) * (1 - fu) + at(i0 + 1, j0) * fu) * (1 - fv) + (at(i0, j0 + 1) * (1 - fu) + at(i0 + 1, j0 + 1) * fu) * fv;
    }
    return out;
  });

  /* --- the worker ------------------------------------------------------ */
  const worker = new Worker(new URL('./oceanMouthWorker.ts', import.meta.url), { type: 'module' });
  let workerError: string | null = null;
  const ready = await new Promise<{ cells: number; inflowCells: number; spinUpMs: number; localFetchM: number }>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'ready') resolve(m);
      else if (m.type === 'error') reject(new Error(`[ocean] The mouth worker failed to start.\n\n${m.message}`));
    };
    worker.onerror = (e) => reject(new Error(`[ocean] The mouth worker failed to load: ${e.message}`));
    worker.postMessage({ type: 'init', design: d, cascades: o.cascades ?? field.cascades, n: field.buffers.n, seed: o.seed, edgeWarpM });
  });

  /* --- the textures ---------------------------------------------------- */
  const nc = g.ns * g.na;
  const gridA = halfTexture(new Uint16Array(nc * 4), g.ns, g.na);
  const gridB = halfTexture(new Uint16Array(nc * 4), g.ns, g.na);
  // The river's own slope, packed on the CPU over wet cells (round 1c; `packMouthState`, C).
  // Round 2: RGBA, the slope and the wind-locked band's local shares (`packMouthState`, C).
  const gridC = halfTexture(new Uint16Array(nc * 4), g.ns, g.na);
  // Round 5 (GG-394): the banks' sand (\`MouthPack.d\`): skin saturation, minutes since the water left, depth, foam.
  const gridD = halfTexture(new Uint16Array(nc * 4), g.ns, g.na);
  const dom = jetDomain(d);
  const jet = buildJetPack(d, dom);
  const jetA = halfTexture(jet.a, dom.ns, dom.na);
  const jetB = halfTexture(jet.b, dom.ns, dom.na);
  /* ROUND 4, THE SEA BEYOND THE BAR IS TURBID TOO (the lead's point 2b): the
   * coast's texture carries, beside the floor's depth (R), the wave-stirred
   * sand's column as river water (G, m: `coastStirredColumns`, Battjes and
   * Janssen's waves over the map's floor, van Rijn's reference concentration
   * and breaking mixing, the sand's scattering against the river silt's). The
   * reader adds it to the river's own column, so the one surface's turbid
   * body takes the shelf's own load where no river water reaches. */
  // ROUND 6 (law 2): B carries the march's share of breaking waves over the floor (Battjes and Janssen's Q_b,
  // the same march as the stirred sand, \`coastStirredColumns\`): the coast's breakers are taken from it.
  // ROUND 8 (law 2): A carries the depth-limited share (\`depthLimitedBreakShare\`: the march's Hrms over
  // McCowan's gamma h): where the surf is saturated every crest breaks, whatever its group.
  const depthHalf = new Uint16Array(map.res * map.res * 4);
  for (let i = 0; i < map.res * map.res; i += 1) {
    depthHalf[i * 4] = THREE.DataUtils.toHalfFloat(map.data[i * 4]);
    depthHalf[i * 4 + 1] = THREE.DataUtils.toHalfFloat(stirred.columnM[i]);
    depthHalf[i * 4 + 2] = THREE.DataUtils.toHalfFloat(stirred.qbM[i]);
    depthHalf[i * 4 + 3] = THREE.DataUtils.toHalfFloat(depthLimitedBreakShare(stirred.hrmsM[i], map.data[i * 4]));
  }
  const coastTex = halfTexture(depthHalf, map.res, map.res, THREE.RGBAFormat);
  // The FFT sea's own rms height (deep water, as the march starts it): the raw crests' Rayleigh scale.
  const hrmsDeepM = d.hsM / Math.SQRT2;
  // Round 7 (law 1): the roller law's constants (the deep k at the sea's Tz, Battjes and Stive's index).
  const rollerC = rollerCoastOf(d);
  const rollerK0 = rollerC.k0;
  const rollerGamma = rollerC.gamma;
  // Round 3: the bore's lean by depth (one row, cascade i in channel i).
  const leanF = boreLeanTable(d.bands);
  const leanHalf = new Uint16Array(leanF.length);
  for (let i = 0; i < leanF.length; i += 1) leanHalf[i] = THREE.DataUtils.toHalfFloat(leanF[i]);
  const leanTex = halfTexture(leanHalf, LEAN_TABLE_N, 1);

  /* ROUND 9, LAW 1: THE LOCAL SEA IS ITS OWN YOUNG WIND SEA (\`youngSeaOf\`). A second FFT of one cascade at the
   * wind over the water and the near field's fetch (the worker's median): its JONSWAP and Donelan's spread about
   * its own peak (beta 2.28: long crests), not the open band's tail. The worker computes the same record from the
   * same inputs for its pack. \`&mouthyoung=0\`-free: the law, no switch. */
  const locIdx = d.bands.findIndex((b) => b.local);
  const youngLaw: YoungSea | null = locIdx < 0 ? null : youngSeaOf(d, field.cascades[locIdx], ready.localFetchM);
  if (youngLaw !== null) youngPlumeExits(d, youngLaw);
  /* ROUND 10, LAW 2: THE YOUNG SEA DOES NOT TILE (`createOceanYoungFft`, oceanMouthYoung.ts): its own slope FFT on
   * YOUNG_SEA_N = 1024 cells at round 9's 5.08 cm cell, a 52 m patch (round 9: the open pipeline at 256 cells, 13 m,
   * which repeated every 13 m inside the view). The seed is round 9's (the spectrum's cascade seed is the sea's
   * seed with the young sea's own mark, cascade 0). */
  /* ROUND 12 (gap 4): THE SECOND OCTAVE (`youngFineOf`): the main patch keeps the waves down to four of its cells
   * (20.3 cm), the second octave carries 10.2 to 20.3 cm on a 16.5 m patch of 1024 cells (1.6 cm). Both FFTs step in
   * the one `renderer.compute` call (their dispatches in one list). The main patch's seed is round 10's. */
  const youngSplit = youngLaw === null ? null : youngFineOf(youngLaw);
  const youngGpu = youngLaw === null || youngSplit === null ? null : (() => {
    const fft = createOceanYoungFft(youngSplit.main, YOUNG_SEA_N, (o.seed ^ 0x9035e) >>> 0);
    const fine = createOceanYoungFft(youngSplit.fine, YOUNG_SEA_N, (o.seed ^ 0x9035f) >>> 0);
    return { fft, fine, mip: fft.mip, nodes: [...fft.nodes, ...fine.nodes] as unknown as Parameters<THREE.WebGPURenderer['compute']>[0] };
  })();
  let youngT = Number.NaN;
  /* ROUND 9, LAW 2: THE CREST MOVES AT THE SHALLOW SPEED (\`phaseWarpMap\`): each forced band's phase warp over the
   * coast's floor, anchored on the near fields' one sea edge; the local band's channel carries the march's Hrms (the
   * Hedges height of the bands' k / k0 on the GPU). Past the map the warp goes back to 0 over \`taperM\`. */
  const warpHalf = new Uint16Array(map.res * map.res * 4);
  for (let i = 0; i < map.res * map.res; i += 1) {
    for (let c = 0; c < 4; c += 1) warpHalf[i * 4 + c] = THREE.DataUtils.toHalfFloat(c === locIdx ? stirred.hrmsM[i] : warp.data[i * 4 + c]);
  }
  const warpTex = halfTexture(warpHalf, map.res, map.res, THREE.RGBAFormat);

  /* --- the reader ------------------------------------------------------ */
  const sAxis = vec2(float(fr.sX), float(fr.sZ));
  const aAxis = vec2(float(fr.aX), float(fr.aZ));
  const origin = vec2(float(fr.originX), float(fr.originZ));
  const gs0 = g.s0;
  const ga0 = g.a0;
  const gLs = g.ns * g.ds;
  const gLa = g.na * g.da;
  // The plume's texture is laid in the jet's own coordinates (round 2, `jetDomain`).
  const jLogL = Math.log(1 + dom.reachM / dom.x1M);
  const mapLen = map.res * map.texelM;
  const mapX0 = map.originX - map.texelM / 2;
  const mapZ0 = map.originZ - map.texelM / 2;
  /* NO \`select\` IN THE READER (mouth round 1). three r172's \`select\` wraps its
   * condition and both branches in a new node cache (ConditionalNode.setup,
   * \`.cache()\`), so a shared node under it is set up and generated again in
   * each one, and selects nested through the reader (inside -> depth -> the
   * group speed -> the current's share, per band) multiplied the surface's
   * shader: the page took 840 s to build it, and once never finished. The
   * reader is plain arithmetic: \`inside\` is a product of steps (1 inside the
   * unit square, else 0) and every choice is a mix by it. */
  const inside = (u: TslNode): TslNode => step(float(0), u.x).mul(step(u.x, float(1))).mul(step(float(0), u.y)).mul(step(u.y, float(1)));
  const frameOf = (xz: TslNode): { s: TslNode; a: TslNode } => {
    const rel = vec2(xz.x, xz.y).sub(origin);
    return { s: rel.dot(sAxis), a: rel.dot(aAxis) };
  };
  const blendRip = mouthHandoverLengthM(field.cascades);
  const gridS = (xz: TslNode): TslNode => frameOf(xz).s;
  const gridUv = (xz: TslNode): TslNode => {
    const f = frameOf(xz);
    return vec2(f.s.sub(gs0).div(gLs), f.a.sub(ga0).div(gLa));
  };
  /* THE PLUME'S UV IN THE JET'S OWN COORDINATES (round 2; `jetUvOf`, the CPU
   * twin): along, u = ln(1 + x / x1) / ln(1 + L / x1); across,
   * v = 1/2 + y / (2 Y(x)), Y = yHalf0 + yGrow x. A point landward of the
   * mouth line maps to u < 0 (the log's argument is held over 0), off the
   * domain, where the reader's \`inside\` reads 0. */
  // One read of the near field's C texture per point node: sample() and slope() share it.
  const gridCMemo = new WeakMap<object, TslNode>();
  const gridCAt = (xz: TslNode, u: TslNode): TslNode => {
    const hit = gridCMemo.get(xz);
    if (hit) return hit;
    const r = texture(gridC, u).level(float(0));
    gridCMemo.set(xz, r);
    return r;
  };
  /* ROUND 5, THE FRONT'S EDDIES (\`frontEddyTable\`, \`frontEddyShiftM\` is the CPU
   * twin; the lead's point 2): the shear layer at the jet's edge rolls up
   * (Kelvin-Helmholtz, Michalke 1964) and its eddies ride at uc / 2 and pair
   * downstream (Winant and Browand 1974), so the river water's front is swept
   * to and fro across the jet by about the layer's half-thickness. The shift
   * moves the point's across coordinate before the plume's textures are read,
   * so the share, the column, the flow and the front's foam line all follow
   * the one displaced front. The table (tau, log2 f, delta) is read by hand
   * between two texels (a float table, not filtered). Off the jet (x <= 0)
   * delta is 0 and nothing moves. */
  const kh = frontEddyTable(d, dom, o.seed);
  const khTex = new THREE.DataTexture(kh.data, KH_TABLE_N, 1, THREE.RGBAFormat, THREE.FloatType);
  khTex.minFilter = THREE.NearestFilter;
  khTex.magFilter = THREE.NearestFilter;
  khTex.wrapS = THREE.ClampToEdgeWrapping;
  khTex.wrapT = THREE.ClampToEdgeWrapping;
  khTex.generateMipmaps = false;
  khTex.flipY = false;
  khTex.needsUpdate = true;
  const log2F0 = Math.log2(kh.f0Hz);
  /** The shift for a point at the jet's u, across y0 (\`frontEddyShiftM\`): each side's own over the core, the sinuous mode past it. */
  const eddyShift = (u: TslNode, y0: TslNode): TslNode => {
    const tu = clamp(u, float(0), float(1)).mul(KH_TABLE_N - 1);
    const i0 = floor(tu);
    const fr = tu.sub(i0);
    const t0 = texture(khTex, vec2(i0.add(0.5).div(KH_TABLE_N), float(0.5))).level(float(0));
    const t1 = texture(khTex, vec2(min(i0.add(1.5), float(KH_TABLE_N - 0.5)).div(KH_TABLE_N), float(0.5))).level(float(0));
    const g = mix(t0, t1, fr);
    const age = (field.kernels.uTime as TslNode).sub(g.x);
    let s1: TslNode = float(0);
    let s2: TslNode = float(0);
    let env2: TslNode = float(0);
    for (let m = 0; m < KH_MODES; m += 1) {
      const z = g.y.sub(log2F0 - m).div(0.5);
      const env = exp(z.mul(z).mul(-0.5));
      const a = age.mul((2 * Math.PI * kh.f0Hz) / 2 ** m).add(kh.psi[m]);
      const q = kh.psi[KH_MODES + m];
      s1 = s1.add(env.mul(sin(a)).mul(Math.cos(q)));
      s2 = s2.add(env.mul(cos(a)).mul(Math.sin(q)));
      env2 = env2.add(env.mul(env));
    }
    const amp = g.z.div(sqrt(max(env2, float(1e-6))));
    const side = step(float(0), y0).mul(2).sub(1);
    const etaSide = amp.mul(s1.add(side.mul(s2)));
    const etaPlus = amp.mul(s1.add(s2));
    const ind = side.mul(etaSide).mul(smoothstep(float(0), max(g.w, float(1e-3)), abs(y0)));
    const blend = clamp(g.w.div(max(g.z, float(1e-3))), float(0), float(1));
    return mix(etaPlus, ind, blend);
  };
  const jetUv = (xz: TslNode): TslNode => {
    const f = frameOf(xz);
    const x = float(dom.sMouth).sub(f.s);
    const y0 = f.a.sub(dom.aMouth);
    const u = log(max(x.div(dom.x1M).add(1), float(1e-6))).div(jLogL);
    // The front's shift (off the jet, x <= 0, none).
    const y = y0.sub(eddyShift(u, y0).mul(step(float(0), x)));
    const v = y.div(max(x, float(0)).mul(dom.yGrow).add(dom.yHalf0M).mul(2)).add(0.5);
    return vec2(u, v);
  };
  /* THE BEACH'S SWASH GRID HANDS OVER TO THE ONE SURFACE (round 1c, the
   * lead's seams 1 and 2). In round 1 the sea's surface drew the FFT held by
   * the coast's depth over the swash grid, and the beach's sheet stood over
   * it or under it by turns: the sheet showed as dark blocks with hard ends
   * at the channel's banks and a hard line at the grid's sea edge, where the
   * held sea cut through it. Now the beach's grid is a near field like the
   * mouth's: from its sea edge the forced bands hand over to the grid's own
   * water over one hand-over length (the same law: half the shortest forced
   * wave), and the hand-over falls to 0 over that length at the grid's ends
   * and at the edges of the mouth's strip (the mouth's grid owns the strip;
   * its own hand-over ramps from those edges inward). The surface draws the
   * grid's water SEAWARD OF THE STILL-WATER LINE (wet, bed under the mean
   * sea level); landward it stays under the sand (2 cm under a bed under the
   * mean sea level, at it on land) and the beach's sheet draws the swash on
   * the face, as the beach's own rule says ("the sea wins where the two
   * waters meet"). */
  const bch = o.beach ?? null;
  const blendB = o.handoverM ?? 1;
  const gB = bch === null ? null : bch.grid;
  const smooth = (x: TslNode): TslNode => smoothstep(float(0), float(1), x);
  const dSmooth = (x: TslNode): TslNode => { const c = clamp(x, float(0), float(1)); return c.mul(float(1).sub(c)).mul(6 / blendB); };
  type BeachAt = { w: TslNode; dwS: TslNode; dwA: TslNode; surf: TslNode; seaDepth: TslNode; vel: TslNode; uv: TslNode; foam: TslNode; wetSea: TslNode };
  // One build per point node: sample() and slope() share the reads (one sample a stage).
  const beachMemo = new WeakMap<object, BeachAt>();
  const beachAt = (xz: TslNode): BeachAt | null => {
    if (bch === null || gB === null) return null;
    const hit = beachMemo.get(xz);
    if (hit) return hit;
    const fB = frameOf(xz);
    const uv = vec2(fB.s.sub(gB.s0).div(gB.ns * gB.ds), fB.a.sub(gB.a0).div(gB.na * gB.da));
    const inB = inside(uv);
    const aB1 = gB.a0 + gB.na * gB.da;
    const aM0 = g.a0;
    const aM1 = g.a0 + g.na * g.da;
    const xs = fB.s.sub(gB.s0).div(blendB);
    const xa0 = fB.a.sub(gB.a0).div(blendB);
    const xa1 = float(aB1).sub(fB.a).div(blendB);
    // Round 2: the beach's ramps are the mouth's lateral ramps turned over
    // (1 - smooth((a - aM0) / L) = smooth((aM0 + L - a) / L)), over the band
    // where both grids hold the water (`mouthSwashWalls`' inset): the two
    // weights sum to 1 there. Round 1c's ramps met at the strip's edge with
    // both at 0.
    const xm0 = float(aM0 + blendB).sub(fB.a).div(blendB);
    const xm1 = fB.a.sub(aM1 - blendB).div(blendB);
    const ws = smooth(xs);
    const wa = smooth(xa0).mul(smooth(xa1));
    // The two strip ramps have disjoint supports (one each side of the strip): their sum is either.
    const wq = smooth(xm0).add(smooth(xm1));
    const w = ws.mul(wa).mul(wq).mul(inB);
    const dwS = dSmooth(xs).mul(wa).mul(wq).mul(inB);
    const dwa = dSmooth(xa0).mul(smooth(xa1)).sub(smooth(xa0).mul(dSmooth(xa1)));
    const dwq = dSmooth(xm1).sub(dSmooth(xm0));
    const dwA = ws.mul(dwa.mul(wq).add(wa.mul(dwq))).mul(inB);
    const sa = texture(bch.a, uv).level(float(0));
    const bed = texture(bch.c, uv).level(float(0)).x;
    const h = max(sa.x, float(0));
    const wetSea = step(float(1e-3), h).mul(step(bed, float(0)));
    const surf = mix(min(bed.sub(0.02), float(0)), bed.add(h), wetSea);
    const seaDepth = wetSea.mul(min(max(bed.negate(), float(0)), h));
    const vel = sAxis.mul(sa.y).add(aAxis.mul(sa.z)).mul(wetSea);
    // The swash's bore foam (the beach's Kennedy rule, `BeachPack.a.w`), for the one foam field (round 2).
    const out = { w, dwS, dwA, surf, seaDepth, vel, uv, foam: sa.w, wetSea };
    beachMemo.set(xz, out);
    return out;
  };
  const dot2 = (v: TslNode, x: number, z: number): TslNode => v.x.mul(x).add(v.y.mul(z));
  const sample = (xz: TslNode): OceanRiverSample => {
    const ug = gridUv(xz);
    const uj = jetUv(xz);
    const inG = inside(ug);
    const inJ = inside(uj);
    const ga = texture(gridA, ug).level(float(0));
    const gb = texture(gridB, ug).level(float(0));
    const ja = texture(jetA, uj).level(float(0));
    const jb = texture(jetB, uj).level(float(0));
    const um = vec2(xz.x.sub(mapX0).div(mapLen), xz.y.sub(mapZ0).div(mapLen));
    const coastT = texture(coastTex, um).level(float(0));
    const coastD = max(coastT.x, float(0));
    // Round 4: the shelf's wave-stirred sand, as a column of river water (0 off the map's wet floor).
    const coastS = max(coastT.y, float(0)).mul(inside(um));
    /* Round 5: the sea water it hangs in, D = h / H_eq (m per m of the column),
     * from the two filtered channels: a texel-wise D filtered across the
     * shoreline (a wet texel's 30 against a dry one's limit) drew a black line
     * of sand in thousands of meters of water at every waterline (mouth5/eye/z-a1). */
    const w = gb.y.mul(inG);
    /* ROUND 11 (round 10's open defect, the black dash; the day's navy stripes, mouth11/shots/f2-mouth-down.png): the
     * coast's march (`coastStirredColumns`) runs each map column from the sea up to its first dry texel, so where the
     * swash bar's crest (or a spit) stands dry, the columns behind it stop there while their neighbors run on up the
     * river through the flank channels: the stirred sand drew a box of other water in the river, cut sharp at the
     * columns where the march stopped (a = 40 +- 14.4 m, s over -8 m: the dry crest's span), with a black line where
     * the filtered column fell to nothing beside a whole one. The stirred sand is the coast surf's water: on the near
     * field the grid's own water carries the sediment (the river's column), so the coast's share hands over with the
     * forced bands (1 - w, the grid's hand-over). The dilution keeps the column's own ratio. Off the grid: round 10. */
    /* ROUND 13 (law 3; GG-413): THE SURF ZONE'S TURBIDITY ON THE NEAR FIELD. On the deflected planform the grid runs
     * the spit's whole reach and holds the platform's seaward face and its surf: with the hand-over by w alone the
     * breakers' stirred sand (van Rijn's reference concentration at the bed's wave stress, mixed by the breakers;
     * `stirredSandLoad`) left the whole surf zone along the spit, and the surf drew as the clear sea. The sand is the
     * SEA water's: the breakers stir it where they break, in the grid or past it. It now hands over only on the river's
     * water (w times the grid's river share): round 11's reason (the coast's march stopping at a dry crest drew a box
     * of other water in the RIVER) holds on the river water, which keeps its own column; the sea water keeps the
     * coast's sand. */
    const coastKeep = max(float(1).sub(w.mul(gb.x)), float(0));
    const coastSea = coastS.mul(coastKeep);
    const jetVel = vec2(ja.y, ja.z).mul(inJ);
    // The wind-locked band's local shares: the near field's inside it, the sea's own (1) past it.
    const gc = gridCAt(xz, ug);
    const rippleH = gc.z;
    const rippleS = gc.w;
    // The local wind sea's weight: in from the grid's SEA edge over the hand-over length only. At the side
    // edges the film law in the pack already holds it, and the forced bands' side ramps would take the
    // ripple off the swash water there and draw it as a mirror (round 2, mouth2/shots/a4-mouth-bank.png).
    const ripW = inG.mul(smooth(gridS(xz).sub(gs0).div(blendRip)));
    const bAt = beachAt(xz);
    const level0 = ga.x.mul(inG);
    // The near field's own sea depth inside it; the coast's floor past it.
    const depth0 = mix(coastD, ga.y, inG);
    const vel0 = mix(jetVel, vec2(ga.z, ga.w), w);
    const depthS = bAt === null ? depth0 : mix(depth0, bAt.seaDepth, bAt.w);
    const velS = bAt === null ? vel0 : mix(vel0, bAt.vel, bAt.w);
    const shareS = mix(jb.x.mul(inJ), gb.x, w);
    const filmS = step(float(PLUME_FRONT_SHARE), shareS);
    /* ROUND 9 (law 1): the open band's r at the slope's carrier (\`openBandBlockR\`), its current share
     * (\`currentShare\`) and the young sea's share past the near field (\`youngBlockedShare\`). */
    let young: TslNode | undefined;
    let openCur: TslNode | undefined;
    if (youngLaw !== null) {
      const rO = dot2(velS, youngLaw.openDirX, youngLaw.openDirZ).negate().div(youngLaw.openCgS);
      const grow = float(1).div(sqrt(max(float(1).sub(rO), float(1e-4))));
      openCur = float(1).sub(step(float(1), rO)).mul(grow).mul(float(1).sub(smoothstep(float(BLOCK_BREAK_R), float(1), rO)));
      const yPlume = smoothstep(float(BLOCK_BREAK_R), float(1), rO);
      const take = mix(float(youngTakeFar), float(youngTakeNear), ripW);
      young = mix(yPlume, gc.w, ripW).mul(sqrt(max(float(1).sub(filmS.mul(take)), float(0))));
    }
    /* ROUND 9 (law 2): the warp and k / k0, each forced band by its own period (Hedges 1976 by Fenton and McKee:
     * k0 / tanh((k0 (h + H))^(3/4))^(2/3)); past the map the warp tapers to 0. */
    const wT = texture(warpTex, um).level(float(0));
    const out1 = max(max(um.x.negate(), um.x.sub(1)), max(um.y.negate(), um.y.sub(1))).mul(mapLen);
    const taper = float(1).sub(smoothstep(float(0), float(Math.max(warp.taperM, 1)), max(out1, float(0))));
    const hEff = max(depthS, float(0)).add(locIdx >= 0 ? max([wT.x, wT.y, wT.z, wT.w][locIdx], float(0)) : float(0));
    const jOf = (bi: number): TslNode => {
      const bb = d.bands[bi];
      if (!bb.forced) return float(1);
      const k0 = (bb.omega * bb.omega) / 9.81;
      const tq = (x: TslNode): TslNode => float(1).sub(float(2).div(exp(x.mul(2)).add(1)));
      return float(1).div(pow(tq(pow(max(hEff, float(0.05)).mul(k0), float(0.75))), float(2 / 3))).mul(step(float(0.02), depthS)).add(float(1).sub(step(float(0.02), depthS)));
    };
    const wOf = (bi: number): TslNode => (bi < d.bands.length && d.bands[bi].forced ? [wT.x, wT.y, wT.z, wT.w][bi].mul(taper) : float(0));
    // The lean's texel centers span (0.5 .. N - 0.5) / N of the depth range.
    const leanU = clamp(depthS.div(LEAN_TABLE_DEPTH_M), float(0.5 / LEAN_TABLE_N), float(1 - 0.5 / LEAN_TABLE_N));
    return {
      lean: texture(leanTex, vec2(leanU, float(0.5))).level(float(0)).mul(step(float(1e-3), depthS)),
      level: bAt === null ? level0 : level0.add(bAt.w.mul(bAt.surf)),
      depth: depthS,
      velocity: velS,
      plume: mix(jb.x.mul(inJ), gb.x, w),
      handover: bAt === null ? w : w.add(bAt.w),
      // Round 5: the river's own column only; the stirred sand is the sea's own water (\`sea\`), not river water.
      column: mix(jb.z.mul(inJ), gb.z, w),
      /* ROUND 8 (law 1): w is the river's FILM, whole where the surface water is at least half the river's and
       * 0 past it (\`riverFilmAt\`): the slick/rough boundary is the front. Rounds 5 to 7 gave the film the river
       * share, so the slick thinned across the plume's whole shoulder and no edge showed. */
      /* ROUND 11 (round 10's open defect, the black dash; bisect mouth11/b5, the `sea` term): y carried the dilution
       * D = h / H_eq, a ratio. Where the column falls to nothing beside a whole one (the coast march's end at a dry
       * texel, a waterline) the vertex's D is thousands while its neighbor's column is not 0, and the pixel between
       * drew a layer of that D at the neighbor's thickness: optical depth kd H of hundreds, R_s 0, a black line along
       * the march's ends (the dash at the river's waterline; the box's sides at the bare crest). Now y carries the
       * sea water's depth h, which falls with the column, and the fragment forms D = h / H from the two interpolated
       * values: kd H = a_w h + a_p H, bounded. The same numbers where both are smooth. */
      sea: vec4(coastSea, coastD.mul(coastKeep), shareS, filmS),
      rippleH,
      rippleS,
      rippleW: ripW,
      ...(young !== undefined && openCur !== undefined ? { young, openCur } : {}),
      warp: vec4(wOf(0), wOf(1), wOf(2), wOf(3)),
      crestJ: vec4(jOf(0), jOf(1), jOf(2), jOf(3)),
    };
  };
  // The river's own slope, AS THE SURFACE SUMS ITS BANDS' SLOPES:
  // -grad(level) (a normal's x and z over its y; the surface's normal is
  // normalize(sx, 1, sz), oceanSurface.ts). Packed on the CPU over wet cells
  // only (`packMouthState`, C; round 1c), one read. Round 1 took central
  // differences of the level texture here: +grad, so the slope lit inverted
  // (the rocks builder's read, round 1b), and across the swash's wet edge on
  // the banks a film on the sand against a dry cell at the mean sea level
  // gave a slope near 0.9 that drew a navy band (the lead's seam 3).
  const slope = (xz: TslNode): TslNode => {
    const u = gridUv(xz);
    const sm = gridCAt(xz, u).xy.mul(inside(u));
    const bAt = beachAt(xz);
    if (bAt === null || bch === null || bch.e === null) return sm;
    // The beach's drawn level is w surf: -grad = w (-grad surf) - surf grad w,
    // in the frame (s, a), then to world X Z.
    const eB = texture(bch.e, bAt.uv).level(float(0));
    const cS = bAt.w.mul(eB.x).sub(bAt.surf.mul(bAt.dwS));
    const cA = bAt.w.mul(eB.y).sub(bAt.surf.mul(bAt.dwA));
    return sm.add(sAxis.mul(cS)).add(aAxis.mul(cA));
  };
  const op = d.optics;
  const uKd = uniform(new THREE.Vector3(op.kdRGB[0], op.kdRGB[1], op.kdRGB[2]));
  const uRInf = uniform(new THREE.Vector3(op.rInfRGB[0], op.rInfRGB[1], op.rInfRGB[2]));
  // ROUND 5: the sea's own water with the shelf's stirred sand (\`sandSeaIop\`: the river fit's particles, no humus, in sea water).
  const sandIop = sandSeaIop(d.sedimentGM3, op.iop ?? { aP443M2G: SED_ABSORB_443_M2_G, sPNm: SED_ABSORB_SLOPE_NM, aG443M: 0, residualR: 0 });
  const uSandAPart = uniform(new THREE.Vector3(sandIop.aPart[0], sandIop.aPart[1], sandIop.aPart[2]));
  const uSandAWater = uniform(new THREE.Vector3(sandIop.aWater[0], sandIop.aWater[1], sandIop.aWater[2]));
  /** Gordon et al.'s (1975) polynomial on a vec3 X. */
  const gordonV = (x: TslNode): TslNode => x.mul(0.3244).add(x.mul(x).mul(0.1425)).add(x.mul(x).mul(x).mul(0.1308)).add(0.0001);
  // ROUND 3: the wind-locked band's crest stretch at the near field's own fetch (the worker's median).
  // Round 4: and the young sea's peak cut (`localPeakCut`): the band's waves longer than the local peak leave the river.
  const bands = d.bands.map((b) => {
    if (!b.local) return b;
    // ROUND 9 (law 1): with the young sea drawn, the open band is the sea's own wherever it reaches (no stretch, no cut).
    if (youngLaw !== null) return b;
    const cut = localPeakCut(b, ready.localFetchM);
    return { ...b, crestStretch: crestStretchOf(b, ready.localFetchM), ...(cut ? { peakCutM: cut.cutM, peakCutGain: cut.gain } : {}) };
  });
  // ROUND 4: the fine chop's patch at the wind-locked band's wind, its young sea's peak at the near field's fetch.
  const finePatch = mouthFinePatch(d, ready.localFetchM, o.seed);
  let fineTex: THREE.DataTexture | null = null;
  let fine: OceanRiverFine | undefined;
  if (finePatch !== null) {
    const nF = finePatch.n;
    const half = new Uint16Array(nF * nF * 4);
    for (let i = 0; i < half.length; i += 1) half[i] = THREE.DataUtils.toHalfFloat(finePatch.data[i]);
    fineTex = new THREE.DataTexture(half, nF, nF, THREE.RGBAFormat, THREE.HalfFloatType);
    fineTex.wrapS = THREE.RepeatWrapping;
    fineTex.wrapT = THREE.RepeatWrapping;
    fineTex.magFilter = THREE.LinearFilter;
    fineTex.minFilter = THREE.LinearMipmapLinearFilter;
    // The GPU's mips average each channel 2 x 2: the mean slope and the mean squared slope, exactly LEAN's moments.
    fineTex.generateMipmaps = true;
    fineTex.flipY = false;
    fineTex.needsUpdate = true;
    const loc = d.bands.find((b) => b.local)!;
    fine = {
      texture: fineTex,
      patchM: finePatch.patchM,
      texelM: finePatch.patchM / nF,
      levels: Math.log2(nF),
      driftX: loc.dirX * finePatch.driftMS,
      driftZ: loc.dirZ * finePatch.driftMS,
      periodS: finePatch.periodS,
      drawnVar: finePatch.drawnVar,
      subVar: finePatch.subVar,
      baseVar: OCEAN_UNRESOLVED_BASE_VAR,
    };
  }
  /* ROUND 5, THE RIVER'S FILM (\`filmSlick\`): Cox and Munk's slick at the wind
   * over the water (the place's, the clip's chop's), shortest waves first:
   * the fine chop and its remainder on the near field, the unresolved
   * constant past it, then the wind-locked band under 30 cm. */
  const locI = d.bands.findIndex((b) => b.local);
  const film: FilmSlick | null = locI < 0 || o.film === false ? null : filmSlick({
    windMS: d.bands[locI].localWindMS,
    fineVar: finePatch === null ? 0 : finePatch.drawnVar + finePatch.subVar,
    baseVar: OCEAN_UNRESOLVED_BASE_VAR,
    bandLowM: field.cascades[locI].cutoffLowM,
    bandHighM: field.cascades[locI].cutoffHighM,
    // The near field's band ends at the young sea's peak (its cut is half the peak's wavelength).
    ...(() => { const cut = youngLaw !== null ? null : localPeakCut(d.bands[locI], ready.localFetchM); return cut ? { bandHighNearM: 2 * cut.cutM } : {}; })(),
  });
  // ROUND 9: what the film takes of the young sea, on the near field (after the fine chop) and past it (after the open sea's constant).
  const youngTakeNear = film === null || youngLaw === null ? 0 : youngFilmTake(youngLaw, youngFilmRest(youngLaw, finePatch === null ? 0 : finePatch.drawnVar + finePatch.subVar));
  const youngTakeFar = film === null || youngLaw === null ? 0 : youngFilmTake(youngLaw, youngFilmRest(youngLaw, OCEAN_UNRESOLVED_BASE_VAR));
  const youngRead: OceanRiverYoung | undefined = youngLaw === null || youngGpu === null ? undefined : {
    mip: youngGpu.mip,
    patchM: youngLaw.cascade.patchM,
    texelM: youngLaw.cascade.patchM / YOUNG_SEA_N,
    longM: 2 * youngLaw.peakM,
    // Round 11 (law 2): the map's period is the field's strain memory, so the current's shear draws streaks in it.
    periodS: youngStrainMemoryS(youngLaw),
    slopeVar: youngLaw.slopeVar,
    // Round 12 (gap 4): the second octave (`youngFineOf`), read by the same flow map.
    ...(youngSplit !== null ? { fine: { mip: youngGpu.fine.mip, patchM: youngSplit.fine.patchM, texelM: youngSplit.fine.patchM / YOUNG_SEA_N, longM: youngSplit.splitM } } : {}),
  };
  const reader: OceanRiverReader = {
    bands,
    sample,
    slope,
    kd: uKd,
    manningN: d.manningN,
    turbidRadiance(sunY: TslNode, overcast: TslNode): TslNode {
      // R E / pi through the surface (`turbidRadianceCpu`), E the floor's own light.
      // ROUND 6: under the sky's stratus deck the sun's unscattered share and the sky's diffuse gain
      // (`oceanSkyDeckLight`, 1 and 1 with no deck): one sky over the water.
      const dk = oceanSkyDeckLight(overcast);
      const e = max(sunY, float(0)).mul(float(1).sub(overcast)).mul(dk.sunDirect).mul(FLOOR_LIGHT.sunE).add(dk.skyGain.mul(FLOOR_LIGHT.skyE));
      return vec3(uRInf).mul(e.mul(WATER_TO_AIR_RADIANCE / Math.PI));
    },
    waterLeaving(body: TslNode, sunY: TslNode, overcast: TslNode, riverColumn: TslNode, sea: TslNode): TslNode {
      // \`twoWatersCpu\`: L = R_r E' (1 - T_r) + T_r [R_s E' (1 - T_s) + T_s body], E' = E 0.54 / pi.
      // ROUND 6: E under the stratus deck as in \`turbidRadiance\`; the sea's own body light (a color set
      // under the clear sky's light) scales with the light it gets, E over the clear sky's E.
      const dk = oceanSkyDeckLight(overcast);
      const eSunC = max(sunY, float(0)).mul(float(1).sub(overcast)).mul(FLOOR_LIGHT.sunE);
      const eClear = eSunC.add(FLOOR_LIGHT.skyE);
      const eDeck = eSunC.mul(dk.sunDirect).add(dk.skyGain.mul(FLOOR_LIGHT.skyE));
      body = body.mul(eDeck.div(max(eClear, float(1e-4))));
      const e = eDeck.mul(WATER_TO_AIR_RADIANCE / Math.PI);
      const tR = exp(vec3(uKd).mul(max(riverColumn, float(0)).mul(-2)));
      // Round 11: the dilution per pixel from the two interpolated depths (see the reader's `sea`).
      const dil = max(sea.y, float(0)).div(max(sea.x, float(1e-4)));
      const aS = vec3(uSandAWater).mul(dil).add(vec3(uSandAPart));
      const xS = float(sandIop.bb).div(aS.add(float(sandIop.bb)));
      const kdS = sqrt(aS.mul(aS).add(aS.mul(float((0.425 * 0.9 - 0.19) * sandIop.b)))).div(0.9);
      const tS = exp(kdS.mul(max(sea.x, float(0)).mul(-2)));
      const under = gordonV(xS).mul(e).mul(vec3(1).sub(tS)).add(body.mul(tS));
      return vec3(uRInf).mul(e).mul(vec3(1).sub(tR)).add(under.mul(tR));
    },
    ...(fine !== undefined ? { fine } : {}),
    ...(film !== null ? { slick: film } : {}),
    ...(youngRead !== undefined ? { young: youngRead } : {}),
  };

  /* --- the foam source ------------------------------------------------- */
  /* THE SEA'S OWN BREAKERS OVER THE COAST'S FLOOR (round 2; the lead's point
   * 4). The one foam field breaks a crest over the sea's bathymetry shelves
   * (oceanFoam.ts, the reef law): the bar is one, but the coast's own floor
   * (Dean's profile under the surf, the valley, the bar: the floor's map) is
   * not a shelf, so with `extras=mouth,foam` the surf broke only where the
   * FFT folded, as even speckle over the whole sea. Here the crest the FFT
   * stands at a point (every band's height, as the foam field's reef law
   * reads it) breaks over the coast's depth by the same law,
   * `breakShare(eta, d)` (H / d from 0.45 to 0.75, after McCowan 1894), and
   * that share goes into the one field as a source: a breaker line where the
   * floor is shallow for the crest, moving with the crest. It is the sea's
   * floor that is new, not the law. Where a near field holds the water (the
   * mouth's grid, the beach's grid seaward of its still-water line) the grid's
   * own bores make the foam, so the coast's share is taken by its hand-over.
   * Off the floor's map, and where the floor stands over the mean sea level
   * (dry land, the river alone), it is 0. */
  const seaSampler = createOceanSampler(field.buffers, uniform(new THREE.Vector2(0, 0)));
  const bathy = oceanBathymetryFor(field.buffers);
  const cascades = field.cascades;
  // ROUND 7: one build of the source's nodes per kernel point: \`at\` and \`breakerAt\` are called with the
  // same point node in one step kernel (oceanFoam.ts), and read the same terms.
  // FOAM ROUND 11: the forced bands' mean heading (their fallback where the sea is flat at a point).
  const meanDirX = d.bands.filter((b) => b.forced).reduce((a, b) => a + b.dirX, 0);
  const meanDirZ = d.bands.filter((b) => b.forced).reduce((a, b) => a + b.dirZ, 0);
  const sourceTerms = new WeakMap<object, { s: TslNode; roller: OceanFoamBreaker }>();
  // roller: the source's breaker (foam round 11, `OceanFoamBreaker`).
  const termsAt = (x: TslNode): { s: TslNode; roller: OceanFoamBreaker } => {
    const hit = sourceTerms.get(x as object);
    if (hit !== undefined) return hit;
    const r = buildTerms(x);
    sourceTerms.set(x as object, r);
    return r;
  };
  const buildTerms = (x: TslNode): { s: TslNode; roller: OceanFoamBreaker } => {
    {
      // The near field's bores (`MouthField.foam`) and the plume front (`jetFrontFoamOf`).
      const ug = gridUv(x);
      const uj = jetUv(x);
      // The near field's foam is handed over as its height is (times the
      // hand-over, gridB.y): at the grid's sea edge the sea's own breaker
      // owns the foam, so the bores' foam does not end in a line there
      // (mouth round 1, the lead's seam 2; the seam test holds it).
      const gB = texture(gridB, ug).level(float(0));
      const inG = inside(ug);
      const fg = gB.w.mul(gB.y).mul(inG);
      const fj = texture(jetB, uj).level(float(0)).y.mul(inside(uj));
      // The coast's breakers (above).
      const um = vec2(x.x.sub(mapX0).div(mapLen), x.y.sub(mapZ0).div(mapLen));
      const coastT6 = texture(coastTex, um).level(float(0));
      const coastD = coastT6.x;
      let eta: TslNode = float(0);
      // ROUND 3, THE ROLLER: the front face of each forced band's crest, from
      // its own slope along its heading (the norm plane holds -grad eta over
      // the Jacobian, as the surface reads it).
      // ROUND 7: the forced bands' own elevation and the analytic signal's quadrature, band by band: a band
      // of wave number k_b has eta_b = A cos theta and its slope down its heading A k_b sin theta, so the
      // slope over k_b is the quadrature (the Hilbert transform of a narrow band). The first build divided
      // the summed slope by one k (the sea's Tz): the short chop's slope then stood for a tall wave, and the
      // phase it gave put almost no point on the roller (mouth7/shots/a1-mouth-down.png).
      let etaF: TslNode = float(0);
      let quad: TslNode = float(0);
      // FOAM ROUND 11: the crest's heading at the point, each forced band's heading weighted by its own
      // local envelope squared (eta_b^2 + q_b^2, its energy here), for the roller's velocity below.
      let headW: TslNode = vec2(0, 0);
      /* ROUND 9 (law 2): each forced band at its warped place (\`phaseWarpMap\`): its crest there moves at the
       * shallow speed, so the roller the source lays stays on the bar with its crest. */
      const wS = texture(warpTex, um).level(float(0));
      const outS = max(max(um.x.negate(), um.x.sub(1)), max(um.y.negate(), um.y.sub(1))).mul(mapLen);
      const taperS = float(1).sub(smoothstep(float(0), float(Math.max(warp.taperM, 1)), max(outS, float(0))));
      for (let ci = 0; ci < cascades.length; ci += 1) {
        const b = d.bands[ci];
        const xw = b.forced && ci < 4 ? x.add(vec2(float(b.dirX), float(b.dirZ)).mul([wS.x, wS.y, wS.z, wS.w][ci].mul(taperS))) : x;
        const etaC = seaSampler.sampleCascade(seaSampler.disp, xw, ci, cascades[ci].patchM).y;
        eta = eta.add(etaC);
        if (!b.forced) continue;
        const nb = seaSampler.sampleCascade(seaSampler.norm, xw, ci, cascades[ci].patchM);
        const slopeDown = vec2(nb.x, nb.y).div(max(nb.z, float(0.3))).dot(vec2(float(b.dirX), float(b.dirZ)));
        etaF = etaF.add(etaC);
        const qB = slopeDown.mul(9.81 / (b.omega * b.omega));
        quad = quad.add(qB);
        headW = headW.add(vec2(float(b.dirX), float(b.dirZ)).mul(etaC.mul(etaC).add(qB.mul(qB))));
      }
      const onMap = inside(um).mul(step(float(0.05), coastD));
      const bAt = beachAt(x);
      // GG (open from round 1): the swash's bore foam, seaward of the still-water line (landward the beach's sheet draws it).
      const fb = bAt === null ? float(0) : bAt.foam.mul(bAt.w).mul(bAt.wetSea);
      const held = bAt === null ? gB.y.mul(inG) : gB.y.mul(inG).add(bAt.w);
      /* THE ROLLER (round 3). A crest that breaks over the floor carries a
       * roller of aerated water down its FRONT face (Svendsen 1984: the
       * roller rides the face from the crest toward the face's toe, its area
       * 0.9 H^2; Duncan 1981). The white water is there, not on the whole
       * crest: the share is the breaking law's (H / d, McCowan 1894, the
       * bathymetry module's) where the face looks shoreward along the
       * forced bands' own headings, and it is fresh foam at full strength.
       * The spent foam behind each roller is the field's own decay (its
       * 7 s life). Round 2 put the share on the whole crest at an inherited
       * 0.4 (MOUTH_COAST_BREAK_WEIGHT). */
      /* ROUND 6, THE BREAKERS FOLLOW THE BED (law 2). Round 5 broke the RAW FFT crest (the deep
       * sea's 2.4 m) over the floor's depth: it stands over 0.75 d everywhere inside the breaking
       * depth, so every crest broke over the whole surf zone, one even band of white, and at the
       * 2 m eye one thin even strip. The share of the waves that break at a point is the random
       * wave balance's Q_b (Battjes and Janssen 1978: the march over the floor, the coast
       * texture's B), and it is the HIGHEST waves of the local record that break: with Rayleigh
       * heights, the top Q_b of them stand over H_q = Hrms sqrt(-ln Q_b). So a raw crest breaks
       * where its height (crest times the bathymetry's crest-to-height) passes H_q of the sea's own
       * Rayleigh scale, over the bathymetry index's relative band (0.45 / 0.75 of it to all of it).
       * Q_b is near 0 offshore of the surf, a few percent at the outer breaker line (the big crests
       * of each group break), high on the bar's crest and near the shore, and lower in the bar's
       * lee and in its two channels: the line follows the bed and the wave groups. */
      const qb = clamp(coastT6.z, float(1e-6), float(1));
      const hQ = sqrt(log(qb).negate()).mul(hrmsDeepM);
      /* ROUND 7, THE BREAK LINE IS A LINE (law 1; `rollerSourceCpu` is the CPU twin). Round 6 broke a
       * point where its OWN elevation (crest times the crest-to-height) passed H_q: only the top of the
       * tallest crests passed, so at the judged instant the bar showed a few specks (0 % of rows 285 to
       * 325 over luma 200). (b) The wave a point belongs to is its envelope: the forced bands' analytic
       * signal, A = sqrt(eta_f^2 + q^2), q the sum of each band's slope down its heading over its k,
       * height 2 A on the deep sea's Rayleigh scale, so a crest breaks along its whole length while its
       * group is over H_q, and every crest of the group at once. (a) THE ROLLER'S LENGTH ON THE
       * FACE: Svendsen's (1984) area 0.9 H^2 and Duncan's (1981) 0.11 L_r^2 give L_r = 2.86 H_m, H_m
       * Battjes and Janssen's broken height (0.88 / k) tanh(gamma k h / 0.88) on the local depth (k by
       * Fenton and McKee); it covers the face from the crest to theta_r = k L_r. The mean cover of active
       * rollers is then Q_b theta_r / (2 pi), the dissipation's own share (`rollerMeanCoverage`); the
       * foam they leave is the field's age clock and decay. Round 3 to 6 put it on the whole front face. */
      const aEnv = sqrt(etaF.mul(etaF).add(quad.mul(quad))).toVar();
      const hEnv = aEnv.mul(2);
      // three r172's TSL has no tanh: tanh(x) = 1 - 2 / (e^(2x) + 1), x >= 0 here.
      const tanhP = (x: TslNode): TslNode => float(1).sub(float(2).div(exp(x.mul(2)).add(1)));
      const hLoc = max(coastD, float(0.05));
      const kLoc = float(rollerK0).div(pow(tanhP(pow(hLoc.mul(rollerK0), float(0.75))), float(2 / 3)));
      const hm = float(0.88).div(kLoc).mul(tanhP(kLoc.mul(hLoc).mul(rollerGamma / 0.88)));
      const thetaR = min(kLoc.mul(hm).mul(ROLLER_LENGTH_PER_H), float(Math.PI));
      const cosT = etaF.div(max(aEnv, float(1e-6)));
      const roller = step(float(0), quad).mul(smoothstep(cos(thetaR), cos(thetaR.mul(0.8)), cosT));
      // FOAM ROUND 11: the share of the water whose waves break now, whatever the phase (`fq`); the
      // roller's cover is that share on the crest's face (`fc`, round 7's law unchanged).
      /* ROUND 8 (law 2): THE BREAKING ON THE BAR IS DEPTH-LIMITED (\`depthLimitedBreakShare\`, the coast
       * texture's A; \`sourceBreakingShareCpu\` is the CPU twin). Where the march's record stands at McCowan's
       * limit the surf is saturated and every crest breaks, whatever its group: the larger of that share and
       * round 7's group rule. Seaward of the bar, where the record is under the limit, the group rule alone. */
      const fqGroup = smoothstep(hQ.mul(OCEAN_BREAK_START / OCEAN_BREAK_FULL), hQ.add(1e-4), hEnv)
        .mul(step(float(1e-4), coastT6.z));
      const fq = max(fqGroup, clamp(coastT6.w, float(0), float(1)))
        .mul(onMap).mul(float(1).sub(clamp(held, float(0), float(1)))).toVar();
      const fc = fq.mul(roller);
      const s = max(max(fg, fj), max(fb, fc));
      /* ROUND 7: the share of the breaking this source owns: the waves that feel the bed. Where k h is
       * under 1 (Tz's k on the local depth) the wave is depth-controlled and breaks by depth (Battjes and
       * Janssen); from k h = pi (h over half the wavelength, deep water) the sea's own whitecaps (the
       * field's fold law) are the breakers. Off the map and where a near field holds the water, 0. */
      const own = float(1).sub(smoothstep(float(1), float(Math.PI), kLoc.mul(hLoc)))
        .mul(onMap).mul(float(1).sub(clamp(held, float(0), float(1))));
      /* FOAM ROUND 11: THE ROLLER'S OWN SPEED. A broken crest on the bar runs as a bore at
       * c = sqrt(g (h + H)) (`foamRollerCrestSpeedMs`), h the local depth and H the broken height H_m
       * above (Battjes and Janssen's, the height a broken wave keeps on that depth), along the crest's
       * heading (the forced bands' energy-weighted heading here; the bands' mean where they are flat). */
      const hd = headW.add(vec2(float(meanDirX), float(meanDirZ)).mul(1e-6));
      const cRoll = sqrt(hLoc.add(hm).mul(9.81));
      const velocity = hd.div(max(hd.length(), float(1e-9))).mul(cRoll);
      return { s, roller: { cover: fc, breaking: fq, own, velocity } };
    }
  };
  const foamSource: OceanFoamSource & { breakerAt(x: TslNode): OceanFoamBreaker } = {
    name: 'river-mouth',
    at(x: TslNode): TslNode {
      const s = termsAt(x).s;
      return vec2(s, s);
    },
    /* ROUND 7 (law 1): the bar's ACTIVE rollers are the foam field's breakers. The field draws an active
     * crest white by its breaker channel B (the head); a source that laid only F and the age clock gave the
     * bar a grey, old F and no white crest at the 2 m eye (mouth7/eye/w3.png: B 0 over the bar).
     * FOAM ROUND 11: the field takes it (`OceanFoamSource.breakerAt`, `OceanFoamBreaker`): the roller's
     * cover, the breaking share, the share the source owns (the depth-controlled water) and the crest's
     * own velocity. */
    breakerAt(x: TslNode): OceanFoamBreaker {
      return termsAt(x).roller;
    },
  };

  /* --- the stepping plan ----------------------------------------------- */
  let inFlight = false;
  let reqId = 0;
  let wantT = 0;
  let wantPinned = false;
  let shown: OceanMouthState | null = null;
  const stepOf = (t: number) => Math.max(Math.floor(t / MOUTH_DT + 1e-6), 0);
  const ask = () => {
    if (inFlight) return;
    const target = stepOf(wantT);
    if (shown && shown.step === target) return;
    inFlight = true;
    reqId += 1;
    // A live frame asks for at most two seconds at once; a pinned clock for all.
    const budget = wantPinned ? Number.POSITIVE_INFINITY : 200;
    worker.postMessage({ type: 'advance', id: reqId, t: wantT, budget });
  };
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'error') {
      workerError = m.message;
      inFlight = false;
      return;
    }
    if (m.type !== 'state') return;
    inFlight = false;
    (gridA.image as { data: Uint16Array }).data = m.a;
    (gridB.image as { data: Uint16Array }).data = m.b;
    (gridC.image as { data: Uint16Array }).data = m.c;
    gridA.needsUpdate = true;
    gridB.needsUpdate = true;
    gridC.needsUpdate = true;
    if (m.d) { (gridD.image as { data: Uint16Array }).data = m.d; gridD.needsUpdate = true; }
    shown = { step: m.step, timeS: m.step * MOUTH_DT, ledger: m.ledger, stats: m.stats };
    ask();
  };

  const update = (simTime: number, pinned: boolean, askWorker = true) => {
    if (workerError) throw new Error(`[ocean] The mouth worker failed.\n\n${workerError}`);
    if (askWorker) {
      wantT = simTime;
      wantPinned = pinned;
      ask();
    }
  };

  const probe: Record<string, unknown> = {
    settled: () => !inFlight && shown !== null && shown.step === stepOf(wantT),
    state: () => shown,
    design: () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { params, ...rest } = d;
      return rest;
    },
    jetDomain: dom,
    /** Round 5: the river's film law in force (null: no wind-locked band). */
    slick: film,
    /** Round 5: the front's eddy table (\`frontEddyTable\`): its ladder's top and phases, for the CPU twin. */
    frontEddies: { f0Hz: kh.f0Hz, psi: Array.from(kh.psi) },
    /** Round 5: the river water's optics on the GPU, and a measure rig's switch (`setOptics`) to step R_inf for the color law's calibration. */
    optics: () => ({ rInf: [uRInf.value.x, uRInf.value.y, uRInf.value.z], kd: [uKd.value.x, uKd.value.y, uKd.value.z] }),
    setOptics: (rInf: number[] | null, kd?: number[] | null) => {
      if (rInf) uRInf.value.set(rInf[0], rInf[1], rInf[2]);
      if (kd) uKd.value.set(kd[0], kd[1], kd[2]);
    },
    stirredColumnM: (x: number, z: number) => { const i = Math.round((x - map.originX) / map.texelM); const j = Math.round((z - map.originZ) / map.texelM); return i < 0 || j < 0 || i >= map.res || j >= map.res ? null : { column: stirred.columnM[j * map.res + i], hrms: stirred.hrmsM[j * map.res + i] }; },
    fine: finePatch === null ? null : { drawnVar: finePatch.drawnVar, lawVar: finePatch.lawVar, subVar: finePatch.subVar, driftMS: finePatch.driftMS, periodS: finePatch.periodS, windMS: finePatch.windMS },
    ready,
    stepOf,
    dt: MOUTH_DT,
  };

  /* ROUND 10 (law 4, GG-394): THE WET BAND'S EDGE AT THE BEACH'S RESOLUTION. Round 5 read the sand's state at the
   * near field's 1 m cells by the linear filter, and the beach's wet line (a threshold on that state, `wetness`)
   * drew a comb of 1 m teeth along every diagonal waterline: the "jagged dark sawtooth rim" of the spits. The beach
   * reads its own grid by a cubic B-spline (`spline`, oceanBeach.ts: four filtered taps, Sigg and Hadwiger 2005),
   * whose level lines are smooth curves; the strip's sand is now read the same way, so the spit's wet band is the
   * beach's by the beach's own reconstruction. */
  const splineD = (u0: TslNode): TslNode => {
    const size = vec2(g.ns, g.na);
    const x = u0.mul(size).sub(0.5);
    const i = floor(x);
    const f = x.sub(i);
    const f2 = f.mul(f);
    const f3 = f2.mul(f);
    const w0 = float(1).sub(f).pow(3).div(6);
    const w1 = f3.mul(3).sub(f2.mul(6)).add(4).div(6);
    const w2 = f3.mul(-3).add(f2.mul(3)).add(f.mul(3)).add(1).div(6);
    const w3 = f3.div(6);
    const g0 = w0.add(w1);
    const g1 = w2.add(w3);
    const p0 = i.sub(1).add(w1.div(g0)).add(0.5).div(size);
    const p1 = i.add(1).add(w3.div(g1)).add(0.5).div(size);
    const t = (uu: TslNode, vv: TslNode): TslNode => texture(gridD, vec2(uu, vv)).level(float(0));
    return t(p0.x, p0.y).mul(g0.x).add(t(p1.x, p0.y).mul(g1.x)).mul(g0.y)
      .add(t(p0.x, p1.y).mul(g0.x).add(t(p1.x, p1.y).mul(g1.x)).mul(g1.y));
  };
  const stripSoil = (xz: TslNode): { w: TslNode; a: TslNode; b: TslNode } => {
    const u = gridUv(xz);
    const st = splineD(u);
    // As the beach's own reads: a = (h, u, v, foam), b = (skin saturation, stranded foam, mark, minutes since the water left).
    return { w: inside(u), a: vec4(st.z, float(0), float(0), st.w), b: vec4(st.x, float(0), float(0), st.y) };
  };
  const stepYoung = (renderer: THREE.WebGPURenderer, simTime: number) => {
    if (youngGpu === null || simTime === youngT) return;
    youngT = simTime;
    youngGpu.fft.uTime.value = simTime;
    youngGpu.fine.uTime.value = simTime;
    renderer.compute(youngGpu.nodes);
  };
  probe.young = youngLaw === null ? null : {
    windRelMS: youngLaw.windRelMS, dir: [youngLaw.dirX, youngLaw.dirZ], fetchM: youngLaw.fetchM, peakM: youngLaw.peakM, betaPeak: youngLaw.betaPeak,
    hsM: youngLaw.hsM, slopeVar: youngLaw.slopeVar, shortShare: youngLaw.shortShare, takeNear: youngTakeNear, takeFar: youngTakeFar,
    split: youngSplit === null ? null : { splitM: youngSplit.splitM, mainVar: youngSplit.mainVar, fineVar: youngSplit.fineVar, finePatchM: youngSplit.fine.patchM },
    openOmegaS: youngLaw.openOmegaS, openCgS: youngLaw.openCgS, patchM: youngLaw.cascade.patchM,
  };
  probe.warp = { taperM: warp.taperM, edgeW: warp.edgeW };
  return {
    reader,
    foamSource,
    stripSoil,
    update,
    stepYoung,
    dispose() {
      worker.terminate();
      gridA.dispose();
      gridB.dispose();
      gridC.dispose();
      gridD.dispose();
      jetA.dispose();
      jetB.dispose();
      coastTex.dispose();
      leanTex.dispose();
      khTex.dispose();
      fineTex?.dispose();
      warpTex.dispose();
    },
    probe,
  };
}
