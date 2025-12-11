/**
 * @file src/utils/timeUtils.ts
 * Centralized utilities for handling game time and real-world time.
 */

// The date the game starts: Year 351, Month 0 (January), Day 1
export const GAME_EPOCH = new Date(351, 0, 1, 0, 0, 0);

/**
 * Calculates the in-game day number based on the time difference from the epoch.
 * Day 1 starts at the epoch.
 *
 * @param date The in-game Date object.
 * @returns The day number (integer, starting at 1).
 */
export const getGameDay = (date: Date): number => {
  const diffMs = date.getTime() - GAME_EPOCH.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Formats a Date object representing in-game time into a string.
 * Displays "Day X, HH:MM AM/PM".
 *
 * @param date The in-game Date object.
 * @param options Intl.DateTimeFormatOptions (optional) to customize time formatting.
 * @returns Formatted string.
 */
export const formatGameTime = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
  const dayNumber = getGameDay(date);
  const defaultOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  const timeString = date.toLocaleTimeString([], options || defaultOptions);
  return `Day ${dayNumber}, ${timeString}`;
};

/**
 * Formats a Date object representing real-world time into a short string.
 * Useful for UI timestamps (e.g., chat logs).
 *
 * @param date The real-world Date object or timestamp number.
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted string (default: HH:MM AM/PM).
 */
export const formatRealTime = (date: Date | number, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  return d.toLocaleTimeString([], options || defaultOptions);
};

/**
 * Formats a Date object representing real-world time into a date string.
 * Useful for save files or logs.
 *
 * @param date The real-world Date object or timestamp number.
 * @returns Formatted string (e.g., "1/1/2024, 12:00:00 PM").
 */
export const formatRealDate = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString();
};
