/** A festival fixed to a particular day-of-year (0..364). */
export interface SeasonalFestival {
    name: string;
    dayOfYear: number;
}
/**
 * Shared seasonal festivals every town keeps, spread across the year. Days are
 * fixed points roughly at the quarter-marks of the 365-day calendar.
 */
export declare const SEASONAL_FESTIVALS: readonly SeasonalFestival[];
/** Day-of-year (0..364) a burg celebrates its founding — deterministic per burg. */
export declare function foundingDayOfYear(burgId: number): number;
/** Day-of-year (0..364) a burg keeps its patron's feast — deterministic per burg. */
export declare function patronFeastDayOfYear(burgId: number): number;
/** The patron deity a burg honours — deterministic per burg, from the pantheon. */
export declare function patronDeityName(burgId: number): string;
/**
 * Names of all festivals (shared seasonal + this burg's Founding Day + Patron's
 * Feast) that fall on the given day-of-year. `[]` on an ordinary day.
 */
export declare function festivalsOnDayOfYear(dayOfYear: number, burgId: number): string[];
