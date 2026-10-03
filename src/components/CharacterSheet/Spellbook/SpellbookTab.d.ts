/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 11:28:11
 * Dependents: components/CharacterSheet/Spellbook/index.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file renders the Spellbook tab inside the resizable Character Sheet.
 *
 * It combines the character's known and prepared spells with the shared spell
 * registry, then shows casting controls and details for the selected spell. When
 * the compiled glossary contains that spell, the tab uses the same structured
 * detail renderer as the full Spellbook overlay so rule links stay interactive.
 * The older spell detail pane remains the fallback for spells that have not been
 * compiled yet.
 *
 * Called by: CharacterSheetModal.tsx
 * Depends on: SpellContext, GlossaryContext, FullEntryDisplay, and SpellDetailPane
 */
import React from 'react';
import { PlayerCharacter, Action } from '../../../types';
interface SpellbookTabProps {
    character: PlayerCharacter;
    onAction: (action: Action) => void;
    /** Full party, used by the out-of-combat cast target picker. */
    party?: PlayerCharacter[];
    /** Opens a linked rule in the application's existing glossary route. */
    onNavigateToGlossary?: (termId: string) => void;
}
declare const SpellbookTab: React.FC<SpellbookTabProps>;
export default SpellbookTab;
