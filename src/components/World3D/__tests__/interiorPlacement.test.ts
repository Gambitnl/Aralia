/**
 * @file interiorPlacement.test.ts
 * Pins the shared site-local → scene transform used by InteriorLights and
 * InteriorOccupants. The values encode the render convention derived from the
 * current hearth projection: lz = localZ * -doorZSign, then a CCW yaw about +Y
 * (rx = lx*cos + lz*sin, rz = -lx*sin + lz*cos), then translate by the group
 * origin. planFeetToSiteLocal uses the stable blueprint site origin.
 */
import { describe, it, expect } from 'vitest';
import { siteLocalToScene, planFeetToSiteLocal } from '../interiorPlacement';

describe('siteLocalToScene', () => {
  it('with no rotation and doorSign -1 flips z and offsets', () => {
    const s = { gx: 10, gz: 5, rotationY: 0, doorZSign: -1 };
    expect(siteLocalToScene(2, 3, s)).toEqual({ x: 12, z: 5 + 3 }); // lz = 3 * -(-1) = 3
  });

  it('rotates 90deg CCW about +Y', () => {
    const s = { gx: 0, gz: 0, rotationY: Math.PI / 2, doorZSign: -1 };
    const out = siteLocalToScene(1, 0, s); // rx = 1*cos - ...; matches InteriorLights math
    expect(out.x).toBeCloseTo(Math.cos(Math.PI / 2) * 1, 6);
    expect(out.z).toBeCloseTo(-Math.sin(Math.PI / 2) * 1, 6);
  });
});

describe('planFeetToSiteLocal', () => {
  it('centers the frame', () => {
    // A point at the exact center of a 20ft x 30ft interior maps to (0,0) local.
    expect(planFeetToSiteLocal(10, 15, 20, 30)).toEqual({ x: 0, z: 0 });
  });

  it('keeps an old-core station fixed when a one-sided extension widens the envelope', () => {
    // The envelope grew from 20ft to 30ft on its right side, but its original
    // 10ft center remains the site origin and therefore still maps to zero.
    expect(planFeetToSiteLocal(10, 15, 30, 30, 10, 15)).toEqual({ x: 0, z: 0 });
  });
});
