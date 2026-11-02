/**
 * @file cloudsSceneEdgeResolve.ts
 * @description The cloud history may only cross pixels that look at open sky.
 *
 * What this fixes (Remy, 2026-10-29): tree crowns got a white rim whenever the
 * camera turned. A settled frame at the same pose had no rim.
 *
 * Cause, measured on the GPU buffers of @takram/three-clouds 0.7.3:
 * - The cloud pass writes a premultiplied cloud layer (rgb, alpha). Over open
 *   sky the haze makes alpha about 0.97, and that haze color IS the dark dusk
 *   sky the player sees. Under it, the scene draws a much brighter
 *   GradientSky dome.
 * - Over scene geometry (a leaf) the ray march stops at the leaf, so the layer
 *   there is only thin haze with alpha about 0.05.
 * - The resolve pass blends 90% reprojected history into every pixel
 *   (temporalAlpha 0.1). It limits that history to a variance box from the
 *   3x3 neighborhood. At a crown silhouette the box holds both the leaf and the
 *   sky, so it accepts almost anything. In motion, the bilinear history fetch
 *   pulls leaf alpha into the sky pixels at the rim: alpha fell from 0.97 to
 *   0.66 there. The composite `scene * (1 - a) + cloud` then shows the bright
 *   GradientSky through the hole, which reads as a white glow.
 *
 * The rule: a pixel uses cloud history only if its whole 3x3 neighborhood
 * looks at open sky. A pixel on or next to scene geometry takes this frame's
 * cloud value. That costs nothing visible: over geometry the march has no
 * clouds to march, only smooth haze, so there is no ray-march noise for the
 * history to average. Open-sky pixels keep the full temporal filter, which the
 * cloud noise needs. Pixels one step further out keep a variance box from sky
 * neighbors only, so the box itself clamps any leaf history away.
 *
 * "Looks at open sky" uses the cloud march's own test (scene depth
 * >= 1 - 1e-7 at `vUv * targetUvScale + temporalJitter`), through the same
 * uniform objects, so the resolve and the march can never disagree.
 *
 * Scope: the full-resolution TAA path (`temporalUpscale` false). Every
 * `<Clouds>` in the game must pass `temporalUpscale={false}` and
 * `ref={cloudsSceneEdgeRef}`: VolumetricClouds (the scene composer) and
 * TakramSkySystem's own composer. The test
 * `__tests__/cloudsSceneEdgeResolve.test.ts` fails if either one drops them.
 * The quarter-resolution upscale path is left as the library ships it; this
 * helper reports an error if asked to patch it.
 * The WebGPU world has no clouds yet (ADR 0009 step 7), so it has no such pass.
 */
import { RGBADepthPacking } from 'three';
import type { CloudsEffect } from '@takram/three-clouds';

type CloudsPass = CloudsEffect['cloudsPass'];
type ResolveMaterial = CloudsPass['resolveMaterial'];

const PATCHED = '__araliaSceneEdgeResolve';

/** Helpers placed before the library's getClosestFragment (after neighborOffsets). */
const PRELUDE_ANCHOR = 'vec4 getClosestFragment(const ivec2 coord) {';
const PRELUDE = /* glsl */ `
// Aralia scene/sky edge rule (src/components/World3D/sky/cloudsSceneEdgeResolve.ts).
uniform sampler2D araliaSceneDepthBuffer;
uniform vec2 araliaTargetUvScale;
uniform vec2 araliaTemporalJitter;

#if ARALIA_DEPTH_PACKING == ${RGBADepthPacking}
#include <packing>
#endif

// The cloud march's own scene test, at the same depth texel it read.
bool araliaIsScene(const ivec2 c) {
  vec2 uv = (vec2(c) + 0.5) * texelSize * araliaTargetUvScale + araliaTemporalJitter;
  #if ARALIA_DEPTH_PACKING == ${RGBADepthPacking}
  float depth = unpackRGBAToDepth(texture(araliaSceneDepthBuffer, uv));
  #else
  float depth = texture(araliaSceneDepthBuffer, uv).r;
  #endif
  return depth < 1.0 - 1e-7;
}

bool araliaTouchesScene(const ivec2 coord) {
  for (int i = 0; i < 9; ++i) {
    if (araliaIsScene(coord + neighborOffsets[i])) {
      return true;
    }
  }
  return false;
}

`;

/** The full-resolution TAA function's current-frame fetch (unique to it). */
const TAA_ANCHOR = `void temporalAntialiasing(const ivec2 coord, out vec4 outputColor, out float outputShadowLength) {
  vec4 currentColor = texelFetch(colorBuffer, coord, 0);
  #ifdef SHADOW_LENGTH
  vec4 currentShadowLength = vec4(texelFetch(shadowLengthBuffer, coord, 0).rgb, 1.0);
  #endif // SHADOW_LENGTH
`;
const TAA_REJECT = `
  // Aralia: no history on or next to scene geometry (see the rule above).
  if (araliaTouchesScene(coord)) {
    outputColor = currentColor;
    #ifdef SHADOW_LENGTH
    outputShadowLength = currentShadowLength.r;
    #endif // SHADOW_LENGTH
    return;
  }
`;

/**
 * Patch the clouds resolve shader so its history stops at the scene/sky edge.
 * Idempotent. Returns false (and logs why) if the installed library no longer
 * has the shader text this rule hooks into; the clouds then render as the
 * library ships them, with the rim, rather than with a guessed patch.
 */
export function applyCloudsSceneEdgeResolve(effect: CloudsEffect): boolean {
  const pass = effect.cloudsPass;
  const resolve = pass.resolveMaterial as ResolveMaterial & { [PATCHED]?: true };
  if (resolve[PATCHED]) return true;

  if (resolve.temporalUpscale) {
    console.error('[clouds] scene-edge resolve covers the temporalUpscale={false} path only; the rim stays.');
    return false;
  }
  const source = resolve.fragmentShader;
  if (!source.includes(PRELUDE_ANCHOR) || !source.includes(TAA_ANCHOR)) {
    console.error('[clouds] @takram/three-clouds resolve shader changed; scene-edge resolve not applied.');
    return false;
  }

  const current = pass.currentMaterial;
  // Share the march's uniform OBJECTS, not their values: setDepthTexture and
  // the per-frame jitter update write `.value`, and the resolve must follow.
  resolve.uniforms.araliaSceneDepthBuffer = current.uniforms.depthBuffer;
  resolve.uniforms.araliaTargetUvScale = current.uniforms.targetUvScale;
  resolve.uniforms.araliaTemporalJitter = current.uniforms.temporalJitter;

  resolve.fragmentShader = source
    .replace(PRELUDE_ANCHOR, PRELUDE + PRELUDE_ANCHOR)
    .replace(TAA_ANCHOR, TAA_ANCHOR + TAA_REJECT);
  resolve.defines.ARALIA_DEPTH_PACKING = String(current.depthPacking);
  resolve.needsUpdate = true;

  // The composer may hand the march a depth texture with another packing
  // after this patch; keep the resolve's depth read in step with the march's.
  const previous = resolve.onBeforeRender;
  resolve.onBeforeRender = function (...args) {
    const packing = String(current.depthPacking);
    if (resolve.defines.ARALIA_DEPTH_PACKING !== packing) {
      resolve.defines.ARALIA_DEPTH_PACKING = packing;
      resolve.needsUpdate = true;
    }
    previous.apply(this, args);
  };

  resolve[PATCHED] = true;
  return true;
}

/**
 * The `<Clouds ref>` for every cloud setup. The r3f `<Clouds>` ref is the
 * CloudsEffect itself. A module-level function is stable, so React calls it
 * once per effect instance; the patch is idempotent anyway.
 */
export function cloudsSceneEdgeRef(effect: CloudsEffect | null): void {
  if (effect) applyCloudsSceneEdgeResolve(effect);
}
