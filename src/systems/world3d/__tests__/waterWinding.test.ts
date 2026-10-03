import { describe, it, expect } from 'vitest';
import { pushUpwardTriangles } from '../waterGeometry';

/** Y component of (b-a) x (c-a) — positive means the face points up. */
const faceUpY = (positions: number[], a: number, b: number, c: number): number => {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const bx = positions[b * 3] - ax;
  const by = positions[b * 3 + 1] - ay;
  const bz = positions[b * 3 + 2] - az;
  const cx = positions[c * 3] - ax;
  const cy = positions[c * 3 + 1] - ay;
  const cz = positions[c * 3 + 2] - az;
  return bz * cx - bx * cz + (by * 0 - cy * 0);
};

/** A flat square at height y, listed counter-clockwise seen from above. */
const squareCCW = (y = 0) => [
  0, y, 0,
  10, y, 0,
  10, y, 10,
  0, y, 10,
];

describe('pushUpwardTriangles', () => {
  it('keeps triangles that already face up', () => {
    const positions = squareCCW();
    const indices: number[] = [];
    pushUpwardTriangles([0, 1, 2], 0, positions, indices);
    expect(indices).toHaveLength(3);
    expect(faceUpY(positions, indices[0], indices[1], indices[2])).toBeGreaterThan(0);
  });

  it('flips triangles that face down', () => {
    // Water was invisible in-game because every sheet was wound this way: the
    // normals said up while the winding said down, and culling follows winding.
    const positions = squareCCW();
    const indices: number[] = [];
    pushUpwardTriangles([0, 2, 1], 0, positions, indices);
    expect(faceUpY(positions, indices[0], indices[1], indices[2])).toBeGreaterThan(0);
  });

  it('orients every triangle of a multi-triangle fan', () => {
    const positions = squareCCW();
    const indices: number[] = [];
    // Both windings mixed in one call, as earcut can emit for odd rings.
    pushUpwardTriangles([0, 2, 1, 0, 2, 3], 0, positions, indices);
    expect(indices).toHaveLength(6);
    for (let t = 0; t < indices.length; t += 3) {
      expect(faceUpY(positions, indices[t], indices[t + 1], indices[t + 2])).toBeGreaterThan(0);
    }
  });

  it('applies the vertex offset so later polygons index their own vertices', () => {
    const positions = [...squareCCW(0), ...squareCCW(5)];
    const indices: number[] = [];
    pushUpwardTriangles([0, 1, 2], 4, positions, indices);
    expect(indices.every((i) => i >= 4)).toBe(true);
  });

  it('still orients a sloped surface, as a river descending is not flat', () => {
    const positions = [
      0, 10, 0,
      10, 10, 0,
      10, 4, 10, // downstream corner, 6 m lower
      0, 4, 10,
    ];
    const indices: number[] = [];
    pushUpwardTriangles([0, 2, 1], 0, positions, indices);
    expect(faceUpY(positions, indices[0], indices[1], indices[2])).toBeGreaterThan(0);
  });

  it('ignores a trailing partial triangle', () => {
    const positions = squareCCW();
    const indices: number[] = [];
    pushUpwardTriangles([0, 1, 2, 3, 0], 0, positions, indices);
    expect(indices).toHaveLength(3);
  });
});
