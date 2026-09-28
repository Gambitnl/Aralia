/** Exterior batching must preserve usable openings and canonical meter dimensions. */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildExteriorGeometry } from '../buildingExteriorGeometry';
import type { LoadedChunk } from '@/systems/world3d/types';

type Site = LoadedChunk['bundle']['sites'][number];
const site = (parts: Site['parts'], doorZSign = -1): Site => ({
  id: 'test-house', kind: 'ruin', localX: 0, localZ: 0, radius: 5,
  surfaceY: 0, walled: false, doorZSign, parts,
});

describe('town exterior batching', () => {
  it('keeps a five-foot doorway open while excluding rooms and neighbor-owned walls', () => {
    const part = { x: 0, z: 2, w: 1, d: 0.3, h: 3.048, colorHex: '#ddd0bb', tag: 'exterior' };
    const geometry = buildExteriorGeometry(site([
      { ...part, x: -1.262 }, { ...part, x: 1.262 },
      { ...part, z: 0, tag: undefined },
      { ...part, z: 4, renderRole: 'tactical-only' },
      { ...part, z: 6, tag: 'occupant' },
    ]));
    const wall = geometry.walls;
    expect(wall.getAttribute('position').count).toBe(72);
    wall.computeBoundingBox();
    expect(wall.boundingBox!.max.y).toBeCloseTo(3.048);
    // A ray through the door passes through, while either side meets masonry.
    const mesh = new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 0, 1));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    ray.ray.origin.x = 1.262;
    expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
    Object.values(geometry).forEach(g => g.dispose());
    (mesh.material as THREE.Material).dispose();
  });

  it('retains type motifs, separates lit windows and applies the canonical street flip', () => {
    const part = { x: 0, z: 2, w: 1, d: 0.2, h: 1, baseY: 1, colorHex: '#abcdef' };
    const geometry = buildExteriorGeometry(site([
      { ...part, tag: 'motif' },
      { ...part, lightRole: 'window' },
      { ...part, lightRole: 'hearth' },
    ], 1));
    expect(geometry.detail.getAttribute('position').count).toBe(36);
    expect(geometry.glass.getAttribute('position').count).toBe(36);
    geometry.glass.computeBoundingBox();
    expect(geometry.glass.boundingBox!.min.z).toBeCloseTo(-2.1);
    expect(geometry.glass.boundingBox!.min.y).toBeCloseTo(1);
    Object.values(geometry).forEach(g => g.dispose());
  });
});
