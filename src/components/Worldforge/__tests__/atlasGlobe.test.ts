/** Globe placement must preserve the generated region and north/east orientation. */
import { describe, it, expect } from 'vitest';
import { globeDirection, globeRegion } from '../atlasGlobe';

describe('atlas globe placement', () => {
  it('covers the full texture only for a full planet', () => {
    expect(globeRegion({ latN: 90, latS: -90, latT: 180, lonW: -180, lonE: 180, lonT: 360 }))
      .toEqual({ x: 0, y: 0, width: 1, height: 1, latitude: 0, longitude: 0 });
  });
  it('leaves ungenerated territory outside the regional rectangle', () => {
    expect(globeRegion({ latN: 60, latS: 0, latT: 60, lonW: -90, lonE: 0, lonT: 90 }))
      .toEqual({ x: 0.25, y: 1 / 6, width: 0.25, height: 1 / 3, latitude: 30, longitude: -45 });
  });
  it('rejects missing, inverted and nonfinite coordinates instead of inventing a planet', () => {
    expect(globeRegion(undefined)).toBeNull();
    const c = { latN: 60, latS: 0, latT: 60, lonW: -90, lonE: 0, lonT: 90 };
    expect(globeRegion({ ...c, latN: NaN })).toBeNull();
    expect(globeRegion({ ...c, lonE: -100 })).toBeNull();
    expect(globeRegion({ ...c, latS: -100 })).toBeNull();
  });
  it('faces the matching SphereGeometry texture longitude and latitude', () => {
    expect(globeDirection(0, 0)).toEqual([1, 0, -0]);
    expect(globeDirection(0, 90)[2]).toBeCloseTo(-1);
    expect(globeDirection(0, -90)[2]).toBeCloseTo(1);
    expect(globeDirection(90, 0)[1]).toBeCloseTo(1);
    expect(globeDirection(-90, 0)[1]).toBeCloseTo(-1);
  });
});
