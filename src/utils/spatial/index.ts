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
