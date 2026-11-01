/**
 * @file sharedAtmosphereTextures.ts
 * One load of the precomputed Bruneton atmosphere textures for the whole page
 * (GG-574, 2026-11-02).
 *
 * TakramSkySystem and VolumetricClouds each mount an R3F <Atmosphere>. With a
 * URL `textures` prop, each mount ran its own PrecomputedTexturesLoader: two
 * fetches and two EXR parses of the same five files. `setType(renderer)` also
 * picks FloatType on most GPUs, so each load then copied every texel from
 * Float16 to Float32 on the main thread. In headless Chrome on the World3D demo
 * the two loads took about 1.5 s of main-thread time (the copy alone 0.7 s).
 *
 * This module loads once, with HalfFloatType. The EXR files store half floats,
 * so HalfFloatType uploads the same values the Float32 copy held; only the copy
 * goes away. WebGL2 filters RGBA16F textures linearly, which the loader asks
 * for. <Atmosphere> uses an object prop as given and never disposes it, so the
 * textures live for the page, as the module caches of the town textures do.
 */
import { HalfFloatType } from 'three';
import { PrecomputedTexturesLoader, type PrecomputedTextures } from '@takram/three-atmosphere';

const loaded = new Map<string, PrecomputedTextures>();

/** The page's one set of atmosphere textures for `url`. Loads on first call. */
export function sharedAtmosphereTextures(url: string): PrecomputedTextures {
  let textures = loaded.get(url);
  if (!textures) {
    textures = new PrecomputedTexturesLoader({ type: HalfFloatType }).load(url);
    loaded.set(url, textures);
  }
  return textures;
}
