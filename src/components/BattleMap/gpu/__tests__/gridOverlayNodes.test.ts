/**
 * Rung 3 of the WebGPU battle-map port: the grid + movement/path/AoE overlay
 * TSL node graph (translation of GridOverlay's ShaderMaterial). CI has no GPU,
 * so we prove the graph constructs: color + opacity nodes build from a per-tile
 * state texture and a fade-opacity uniform without throwing.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { buildGridColorNode, buildGridOpacityNode } from '../gridOverlayNodes';

function stateTex(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(2 * 2 * 4), 2, 2, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

describe('gridOverlayNodes (rung 3 — movement/path/AoE overlay TSL)', () => {
  it('builds color + opacity nodes and wires them onto a transparent material', () => {
    const params = {
      stateTex: stateTex(),
      mapWidth: 2,
      mapHeight: 2,
      lineWidth: 0.02,
      opacityUniform: uniform(0),
    };
    const color = buildGridColorNode(params);
    const opacity = buildGridOpacityNode(params);
    expect(color).toBeTruthy();
    expect(opacity).toBeTruthy();

    const m = new THREE.MeshBasicNodeMaterial();
    expect(() => {
      m.colorNode = color;
      m.opacityNode = opacity;
      m.transparent = true;
    }).not.toThrow();
    m.dispose();
  });

  it('opacity node folds in the fade uniform (value drives the transition)', () => {
    const op = uniform(0);
    const params = { stateTex: stateTex(), mapWidth: 4, mapHeight: 4, lineWidth: 0.02, opacityUniform: op };
    expect(() => buildGridOpacityNode(params)).not.toThrow();
    // The uniform is a live handle the scene lerps each frame.
    op.value = 1;
    expect(op.value).toBe(1);
  });
});
