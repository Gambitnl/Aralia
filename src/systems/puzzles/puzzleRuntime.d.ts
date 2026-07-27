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
export type PuzzleRuntimeHintResult = {
    kind: 'hint';
    puzzleId: string;
    message: string;
} | {
    kind: 'no_hint';
    puzzleId: string;
    message: string;
};
export interface PuzzleHintRequest {
    character: CharacterStats;
    puzzle: Puzzle;
}
export declare function requestPuzzleHint({ character, puzzle }: PuzzleHintRequest): PuzzleRuntimeHintResult;
