/**
 * Rung 1 of the WebGPU battle-map port: the procedural terrain-texturing TSL
 * node graph (translation of the WebGL onBeforeCompile GLSL).
 *
 * Headless CI has no WebGPU device (see the probe report's "backend honesty"
 * note), so we cannot render this. What we CAN prove without a GPU is that the
 * translation constructs a real, buildable TSL node graph — that the Fn/Loop/If
 * builders don't throw, the texture-driven dispatch composes, and the returned
 * node exposes the node interface the material pipeline consumes. That is the
 * meaningful non-visual gate for the node-graph translation.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrainAlbedoNode, terrainFlatNormalNode } from '../terrainColorNode';

function fakeTypeTex(): THREE.DataTexture {
  const data = new Uint8Array(2 * 2 * 4);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

describe('terrainColorNode (rung 1 — procedural terrain texturing TSL)', () => {
  it('builds a real TSL albedo node without a GPU', () => {
    const node = buildTerrainAlbedoNode({
      typeTex: fakeTypeTex(),
      mapWidth: 2,
      mapHeight: 2,
      dapple: 1.0,
    });
    expect(node).toBeTruthy();
    // Real TSL nodes are node objects that compose (.mul etc.) and build.
    expect(typeof node.build === 'function' || typeof node.mul === 'function').toBe(true);
  });

  it('composes into a MeshBasicNodeMaterial colorNode (lit)', () => {
    const albedo = buildTerrainAlbedoNode({
      typeTex: fakeTypeTex(),
      mapWidth: 4,
      mapHeight: 4,
      dapple: 0.0,
    });
    const m = new THREE.MeshBasicNodeMaterial();
    // The scene multiplies the albedo by baked irradiance; assert the chain works.
    expect(() => {
      m.colorNode = albedo.mul(terrainFlatNormalNode().y.add(0.5));
    }).not.toThrow();
    expect(m.colorNode).toBeTruthy();
    m.dispose();
  });

  it('handles the no-dapple (open/underground biome) branch', () => {
    expect(() =>
      buildTerrainAlbedoNode({ typeTex: fakeTypeTex(), mapWidth: 8, mapHeight: 6, dapple: 0 }),
    ).not.toThrow();
  });
});
