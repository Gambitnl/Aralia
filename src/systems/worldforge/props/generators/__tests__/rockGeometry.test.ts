/**
 * @file rockGeometry.test.ts — determinism + sanity for the owned prop
 * geometry generators (world-props slice 1).
 */
import { describe, it, expect } from 'vitest';
import { createRockGeometry } from '../rockGeometry';
import { createLogGeometry } from '../logGeometry';
import { createBushGeometry } from '../bushGeometry';

function positions(geo: { getAttribute: (n: string) => { array: ArrayLike<number> } }): Float32Array {
  return new Float32Array(geo.getAttribute('position').array as Float32Array);
}

describe('owned prop geometry generators', () => {
  it('rock: same seed → byte-identical vertex buffer', () => {
    const a = createRockGeometry(1234);
    const b = createRockGeometry(1234);
    expect(positions(a)).toEqual(positions(b));
    expect(new Float32Array(a.getAttribute('normal').array as Float32Array)).toEqual(
      new Float32Array(b.getAttribute('normal').array as Float32Array),
    );
  });

  it('rock: different seeds → different shapes', () => {
    const a = positions(createRockGeometry(1));
    const b = positions(createRockGeometry(2));
    expect(a.length).toBe(b.length);
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    expect(diff).toBeGreaterThan(a.length / 4);
  });

  it('rock: all positions and normals are finite', () => {
    for (const seed of [7, 8, 9, 10]) {
      const geo = createRockGeometry(seed);
      const pos = geo.getAttribute('position').array as Float32Array;
      const nrm = geo.getAttribute('normal').array as Float32Array;
      expect(pos.length).toBeGreaterThan(0);
      expect(pos.length).toBe(nrm.length);
      for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i])).toBe(true);
      for (let i = 0; i < nrm.length; i++) expect(Number.isFinite(nrm[i])).toBe(true);
    }
  });

  it('rock: stays within a sane bounding radius', () => {
    const geo = createRockGeometry(99);
    const pos = geo.getAttribute('position').array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i + 1], pos[i + 2]);
      expect(r).toBeLessThan(1.2); // base radius 0.5 + noise/squash headroom
    }
  });

  it('log: deterministic and finite', () => {
    const a = createLogGeometry(42);
    const b = createLogGeometry(42);
    expect(positions(a)).toEqual(positions(b));
    const pos = a.getAttribute('position').array as Float32Array;
    for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i])).toBe(true);
  });

  it('bush: deterministic and finite', () => {
    const a = createBushGeometry(21);
    const b = createBushGeometry(21);
    expect(positions(a)).toEqual(positions(b));
    const pos = a.getAttribute('position').array as Float32Array;
    for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i])).toBe(true);
  });
});
