/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 23:22:49
 * Dependents: components/BattleMap/AbilityPalette.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file AbilityButton.tsx
 * A dedicated component for displaying a single ability button in the palette.
 */
import React from 'react';
import { Ability } from '../../types/combat';
interface AbilityButtonProps {
    ability: Ability;
    onSelect: () => void;
    isDisabled: boolean;
    isSelected?: boolean;
}
declare const AbilityButton: React.FC<AbilityButtonProps>;
export default AbilityButton;
