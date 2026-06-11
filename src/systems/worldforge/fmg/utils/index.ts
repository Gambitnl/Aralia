/**
 * @file utils/index.ts — barrel for the headless subset of FMG utils ported
 * for Worldforge slice 1 (see ../ATTRIBUTION.md). Upstream's utils/index.ts
 * also wires everything onto `window`; that wiring is intentionally absent —
 * these modules must run headless (Node/vitest/workers).
 */
export { rn, lim, minmax, normalize, lerp } from "./numberUtils";
export {
  last,
  unique,
  getTypedArray,
  createTypedArray,
  TYPED_ARRAY_MAX_VALUES,
} from "./arrayUtils";
export {
  rand,
  P,
  each,
  Pint,
  ra,
  rw,
  biased,
  gauss,
  getNumberInRange,
  generateSeed,
} from "./probabilityUtils";
export { distanceSquared } from "./functionUtils";
export {
  connectVertices,
  findPath,
  getIsolines,
  getPolesOfInaccessibility,
} from "./pathUtils";
export { clipPoly } from "./commonUtils";
export { polygonclip, type BBox } from "./lineclip";
export {
  generateGrid,
  calculateVoronoi,
  findClosestCell,
  findGridCell,
  findGridAll,
  getGridPolygon,
  getPackPolygon,
  isLand,
  isWater,
  type Grid,
  type GridCells,
  type HeightGraph,
} from "./graphUtils";
// slice-3 additions
export { capitalize } from "./stringUtils";
export {
  abbreviate,
  getAdjective,
  isVowel,
  trimVowels,
} from "./languageUtils";
export { C_12, getColors, getMixedColor, getRandomColor } from "./colorUtils";
export { FlatQueue } from "./flatqueue";
export { quadtree, Quadtree } from "./quadtree";
export { polylabel } from "./polylabel";
