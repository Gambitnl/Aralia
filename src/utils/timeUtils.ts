/**
 * @file src/utils/timeUtils.ts
 * Centralized logic for game time, including constants, formatting, and calculations.
 */

// Game Epoch: Year 351, Month 0 (January), Day 1
export const GAME_EPOCH_YEAR = 351;
export const GAME_EPOCH_MONTH = 0; // January
export const GAME_EPOCH_DAY = 1;

// The base date object for the start of the game (00:00:00)
export const GAME_EPOCH = new Date(GAME_EPOCH_YEAR, GAME_EPOCH_MONTH, GAME_EPOCH_DAY, 0, 0, 0, 0);

// The standard start time for a new adventure (e.g., 07:00 AM)
export const GAME_START_TIME = new Date(GAME_EPOCH_YEAR, GAME_EPOCH_MONTH, GAME_EPOCH_DAY, 7, 0, 0, 0);

/**
 * Returns a new Date object representing the standard start of the game (07:00 AM).
 */
export const getInitialGameTime = (): Date => {
    return new Date(GAME_START_TIME);
};

/**
 * Returns a new Date object representing the start of the epoch (00:00:00).
 */
export const getGameEpoch = (): Date => {
    return new Date(GAME_EPOCH);
};

/**
 * Formats a game date object into a consistent string format.
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatGameDate = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
    return date.toLocaleDateString(undefined, options);
};

/**
 * Formats a game time object into a consistent string format.
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted time string
 */
export const formatGameTime = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
    return date.toLocaleTimeString(undefined, options);
};

/**
 * Formats a game date and time into a consistent string format.
 * @param date The date to format
 * @returns Formatted date and time string
 */
export const formatGameDateTime = (date: Date): string => {
    return date.toLocaleString();
};

/**
 * Calculates the difference in milliseconds between the given date and the game epoch.
 * Useful for calculating total time elapsed since the "beginning of time".
 * @param date The current game date
 * @returns Milliseconds since epoch
 */
export const getTimeSinceEpoch = (date: Date): number => {
    return date.getTime() - GAME_EPOCH.getTime();
};
