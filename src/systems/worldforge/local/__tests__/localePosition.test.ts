/**
 * @file localePosition.test.ts — the meters↔Locale-feet bridge (cell-native
 * world, Stage 3). The single conversion between `playerGroundPos` (tile-local
 * meters, written by the 3D ground view) and `PlayerCell.localeCoords` (continuous
 * Locale feet). Pure + exact (international foot, via units.ts).
 */
import {
  LOCALE_CELL_FT,
  groundPosToLocaleFeet,
  localeFeetToGroundMeters,
  clampLocaleFeet,
} from '../localePosition';

describe('localePosition — meters↔Locale-feet bridge (Stage 3)', () => {
  it('one Locale cell is 5 ft (mirrors GROUND_METERS_PER_CELL = 1.524 m)', () => {
    expect(LOCALE_CELL_FT).toBe(5);
  });

  it('origin meters map to origin feet', () => {
    expect(groundPosToLocaleFeet({ xM: 0, zM: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('one foot of meters (0.3048) maps to ~1 ft on each axis', () => {
    const feet = groundPosToLocaleFeet({ xM: 0.3048, zM: 0.3048 });
    expect(feet.x).toBeCloseTo(1, 9);
    expect(feet.y).toBeCloseTo(1, 9);
  });

  it('z (meters) maps to y (feet) — the 3D Z axis is the 2D/Locale Y axis', () => {
    const feet = groundPosToLocaleFeet({ xM: 1.524, zM: 3.048 });
    expect(feet.x).toBeCloseTo(5, 9); // 1.524 m = 5 ft
    expect(feet.y).toBeCloseTo(10, 9); // 3.048 m = 10 ft
  });

  it('round-trips meters → feet → meters within float tolerance', () => {
    for (const p of [
      { xM: 0, zM: 0 },
      { xM: 12.5, zM: 7.25 },
      { xM: 914.4, zM: 457.2 },
      { xM: 0.0001, zM: 1234.5678 },
    ]) {
      const back = localeFeetToGroundMeters(groundPosToLocaleFeet(p));
      expect(back.xM).toBeCloseTo(p.xM, 8);
      expect(back.zM).toBeCloseTo(p.zM, 8);
    }
  });

  it('clamps Locale feet to [0, cols×5] × [0, rows×5]', () => {
    const extent = { cols: 100, rows: 60 }; // 500 ft × 300 ft Locale
    expect(clampLocaleFeet({ x: -10, y: -10 }, extent)).toEqual({ x: 0, y: 0 });
    expect(clampLocaleFeet({ x: 9999, y: 9999 }, extent)).toEqual({ x: 500, y: 300 });
    expect(clampLocaleFeet({ x: 250, y: 150 }, extent)).toEqual({ x: 250, y: 150 });
  });
});
