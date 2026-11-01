/**
 * @file riverSurfaceMirror.ts — the river water's drawn surface on the CPU:
 * the level, the velocity and depth the ripples ride, and the height of the
 * waves the water shader draws (rivers round 4, for the floaters).
 *
 * A CPU MIRROR OF THE SHADER. `heightAt(x, z, t)` follows the water shader's
 * `hWaves` (riverWaterMaterial.ts) term by term: the same flow map texels
 * (half-float, bilinear, clamped at the edges), the same ripple tiles, cycle
 * phases, hash offsets, oriented-ripple blend and amplitudes, the standing
 * waves and the rocks' shapes, read from the same noise texture at its full
 * detail (mip level 0: the texture as a close camera sees it). Debug output
 * 10 writes the shader's own value, and `RiverReachView.readSurfaceHeight`
 * reads it back for the proof that the two agree.
 *
 * What the mirror leaves out: the texture's mip chain (a far camera sees a
 * smoothed surface; a floater is judged close), and the GPU's own rounding
 * (bilinear weights and half floats: about 1e-4 m).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/10/2026, 12:16:23
 * Dependents: components/World3D/water/riverDroppedObjectsView.ts, components/World3D/water/riverFloatersView.ts, components/World3D/water/riverReachScene.ts, components/World3D/water/riverReceivingRefiner.ts, components/World3D/water/riverWaterfallView.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import type { FloaterWaterSampler } from '@/systems/world3d/river/riverFloaters';
import { getRiverNoiseTexture, RIVER_TEX_STATS, riverPoolImpactHeight, type RiverPoolImpact } from './riverWaterMaterial';

type V3 = [number, number, number];

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const fract = (x: number): number => x - Math.floor(x);

export class RiverSurfaceMirror implements FloaterWaterSampler {
  private readonly nx: number;
  private readonly nz: number;
  private readonly dx: number;
  private readonly x0: number;
  private readonly z0: number;
  private t0: Float32Array | null;
  private t1: Float32Array | null;
  private t2: Float32Array | null;
  private surfaceLevels: Float32Array;
  /**
   * THE LIVE RIVER (2026-09-29): the flow map as the half floats the textures
   * hold, read through a table with the same values as the quantized cold
   * fallback, so a new flow map a few times a second
   * costs the page no conversion. Null: the arrays above (the judged scene).
   */
  private half: [Uint16Array, Uint16Array, Uint16Array] | null = null;
  private static halfTable: Float32Array | null = null;

  /** THE LIVE RIVER: read the flow map from these half-float arrays and this drawn surface from now on. */
  setFlowHalf(t0h: Uint16Array, t1h: Uint16Array, t2h: Uint16Array, surface: Float32Array): void {
    if (!RiverSurfaceMirror.halfTable) {
      const t = new Float32Array(65536);
      for (let k = 0; k < 65536; k += 1) t[k] = THREE.DataUtils.fromHalfFloat(k);
      RiverSurfaceMirror.halfTable = t;
    }
    this.half = [t0h, t1h, t2h];
    this.surfaceLevels = surface;
    // Half flow owns all future samples. Release the superseded cold copies;
    // keeping them here would retain three full maps after every live start.
    this.t0 = this.t1 = this.t2 = null;
  }
  private readonly noise: Uint8Array;
  private readonly N: number;
  private readonly slopeRms: number;
  private readonly heightScale: number;
  private readonly cycle = 1.0;
  private mainRapidsMask: Uint8Array | null = null;
  private mainRapidsEnabled = false;
  mainRapidsBounds: readonly [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];

  /** Floaters follow the same main-only ripple morphology and quantized
   * ownership mask as the shader. No mask, or disabled, keeps legacy heights. */
  setMainRapidsMorphology(mask: Uint8Array | null, enabled: boolean): void {
    this.mainRapidsMask = mask;
    this.mainRapidsEnabled = enabled;
    let i0 = this.nx, i1 = -1, j0 = this.nz, j1 = -1;
    if (enabled && mask) for (let c = 0; c < this.nx * this.nz; c += 1) {
      if (!mask[c * 4]) continue;
      const i = c % this.nx; const j = Math.floor(c / this.nx);
      i0 = Math.min(i0,i); i1 = Math.max(i1,i); j0 = Math.min(j0,j); j1 = Math.max(j1,j);
    }
    // Bilinear ownership extends one cell beyond its nonzero sample centers.
    this.mainRapidsBounds = [this.x0 + (i0 - 0.5) * this.dx, this.x0 + (i1 + 1.5) * this.dx,
      this.z0 + (j0 - 0.5) * this.dx, this.z0 + (j1 + 1.5) * this.dx];
  }

  mainRapidsShare(x: number, z: number): number {
    const mask = this.mainRapidsMask;
    if (!this.mainRapidsEnabled || !mask) return 0;
    const fx = Math.min(this.nx - 1, Math.max(0, (x - this.x0) / this.dx - 0.5));
    const fz = Math.min(this.nz - 1, Math.max(0, (z - this.z0) / this.dx - 0.5));
    const i = Math.min(this.nx - 2, Math.floor(fx));
    const j = Math.min(this.nz - 2, Math.floor(fz));
    const tx = fx - i; const tz = fz - j;
    const a = mask[(j * this.nx + i) * 4]; const b = mask[(j * this.nx + i + 1) * 4];
    const c = mask[((j + 1) * this.nx + i) * 4]; const d = mask[((j + 1) * this.nx + i + 1) * 4];
    return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz) / 255;
  }

  private poolImpact: RiverPoolImpact | null = null;
  private poolPositions: Float32Array | null = null;
  private poolIndices: Uint32Array | null = null;
  private poolBins = new Map<number, number[]>();

  /** Only accepted landing state enables receiving waves. Source/original
   * materials keep zero uniforms; this field never edits solver arrays. */
  setPoolImpact(impact: RiverPoolImpact | null): void { this.poolImpact = impact; }

  poolImpactHeightAt(x: number, z: number, y: number, time: number): number {
    return riverPoolImpactHeight(this.poolImpact, x, z, y, time, this.depth(x, z));
  }

  /** Index only nearby receiving faces when the flow sheet changes. No
   * geometry is baked or scanned in the animation loop. */
  setPoolImpactTriangles(pos: Float32Array, index: Uint32Array): void {
    this.poolPositions = pos; this.poolIndices = index; this.poolBins.clear();
    const impact = this.poolImpact; if (!impact || impact.discharge <= 0) return;
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3; const b = index[t + 1] * 3; const c = index[t + 2] * 3;
      const minX = Math.min(pos[a], pos[b], pos[c]); const maxX = Math.max(pos[a], pos[b], pos[c]);
      const minZ = Math.min(pos[a + 2], pos[b + 2], pos[c + 2]); const maxZ = Math.max(pos[a + 2], pos[b + 2], pos[c + 2]);
      if (minX > impact.x + 8 || maxX < impact.x - 8 || minZ > impact.z + 8 || maxZ < impact.z - 8) continue;
      const cell = (v: number, origin: number) => Math.floor((v - origin) / this.dx - 0.5);
      for (let j = cell(minZ, this.z0); j <= cell(maxZ, this.z0); j += 1) for (let i = cell(minX, this.x0); i <= cell(maxX, this.x0); i += 1) {
        const key = j * this.nx + i; const bin = this.poolBins.get(key);
        if (bin) bin.push(t); else this.poolBins.set(key, [t]);
      }
    }
  }

  /** A floater rides the actual GPU-displaced triangle, not a continuous
   * wave evaluated between its vertices. This distinction matters at 0.5 m. */
  poolSurfaceAt(x: number, z: number, time: number): number | null {
    const impact = this.poolImpact; const p = this.poolPositions; const idx = this.poolIndices;
    if (!impact || impact.discharge <= 0 || !p || !idx || Math.hypot(x - impact.x, z - impact.z) >= 8) return null;
    const i = Math.floor((x - this.x0) / this.dx - 0.5); const j = Math.floor((z - this.z0) / this.dx - 0.5);
    for (const t of this.poolBins.get(j * this.nx + i) ?? []) {
      const a = idx[t] * 3; const b = idx[t + 1] * 3; const c = idx[t + 2] * 3;
      const den = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
      if (Math.abs(den) < 1e-12) continue;
      const wa = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / den;
      const wb = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / den;
      const wc = 1 - wa - wb;
      if (Math.min(wa, wb, wc) < -1e-7) continue;
      return wa * (p[a + 1] + this.poolImpactHeightAt(p[a], p[a + 2], p[a + 1], time))
        + wb * (p[b + 1] + this.poolImpactHeightAt(p[b], p[b + 2], p[b + 1], time))
        + wc * (p[c + 1] + this.poolImpactHeightAt(p[c], p[c + 2], p[c + 1], time));
    }
    return null;
  }

  private standingPositions: Float32Array | null = null;
  private standingTriangles: Uint32Array | null = null;
  private standingBins = new Map<number, number[]>();

  /** Keep the exact baked triangles, indexed by solver cell for cheap floater
   * queries. This runs when flow changes, never in the animation loop. */
  setStandingTriangles(pos: Float32Array | null, index: Uint32Array | null): void {
    this.standingPositions = pos; this.standingTriangles = index; this.standingBins.clear();
    if (!pos || !index) return;
    for (let t = 0; t < index.length; t += 3) {
      // Index the same faces and cells without two temporary arrays and a
      // new closure for every face in every received snapshot.
      const a = index[t] * 3; const b = index[t + 1] * 3; const c = index[t + 2] * 3;
      const j0 = Math.floor((Math.min(pos[a + 2], pos[b + 2], pos[c + 2]) - this.z0) / this.dx - 0.5);
      const j1 = Math.floor((Math.max(pos[a + 2], pos[b + 2], pos[c + 2]) - this.z0) / this.dx - 0.5);
      const i0 = Math.floor((Math.min(pos[a], pos[b], pos[c]) - this.x0) / this.dx - 0.5);
      const i1 = Math.floor((Math.max(pos[a], pos[b], pos[c]) - this.x0) / this.dx - 0.5);
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const k = j * this.nx + i; const bin = this.standingBins.get(k);
          if (bin) bin.push(t); else this.standingBins.set(k, [t]);
        }
      }
    }
  }

  /** Actual rendered broad-wave sheet height, with triangle interpolation.
   * Null means this point belongs to the legacy, undisplaced river. */
  standingSurfaceAt(x: number, z: number): number | null {
    if (this.mainRapidsShare(x, z) <= 0 || !this.standingPositions || !this.standingTriangles) return null;
    const p = this.standingPositions; const idx = this.standingTriangles;
    const i = Math.floor((x - this.x0) / this.dx - 0.5); const j = Math.floor((z - this.z0) / this.dx - 0.5);
    for (const t of this.standingBins.get(j * this.nx + i) ?? []) {
      const a = idx[t] * 3; const b = idx[t + 1] * 3; const c = idx[t + 2] * 3;
      const den = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
      if (Math.abs(den) < 1e-12) continue;
      const wa = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / den;
      const wb = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / den;
      const wc = 1 - wa - wb;
      if (Math.min(wa, wb, wc) >= -1e-7) return wa * p[a + 1] + wb * p[b + 1] + wc * p[c + 1];
    }
    return NaN;
  }

  /** Only the broadest native standing band can be resolved by a 0.25 m
   * mesh. Shallow fast flow sets its wavelength; local obstacle/drop forcing
   * sets its amplitude, so a uniform glide has no imposed standing wave.
   * Fine ripples and the static rock-pillow height remain optical detail. */
  broadStandingHeightAt(x: number, z: number, amplitudeOnly = false): number {
    const main = this.mainRapidsShare(x, z); if (main <= 0) return 0;
    const f0 = this.flow(0, x, z, this.f0);
    const speed = Math.hypot(f0[0], f0[1]); const depth = Math.max(0, f0[2]);
    const froude = speed / Math.sqrt(9.81 * Math.max(depth, 0.02));
    const forcing = Math.min(1, Math.max(0, this.flow(2, x, z, this.f2)[2]));
    const amp = 0.12 * smooth(0.5, 1.2, froude) * (1 - smooth(0.7, 1.6, depth)) * forcing;
    if (amp <= 0.001) return 0;
    const lam = Math.min(4, Math.max(0.6, 6.2832 * speed * speed / 9.81));
    const l2 = Math.log2(lam / 0.8);
    const k0 = Math.max(0, 1 - Math.abs(l2)); const k1 = Math.max(0, 1 - Math.abs(l2 - 1));
    const k2 = Math.max(0, 1 - Math.abs(l2 - 2)) + (l2 > 2 ? 1 : 0);
    if (k2 <= 0) return 0;
    // The positive envelope selects refinement without testing a random
    // crest's sign or refining quiet owned cells.
    if (amplitudeOnly) return main * amp * k2 / Math.max(0.001, k0 + k1 + k2);
    const dx = speed > 0.03 ? f0[0] / speed : 1; const dz = speed > 0.03 ? f0[1] / speed : 0;
    return main * this.heightScale * amp * k2 / Math.max(0.001, k0 + k1 + k2) * 25.6
      * this.staticAnisoH(x, z, 25.6, 47, dx, dz, 0.4);
  }

  constructor(data: RiverReachData, flowHalf?: readonly [Uint16Array, Uint16Array, Uint16Array]) {
    const { nx, nz, dx, x0, z0 } = data.grid;
    this.nx = nx; this.nz = nz; this.dx = dx; this.x0 = x0; this.z0 = z0;
    // Native views already own these exact texture half arrays. Share them
    // from construction; standalone callers retain their original private,
    // quantized cold snapshot until their first setFlowHalf call.
    const q = (a: Float32Array): Float32Array => Float32Array.from(a, (v) => THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(Math.max(-60000, Math.min(60000, v)))));
    this.t0 = flowHalf ? null : q(data.t0);
    this.t1 = flowHalf ? null : q(data.t1);
    this.t2 = flowHalf ? null : q(data.t2);
    this.surfaceLevels = data.surface;
    if (flowHalf) this.setFlowHalf(flowHalf[0], flowHalf[1], flowHalf[2], data.surface);
    const tex = getRiverNoiseTexture();
    this.noise = tex.image.data as Uint8Array;
    this.N = tex.image.width;
    this.slopeRms = RIVER_TEX_STATS.slopeRms;
    this.heightScale = RIVER_TEX_STATS.heightPerSlope;
  }

  /** A flow map texel, bilinear at (x, z), clamped at the edges (the GPU's linear filter). */
  flow(which: 0 | 1 | 2, x: number, z: number, out: number[]): number[] {
    const fx = Math.min(this.nx - 1, Math.max(0, (x - this.x0) / this.dx - 0.5));
    const fz = Math.min(this.nz - 1, Math.max(0, (z - this.z0) / this.dx - 0.5));
    const i = Math.min(this.nx - 2, Math.floor(fx));
    const j = Math.min(this.nz - 2, Math.floor(fz));
    const tx = fx - i;
    const tz = fz - j;
    if (this.half && RiverSurfaceMirror.halfTable) {
      const hA = this.half[which];
      const T = RiverSurfaceMirror.halfTable;
      for (let c = 0; c < 4; c += 1) {
        const p00 = T[hA[(j * this.nx + i) * 4 + c]];
        const p10 = T[hA[(j * this.nx + i + 1) * 4 + c]];
        const p01 = T[hA[((j + 1) * this.nx + i) * 4 + c]];
        const p11 = T[hA[((j + 1) * this.nx + i + 1) * 4 + c]];
        out[c] = (p00 * (1 - tx) + p10 * tx) * (1 - tz) + (p01 * (1 - tx) + p11 * tx) * tz;
      }
      return out;
    }
    // Before half flow is installed, construction owns all three cold maps.
    const a = (which === 0 ? this.t0 : which === 1 ? this.t1 : this.t2)!;
    for (let c = 0; c < 4; c += 1) {
      const p00 = a[(j * this.nx + i) * 4 + c];
      const p10 = a[(j * this.nx + i + 1) * 4 + c];
      const p01 = a[((j + 1) * this.nx + i) * 4 + c];
      const p11 = a[((j + 1) * this.nx + i + 1) * 4 + c];
      out[c] = (p00 * (1 - tx) + p10 * tx) * (1 - tz) + (p01 * (1 - tx) + p11 * tx) * tz;
    }
    return out;
  }

  private readonly f0 = [0, 0, 0, 0];
  private readonly f1 = [0, 0, 0, 0];
  private readonly f2 = [0, 0, 0, 0];

  velocity(x: number, z: number, out: [number, number]): void {
    this.flow(0, x, z, this.f0);
    out[0] = this.f0[0];
    out[1] = this.f0[1];
  }

  depth(x: number, z: number): number {
    return this.flow(0, x, z, this.f0)[2];
  }

  /** The drawn water sheet's height at (x, z) (its vertices sit at the cell centers), m, or NaN on dry ground. */
  sheetAt(x: number, z: number): number {
    const fx = Math.min(this.nx - 1, Math.max(0, (x - this.x0) / this.dx - 0.5));
    const fz = Math.min(this.nz - 1, Math.max(0, (z - this.z0) / this.dx - 0.5));
    const i = Math.min(this.nx - 2, Math.floor(fx));
    const j = Math.min(this.nz - 2, Math.floor(fz));
    const tx = fx - i;
    const tz = fz - j;
    const S = this.surfaceLevels;
    let sum = 0;
    let w = 0;
    const add = (ii: number, jj: number, ww: number): void => {
      const v = S[jj * this.nx + ii];
      if (!Number.isNaN(v) && ww > 0) { sum += v * ww; w += ww; }
    };
    add(i, j, (1 - tx) * (1 - tz));
    add(i + 1, j, tx * (1 - tz));
    add(i, j + 1, (1 - tx) * tz);
    add(i + 1, j + 1, tx * tz);
    return w > 0 ? sum / w : NaN;
  }

  /** The noise texture at level 0, bilinear with repeat, as [-1, 1] (RGB). */
  private tex(qx: number, qy: number, out: V3): V3 {
    const N = this.N;
    const x = qx * N - 0.5;
    const y = qy * N - 0.5;
    const xf = Math.floor(x);
    const yf = Math.floor(y);
    const tx = x - xf;
    const ty = y - yf;
    const i0 = ((xf % N) + N) % N;
    const j0 = ((yf % N) + N) % N;
    const i1 = (i0 + 1) % N;
    const j1 = (j0 + 1) % N;
    const d = this.noise;
    for (let c = 0; c < 3; c += 1) {
      const a = d[(j0 * N + i0) * 4 + c];
      const b = d[(j0 * N + i1) * 4 + c];
      const e = d[(j1 * N + i0) * 4 + c];
      const f = d[(j1 * N + i1) * 4 + c];
      const v = ((a * (1 - tx) + b * tx) * (1 - ty) + (e * (1 - tx) + f * tx) * ty) / 255;
      out[c] = v * 2 - 1;
    }
    return out;
  }

  private static hash(n: number): [number, number] {
    return [fract(n * 0.7548776662 + 0.1234), fract(n * 0.5698402910 + 0.5678)];
  }

  private phases(t: number, off: number): { p0: number; p1: number; w0: number; w1: number; c0: number; c1: number } {
    const tt = t / this.cycle + off;
    const p0 = fract(tt);
    const p1 = fract(tt + 0.5);
    const w0 = 1 - Math.abs(2 * p0 - 1);
    return { p0, p1, w0, w1: 1 - w0, c0: Math.floor(tt), c1: Math.floor(tt + 0.5) };
  }

  private readonly s0: V3 = [0, 0, 0];
  private readonly s1: V3 = [0, 0, 0];

  private blend(a: V3, b: V3, w0: number, w1: number): V3 {
    const k = 1 / Math.sqrt(w0 * w0 + w1 * w1);
    return [(a[0] * w0 + b[0] * w1) * k, (a[1] * w0 + b[1] * w1) * k, (a[2] * w0 + b[2] * w1) * k];
  }

  private advectNoise(x: number, z: number, vx: number, vz: number, tile: number, off: number, seed: number, t: number): V3 {
    const ph = this.phases(t, off);
    const h0 = RiverSurfaceMirror.hash(ph.c0 + seed);
    const h1 = RiverSurfaceMirror.hash(ph.c1 + seed + 17);
    const a = (ph.p0 - 0.5) * this.cycle;
    const b = (ph.p1 - 0.5) * this.cycle;
    this.tex((x - vx * a) / tile + h0[0], (z - vz * a) / tile + h0[1], this.s0);
    this.tex((x - vx * b) / tile + h1[0], (z - vz * b) / tile + h1[1], this.s1);
    return this.blend(this.s0, this.s1, ph.w0, ph.w1);
  }

  private anisoOne(x: number, z: number, vx: number, vz: number, tile: number, off: number, seed: number, bi: number, stretch: number, t: number): V3 {
    const th = bi * 0.39269908;
    const axx = Math.cos(th);
    const axz = Math.sin(th);
    const ayx = -axz;
    const ayz = axx;
    const qx = (x * axx + z * axz) / stretch;
    const qy = x * ayx + z * ayz;
    const vqx = (vx * axx + vz * axz) / stretch;
    const vqy = vx * ayx + vz * ayz;
    const ph = this.phases(t, off);
    const sd = seed + bi * 7;
    const h0 = RiverSurfaceMirror.hash(ph.c0 + sd);
    const h1 = RiverSurfaceMirror.hash(ph.c1 + sd + 17);
    const a = (ph.p0 - 0.5) * this.cycle;
    const b = (ph.p1 - 0.5) * this.cycle;
    this.tex((qx - vqx * a) / tile + h0[0], (qy - vqy * a) / tile + h0[1], this.s0);
    this.tex((qx - vqx * b) / tile + h1[0], (qy - vqy * b) / tile + h1[1], this.s1);
    const nz = this.blend(this.s0, this.s1, ph.w0, ph.w1);
    return [axx * (nz[0] / stretch) + ayx * nz[1], axz * (nz[0] / stretch) + ayz * nz[1], nz[2]];
  }

  private advectAniso(x: number, z: number, vx: number, vz: number, tile: number, off: number, seed: number, dx: number, dz: number, sMax: number, wS: number, t: number): V3 {
    const iso = this.advectNoise(x, z, vx, vz, tile, off, seed + 101, t);
    if (wS < 0.002) return iso;
    let ang = Math.atan2(dz, dx);
    if (ang < 0) ang += 3.14159265;
    const fb = ang / 0.39269908;
    const b0 = Math.floor(fb);
    const f = fb - b0;
    const bA = b0 % 8;
    const bB = (b0 + 1) % 8;
    const A = this.anisoOne(x, z, vx, vz, tile, off, seed, bA, sMax, t);
    const B = this.anisoOne(x, z, vx, vz, tile, off, seed, bB, sMax, t);
    const wA = 1 - f;
    const wB = f;
    const k = 1 / Math.sqrt(wA * wA + wB * wB);
    const keep = Math.sqrt(2 / (1 + 1 / (sMax * sMax)));
    const an: V3 = [(A[0] * wA + B[0] * wB) * k * keep, (A[1] * wA + B[1] * wB) * k * keep, (A[2] * wA + B[2] * wB) * k];
    const wI = 1 - wS;
    const kk = 1 / Math.sqrt(wI * wI + wS * wS);
    return [(iso[0] * wI + an[0] * wS) * kk, (iso[1] * wI + an[1] * wS) * kk, (iso[2] * wI + an[2] * wS) * kk];
  }

  private staticAnisoH(x: number, z: number, tile: number, seed: number, dx: number, dz: number, stretch: number): number {
    let ang = Math.atan2(dz, dx);
    if (ang < 0) ang += 3.14159265;
    const fb = ang / 0.39269908;
    const b0 = Math.floor(fb);
    const f = fb - b0;
    let h = 0;
    let w2 = 0;
    for (let k = 0; k < 2; k += 1) {
      const bi = (b0 + k) % 8;
      const th = bi * 0.39269908;
      const axx = Math.cos(th);
      const axz = Math.sin(th);
      const w = k === 0 ? 1 - f : f;
      const hh = RiverSurfaceMirror.hash(seed + bi);
      this.tex(((x * axx + z * axz) / stretch) / tile + hh[0], (x * -axz + z * axx) / tile + hh[1], this.s0);
      h += this.s0[2] * w;
      w2 += w * w;
    }
    return h / Math.sqrt(w2);
  }

  /**
   * THE SURFACE HEIGHT over the flow map's level at (x, z) and time t, m: the
   * shader's `hWaves` (see the file header).
   */
  heightAt(x: number, z: number, t: number): number {
    const f0 = this.flow(0, x, z, this.f0);
    const f1 = this.flow(1, x, z, this.f1);
    const f2 = this.flow(2, x, z, this.f2);
    const vx = f0[0];
    const vz = f0[1];
    const depth = Math.max(f0[2], 0);
    const speed = Math.hypot(vx, vz);
    const turbF = Math.min(1, Math.max(0, f1[3]));
    const froude = speed / Math.sqrt(9.81 * Math.max(depth, 0.02));
    const dx = speed > 0.03 ? vx / speed : 1;
    const dz = speed > 0.03 ? vz / speed : 0;
    const main = this.mainRapidsShare(x, z);
    const mainForcing = Math.min(1, Math.max(0, f2[2]));
    const mainMicroSlope = Math.min(0.10, Math.max(0, f2[3]));
    let rgh = Math.max(turbF, 0.7 * smooth(0.6, 1.7, speed));
    rgh = Math.max(rgh, 0.6 * smooth(0.3, 0.8, froude) * smooth(0.02, 0.08, depth));
    rgh = mix(rgh, Math.min(1, Math.hypot(mainMicroSlope, mainForcing * 0.16) / 0.26), main);
    // Zero flow/turbulence excitation supplies no continual ripple source.
    // Legacy maximum slopes remain fixed; intermediate slopes lose their
    // calm contribution. Main-channel micro/forcing terms lose their old
    // offsets too. Separate arriving-impact waves remain enabled.
    let rmsA = 0.10 * rgh;
    let rmsB = 0.26 * rgh;
    let rmsC = 0.06 * rgh;
    const wA = smooth(0.3, 1.5, speed);
    const wB = smooth(0.4, 2.0, speed);
    const rA = this.advectAniso(x, z, vx, vz, 1.6, 0, 3, dx, dz, 2, wA, t);
    let rB = this.advectAniso(x, z, vx, vz, 5.5, 0.25, 11, dx, dz, 3, wB, t);
    const rC = this.advectNoise(x, z, vx, vz, 18, 0.5, 23, t);
    let rB2 = this.advectNoise(x, z, vx, vz, 3.7, 0.4, 31, t);
    if (main > 0) {
      // Match the shader's physical micro-ripple and local forcing fields;
      // the tile ratios preserve slope/height units in the existing sum.
      const excitation = mainForcing;
      rmsA = mix(rmsA, Math.hypot(mainMicroSlope, excitation * 0.065), main);
      rmsB = mix(rmsB, 0.16 * excitation, main);
      rmsC = mix(rmsC, 0.028 * excitation, main);
      const direction = smooth(0.05, 0.4, speed);
      const b = this.advectAniso(x, z, vx, vz, 2.8, 0.25, 11, dx, dz, 3, direction, t);
      const b2 = this.advectAniso(x, z, vx, vz, 1.7, 0.4, 31, dx, dz, 2.5, direction, t);
      rB = [mix(rB[0], b[0], main), mix(rB[1], b[1], main), mix(rB[2], b[2] * 2.8 / 5.5, main)];
      rB2 = [mix(rB2[0], b2[0], main), mix(rB2[1], b2[1], main), mix(rB2[2], b2[2] * 1.7 / 3.7, main)];
    }
    const lam = Math.min(4, Math.max(0.6, (6.2832 * speed * speed) / 9.81));
    const swAmp = 0.12 * smooth(0.5, 1.2, froude) * (1 - smooth(0.7, 1.6, depth)) * mix(1, mainForcing, main);
    let swH = 0;
    if (swAmp > 0.001) {
      const l2 = Math.log2(lam / 0.8);
      const k0 = Math.max(0, 1 - Math.abs(l2));
      const k1 = Math.max(0, 1 - Math.abs(l2 - 1));
      const k2 = Math.max(0, 1 - Math.abs(l2 - 2)) + (l2 > 2 ? 1 : 0);
      const ks = Math.max(0.001, k0 + k1 + k2);
      const h0 = this.staticAnisoH(x, z, 6.4, 41, dx, dz, 0.4);
      const h1 = this.staticAnisoH(x, z, 12.8, 43, dx, dz, 0.4);
      const h2 = this.staticAnisoH(x, z, 25.6, 47, dx, dz, 0.4);
      swH = (h0 * k0 * 6.4 + h1 * k1 * 12.8 + h2 * k2 * 25.6) / ks;
    }
    return ((rA[2] * rmsA * 1.6 + (rB[2] * 0.6 * 5.5 + rB2[2] * 0.8 * 3.7) * rmsB + rC[2] * rmsC * 18) / this.slopeRms
      + swH * swAmp) * this.heightScale + f2[0]
      + this.poolImpactHeightAt(x, z, this.sheetAt(x, z), t);
  }

  /** The drawn surface at (x, z, t): the sheet plus the waves, m (NaN on dry ground). */
  surfaceAt(x: number, z: number, t: number): number {
    const pool = this.poolSurfaceAt(x, z, t);
    if (pool !== null) return pool;
    const standing = this.standingSurfaceAt(x, z);
    if (standing !== null) return standing;
    const s = this.sheetAt(x, z);
    return Number.isNaN(s) ? s : s + this.heightAt(x, z, t);
  }
}
