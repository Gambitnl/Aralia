// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 14:23:42
 * Dependents: components/DesignPreview/steps/sidebyside/SideBySideOcean.tsx, systems/world3d/ocean/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/**
 * A TSL node expression. See `oceanSurface.ts` for why this is `any`: three
 * 0.172 ships no type that names every concrete node class an expression can
 * produce.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

export interface OceanFieldOptions {
  readonly seed?: number;
  readonly n?: number;
  readonly cascades?: readonly CascadeParams[];
  readonly meshSide?: number;
  readonly radiusM?: number;
  readonly sunDir?: THREE.Vector3;
  /**
   * Weather, passed straight through to the surface. `overcast` is the sky's
   * own `uniform(number)` node (`OceanSky.uOvercast`), 0 fair to 1 storm
   * deck, so one value drives the deck and the water under it.
   * `rainSlopeVariance` is a `uniform(number)` of the mean-square slope rain
   * adds (`rainSlopeVariance` in oceanRainMath.ts). Both omitted, the sea is
   * fair weather and the shader is unchanged.
   */
  readonly overcast?: TslNode;
  readonly rainSlopeVariance?: TslNode;
  /**
   * The baked clouds the water reflects: `OceanSky.cloudReflTexture`, the
   * blurred copy. Omitted, the water reflects the clear-sky gradient only.
   */
  readonly skyClouds?: THREE.Texture;
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
    overcast: opts.overcast,
    rainSlopeVariance: opts.rainSlopeVariance,
    skyClouds: opts.skyClouds,
    // The FFT's own clock, so the surface's far texture drifts with the sea.
    time: kernels.uTime,
  });

  /* ONE COMPUTE CALL PER FRAME (performance pass, 2026-09-25).
   *
   * Every dispatch of the step goes to ONE `renderer.compute(list)` call:
   * the FFT (pack, 8 + 8 Stockham stages, unpack), then the surface's normal
   * mip chain. three 0.172 opens one compute pass for the list, dispatches
   * each node in order, and submits once. It used to be one call per node,
   * 27 a frame, and each call pays its own command encoder, pass and submit
   * on the CPU: the spray piece measured about half a millisecond a call.
   *
   * WHY THIS IS SAFE. The hazard `oceanCompute.ts` documents is a uniform
   * written between dispatches of one submit: every write lands before the
   * submit runs, so all dispatches see the last value. Nothing here writes a
   * uniform between dispatches. Each Stockham stage and each mip level is its
   * own compiled kernel with its constants baked in, and the one per-frame
   * uniform, the clock, is written once before the call. WebGPU makes each
   * dispatch's storage writes visible to the next dispatch in the same pass,
   * so the stage order is kept. The GPU work is the same; the CPU work is not.
   */
  const stepNodes = [
    ...kernels.dispatches.map((d) => d.node),
    // The surface's own passes, after the FFT has written the normal: the
    // mip chain the fragment shader reads at range. See oceanNormalMip.ts.
    ...surface.dispatches,
  ] as unknown as Parameters<THREE.WebGPURenderer['compute']>[0];
  // Measured in the viewer's A/B rig, the old path against this one, in the
  // same minutes (perf iteration 1): the sea's step went from 6.9 ms to 0.2 ms
  // of CPU a frame in the open-sea scene, overall frame time fell 16.7%
  // across five scenes, and the pinned frames did not change (0 pixels over
  // 8/255). The frame now waits on the GPU, not on this call.

  return {
    buffers,
    kernels,
    surface,
    cascades,
    significantWaveHeightFt: oceanFeetFromMeters(hsM),
    significantWaveHeightM: hsM,
    dispatchesPerFrame: kernels.dispatches.length + surface.dispatches.length,
    step(renderer: THREE.WebGPURenderer, tSeconds: number) {
      kernels.uTime.value = tSeconds;
      renderer.compute(stepNodes);
    },
  };
}
