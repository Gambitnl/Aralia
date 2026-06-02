/**
 * textures.js — no-op stub for Aralia integration.
 *
 * The original ez-tree textures.js creates a global THREE.TextureLoader and
 * fires 20 texture loads at module evaluation time, which causes WebGL context
 * loss when imported inside a React Three Fiber <Canvas>. This stub removes
 * those side-effects entirely.
 *
 * EzTreeLayer.tsx overrides all materials with custom MeshStandardMaterial
 * anyway, so real textures are never needed.
 */

/**
 * @returns {null}
 */
export function getBarkTexture() {
  return null;
}

/**
 * @returns {null}
 */
export function getLeafTexture() {
  return null;
}
