/**
 * @file sweptTube.test.ts — the Dragon Forge technique: one continuous
 * CatmullRom-swept tube with an interpolated radius profile, vertices
 * recomputed in place each frame (build-once buffers, no allocation).
 */
import { describe, it, expect } from 'vitest';
import { MeshBasicMaterial, Vector3 } from 'three';
import { createSweptTube, sampleRadiusProfile } from '../three/sweptTube';

const PTS = [new Vector3(0, 1, 2), new Vector3(0, 1.1, 0.5), new Vector3(0, 1, -1), new Vector3(0, 0.9, -2.4)];
const RADII = [0.2, 0.32, 0.26, 0.12];

describe('createSweptTube', () => {
  it('builds a fixed-size vertex grid and keeps it stable across updates', () => {
    const tube = createSweptTube({ stations: 24, radial: 8, material: new MeshBasicMaterial() });
    tube.update(PTS, RADII);
    const count = tube.mesh.geometry.attributes.position.count;
    expect(count).toBeGreaterThan(24 * 8);
    tube.update(PTS.map((p) => p.clone().addScalar(0.3)), RADII);
    expect(tube.mesh.geometry.attributes.position.count).toBe(count);
    tube.dispose();
  });

  it('moves vertices when control points move', () => {
    const tube = createSweptTube({ stations: 16, radial: 8, material: new MeshBasicMaterial() });
    tube.update(PTS, RADII);
    const before = tube.mesh.geometry.attributes.position.array.slice(0, 30);
    tube.update(PTS.map((p) => new Vector3(p.x + 1, p.y, p.z)), RADII);
    const after = tube.mesh.geometry.attributes.position.array.slice(0, 30);
    expect([...after]).not.toEqual([...before]);
    tube.dispose();
  });

  it('ring size follows the radius profile', () => {
    const tube = createSweptTube({ stations: 16, radial: 8, material: new MeshBasicMaterial() });
    tube.update(PTS, [0.1, 0.5, 0.5, 0.1]);
    const pos = tube.mesh.geometry.attributes.position;
    // ring at the fattest station spans wider than the ends
    let minSpan = Infinity;
    let maxSpan = 0;
    for (let s = 0; s <= 16; s++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let r = 0; r < 8; r++) {
        const x = pos.getX(s * 8 + r);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      minSpan = Math.min(minSpan, hi - lo);
      maxSpan = Math.max(maxSpan, hi - lo);
    }
    expect(maxSpan).toBeGreaterThan(minSpan * 2);
    tube.dispose();
  });

  it('all vertices stay finite for degenerate-ish inputs', () => {
    const tube = createSweptTube({ stations: 12, radial: 7, material: new MeshBasicMaterial() });
    tube.update(
      [new Vector3(0, 1, 0), new Vector3(0, 1, 0.001), new Vector3(0, 1.001, 0.002)],
      [0.05, 0.05, 0.05],
    );
    const arr = tube.mesh.geometry.attributes.position.array;
    for (const v of arr) expect(Number.isFinite(v)).toBe(true);
    tube.dispose();
  });
});

describe('sampleRadiusProfile', () => {
  it('interpolates linearly between profile knots (Dragon Forge py)', () => {
    expect(sampleRadiusProfile([1, 3], 0.5)).toBeCloseTo(2, 6);
    expect(sampleRadiusProfile([1, 2, 4], 0.75)).toBeCloseTo(3, 6);
    expect(sampleRadiusProfile([2], 0.4)).toBe(2);
  });
});
