/**
 * @file sitePartTransform.test.ts — pins the render <-> walkability agreement.
 *
 * `sitePartScenePosition` is the render forward transform (site-local part ->
 * scene). `worldOffsetToSiteLocal` is the walkability inverse (world/ground
 * displacement -> render-local frame) the collision grid uses to decide which
 * floor cells a part covers. They must be exact inverses: projecting a part to
 * where the renderer draws it, then mapping that point back, has to recover the
 * part's render-local offset — otherwise a part blocks the wrong cells.
 *
 * The subtle failure mode this guards: the walkability copy once compared
 * against `p.z * doorZSign` (the OPPOSITE z-flip sign from the renderer's
 * `p.z * -doorZSign`), mirroring furniture and the doorway through the building
 * origin. That only shows up for parts off the center line (p.z != 0), so the
 * cases below all use non-zero p.z.
 */
import { describe, it, expect } from 'vitest';
import {
  sitePartScenePosition,
  sitePartLocalOffset,
  worldOffsetToSiteLocal,
  siteOrientationFromQuad,
  isSitePartRenderable,
} from '../sitePartTransform';

describe('site-part render visibility', () => {
  it('keeps ordinary parts visible and excludes tactical-only party walls', () => {
    expect(isSitePartRenderable({})).toBe(true);
    expect(isSitePartRenderable({ renderRole: 'tactical-only' })).toBe(false);
  });
});

describe('siteOrientationFromQuad', () => {
  it('gives yaw 0, doorZSign -1 for the default axis-aligned winding', () => {
    // [SW, SE, NE, NW]: frontage edge e1 = +x, depth edge e2 = +z, cross >= 0.
    const quad = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 8 },
      { x: 0, z: 8 },
    ];
    const { rotationY, doorZSign } = siteOrientationFromQuad(quad);
    expect(rotationY).toBeCloseTo(0, 10);
    expect(doorZSign).toBe(-1);
  });

  it('flips doorZSign when the depth edge points the other way', () => {
    // Reverse the winding so the cross product changes sign.
    const quad = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: -8 },
      { x: 0, z: -8 },
    ];
    expect(siteOrientationFromQuad(quad).doorZSign).toBe(1);
  });

  it('is invariant under uniform scale + translation (feet vs meters frames)', () => {
    const base = [
      { x: 1, z: 2 },
      { x: 4, z: 3 },
      { x: 3, z: 6 },
      { x: 0, z: 5 },
    ];
    const scaled = base.map((c) => ({ x: c.x * 0.3048 + 100, z: c.z * 0.3048 - 40 }));
    const a = siteOrientationFromQuad(base);
    const b = siteOrientationFromQuad(scaled);
    expect(b.rotationY).toBeCloseTo(a.rotationY, 10);
    expect(b.doorZSign).toBe(a.doorZSign);
  });
});

describe('render forward <-> walkability inverse round-trip', () => {
  // Origin the building group sits at (ground meters); the round-trip must hold
  // for any origin since both sides translate by it.
  const groupX = 37.5;
  const groupZ = -12.25;
  // Off-center parts (p.z != 0) — the only cases the mirrored z-flip breaks.
  const parts = [
    { x: 0, z: 2, h: 3, baseY: 0 },
    { x: 1.4, z: -1.8, h: 2, baseY: 0.3 },
    { x: -2.1, z: 3.3, h: 1.2, baseY: 0 },
  ];
  const cases: Array<{ name: string; rotationY: number; doorZSign: number }> = [
    { name: 'yaw 0, door -1', rotationY: 0, doorZSign: -1 },
    { name: 'yaw 0, door +1', rotationY: 0, doorZSign: 1 },
    { name: 'yaw 90deg, door -1', rotationY: Math.PI / 2, doorZSign: -1 },
    { name: 'yaw 45deg, door +1', rotationY: Math.PI / 4, doorZSign: 1 },
    { name: 'yaw -60deg, door -1', rotationY: -Math.PI / 3, doorZSign: -1 },
    { name: 'yaw 2.7rad, door +1', rotationY: 2.7, doorZSign: 1 },
  ];

  for (const c of cases) {
    it(`recovers each part's render-local offset (${c.name})`, () => {
      for (const p of parts) {
        // Where the renderer draws the part center in scene/ground meters.
        const scene = sitePartScenePosition(p, {
          groupX,
          groupZ,
          surfaceY: 0,
          rotationY: c.rotationY,
          doorZSign: c.doorZSign,
        });
        // The walkability grid maps that world point back to the render-local
        // frame; it must land on the part's own local offset.
        const { lx, lz } = worldOffsetToSiteLocal(
          scene.x - groupX,
          scene.z - groupZ,
          c.rotationY,
        );
        const off = sitePartLocalOffset(p, c.doorZSign);
        expect(lx).toBeCloseTo(off.x, 9);
        expect(lz).toBeCloseTo(off.z, 9);
      }
    });
  }

  it('maps the mirror point OUTSIDE the part band (guards the z-flip sign)', () => {
    const p = { x: 0, z: 2, h: 3, baseY: 0 };
    const rotationY = Math.PI / 5;
    const doorZSign = 1;
    const t = { groupX, groupZ, surfaceY: 0, rotationY, doorZSign };
    // The buggy mirror = forward-projecting with the opposite door sign.
    const mirror = sitePartScenePosition(p, { ...t, doorZSign: -doorZSign });
    const { lz } = worldOffsetToSiteLocal(mirror.x - groupX, mirror.z - groupZ, rotationY);
    const off = sitePartLocalOffset(p, doorZSign);
    // The mirror lands a full 2*|off.z| away — well outside any sane part depth.
    expect(Math.abs(lz - off.z)).toBeCloseTo(2 * Math.abs(off.z), 6);
  });
});
