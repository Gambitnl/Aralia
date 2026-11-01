/** Opens a small, stippled sightline through foreground dungeon structure.
 * This changes visible fragments only: source geometry, collision, shadows,
 * discovery and creature behavior remain owned by their existing systems. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 00:18:51
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, components/BattleMap/dungeon/DungeonIndirectLighting.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {Material, Vector3} from 'three';

export function createDungeonVisibilityUniforms() {
  return {
    dungeonSightTarget: {value: new Vector3()},
    dungeonSightRadius: {value: 0.85},
    dungeonSightEnabled: {value: 0},
  };
}
export type DungeonVisibilityUniforms = ReturnType<typeof createDungeonVisibilityUniforms>;

/** The camera is the origin in view space. Never cut behind the character or
 * beyond the narrow camera-to-body corridor, even when orbiting in a small room. */
export function dungeonSightlineCoverage(point: Vector3, target: Vector3, radius: number): number {
  const length = target.length();
  if (length < 0.2 || radius <= 0) return 0;
  const along = point.dot(target) / (length * length);
  if (along <= 0 || along >= 1 - 0.15 / length) return 0;
  const distance = point.distanceTo(target.clone().multiplyScalar(along));
  const t = Math.max(0, Math.min(1, (distance - radius * 0.55) / (radius * 0.45)));
  return 0.95 * (1 - t * t * (3 - 2 * t));
}

export function applyDungeonVisibility(material: Material, uniforms: DungeonVisibilityUniforms): void {
  const compile = material.onBeforeCompile.bind(material);
  const cacheKey = material.customProgramCacheKey.bind(material);
  const baseKey = cacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vDungeonSightPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvDungeonSightPosition = mvPosition.xyz;');
    shader.fragmentShader = `
      varying vec3 vDungeonSightPosition;
      uniform vec3 dungeonSightTarget;
      uniform float dungeonSightRadius;
      uniform float dungeonSightEnabled;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
      #include <alphatest_fragment>
      float sightLength = length(dungeonSightTarget);
      if (dungeonSightEnabled > 0.5 && sightLength > 0.2) {
        float alongSight = dot(vDungeonSightPosition, dungeonSightTarget) / (sightLength * sightLength);
        if (alongSight > 0.0 && alongSight < 1.0 - 0.15 / sightLength) {
          float sightDistance = length(vDungeonSightPosition - dungeonSightTarget * alongSight);
          float cutaway = 0.95 * (1.0 - smoothstep(dungeonSightRadius * 0.55, dungeonSightRadius, sightDistance));
          // A stable screen-space threshold keeps this an opaque depth-writing
          // material; no transparent sorting or whole-wall opacity changes.
          float screenThreshold = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
          if (screenThreshold < cutaway) discard;
        }
      }
    `);
  };
  material.customProgramCacheKey = () => baseKey + ':dungeon-sightline-v1';
  material.needsUpdate = true;
}
