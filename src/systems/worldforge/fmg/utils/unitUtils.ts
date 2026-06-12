/**
 * @file utils/unitUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/unitUtils.ts (convertTemperature)
 * and public/modules/ui/general.js (getHeight/getFriendlyHeight). See
 * ../ATTRIBUTION.md. Added for the Markers port (volcano heights, hot-spring
 * temperatures, sacred-mountain heights, monster lengths).
 *
 * Adaptations: upstream getHeight reads the heightUnit select and
 * heightExponentInput slider from the DOM — explicit parameters here with
 * the upstream defaults ("ft", exponent 2). getFriendlyHeight's pack/grid
 * lookups are injected via a factory.
 */
import { rn } from "./numberUtils";
import { findGridCell, type Grid } from "./graphUtils";

export type TemperatureScale = "°C" | "°F" | "K" | "°R" | "°De" | "°N" | "°Ré" | "°Rø";

/** Convert temperature from Celsius to other scales — verbatim. */
export const convertTemperature = (
  temperatureInCelsius: number,
  targetScale: TemperatureScale = "°C",
) => {
  const temperatureConversionMap: { [key: string]: (temp: number) => string } = {
    "°C": (temp: number) => `${rn(temp)}°C`,
    "°F": (temp: number) => `${rn((temp * 9) / 5 + 32)}°F`,
    K: (temp: number) => `${rn(temp + 273.15)}K`,
    "°R": (temp: number) => `${rn(((temp + 273.15) * 9) / 5)}°R`,
    "°De": (temp: number) => `${rn(((100 - temp) * 3) / 2)}°De`,
    "°N": (temp: number) => `${rn((temp * 33) / 100)}°N`,
    "°Ré": (temp: number) => `${rn((temp * 4) / 5)}°Ré`,
    "°Rø": (temp: number) => `${rn((temp * 21) / 40 + 7.5)}°Rø`,
  };
  return temperatureConversionMap[targetScale](temperatureInCelsius);
};

/**
 * User-friendly (real-world) height from an FMG height value — upstream
 * general.js getHeight. Default calculations are in feet (unitRatio 3.281).
 */
export const getHeight = (
  h: number,
  heightUnit: string = "ft",
  heightExponent: number = 2,
  abs = false,
): string => {
  let unitRatio = 3.281; // default calculations are in feet
  if (heightUnit === "m") unitRatio = 1; // if meter
  else if (heightUnit === "f") unitRatio = 0.5468; // if fathom

  let height = -990;
  if (h >= 20) height = Math.pow(h - 18, heightExponent);
  else if (h < 20 && h > 0) height = ((h - 20) / h) * 50;

  if (abs) height = Math.abs(height);
  return rn(height * unitRatio) + " " + heightUnit;
};

/**
 * Factory for upstream general.js getFriendlyHeight([x, y]): pack height at
 * the cell under the point, falling back to grid height under water.
 * `findCell` is the pack-level closest-cell lookup (pack.cells.q based).
 */
export const makeGetFriendlyHeight = (
  findCell: (x: number, y: number) => number,
  packH: ArrayLike<number>,
  grid: Grid,
  heightUnit: string = "ft",
  heightExponent: number = 2,
) => {
  return (p: [number, number] | ArrayLike<number>): string => {
    const x = p[0];
    const y = p[1];
    const packHeight = packH[findCell(x, y)];
    const gridHeight = (grid.cells.h as ArrayLike<number>)[findGridCell(x, y, grid)];
    const h = packHeight < 20 ? gridHeight : packHeight;
    return getHeight(h, heightUnit, heightExponent);
  };
};
