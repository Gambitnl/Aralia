/**
 * @file oceanFftReference.ts — the transform in plain TypeScript.
 *
 * WHY A CPU COPY OF A GPU KERNEL EXISTS
 *
 * vitest has no GPU. A wrong inverse FFT still produces something that moves
 * and still looks wavy, so "it renders" proves nothing. The repo already has
 * the answer to that problem: `fluidGather.ts` mirrors `fluidCompute.ts` in
 * plain TypeScript so vitest can prove conservation without a GPU. This file
 * is the same arrangement for the ocean transform.
 *
 * `oceanFftIndex()` below computes the exact index arithmetic the TSL kernel
 * uses. The kernel mirrors it node for node. A divergence between the two is
 * a bug in the mirror, never a judgment call.
 *
 * THE ALGORITHM: GATHER-FORM STOCKHAM, RADIX 2
 *
 * The textbook Cooley-Tukey butterfly writes TWO outputs per work item:
 *
 *     Y[base]     = a + w*b
 *     Y[base + m] = a - w*b
 *
 * That is a SCATTER, and this project has already paid for scatter once: the
 * first draft of the fluid kernel pushed mass into neighbors and silently
 * lost water to write races. The rule stands. Every kernel here gathers.
 *
 * So the arithmetic is inverted. Given the OUTPUT index o at stage s, with
 * m = 2^s already-transformed sub-size:
 *
 *     k  = o & (m - 1)      // position inside the sub-transform
 *     q2 = o >> s           // which butterfly half, doubled
 *     i  = (q2 >> 1) * m + k
 *     w  = exp(sign * 2*pi*i*k / (2m))
 *     Y[o] = X[i] + (q2 even ? +1 : -1) * w * X[i + N/2]
 *
 * Each work item reads exactly two inputs and writes exactly one output. No
 * two work items share a write address.
 *
 * Stockham is chosen over the in-place decimation-in-time form because it is
 * AUTOSORT: the output comes out in natural order with no bit-reversal
 * permutation pass. That saves a dispatch and, more importantly, saves a
 * scattered read.
 *
 * INTEGER OPS. The index math uses shifts and masks, never `%`. TSL's `.mod()`
 * on integers miscompiles to WGSL silently — a registered project gotcha. The
 * mask `o & (m-1)` is the same thing for powers of two and has no such trap.
 */

/** The two input offsets and the butterfly sign for one output index. */
export interface FftIndexPlan {
  /** Index of the first input sample. */
  readonly a: number;
  /** Index of the second input sample. */
  readonly b: number;
  /** Twiddle angle numerator: the k in exp(sign * 2 pi i k / (2m)). */
  readonly twiddleK: number;
  /** Twiddle denominator, 2m. */
  readonly twiddleDen: number;
  /** +1 on the even half of the butterfly, -1 on the odd half. */
  readonly sign: number;
}

/**
 * The index plan for one output of one Stockham stage.
 *
 * This is THE function the TSL kernel mirrors. Keep them identical.
 *
 * @param o     output index within the transform, 0 .. n-1
 * @param stage stage number s, 0 .. log2(n)-1
 * @param n     transform length, a power of two
 */
export function oceanFftIndex(o: number, stage: number, n: number): FftIndexPlan {
  const m = 1 << stage;
  const half = n >> 1;
  const k = o & (m - 1);
  const q2 = o >> stage;
  const i = (q2 >> 1) * m + k;
  return {
    a: i,
    b: i + half,
    twiddleK: k,
    twiddleDen: 2 * m,
    sign: (q2 & 1) === 0 ? 1 : -1,
  };
}

/**
 * One in-place-by-ping-pong Stockham stage over a strided complex array.
 *
 * `src` and `dst` are interleaved complex: re at 2*idx, im at 2*idx+1.
 * `offset` and `stride` let the same routine walk a row or a column of a 2-D
 * array without copying.
 *
 * @param inverse true runs the inverse transform (twiddle sign +).
 */
export function fftStage(
  src: Float64Array,
  dst: Float64Array,
  n: number,
  stage: number,
  inverse: boolean,
  offset = 0,
  stride = 1,
): void {
  const s = inverse ? 1 : -1;
  for (let o = 0; o < n; o += 1) {
    const p = oceanFftIndex(o, stage, n);
    const ang = (s * 2 * Math.PI * p.twiddleK) / p.twiddleDen;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);

    const ai = 2 * (offset + p.a * stride);
    const bi = 2 * (offset + p.b * stride);
    const ar = src[ai];
    const aim = src[ai + 1];
    const br = src[bi];
    const bim = src[bi + 1];

    // w * b
    const tr = wr * br - wi * bim;
    const ti = wr * bim + wi * br;

    const oi = 2 * (offset + o * stride);
    dst[oi] = ar + p.sign * tr;
    dst[oi + 1] = aim + p.sign * ti;
  }
}

/**
 * A full 1-D transform, ping-ponging between two scratch buffers.
 * Returns the buffer that holds the result.
 */
export function fft1d(
  data: Float64Array,
  scratch: Float64Array,
  n: number,
  inverse: boolean,
  offset = 0,
  stride = 1,
): Float64Array {
  const stages = Math.log2(n);
  let src = data;
  let dst = scratch;
  for (let s = 0; s < stages; s += 1) {
    fftStage(src, dst, n, s, inverse, offset, stride);
    const t = src;
    src = dst;
    dst = t;
  }
  return src;
}

/**
 * A 2-D inverse transform over an n-by-n interleaved complex array.
 *
 * Rows first, then columns — the same order the GPU runs, and the same order
 * the separability of the 2-D DFT permits. The 1/n^2 normalization is applied
 * once, at the end.
 *
 * NOTE ON THE CONVENTION. `inverse` here means the POSITIVE twiddle sign and
 * the 1/n^2 scale. That is the transform that turns a wavevector spectrum
 * into a spatial field, which is the only direction the ocean needs at
 * runtime. The forward direction exists for the tests.
 */
export function ifft2d(data: Float64Array, n: number): Float64Array {
  const scratch = new Float64Array(data.length);
  const cur = data;

  // Rows: contiguous runs of n complex values.
  for (let y = 0; y < n; y += 1) {
    const res = fft1d(cur, scratch, n, true, y * n, 1);
    if (res !== cur) {
      // fft1d ping-ponged an odd number of times; copy the row back so every
      // row ends up in the same buffer.
      for (let x = 0; x < n; x += 1) {
        const i = 2 * (y * n + x);
        cur[i] = res[i];
        cur[i + 1] = res[i + 1];
      }
    }
  }

  // Columns: stride n.
  for (let x = 0; x < n; x += 1) {
    const res = fft1d(cur, scratch, n, true, x, n);
    if (res !== cur) {
      for (let y = 0; y < n; y += 1) {
        const i = 2 * (y * n + x);
        cur[i] = res[i];
        cur[i + 1] = res[i + 1];
      }
    }
  }

  const inv = 1 / (n * n);
  for (let i = 0; i < cur.length; i += 1) cur[i] *= inv;
  return cur;
}

/**
 * A naive O(n^2) DFT. Slow on purpose: it is the independent oracle the fast
 * transform is checked against, and it shares no code with it.
 */
export function naiveDft1d(
  re: readonly number[],
  im: readonly number[],
  inverse: boolean,
): { re: number[]; im: number[] } {
  const n = re.length;
  const s = inverse ? 1 : -1;
  const outRe = new Array<number>(n).fill(0);
  const outIm = new Array<number>(n).fill(0);
  for (let o = 0; o < n; o += 1) {
    let ar = 0;
    let ai = 0;
    for (let t = 0; t < n; t += 1) {
      const ang = (s * 2 * Math.PI * o * t) / n;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      ar += re[t] * c - im[t] * sn;
      ai += re[t] * sn + im[t] * c;
    }
    outRe[o] = inverse ? ar / n : ar;
    outIm[o] = inverse ? ai / n : ai;
  }
  return { re: outRe, im: outIm };
}
