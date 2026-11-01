/** Checks that spatial indexing still makes floaters follow the exact baked triangles. */
import { afterEach, expect, it, vi } from 'vitest';
import { RiverSurfaceMirror } from '@/components/World3D/water/riverSurfaceMirror';
afterEach(() => vi.restoreAllMocks());

function fixture(): RiverSurfaceMirror {
  // This disposable fixture uses the real index/query methods. Noise textures
  // and hydraulic arrays are unnecessary for querying an already baked sheet.
  const mirror = Object.create(RiverSurfaceMirror.prototype) as RiverSurfaceMirror;
  Object.assign(mirror, { nx: 8, nz: 8, dx: 0.5, x0: 0, z0: 0, standingBins: new Map() });
  vi.spyOn(mirror, 'mainRapidsShare').mockReturnValue(1);
  return mirror;
}
const positions = new Float32Array([-0.1, -0.6, -0.1, 1, 2, 0, 0, 4, 1]);
const indices = new Uint32Array([0, 1, 2]);

it('finds the same sloping triangle across solver cells, including negative cell coordinates', () => {
  const mirror = fixture(); mirror.setStandingTriangles(positions, indices);
  expect(mirror.standingSurfaceAt(0.2, 0.2)).toBeCloseTo(1.2, 6);
  expect(mirror.standingSurfaceAt(-0.04, -0.04)).toBeCloseTo(-0.24, 6);
  expect(mirror.standingSurfaceAt(0.65, 0.1)).toBeCloseTo(1.7, 6);
  expect(mirror.standingSurfaceAt(1, 1)).toBeNaN();
});

it('replaces removed faces and keeps new vertex heights instead of stale index bins', () => {
  const mirror = fixture(); mirror.setStandingTriangles(positions, indices);
  const moved = new Float32Array(positions);
  for (let v = 1; v < moved.length; v += 3) moved[v] += 3;
  mirror.setStandingTriangles(moved, indices);
  expect(mirror.standingSurfaceAt(0.2, 0.2)).toBeCloseTo(4.2, 6);
  mirror.setStandingTriangles(null, null);
  expect(mirror.standingSurfaceAt(0.2, 0.2)).toBeNull();
});
