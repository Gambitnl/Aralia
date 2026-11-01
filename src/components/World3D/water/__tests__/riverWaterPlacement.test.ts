import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { moveCamera } from '../riverWaterLayer';

describe('river water placement (moveCamera)', () => {
  it('keeps every view-space position when the camera and the scene move together', () => {
    const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 3000);
    cam.position.set(1200, 940, -800);
    cam.lookAt(1260, 925, -760);
    cam.updateMatrixWorld();
    const offset = new THREE.Vector3(1180, 921.5, -790);
    const local = moveCamera(cam, new THREE.PerspectiveCamera(), -1, offset);
    const worldPoint = new THREE.Vector3(1250, 922.4, -770);
    const localPoint = worldPoint.clone().sub(offset);
    const a = worldPoint.clone().applyMatrix4(cam.matrixWorldInverse);
    const b = localPoint.clone().applyMatrix4(local.matrixWorldInverse);
    expect(b.distanceTo(a)).toBeLessThan(1e-6);
    expect(local.projectionMatrix.equals(cam.projectionMatrix)).toBe(true);
  });

  it('moves a river-local camera back into the world', () => {
    const local = new THREE.PerspectiveCamera(55, 1, 0.3, 3000);
    local.position.set(20, 3, 10);
    local.lookAt(40, 1, 12);
    local.updateMatrixWorld();
    const offset = new THREE.Vector3(1180, 921.5, -790);
    const world = moveCamera(local, new THREE.PerspectiveCamera(), 1, offset);
    expect(world.position.clone().sub(offset).distanceTo(local.position)).toBeLessThan(1e-9);
    expect(world.quaternion.angleTo(local.quaternion)).toBeLessThan(1e-9);
  });
});
