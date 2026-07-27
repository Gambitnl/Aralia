/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 11:28:30
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/CharacterSheet/index.ts, components/Combat/CombatView.tsx, components/layout/GameModals.tsx
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file CharacterSheetModal.tsx
 * This component displays a modal with detailed character information,
 * including stats, skills, spells, an equipment mannequin, and inventory with actions.
 * Now wrapped in WindowFrame for resizing/dragging capabilities.
 */
import React from 'react';
import { PlayerCharacter, Item, Action, Quest } from '../../types';
import { JournalState } from '../../types/journal';
import { Companion } from '../../types/companions';
interface CharacterSheetModalProps {
    isOpen: boolean;
    character: PlayerCharacter | null;
    companion?: Companion | null;
    inventory: Item[];
    gold: number;
    onClose: () => void;
    onAction: (action: Action) => void;
    onNavigateToGlossary?: (termId: string) => void;
    quests?: Quest[];
    journal?: JournalState;
    /** Full party, used by the spellbook's out-of-combat cast target picker. */
    party?: PlayerCharacter[];
}
declare const CharacterSheetModal: React.FC<CharacterSheetModalProps>;
export default CharacterSheetModal;
