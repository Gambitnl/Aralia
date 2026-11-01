/**
 * oceanDeviceLimits.ts — the device limits the ocean asks for (build-time
 * round 1, GG-388; see docs/architecture/domains/world3d-ocean.md "## Build
 * time").
 *
 * WHY. WebGPU gives a device the DEFAULT limits unless the page asks for
 * more, and the default is 16 sampled textures a shader stage. The surface's
 * fragment stage with foam, rocks and the river mouth reads 21 textures, so
 * its bind group layout was invalid and the page drew nothing ("The number of
 * sampled textures (21) in the Fragment stage exceeds the maximum per-stage
 * limit (16). This adapter supports a higher maxSampledTexturesPerShaderStage
 * of 48", 2026-10-09). The adapter on this machine allows 48.
 *
 * WHAT IT DOES. It reads the adapter's own limit and asks for it, up to
 * OCEAN_SAMPLED_TEXTURES_WANTED. A limit is a ceiling: a higher one changes
 * no shader and no pixel, it only lets a larger bind group validate. Samplers
 * stay at 16 on this machine (the adapter cannot raise them); the shared
 * samplers (oceanSharedSamplers.ts) keep a stage under that.
 *
 * WHAT IS KEPT. An adapter that allows only 16 gets 16; a stage that then
 * reads more fails with the browser's own message (one real path).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 04:22:12
 * Dependents: components/DesignPreview/steps/sidebyside/SideBySideOcean.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** The sampled textures a stage may need: the surface with every piece reads 21; 32 leaves room. */
export const OCEAN_SAMPLED_TEXTURES_WANTED = 32;

/**
 * The `requiredLimits` for `new WebGPURenderer({ requiredLimits })`. Asks the
 * same adapter three asks for (no power preference), so the limit is one that
 * adapter has. Empty when WebGPU is missing (the capability check reports it).
 */
export async function oceanRequiredLimits(): Promise<Record<string, number>> {
  const gpu = (globalThis.navigator as unknown as { gpu?: { requestAdapter(o?: object): Promise<{ limits: Record<string, number> } | null> } })?.gpu;
  if (!gpu) return {};
  const adapter = await gpu.requestAdapter({});
  if (!adapter) return {};
  const have = adapter.limits.maxSampledTexturesPerShaderStage;
  if (typeof have !== 'number') return {};
  return { maxSampledTexturesPerShaderStage: Math.min(have, OCEAN_SAMPLED_TEXTURES_WANTED) };
}
