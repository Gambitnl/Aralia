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
import * as THREE from 'three';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import type { FloaterWaterSampler } from '@/systems/world3d/river/riverFloaters';
import { getRiverNoiseTexture, RIVER_TEX_STATS } from './riverWaterMaterial';

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
  private readonly t0: Float32Array;
  private readonly t1: Float32Array;
  private readonly t2: Float32Array;
  private surface: Float32Array;
  /**
   * THE LIVE RIVER (2026-09-29): the flow map as the half floats the textures
   * hold, read through a table of their float values (the same values the
   * quantized arrays above hold), so a new flow map a few times a second
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
    this.surface = surface;
  }
  private readonly noise: Uint8Array;
  private readonly N: number;
  private readonly slopeRms: number;
  private readonly heightScale: number;
  private readonly cycle = 1.0;

  constructor(data: RiverReachData) {
    const { nx, nz, dx, x0, z0 } = data.grid;
    this.nx = nx; this.nz = nz; this.dx = dx; this.x0 = x0; this.z0 = z0;
    // The textures are half floats: quantize the same way.
    const q = (a: Float32Array): Float32Array => Float32Array.from(a, (v) => THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(Math.max(-60000, Math.min(60000, v)))));
    this.t0 = q(data.t0);
    this.t1 = q(data.t1);
    this.t2 = q(data.t2);
    this.surface = data.surface;
    const tex = getRiverNoiseTexture();
    this.noise = tex.image.data as Uint8Array;
    this.N = tex.image.width;
    this.slopeRms = RIVER_TEX_STATS.slopeRms;
    this.heightScale = RIVER_TEX_STATS.heightPerSlope;
  }

  /** A flow map texel, bilinear at (x, z), clamped at the edges (the GPU's linear filter). */
  flow(which: 0 | 1 | 2, x: number, z: number, out: number[]): number[] {
    const a = which === 0 ? this.t0 : which === 1 ? this.t1 : this.t2;
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
    const S = this.surface;
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
    let rgh = Math.max(turbF, 0.7 * smooth(0.6, 1.7, speed));
    rgh = Math.max(rgh, 0.6 * smooth(0.3, 0.8, froude) * smooth(0.02, 0.08, depth));
    const rmsA = mix(0.004, 0.10, rgh);
    const rmsB = mix(0.004, 0.26, rgh);
    const rmsC = mix(0.008, 0.06, rgh);
    const wA = smooth(0.3, 1.5, speed);
    const wB = smooth(0.4, 2.0, speed);
    const rA = this.advectAniso(x, z, vx, vz, 1.6, 0, 3, dx, dz, 2, wA, t);
    const rB = this.advectAniso(x, z, vx, vz, 5.5, 0.25, 11, dx, dz, 3, wB, t);
    const rC = this.advectNoise(x, z, vx, vz, 18, 0.5, 23, t);
    const rB2 = this.advectNoise(x, z, vx, vz, 3.7, 0.4, 31, t);
    const lam = Math.min(4, Math.max(0.6, (6.2832 * speed * speed) / 9.81));
    const swAmp = 0.12 * smooth(0.5, 1.2, froude) * (1 - smooth(0.7, 1.6, depth));
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
      + swH * swAmp) * this.heightScale + f2[0];
  }

  /** The drawn surface at (x, z, t): the sheet plus the waves, m (NaN on dry ground). */
  surfaceAt(x: number, z: number, t: number): number {
    const s = this.sheetAt(x, z);
    return Number.isNaN(s) ? s : s + this.heightAt(x, z, t);
  }
}
