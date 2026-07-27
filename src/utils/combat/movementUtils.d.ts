/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 14:08:47
 * Dependents: utils/combat/index.ts, utils/movementUtils.ts, utils/spatial/pathfinding.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/movementUtils.ts
 * Utilities for calculating movement costs and distances using D&D 5e Variant rules (5-10-5).
 *
 * CURRENT FUNCTIONALITY:
 * - Implements 5-10-5 diagonal movement costing system
 * - Calculates step costs for cardinal and diagonal movement
 * - Tracks diagonal count for proper cost alternation
 * - Provides foundation for pathfinding algorithms
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: Per-step calculation overhead in complex pathfinding
 *    - Implement batch movement cost calculation
 *    - Add movement cost lookup tables for common patterns
 *    - Optimize for frequently calculated paths
 * 2. COMPLETENESS: Missing advanced movement mechanics
 *    - No support for difficult terrain costing
 *    - Lacks climbing/swimming movement modes
 *    - Missing vehicle/mount movement calculations
 * 3. INTEGRATION: Poor coupling with other systems
 *    - No integration with character speed modifiers
 *    - Lacks connection to encumbrance effects
 *    - Missing synergy with spell/item movement bonuses
 * 4. EXTENSIBILITY: Rigid implementation limits future features
 *    - Add support for custom movement rules
 *    - Implement movement action point system
 *    - Support for simultaneous movement tracking
 */
import { Position } from '../../types/combat';
import type { BattleMapTile } from '../../types/combat';
export declare function getTileMovementMultiplier(tileMovementCost: number | undefined): number;
export declare function isDifficultMovementCost(tileMovementCost: number | undefined): boolean;
/**
 * Calculates the cost of a single step.
 * @param dx Change in X
 * @param dy Change in Y
 * @param diagonalCount Number of diagonals already taken in this path
 * @returns Object containing the cost of this step and whether it was diagonal
 *
 * CURRENT FUNCTIONALITY:
 * - Implements D&D 5e variant diagonal movement (5-10-5 rule)
 * - Alternates diagonal costs between 5 and 10 feet
 * - Distinguishes between cardinal (5ft) and diagonal movement
 * - Tracks diagonal count for proper cost calculation
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. ACCURACY: Simplistic diagonal tracking may miss edge cases
 *    - Add path-aware diagonal counting for complex routes
 *    - Implement lookahead for optimal path cost calculation
 *    - Handle movement restrictions that reset diagonal counters
 * 2. PERFORMANCE: Per-call overhead for simple movements
 *    - Pre-calculate common movement patterns
 *    - Implement movement cost caching for repeated paths
 *    - Add bulk calculation methods for multi-step movements
 * 3. EXTENSIBILITY: Hard-coded 5-10-5 system limits flexibility
 *    - Add support for alternative movement costing systems
 *    - Implement character-specific movement rules
 *    - Support for temporary movement cost modifications
 * 4. INTEGRATION: Missing connection to character capabilities
 *    - No consideration of character speed modifiers
 *    - Lacks integration with encumbrance effects
 *    - Missing synergy with spell/item movement bonuses
 */
export declare function calculateMovementCost(dx: number, dy: number, diagonalCount: number): {
    cost: number;
    isDiagonal: boolean;
};
export declare function calculateStepMovementCost(dx: number, dy: number, diagonalCount: number, tileMovementCost: number | undefined): {
    cost: number;
    isDiagonal: boolean;
};
export declare function calculatePathMovementCost(path: BattleMapTile[]): number;
/**
 * Calculates the distance between two points using 5-10-5 diagonal rules.
 * This is equivalent to counting steps where every other diagonal costs double.
 * Useful for range checks that strictly follow grid movement.
 */
export declare function getTargetDistance(pos1: Position, pos2: Position): number;
