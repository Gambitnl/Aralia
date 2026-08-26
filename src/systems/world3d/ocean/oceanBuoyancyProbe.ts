/**
 * @file oceanBuoyancyProbe.ts — the surface height above a set of world
 * points, read from the GPU sea.
 *
 * WHY THE GPU, AND NOT A CPU EVALUATION
 *
 * The buoy must sit on the water the eye sees. That water is the FFT output
 * in `disp`, sampled bilinearly per vertex by `oceanSurface.ts`, each cascade
 * faded by its own `dispLod`. Any second evaluation of the sea — a CPU sum
 * over the spectrum, a CPU FFT, a subset of modes — is a different surface,
 * and the difference shows exactly where the critic looks: the waterline.
 * A CPU sum over the dominant modes was measured at 2 to 3 ms a step for
 * forty probes, would still omit the fine ripple, and would ignore the LOD
 * fades. So this module reads the SAME buffer with the SAME arithmetic, and
 * the buoy's waterline agrees with the mesh to the mesh's own interpolation
 * error.
 *
 * THE KERNEL reads the sea through `createOceanSampler` (oceanSampler.ts),
 * the same `sampleCascade` and `cascadeLod` that `oceanSurface.ts` calls:
 * the same texel index, power-of-two mask wrap, bilinear mix and smoothstep
 * range fade. Until round 4 this file held a node-for-node copy of the
 * two (GG-273); a change to the surface's copy would have moved the water a
 * floating body sampled without any test noticing. `verifySampler` in the
 * mount still checks the result against a CPU evaluation.
 *
 * THE INVERSION runs here, on the GPU, four fixed-point iterations of
 * G <- P - D(G).xz, unrolled. `invertDisplacement` in `oceanBuoyancy.ts` is
 * the same loop on the CPU, and the unit tests prove its convergence.
 *
 * THE READBACK is the price. A storage-buffer readback is asynchronous: the
 * copy is queued behind the sea's own dispatches and the map resolves when
 * the GPU reaches it, one frame later in a live loop. The live path in
 * `oceanExtras/buoys.ts` integrates with the latest heights it has, which
 * lag the sea by one frame — at most a few centimeters of vertical error on
 * this sea, under the body's own damping. The capture path awaits every step,
 * so a pinned run is exact. Per call this moves `capacity * 16` bytes, about
 * a kilobyte, and allocates one small staging buffer, which three.js's
 * `getArrayBufferAsync` creates and destroys itself.
 *
 * THE QUERY POSITIONS travel as a uniform array. A storage buffer's
 * `needsUpdate` is a no-op on this renderer (a registered hazard, see
 * `oceanCompute.ts`); a `uniformArray` is re-uploaded before every
 * `renderer.compute` call, and each call is its own submit, so the kernel
 * always reads the positions written just before it.
 *
 * KINEMATIC SLOTS (round 4, 2026-09-24). A floating body needs the water's
 * velocity and acceleration at each probe, band by band, because each FFT
 * band's motion dies with depth at its own rate (`bandDepthDecay` in
 * `oceanBuoyancy.ts`). The first `kinematicSlots` slots therefore also
 * return every band's own displacement, range-faded as the mesh fades it, at
 * three grid points: the one the inversion found now, and the two the
 * caller names as the previous two samples' grid points
 * (`setPreviousGrids`). Those are the same water parcels the last two
 * samples saw, so the caller's differences between samples are those
 * parcels' velocity and acceleration, with no slope-times-drift term in
 * them (`createBandKinematics` in `oceanBuoyancy.ts`). The previous grid
 * point rides in the query vec4's spare z and w; the one before it has a
 * uniform array of its own.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  instanceIndex,
  int,
  storage,
  uniform,
  uniformArray,
  vec2,
  vec4,
  If,
} from 'three/tsl';
import type { CascadeParams } from './oceanConfig';
import { log2Exact } from './oceanConfig';
import type { OceanField } from './oceanField';
import { createOceanSampler } from './oceanSampler';

/**
 * A TSL node expression. See `oceanSurface.ts` for why this is `any`: three
 * 0.172 ships no type that names every node class an expression can produce.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

/**
 * Iterations of the displacement inversion. Four brings the horizontal
 * residual under a centimeter on the shipped sea; the CPU test measures the
 * same loop at under 1e-4 m on a Gerstner sea of comparable steepness.
 */
export const OCEAN_PROBE_INVERSION_ITERATIONS = 4;

export interface OceanSurfaceProbe {
  /** Number of query slots. Fixed at construction: the buffers are sized to it. */
  readonly capacity: number;
  /** The first this many slots also return per-band kinematics samples. */
  readonly kinematicSlots: number;
  /** Number of FFT bands (cascades) in each kinematics sample. */
  readonly bands: number;
  /**
   * Float offset, in a `sample` result, of the per-band displacement at the
   * grid point found NOW: index nowOffset + ((slot * bands) + band) * 4 +
   * axis, axis 0..2 = (dispX, height, dispZ), each range-faded. This is the
   * layout `createBandKinematics` in `oceanBuoyancy.ts` reads.
   */
  readonly nowOffset: number;
  /** The same, at the first grid point given by `setPreviousGrids`. */
  readonly prevOffset: number;
  /** The same, at the second grid point given by `setPreviousGrids`. */
  readonly prev2Offset: number;
  /** Set query slot `i` to world XZ, meters. */
  setQuery(i: number, xM: number, zM: number): void;
  /**
   * Set the two grid points whose per-band displacement a kinematic slot
   * also returns: the previous sample's grid point and the one before it.
   * A sample's grid point is its query point minus its summed horizontal
   * displacement.
   */
  setPreviousGrids(i: number, g1xM: number, g1zM: number, g2xM: number, g2zM: number): void;
  /**
   * Dispatch the sampler against the sea's CURRENT `disp` buffers and read
   * the result back. Resolves with `capacity * 4` floats, then the
   * kinematic slots' per-band samples (see `nowOffset`): per slot
   * (dispX, height, dispZ, foamDeficit), where height is the surface height
   * above the query point and dispX/dispZ the displacement of the grid point
   * that landed there. foamDeficit is the range-faded sum of (1 - Jacobian)
   * over the foam-driving cascades: informational, so a body can know it is
   * in a whitecap.
   *
   * One call in flight at a time. A second call before the first resolves
   * throws: two readbacks of one buffer race, and the loser would read the
   * other's frame.
   */
  sample(renderer: THREE.WebGPURenderer): Promise<Float32Array>;
  /**
   * Enqueue the sampler only, with no readback. For a benchmark that wants
   * the kernel's GPU cost without the map latency in the way; `sample` is
   * this followed by the readback.
   */
  dispatch(renderer: THREE.WebGPURenderer): void;
  readonly inFlight: boolean;
  /** Move the sampling center with `surface.setCenter`. Defaults to 0, 0. */
  setCenter(xM: number, zM: number): void;
  dispose(): void;
}

/**
 * Build a sampler over a sea.
 *
 * @param field    the sea whose `disp` buffers to read.
 * @param capacity query slots. Sized once; a body that needs more is a new
 *                 probe, because the compute count is baked into the kernel.
 * @param kinematicSlots how many of the first slots also return per-band
 *                 displacement at the new and the two previous grid points.
 */
export function createOceanSurfaceProbe(
  field: OceanField,
  capacity: number,
  kinematicSlots = 0,
): OceanSurfaceProbe {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error(`[ocean] A surface probe needs at least one slot, got ${capacity}.`);
  }
  if (!Number.isInteger(kinematicSlots) || kinematicSlots < 0 || kinematicSlots > capacity) {
    throw new Error(`[ocean] Kinematic slots must be 0..${capacity}, got ${kinematicSlots}.`);
  }
  const bufs = field.buffers;
  const cascades: readonly CascadeParams[] = field.cascades;
  const n = bufs.n;
  log2Exact(n);
  const bands = cascades.length;
  const kinCount = kinematicSlots * bands;
  const total = capacity + 3 * kinCount;

  const outAttr = new THREE.StorageBufferAttribute(new Float32Array(total * 4), 4);
  const out = storage(outAttr, 'vec4', total);

  // One vec4 per slot: (x, z, 0, 0). The padded type of a uniform array is
  // vec4 whatever the element type, so vec4 costs nothing extra.
  const queries: THREE.Vector4[] = [];
  for (let i = 0; i < capacity; i += 1) queries.push(new THREE.Vector4(0, 0, 0, 0));
  const uQuery = uniformArray(queries, 'vec4');
  const uCenter = uniform(new THREE.Vector2(0, 0));
  // The second previous grid point of each kinematic slot, (x, z, 0, 0). A
  // uniform array cannot be empty, so a probe with no kinematic slots
  // carries one unused entry.
  const prev2: THREE.Vector4[] = [];
  for (let i = 0; i < Math.max(kinematicSlots, 1); i += 1) prev2.push(new THREE.Vector4(0, 0, 0, 0));
  const uPrev2 = uniformArray(prev2, 'vec4');

  /* --- the sea, read as the surface reads it (GG-273) ------------------ */

  const sampler = createOceanSampler(bufs, uCenter);
  const sampleCascade = (world: TslNode, cascadeIdx: number, patchM: number): TslNode => (
    sampler.sampleCascade(sampler.disp, world, cascadeIdx, patchM)
  );
  const cascadeLod = (world: TslNode, lod: CascadeParams['dispLod']): TslNode => sampler.cascadeLod(world, lod);

  /**
   * The summed, range-faded displacement of grid point `g`, as the vertex
   * stage sums it, plus the foam deficit in w.
   */
  const sumDisp = (g: TslNode): TslNode => {
    let acc: TslNode | null = null;
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const c = cascades[ci];
      const s = sampleCascade(g, ci, c.patchM);
      const lod = cascadeLod(g, c.dispLod);
      const d = vec4(
        s.x.mul(lod),
        s.y.mul(lod),
        s.z.mul(lod),
        c.drivesFoam ? float(1).sub(s.w).mul(lod) : float(0),
      );
      acc = acc === null ? d : acc.add(d);
    }
    return acc as TslNode;
  };

  /** One band's range-faded displacement at grid point `g`, w = 0. */
  const bandDisp = (g: TslNode, ci: number): TslNode => {
    const c = cascades[ci];
    const s = sampleCascade(g, ci, c.patchM);
    const lod = cascadeLod(g, c.dispLod);
    return vec4(s.x.mul(lod), s.y.mul(lod), s.z.mul(lod), float(0));
  };

  const kernel = Fn(() => {
    const q = uQuery.element(instanceIndex);
    const target = vec2(q.x, q.y).toVar();
    const g = vec2(q.x, q.y).toVar();
    const d = vec4(0, 0, 0, 0).toVar();
    for (let it = 0; it < OCEAN_PROBE_INVERSION_ITERATIONS; it += 1) {
      d.assign(sumDisp(g));
      g.assign(target.sub(vec2(d.x, d.z)));
    }
    d.assign(sumDisp(g));
    out.element(instanceIndex).assign(d);
    if (kinematicSlots > 0) {
      If(instanceIndex.lessThan(int(kinematicSlots)), () => {
        const gPrev = vec2(q.z, q.w);
        const q2 = uPrev2.element(instanceIndex);
        const gPrev2 = vec2(q2.x, q2.y);
        const base = int(instanceIndex).mul(int(bands));
        for (let ci = 0; ci < bands; ci += 1) {
          out.element(base.add(int(capacity + ci))).assign(bandDisp(g, ci));
          out.element(base.add(int(capacity + kinCount + ci))).assign(bandDisp(gPrev, ci));
          out.element(base.add(int(capacity + 2 * kinCount + ci))).assign(bandDisp(gPrev2, ci));
        }
      });
    }
  })().compute(capacity);

  let inFlight = false;
  let disposed = false;

  return {
    capacity,
    kinematicSlots,
    bands,
    nowOffset: capacity * 4,
    prevOffset: (capacity + kinCount) * 4,
    prev2Offset: (capacity + 2 * kinCount) * 4,
    get inFlight() {
      return inFlight;
    },
    setQuery(i, xM, zM) {
      if (i < 0 || i >= capacity) {
        throw new Error(`[ocean] Probe slot ${i} is outside 0..${capacity - 1}.`);
      }
      // x, z only: z and w of the vec4 carry a kinematic slot's previous
      // grid point (`setPreviousGrids`).
      queries[i].x = xM;
      queries[i].y = zM;
    },
    setPreviousGrids(i, g1xM, g1zM, g2xM, g2zM) {
      if (i < 0 || i >= kinematicSlots) {
        throw new Error(`[ocean] Slot ${i} is not a kinematic slot (0..${kinematicSlots - 1}).`);
      }
      queries[i].z = g1xM;
      queries[i].w = g1zM;
      prev2[i].set(g2xM, g2zM, 0, 0);
    },
    setCenter(xM, zM) {
      uCenter.value.set(xM, zM);
    },
    dispatch(renderer) {
      if (disposed) throw new Error('[ocean] The surface probe has been disposed.');
      renderer.compute(kernel as Parameters<THREE.WebGPURenderer['compute']>[0]);
    },
    async sample(renderer) {
      if (disposed) throw new Error('[ocean] The surface probe has been disposed.');
      if (inFlight) {
        throw new Error(
          '[ocean] A surface probe readback is already in flight. Await it before '
          + 'sampling again: two readbacks of one buffer race.',
        );
      }
      inFlight = true;
      try {
        renderer.compute(kernel as Parameters<THREE.WebGPURenderer['compute']>[0]);
        const raw = await (renderer as unknown as {
          getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
        }).getArrayBufferAsync(outAttr);
        return new Float32Array(raw);
      } finally {
        inFlight = false;
      }
    },
    dispose() {
      disposed = true;
      (kernel as { dispose?: () => void }).dispose?.();
    },
  };
}
