// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/06/2026, 01:55:24
 * Dependents: components/puzzles/PuzzleRuntimeModal.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file is the puzzle-facing runtime surface for gameplay callers.
 *
 * The lower-level puzzle system still owns the actual puzzle rules. This file
 * gives UI and action code one stable place to request player-facing puzzle
 * outcomes, starting with hints, without duplicating the roll math outside the
 * puzzle domain.
 *
 * Called by: PuzzleRuntimeModal and future puzzle gameplay surfaces.
 * Depends on: puzzleSystem.ts for the existing PZ-002 hint helper behavior.
 */

import type { CharacterStats } from '../../types/combat';
import type { Puzzle } from './types';
import { getPuzzleHint } from './puzzleSystem';

// ============================================================================
// Runtime Result Types
// ============================================================================
// Gameplay surfaces need a small envelope around puzzle helper results so they
// can render success, failure, and future puzzle events without guessing what a
// raw string or null means.
// ============================================================================

export type PuzzleRuntimeHintResult =
  | {
    kind: 'hint';
    puzzleId: string;
    message: string;
  }
  | {
    kind: 'no_hint';
    puzzleId: string;
    message: string;
  };

export interface PuzzleHintRequest {
  character: CharacterStats;
  puzzle: Puzzle;
}

// ============================================================================
// Hint Requests
// ============================================================================
// This is the first approved gameplay caller for getPuzzleHint. It preserves
// the existing helper behavior and only adds the player-facing result shape.
// ============================================================================

export function requestPuzzleHint({ character, puzzle }: PuzzleHintRequest): PuzzleRuntimeHintResult {
  // Ask the existing puzzle helper for the live Intelligence-based hint roll.
  const hint = getPuzzleHint(character, puzzle);

  // A missing hint can mean the puzzle has no hint or the character missed the
  // check. Keep that ambiguity for now because PZ-007 only approves the first
  // caller; richer failure reasons belong in a later hint UX slice.
  if (!hint) {
    return {
      kind: 'no_hint',
      puzzleId: puzzle.id,
      message: 'No useful hint comes to mind yet.',
    };
  }

  // Return the helper's exact hint text so PZ-002 behavior remains intact.
  return {
    kind: 'hint',
    puzzleId: puzzle.id,
    message: hint,
  };
}
