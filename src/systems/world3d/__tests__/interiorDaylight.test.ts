/**
 * Interior daylight: the sky light a point inside a building receives comes
 * only through the building's window openings. These tests pin the physics
 * (Lambert's polygon view factor) and the building rules (inside test,
 * outward side, wall occlusion, split-flux interreflection).
 */
import { describe, expect, it } from 'vitest';
import {
  buildInteriorDaylight,
  GLASS_TRANSMITTANCE,
  interiorSkyFactor,
  polygonViewFactor,
  reflectanceOfHex,
  type DaylightPart,
} from '../interiorDaylight';

const up = { x: 0, y: 1, z: 0 };

describe('polygonViewFactor', () => {
  it('matches the closed form for a point under the center of a square', () => {
    // Square of side 2a at height h, point under its center. It is four
    // a-by-a rectangles with a corner over the point; each one has
    // F1 = (1 / pi) * (x / s) * atan(x / s), with x = a / h and s = sqrt(1 + x^2)
    // (the standard parallel-rectangle corner result with A = B = x).
    const a = 1, h = 1;
    const sq = [
      { x: -a, y: h, z: -a }, { x: a, y: h, z: -a }, { x: a, y: h, z: a }, { x: -a, y: h, z: a },
    ];
    const x = a / h;
    const s = Math.sqrt(1 + x * x);
    const expected = (4 / Math.PI) * (x / s) * Math.atan(x / s);
    expect(polygonViewFactor({ x: 0, y: 0, z: 0 }, up, sq)).toBeCloseTo(expected, 6);
  });

  it('approaches 1 for a huge opening close above, and A cos cos / (pi d^2) for a small far one', () => {
    const big = 1e4;
    const huge = [
      { x: -big, y: 0.1, z: -big }, { x: big, y: 0.1, z: -big }, { x: big, y: 0.1, z: big }, { x: -big, y: 0.1, z: big },
    ];
    expect(polygonViewFactor({ x: 0, y: 0, z: 0 }, up, huge)).toBeGreaterThan(0.999);
    const e = 0.05, d = 10;
    const small = [
      { x: -e, y: d, z: -e }, { x: e, y: d, z: -e }, { x: e, y: d, z: e }, { x: -e, y: d, z: e },
    ];
    expect(polygonViewFactor({ x: 0, y: 0, z: 0 }, up, small)).toBeCloseTo((2 * e) ** 2 / (Math.PI * d * d), 8);
  });

  it('is zero for an opening behind the surface and clips one that straddles it', () => {
    const behind = [
      { x: -1, y: -2, z: -1 }, { x: 1, y: -2, z: -1 }, { x: 1, y: -2, z: 1 }, { x: -1, y: -2, z: 1 },
    ];
    expect(polygonViewFactor({ x: 0, y: 0, z: 0 }, up, behind)).toBe(0);
    // A vertical square through the point's plane: only the upper half counts.
    const wall = [
      { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 },
    ];
    const upperHalf = [
      { x: -1, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 },
    ];
    expect(polygonViewFactor({ x: 0, y: 0, z: 0 }, up, wall))
      .toBeCloseTo(polygonViewFactor({ x: 0, y: 0, z: 0 }, up, upperHalf), 6);
  });
});

/**
 * A one-room house in the render frame: floor 6 m (x) by 4 m (z), walls
 * 0.3 m thick and 2.8 m tall, one 1.2 m by 1.2 m window in the +z wall with
 * a sill at 0.9 m. The +z wall is split into the parts the bake makes:
 * two full-height pieces, a sill and a head, and the glass pane.
 */
function oneRoomHouse(extra: DaylightPart[] = []): DaylightPart[] {
  const wallColor = '#cfc7b8';
  const H = 2.8, T = 0.3;
  return [
    { x: 0, z: 0, w: 6, d: 4, h: 0.1, baseY: -0.1, colorHex: '#9a8a72', walkSurface: 'floor' },
    { x: 0, z: 0, w: 6, d: 4, h: 0.1, baseY: H, colorHex: '#8c7d68' },
    // -z wall and the two end walls (outside the floor's x-z box).
    { x: 0, z: -2 - T / 2, w: 6 + 2 * T, d: T, h: H, colorHex: wallColor, tag: 'exterior' },
    { x: -3 - T / 2, z: 0, w: T, d: 4, h: H, colorHex: wallColor, tag: 'exterior' },
    { x: 3 + T / 2, z: 0, w: T, d: 4, h: H, colorHex: wallColor, tag: 'exterior' },
    // +z wall with the window at x = 0.
    { x: -1.95, z: 2 + T / 2, w: 2.7 + 2 * T, d: T, h: H, colorHex: wallColor, tag: 'exterior' },
    { x: 1.95, z: 2 + T / 2, w: 2.7 + 2 * T, d: T, h: H, colorHex: wallColor, tag: 'exterior' },
    { x: 0, z: 2 + T / 2, w: 1.2, d: T, h: 0.9, colorHex: wallColor, tag: 'exterior' },
    { x: 0, z: 2 + T / 2, w: 1.2, d: T, h: 0.7, baseY: 2.1, colorHex: wallColor, tag: 'exterior' },
    { x: 0, z: 2 + T / 2, w: 1.2, d: 0.04, h: 1.2, baseY: 0.9, colorHex: '#2f3a4d', lightRole: 'window' },
    ...extra,
  ];
}

describe('buildInteriorDaylight', () => {
  // doorZSign -1 keeps z as authored (sitePartLocalOffset flips by -doorZSign).
  const day = buildInteriorDaylight(oneRoomHouse(), -1)!;

  it('finds the window and points it out of the house', () => {
    expect(day.openings).toHaveLength(1);
    expect(day.openings[0].outward).toEqual({ x: 0, y: 0, z: 1 });
    expect(day.openings[0].areaM2).toBeCloseTo(1.44, 6);
  });

  it('keeps the outside of a perimeter wall at full sky (street view unchanged)', () => {
    expect(interiorSkyFactor(day, { x: -2, y: 1.5, z: 2.3 }, { x: 0, y: 0, z: 1 })).toBe(1);
    expect(interiorSkyFactor(day, { x: -3.3, y: 1.5, z: 0 }, { x: -1, y: 0, z: 0 })).toBe(1);
  });

  it('lights the floor near the window more than the floor at the back wall', () => {
    const near = interiorSkyFactor(day, { x: 0, y: 0, z: 1.2 }, up);
    const far = interiorSkyFactor(day, { x: 0, y: 0, z: -1.8 }, up);
    expect(near).toBeGreaterThan(far * 2);
    expect(far).toBeGreaterThanOrEqual(day.irc);
    // Indoors stays well under the open sky.
    expect(near).toBeLessThan(0.5);
  });

  it('gives the back wall facing the window more light than a wall turned away from it', () => {
    const facing = interiorSkyFactor(day, { x: 0, y: 1.5, z: -2 }, { x: 0, y: 0, z: 1 });
    const sideOn = interiorSkyFactor(day, { x: 2.9, y: 1.5, z: -1.5 }, { x: -1, y: 0, z: 0 });
    expect(facing).toBeGreaterThan(day.irc);
    expect(facing).toBeGreaterThan(sideOn);
  });

  it('lets an interior wall block the window from the room behind it', () => {
    // A full-height partition at z = 0 with no door: the back half is a
    // windowless room and gets only the interreflected light.
    const walled = buildInteriorDaylight(oneRoomHouse([
      { x: 0, z: 0, w: 6, d: 0.15, h: 2.8, colorHex: '#cfc7b8' },
    ]), -1)!;
    expect(interiorSkyFactor(walled, { x: 0, y: 0, z: -1 }, up)).toBeCloseTo(walled.irc, 9);
    expect(interiorSkyFactor(walled, { x: 0, y: 0, z: 1 }, up)).toBeGreaterThan(walled.irc);
  });

  it('computes a split-flux interreflection in the expected range and grows with window area', () => {
    expect(day.irc).toBeGreaterThan(0);
    expect(day.irc).toBeLessThan(0.05);
    const bigger = buildInteriorDaylight(oneRoomHouse([
      { x: 0, z: -2 - 0.15, w: 1.2, d: 0.04, h: 1.2, baseY: 0.9, colorHex: '#2f3a4d', lightRole: 'window' },
    ]), -1)!;
    expect(bigger.irc).toBeGreaterThan(day.irc);
  });

  it('caps the factor at the glass transmittance times the view factor plus the IRC', () => {
    // Right against the glass, facing it: the view factor approaches 1/2 of
    // the hemisphere at most for a 1.2 m pane at 5 cm.
    const f = interiorSkyFactor(day, { x: 0, y: 1.5, z: 1.9 }, { x: 0, y: 0, z: 1 });
    expect(f).toBeLessThanOrEqual(GLASS_TRANSMITTANCE + day.irc + 1e-9);
    expect(f).toBeGreaterThan(0.5);
  });

  it('returns null for a building with no floor or no window', () => {
    expect(buildInteriorDaylight(oneRoomHouse().filter((p) => p.lightRole !== 'window'), -1)).toBeNull();
    expect(buildInteriorDaylight(oneRoomHouse().filter((p) => p.walkSurface !== 'floor'), -1)).toBeNull();
  });
});

describe('reflectanceOfHex', () => {
  it('is linear luminance', () => {
    expect(reflectanceOfHex('#ffffff')).toBeCloseTo(1, 6);
    expect(reflectanceOfHex('#000000')).toBe(0);
    expect(reflectanceOfHex('#808080')).toBeCloseTo(0.2158, 3);
  });
});
