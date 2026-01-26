// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:38:17
 * Dependents: combat/index.ts, movementUtils.ts, pathfinding.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/movementUtils.ts
 * Utilities for calculating movement costs and distances using D&D 5e Variant rules (5-10-5).
 */

import { Position } from '../../types/combat';

/**
 * Calculates the cost of a single step.
 * @param dx Change in X
 * @param dy Change in Y
 * @param diagonalCount Number of diagonals already taken in this path
 * @returns Object containing the cost of this step and whether it was diagonal
 */
export function calculateMovementCost(dx: number, dy: number, diagonalCount: number): { cost: number; isDiagonal: boolean } {
  const isDiagonal = dx !== 0 && dy !== 0;

  if (!isDiagonal) {
    return { cost: 5, isDiagonal: false };
  }

  // 5-10-5 rule:
  // 1st diagonal: 5
  // 2nd diagonal: 10
  // 3rd diagonal: 5
  // ...
  // Even counts (0, 2, 4...) cost 5
  // Odd counts (1, 3, 5...) cost 10
  const cost = (diagonalCount % 2 === 0) ? 5 : 10;

  return { cost, isDiagonal: true };
}

/**
 * Calculates the distance between two points using 5-10-5 diagonal rules.
 * This is equivalent to counting steps where every other diagonal costs double.
 * Useful for range checks that strictly follow grid movement.
 */
export function getTargetDistance(pos1: Position, pos2: Position): number {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);

  const diagonals = Math.min(dx, dy);
  const straights = Math.abs(dx - dy);

  // Calculate diagonal cost:
  // First diagonal is 5, second is 10, etc.
  // Formula:
  // n diagonals.
  // Number of 10s = floor(n/2)
  // Number of 5s = ceil(n/2)
  // Total = (floor(n/2) * 10) + (ceil(n/2) * 5)
  // Which simplifies to: 5 * n + 5 * floor(n/2)

  const diagonalCost = (5 * diagonals) + (5 * Math.floor(diagonals / 2));
  const straightCost = straights * 5;

  return diagonalCost + straightCost;
}
