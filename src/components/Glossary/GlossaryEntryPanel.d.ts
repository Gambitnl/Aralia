/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 13:54:03
 * Dependents: components/Glossary/Glossary.tsx, components/Glossary/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file GlossaryEntryPanel.tsx
 * This file renders the right-hand glossary panel for the currently selected entry.
 *
 * It exists so the large glossary modal can keep its selection logic separate from the
 * actual detail display. Ordinary entries still flow through the generic full-entry
 * renderer, while spell entries render the spell card and delegate the developer-only
 * spell gate diagnostics to the dedicated spellGateChecker module.
 *
 * Called by: Glossary.tsx
 * Depends on: FullEntryDisplay, SpellCardTemplate, Breadcrumb, and SpellGateChecksPanel
 */
import React from 'react';
import { GlossaryEntry } from '../../types';
import type { GateResult } from './spellGateChecker';
import { SpellData } from './SpellCardTemplate';
interface BreadcrumbPath {
    parents: string[];
    parentIds: string[];
}
interface GlossaryEntryPanelProps {
    /** Currently selected entry */
    selectedEntry: GlossaryEntry | null;
    /** Breadcrumb path for navigation */
    breadcrumbPath: BreadcrumbPath;
    /** Set of expanded categories */
    expandedCategories: Set<string>;
    /** Handler for expanding a category */
    onExpandCategory: (category: string) => void;
    /** Handler for navigating to a glossary entry */
    onNavigateToGlossary: (termId: string) => void;
    /** Spell JSON data for spell entries */
    spellJsonData: SpellData | null;
    /** Referenced rule chips derived from canonical spell snapshot enrichment */
    spellReferencedRules: Array<{
        label: string;
        description: string;
        glossaryTermId?: string;
    }>;
    /** Whether spell JSON is loading */
    spellJsonLoading: boolean;
    /** Spell gate check results */
    gateResults: Record<string, GateResult>;
    /** Whether column resize is in progress */
    isColumnResizing: boolean;
    /** Whether developer-only spell diagnostics should be shown */
    isDevModeEnabled: boolean;
}
export declare const GlossaryEntryPanel: React.FC<GlossaryEntryPanelProps>;
export default GlossaryEntryPanel;
