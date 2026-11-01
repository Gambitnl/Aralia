import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildMirrorMask, mirrorMaskHits } from '../riverMirrorMask';

// A camera 20 m above a flat water plane at y = 0, looking down the +x axis
// at 30 degrees; the mirror camera is its reflection in the plane.
function rig() {
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 2000);
  cam.position.set(0, 20, 0);
  cam.lookAt(60, 0, 0);
  cam.updateMatrixWorld();
  const refl = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 2000);
  refl.position.set(0, -20, 0);
  refl.up.set(0, -1, 0);
  refl.lookAt(60, 0, 0);
  refl.updateMatrixWorld();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, refl.matrixWorldInverse).elements;
  return { cam, vp };
}

// A 200 x 200 m grid at 1 m; a 10 m wide river along x at z = -5..5.
const grid = { nx: 200, nz: 200, dx: 1, x0: -20, z0: -100 };
function river(): Float32Array {
  const h = new Float32Array(grid.nx * grid.nz);
  for (let j = 0; j < grid.nz; j += 1) {
    const z = grid.z0 + (j + 0.5) * grid.dx;
    if (Math.abs(z) > 5) continue;
    for (let i = 0; i < grid.nx; i += 1) h[j * grid.nx + i] = 0.5;
  }
  return h;
}

describe('riverMirrorMask', () => {
  it('keeps a bank tree that the river reflects and drops a tree far to the side', () => {
    const { cam, vp } = rig();
    const m = buildMirrorMask(vp, cam.position, 0, grid, river());
    expect(m.full).toBe(false);
    expect(m.samples).toBeGreaterThan(100);
    // A 10 m tree 8 m from the river's center, 60 m ahead: its reflection
    // lies over the water.
    expect(mirrorMaskHits(m, vp, 60, 5, 8, 6)).toBe(true);
    // A tree 70 m to the side, 60 m ahead: in the mirror's frame, but no
    // water read reaches it.
    expect(mirrorMaskHits(m, vp, 60, 5, 70, 6)).toBe(false);
  });

  it('marks nothing for a dry grid', () => {
    const { cam, vp } = rig();
    const m = buildMirrorMask(vp, cam.position, 0, grid, new Float32Array(grid.nx * grid.nz));
    expect(m.samples).toBe(0);
    expect(mirrorMaskHits(m, vp, 60, 5, 8, 6)).toBe(false);
  });

  it('keeps a sphere that meets the eye plane', () => {
    const { cam, vp } = rig();
    const m = buildMirrorMask(vp, cam.position, 0, grid, new Float32Array(grid.nx * grid.nz));
    expect(mirrorMaskHits(m, vp, 0, -20, 0, 5)).toBe(true);
  });

  it('marks every flat read of every wet sample (conservative)', () => {
    const { cam, vp } = rig();
    const h = river();
    const m = buildMirrorMask(vp, cam.position, 0, grid, h, { maxSamples: 1e9 });
    // Each wet cell's own projection lands in a marked cell.
    const p = new THREE.Vector4();
    let checked = 0;
    for (let j = 0; j < grid.nz; j += 7) {
      for (let i = 0; i < grid.nx; i += 7) {
        if (!(h[j * grid.nx + i] > 0.05)) continue;
        p.set(grid.x0 + (i + 0.5), 0, grid.z0 + (j + 0.5), 1).applyMatrix4(new THREE.Matrix4().fromArray(vp));
        if (p.w <= 0) continue;
        const x = p.x / p.w; const y = p.y / p.w;
        if (Math.abs(x) > 1 || Math.abs(y) > 1) continue;
        const c = Math.min(m.cols - 1, Math.floor((x * 0.5 + 0.5) * m.cols));
        const r = Math.min(m.rows - 1, Math.floor((y * 0.5 + 0.5) * m.rows));
        expect(m.bits[r * m.cols + c]).toBe(1);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});
