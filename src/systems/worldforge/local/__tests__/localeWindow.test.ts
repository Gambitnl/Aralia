import { windowForWorldPos, windowOrigin, windowKey, WINDOW_FT } from '../localeWindow';

describe('localeWindow — 3000ft streaming tiling (Stage 5 S5.4)', () => {
  it('maps a world position to its window cell + local offset', () => {
    const w = windowForWorldPos(7300, 1200);
    expect(w.col).toBe(2); // floor(7300/3000)
    expect(w.row).toBe(0);
    expect(w.originFt).toEqual({ x: 6000, y: 0 });
    expect(w.centerFt).toEqual({ x: 7500, y: 1500 });
    expect(w.localFeet.x).toBeCloseTo(1300, 6); // 7300 - 6000
    expect(w.localFeet.y).toBeCloseTo(1200, 6);
  });

  it('handles negative world coordinates (floor, not truncate)', () => {
    const w = windowForWorldPos(-100, -3001);
    expect(w.col).toBe(-1); // floor(-100/3000) = -1
    expect(w.row).toBe(-2); // floor(-3001/3000) = -2
    expect(w.localFeet.x).toBeCloseTo(2900, 6); // -100 - (-3000)
  });

  it('adjacent positions across a window boundary land in adjacent windows', () => {
    const a = windowForWorldPos(2999, 500);
    const b = windowForWorldPos(3001, 500);
    expect(b.col - a.col).toBe(1); // stepped east into the next window
    expect(a.row).toBe(b.row);
  });

  it('local offset is always within [0, WINDOW_FT)', () => {
    for (const [fx, fy] of [[0, 0], [2999.9, 1], [9001, -4500], [-7, -7]] as const) {
      const w = windowForWorldPos(fx, fy);
      expect(w.localFeet.x).toBeGreaterThanOrEqual(0);
      expect(w.localFeet.x).toBeLessThan(WINDOW_FT);
      expect(w.localFeet.y).toBeGreaterThanOrEqual(0);
      expect(w.localFeet.y).toBeLessThan(WINDOW_FT);
    }
  });

  it('windowOrigin + windowKey are stable and unique per window', () => {
    expect(windowOrigin(2, 0)).toEqual({ x: 6000, y: 0 });
    expect(windowKey(2, 0)).toBe('w:2,0');
    expect(windowKey(-1, 3)).toBe('w:-1,3');
    expect(windowKey(2, 0)).not.toBe(windowKey(0, 2));
  });
});
