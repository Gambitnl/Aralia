/**
 * @file oceanCompute.ts — the ocean on the GPU, in TSL.
 *
 * FOUR KERNELS, FOUR DISPATCHES A FRAME
 *
 *   1. `pack`   — evolve the spectrum to time t and build 4 packed complex
 *                 fields per cascade. One dispatch.
 *   2. `hAxis`  — the eight radix-2 Stockham stages along X, in workgroup
 *                 memory. One dispatch.
 *   3. `vAxis`  — the same along Z. One dispatch.
 *   4. `unpack` — split the transform output into displacement and normal,
 *                 apply the centered-k sign and the transform scale. One
 *                 dispatch.
 *
 * The evaluation that started this work counted THREE passes in the reference
 * implementation. This has four. The fourth exists because the transform
 * leaves its result interleaved across four planes in a ping-pong buffer, and
 * a vertex shader that read it in that form would do the unpacking once per
 * vertex instead of once per texel. The extra dispatch is cheaper than the
 * work it removes.
 *
 * REGISTERED TSL HAZARDS, AND WHAT THIS FILE DOES ABOUT EACH
 *
 *   Integer `.mod()` miscompiles to WGSL silently. NOT USED. Every index here
 *   is a power-of-two mask (`bitAnd`) or a shift (`shiftRight`), which is the
 *   same arithmetic with no trap. `modInt` is not needed either.
 *
 *   Never scatter-write from a compute shader: no two work items may write
 *   one address. Every kernel below gathers. `pack` and `unpack` write only
 *   their own `instanceIndex`; an axis kernel's thread writes the two outputs
 *   of its line that no other thread writes, with a barrier between stages
 *   (performance pass, 2026-09-25, when 16 stage dispatches became 2). The pack kernel
 *   recomputes the evolved spectrum four times rather than write four
 *   elements once — two sine evaluations are cheaper than a rule exception.
 *
 *   `needsUpdate` on a storage buffer is a no-op. The spectrum buffers are
 *   uploaded once at construction and never touched again. Nothing here
 *   depends on re-uploading a storage buffer mid-frame.
 *
 *   Ping-pong buffers need explicit rebinding. A TSL compute node captures
 *   its storage bindings when it is BUILT. Swapping two JavaScript references
 *   afterwards changes nothing on the GPU. So this file builds each axis
 *   kernel on its own fixed pair — `hAxis` reads A and writes B, `vAxis`
 *   reads B and writes A — and the unpack reads A. There is no swap.
 *
 * WHY THE FFT LIVES IN BUFFERS AND NOT IN STORAGE TEXTURES
 *
 * Ping-ponging a storage texture needs two textures and a rebind per stage,
 * exactly like the buffers, and buys nothing until the final read. The final
 * read is where hardware bilinear filtering would help, and that is what the
 * unpack pass is for: it is the one place a texture write would pay. It is
 * left as a buffer here because this repo has no proven StorageTexture path
 * yet, and inventing one inside an unproven FFT would have hidden which of
 * the two was wrong.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/09/2026, 05:21:02
 * Dependents: systems/world3d/ocean/index.ts, systems/world3d/ocean/oceanField.ts, systems/world3d/ocean/oceanNormalMip.ts, systems/world3d/ocean/oceanRain.ts, systems/world3d/ocean/oceanSampler.ts, systems/world3d/ocean/oceanSurface.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  Fn,
  bitAnd,
  cos,
  float,
  instanceIndex,
  int,
  select,
  shiftLeft,
  shiftRight,
  sin,
  storage,
  uniform,
  vec2,
  vec4,
  workgroupArray,
  workgroupBarrier,
  textureStore,
  uint,
  uvec2,
} from 'three/tsl';
import * as THREE from 'three/webgpu';
import { StorageBufferAttribute } from 'three/webgpu';
import {
  FIELDS_PER_CASCADE,
  log2Exact,
  type CascadeParams,
} from './oceanConfig';
import { buildCascadeSpectrum, type CascadeSpectrum } from './oceanSpectrum';

/** Every buffer the ocean pipeline owns. */
export interface OceanGpuBuffers {
  readonly n: number;
  readonly cascades: number;
  /** vec4 per cell per cascade: h0.re, h0.im, conj(h0(-k)).re, .im */
  readonly h0: StorageBufferAttribute;
  /** vec4 per cell per cascade: omega, kx, kz, 1/k */
  readonly wave: StorageBufferAttribute;
  /** vec2 ping-pong plane A: cascades * 4 planes of n*n complex values. */
  readonly fftA: StorageBufferAttribute;
  /** vec2 ping-pong plane B. */
  readonly fftB: StorageBufferAttribute;
  /** vec4 per cell per cascade: dispX, height, dispZ, foldJacobian. */
  readonly disp: StorageBufferAttribute;
  /** vec4 per cell per cascade: normal xyz, unused w. */
  readonly norm: StorageBufferAttribute;
  /**
   * `disp` and `norm` again, as bordered texture ATLASES for the render-side
   * readers (performance pass, 2026-09-25): one column of n + 2 texels per
   * cascade, the plane inside a one-texel border that holds the opposite
   * edge, so a hardware-bilinear fetch reproduces the wrapped four-read of
   * `oceanSampler.ts`. Written each frame after the unpack
   * (`buildOceanKernels`), read by `createOceanSampler(..., { filtered })`.
   */
  readonly dispTex: THREE.StorageTexture;
  readonly normTex: THREE.StorageTexture;
}

/** A bordered plane atlas: (n + 2) x cascades wide, n + 2 tall, half float, filtered. */
function makePlaneAtlas(n: number, cascades: number): THREE.StorageTexture {
  const t = new THREE.StorageTexture((n + 2) * cascades, n + 2);
  t.type = THREE.HalfFloatType;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/**
 * Allocate and fill the GPU buffers for a sea.
 *
 * The spectrum is built on the CPU (see `oceanSpectrum.ts`) and uploaded
 * once. That is the whole determinism story: the only per-frame input is a
 * time uniform.
 */
export function createOceanBuffers(
  cascadeParams: readonly CascadeParams[],
  n: number,
  seed: number,
): { buffers: OceanGpuBuffers; spectra: CascadeSpectrum[] } {
  log2Exact(n);
  const cells = n * n;
  const c = cascadeParams.length;

  const h0 = new Float32Array(cells * 4 * c);
  const wave = new Float32Array(cells * 4 * c);
  const spectra: CascadeSpectrum[] = [];

  for (let ci = 0; ci < c; ci += 1) {
    // Each cascade gets its own seed stream, derived from the master seed so
    // the whole sea is one deterministic function of one number.
    const spec = buildCascadeSpectrum(cascadeParams[ci], n, (seed ^ (ci * 0x9e3779b9)) >>> 0);
    spectra.push(spec);
    h0.set(spec.h0, ci * cells * 4);
    wave.set(spec.wave, ci * cells * 4);
  }

  const buffers: OceanGpuBuffers = {
    n,
    cascades: c,
    h0: new StorageBufferAttribute(h0, 4),
    wave: new StorageBufferAttribute(wave, 4),
    fftA: new StorageBufferAttribute(new Float32Array(cells * 2 * FIELDS_PER_CASCADE * c), 2),
    fftB: new StorageBufferAttribute(new Float32Array(cells * 2 * FIELDS_PER_CASCADE * c), 2),
    disp: new StorageBufferAttribute(new Float32Array(cells * 4 * c), 4),
    norm: new StorageBufferAttribute(new Float32Array(cells * 4 * c), 4),
    dispTex: makePlaneAtlas(n, c),
    normTex: makePlaneAtlas(n, c),
  };

  return { buffers, spectra };
}

/** A node to dispatch, with the label a perf probe reports it under. */
export interface OceanDispatch {
  readonly node: unknown;
  readonly label: string;
}

/** The compute nodes and the one uniform that drives them. */
export interface OceanKernels {
  /**
   * The per-frame dispatch list, in order, already built. Run them in this
   * sequence. There is nothing to set between them: every stage constant is
   * compiled into its own kernel.
   */
  readonly dispatches: readonly OceanDispatch[];
  /**
   * Simulation time, seconds. The ONLY per-frame input, and it is read by
   * exactly one kernel, so it cannot race with itself.
   */
  readonly uTime: { value: number };
  readonly stages: number;
}

/* ------------------------------------------------------------------ */
/* Kernel 1 — evolve and pack                                          */
/* ------------------------------------------------------------------ */

function buildPack(
  bufs: OceanGpuBuffers,
  choppiness: readonly number[],
  uTime: ReturnType<typeof uniform>,
) {
  const n = bufs.n;
  const logN = log2Exact(n);
  const cells = n * n;

  const h0 = storage(bufs.h0, 'vec4', bufs.h0.count).toReadOnly();
  const wave = storage(bufs.wave, 'vec4', bufs.wave.count).toReadOnly();
  const out = storage(bufs.fftA, 'vec2', bufs.fftA.count);

  // Per-cascade choppiness, read by cascade index. A handful of cascades is
  // few enough that a select chain is cheaper and far clearer than a uniform
  // buffer, and every branch of it is a constant the compiler folds.
  //
  // THE SIGN IS NEGATIVE, AND THAT IS WHAT PUTS THE CUSP ON THE CREST.
  //
  // Tessendorf writes the horizontal displacement as
  // D = sum -i (k/|k|) hhat e^{ikx}, and the spectra below carry that -i.
  // Under this pipeline's transform convention the formula moves surface
  // points AWAY from crests. Measured on a single wave h = cos(kx) at
  // choppiness 1 (the CPU mirror, which the cross-check proves equal to this
  // kernel): the folding Jacobian was 1.79 at the crest and 0.21 in the
  // trough. So the sea had stretched, rounded crests over cusped troughs, and
  // the foam its Jacobian drove sat in the troughs. A critic read it as
  // "tonal bands rather than shapes".
  //
  // Deep-water orbital motion says the opposite. The horizontal velocity at
  // the surface is u = a w cos(kx - wt); it integrates to a displacement
  // -a sin(kx - wt), which is toward the crest on both sides of it. Surface
  // particles converge on crests, which is why a crest is sharp.
  //
  // Negating the choppiness flips D and every derivative of D together, so
  // the Jacobian's distribution is unchanged (the linear field is symmetric)
  // and only its LOCATION moves, from trough to crest. Every measured foam
  // coverage in oceanConfig.ts therefore still holds. The CPU mirror in
  // oceanFieldReference.ts negates the same way, and the sign gate in
  // oceanSpectrum.test.ts asserts that height and Jacobian anticorrelate.
  const chops = choppiness.map((c) => uniform(-c));

  return Fn(() => {
    const i = int(instanceIndex);

    // The dispatch covers every plane of every cascade: cascades * 4 planes.
    const cellIdx = bitAnd(i, int(cells - 1)).toVar();
    const planeIdx = shiftRight(i, int(2 * logN)).toVar();
    const field = bitAnd(planeIdx, int(FIELDS_PER_CASCADE - 1)).toVar();
    const cascade = shiftRight(planeIdx, int(2)).toVar();

    const specIdx = cascade.mul(int(cells)).add(cellIdx).toVar();
    const h = h0.element(specIdx).toVar();
    const w = wave.element(specIdx).toVar();

    const omega = w.x.toVar();
    const kx = w.y.toVar();
    const kz = w.z.toVar();
    const invK = w.w.toVar();

    // Fold the list from the back: the last cascade is the default arm, so a
    // cascade index that cannot occur still yields a defined value.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chopExpr: any = chops[chops.length - 1];
    for (let ci = chops.length - 2; ci >= 0; ci -= 1) {
      chopExpr = select(cascade.equal(int(ci)), chops[ci], chopExpr);
    }
    const chop = chopExpr.toVar();

    const ang = omega.mul(uTime).toVar();
    const ct = cos(ang).toVar();
    const st = sin(ang).toVar();

    // hhat = h0 * e^{i w t} + conj(h0(-k)) * e^{-i w t}
    const hr = h.x.mul(ct).sub(h.y.mul(st)).add(h.z.mul(ct).add(h.w.mul(st))).toVar();
    const hi = h.x.mul(st).add(h.y.mul(ct)).add(h.w.mul(ct).sub(h.z.mul(st))).toVar();

    // Displacement spectra: Dx = -i (kx/k) hhat, so (re, im) -> (kx invK hi,
    // -kx invK hr), scaled by choppiness.
    const kxi = kx.mul(invK).mul(chop).toVar();
    const kzi = kz.mul(invK).mul(chop).toVar();
    const dxr = kxi.mul(hi).toVar();
    const dxi = kxi.mul(hr).negate().toVar();
    const dzr = kzi.mul(hi).toVar();
    const dzi = kzi.mul(hr).negate().toVar();

    // Slope spectra: dh/dx = i kx hhat, so (re, im) -> (-kx hi, kx hr).
    const shxr = kx.mul(hi).negate().toVar();
    const shxi = kx.mul(hr).toVar();
    const shzr = kz.mul(hi).negate().toVar();
    const shzi = kz.mul(hr).toVar();

    // Displacement-derivative spectra: the two i factors cancel, leaving a
    // real multiplier on hhat.
    const mxx = kx.mul(kx).mul(invK).mul(chop).toVar();
    const mzz = kz.mul(kz).mul(invK).mul(chop).toVar();
    const mxz = kx.mul(kz).mul(invK).mul(chop).toVar();

    // Pack A + i B: (A.re - B.im, A.im + B.re).
    // field 0: h      + i Dx
    const p0 = vec2(hr.sub(dxi), hi.add(dxr)).toVar();
    // field 1: Dz     + i dh/dx
    const p1 = vec2(dzr.sub(shxi), dzi.add(shxr)).toVar();
    // field 2: dh/dz  + i dDx/dx
    const p2 = vec2(shzr.sub(mxx.mul(hi)), shzi.add(mxx.mul(hr))).toVar();
    // field 3: dDz/dz + i dDx/dz
    const p3 = vec2(mzz.mul(hr).sub(mxz.mul(hi)), mzz.mul(hi).add(mxz.mul(hr))).toVar();

    const chosen = select(
      field.equal(int(0)),
      p0,
      select(field.equal(int(1)), p1, select(field.equal(int(2)), p2, p3)),
    );

    out.element(i).assign(chosen);
  })().compute(bufs.fftA.count);
}

/* ------------------------------------------------------------------ */
/* Kernels 2 and 3 — one whole axis of the transform                   */
/* ------------------------------------------------------------------ */

/**
 * ONE WHOLE AXIS OF THE TRANSFORM IN ONE DISPATCH: the eight radix-2
 * Stockham stages of one axis, gather form (performance pass, 2026-09-25).
 *
 * MIRRORS `oceanFftIndex()` in `oceanFftReference.ts` NODE FOR NODE, stage by
 * stage. vitest proves that function against a naive DFT; this is the same
 * arithmetic in TSL, and a divergence between the two is a bug in the mirror.
 *
 * THE STAGE IS A COMPILE-TIME CONSTANT, NOT A UNIFORM, AND THAT IS LOAD
 * BEARING. The stages are unrolled in JavaScript, so `m` and the shifts fold
 * into constants. A `stage` uniform bumped between dispatches would be wrong
 * in the quiet way this project has been burned by twice: buffer writes queued
 * before a submit all land before any command in it runs, so every dispatch
 * would see the last value.
 *
 * The stages run in workgroup memory. One
 * workgroup of n/2 threads owns one line (a row, or a column, of one plane):
 * it loads the line's n values into a workgroup array, runs the eight stages
 * between two arrays with a barrier after each, and writes the line back.
 * The buffer is read once and written once per axis, where the old one-stage
 * kernels read it and wrote it eight times, and 16 dispatches became 2.
 * Measured A/B in the same minutes (perf iteration 3): the sea's compute
 * 1.2 -> 0.5 ms, overall frame time 5.10 -> 4.30 ms across five scenes, and
 * the field hash BIT-IDENTICAL to the stage chain at two sea times.
 *
 * THE ARITHMETIC IS THE OLD STAGE KERNEL'S, UNCHANGED. Each thread takes the
 * outputs o = lane and o = lane + n/2 of every stage and computes each from
 * the same gather: `k`, `q2`, the two input indices, the twiddle angle
 * pi*k/m, the butterfly sign. So every value is the one the one-stage kernels
 * produced, and the output lands in natural order at the same address.
 *
 * NO WRITE RACE. The registered hazard is two work items writing one
 * address (the fluid kernel lost mass to it). Here each output index has
 * exactly one writer in every stage, and the barriers order the stages; the
 * form is still gather.
 */
function buildFftAxis(
  bufs: OceanGpuBuffers,
  src: StorageBufferAttribute,
  dst: StorageBufferAttribute,
  vertical: boolean,
) {
  const n = bufs.n;
  const logN = log2Exact(n);
  const half = n >> 1;
  const lines = src.count / n;

  const readBuf = storage(src, 'vec2', src.count).toReadOnly();
  const writeBuf = storage(dst, 'vec2', dst.count);
  const shA = workgroupArray('vec2', n);
  const shB = workgroupArray('vec2', n);

  return Fn(() => {
    const g = int(instanceIndex);
    // n/2 threads per line: the line index and the lane within it.
    const line = shiftRight(g, int(logN - 1)).toVar();
    const lane = bitAnd(g, int(half - 1)).toVar();
    // A line is row `pos` (horizontal) or column `pos` (vertical) of one plane.
    const planeBase = shiftLeft(shiftRight(line, int(logN)), int(2 * logN)).toVar();
    const pos = bitAnd(line, int(n - 1)).toVar();
    const lineBase = (vertical ? planeBase.add(pos) : planeBase.add(shiftLeft(pos, int(logN)))).toVar();
    const flat = (idx: ReturnType<typeof int>) => (vertical
      ? lineBase.add(shiftLeft(idx, int(logN)))
      : lineBase.add(idx));
    const o0 = lane;
    const o1 = lane.add(int(half)).toVar();

    shA.element(o0).assign(readBuf.element(flat(o0)));
    shA.element(o1).assign(readBuf.element(flat(o1)));
    workgroupBarrier();

    let cur = shA;
    let nxt = shB;
    for (let stage = 0; stage < logN; stage += 1) {
      const m = 1 << stage;
      for (const o of [o0, o1]) {
        // --- the mirror of oceanFftIndex() ---
        const k = bitAnd(o, int(m - 1)).toVar();
        const q2 = shiftRight(o, int(stage)).toVar();
        const aIdx = shiftRight(q2, int(1)).mul(int(m)).add(k).toVar();
        const bIdx = aIdx.add(int(half)).toVar();
        const a = cur.element(aIdx).toVar();
        const b = cur.element(bIdx).toVar();
        const ang = float(k).mul(float(Math.PI / m)).toVar();
        const wr = cos(ang).toVar();
        const wi = sin(ang).toVar();
        const tr = wr.mul(b.x).sub(wi.mul(b.y)).toVar();
        const ti = wr.mul(b.y).add(wi.mul(b.x)).toVar();
        const sgn = select(bitAnd(q2, int(1)).equal(int(0)), float(1), float(-1)).toVar();
        nxt.element(o).assign(vec2(a.x.add(sgn.mul(tr)), a.y.add(sgn.mul(ti))));
      }
      workgroupBarrier();
      const t = cur;
      cur = nxt;
      nxt = t;
    }

    writeBuf.element(flat(o0)).assign(cur.element(o0));
    writeBuf.element(flat(o1)).assign(cur.element(o1));
  })().compute(lines * half, [half]);
}

/* ------------------------------------------------------------------ */
/* Kernel 5 — the plane atlases                                        */
/* ------------------------------------------------------------------ */

/**
 * Copy `disp` and `norm` into their bordered atlases, one thread per atlas
 * texel. Border texels (local -1 and n) take the opposite edge, so the
 * sampler's bilinear fetch wraps exactly as its `bitAnd` four-read does.
 * Gather form: each thread writes only its own texel of each atlas.
 */
function buildPlaneAtlas(bufs: OceanGpuBuffers) {
  const n = bufs.n;
  const cells = n * n;
  const colW = n + 2;
  const w = colW * bufs.cascades;
  const dispRO = storage(bufs.disp, 'vec4', bufs.disp.count).toReadOnly();
  const normRO = storage(bufs.norm, 'vec4', bufs.norm.count).toReadOnly();
  return Fn(() => {
    const i = int(instanceIndex);
    const v = i.div(int(w));
    const u = i.sub(v.mul(int(w)));
    const c = u.div(int(colW));
    const lu = u.sub(c.mul(int(colW)));
    const ix = bitAnd(lu.sub(int(1)).add(int(n)), int(n - 1));
    const iz = bitAnd(v.sub(int(1)).add(int(n)), int(n - 1));
    const src = c.mul(int(cells)).add(iz.mul(int(n))).add(ix);
    textureStore(bufs.dispTex, uvec2(uint(u), uint(v)), dispRO.element(src));
    textureStore(bufs.normTex, uvec2(uint(u), uint(v)), normRO.element(src));
  })().compute(w * colW);
}

/* ------------------------------------------------------------------ */
/* Kernel 4 — unpack                                                   */
/* ------------------------------------------------------------------ */

/**
 * Split the transform output into a displacement vector and a normal.
 *
 * Two corrections land here.
 *
 * THE SIGN. The wavevector grid is centered on k = 0, so index x means
 * kx = (x - n/2) dk. That half-grid shift is exactly one alternating sign in
 * the spatial domain: e^{-i pi (x + z)} = (-1)^(x+z).
 *
 * THE SCALE. The physical field is a plain sum over wavevectors. The inverse
 * transform this pipeline runs carries no 1/n^2, so no scale is reapplied —
 * the un-normalized inverse IS the sum. That differs from the CPU reference,
 * which normalizes inside `ifft2d` and multiplies back, and the difference is
 * deliberate: the reference keeps a textbook transform so the transform tests
 * can use a textbook oracle.
 *
 * THE NORMAL, computed here rather than in the shader. With
 * P(u,v) = (u + Dx, h, v + Dz), the two tangents are
 *
 *   Pu = (1 + dDx/dx,  dh/dx,  dDz/dx)
 *   Pv = (dDx/dz,      dh/dz,  1 + dDz/dz)
 *
 * and dDz/dx equals dDx/dz — both come from the same kx*kz/k spectrum, which
 * is why eight fields are enough for a nine-term Jacobian. The y component of
 * the resulting normal IS the folding Jacobian, so foam comes free.
 */
function buildUnpack(bufs: OceanGpuBuffers, resultBuf: StorageBufferAttribute) {
  const n = bufs.n;
  const logN = log2Exact(n);
  const cells = n * n;

  const src = storage(resultBuf, 'vec2', resultBuf.count).toReadOnly();
  const outDisp = storage(bufs.disp, 'vec4', bufs.disp.count);
  const outNorm = storage(bufs.norm, 'vec4', bufs.norm.count);

  return Fn(() => {
    const i = int(instanceIndex);
    const cellIdx = bitAnd(i, int(cells - 1)).toVar();
    const cascade = shiftRight(i, int(2 * logN)).toVar();

    const z = shiftRight(cellIdx, int(logN)).toVar();
    const x = bitAnd(cellIdx, int(n - 1)).toVar();
    const sgn = select(bitAnd(x.add(z), int(1)).equal(int(0)), float(1), float(-1)).toVar();

    const planeBase = cascade.mul(int(FIELDS_PER_CASCADE * cells)).toVar();
    const f0 = src.element(planeBase.add(cellIdx)).toVar();
    const f1 = src.element(planeBase.add(int(cells)).add(cellIdx)).toVar();
    const f2 = src.element(planeBase.add(int(2 * cells)).add(cellIdx)).toVar();
    const f3 = src.element(planeBase.add(int(3 * cells)).add(cellIdx)).toVar();

    const height = f0.x.mul(sgn).toVar();
    const dispX = f0.y.mul(sgn).toVar();
    const dispZ = f1.x.mul(sgn).toVar();
    const slopeX = f1.y.mul(sgn).toVar();
    const slopeZ = f2.x.mul(sgn).toVar();
    const dxdx = f2.y.mul(sgn).toVar();
    const dzdz = f3.x.mul(sgn).toVar();
    const dxdz = f3.y.mul(sgn).toVar();

    const exx = float(1).add(dxdx).toVar();
    const ezz = float(1).add(dzdz).toVar();

    // n = -(Pu x Pv). The y term is exx*ezz - dxdz^2: the folding Jacobian.
    const jac = exx.mul(ezz).sub(dxdz.mul(dxdz)).toVar();
    const nx = slopeX.mul(ezz).sub(dxdz.mul(slopeZ)).negate().toVar();
    const nz = exx.mul(slopeZ).sub(slopeX.mul(dxdz)).negate().toVar();

    // The normal is stored UNNORMALIZED and undivided, as (nx, nz, ny), so
    // two cascades can be combined by summing nx/ny and nz/ny. Dividing here
    // would throw away the information the shader needs to combine them.
    // ny is the Jacobian, and it reaches zero exactly where the surface folds
    // over itself — where no single-valued normal exists and foam belongs.
    outDisp.element(i).assign(vec4(dispX, height, dispZ, jac));
    outNorm.element(i).assign(vec4(nx, nz, jac, float(0)));
  })().compute(bufs.disp.count);
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build every kernel the ocean needs.
 *
 * Both ping-pong directions are built here, up front, because a TSL compute
 * node binds its storage buffers at build time. This is the registered
 * rebinding hazard, and building both directions is the only honest way
 * around it.
 */
export function buildOceanKernels(
  bufs: OceanGpuBuffers,
  cascadeParams: readonly CascadeParams[],
): OceanKernels {
  const stages = log2Exact(bufs.n);

  // Where the result lands after `stages` alternating hops from A. Even
  // counts return to A. Checked, never assumed.
  if (stages % 2 !== 0) {
    throw new Error(
      `[ocean] FFT size ${bufs.n} needs ${stages} stages per axis, an odd count, `
      + 'which leaves the result in the scratch buffer. Use a size whose log2 is '
      + 'even (64, 256, 1024) or add a copy pass.',
    );
  }

  const uTime = uniform(0);

  const dispatches: OceanDispatch[] = [
    {
      node: buildPack(bufs, cascadeParams.map((c) => c.choppiness), uTime),
      label: 'pack',
    },
  ];

  // THE TWO WHOLE-AXIS KERNELS (buildFftAxis): A -> B along X, B -> A along
  // Z, so the result is in A and the unpack reads it there.
  dispatches.push({ node: buildFftAxis(bufs, bufs.fftA, bufs.fftB, false), label: 'hAxis' });
  dispatches.push({ node: buildFftAxis(bufs, bufs.fftB, bufs.fftA, true), label: 'vAxis' });
  dispatches.push({ node: buildUnpack(bufs, bufs.fftA), label: 'unpack' });
  dispatches.push({ node: buildPlaneAtlas(bufs), label: 'planeAtlas' });

  return {
    dispatches,
    uTime: uTime as unknown as { value: number },
    stages,
  };
}
