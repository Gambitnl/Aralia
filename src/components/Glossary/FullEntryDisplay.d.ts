/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 30/03/2026, 01:32:38
 * Dependents: components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/Glossary/GlossaryEntryPanel.tsx, components/Glossary/SingleGlossaryEntryModal.tsx, components/Glossary/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { GlossaryEntry } from '../../types';
interface FullEntryDisplayProps {
    entry: GlossaryEntry | null;
    onNavigate?: (termId: string) => void;
}
export declare const FullEntryDisplay: React.FC<FullEntryDisplayProps>;
export {};
