/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 14:01:08
 * Dependents: components/layout/GameModals.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file LongRestModal.tsx
 * Long rest modal for prompting and applying racial choices during a long rest.
 * @component-owner Gameplay Team / Core UI
 */
import React from 'react';
import { PlayerCharacter, RacialRestChoiceData } from '../../types';
interface LongRestModalProps {
    isOpen: boolean;
    party: PlayerCharacter[];
    onClose: () => void;
    onConfirm: (choices: Record<string, Record<string, RacialRestChoiceData>>) => void;
}
declare const LongRestModal: React.FC<LongRestModalProps>;
export default LongRestModal;
