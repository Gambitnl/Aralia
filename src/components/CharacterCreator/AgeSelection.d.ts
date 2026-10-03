/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:26:37
 * Dependents: CharacterCreator.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file AgeSelection.tsx
 * Allows players to select their character's age, with race-appropriate age ranges.
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Pruning] Removed unused 'motion' import from
 * 'framer-motion' and unused 'SectionTitle' from '../ui/Typography' to
 * resolve ESLint warnings.
 */
import React from 'react';
import { Race } from '../../types';
interface AgeSelectionProps {
    selectedRace: Race | null;
    currentAge: number;
    onAgeChange: (age: number) => void;
    onNext: () => void;
    onBack: () => void;
}
declare const AgeSelection: React.FC<AgeSelectionProps>;
export default AgeSelection;
