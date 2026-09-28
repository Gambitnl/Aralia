/**
 * @file oceanBathymetry.ts — the depth of the sea floor where it is shallow,
 * one description for every part of the sea that must know it.
 *
 * WHY THIS EXISTS (Remy, 2026-09-29: all water is one system). The FFT sea
 * is deep water: its waves do not know a reef is under them, so they do not
 * build, steepen or break over it. Rocks in the surf stand on such a reef.
 * If the rocks piece drew its own breaking wave and its own white water, the
 * sea and the rocks would be two systems that meet at a seam. So the reef is
 * a property of the SEA: this module holds its depth, and each part of the
 * sea reads the same depth.
 *
 *   - the foam field (`oceanFoam.ts`, through its patch): a crest breaks
 *     where it is high for the depth, and the breaker lays foam and runs
 *     with its crest, so the white water over the reef is the sea's own foam;
 *   - the sea surface (`oceanSurface.ts`, through its patch): the waves
 *     shoal (grow) toward the reef and are held to the depth once broken;
 *   - the rocks' model (`oceanRocksMath.ts`): the depth at a face sets the
 *     surf there.
 *
 * THE FLOOR IS A SET OF SHELVES. A shelf is a disc on the floor: depth
 * `depthM` within `innerM` of its center, falling to `farDepthM` by
 * `outerM` (a smooth reef edge), the shallowest shelf winning where two
 * overlap. With no shelf the sea is deep everywhere, and every reader adds
 * nothing (the uniform branch is not taken): 0 pixels changed.
 *
 * ONE BATHYMETRY A SEA. The state lives in uniforms keyed on the sea's GPU
 * buffers (`oceanBathymetryFor`), so the surface, the foam field and a piece
 * all reach the same object from the sea they share, whoever builds first.
 *
 * Added by the rocks piece of the ocean gauntlet (round 2, 2026-09-29).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/09/2026, 19:24:38
 * Dependents: systems/world3d/ocean/oceanRocks.ts, systems/world3d/ocean/oceanRocksMath.ts, systems/world3d/ocean/oceanSurface.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { Fn, Loop, float, int, max, min, pow, smoothstep, uniform, uniformArray, vec2 } from 'three/tsl';
import type { CascadeParams } from './oceanConfig';
import { jonswapPeakOmega } from './oceanSpectrum';

/**
 * A TSL node expression. See `oceanSurface.ts` for why this is `any`: three
 * 0.172 ships no type that names every node class an expression can produce.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

/** The most shelves a sea holds. */
export const OCEAN_SHELF_SLOTS = 8;

/** The depth of the open sea the shelves rise out of, meters (deep enough that no crest breaks on it). */
export const OCEAN_DEEP_M = 1000;

/**
 * DEPTH-LIMITED BREAKING. A wave breaks where its height passes a share of
 * the depth: McCowan (1894) put the limit for a solitary wave at H / d =
 * 0.78, and irregular waves on a reef flat begin to break from about 0.45
 * (the saturated surf zone, Thornton and Guza 1983). The breaking share
 * ramps between the two, with the wave's height H read from the crest's
 * elevation eta as OCEAN_CREST_TO_HEIGHT eta (a steep crest stands about
 * 55% of its wave's height over the mean level).
 */
export const OCEAN_BREAK_START = 0.45;
export const OCEAN_BREAK_FULL = 0.75;
export const OCEAN_CREST_TO_HEIGHT = 1.8;

/**
 * THE HEIGHT A BROKEN WAVE KEEPS. In a saturated surf zone the wave height
 * stays near a fixed share of the local depth, H = gamma d, gamma about 0.4
 * to 0.55 on a flat (Thornton and Guza 1983 fit 0.42 to field data): the
 * wave broke at the shelf edge and its bore carries on at the depth's
 * share. The surface holds a crest to OCEAN_BORE_GAMMA d / OCEAN_CREST_TO_HEIGHT
 * over the shelf, softly (see `oceanShoalCrestM`).
 */
export const OCEAN_BORE_GAMMA = 0.55;

/** One shelf of the floor. Meters, world XZ. */
export interface OceanShelf {
  readonly xM: number;
  readonly zM: number;
  /** Depth `depthM` out to this radius. */
  readonly innerM: number;
  /** `farDepthM` from this radius out. */
  readonly outerM: number;
  readonly depthM: number;
  readonly farDepthM: number;
}

/** The depth under world (x, z) on the CPU: the shallowest shelf's, or OCEAN_DEEP_M. */
export function oceanShelfDepthCpu(shelves: readonly OceanShelf[], xM: number, zM: number): number {
  let d = OCEAN_DEEP_M;
  for (const s of shelves) {
    const r = Math.hypot(xM - s.xM, zM - s.zM);
    const t = Math.min(Math.max((r - s.innerM) / Math.max(s.outerM - s.innerM, 1e-3), 0), 1);
    const k = t * t * (3 - 2 * t);
    d = Math.min(d, s.depthM + (s.farDepthM - s.depthM) * k);
  }
  return d;
}

/** The breaking share of a crest `etaM` over depth `depthM`, 0 to 1 (CPU). */
export function oceanBreakShareCpu(etaM: number, depthM: number): number {
  const x = (OCEAN_CREST_TO_HEIGHT * Math.max(etaM, 0)) / Math.max(depthM, 0.05);
  const t = Math.min(Math.max((x - OCEAN_BREAK_START) / (OCEAN_BREAK_FULL - OCEAN_BREAK_START), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * THE SHOALING GAIN of a band whose waves have period `periodS`, at depth
 * `depthM`: Ks = sqrt(cg_deep / cg(d)) (energy flux conserved as the wave
 * slows, linear theory; Dean and Dalrymple 1991, section 4.8), with the
 * group speed from the dispersion relation solved by Fenton and McKee's
 * (1990) explicit fit. 1 in deep water; 1.41 for a 12.7 s swell on 2.5 m.
 */
export function oceanShoalGain(periodS: number, depthM: number): number {
  const g = 9.81;
  const w = (2 * Math.PI) / Math.max(periodS, 0.1);
  const k0 = (w * w) / g;
  const kh0 = k0 * Math.max(depthM, 0.05);
  const kh = kh0 / Math.tanh(kh0 ** 0.75) ** (2 / 3);
  const k = kh / Math.max(depthM, 0.05);
  const c = w / k;
  const n = 0.5 * (1 + (2 * kh) / Math.sinh(2 * kh));
  const cg = n * c;
  const cg0 = 0.5 * (g / w);
  return Math.sqrt(cg0 / Math.max(cg, 1e-3));
}

/** The held crest over a depth: the largest crest a broken wave keeps there (CPU). */
export function oceanBoreCrestM(depthM: number): number {
  return (OCEAN_BORE_GAMMA * Math.max(depthM, 0.05)) / OCEAN_CREST_TO_HEIGHT;
}

/** The most FFT bands the shoaling gains are held for. */
export const OCEAN_SHOAL_BANDS = 8;

/**
 * The period that carries a band's energy: its JONSWAP peak's wavelength
 * clamped into the band's cutoffs (a band cut below the peak holds its energy
 * at its long end), as a deep-water period, seconds.
 */
export function oceanBandPeriodS(c: CascadeParams): number {
  const w = jonswapPeakOmega(c.windSpeedMs, c.fetchM);
  const lp = (2 * Math.PI * 9.81) / (w * w);
  const l = Math.min(Math.max(lp, Math.max(c.cutoffLowM, 0.1)), c.cutoffHighM);
  return Math.sqrt((2 * Math.PI * l) / 9.81);
}

/**
 * THE SHOALING GAIN ON THE GPU, Green's law. A band's height grows as
 * d^(-1/4) in shallow water (Green 1838; the shallow limit of Ks), which is
 * one pow a vertex. Its reference depth dRef is fitted on the CPU so the
 * gain equals linear theory's Ks (`oceanShoalGain`) at the shelf's depth:
 * dRef = d Ks^4. Deeper than dRef the gain is 1. (A 12.7 s swell on a
 * 2.5 m shelf: Ks 1.41, dRef 9.9 m.)
 */
export function oceanBandRefDepthM(periodS: number, fitDepthM: number): number {
  const ks = Math.max(oceanShoalGain(periodS, fitDepthM), 1);
  return fitDepthM * ks ** 4;
}

/** The CPU twin of the GPU gain. */
export function oceanBandGainCpu(refDepthM: number, depthM: number): number {
  if (refDepthM <= 0) return 1;
  return Math.max(1, (refDepthM / Math.max(depthM, 0.05)) ** 0.25);
}

export interface OceanBathymetry {
  /** One vec4 a shelf, (x, z, inner, outer), and one more, (depth, farDepth, 0, 0). */
  readonly uShelfA: TslNode;
  readonly uShelfB: TslNode;
  /** The live shelf count, a uniform int: 0 means the floor is deep everywhere. */
  readonly uCount: TslNode;
  /** Per FFT band, (dRef, 0, 0, 0): the shoaling gain's reference depth (0: no gain). */
  readonly uBandRef: TslNode;
  /** The bands' reference depths as last set, for CPU mirrors. */
  readonly bandRefM: readonly number[];
  /**
   * Fit every band's shoaling gain to linear theory at depth `fitDepthM`
   * (the shelf's own depth): see `oceanBandRefDepthM`.
   */
  setBands(cascades: readonly CascadeParams[], fitDepthM: number): void;
  /** The shoaling gain of band `ci` at a depth node: max(1, (dRef / d)^(1/4)). 1 before `setBands`. */
  bandGain(ci: number, depthM: TslNode): TslNode;
  /** The shelves as last set, for CPU mirrors. */
  readonly shelves: readonly OceanShelf[];
  /** Replace the shelves (at most OCEAN_SHELF_SLOTS). */
  set(list: readonly OceanShelf[]): void;
  /**
   * The depth under a world XZ node: the shallowest shelf's, or OCEAN_DEEP_M.
   * Build it inside a caller's own branch on `uCount` (it loops the slots).
   */
  depthAt(xz: TslNode): TslNode;
  /** The breaking share of a crest node over a depth node (the GPU twin of `oceanBreakShareCpu`). */
  breakShare(etaM: TslNode, depthM: TslNode): TslNode;
}

const BY_KEY = new WeakMap<object, OceanBathymetry>();

/**
 * The bathymetry of the sea whose GPU buffers are `key` (the field's
 * `buffers`: the surface, the foam field and the pieces all hold them). Made
 * on the first call, with no shelf.
 */
export function oceanBathymetryFor(key: object): OceanBathymetry {
  const hit = BY_KEY.get(key);
  if (hit) return hit;
  const a: THREE.Vector4[] = [];
  const b: THREE.Vector4[] = [];
  for (let i = 0; i < OCEAN_SHELF_SLOTS; i += 1) {
    a.push(new THREE.Vector4(0, 0, 0, 1));
    b.push(new THREE.Vector4(OCEAN_DEEP_M, OCEAN_DEEP_M, 0, 0));
  }
  const uShelfA = uniformArray(a, 'vec4');
  const uShelfB = uniformArray(b, 'vec4');
  const uCount = uniform(0, 'int');
  const refs: THREE.Vector4[] = [];
  for (let i = 0; i < OCEAN_SHOAL_BANDS; i += 1) refs.push(new THREE.Vector4(0, 0, 0, 0));
  const uBandRef = uniformArray(refs, 'vec4');
  let bandRefM: number[] = [];
  let shelves: OceanShelf[] = [];
  const bathy: OceanBathymetry = {
    uShelfA,
    uShelfB,
    uCount,
    uBandRef,
    get bandRefM() { return bandRefM; },
    get shelves() { return shelves; },
    setBands(cascades, fitDepthM) {
      if (cascades.length > OCEAN_SHOAL_BANDS) throw new Error(`[ocean] ${cascades.length} bands, the bathymetry holds ${OCEAN_SHOAL_BANDS}.`);
      bandRefM = cascades.map((c) => oceanBandRefDepthM(oceanBandPeriodS(c), fitDepthM));
      for (let i = 0; i < OCEAN_SHOAL_BANDS; i += 1) refs[i].set(bandRefM[i] ?? 0, 0, 0, 0);
    },
    bandGain(ci: number, depthM: TslNode): TslNode {
      // pow(0, 0.25) is 0, so a band with no reference depth keeps a gain of
      // exactly 1, and so does every band where the floor is deep.
      return max(float(1), pow(uBandRef.element(int(ci)).x.div(max(depthM, float(0.05))), float(0.25)));
    },
    set(list) {
      if (list.length > OCEAN_SHELF_SLOTS) {
        throw new Error(`[ocean] ${list.length} shelves asked, the bathymetry holds ${OCEAN_SHELF_SLOTS}.`);
      }
      shelves = list.slice();
      for (let i = 0; i < OCEAN_SHELF_SLOTS; i += 1) {
        const s = list[i];
        if (s) {
          a[i].set(s.xM, s.zM, s.innerM, Math.max(s.outerM, s.innerM + 1e-3));
          b[i].set(s.depthM, s.farDepthM, 0, 0);
        } else {
          a[i].set(0, 0, 0, 1);
          b[i].set(OCEAN_DEEP_M, OCEAN_DEEP_M, 0, 0);
        }
      }
      uCount.value = list.length;
    },
    depthAt(xz: TslNode): TslNode {
      return Fn(() => {
        const d = float(OCEAN_DEEP_M).toVar();
        Loop({ start: int(0), end: uCount, type: 'int', condition: '<' }, ({ i }: { i: TslNode }) => {
          const sa = uShelfA.element(i);
          const sb = uShelfB.element(i);
          const r = vec2(xz.x, xz.y).sub(vec2(sa.x, sa.y)).length();
          const k = smoothstep(sa.z, sa.w, r);
          d.assign(min(d, sb.x.add(sb.y.sub(sb.x).mul(k))));
        });
        return d;
      })();
    },
    breakShare(etaM: TslNode, depthM: TslNode): TslNode {
      const x = max(etaM, float(0)).mul(OCEAN_CREST_TO_HEIGHT).div(max(depthM, float(0.05)));
      return smoothstep(float(OCEAN_BREAK_START), float(OCEAN_BREAK_FULL), x);
    },
  };
  // A caller branches on the count: `If(bathy.uCount.greaterThan(0), ...)`.
  BY_KEY.set(key, bathy);
  return bathy;
}
