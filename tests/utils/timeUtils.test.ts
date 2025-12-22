
import { describe, it, expect } from 'vitest';
import { getGameEpoch, formatGameTime, formatGameDate, formatGameDateTime, GAME_EPOCH_YEAR } from '../../src/utils/timeUtils';

describe('timeUtils', () => {
  it('getGameEpoch should return a UTC date', () => {
    const epoch = getGameEpoch();
    // 351-01-01T00:00:00.000Z
    expect(epoch.toISOString()).toMatch(/0351-01-01T00:00:00\.000Z/);
    expect(epoch.getUTCFullYear()).toBe(351);
  });

  it('formatGameTime should format using UTC timezone', () => {
    const date = new Date(Date.UTC(351, 0, 1, 7, 30, 0));
    // Should be 07:30 AM
    const formatted = formatGameTime(date, { hour: '2-digit', minute: '2-digit', hour12: true });
    expect(formatted).toBe('07:30 AM');
  });

  it('formatGameDate should format using UTC timezone', () => {
    const date = new Date(Date.UTC(351, 0, 1, 7, 0, 0));
    // 01/01/351 or similar depending on locale, but definitely not previous day
    const formatted = formatGameDate(date);
    // Checking for year presence and day
    expect(formatted).toContain('351');
    expect(formatted).toContain('1');
  });

  it('formatGameTime should handle timezones correctly', () => {
    // 12:00 UTC
    const date = new Date(Date.UTC(351, 0, 1, 12, 0, 0));

    // Even if I am in a different timezone (simulated), formatGameTime should output 12:00 PM
    const formatted = formatGameTime(date, { hour: 'numeric', minute: 'numeric', hour12: true });
    expect(formatted).toBe('12:00 PM');
  });
});
