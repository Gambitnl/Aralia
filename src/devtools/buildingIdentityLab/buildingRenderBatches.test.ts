import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildingRenderBatches } from './buildingRenderBatches';
import type { BuildingSceneModel } from '@/systems/world3d/buildingSceneModel';

describe('building render batches', () => {
  it('preserves independent picking, positions and UVs after merging differently colored parts', () => {
    const boxes = [0, 10].map(x => ({ x, y: 0, z0: 0, w: 2, d: 2, h: 2, kind: 'wall', color: x ? '#ff0000' : '#ffffff' }));
    const sources = boxes.map(() => new THREE.BoxGeometry(2, 2, 2));
    const result = buildingRenderBatches({ boxes } as BuildingSceneModel, sources);
    expect(result.batches).toHaveLength(1);
    const batch = result.batches[0];
    expect(batch.owners).toEqual([...Array(12).fill(0), ...Array(12).fill(1)]);
    expect(batch.geometry.getAttribute('uv').count).toBe(72);
    expect(batch.geometry.getAttribute('color').count).toBe(72);
    const mesh = new THREE.Mesh(batch.geometry, new THREE.MeshBasicMaterial());
    for (const x of [0, 10]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 1, 5), new THREE.Vector3(0, 0, -1)).intersectObject(mesh);
      expect(hits.length).toBeGreaterThan(0);
      expect(batch.owners[hits[0].faceIndex!]).toBe(x ? 1 : 0);
    }
    expect(result.edges.getAttribute('position').count).toBe(48);
    expect(sources[1].getAttribute('position').getX(0)).toBe(1);
    result.dispose(); sources.forEach(source => source.dispose());
  });
  it('keeps emissive windows separate from opaque details', () => {
    const box = { x: 0, y: 0, z0: 0, w: 1, d: 1, h: 1, kind: 'window-pane', color: '#ffffff' };
    const sources = [new THREE.BoxGeometry(), new THREE.BoxGeometry()];
    const result = buildingRenderBatches({ boxes: [box, { ...box, emissive: '#ff8800', emissiveIntensity: 2 }] } as BuildingSceneModel, sources);
    expect(result.batches).toHaveLength(2);
    expect(result.batches.map(batch => batch.intensity)).toEqual([0, 2]);
    result.dispose(); sources.forEach(source => source.dispose());
  });
});
