/**
 * Isolated measured-rock albedo experiment. Random offsets select portions
 * of the existing scan; they never generate rock colors. Histogram-preserving
 * blending retains the scan's contrast between shared triangular patches.
 * No production material calls this helper yet. Normals remain in their owner.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 05/10/2026, 08:07:47
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { Fn, dFdx, dFdy, float, int, max, select, texture, uint, vec2, vec3 } from 'three/tsl';

export interface RockHistogram {
  width: number; height: number; tileMeters: number; lutSize: number; gaussianLimit: number;
  /** Linear RGB origin and orthonormal color directions. */
  origin: readonly number[]; basis: readonly (readonly number[])[];
  /** RGBA Float32, numerical scan transform only. Fourth component is unused. */
  gaussian: Float32Array; inverse: Float32Array;
  approximation: string;
}
export interface RockMipFiltering {
  levels: number;
  gaussianMips: Array<{ data: Float32Array; width: number; height: number }>;
  inverseRows: Float32Array;
  variances: number[][];
  quadratureSamples: number;
}
const srgbLinear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const gaussianCdf = (x: number) => {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + (x < 0 ? -erf : erf));
};
// Acklam's rational inverse normal CDF. Finite empirical mid-ranks avoid
// infinite tails; the texture/LUT range is recorded rather than hidden.
function gaussianQuantile(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p < 0.02425 || p > 0.97575) {
    const q = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
    const result = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return p < 0.5 ? result : -result;
  }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);

/** Prepare decorrelated empirical histograms from the original decoded scan.
 * The inverse LUT contains actual measured color components, not a palette.
 * Base-level bilinear parity is the first proof; mip/anisotropic LUT
 * prefiltering remains required before this can replace a production map. */
export function prepareRockHistogram(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number,
  options: { bins?: number; lutSize?: number; tileMeters?: number; gaussianLimit?: number } = {}): RockHistogram {
  const bins = options.bins ?? 4096, lutSize = options.lutSize ?? 4096, tileMeters = options.tileMeters ?? 1.5, gaussianLimit = options.gaussianLimit ?? 5;
  if (![width, height, bins, lutSize].every(v => Number.isInteger(v) && v > 1) || rgba.length !== width * height * 4
    || !Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(gaussianLimit) || gaussianLimit <= 0) throw new Error('Invalid rock histogram input');
  const count = width * height, rgb = new Float32Array(count * 3), origin = [0, 0, 0];
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) { const v = srgbLinear(rgba[i * 4 + c] / 255); rgb[i * 3 + c] = v; origin[c] += v / count; }
  const covariance = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < count; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) covariance[a][b] += (rgb[i * 3 + a] - origin[a]) * (rgb[i * 3 + b] - origin[b]) / count;
  const eigenvectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 32; iteration++) {
    let p = 0, q = 1;
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(covariance[a][b]) > Math.abs(covariance[p][q])) { p = a; q = b; }
    if (Math.abs(covariance[p][q]) < 1e-15) break;
    const angle = 0.5 * Math.atan2(2 * covariance[p][q], covariance[q][q] - covariance[p][p]), cs = Math.cos(angle), sn = Math.sin(angle);
    const rotation = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; rotation[p][p] = cs; rotation[q][q] = cs; rotation[p][q] = sn; rotation[q][p] = -sn;
    const rotated = covariance.map(row => row.map((_, b) => dot(row, rotation.map(r => r[b]))));
    const next = covariance.map((_, a) => covariance.map((_, b) => dot(rotation.map(r => r[a]), rotated.map(r => r[b]))));
    const vectors = eigenvectors.map(row => row.map((_, b) => dot(row, rotation.map(r => r[b]))));
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { covariance[a][b] = next[a][b]; eigenvectors[a][b] = vectors[a][b]; }
  }
  const basis = [0, 1, 2].sort((a, b) => covariance[b][b] - covariance[a][a]).map(c => eigenvectors.map(row => row[c]));
  const gaussian = new Float32Array(count * 4), inverse = new Float32Array(lutSize * 4);
  for (let channel = 0; channel < 3; channel++) {
    const projected = new Float32Array(count); let minimum = Infinity, maximum = -Infinity;
    for (let i = 0; i < count; i++) { const value = dot(basis[channel], [rgb[i * 3] - origin[0], rgb[i * 3 + 1] - origin[1], rgb[i * 3 + 2] - origin[2]]); projected[i] = value; minimum = Math.min(minimum, projected[i]); maximum = Math.max(maximum, projected[i]); }
    if (maximum - minimum < 1e-10) { for (let i = 0; i < lutSize; i++) inverse[i * 4 + channel] = (minimum + maximum) / 2; continue; }
    const counts = new Uint32Array(bins), sums = new Float64Array(bins), ids = new Uint32Array(count), mid = new Float64Array(bins), values = new Float64Array(bins);
    for (let i = 0; i < count; i++) { const bin = Math.max(0, Math.min(bins - 1, Math.floor((projected[i] - minimum) / (maximum - minimum) * bins))); ids[i] = bin; counts[bin]++; sums[bin] += projected[i]; }
    const occupied: number[] = []; let accumulated = 0;
    for (let bin = 0; bin < bins; bin++) if (counts[bin]) { mid[bin] = (accumulated + counts[bin] / 2) / count; values[bin] = sums[bin] / counts[bin]; accumulated += counts[bin]; occupied.push(bin); }
    for (let i = 0; i < count; i++) gaussian[i * 4 + channel] = Math.max(-gaussianLimit, Math.min(gaussianLimit, gaussianQuantile(mid[ids[i]])));
    let right = 0;
    for (let i = 0; i < lutSize; i++) {
      const probability = gaussianCdf((i / (lutSize - 1) * 2 - 1) * gaussianLimit);
      while (right < occupied.length - 1 && mid[occupied[right]] < probability) right++;
      const a = occupied[Math.max(0, right - 1)], b = occupied[right], t = a === b ? 0 : Math.max(0, Math.min(1, (probability - mid[a]) / (mid[b] - mid[a])));
      inverse[i * 4 + channel] = values[a] * (1 - t) + values[b] * t;
    }
  }
  // RGBA16F supports native linear filtering without the optional
  // float32-filterable device feature. The CPU oracle uses the same rounded
  // values, rather than retaining precision the GPU texture does not contain.
  for (const field of [gaussian, inverse]) for (let i = 0; i < field.length; i++) field[i] = THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(field[i]));
  return { width, height, tileMeters, lutSize, gaussianLimit, origin, basis, gaussian, inverse,
    approximation: `${bins}-bin PCA marginal histograms; ${lutSize}-entry inverse LUT; RGBA16F-rounded values; Gaussian tails clamped at ${gaussianLimit}; base-level bilinear only; patch correlations and mip prefiltering not accepted` };
}

/** Integer hashes are reproducible across CPU and WGSL; sine hashes are not. */
export function rockCornerHash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const offset = (x: number, y: number) => [rockCornerHash(x, y, 0x68bc21eb) >>> 16, rockCornerHash(x, y, 0x02e5be93) >>> 16].map(v => v / 65536);
export function rockPatchCoordinates(xMeters: number, yMeters: number, tileMeters = 1.5) {
  const x = xMeters / tileMeters, y = yMeters / tileMeters, sx = x - y / Math.sqrt(3), sy = y * 2 / Math.sqrt(3), ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy, upper = fx + fy > 1;
  const corners = [[ix + Number(upper), iy + Number(upper)], [ix + 1, iy], [ix, iy + 1]];
  const weights = upper ? [fx + fy - 1, 1 - fy, 1 - fx] : [1 - fx - fy, fx, fy];
  return { weights, uv: corners.map(([cx, cy]) => { const o = offset(cx, cy); return [x + o[0], y + o[1]]; }) };
}
function pixel(field: Float32Array, width: number, height: number, u: number, v: number): number[] {
  // Match normalized float texture coordinates, including the shader's flip.
  // A double UV can differ by a fraction of a texel on the 2K scan far from zero.
  const x = f32(f32(u * width) - 0.5), y = f32(f32(f32(1 - v) * height) - 0.5), ix = Math.floor(x), iy = Math.floor(y), fx = f32(x - ix), fy = f32(y - iy), result = [0, 0, 0];
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const wrap = (n: number, size: number) => ((n % size) + size) % size, index = (wrap(iy + dy, height) * width + wrap(ix + dx, width)) * 4;
    const weight = f32((dx ? fx : f32(1 - fx)) * (dy ? fy : f32(1 - fy))); for (let c = 0; c < 3; c++) result[c] = f32(result[c] + f32(field[index + c] * weight));
  }
  return result;
}
export function reconstructRockHistogram(data: RockHistogram, gaussian: readonly number[]): number[] {
  const components = gaussian.map((g, c) => {
    const x = Math.max(0, Math.min(data.lutSize - 1, (g / data.gaussianLimit + 1) * 0.5 * (data.lutSize - 1))), lo = Math.floor(x), hi = Math.min(data.lutSize - 1, lo + 1), t = x - lo;
    return data.inverse[lo * 4 + c] * (1 - t) + data.inverse[hi * 4 + c] * t;
  });
  return data.origin.map((v, c) => v + components.reduce((sum, component, k) => sum + component * data.basis[k][c], 0));
}
export function sampleRockStochasticCpu(data: RockHistogram, xMeters: number, yMeters: number, filtering?: RockMipFiltering, explicitLod = 0): number[] {
  const lod = filtering ? f32(Math.max(0, Math.min(filtering.levels - 1, explicitLod))) : 0;
  const lower = Math.floor(lod), upper = filtering ? Math.min(filtering.levels - 1, lower + 1) : 0, fraction = f32(lod - lower);
  const patches = rockPatchCoordinatesFloat32(xMeters, yMeters, data.tileMeters), values = patches.uv.map(([u, v]) => {
    if (!filtering) return pixel(data.gaussian, data.width, data.height, u, v);
    const a = filtering.gaussianMips[lower], b = filtering.gaussianMips[upper];
    const av = pixel(a.data, a.width, a.height, u, v), bv = pixel(b.data, b.width, b.height, u, v);
    return av.map((v, c) => f32(f32(v * f32(1 - fraction)) + f32(bv[c] * fraction)));
  });
  const w = patches.weights, norm = f32(Math.sqrt(f32(f32(f32(w[0] * w[0]) + f32(w[1] * w[1])) + f32(w[2] * w[2]))));
  const g = [0, 1, 2].map(c => f32(f32(f32(f32(values[0][c] * w[0]) + f32(values[1][c] * w[1])) + f32(values[2][c] * w[2])) / norm));
  const components = g.map((channel, c) => {
    // Follow the shader's normalized LUT coordinate before converting back
    // to a texel; bypassing that round trip grants the CPU extra precision.
    const unit = Math.max(0, Math.min(1, f32(f32(f32(channel / f32(data.gaussianLimit)) + 1) * 0.5)));
    const uv = f32(f32(f32(unit * (data.lutSize - 1)) + 0.5) / data.lutSize);
    const x = f32(f32(uv * data.lutSize) - 0.5), lo = Math.floor(x), t = f32(x - lo);
    const field = filtering?.inverseRows ?? data.inverse;
    const rowAt = (row: number) => {
      const a = field[(row * data.lutSize + Math.max(0, Math.min(data.lutSize - 1, lo))) * 4 + c];
      const b = field[(row * data.lutSize + Math.max(0, Math.min(data.lutSize - 1, lo + 1))) * 4 + c];
      return f32(f32(a * f32(1 - t)) + f32(b * t));
    };
    if (!filtering) return rowAt(0);
    const rowY = f32(f32(f32(f32(lod + 0.5) / filtering.levels) * filtering.levels) - 0.5);
    const row0 = Math.floor(rowY), fy = f32(rowY - row0);
    const a = rowAt(Math.max(0, Math.min(filtering.levels - 1, row0))), b = rowAt(Math.max(0, Math.min(filtering.levels - 1, row0 + 1)));
    return f32(f32(a * f32(1 - fy)) + f32(b * fy));
  });
  return data.origin.map((v, c) => f32(f32(f32(f32(v) + f32(f32(data.basis[0][c]) * components[0])) + f32(f32(data.basis[1][c]) * components[1])) + f32(f32(data.basis[2][c]) * components[2])));
}
const f32 = Math.fround;
/** GPU-ordered coordinate oracle. The double-precision helper above remains
 * useful for mathematical histogram tests; renderer parity uses Float32. */
export function rockPatchCoordinatesFloat32(xMeters: number, yMeters: number, tileMeters = 1.5) {
  const x = f32(f32(xMeters) / f32(tileMeters)), y = f32(f32(yMeters) / f32(tileMeters));
  const sx = f32(x - f32(y / f32(Math.sqrt(3)))), sy = f32(y * f32(2 / Math.sqrt(3)));
  const ix = Math.floor(sx), iy = Math.floor(sy), fx = f32(sx - ix), fy = f32(sy - iy), sum = f32(fx + fy), upper = sum > 1;
  const corners = [[ix + Number(upper), iy + Number(upper)], [ix + 1, iy], [ix, iy + 1]];
  const weights = upper ? [f32(sum - 1), f32(1 - fy), f32(1 - fx)] : [f32(f32(1 - fx) - fy), fx, fy];
  return { weights, uv: corners.map(([cx, cy]) => { const o = offset(cx, cy); return [f32(x + o[0]), f32(y + o[1])]; }) };
}
export function blendRockGaussian(values: readonly (readonly number[])[], weights: readonly number[]): number[] {
  const normalization = Math.sqrt(weights.reduce((sum, w) => sum + w * w, 0));
  return [0, 1, 2].map(c => values.reduce((sum, v, i) => sum + weights[i] * v[c], 0) / normalization);
}

/** Authors' averaged subpixel-variance approximation, using the measured scan.
 * LUT rows integrate the nonlinear inverse over a Gaussian residual, rather
 * than applying the original inverse directly to an averaged Gaussian texel.
 * Patch correlations and changing barycentric weights within a pixel remain
 * approximations; this is an opt-in filtering experiment. */
export function prepareRockMipFiltering(data: RockHistogram, quadratureSamples = 256): RockMipFiltering {
  if (data.width !== data.height || !Number.isInteger(Math.log2(data.width)) || data.width < 2
    || !Number.isInteger(quadratureSamples) || quadratureSamples < 2 || quadratureSamples > 1024) throw new Error('Rock filtering requires a square power-of-two scan and 2–1024 quadrature samples');
  const levels = Math.log2(data.width) + 1;
  const gaussianMips = [{ data: data.gaussian, width: data.width, height: data.height }];
  const meanSquare = [0, 0, 0], variances = [[0, 0, 0]];
  for (let i = 0; i < data.width * data.height; i++) for (let c = 0; c < 3; c++) meanSquare[c] += data.gaussian[i * 4 + c] ** 2 / (data.width * data.height);
  for (let level = 1; level < levels; level++) {
    const previous = gaussianMips[level - 1], side = previous.width / 2, field = new Float32Array(side * side * 4), blockMeanSquare = [0, 0, 0];
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sum += previous.data[((2 * y + dy) * previous.width + 2 * x + dx) * 4 + c];
      const value = sum / 4;
      field[(y * side + x) * 4 + c] = value;
      blockMeanSquare[c] += value * value / (side * side);
    }
    gaussianMips.push({ data: field, width: side, height: side });
    variances.push(meanSquare.map((v, c) => Math.max(0, v - blockMeanSquare[c])));
  }
  const inverseRows = new Float32Array(data.lutSize * levels * 4);
  inverseRows.set(data.inverse);
  const quantiles = Array.from({ length: quadratureSamples }, (_, i) => gaussianQuantile((i + 0.5) / quadratureSamples));
  for (let level = 1; level < levels; level++) for (let c = 0; c < 3; c++) {
    const std = Math.sqrt(variances[level][c]);
    for (let i = 0; i < data.lutSize; i++) {
      const center = (i / (data.lutSize - 1) * 2 - 1) * data.gaussianLimit;
      let sum = 0;
      for (const q of quantiles) {
        const x = Math.max(0, Math.min(data.lutSize - 1, ((center + std * q) / data.gaussianLimit + 1) * 0.5 * (data.lutSize - 1)));
        const lo = Math.floor(x), hi = Math.min(data.lutSize - 1, lo + 1), t = x - lo;
        sum += data.inverse[lo * 4 + c] * (1 - t) + data.inverse[hi * 4 + c] * t;
      }
      inverseRows[(level * data.lutSize + i) * 4 + c] = THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(sum / quadratureSamples));
    }
  }
  // WebGPU generates each RGBA16F mip from the previous rounded mip. Keep
  // that chain for the oracle after measuring the unrounded block moments.
  for (let level = 1; level < levels; level++) {
    const previous = gaussianMips[level - 1], mip = gaussianMips[level];
    for (let y = 0; y < mip.height; y++) for (let x = 0; x < mip.width; x++) for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sum += previous.data[((2 * y + dy) * previous.width + 2 * x + dx) * 4 + c];
      mip.data[(y * mip.width + x) * 4 + c] = THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(sum / 4));
    }
  }
  return { levels, gaussianMips, inverseRows, variances, quadratureSamples };
}

/** Numerical textures use linear components, explicit LOD zero and no mipmap
 * generation. These settings make the CPU bilinear oracle reproducible;
 * they are a bounded proof restriction, not a distance-filtering solution. */
export function createRockHistogramTextures(data: RockHistogram, filtering?: RockMipFiltering) {
  const half = (field: Float32Array) => Uint16Array.from(field, THREE.DataUtils.toHalfFloat);
  const gaussian = new THREE.DataTexture(half(data.gaussian), data.width, data.height, THREE.RGBAFormat, THREE.HalfFloatType);
  const inverse = new THREE.DataTexture(half(filtering?.inverseRows ?? data.inverse), data.lutSize, filtering?.levels ?? 1, THREE.RGBAFormat, THREE.HalfFloatType);
  for (const map of [gaussian, inverse]) { map.colorSpace = THREE.NoColorSpace; map.magFilter = map.minFilter = THREE.LinearFilter; map.generateMipmaps = false; map.flipY = false; map.needsUpdate = true; }
  gaussian.wrapS = gaussian.wrapT = THREE.RepeatWrapping;
  if (filtering) {
    // This Three WebGPU backend uploads DataTexture.image at level zero
    // only. A populated manual mip list suppresses native mip generation
    // without uploading those levels, so use its native generation path.
    gaussian.generateMipmaps = true;
    gaussian.minFilter = THREE.LinearMipmapLinearFilter;
  }
  return { gaussian, inverse, filtering };
}
/** Full uint output for an independent GPU hash readback, before UV reduction. */
export function rockCornerHashTsl(corner: THREE.Node, seed: number): THREE.Node {
  return rockHashFunction(corner, uint(seed));
}
const rockHashFunction = Fn(([corner, seed]: [THREE.Node, THREE.Node]) => {
  const h0 = uint(int(corner.x)).mul(uint(0x8da6b343)).bitXor(uint(int(corner.y)).mul(uint(0xd8163841))).bitXor(seed).toVar();
  const h1 = h0.bitXor(h0.shiftRight(uint(16))).mul(uint(0x7feb352d)).toVar();
  const h2 = h1.bitXor(h1.shiftRight(uint(15))).mul(uint(0x846ca68b)).toVar();
  return h2.bitXor(h2.shiftRight(uint(16)));
}).setLayout({ name: 'riverRockCornerHash', type: 'uint', inputs: [{ name: 'corner', type: 'vec2' }, { name: 'seed', type: 'uint' }] });

let samplerSerial = 0;
const makeRockSampler = (data: RockHistogram, maps: ReturnType<typeof createRockHistogramTextures>) => Fn(([worldPlane, lodInput]: [THREE.Node, THREE.Node]) => {
  // Keep texture samples and hash rounds in local variables. Reusing their
  // expression trees in each PCA channel otherwise multiplies generated code.
  const p = worldPlane.div(data.tileMeters).toVar();
  const lod = lodInput.toVar();
  const skew = vec2(p.x.sub(p.y.div(Math.sqrt(3))), p.y.mul(2 / Math.sqrt(3))).toVar();
  const cell = skew.floor().toVar(), f = skew.fract().toVar(), upper = f.x.add(f.y).greaterThan(1).toVar();
  const corners = [cell.add(select(upper, vec2(1, 1), vec2(0, 0))), cell.add(vec2(1, 0)), cell.add(vec2(0, 1))].map(c => c.toVar());
  const weights = [select(upper, f.x.add(f.y).sub(1), float(1).sub(f.x).sub(f.y)), select(upper, float(1).sub(f.y), f.x), select(upper, float(1).sub(f.x), f.y)].map(w => w.toVar());
  const hash = (corner: THREE.Node, seed: number) => rockCornerHashTsl(corner, seed).shiftRight(uint(16)).toFloat().div(65536);
  const values = corners.map(corner => {
    const uv = p.add(vec2(hash(corner, 0x68bc21eb), hash(corner, 0x02e5be93))).toVar();
    // RGBA numerical storage comes from top-first ImageData; preserve that
    // same vertical convention explicitly in both samplers.
    return texture(maps.gaussian, vec2(uv.x, float(1).sub(uv.y))).level(lod).rgb.toVar();
  });
  const g = values[0].mul(weights[0]).add(values[1].mul(weights[1])).add(values[2].mul(weights[2]))
    .div(weights[0].mul(weights[0]).add(weights[1].mul(weights[1])).add(weights[2].mul(weights[2])).sqrt()).toVar();
  const components = [g.x, g.y, g.z].map((channel, c) => {
    const x = channel.div(data.gaussianLimit).add(1).mul(0.5).clamp(0, 1).mul(data.lutSize - 1).add(0.5).div(data.lutSize);
    const row = maps.filtering ? lod.add(0.5).div(maps.filtering.levels) : float(0.5);
    const sampled = texture(maps.inverse, vec2(x, row)).level(float(0));
    return (c === 0 ? sampled.r : c === 1 ? sampled.g : sampled.b).toVar();
  });
  return vec3(...data.origin).add(vec3(...data.basis[0]).mul(components[0])).add(vec3(...data.basis[1]).mul(components[1])).add(vec3(...data.basis[2]).mul(components[2]));
}).setLayout({ name: `riverRockHistogramSample${samplerSerial++}`, type: 'vec3', inputs: [{ name: 'worldPlane', type: 'vec2' }, { name: 'lodInput', type: 'float' }] });
type RockSamplerMaps = WeakMap<RockHistogram, WeakMap<ReturnType<typeof createRockHistogramTextures>, ReturnType<typeof makeRockSampler>>>;
const rockSamplers = new WeakMap<THREE.NodeBuilder, Map<string, RockSamplerMaps>>();
export function sampleRockStochasticTsl(data: RockHistogram, maps: ReturnType<typeof createRockHistogramTextures>, worldPlane: THREE.Node, explicitLod?: THREE.Node): THREE.Node {
  let lod: THREE.Node = float(0);
  if (maps.filtering) {
    const dx = dFdx(worldPlane).mul(data.width / data.tileMeters), dy = dFdy(worldPlane).mul(data.height / data.tileMeters);
    lod = (explicitLod ?? max(dx.dot(dx), dy.dot(dy)).max(1).log2().mul(0.5)).clamp(0, maps.filtering.levels - 1);
  }
  // A laid-out Fn captures the builder's texture uniform names. Three caches
  // its native function code across builders, so a shared closure compiled in
  // a probe cannot register the cliff material's bindings on a later build.
  // This wrapper has no layout: it selects a fresh texture closure per builder
  // and stage, while each stage's three projections still share one body.
  return Fn(([plane, level]: [THREE.Node, THREE.Node], builder: THREE.NodeBuilder) => {
    let stages = rockSamplers.get(builder);
    if (!stages) { stages = new Map(); rockSamplers.set(builder, stages); }
    const stage = builder.shaderStage ?? 'fragment';
    let perData = stages.get(stage);
    if (!perData) { perData = new WeakMap(); stages.set(stage, perData); }
    let perTexture = perData.get(data);
    if (!perTexture) { perTexture = new WeakMap(); perData.set(data, perTexture); }
    let sample = perTexture.get(maps);
    if (!sample) { sample = makeRockSampler(data, maps); perTexture.set(maps, sample); }
    return sample(plane, level);
  })(worldPlane, lod);
}
