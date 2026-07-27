import { type Grid } from "./graphUtils";
export type TemperatureScale = "°C" | "°F" | "K" | "°R" | "°De" | "°N" | "°Ré" | "°Rø";
/** Convert temperature from Celsius to other scales — verbatim. */
export declare const convertTemperature: (temperatureInCelsius: number, targetScale?: TemperatureScale) => string;
/**
 * User-friendly (real-world) height from an FMG height value — upstream
 * general.js getHeight. Default calculations are in feet (unitRatio 3.281).
 */
export declare const getHeight: (h: number, heightUnit?: string, heightExponent?: number, abs?: boolean) => string;
/**
 * Factory for upstream general.js getFriendlyHeight([x, y]): pack height at
 * the cell under the point, falling back to grid height under water.
 * `findCell` is the pack-level closest-cell lookup (pack.cells.q based).
 */
export declare const makeGetFriendlyHeight: (findCell: (x: number, y: number) => number, packH: ArrayLike<number>, grid: Grid, heightUnit?: string, heightExponent?: number) => (p: [number, number] | ArrayLike<number>) => string;
