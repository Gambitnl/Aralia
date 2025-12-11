/**
 * @file src/utils/timeUtils.ts
 * Utility functions for handling time and date formatting.
 * Consolidates time logic to ensure consistency across the application.
 */

/**
 * Standard options for displaying in-game time (e.g., "10:30 AM").
 */
const GAME_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
};

/**
 * Standard options for displaying in-game time with seconds (e.g., "10:30:15 AM").
 */
const GAME_TIME_WITH_SECONDS_OPTIONS: Intl.DateTimeFormatOptions = {
  ...GAME_TIME_OPTIONS,
  second: '2-digit',
};

/**
 * Formats a Date object into a standard game time string.
 * @param date The date to format.
 * @param includeSeconds Whether to include seconds in the output.
 * @returns Formatted time string (e.g., "10:30 AM" or "10:30:45 AM").
 */
export function formatGameTime(date: Date, includeSeconds: boolean = false): string {
  return date.toLocaleTimeString(
    [],
    includeSeconds ? GAME_TIME_WITH_SECONDS_OPTIONS : GAME_TIME_OPTIONS
  );
}

/**
 * Formats a timestamp (number or Date) into a standard real-world date/time string.
 * Used for save files, logs, etc.
 * @param timestamp The timestamp to format.
 * @returns Formatted date string (e.g., "10/01/2023 12:00 PM" depending on locale).
 */
export function formatRealTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Formats a timestamp (number or Date) into a standard real-world date string (no time).
 * Used for logs where only the date is needed.
 * @param timestamp The timestamp to format.
 * @returns Formatted date string (e.g., "10/01/2023").
 */
export function formatRealDate(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleDateString();
}

/**
 * Adds seconds to a Date object and returns a new Date object.
 * Used for advancing game time.
 * @param date The original date.
 * @param seconds The number of seconds to add.
 * @returns A new Date object with the added seconds.
 */
export function addSecondsToDate(date: Date, seconds: number): Date {
  const newDate = new Date(date.getTime());
  newDate.setSeconds(newDate.getSeconds() + seconds);
  return newDate;
}
