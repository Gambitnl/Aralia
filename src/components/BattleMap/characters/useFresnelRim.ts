/**
 * @file useFresnelRim.ts — view-dependent rim light for character models.
 *
 * GOAL #7 (.agent/GOAL-3d-visual-quality.md): characters need edge
 * highlighting so they separate from terrain at tactical zoom — the last
 * character-readability FAIL. Postprocessing outlines are blocked (gap #1,
 * SSAO/NormalPass broken on this stack), so this patches the existing
 * MeshStandardMaterials with a fresnel emissive term instead: silhouette
 * edges catch a cool backlight, faces toward the camera stay untouched.
 *
 * What changed: new hook (task 73), applied to the actor's model group only —
 * indicators/decals/badges outside that group are deliberately not patched.
 * Preserved: material colors, team emissives, animation behavior; the patch
 * is additive in the shader's emissive stage and idempotent per material.
 */
import { useEffect } from 'react';
import * as THREE from 'three';

const RIM_COLOR = new THREE.Color(0xbfd8ff); // cool backlight, biome-neutral
const RIM_INTENSITY = 0.75; // tuned: 0.38 invisible in bright biomes, 1.4 washes armor color (rim-diag-desert.png)
const RIM_POWER = 2.6;

/**
 * Patch every MeshStandardMaterial under `groupRef` with a fresnel rim.
 * `deps` should change whenever the model's mesh tree is rebuilt (body plan /
 * character identity) so newly created materials get patched too.
 */
export function useFresnelRim(
  groupRef: React.RefObject<THREE.Group | null>,
  deps: ReadonlyArray<unknown>,
): void {
  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
        if (mat.userData.araliaRimPatched) continue;
        mat.userData.araliaRimPatched = true;

        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uRimColor = { value: RIM_COLOR };
          shader.uniforms.uRimIntensity = { value: RIM_INTENSITY };
          shader.uniforms.uRimPower = { value: RIM_POWER };
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              `#include <common>
               uniform vec3 uRimColor;
               uniform float uRimIntensity;
               uniform float uRimPower;`,
            )
            .replace(
              // After lights_fragment_begin, `normal` (view-space, normalized)
              // and vViewPosition (fragment→camera) are both available.
              '#include <aomap_fragment>',
              `#include <aomap_fragment>
               {
                 vec3 rimViewDir = normalize(vViewPosition);
                 float rimTerm = pow(1.0 - saturate(dot(normal, rimViewDir)), uRimPower);
                 reflectedLight.indirectDiffuse += uRimColor * rimTerm * uRimIntensity;
               }`,
            );
        };
        // Distinct program cache key so patched materials don't collide with
        // unpatched MeshStandardMaterial programs elsewhere in the scene.
        mat.customProgramCacheKey = () => 'aralia-fresnel-rim-v1';
        mat.needsUpdate = true;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
