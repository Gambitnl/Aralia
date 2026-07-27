/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:32:07
 * Dependents: WorldHistoryService.ts, contextUtils.ts, core/index.ts, factionUtils.ts, factories.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export declare const GAME_EPOCH_YEAR = 351;
export declare const GAME_EPOCH_MONTH = 0;
export declare const GAME_EPOCH_DAY = 1;
export declare const GAME_EPOCH_HOUR = 0;
export declare const GAME_EPOCH_MINUTE = 0;
export declare const GAME_EPOCH_SECOND = 0;
export interface GameDuration {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
}
export declare const getGameEpoch: () => Date;
export declare const formatGameTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
/**
 * Returns a fresh snapshot of the in-game clock for stamping player-visible log
 * entries, so the adventure Log stays consistent with the HUD's date/time rather
 * than showing the real-world wall clock. Falls back to the real clock only if
 * gameTime is somehow not a Date (e.g. a malformed legacy save).
 */
export declare const inGameTimestamp: (gameTime: unknown) => Date;
export declare const formatGameDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
export declare const formatGameDateTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
export declare const getGameDay: (date: Date) => number;
export declare const addGameTime: (date: Date, duration: GameDuration) => Date;
export declare const formatDuration: (totalSeconds: number) => string;
export declare enum Season {
    Spring = "Spring",
    Summer = "Summer",
    Autumn = "Autumn",
    Winter = "Winter"
}
export declare enum TimeOfDay {
    Dawn = "Dawn",
    Day = "Day",
    Dusk = "Dusk",
    Night = "Night"
}
export declare const getSeason: (date: Date) => Season;
export declare const getTimeOfDay: (date: Date) => TimeOfDay;
/**
 * Player-facing day-part vocabulary for dialogue/social context (G5).
 * Distinct from `TimeOfDay` (Dawn/Day/Dusk/Night), which drives mechanics.
 */
export type DayPartLabel = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
/**
 * THE way to pick a time-of-day word (generational-time G5): derive it from
 * the character's local in-world clock — the same clock the player sees on the
 * HUD. `gameTime` is a UTC `Date` and every player-visible rendering of it
 * uses UTC fields (`formatGameTime` passes `timeZone: 'UTC'`), so the label
 * must read `getUTCHours()`. Never use `.getHours()` on the game clock for a
 * player-visible word: that applies the HOST MACHINE's timezone and shifts
 * "morning"/"evening" away from the clock the player is looking at.
 */
export declare const getDayPartLabel: (gameTime: Date) => DayPartLabel;
