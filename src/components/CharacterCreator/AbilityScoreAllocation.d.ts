/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:26:33
 * Dependents: CharacterCreator.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file AbilityScoreAllocation.tsx
 * Refactored to use Split Config Style (Calculator vs Stat Preview).
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Pruning] Removed unused 'useCallback' import,
 * 'firstUnaffordableScore' state and its associated logic in useEffect,
 * and the unused 'handleScoreSelect' function to resolve ESLint warnings
 * and improve code maintainability.
 */
import React from 'react';
import { AbilityScores, Race, Class as CharClass } from '../../types';
interface AbilityScoreAllocationProps {
    race: Race;
    selectedClass: CharClass | null;
    onAbilityScoresSet: (scores: AbilityScores) => void;
    onBack: () => void;
}
declare const AbilityScoreAllocation: React.FC<AbilityScoreAllocationProps>;
export default AbilityScoreAllocation;
