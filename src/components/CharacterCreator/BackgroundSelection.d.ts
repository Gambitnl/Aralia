/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:26:42
 * Dependents: CharacterCreator.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file BackgroundSelection.tsx
 * Refactored to use the Split Config Style.
 */
import React from 'react';
import { Race } from '../../types';
interface BackgroundSelectionProps {
    selectedRace: Race | null;
    characterAge: number;
    currentBackground: string | null;
    onBackgroundChange: (backgroundId: string) => void;
    onNext: () => void;
    onBack: () => void;
}
declare const BackgroundSelection: React.FC<BackgroundSelectionProps>;
export default BackgroundSelection;
