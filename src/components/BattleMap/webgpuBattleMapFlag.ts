/**
 * @file webgpuBattleMapFlag.ts
 * @description Opt-in switch for the experimental WebGPU render path of the 3D
 * battle map (beautification wave, WebGPU migration — spec
 * docs/superpowers/specs/2026-07-02-world-beautification-wave.md §8).
 *
 * WebGL remains the DEFAULT. This slice does NOT flip the default. The WebGPU
 * path is reached only when explicitly requested:
 *   - URL param `?gpu=1` (or `&gpu=1`) — the eyeball/verification trigger, OR
 *   - the module-level `WEBGPU_BATTLE_MAP_DEFAULT` flag below (kept `false`).
 *
 * NO FALLBACK (Remy's rule): the WebGPU scene, once selected, constructs a real
 * `WebGPURenderer` and fails loudly if the device can't provide WebGPU — it does
 * not silently drop back to the WebGL battle map. The choice of PATH is explicit
 * (the flag); the renderer within a path is one real path.
 */

/**
 * Compile-time default for the WebGPU battle-map path. Intentionally `false`:
 * this slice adds the path behind an opt-in and does not change what players get.
 * Flip to `true` only once the real-GPU eyeball has signed off parity.
 */
export const WEBGPU_BATTLE_MAP_DEFAULT = false;

/**
 * Whether the WebGPU battle-map render path is active for this session.
 * Reads `?gpu=1` from the URL (browser only), else the compile-time default.
 * Pure/guarded so it is safe to call in SSR/test environments.
 */
export function isWebGpuBattleMapEnabled(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return WEBGPU_BATTLE_MAP_DEFAULT;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const gpu = params.get('gpu');
    if (gpu === '1' || gpu === 'true') return true;
    if (gpu === '0' || gpu === 'false') return false;
  } catch {
    // URL parsing should never throw for real navigations; be defensive anyway.
  }
  return WEBGPU_BATTLE_MAP_DEFAULT;
}
