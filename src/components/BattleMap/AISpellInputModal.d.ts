/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:13:57
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { Spell } from '../../types/spells';
/**
 * This modal collects the missing player decision before a spell command runs.
 *
 * It originally served AI-DM spells that need free-form text, and it now also
 * handles structured mode-choice spells such as Blindness/Deafness. CombatView
 * opens this modal through `useAbilitySystem.onRequestInput`; the submitted
 * value is passed back into SpellCommandFactory as `playerInput`.
 */
interface AISpellInputModalProps {
    spell: Spell;
    onSubmit: (input: string) => void;
    onCancel: () => void;
    isOpen: boolean;
}
declare const AISpellInputModal: React.FC<AISpellInputModalProps>;
export default AISpellInputModal;
