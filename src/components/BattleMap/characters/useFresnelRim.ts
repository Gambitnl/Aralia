// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 12:23:27
 * Dependents: components/BattleMap/characters/characterActor/CharacterActor.tsx
 * Imports: 1 file
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file useFresnelRim.ts — view-dependent rim light plus status tint for
 * character models.
 *
 * GOAL #7 / 3d-combat-map G9: characters need edge highlighting so they
 * separate from terrain at tactical zoom. Postprocessing outlines are blocked
 * (gap #1, SSAO/NormalPass broken on this stack), so this patches the actor's
 * materials with a fresnel emissive term instead: silhouette edges catch a
 * backlight, faces toward the camera stay untouched.
 *
 * WHAT CHANGED (2026-09-09, agora-8aa9) and WHY:
 *
 * 1. **It is now actually wired up.** The hook shipped in task 73 but no
 *    caller ever imported it — `CharacterActor` created `modelGroupRef` for it
 *    and then never passed it in. Grep for `useFresnelRim` before this change
 *    found only this file. So the "current values" recorded in the task were
 *    never on screen.
 *
 * 2. **It patches `MeshToonMaterial` too, not only `MeshStandardMaterial`.**
 *    The actor body moved from box primitives (standard materials) to the
 *    generated entity system, whose surfaces are `MeshToonMaterial`
 *    (`systems/entities3d/three/toon.ts`). A standard-material-only patch
 *    would have matched zero meshes on a shipping actor.
 *
 * 3. **The injection point moved** from `<aomap_fragment>` / `reflectedLight`
 *    (a lit-shader-only stage that toon materials reach differently) to
 *    `<dithering_fragment>`, where `gl_FragColor` is final in BOTH material
 *    types. One patch, both surfaces.
 *
 * 4. **Existing `onBeforeCompile` is chained, never clobbered.**
 *    `toonMaterial()` installs its own subtle 0.12 rim there. Overwriting the
 *    callback would have silently deleted the base entity look everywhere the
 *    actor is drawn. The original is called first, then this patch is applied
 *    on top of whatever source it produced.
 *
 * 5. **A status tint / desaturation stage was added (G10)** in the same patch.
 *    Sharing one shader injection with the rim keeps this to a single program
 *    variant per actor, and the values ride in live uniform objects, so
 *    changing a character's condition or killing it updates the body WITHOUT
 *    a shader recompile.
 *
 * PRESERVED: material colors, team emissives, animation behavior, the base
 * toon rim, and the ink outline (a raw-GLSL `ShaderMaterial`, deliberately not
 * touched). The patch is additive at the final color stage and idempotent per
 * material.
 *
 * BURNING FLICKER (task agora-6ab9, 2026-09-20): `options.flicker` makes the
 * tint move. The hook runs its own `useFrame` and writes `uActorTintStrength`
 * straight into the live uniform, so a burning body pulses at 60 Hz WITHOUT
 * re-rendering React and without recompiling the program. The swing itself is
 * `flickerTintStrength` in `actorStatusShading.ts` — the palette file owns
 * every tint number, this file owns only the uniform write. `CharacterActor`
 * needed no change: it already forwards the whole `ActorBodyShading` object.
 *
 * KNOWN LIMIT: the WebGPU battle scene rebuilds `MeshToonMaterial` as node
 * materials (`three/gpu/gpuMaterialSwap.ts`), which drops any GLSL
 * `onBeforeCompile`. This patch therefore has no effect under `?gpu=1`. That
 * path needs a TSL twin the way the ink outline already has one.
 */
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { flickerTintStrength, type ActorTintFlicker } from './actorStatusShading';

/** Live shader inputs for one actor. Values are written in place, so a change
 * updates the drawn body without recompiling the program. */
interface RimUniforms {
  uActorRimColor: { value: THREE.Color };
  uActorRimIntensity: { value: number };
  uActorRimPower: { value: number };
  uActorTintColor: { value: THREE.Color };
  uActorTintStrength: { value: number };
  uActorDesat: { value: number };
}

/** What a caller asks for; see `actorStatusShading.ts` for the values used. */
export interface FresnelRimOptions {
  /** Fresnel edge color. */
  rimColor?: THREE.ColorRepresentation;
  /** Fresnel edge strength (0 = off). */
  rimIntensity?: number;
  /** Fresnel exponent — lower widens the band. */
  rimPower?: number;
  /** Status/defeat overlay hue, or null/undefined for none. */
  tintColor?: THREE.ColorRepresentation | null;
  /** How far the body moves toward `tintColor` (0..1). */
  tintStrength?: number;
  /** How far the body moves toward greyscale before tinting (0..1). */
  desaturate?: number;
  /** Per-frame swing for `tintStrength` (burning), or null for a steady tint. */
  flicker?: ActorTintFlicker | null;
}

/** Defaults match the pre-2026-09-09 constants, so an options-less caller gets
 * the original close-up look rather than a surprise. */
const DEFAULTS = {
  rimColor: 0xbfd8ff,
  rimIntensity: 0.75,
  rimPower: 2.6,
  tintColor: 0xffffff,
  tintStrength: 0,
  desaturate: 0,
} as const;

/**
 * Program cache key. Materials patched here inject extra source, so they must
 * NOT share a compiled program with unpatched materials of the same type. The
 * key is constant across actors on purpose: the injected source is identical
 * for all of them, and three keeps uniforms per material instance, so one
 * program serves every actor while each keeps its own tint.
 */
const CACHE_KEY = 'aralia-actor-rim-tint-v2';

/** True for the material types whose fragment shader ends in `gl_FragColor`
 * and includes a `<dithering_fragment>` hook — i.e. everything we can patch. */
function isPatchable(mat: THREE.Material): mat is THREE.MeshStandardMaterial | THREE.MeshToonMaterial {
  return mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshToonMaterial;
}

/**
 * Patch every patchable material under `groupRef` with a fresnel rim and a
 * status tint.
 *
 * @param groupRef  the actor's model group (NOT the chrome group — indicators,
 *                  decals and badges are deliberately left unpatched).
 * @param deps      change whenever the mesh tree is rebuilt (body plan /
 *                  character identity) so newly created materials get patched.
 * @param options   live shading values; changing these only writes uniforms.
 */
export function useFresnelRim(
  groupRef: React.RefObject<THREE.Group | null>,
  deps: ReadonlyArray<unknown>,
  options: FresnelRimOptions = {},
): void {
  // One uniform record per actor, created once. Every material this hook
  // patches shares these objects, so a single write retints the whole body.
  const uniformsRef = useRef<RimUniforms | null>(null);
  if (uniformsRef.current === null) {
    uniformsRef.current = {
      uActorRimColor: { value: new THREE.Color(DEFAULTS.rimColor) },
      uActorRimIntensity: { value: DEFAULTS.rimIntensity },
      uActorRimPower: { value: DEFAULTS.rimPower },
      uActorTintColor: { value: new THREE.Color(DEFAULTS.tintColor) },
      uActorTintStrength: { value: DEFAULTS.tintStrength },
      uActorDesat: { value: DEFAULTS.desaturate },
    };
  }
  const uniforms = uniformsRef.current;

  // --- live values -------------------------------------------------------
  // Written every render (cheap, allocation-free) rather than in an effect, so
  // the first frame after a character dies is already tinted.
  uniforms.uActorRimColor.value.set(options.rimColor ?? DEFAULTS.rimColor);
  uniforms.uActorRimIntensity.value = options.rimIntensity ?? DEFAULTS.rimIntensity;
  uniforms.uActorRimPower.value = options.rimPower ?? DEFAULTS.rimPower;
  uniforms.uActorTintColor.value.set(options.tintColor ?? DEFAULTS.tintColor);
  uniforms.uActorTintStrength.value = options.tintColor == null ? 0 : (options.tintStrength ?? 0);
  uniforms.uActorDesat.value = options.desaturate ?? DEFAULTS.desaturate;

  // --- animated tint (agora-6ab9) ----------------------------------------
  // The frame callback must not close over `options`, or it would pin the
  // first render's values for the life of the component. It reads this ref,
  // which every render refreshes in place.
  const animatedRef = useRef<{ base: number; flicker: ActorTintFlicker | null }>({
    base: 0,
    flicker: null,
  });
  animatedRef.current.base = uniforms.uActorTintStrength.value;
  animatedRef.current.flicker = options.tintColor == null ? null : options.flicker ?? null;

  useFrame((state) => {
    const { base, flicker } = animatedRef.current;
    // No flicker: the render write above already holds the steady value, so
    // there is nothing to do and nothing to undo.
    if (!flicker) return;
    uniforms.uActorTintStrength.value = flickerTintStrength(base, flicker, state.clock.elapsedTime);
  });

  // --- shader patch ------------------------------------------------------
  useEffect(() => {
    const root = groupRef.current;
    // jsdom/test environments mock R3F primitives as DOM nodes — no traverse.
    // (Caught by CharacterActor.defense.test.tsx; the guard is also correct
    // for any future non-three rendering of the actor.)
    if (!root || typeof root.traverse !== 'function') return;

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (!mat || !isPatchable(mat)) continue;
        if (mat.userData.araliaRimPatched) continue;
        mat.userData.araliaRimPatched = true;

        // Chain, do not clobber: toonMaterial() already owns this callback for
        // the base entity rim. Losing it would delete the shipping look.
        const previous = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
          previous?.call(mat, shader, renderer);
          shader.uniforms.uActorRimColor = uniforms.uActorRimColor;
          shader.uniforms.uActorRimIntensity = uniforms.uActorRimIntensity;
          shader.uniforms.uActorRimPower = uniforms.uActorRimPower;
          shader.uniforms.uActorTintColor = uniforms.uActorTintColor;
          shader.uniforms.uActorTintStrength = uniforms.uActorTintStrength;
          shader.uniforms.uActorDesat = uniforms.uActorDesat;
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              `#include <common>
               uniform vec3 uActorRimColor;
               uniform float uActorRimIntensity;
               uniform float uActorRimPower;
               uniform vec3 uActorTintColor;
               uniform float uActorTintStrength;
               uniform float uActorDesat;`,
            )
            .replace(
              // Final color stage. `normal` (view-space) and `vViewPosition`
              // are both still in scope here in standard AND toon shaders.
              '#include <dithering_fragment>',
              `{
                 // G10 status/defeat stage: greyscale first, then push toward
                 // the status hue at the fragment's own luminance so shading
                 // structure survives the tint.
                 vec3 aralia_c = gl_FragColor.rgb;
                 float aralia_lum = dot(aralia_c, vec3(0.2126, 0.7152, 0.0722));
                 aralia_c = mix(aralia_c, vec3(aralia_lum), uActorDesat);
                 aralia_c = mix(aralia_c, uActorTintColor * max(aralia_lum, 0.18), uActorTintStrength);
                 // G9 silhouette stage: rim goes on TOP of the tint so a
                 // defeated or poisoned body keeps its edge separation.
                 vec3 aralia_n = normalize(normal);
                 vec3 aralia_v = normalize(vViewPosition);
                 float aralia_rim = pow(1.0 - saturate(dot(aralia_n, aralia_v)), uActorRimPower);
                 gl_FragColor.rgb = aralia_c + uActorRimColor * aralia_rim * uActorRimIntensity;
               }
               #include <dithering_fragment>`,
            );
        };
        mat.customProgramCacheKey = () => CACHE_KEY;
        mat.needsUpdate = true;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
