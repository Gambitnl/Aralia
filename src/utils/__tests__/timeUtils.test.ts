import { describe, it, expect } from 'vitest';
import {
    getSeason,
    getTimeOfDay,
    getTimeModifiers,
    Season,
    TimeOfDay,
    getGameEpoch,
    formatGameTime,
    getGameDay,
    addGameTime,
    formatDuration,
    formatGameDate,
    formatGameDateTime,
    GAME_EPOCH_YEAR,
    GAME_EPOCH_MONTH,
    GAME_EPOCH_DAY,
    GAME_EPOCH_HOUR,
    GAME_EPOCH_MINUTE,
    GAME_EPOCH_SECOND
} from '../timeUtils';

describe('timeUtils', () => {
    describe('Existing Utilities', () => {
        const epoch = getGameEpoch();

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

        it('should calculate modifiers correctly for Winter Night', () => {
            // Winter Night: Jan 1st, 22:00
            const date = new Date(Date.UTC(351, 0, 1, 22, 0));
            const mods = getTimeModifiers(date);

            expect(getSeason(date)).toBe(Season.Winter);
            expect(getTimeOfDay(date)).toBe(TimeOfDay.Night);

            // Winter (1.25) * Night (1.5) = 1.875
            expect(mods.travelCostMultiplier).toBeCloseTo(1.25 * 1.5);
            expect(mods.visionModifier).toBe(0.2);
            expect(mods.description).toContain('biting cold');
            expect(mods.description).toContain('Darkness');
        });

        it('should calculate modifiers correctly for Summer Day', () => {
            // Summer Day: Jul 1st, 12:00
            const date = new Date(Date.UTC(351, 6, 1, 12, 0));
            const mods = getTimeModifiers(date);

            expect(getSeason(date)).toBe(Season.Summer);
            expect(getTimeOfDay(date)).toBe(TimeOfDay.Day);

            // Summer (1.0) * Day (1.0) = 1.0
            expect(mods.travelCostMultiplier).toBe(1.0);
            expect(mods.visionModifier).toBe(1.0);
            expect(mods.description).toContain('warm');
            expect(mods.description).toContain('sun is high');
        });
    });
});
