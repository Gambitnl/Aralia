/**
 * @file oceanField.ts — the one object a caller needs.
 *
 * Build it, call `step(renderer, tSeconds)` once a frame, add `surface.mesh`
 * to a scene. Nothing else.
 *
 * TIME IS AN ARGUMENT, NOT A CLOCK. `step` takes an absolute simulation time
 * rather than a delta, and the pipeline holds no accumulated state. That is
 * the determinism guarantee: the surface is a pure function of (seed, time),
 * so two machines running the same voyage put the ship at the same height,
 * and a replay reproduces the sea exactly.
 */
import type * as THREE from 'three/webgpu';
import { DEFAULT_CASCADES, OCEAN_FFT_N, type CascadeParams } from './oceanConfig';
import { assertOceanCapable } from './oceanCapability';
import {
  buildOceanKernels,
  createOceanBuffers,
  type OceanGpuBuffers,
  type OceanKernels,
} from './oceanCompute';
import { createOceanSurface, type OceanSurface } from './oceanSurface';
import { significantWaveHeightM } from './oceanSpectrum';
import { oceanFeetFromMeters } from './oceanUnits';

export interface OceanFieldOptions {
  readonly seed?: number;
  readonly n?: number;
  readonly cascades?: readonly CascadeParams[];
  readonly meshSide?: number;
  readonly radiusM?: number;
  readonly sunDir?: THREE.Vector3;
}

export interface OceanField {
  readonly buffers: OceanGpuBuffers;
  readonly kernels: OceanKernels;
  readonly surface: OceanSurface;
  readonly cascades: readonly CascadeParams[];
  /** Combined significant wave height, FEET. Worldforge canon. */
  readonly significantWaveHeightFt: number;
  /** Combined significant wave height, meters. Internal, for shading. */
  readonly significantWaveHeightM: number;
  /** Number of compute dispatches per frame. */
  readonly dispatchesPerFrame: number;
  /**
   * Advance the sea to an absolute time. Enqueues every dispatch; does not
   * await. Awaiting each dispatch serializes the GPU — a lesson the fluid
   * work already paid for.
   */
  step(renderer: THREE.WebGPURenderer, tSeconds: number): void;
}

/**
 * Build the ocean. Throws if WebGPU is missing — see `oceanCapability.ts` for
 * why there is no second path.
 */
export async function createOceanField(
  opts: OceanFieldOptions = {},
): Promise<OceanField> {
  await assertOceanCapable();

  const cascades = opts.cascades ?? DEFAULT_CASCADES;
  const n = opts.n ?? OCEAN_FFT_N;
  const seed = opts.seed ?? 0x0cea9;

  if (cascades.length < 2) {
    throw new Error(
      `[ocean] Expected at least 2 cascades, got ${cascades.length}. One cascade `
      + 'reads as a single repeating swell rolling in one direction.',
    );
  }
  if (!cascades.some((c) => c.drivesFoam)) {
    throw new Error(
      '[ocean] At least one cascade must set drivesFoam. Foam comes from the '
      + 'folding Jacobian of the cascades steep enough to break; with none '
      + 'flagged the sea can never whiten.',
    );
  }
  if (!cascades.some((c) => c.dispLod.floor === 0)) {
    throw new Error(
      '[ocean] At least one cascade must have a displacement roll-off that '
      + 'reaches zero. That roll-off defines the range past which the mesh '
      + 'carries nothing but swell, and foam is keyed to it.',
    );
  }

  const { buffers, spectra } = createOceanBuffers(cascades, n, seed);
  const kernels = buildOceanKernels(buffers, cascades);

  // Variances add. Significant wave height is 4 sqrt(total variance).
  const m0 = spectra.reduce((s, sp) => s + sp.m0, 0);
  const hsM = significantWaveHeightM(m0);

  const surface = createOceanSurface(buffers, cascades, hsM, {
    side: opts.meshSide,
    radiusM: opts.radiusM,
    sunDir: opts.sunDir,
  });

  return {
    buffers,
    kernels,
    surface,
    cascades,
    significantWaveHeightFt: oceanFeetFromMeters(hsM),
    significantWaveHeightM: hsM,
    dispatchesPerFrame: kernels.dispatches.length,
    step(renderer: THREE.WebGPURenderer, tSeconds: number) {
      kernels.uTime.value = tSeconds;
      for (const d of kernels.dispatches) {
        renderer.compute(d.node as Parameters<THREE.WebGPURenderer['compute']>[0]);
      }
    },
  };
}
