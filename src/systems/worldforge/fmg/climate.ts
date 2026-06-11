/**
 * @file climate.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: `defineMapSize`, `calculateMapCoordinates`,
 * `calculateTemperatures` and `generatePrecipitation` from
 * .tmp/azgaar-src/public/main.js (these stages were not yet moved into a
 * module on the TypeScript refactor branch). See ./ATTRIBUTION.md.
 *
 * RNG CONTRACT (critical): upstream's `defineMapSize` ALWAYS calls
 * `getSizeAndLatitude()` (gauss/P draws from the seeded global Math.random)
 * even when the size/latitude inputs are locked, and `generatePrecipitation`
 * later consumes the SAME stream via `rand(10, 20)`. defineMapSize is
 * therefore ported (not treated as UI-only randomization) so the
 * precipitation draw order matches upstream exactly. Explicit `mapSize`/
 * `latitude`/`longitude` options replicate upstream's "locked input"
 * behavior: the random values are still drawn, then discarded.
 *
 * Adaptations (cosmetic only):
 * - DOM inputs/globals became explicit parameters: `template`
 *   (templateInput), `grid`, `graphWidth`/`graphHeight`,
 *   `mapSizeOutput`/`latitudeOutput`/`longitudeOutput` (the returned/locked
 *   size-latitude-longitude triple), `options.temperature*`/`options.winds`,
 *   `heightExponentInput` (default 2), `precInput` (precipitation modifier),
 *   `pointsInput.dataset.cells` (cellsDesired).
 * - generatePrecipitation's `prec.selectAll("*").remove()` and the
 *   `drawWindDirection` IIFE (SVG wind arrows, no RNG draws) are stripped.
 * - TIME/DEBUG console wrappers stripped.
 */
import { mean, range } from "./d3Shim";
import { gauss, minmax, P, rand, rn } from "./utils";
import type { Grid } from "./utils/graphUtils";

/** Upstream global `mapCoordinates` — map position on the globe. */
export interface MapCoordinates {
  latT: number;
  latN: number;
  latS: number;
  lonT: number;
  lonW: number;
  lonE: number;
}

/**
 * Define map size and position based on template and random factor.
 * Exact port of `defineMapSize`/`getSizeAndLatitude` from upstream
 * public/main.js, returning the [size, latitude, longitude] triple instead of
 * writing DOM inputs. The caller applies "locked" overrides (upstream:
 * `locked("mapSize")` etc.) AFTER the draws, exactly like upstream.
 */
export function defineMapSize(
  template: string,
  grid: Grid,
): [number, number, number] {
  const [size, latitude, longitude] = getSizeAndLatitude();
  return [size, latitude, longitude];

  function getSizeAndLatitude(): [number, number, number] {
    // template is the heightmap template key (upstream: byId("templateInput").value)
    if (template === "africa-centric") return [45, 53, 38];
    if (template === "arabia") return [20, 35, 35];
    if (template === "atlantics") return [42, 23, 65];
    if (template === "britain") return [7, 20, 51.3];
    if (template === "caribbean") return [15, 40, 74.8];
    if (template === "east-asia") return [11, 28, 9.4];
    if (template === "eurasia") return [38, 19, 27];
    if (template === "europe") return [20, 16, 44.8];
    if (template === "europe-accented") return [14, 22, 44.8];
    if (template === "europe-and-central-asia") return [25, 10, 39.5];
    if (template === "europe-central") return [11, 22, 46.4];
    if (template === "europe-north") return [7, 18, 48.9];
    if (template === "greenland") return [22, 7, 55.8];
    if (template === "hellenica") return [8, 27, 43.5];
    if (template === "iceland") return [2, 15, 55.3];
    if (template === "indian-ocean") return [45, 55, 14];
    if (template === "mediterranean-sea") return [10, 29, 45.8];
    if (template === "middle-east") return [8, 31, 34.4];
    if (template === "north-america") return [37, 17, 87];
    if (template === "us-centric") return [66, 27, 100];
    if (template === "us-mainland") return [16, 30, 77.5];
    if (template === "world") return [78, 27, 40];
    if (template === "world-from-pacific") return [75, 32, 30]; // longitude doesn't fit

    const part = grid.features!.some((f) => f && f.land && f.border); // if land goes over map borders
    const max = part ? 80 : 100; // max size
    const lat = () => gauss(P(0.5) ? 40 : 60, 20, 25, 75); // latitude shift

    if (!part) {
      if (template === "pangea") return [100, 50, 50];
      if (template === "shattered" && P(0.7)) return [100, 50, 50];
      if (template === "continents" && P(0.5)) return [100, 50, 50];
      if (template === "archipelago" && P(0.35)) return [100, 50, 50];
      if (template === "highIsland" && P(0.25)) return [100, 50, 50];
      if (template === "lowIsland" && P(0.1)) return [100, 50, 50];
    }

    if (template === "pangea") return [gauss(70, 20, 30, max), lat(), 50];
    if (template === "volcano") return [gauss(20, 20, 10, max), lat(), 50];
    if (template === "mediterranean")
      return [gauss(25, 30, 15, 80), lat(), 50];
    if (template === "peninsula") return [gauss(15, 15, 5, 80), lat(), 50];
    if (template === "isthmus") return [gauss(15, 20, 3, 80), lat(), 50];
    if (template === "atoll") return [gauss(3, 2, 1, 5, 1), lat(), 50];

    return [gauss(30, 20, 15, max), lat(), 50]; // Continents, Archipelago, High Island, Low Island
  }
}

/**
 * Calculate map position on the globe.
 * Exact port of `calculateMapCoordinates` from upstream public/main.js.
 * @param mapSize - map size in % (upstream byId("mapSizeOutput").value)
 * @param latitude - latitude shift in % (upstream byId("latitudeOutput").value)
 * @param longitude - longitude shift in % (upstream byId("longitudeOutput").value)
 */
export function calculateMapCoordinates(
  mapSize: number,
  latitude: number,
  longitude: number,
  graphWidth: number,
  graphHeight: number,
): MapCoordinates {
  const sizeFraction = mapSize / 100;
  const latShift = latitude / 100;
  const lonShift = longitude / 100;

  const latT = rn(sizeFraction * 180, 1);
  const latN = rn(90 - (180 - latT) * latShift, 1);
  const latS = rn(latN - latT, 1);

  const lonT = rn(Math.min((graphWidth / graphHeight) * latT, 360), 1);
  const lonE = rn(180 - (360 - lonT) * lonShift, 1);
  const lonW = rn(lonE - lonT, 1);
  return { latT, latN, latS, lonT, lonW, lonE };
}

export interface TemperatureOptions {
  temperatureEquator: number; // upstream options.temperatureEquator, default 27
  temperatureNorthPole: number; // upstream options.temperatureNorthPole, default -30
  temperatureSouthPole: number; // upstream options.temperatureSouthPole, default -15
  heightExponent: number; // upstream heightExponentInput.value, default 2
}

/**
 * Temperature model, trying to follow real-world data.
 * Exact port of `calculateTemperatures` from upstream public/main.js
 * (based on http://www-das.uwyo.edu/~geerts/cwx/notes/chap16/Image64.gif).
 * No RNG draws.
 */
export function calculateTemperatures(
  grid: Grid,
  mapCoordinates: MapCoordinates,
  graphHeight: number,
  options: TemperatureOptions,
): void {
  const cells = grid.cells;
  cells.temp = new Int8Array(cells.i.length); // temperature array

  const { temperatureEquator, temperatureNorthPole, temperatureSouthPole } =
    options;
  const tropics = [16, -20]; // tropics zone
  const tropicalGradient = 0.15;

  const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
  const northernGradient =
    (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);

  const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
  const southernGradient =
    (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

  const exponent = options.heightExponent;

  for (
    let rowCellId = 0;
    rowCellId < cells.i.length;
    rowCellId += grid.cellsX
  ) {
    const [, y] = grid.points[rowCellId];
    const rowLatitude =
      mapCoordinates.latN - (y / graphHeight) * mapCoordinates.latT; // [90; -90]
    const tempSeaLevel = calculateSeaLevelTemp(rowLatitude);

    for (let cellId = rowCellId; cellId < rowCellId + grid.cellsX; cellId++) {
      const tempAltitudeDrop = getAltitudeTemperatureDrop(cells.h![cellId]);
      cells.temp[cellId] = minmax(tempSeaLevel - tempAltitudeDrop, -128, 127);
    }
  }

  function calculateSeaLevelTemp(latitude: number) {
    const isTropical = latitude <= 16 && latitude >= -20;
    if (isTropical)
      return temperatureEquator - Math.abs(latitude) * tropicalGradient;

    return latitude > 0
      ? tempNorthTropic - (latitude - tropics[0]) * northernGradient
      : tempSouthTropic + (latitude - tropics[1]) * southernGradient;
  }

  // temperature drops by 6.5°C per 1km of altitude
  function getAltitudeTemperatureDrop(h: number) {
    if (h < 20) return 0;
    const height = Math.pow(h - 18, exponent);
    return rn((height / 1000) * 6.5);
  }
}

export interface PrecipitationOptions {
  winds: number[]; // upstream options.winds, default [225, 45, 225, 315, 135, 315]
  cellsDesired: number; // upstream pointsInput.dataset.cells, default 10000
  precipitationModifier: number; // upstream precInput.value (%), see ATTRIBUTION.md for the default rationale
}

/**
 * Simplest precipitation model.
 * Exact port of `generatePrecipitation` from upstream public/main.js, minus
 * the SVG wind-arrow rendering (`prec.selectAll(...)`/`drawWindDirection`),
 * which draws no RNG. The `rand(10, 20)` coastal draws consume the global
 * Math.random stream in exactly the upstream order.
 */
export function generatePrecipitation(
  grid: Grid,
  mapCoordinates: MapCoordinates,
  options: PrecipitationOptions,
): void {
  const { cells, cellsX, cellsY } = grid;
  cells.prec = new Uint8Array(cells.i.length); // precipitation array

  const cellsNumberModifier = (options.cellsDesired / 10000) ** 0.25;
  const precInputModifier = options.precipitationModifier / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  const westerly: Array<[number, number, number]> = [];
  const easterly: Array<[number, number, number]> = [];
  let southerly = 0;
  let northerly = 0;

  // precipitation modifier per latitude band
  // x4 = 0-5 latitude: wet through the year (rising zone)
  // x2 = 5-20 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 20-30 latitude: dry all year (sinking zone)
  // x2 = 30-50 latitude: wet winter (rising zone), dry summer (sinking zone)
  // x3 = 50-60 latitude: wet all year (rising zone)
  // x2 = 60-70 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 70-85 latitude: dry all year (sinking zone)
  // x0.5 = 85-90 latitude: dry all year (sinking zone)
  const latitudeModifier = [
    4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5,
  ];
  const MAX_PASSABLE_ELEVATION = 85;

  // define wind directions based on cells latitude and prevailing winds there
  range(0, cells.i.length, cellsX).forEach(function (c, i) {
    const lat = mapCoordinates.latN - (i / cellsY) * mapCoordinates.latT;
    const latBand = ((Math.abs(lat) - 1) / 5) | 0;
    const latMod = latitudeModifier[latBand];
    const windTier = (Math.abs(lat - 89) / 30) | 0; // 30d tiers from 0 to 5 from N to S
    const { isWest, isEast, isNorth, isSouth } = getWindDirections(windTier);

    if (isWest) westerly.push([c, latMod, windTier]);
    if (isEast) easterly.push([c + cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  });

  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

  const vertT = southerly + northerly;
  if (northerly) {
    const bandN = ((Math.abs(mapCoordinates.latN) - 1) / 5) | 0;
    const latModN =
      mapCoordinates.latT > 60
        ? (mean(latitudeModifier) as number)
        : latitudeModifier[bandN];
    const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
    passWind(range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
  }

  if (southerly) {
    const bandS = ((Math.abs(mapCoordinates.latS) - 1) / 5) | 0;
    const latModS =
      mapCoordinates.latT > 60
        ? (mean(latitudeModifier) as number)
        : latitudeModifier[bandS];
    const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
    passWind(
      range(cells.i.length - cellsX, cells.i.length, 1),
      maxPrecS,
      -cellsX,
      cellsY,
    );
  }

  function getWindDirections(tier: number) {
    const angle = options.winds[tier];

    const isWest = angle > 40 && angle < 140;
    const isEast = angle > 220 && angle < 320;
    const isNorth = angle > 100 && angle < 260;
    const isSouth = angle > 280 || angle < 80;

    return { isWest, isEast, isNorth, isSouth };
  }

  function passWind(
    source: Array<[number, number, number]> | number[],
    maxPrec: number,
    next: number,
    steps: number,
  ) {
    const maxPrecInit = maxPrec;

    // UPSTREAM BUG PRESERVED: `if (first[0])` is meant to unpack the
    // [cellId, latMod, windTier] tuples, but it is falsy when cellId is 0
    // (the first west-coast row cell), so `first` then stays an ARRAY and the
    // subsequent typed-array accesses (cells.h[first], cells.prec[current])
    // hit junk string keys / produce NaN humidity — no real element is
    // modified and no RNG is drawn on that path. Replicated verbatim via the
    // `any` typing below.
    for (let first of source as any[]) {
      if (first[0]) {
        maxPrec = Math.min(maxPrecInit * first[1], 255);
        first = first[0];
      }

      let humidity = maxPrec - cells.h![first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated consider wind dry

      for (let s = 0, current = first; s < steps; s++, current += next) {
        if (cells.temp![current] < -5) continue; // no flux in permafrost

        if (cells.h![current] < 20) {
          // water cell
          if (cells.h![current + next] >= 20) {
            cells.prec![current + next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            cells.prec![current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
          }
          continue;
        }

        // land cell
        const isPassable = cells.h![current + next] <= MAX_PASSABLE_ELEVATION;
        const precipitation = isPassable
          ? getPrecipitation(humidity, current, next)
          : humidity;
        cells.prec![current] += precipitation;
        const evaporation = precipitation > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = isPassable
          ? minmax(humidity - precipitation + evaporation, 0, maxPrec)
          : 0;
      }
    }
  }

  function getPrecipitation(humidity: number, i: number, n: number) {
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(cells.h![i + n] - cells.h![i], 0); // difference in height
    const mod = (cells.h![i + n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return minmax(normalLoss + diff * mod, 1, humidity);
  }
}
