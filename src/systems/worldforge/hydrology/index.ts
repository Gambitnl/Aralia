/**
 * @file index.ts — the hydrology layer's front door.
 *
 * Two files, one idea: far water is a NOTEBOOK (`waterBudget.ts`) and near
 * water is the real conservative solver already in `../terrain/shallowWater.ts`,
 * joined by the seam in `shallowWaterSolver.ts`. Both read the SAME encoded
 * heights through `../bridge/terrainHydrology.ts`, so nothing here adds a second
 * opinion about where water is (see GG-129).
 */

export * from "./waterBudget";
export * from "./shallowWaterSolver";
