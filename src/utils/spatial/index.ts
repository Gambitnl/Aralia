// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 24/05/2026, 18:04:55
 * Dependents: App.tsx, components/MapPane.tsx, hooks/actions/handleMovement.ts, hooks/useGameInitialization.ts, hooks/useHistorySync.ts, state/appState.ts, utils/index.ts
 * Imports: 8 files
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
export * from './worldMapOverlayMath';
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
export * from './magicPenetration.js';
