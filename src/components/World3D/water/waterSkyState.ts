/**
 * @file waterSkyState.ts — the sky colors the world water reflects.
 *
 * World3DLighting computes the gradient sky (zenith and horizon) for the hour
 * and writes them here; the WebGPU water material (gpu/waterSurfaceNode.ts)
 * binds uniforms to these same Color objects. A plain module on purpose: the
 * lighting file is shared with WebGL pages, and importing the node material
 * there would pull the WebGPU build into those pages (agora-257c, 2026-10-27).
 */
import { Color } from 'three';

/** Mutated in place; the water's uniforms hold these exact objects. */
export const waterSky = {
  zenith: new Color(0x2f6fc8),
  horizon: new Color(0x9fc4e8),
};

/** Feed the reflected sky. Hex colors, as the lighting model computes them. */
export function setWaterSkyColors(zenith: number, horizon: number): void {
  waterSky.zenith.setHex(zenith);
  waterSky.horizon.setHex(horizon);
}
