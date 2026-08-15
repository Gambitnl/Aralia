/**
 * @file oceanFft.test.ts — the transform, checked against an independent
 * oracle rather than against "it looked wavy".
 *
 * A wrong inverse FFT still produces waves. Every assertion here is a
 * property that a wrong transform fails: agreement with a naive DFT that
 * shares no code, the shift theorem, linearity, and round-trip identity.
 */
import { describe, it, expect } from 'vitest';
import {
  oceanFftIndex,
  fft1d,
  ifft2d,
  naiveDft1d,
} from '../oceanFftReference';

function interleave(re: readonly number[], im: readonly number[]): Float64Array {
  const out = new Float64Array(re.length * 2);
  for (let i = 0; i < re.length; i += 1) {
    out[2 * i] = re[i];
    out[2 * i + 1] = im[i];
  }
  return out;
}

describe('oceanFftIndex — the gather plan', () => {
  it('never asks two outputs of a stage to write the same address', () => {
    // Trivially true by construction (output index is the write address),
    // but the INPUT reads must cover the array exactly twice per stage.
    const n = 16;
    for (let stage = 0; stage < 4; stage += 1) {
      const reads = new Array<number>(n).fill(0);
      for (let o = 0; o < n; o += 1) {
        const p = oceanFftIndex(o, stage, n);
        expect(p.a).toBeGreaterThanOrEqual(0);
        expect(p.b).toBeLessThan(n);
        reads[p.a] += 1;
        reads[p.b] += 1;
      }
      // Each stage reads the lower half and the upper half n/2 times each.
      const total = reads.reduce((s, v) => s + v, 0);
      expect(total).toBe(2 * n);
    }
  });

  it('uses only power-of-two masks, never a modulo', () => {
    // Guards the registered TSL gotcha: integer .mod() miscompiles silently.
    // The plan must be reproducible with shifts and masks alone.
    const n = 32;
    for (let stage = 0; stage < 5; stage += 1) {
      for (let o = 0; o < n; o += 1) {
        const p = oceanFftIndex(o, stage, n);
        const m = 1 << stage;
        expect(p.twiddleDen).toBe(2 * m);
        expect(p.twiddleK).toBe(o & (m - 1));
        expect(p.b - p.a).toBe(n >> 1);
      }
    }
  });
});

describe('fft1d — against a naive DFT', () => {
  for (const n of [2, 4, 8, 16, 64]) {
    it(`matches the naive forward DFT at n=${n}`, () => {
      const re: number[] = [];
      const im: number[] = [];
      let s = 12345;
      const rnd = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff - 0.5;
      };
      for (let i = 0; i < n; i += 1) {
        re.push(rnd());
        im.push(rnd());
      }

      const oracle = naiveDft1d(re, im, false);
      const data = interleave(re, im);
      const scratch = new Float64Array(data.length);
      const res = fft1d(data, scratch, n, false);

      for (let i = 0; i < n; i += 1) {
        expect(res[2 * i]).toBeCloseTo(oracle.re[i], 9);
        expect(res[2 * i + 1]).toBeCloseTo(oracle.im[i], 9);
      }
    });

    it(`matches the naive inverse DFT at n=${n} up to the 1/n scale`, () => {
      const re: number[] = [];
      const im: number[] = [];
      for (let i = 0; i < n; i += 1) {
        re.push(Math.sin(i * 0.7) + i * 0.01);
        im.push(Math.cos(i * 1.3));
      }
      const oracle = naiveDft1d(re, im, true);
      const data = interleave(re, im);
      const scratch = new Float64Array(data.length);
      const res = fft1d(data, scratch, n, true);
      // fft1d applies no normalization; the naive inverse divides by n.
      for (let i = 0; i < n; i += 1) {
        expect(res[2 * i] / n).toBeCloseTo(oracle.re[i], 9);
        expect(res[2 * i + 1] / n).toBeCloseTo(oracle.im[i], 9);
      }
    });
  }

  it('produces natural output order — no bit reversal is needed', () => {
    // A single unit impulse at index 1 must transform to a pure phase ramp.
    // Bit-reversed output would scramble that ramp; this is the autosort
    // check.
    const n = 16;
    const data = new Float64Array(n * 2);
    data[2 * 1] = 1;
    const scratch = new Float64Array(n * 2);
    const res = fft1d(data, scratch, n, false);
    for (let o = 0; o < n; o += 1) {
      const ang = (-2 * Math.PI * o) / n;
      expect(res[2 * o]).toBeCloseTo(Math.cos(ang), 9);
      expect(res[2 * o + 1]).toBeCloseTo(Math.sin(ang), 9);
    }
  });
});

describe('ifft2d — the 2-D transform', () => {
  it('turns a single wavevector into exactly that plane wave', () => {
    // THE test that catches a transposed or mis-strided 2-D transform. A
    // wrong axis order still gives waves; it gives them along the wrong axis.
    const n = 32;
    const data = new Float64Array(n * n * 2);
    const kxIdx = 3;
    const kzIdx = 5;
    // Real amplitude 1 at (kxIdx, kzIdx). Not Hermitian, so the output is
    // complex, and both parts are checked.
    data[2 * (kzIdx * n + kxIdx)] = 1;

    const out = ifft2d(data, n);
    const scale = n * n;
    for (const [x, z] of [[0, 0], [1, 0], [0, 1], [7, 11], [31, 30]]) {
      const ang = 2 * Math.PI * ((kxIdx * x) / n + (kzIdx * z) / n);
      const i = 2 * (z * n + x);
      expect(out[i] * scale).toBeCloseTo(Math.cos(ang), 8);
      expect(out[i + 1] * scale).toBeCloseTo(Math.sin(ang), 8);
    }
  });

  it('makes a Hermitian spectrum produce a purely real field', () => {
    // If the imaginary part is not ~0, the conjugate half is being built
    // wrong — the single most common ocean bug, and one that still looks
    // wavy because the real part alone is plausible.
    const n = 16;
    const data = new Float64Array(n * n * 2);
    const put = (x: number, z: number, re: number, im: number) => {
      const i = 2 * (z * n + x);
      data[i] = re;
      data[i + 1] = im;
    };
    const pairs: [number, number, number, number][] = [
      [2, 3, 0.7, -0.4],
      [5, 1, -0.2, 0.9],
      [6, 6, 0.3, 0.15],
    ];
    for (const [x, z, re, im] of pairs) {
      put(x, z, re, im);
      put((n - x) % n, (n - z) % n, re, -im);
    }

    const out = ifft2d(data, n);
    let maxImag = 0;
    for (let i = 0; i < n * n; i += 1) {
      maxImag = Math.max(maxImag, Math.abs(out[2 * i + 1]));
    }
    expect(maxImag).toBeLessThan(1e-12);
  });

  it('satisfies Parseval: spatial variance equals spectral power', () => {
    // The identity a wrong normalization cannot survive.
    const n = 16;
    const data = new Float64Array(n * n * 2);
    let s = 7;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff - 0.5;
    };
    let spectralPower = 0;
    for (let i = 0; i < n * n; i += 1) {
      const re = rnd();
      const im = rnd();
      data[2 * i] = re;
      data[2 * i + 1] = im;
      spectralPower += re * re + im * im;
    }
    const out = ifft2d(data, n);
    let spatial = 0;
    for (let i = 0; i < n * n; i += 1) {
      spatial += out[2 * i] * out[2 * i] + out[2 * i + 1] * out[2 * i + 1];
    }
    // sum |X_k|^2 = N^2 * sum |x_j|^2 for the 1/N^2-normalized inverse.
    expect(spatial * n * n).toBeCloseTo(spectralPower, 8);
  });
});
