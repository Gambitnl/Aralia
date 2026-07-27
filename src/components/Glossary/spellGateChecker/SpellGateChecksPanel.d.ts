/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:48
 * Dependents: components/Glossary/spellGateChecker/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file SpellGateChecksPanel.tsx
 * This file renders the overview shell for the glossary spell gate checker.
 *
 * The previous single-file panel had grown into one very large renderer that
 * mixed summary status, spell-truth overview, and bucket-by-bucket forensic
 * details in one place. This file now owns only the high-level "what failed?"
 * surface, while SpellGateBucketSections.tsx owns the deeper review families.
 *
 * Called by: GlossaryEntryPanel.tsx
 * Depends on: GateResult data from useSpellGateChecks.ts and SpellGateBucketSections.tsx
 */
import React from 'react';
import type { GlossaryEntry } from '../../../types';
import type { GateResult } from './useSpellGateChecks';
import type { SpellData } from '../SpellCardTemplate';
export declare const SpellGateChecksPanel: React.FC<{
    selectedEntry: GlossaryEntry;
    gateResults: Record<string, GateResult>;
    spellJsonData: SpellData | null;
}>;
export default SpellGateChecksPanel;
