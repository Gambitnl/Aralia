
import { describe, it, expect } from 'vitest';
import { formatGameTime, formatRealTime, formatRealDate, GAME_EPOCH } from '../timeUtils';

describe('timeUtils', () => {
  it('GAME_EPOCH should be set to Year 351, Month 0, Day 1', () => {
    expect(GAME_EPOCH.getFullYear()).toBe(351);
    expect(GAME_EPOCH.getMonth()).toBe(0); // January
    expect(GAME_EPOCH.getDate()).toBe(1);
    expect(GAME_EPOCH.getHours()).toBe(0);
    expect(GAME_EPOCH.getMinutes()).toBe(0);
  });

  describe('formatGameTime', () => {
    it('should format the start time correctly', () => {
      const time = new Date(GAME_EPOCH.getTime());
      // Day 1, 12:00 AM
      expect(formatGameTime(time)).toBe('Day 1, 12:00:00 AM');
    });

    it('should format a time later in the day correctly', () => {
      const time = new Date(GAME_EPOCH.getTime());
      time.setHours(14, 30, 0); // 2:30 PM
      expect(formatGameTime(time)).toBe('Day 1, 02:30:00 PM');
    });

    it('should format a time on a subsequent day correctly', () => {
      const time = new Date(GAME_EPOCH.getTime());
      time.setDate(time.getDate() + 2); // Day 3
      time.setHours(9, 15, 0);
      expect(formatGameTime(time)).toBe('Day 3, 09:15:00 AM');
    });
  });

  describe('formatRealTime', () => {
    it('should format real time correctly', () => {
      const time = new Date('2024-05-22T10:00:00');
      // Note: This test might depend on the system locale/timezone running the test.
      // However, we can check if it returns a string.
      const formatted = formatRealTime(time);
      expect(typeof formatted).toBe('string');
      expect(formatted).toMatch(/\d{2}:\d{2} [AP]M/);
    });
  });

    describe('formatRealDate', () => {
    it('should format real date correctly', () => {
      const time = new Date('2024-05-22T10:00:00');
      const formatted = formatRealDate(time);
      expect(typeof formatted).toBe('string');
      // Should contain the date parts
      expect(formatted).toContain('2024');
    });
  });
});
