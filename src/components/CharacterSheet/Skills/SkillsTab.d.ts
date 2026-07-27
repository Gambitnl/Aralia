/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/07/2026, 07:53:48
 * Dependents: components/CharacterSheet/Skills/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file SkillsTab.tsx
 * Tab version of skill details display for the character sheet.
 * Shows all skills with modifiers, proficiency, and bonuses in a table.
 */
import React from 'react';
import { PlayerCharacter } from '../../../types';
interface SkillsTabProps {
    character: PlayerCharacter;
    onNavigateToGlossary?: (termId: string) => void;
}
declare const SkillsTab: React.FC<SkillsTabProps>;
export default SkillsTab;
