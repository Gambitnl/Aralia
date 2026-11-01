/** Authored Aralia stone surfaces on the existing batched dungeon geometry.
 * UV projection follows buildingSurfaceUvs' physical projection, with larger underground courses. The
 * instance transform participates, so a tall wall never stretches one image. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:58:39
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import {townSurfaceTexture} from '../../World3D/townSurfaceTextures';

export function createDungeonSurfaceMaterial(surface: 'floor'|'wall', cellFeet: number): THREE.MeshStandardMaterial {
  const texture = townSurfaceTexture('stone');
  const material = new THREE.MeshStandardMaterial({
    // The authored asset is base color, not a calibrated height field.
    map: texture,
    // InstancedMesh supplies instanceColor independently. vertexColors would also
    // multiply an absent geometry.color attribute, leaving only specular highlights.
    color: '#ffffff', vertexColors: false,
    roughness: surface === 'wall' ? 0.88 : 0.8, metalness: 0,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.dungeonMetersPerCell = {value: cellFeet * 0.3048};
    shader.vertexShader = 'uniform float dungeonMetersPerCell;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      vec4 masonryPosition = vec4(position, 1.0);
      vec3 masonryNormal = normal;
      #ifdef USE_INSTANCING
        masonryPosition = instanceMatrix * masonryPosition;
        masonryNormal = normalize(mat3(instanceMatrix) * masonryNormal);
      #endif
      masonryPosition = modelMatrix * masonryPosition;
      masonryNormal = normalize(mat3(modelMatrix) * masonryNormal);
      vec3 masonryMeters = masonryPosition.xyz * dungeonMetersPerCell;
      vec2 masonryUv = vec2(abs(masonryNormal.x) > 0.5 ? masonryMeters.z : masonryMeters.x,
        abs(masonryNormal.y) > 0.5 ? masonryMeters.z : masonryMeters.y) / 8.0;
      #ifdef USE_MAP
        vMapUv = masonryUv;
      #endif
      #ifdef USE_BUMPMAP
        vBumpMapUv = masonryUv;
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'aralia-dungeon-masonry-v4';
  return material;
}
