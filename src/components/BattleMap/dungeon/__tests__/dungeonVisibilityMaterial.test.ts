import {describe, expect, it} from 'vitest';
import {MeshStandardMaterial, Vector3} from 'three';
import {applyDungeonVisibility, createDungeonVisibilityUniforms, dungeonSightlineCoverage} from '../dungeonVisibilityMaterial';

describe('foreground structure sightline', () => {
  const target = new Vector3(0, 0, -8);
  it('cuts only structure between the eye and body', () => {
    expect(dungeonSightlineCoverage(new Vector3(0, 0, -4), target, 0.85)).toBe(0.95);
    for (const point of [new Vector3(0,0,-9), new Vector3(0,0,-8), new Vector3(0,0,1), new Vector3(2,0,-4)]) {
      expect(dungeonSightlineCoverage(point,target,0.85)).toBe(0);
    }
  });
  it('softens the edge and handles a camera at the target', () => {
    const edge = dungeonSightlineCoverage(new Vector3(0.7,0,-4),target,0.85);
    expect(edge).toBeGreaterThan(0); expect(edge).toBeLessThan(0.95);
    expect(dungeonSightlineCoverage(new Vector3(),new Vector3(),0.85)).toBe(0);
  });
  it('chains the existing stone shader and retains opaque shadows/depth behavior', () => {
    const material = new MeshStandardMaterial();
    material.onBeforeCompile = shader => {shader.uniforms.existingStone = {value: 1};};
    material.customProgramCacheKey = () => 'stone-existing';
    const uniforms = createDungeonVisibilityUniforms();
    applyDungeonVisibility(material,uniforms);
    const shader = {uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <alphatest_fragment>'};
    material.onBeforeCompile(shader as never,{} as never);
    expect(shader.uniforms).toMatchObject({existingStone:{value:1},dungeonSightEnabled:uniforms.dungeonSightEnabled});
    expect(shader.vertexShader).toContain('mvPosition.xyz');
    expect(shader.fragmentShader).toContain('discard;');
    expect(material.customProgramCacheKey()).toBe('stone-existing:dungeon-sightline-v1');
    expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true);
    expect(uniforms.dungeonSightEnabled.value).toBe(0);
  });
});
