/** Checks exact receiving-sheet topology and interpolation as snapshot sample caching changes. */
import { describe, expect, it } from 'vitest';
import { riverStandingGeometryFrom } from '@/components/World3D/water/riverWaterMaterial';

const sheet = {
  pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]),
  nor: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
  index: new Uint32Array([0, 1, 2, 1, 3, 2]),
};
describe('receiving sheet sample reuse', () => {
  it('keeps both adjacent faces, their shared midpoint and nonlinear displacement exact', () => {
    const geometry = riverStandingGeometryFrom(sheet, () => 1, (x, z) => x * x + z * z);
    expect(Array.from(geometry.getIndex()!.array)).toEqual([
      0, 4, 6, 4, 1, 5, 6, 5, 2, 4, 5, 6,
      1, 7, 5, 7, 3, 8, 5, 8, 2, 7, 8, 5,
    ]);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual([
      0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2, 1,
      0.5, 0.25, 0, 0.5, 0.5, 0.5, 0, 0.25, 0.5,
      1, 1.25, 0.5, 0.5, 1.25, 1,
    ]);
    expect(geometry.userData.mainStandingTriangles).toEqual(geometry.getIndex()!.array);
    expect(geometry.userData.standingStats).toMatchObject({ refinedBaseTriangles: 2, vertices: 9 });
    expect(Array.from(geometry.getAttribute('normal').array)).toEqual(Array.from({ length: 9 }, () => [0, 1, 0]).flat());
    // Mapping a snapshot must not mutate the worker's original sheet buffers.
    expect(sheet.pos[4]).toBe(0);
    geometry.dispose();
  });

  it('preserves quiet owned faces and leaves unowned faces undisplaced', () => {
    const quiet = riverStandingGeometryFrom(sheet, () => 1, () => 0, () => 0);
    expect(quiet.getIndex()!.array).toEqual(sheet.index);
    expect(quiet.getAttribute('position').array).toEqual(sheet.pos);
    expect(quiet.userData.mainStandingTriangles).toEqual(sheet.index);
    const outside = riverStandingGeometryFrom(sheet, () => 0, () => 10, () => 1);
    expect(outside.getAttribute('position').array).toEqual(sheet.pos);
    expect(outside.userData.mainStandingTriangles).toHaveLength(0);
    quiet.dispose(); outside.dispose();
  });

  it('samples shared zero-valued edges once and still tests the face center', () => {
    const queried: string[] = [];
    const share = (x: number, z: number) => { queried.push(`${x}:${z}`); return 0; };
    const geometry = riverStandingGeometryFrom(sheet, share, () => 0, share, undefined, true);
    expect(queried.filter(point => point === '0.5:0.5')).toHaveLength(1);
    expect(queried).toContain(`${1 / 3}:${1 / 3}`);
    expect(queried).toContain(`${2 / 3}:${2 / 3}`);
    expect(geometry.getIndex()!.array).toEqual(sheet.index);
    geometry.dispose();
  });
});
