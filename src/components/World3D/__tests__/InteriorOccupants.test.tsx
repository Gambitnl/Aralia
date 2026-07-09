/**
 * @file InteriorOccupants.test.tsx
 * Living-interiors occupant layer. Covers the load-bearing PURE resolver
 * (occupantScenePosition) — an occupant's scene position at a given hour, or
 * null when the member is OUT that hour. The station is authored in plan feet
 * (blueprint frame, 0 = min corner); the resolver maps it through the shared
 * planFeetToSiteLocal → siteLocalToScene transform, then lifts by storey. The
 * live component itself only re-flattens the loaded-chunk set and renders one
 * shared OccupantFigure per occupant, so the resolver is the piece worth pinning.
 */
import { describe, it, expect } from 'vitest';
import type { BuildingOccupantRender } from '@/systems/world3d/types';
import { occupantScenePosition } from '../InteriorOccupants';

describe('occupantScenePosition', () => {
  it('returns null when the occupant is OUT that hour', () => {
    const occ = {
      id: 1,
      ageBand: 'adult',
      body: {} as never,
      stationsByHour: Array(24).fill(null),
    } as BuildingOccupantRender;
    expect(
      occupantScenePosition(
        occ,
        12,
        { widthFt: 20, depthFt: 30 },
        { gx: 0, gz: 0, rotationY: 0, doorZSign: -1 },
        0,
      ),
    ).toBeNull();
  });

  it('maps a home station through plan-feet then placement', () => {
    const stations = Array(24).fill(null);
    stations[2] = { xFt: 10, yFt: 15, level: 0, activity: 'sleeping' };
    const occ = {
      id: 1,
      ageBand: 'adult',
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    // Center of a 20ft x 30ft frame → site-local (0,0) → scene (gx,gz).
    // y = surfaceY + level * STOREY_M = 1.0 + 0 * 3.
    const pos = occupantScenePosition(
      occ,
      2,
      { widthFt: 20, depthFt: 30 },
      { gx: 5, gz: 7, rotationY: 0, doorZSign: -1 },
      1.0,
    );
    expect(pos).toEqual({ x: 5, y: 1.0, z: 7 });
  });

  it('lifts an upper-floor station by one storey per level', () => {
    const stations = Array(24).fill(null);
    stations[8] = { xFt: 10, yFt: 15, level: 1, activity: 'working' };
    const occ = {
      id: 2,
      ageBand: 'adult',
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    const pos = occupantScenePosition(
      occ,
      8,
      { widthFt: 20, depthFt: 30 },
      { gx: 5, gz: 7, rotationY: 0, doorZSign: -1 },
      1.0,
    );
    // level 1 → surfaceY (1.0) + 1 * STOREY_M (3) = 4.0.
    expect(pos).toEqual({ x: 5, y: 4.0, z: 7 });
  });

  it('wraps the hour into 0-23 before indexing the station table', () => {
    const stations = Array(24).fill(null);
    stations[2] = { xFt: 10, yFt: 15, level: 0, activity: 'sleeping' };
    const occ = {
      id: 3,
      ageBand: 'adult',
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    // 26 wraps to 2; -22 wraps to 2. Both resolve the 02:00 station.
    const placement = { gx: 5, gz: 7, rotationY: 0, doorZSign: -1 } as const;
    const frame = { widthFt: 20, depthFt: 30 };
    expect(occupantScenePosition(occ, 26, frame, placement, 1.0)).toEqual({ x: 5, y: 1.0, z: 7 });
    expect(occupantScenePosition(occ, -22, frame, placement, 1.0)).toEqual({ x: 5, y: 1.0, z: 7 });
  });

  it('applies the site placement (offset frame maps a corner station off-origin)', () => {
    const stations = Array(24).fill(null);
    // Min corner of the frame (0,0 ft) → site-local (-w/2,-d/2) meters.
    stations[3] = { xFt: 0, yFt: 0, level: 0, activity: 'idle' };
    const occ = {
      id: 4,
      ageBand: 'adult',
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    const FT = 0.3048;
    const pos = occupantScenePosition(
      occ,
      3,
      { widthFt: 20, depthFt: 30 },
      { gx: 0, gz: 0, rotationY: 0, doorZSign: -1 },
      0,
    )!;
    // local x = (0 - 10) * FT = -10 FT; local z = (0 - 15) * FT = -15 FT.
    // doorZSign -1 → lz = localZ * 1 = -15 FT; no rotation → scene = local.
    expect(pos.x).toBeCloseTo(-10 * FT, 6);
    expect(pos.z).toBeCloseTo(-15 * FT, 6);
    expect(pos.y).toBe(0);
  });
});
