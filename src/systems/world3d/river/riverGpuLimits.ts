/** Keep the full river grid on the GPU. Request supported capacity explicitly;
 * a device's default limits do not automatically inherit its adapter's limits.
 * Admission happens before allocating or changing accepted water state.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/10/2026, 13:13:41
 * Dependents: components/World3D/water/riverReachScene.ts, systems/world3d/river/riverGpuResident.ts, systems/world3d/river/riverGpuStep.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const RIVER_GPU_GROUP_WIDTH = 65535;

export function riverGpuDispatch(groups: number): [number, number] {
  if (!Number.isSafeInteger(groups) || groups < 1 || groups > RIVER_GPU_GROUP_WIDTH ** 2) {
    throw new Error('River GPU dispatch dimensions are outside the supported range');
  }
  return [Math.min(groups, RIVER_GPU_GROUP_WIDTH), Math.ceil(groups / RIVER_GPU_GROUP_WIDTH)];
}

/**
 * MORE STEPS FOR EACH RESIDENT EXCHANGE (2026-10-27). A resident interval
 * holds up to this many steps. The source buffer's tail keeps 8 control
 * vec4s and 2 journal vec4s for each step. Each exchange reads back every
 * changed cell (about 7 MB on the warm seven-falls start), so a longer
 * interval spends less of each flow second on the exchange.
 */
export const RIVER_RESIDENT_MAX_STEPS = 32;
/** The source buffer's tail after the cells, in vec4s. */
export const RIVER_RESIDENT_TAIL = 8 + 2 * RIVER_RESIDENT_MAX_STEPS;

/**
 * The slots for an interval of `duration` s: the steps at the first step's
 * time step (as the device's begin stage takes it), plus two, from 1 to
 * RIVER_RESIDENT_MAX_STEPS. Every slot dispatches its stages, so unused
 * slots cost time; too few end the interval early, which is allowed.
 */
export function residentSlots(duration: number, maxDt: number, cfl: number, dx: number, wave: number): number {
  const dt = Math.min(maxDt, (cfl * dx) / Math.max(0.5, wave));
  const steps = Math.ceil(duration / dt) + 2;
  return Number.isFinite(steps) ? Math.max(1, Math.min(RIVER_RESIDENT_MAX_STEPS, steps)) : RIVER_RESIDENT_MAX_STEPS;
}

export function residentBufferSizes(nx: number, nz: number, slots = 8, history = false): number[] {
  const n = nx * nz;
  if (!Number.isSafeInteger(nx) || !Number.isSafeInteger(nz) || nx < 1 || nz < 1 || !Number.isSafeInteger(n)
    || n > 0xffffffff || !Number.isInteger(slots) || slots < 1 || slots > 8) throw new Error('Invalid resident river dimensions or interval capacity');
  const blocks = Math.ceil(n / 64), retained = history ? slots : 0;
  // Topology holds runs, proposed and accepted flags, and (2026-10-21) the
  // changed-cell marks that the resident session reads back; history follows.
  // The work list ends with one rebuild flag per row (2026-10-21).
  return [32, n * 16, n * (4 + retained) * 4, (2 * n + RIVER_RESIDENT_TAIL + blocks + n * retained) * 16,
    n * 16, n * 16, n * 16, n * 32, (2 * n + 3 * nz + 4) * 4];
}

type BufferLimits = Pick<GPUSupportedLimits, 'maxBufferSize' | 'maxStorageBufferBindingSize'>;

/** CPU-only views still work on smaller adapters. Unsupported GPU workloads
 * fail the explicit admission below; they never shrink or change the solver.
 * Include the synchronized path's three-field readback in the buffer request.
 */
export function riverRendererRequiredLimits(adapter: BufferLimits, nx: number, nz: number): Record<string, number> {
  const sizes = residentBufferSizes(nx, nz);
  const binding = Math.max(...sizes.slice(1));
  const buffer = Math.max(binding, nx * nz * 48);
  const requested: Record<string, number> = {};
  if (binding > 128 * 1024 ** 2 && binding <= adapter.maxStorageBufferBindingSize) requested.maxStorageBufferBindingSize = binding;
  if (buffer > 256 * 1024 ** 2 && buffer <= adapter.maxBufferSize) requested.maxBufferSize = buffer;
  return requested;
}

export function assertRiverGpuBufferSizes(device: BufferLimits, sizes: readonly number[], storageIndices: readonly number[]): void {
  const storage = new Set(storageIndices);
  sizes.forEach((size, index) => {
    if (!Number.isSafeInteger(size) || size < 1 || size > device.maxBufferSize) {
      throw new Error(`River GPU buffer ${index} requires ${size} bytes; device maxBufferSize is ${device.maxBufferSize}. Water state is unchanged.`);
    }
    if (storage.has(index) && size > device.maxStorageBufferBindingSize) {
      throw new Error(`River GPU binding ${index} requires ${size} bytes; device maxStorageBufferBindingSize is ${device.maxStorageBufferBindingSize}. Request supported adapter limits before device creation. Water state is unchanged.`);
    }
  });
}
