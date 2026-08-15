/**
 * @file oceanFieldReference.ts — the whole pipeline on the CPU.
 *
 * This is the second half of the mirror. `oceanFftReference.ts` mirrors the
 * transform kernel; this file mirrors the pack kernel and the unpack, so
 * vitest can run the ENTIRE ocean end to end without a GPU and assert on the
 * numbers.
 *
 * It is not used at runtime. It is used to prove the runtime is right.
 *
 * THE PACKING: 8 REAL FIELDS OUT OF 4 COMPLEX TRANSFORMS
 *
 * Every one of the eight fields is real, so its spectrum is Hermitian and its
 * inverse transform has zero imaginary part. The inverse transform is linear,
 * so for two Hermitian spectra A and B:
 *
 *     IFFT(A + i B) = IFFT(A) + i IFFT(B) = a + i b
 *
 * The real part is `a` and the imaginary part is `b`. Two real fields, one
 * complex transform. Four transforms therefore carry eight fields, and the
 * pairing is free.
 *
 * The pairs, and what each field is for:
 *
 *   transform 0 : h            + i * Dx        vertical + along-X shift
 *   transform 1 : Dz           + i * dh/dx     along-Z shift + slope X
 *   transform 2 : dh/dz        + i * dDx/dx    slope Z + horizontal stretch
 *   transform 3 : dDz/dz       + i * dDx/dz    stretch + shear
 *
 * The last three derivative fields are not decoration. The analytic normal of
 * a displaced surface needs the derivatives of the DISPLACEMENT as well as of
 * the height, and their combination is the folding Jacobian, which is where
 * foam belongs.
 *
 * THE SPECTRA, FROM ONE COMPLEX NUMBER
 *
 * Everything derives from hhat(k, t) by multiplication:
 *
 *   Dx      <-  -i (kx/k) hhat        (Tessendorf's horizontal displacement)
 *   Dz      <-  -i (kz/k) hhat
 *   dh/dx   <-   i kx hhat            (a derivative is i k in the transform)
 *   dh/dz   <-   i kz hhat
 *   dDx/dx  <-   (kx*kx/k) hhat
 *   dDz/dz  <-   (kz*kz/k) hhat
 *   dDx/dz  <-   (kx*kz/k) hhat
 */
import { ifft2d } from './oceanFftReference';
import type { CascadeSpectrum } from './oceanSpectrum';

/** The eight real fields on an n-by-n grid, row-major, index z*n + x. */
export interface OceanFields {
  readonly n: number;
  /** Vertical displacement, meters. */
  readonly height: Float64Array;
  /** Horizontal displacement along X, meters (already scaled by choppiness). */
  readonly dispX: Float64Array;
  /** Horizontal displacement along Z, meters. */
  readonly dispZ: Float64Array;
  /** d(height)/dx, dimensionless. */
  readonly slopeX: Float64Array;
  /** d(height)/dz, dimensionless. */
  readonly slopeZ: Float64Array;
  /** d(dispX)/dx, dimensionless. */
  readonly dxdx: Float64Array;
  /** d(dispZ)/dz, dimensionless. */
  readonly dzdz: Float64Array;
  /** d(dispX)/dz, dimensionless. */
  readonly dxdz: Float64Array;
}

/**
 * Realize one cascade at time `tSeconds`.
 *
 * DETERMINISM. The only inputs are the spectrum buffer (itself a pure
 * function of the seed) and the time. There is no hidden state and no
 * per-frame randomness, so the same (seed, time) gives the same field. That
 * is what makes a ship's heave reproducible.
 */
export function realizeCascade(
  spec: CascadeSpectrum,
  tSeconds: number,
): OceanFields {
  const n = spec.n;
  const cells = n * n;
  const chop = spec.params.choppiness;

  // Four interleaved-complex packed spectra.
  const packed: Float64Array[] = [
    new Float64Array(cells * 2),
    new Float64Array(cells * 2),
    new Float64Array(cells * 2),
    new Float64Array(cells * 2),
  ];

  for (let i = 0; i < cells; i += 1) {
    const b = i * 4;
    const h0r = spec.h0[b + 0];
    const h0i = spec.h0[b + 1];
    const hcr = spec.h0[b + 2];
    const hci = spec.h0[b + 3];

    const omega = spec.wave[b + 0];
    const kx = spec.wave[b + 1];
    const kz = spec.wave[b + 2];
    const invK = spec.wave[b + 3];

    const c = Math.cos(omega * tSeconds);
    const s = Math.sin(omega * tSeconds);

    // hhat = h0 * e^{i w t} + hconj * e^{-i w t}
    const hr = h0r * c - h0i * s + (hcr * c + hci * s);
    const hi = h0r * s + h0i * c + (hci * c - hcr * s);

    // Multiplying a complex value by i: (re, im) -> (-im, re).
    const ihr = -hi;
    const ihi = hr;

    // Dx = -i (kx/k) h  ->  (kx*invK) * (-i h) = (kx*invK) * (hi, -hr)
    const dxr = kx * invK * hi * chop;
    const dxi = -kx * invK * hr * chop;
    const dzr = kz * invK * hi * chop;
    const dzi = -kz * invK * hr * chop;

    // dh/dx = i kx h
    const shxr = kx * ihr;
    const shxi = kx * ihi;
    const shzr = kz * ihr;
    const shzi = kz * ihi;

    // dDx/dx = i kx * Dx = (kx*kx*invK) * h   (the two i factors cancel)
    const dxdxr = kx * kx * invK * hr * chop;
    const dxdxi = kx * kx * invK * hi * chop;
    const dzdzr = kz * kz * invK * hr * chop;
    const dzdzi = kz * kz * invK * hi * chop;
    const dxdzr = kx * kz * invK * hr * chop;
    const dxdzi = kx * kz * invK * hi * chop;

    const j = i * 2;
    // 0: h + i Dx
    packed[0][j] = hr - dxi;
    packed[0][j + 1] = hi + dxr;
    // 1: Dz + i dh/dx
    packed[1][j] = dzr - shxi;
    packed[1][j + 1] = dzi + shxr;
    // 2: dh/dz + i dDx/dx
    packed[2][j] = shzr - dxdxi;
    packed[2][j + 1] = shzi + dxdxr;
    // 3: dDz/dz + i dDx/dz
    packed[3][j] = dzdzr - dxdzi;
    packed[3][j + 1] = dzdzi + dxdzr;
  }

  // The transform. `ifft2d` divides by n^2; the physical field is a plain sum
  // over wavevectors, so multiply it back. The scale is undone here rather
  // than inside the transform so the transform stays a textbook IFFT and the
  // transform tests can check it against a textbook oracle.
  const scale = n * n;
  const out = packed.map((p) => ifft2d(p, n));

  const height = new Float64Array(cells);
  const dispX = new Float64Array(cells);
  const dispZ = new Float64Array(cells);
  const slopeX = new Float64Array(cells);
  const slopeZ = new Float64Array(cells);
  const dxdx = new Float64Array(cells);
  const dzdz = new Float64Array(cells);
  const dxdz = new Float64Array(cells);

  for (let z = 0; z < n; z += 1) {
    for (let x = 0; x < n; x += 1) {
      const i = z * n + x;
      const j = i * 2;
      // The wavevector grid is centered on k = 0, so index x means
      // kx = (x - n/2) * dk. That shift costs exactly one alternating sign in
      // the spatial domain: e^{-i pi (x+z)} = (-1)^(x+z).
      const sgn = ((x + z) & 1) === 0 ? scale : -scale;

      height[i] = out[0][j] * sgn;
      dispX[i] = out[0][j + 1] * sgn;
      dispZ[i] = out[1][j] * sgn;
      slopeX[i] = out[1][j + 1] * sgn;
      slopeZ[i] = out[2][j] * sgn;
      dxdx[i] = out[2][j + 1] * sgn;
      dzdz[i] = out[3][j] * sgn;
      dxdz[i] = out[3][j + 1] * sgn;
    }
  }

  return { n, height, dispX, dispZ, slopeX, slopeZ, dxdx, dzdz, dxdz };
}
