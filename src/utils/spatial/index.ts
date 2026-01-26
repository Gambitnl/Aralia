// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:53
 * Dependents: utils/index.ts
 * Imports: 7 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/spatial/index.ts
 * Spatial utilities - geometry, pathfinding, line of sight, and grid calculations.
 */

export * from './geometry';
export * from './lineOfSight';
export * from './locationUtils';
export * from './targetingUtils';
export {
  isTileTypeWalkable,
  isTileTypeBlocking,
  isPositionWalkable,
  getWalkableNeighbors,
  manhattanDistance,
  findPath,
  findNearestWalkable,
  getBuildingAtPosition,
  getAdjacentBuildings,
} from './walkabilityUtils';
export { heuristic as battleHeuristic, findPath as findBattlePath } from './pathfinding';
export { simpleHash as submapHash, createSeededRandom as createSubmapSeededRandom } from './submapUtils';
