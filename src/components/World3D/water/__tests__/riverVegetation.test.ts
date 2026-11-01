import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { createFarCanopyTrunks } from '../riverVegetation';

const root = (x: number, y: number, z: number, height: number) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.73),
  new THREE.Vector3(height * 0.9, height, height * 1.1),
);
const dispose = (mesh: THREE.InstancedMesh) => {
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
};

describe('optional far canopy trunks', () => {
  it('leaves the default forest alone and does not query non-far canopy roots', () => {
    const matrices = [root(1, 0, 2, 20), root(3, 0, 4, 4)];
    expect(createFarCanopyTrunks('broad', matrices, [0])).toBeNull();
    const queried: number[] = [];
    expect(createFarCanopyTrunks('broad', matrices, [0], x => { queried.push(x); return false; })).toBeNull();
    expect(queried).toEqual([1]);
  });

  it('retains each selected root transform and excludes shrubs and unselected far crowns', () => {
    const matrices = [root(-223.3554, 101.4808, 63.2519, 24.354), root(20, 5, 30, 4), root(40, 8, 50, 18)];
    const before = matrices.map(m => m.toArray());
    const mesh = createFarCanopyTrunks('conifer', matrices, [0, 2], x => x < 0)!;
    expect(mesh.count).toBe(1);
    expect(mesh.userData.farCanopyIndices).toEqual([0]);
    const actual = new THREE.Matrix4();
    mesh.getMatrixAt(0, actual);
    expect(actual.toArray()).toEqual(Array.from(Float32Array.from(before[0])));
    expect(matrices.map(m => m.toArray())).toEqual(before);
    expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
    expect(mesh.geometry.index!.count / 3).toBe(24);
    expect(mesh.boundingSphere!.radius).toBeGreaterThan(0);
    // The measured crown starts at 106.3516 m and ground is 101.9548 m.
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!.clone().applyMatrix4(actual);
    expect(box.min.y).toBeLessThan(101.9548);
    expect(box.max.y).toBeGreaterThan(106.3516);
    expect(box.max.y).toBeLessThan(101.4808 + 24.354 * 0.5);
    dispose(mesh);
  });

  it.each(['conifer', 'broad'] as const)('uses a narrow tapered %s stem reaching inside its lower crown', kind => {
    const mesh = createFarCanopyTrunks(kind, [root(0, -0.5, 0, 20)], [0], () => true)!;
    const p = mesh.geometry.getAttribute('position');
    let bottomRadius = 0, topRadius = 0, topY = 0;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), r = Math.hypot(p.getX(i), p.getZ(i));
      if (y < 1e-6) bottomRadius = Math.max(bottomRadius, r);
      else { topRadius = Math.max(topRadius, r); topY = Math.max(topY, y); }
    }
    expect(topRadius).toBeLessThan(bottomRadius * 0.5);
    expect(bottomRadius * 20 * 1.1).toBeLessThan(0.4);
    expect(topY).toBeGreaterThan(kind === 'conifer' ? 0.2 : 0.13);
    expect(topY).toBeLessThanOrEqual(0.5);
    dispose(mesh);
  });
});
