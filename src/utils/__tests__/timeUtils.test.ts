import { describe, it, expect } from 'vitest';
import {
  getGameEpoch,
  formatGameTime,
  formatGameDate,
  formatGameDateTime,
  getGameDay,
  addGameTime,
  formatDuration,
  GAME_EPOCH_YEAR,
  GAME_EPOCH_MONTH,
  GAME_EPOCH_DAY,
  GAME_EPOCH_HOUR,
  GAME_EPOCH_MINUTE,
  GAME_EPOCH_SECOND
} from '../timeUtils';

describe('timeUtils', () => {
  it('getGameEpoch returns the correct starting date', () => {
    const epoch = getGameEpoch();
    expect(epoch.getUTCFullYear()).toBe(GAME_EPOCH_YEAR);
    expect(epoch.getUTCMonth()).toBe(GAME_EPOCH_MONTH);
    expect(epoch.getUTCDate()).toBe(GAME_EPOCH_DAY);
    expect(epoch.getUTCHours()).toBe(GAME_EPOCH_HOUR);
    expect(epoch.getUTCMinutes()).toBe(GAME_EPOCH_MINUTE);
    expect(epoch.getUTCSeconds()).toBe(GAME_EPOCH_SECOND);
  });

  it('formatGameTime formats time correctly in UTC', () => {
    const date = new Date(Date.UTC(2024, 0, 1, 13, 30, 0));
    // Default locale might vary, but timeZone: 'UTC' ensures UTC time is used
    // Note: Output depends on Node's locale, usually en-US in test environments or similar
    const result = formatGameTime(date, { hour: '2-digit', minute: '2-digit', hour12: false });
    expect(result).toMatch(/13:30/);
  });

  it('formatGameDate formats date correctly in UTC', () => {
    const date = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    // Checking for presence of date parts since locale formatting varies
    const result = formatGameDate(date);
    expect(result).toContain('1'); // month
    expect(result).toContain('15'); // day
    expect(result).toContain('2024'); // year
  });

  it('getGameDay returns correct day number relative to epoch', () => {
    const epoch = getGameEpoch();
    const day1 = getGameDay(epoch);
    expect(day1).toBe(1);

    const nextDay = new Date(epoch.getTime() + 24 * 60 * 60 * 1000);
    expect(getGameDay(nextDay)).toBe(2);

    // Test slightly into the next day
    const nextDayPlus = new Date(epoch.getTime() + 25 * 60 * 60 * 1000);
    expect(getGameDay(nextDayPlus)).toBe(2);
  });

  it('addGameTime adds time correctly', () => {
    const start = new Date(Date.UTC(2024, 0, 1, 10, 0, 0));

    const plusHours = addGameTime(start, { hours: 2 });
    expect(plusHours.getUTCHours()).toBe(12);

    const plusDays = addGameTime(start, { days: 1 });
    expect(plusDays.getUTCDate()).toBe(2);

    const plusComplex = addGameTime(start, { days: 1, hours: 2, minutes: 30 });
    expect(plusComplex.getUTCDate()).toBe(2);
    expect(plusComplex.getUTCHours()).toBe(12);
    expect(plusComplex.getUTCMinutes()).toBe(30);

    // Test overflow
    const overflow = addGameTime(start, { minutes: 90 });
    expect(overflow.getUTCHours()).toBe(11);
    expect(overflow.getUTCMinutes()).toBe(30);
  });

  it('formatDuration formats seconds to human readable string', () => {
    expect(formatDuration(0)).toBe("a moment");
    expect(formatDuration(59)).toBe("less than a minute");
    expect(formatDuration(60)).toBe("1 minute");
    expect(formatDuration(3600)).toBe("1 hour");
    expect(formatDuration(3660)).toBe("1 hour, 1 minute");
    expect(formatDuration(86400)).toBe("1 day");
    expect(formatDuration(90000)).toBe("1 day, 1 hour");
  });
});
