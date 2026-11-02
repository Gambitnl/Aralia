/**
 * ADR 0009 steps 3-4: the TSL twins of the game world's WebGL-only shaders.
 *
 * Headless CI has no WebGPU device, so these graphs cannot be rendered here.
 * What CAN be proven without a GPU is that each factory builds a real node
 * material with the node slots the port depends on, that the twins keep the
 * WebGL material's fixed settings (side, blending, depth write, maps), and
 * that the host contracts (aimMaterial's uniform names, the wind clock
 * object) are honored. The rendered proof is the world3d rig shot under
 * `?gpu=1` (docs/architecture/domains/world3d-river-water.md).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeGradientSkyNodeMaterial, makeMoonNodeMaterial } from '../worldGpuSky';
import {
  makeTerrainSurfaceNoiseNodeMaterial,
  terrainSurfaceNoiseTint,
} from '../terrainSurfaceNoiseNode';
import { getWaterSurfaceNodeMaterial, resetWaterSurfaceNodeMaterialForTest } from '../waterSurfaceNode';
import { getRoadSurfaceNodeMaterial, resetRoadSurfaceNodeMaterialForTest } from '../roadSurfaceNode';
import { makeGrassWindNodeMaterial } from '../grassWindNode';
import { makeTreeTintNodeMaterial } from '../treeTintNode';
import { makeSubstanceGroundNodeMaterial } from '../substanceGroundNode';
import { TERRAIN_NOISE_OCTAVES } from '../../terrain/terrainSurfaceNoise';
import { vec2 } from 'three/tsl';

/* eslint-disable @typescript-eslint/no-explicit-any */
const isNode = (n: any) => n && (typeof n.build === 'function' || typeof n.mul === 'function');

describe('worldGpuSky (step 3)', () => {
  it('builds the gradient sky dome with the four live uniforms', () => {
    const sky = makeGradientSkyNodeMaterial();
    expect((sky.material as any).isNodeMaterial).toBe(true);
    expect(isNode(sky.material.colorNode)).toBe(true);
    expect(sky.material.side).toBe(THREE.BackSide);
    expect(sky.material.depthWrite).toBe(false);
    expect(sky.material.fog).toBe(false);
    // The host writes these exactly as it wrote the ShaderMaterial uniforms.
    sky.zenith.value.setHex(0x2f6fc8);
    sky.sunDir.value.set(0, 1, 0);
    expect(sky.zenith.value.getHex()).toBe(0x2f6fc8);
    expect(sky.sunDir.value.y).toBe(1);
  });

  it('builds the additive moon with opacity and sun uniforms', () => {
    const moon = makeMoonNodeMaterial();
    expect(isNode(moon.material.colorNode)).toBe(true);
    expect(isNode(moon.material.opacityNode)).toBe(true);
    expect(moon.material.blending).toBe(THREE.AdditiveBlending);
    expect(moon.material.transparent).toBe(true);
    expect(moon.material.depthWrite).toBe(false);
    moon.opacity.value = 0.25;
    expect(moon.opacity.value).toBe(0.25);
  });
});

describe('terrainSurfaceNoiseNode (step 4)', () => {
  it('builds the tint graph from the WebGL octave table', () => {
    expect(TERRAIN_NOISE_OCTAVES.length).toBe(4);
    const tint = terrainSurfaceNoiseTint(vec2(1.0, 2.0));
    expect(isNode(tint)).toBe(true);
  });

  it('keeps the JSX material settings on the node twin', () => {
    const map = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    const m = makeTerrainSurfaceNoiseNodeMaterial({
      map,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.95,
      flatShading: true,
    });
    expect(isNode(m.colorNode)).toBe(true);
    expect(m.vertexColors).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.map).toBe(map);
    expect(m.flatShading).toBe(true);
    expect(m.roughness).toBe(0.95);
  });
});

describe('waterSurfaceNode (step 4)', () => {
  it('is one shared material with the depth ramps in nodes, not in vertexColors', () => {
    resetWaterSurfaceNodeMaterialForTest();
    const m = getWaterSurfaceNodeMaterial();
    expect(getWaterSurfaceNodeMaterial()).toBe(m);
    expect(isNode(m.colorNode)).toBe(true);
    expect(isNode(m.opacityNode)).toBe(true);
    expect(isNode(m.emissiveNode)).toBe(true);
    expect(m.vertexColors).toBe(false);
    expect(m.transparent).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.normalMap).toBeTruthy();
    expect(m.roughness).toBeCloseTo(0.12);
    expect(m.metalness).toBeCloseTo(0.25);
    resetWaterSurfaceNodeMaterialForTest();
  });
});

describe('roadSurfaceNode (agora-257c)', () => {
  it('is one shared material that draws color and roughness from road space, not vertex colors', () => {
    resetRoadSurfaceNodeMaterialForTest();
    const m = getRoadSurfaceNodeMaterial();
    expect(getRoadSurfaceNodeMaterial()).toBe(m);
    expect(isNode(m.colorNode)).toBe(true);
    expect(isNode(m.roughnessNode)).toBe(true);
    expect(m.vertexColors).toBe(false);
    resetRoadSurfaceNodeMaterialForTest();
  });
});

describe('grassWindNode and treeTintNode (step 4)', () => {
  it('builds the grass twin with the WebGL settings and a setupPosition override', () => {
    const wind = { value: 0 };
    const m = makeGrassWindNodeMaterial(wind) as any;
    expect(m.isNodeMaterial).toBe(true);
    expect(m.vertexColors).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.roughness).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(m), 'setupPosition')).toBe(true);
  });

  it('clones keep the wind clock and the bark blend (three clones through the bare constructor)', () => {
    const wind = { value: 0.5 };
    const grass = makeGrassWindNodeMaterial(wind) as any;
    const grassClone = grass.clone();
    expect(grassClone.wind).toBe(wind);
    const tree = makeTreeTintNodeMaterial(0.25) as any;
    const treeClone = tree.clone();
    expect(treeClone.barkTintBlend).toBe(0.25);
  });

  it('builds the tree twin with the WebGL settings and a setupDiffuseColor override', () => {
    const m = makeTreeTintNodeMaterial(0.25) as any;
    expect(m.isNodeMaterial).toBe(true);
    expect(m.vertexColors).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.roughness).toBe(0.95);
    expect(Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(m), 'setupDiffuseColor')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(m), 'setupPosition')).toBe(true);
  });
});

describe('substanceGroundNode (step 4)', () => {
  it('builds color, normal and roughness nodes and keeps the aimMaterial contract', () => {
    const m = makeSubstanceGroundNodeMaterial();
    expect(isNode(m.colorNode)).toBe(true);
    expect(isNode(m.normalNode)).toBe(true);
    expect(isNode(m.roughnessNode)).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.roughness).toBe(1);
    // VolumeGroundBubble.aimMaterial writes these four by name.
    const shader = m.userData.shader as { uniforms: Record<string, { value: unknown }> };
    expect(shader).toBeTruthy();
    (shader.uniforms.uShift.value as THREE.Vector3).fromArray([1, 2, 3]);
    (shader.uniforms.uGridOrigin.value as THREE.Vector3).fromArray([4, 5, 6]);
    shader.uniforms.uCellM.value = 0.5;
    shader.uniforms.uTintMix.value = 1;
    expect((shader.uniforms.uShift.value as THREE.Vector3).z).toBe(3);
    expect(shader.uniforms.uCellM.value).toBe(0.5);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
