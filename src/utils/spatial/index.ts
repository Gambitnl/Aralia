// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:33:56
 * Dependents: App.tsx, MapPane.tsx, appState.ts, handleMovement.ts, useGameInitialization.ts, useHistorySync.ts, utils/index.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
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
