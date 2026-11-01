/**
 * THE GAME WORLD ON WEBGPU, STAGED (ADR 0009, 2026-10-26).
 *
 * `?gpu=1` draws the game's 3D world (World3DScene) with three's
 * WebGPURenderer; `?gpu=0` or no flag keeps the WebGL renderer. It is the same
 * switch as the battle map's (webgpuBattleMapFlag.ts), so one flag moves the
 * whole game to one renderer. The flag exists only while the world's WebGL
 * shaders are ported to TSL; when every part draws, WebGPU becomes the only
 * path and this file goes away (ADR 0009: no fallback in the end state).
 */
export const WEBGPU_WORLD_DEFAULT = false;

export function isWebGpuWorldEnabled(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return WEBGPU_WORLD_DEFAULT;
  try {
    const gpu = new URLSearchParams(window.location.search).get('gpu');
    if (gpu === '1' || gpu === 'true') return true;
    if (gpu === '0' || gpu === 'false') return false;
  } catch {
    // A real navigation's search string always parses; stay on the default.
  }
  return WEBGPU_WORLD_DEFAULT;
}
