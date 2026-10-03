/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 13:54:02
 * Dependents: components/Glossary/Glossary.tsx, components/Glossary/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file GlossarySidebar.tsx
 * Sidebar component showing categories and entry tree for glossary navigation.
 * Extracted from Glossary.tsx for better modularity.
 *
 * MODIFICATIONS:
 * - Added pinned "Search" entry at the top of the sidebar (above categories)
 * - Search expands/collapses on click to reveal the search input
 * - Added onSearchChange prop to handle search term updates
 */
import React, { MutableRefObject } from 'react';
import { GlossaryEntry } from '../../types';
import type { GateResult } from './spellGateChecker';
interface GlossarySidebarProps {
    /** Filtered and sorted categories to display */
    sortedCategories: string[];
    /** Entries grouped by category */
    groupedEntries: Record<string, GlossaryEntry[]>;
    /** Set of expanded category names */
    expandedCategories: Set<string>;
    /** Handler for toggling category expansion */
    onToggleCategory: (category: string) => void;
    /** Set of expanded parent entry IDs */
    expandedParentEntries: Set<string>;
    /** Handler for toggling parent entry expansion */
    onToggleParentEntry: (entryId: string) => void;
    /** Currently selected entry */
    selectedEntry: GlossaryEntry | null;
    /** Handler for entry selection */
    onEntrySelect: (entry: GlossaryEntry) => void;
    /** Current search term for highlighting */
    searchTerm: string;
    /** Handler for search term changes */
    onSearchChange: (term: string) => void;
    /** Whether there's an error */
    hasError: boolean;
    /** Spell gate check results for showing status dots */
    gateResults: Record<string, GateResult>;
    /** Counts of entries in each category (recursive) */
    categoryCounts: Record<string, number>;
    /** Refs for entry elements for scroll-into-view */
    entryRefs: MutableRefObject<Record<string, HTMLLIElement | HTMLButtonElement | null>>;
    /** Whether column resize is in progress */
    isColumnResizing: boolean;
    /** Whether developer-only spell diagnostics should be shown inline */
    isDevModeEnabled: boolean;
}
/**
 * GlossarySidebar Component
 * Main sidebar component that displays category navigation and entry tree structure.
 * Provides search functionality and hierarchical navigation through glossary entries.
 */
export declare const GlossarySidebar: React.FC<GlossarySidebarProps>;
export default GlossarySidebar;
