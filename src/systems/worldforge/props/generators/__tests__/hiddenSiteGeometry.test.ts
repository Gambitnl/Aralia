import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCaveOverhangGeometry, createUnlitFirepitGeometry } from '../hiddenSiteGeometry';

describe('physical discovery-site cues', () => {
  it.each([createCaveOverhangGeometry, createUnlitFirepitGeometry])('has deterministic finite ground-relative geometry', create => {
    const a = create(41), b = create(41), c = create(42);
    expect(a.getAttribute('position').array).toEqual(b.getAttribute('position').array);
    expect(a.getAttribute('position').array).not.toEqual(c.getAttribute('position').array);
    expect(Array.from(a.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    expect(a.getAttribute('color').count).toBe(a.getAttribute('position').count);
    a.computeBoundingBox();
    expect(a.boundingBox!.min.y).toBeGreaterThan(-0.04);
    for (const g of [a, b, c]) g.dispose();
  });

  it('leaves the cave overhang opening visibly open at standing height', () => {
    const geometry = createCaveOverhangGeometry(41);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1.5, 4), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    ray.set(new THREE.Vector3(1.55, 1.5, 4), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('keeps the cold camp cue low rather than rendering flames or a tall obstruction', () => {
    const geometry = createUnlitFirepitGeometry(41);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeLessThan(0.32);
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(1.4);
    geometry.dispose();
  });
});
