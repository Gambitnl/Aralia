/**
 * Proves the game-clock → schedule-hour bridge: whole + fractional hour-of-day
 * from a UTC game Date, and clamped window progress for commute/shift interpolation.
 */
import { describe, it, expect } from 'vitest';
import { scheduleHourFromGameTime, scheduleClockFromGameTime, windowProgress } from '../gameClock';

// Game time is a UTC Date (epoch year 351); hour-of-day is getUTCHours().
const at = (h: number, m = 0, s = 0): Date => new Date(Date.UTC(351, 0, 1, h, m, s));

describe('scheduleHourFromGameTime', () => {
  it('returns the whole UTC hour-of-day', () => {
    expect(scheduleHourFromGameTime(at(7, 22))).toBe(7);
    expect(scheduleHourFromGameTime(at(0))).toBe(0);
    expect(scheduleHourFromGameTime(at(23, 59))).toBe(23);
  });
});

describe('scheduleClockFromGameTime', () => {
  it('adds the minute/second fraction', () => {
    expect(scheduleClockFromGameTime(at(7, 30))).toBeCloseTo(7.5);
    expect(scheduleClockFromGameTime(at(12, 15))).toBeCloseTo(12.25);
  });
});

describe('windowProgress', () => {
  it('is 0 before, 1 after, and linear within the window', () => {
    expect(windowProgress(6, 8, 17)).toBe(0);     // before shift
    expect(windowProgress(8, 8, 17)).toBe(0);     // at start
    expect(windowProgress(12.5, 8, 17)).toBeCloseTo((12.5 - 8) / 9);
    expect(windowProgress(17, 8, 17)).toBe(1);    // at end
    expect(windowProgress(20, 8, 17)).toBe(1);    // after
  });

  it('handles a degenerate window safely', () => {
    expect(windowProgress(5, 10, 10)).toBe(0);
    expect(windowProgress(11, 10, 10)).toBe(1);
  });
});
