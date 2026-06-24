import { describe, it, expect } from 'vitest';
import {
  formatTravelTime,
  formatDistance,
  dangerRating,
  formatRouteSummary,
} from '../travelReadout';
import type { RoutePlan } from '../routePlanning';

describe('formatTravelTime', () => {
  it('formats minutes / hours / days', () => {
    expect(formatTravelTime(15)).toBe('15 min');
    expect(formatTravelTime(60)).toBe('1h');
    expect(formatTravelTime(380)).toBe('6h 20m');
    expect(formatTravelTime(24 * 60)).toBe('1d');
    expect(formatTravelTime(52 * 60)).toBe('2d 4h');
    expect(formatTravelTime(-5)).toBe('0 min');
  });
});

describe('formatDistance', () => {
  it('uses one decimal under 10 miles, whole miles above', () => {
    expect(formatDistance(0.4)).toBe('0.4 mi');
    expect(formatDistance(19.3)).toBe('19 mi');
  });
});

describe('dangerRating', () => {
  it('buckets 0..1 into labelled levels (clamped)', () => {
    expect(dangerRating(0).level).toBe('Safe');
    expect(dangerRating(0.2).level).toBe('Low');
    expect(dangerRating(0.4).level).toBe('Moderate');
    expect(dangerRating(0.6).level).toBe('High');
    expect(dangerRating(0.9).level).toBe('Perilous');
    expect(dangerRating(5).level).toBe('Perilous'); // clamped
    expect(dangerRating(0.4).color).toMatch(/^#/);
  });
});

describe('formatRouteSummary', () => {
  it('builds the one-line travel readout', () => {
    const route: RoutePlan = { cells: [0, 1, 2], points: [[0, 0]], miles: 19.3, minutes: 380, danger: 0.4 };
    expect(formatRouteSummary(route, 'on foot')).toBe('≈ 6h 20m · ~19 mi · Danger: Moderate · on foot');
    expect(formatRouteSummary(route, 'by horse')).toContain('by horse');
  });
});
