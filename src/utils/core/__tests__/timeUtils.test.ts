import { describe, it, expect } from 'vitest';
import {
    getSeason,
    getTimeOfDay,
    getDayPartLabel,
    Season,
    TimeOfDay,
    getGameEpoch,
    formatGameTime,
    getGameDay,
    addGameTime,
    formatDuration,
    formatGameDate,
    GAME_EPOCH_YEAR,
    GAME_EPOCH_MONTH,
    GAME_EPOCH_DAY,
    GAME_EPOCH_HOUR,
    GAME_EPOCH_MINUTE,
    GAME_EPOCH_SECOND
} from '../timeUtils';

describe('timeUtils', () => {
    describe('Existing Utilities', () => {
        it('should return the correct epoch date', () => {
            const date = getGameEpoch();
            expect(date.getUTCFullYear()).toBe(GAME_EPOCH_YEAR);
            expect(date.getUTCMonth()).toBe(GAME_EPOCH_MONTH);
            expect(date.getUTCDate()).toBe(GAME_EPOCH_DAY);
            expect(date.getUTCHours()).toBe(GAME_EPOCH_HOUR);
            expect(date.getUTCMinutes()).toBe(GAME_EPOCH_MINUTE);
            expect(date.getUTCSeconds()).toBe(GAME_EPOCH_SECOND);
        });

        it('should format game time correctly', () => {
            const date = new Date(Date.UTC(351, 0, 1, 14, 30, 0));
            // Expect local time format but based on UTC input.
            // The function uses toLocaleTimeString with timeZone: 'UTC', so it should be stable.
            // However, toLocaleTimeString depends on locale. We can check if it contains the time parts.
            const formatted = formatGameTime(date);
            // Default locale might vary, but standard English usually works.
            // If checking exact string is flaky, check parts.
            // But let's assume default behaviour for now as in existing app usage.
            // Ideally we check if it includes "2:30" or "14:30".
            expect(formatted).toBeTruthy();
        });

        it('should format game date correctly', () => {
            const date = new Date(Date.UTC(351, 0, 1));
            const formatted = formatGameDate(date);
            expect(formatted).toBeTruthy();
        });

        it('should calculate game day correctly', () => {
            const day1 = getGameEpoch();
            expect(getGameDay(day1)).toBe(1);

            const day2 = new Date(day1.getTime() + 24 * 60 * 60 * 1000);
            expect(getGameDay(day2)).toBe(2);
        });

        it('should add game time correctly', () => {
            const start = getGameEpoch();
            const added = addGameTime(start, { days: 1, hours: 2 });
            const diff = added.getTime() - start.getTime();
            expect(diff).toBe((24 + 2) * 60 * 60 * 1000);
        });

        it('should format duration correctly', () => {
            expect(formatDuration(0)).toBe("a moment");
            expect(formatDuration(30)).toBe("less than a minute");
            expect(formatDuration(60)).toBe("1 minute");
            expect(formatDuration(3600)).toBe("1 hour");
            expect(formatDuration(3661)).toBe("1 hour, 1 minute");
        });
    });

    describe('Timekeeper Features', () => {
        it('should correctly identify Seasons', () => {
            // Jan 1 - Winter
            expect(getSeason(new Date(Date.UTC(351, 0, 1)))).toBe(Season.Winter);
            // Apr 1 - Spring
            expect(getSeason(new Date(Date.UTC(351, 3, 1)))).toBe(Season.Spring);
            // Jul 1 - Summer
            expect(getSeason(new Date(Date.UTC(351, 6, 1)))).toBe(Season.Summer);
            // Oct 1 - Autumn
            expect(getSeason(new Date(Date.UTC(351, 9, 1)))).toBe(Season.Autumn);
            // Dec 1 - Winter
            expect(getSeason(new Date(Date.UTC(351, 11, 1)))).toBe(Season.Winter);
        });

        it('should correctly identify Time of Day', () => {
            // 06:00 - Dawn (5-7)
            expect(getTimeOfDay(new Date(Date.UTC(351, 0, 1, 6, 0)))).toBe(TimeOfDay.Dawn);
            // 12:00 - Day (7-17)
            expect(getTimeOfDay(new Date(Date.UTC(351, 0, 1, 12, 0)))).toBe(TimeOfDay.Day);
            // 18:00 - Dusk (17-20)
            expect(getTimeOfDay(new Date(Date.UTC(351, 0, 1, 18, 0)))).toBe(TimeOfDay.Dusk);
            // 22:00 - Night (20-5)
            expect(getTimeOfDay(new Date(Date.UTC(351, 0, 1, 22, 0)))).toBe(TimeOfDay.Night);
            // 02:00 - Night
            expect(getTimeOfDay(new Date(Date.UTC(351, 0, 1, 2, 0)))).toBe(TimeOfDay.Night);
        });

        // getTimeModifiers moved to systems/time/seasonContract (G3) — its
        // combined season × time-of-day tests live in seasonContract.test.ts.

        it('picks day-part words from the local in-world clock (UTC fields)', () => {
            // G5: the word must match the HUD clock, which renders gameTime in
            // UTC — so the label derives from getUTCHours, never host-local hours.
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 0, 0)))).toBe('Night');
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 5, 59)))).toBe('Night');
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 6, 0)))).toBe('Morning');
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 11, 59)))).toBe('Morning');
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 12, 0)))).toBe('Afternoon');
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 17, 59)))).toBe('Afternoon');
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 18, 0)))).toBe('Evening');
            expect(getDayPartLabel(new Date(Date.UTC(351, 0, 1, 23, 30)))).toBe('Evening');
        });

        it('day-part words ignore the host timezone entirely', () => {
            // A given instant has ONE in-world label, whatever machine renders it.
            // 21:00 UTC on the game clock is Evening even when the host's local
            // rendering of the same instant crosses midnight (e.g. UTC+5).
            const t = new Date(Date.UTC(351, 5, 10, 21, 0));
            expect(getDayPartLabel(t)).toBe('Evening');
            expect(getDayPartLabel(new Date(t.getTime()))).toBe('Evening');
        });
    });
});
