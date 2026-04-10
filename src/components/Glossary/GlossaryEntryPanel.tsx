// @dependencies-start
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
// @dependencies-end

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
import { SpellGateChecksPanel } from './spellGateChecker';
import { FullEntryDisplay } from './FullEntryDisplay';
import SpellCardTemplate, { SpellData } from './SpellCardTemplate';
import { Breadcrumb } from './glossaryUIUtils';

// ============================================================================
// Prop shapes
// ============================================================================
// This section describes the navigation state and spell data the panel needs.
// The panel does not own any of this state; it only renders what Glossary.tsx
// already selected and resolved.
// ============================================================================

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

// ============================================================================
// Main panel renderer
// ============================================================================
// This file now owns only the generic entry-panel shell. The detailed spell gate
// rendering logic moved into the dedicated spellGateChecker folder so the spell
// truth UI can evolve without making this generic glossary panel unreadable again.
// ============================================================================

export const GlossaryEntryPanel: React.FC<GlossaryEntryPanelProps> = ({
    selectedEntry,
    breadcrumbPath,
    expandedCategories,
    onExpandCategory,
    onNavigateToGlossary,
    spellJsonData,
    spellReferencedRules,
    spellJsonLoading,
    gateResults,
    isColumnResizing,
    isDevModeEnabled,
}) => {
    return (
        <div
            className="flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-y-auto scrollable-content glossary-entry-container"
            style={{ transition: isColumnResizing ? 'none' : 'width 0.2s ease' }}
        >
            {selectedEntry ? (
                <>
                    <Breadcrumb
                        category={selectedEntry.category}
                        parentPath={breadcrumbPath.parents}
                        currentTitle={selectedEntry.title}
                        onNavigateToCategory={() => {
                            if (!expandedCategories.has(selectedEntry.category)) {
                                onExpandCategory(selectedEntry.category);
                            }
                        }}
                        onNavigateToParent={(index) => {
                            const parentId = breadcrumbPath.parentIds[index];
                            if (parentId) {
                                onNavigateToGlossary(parentId);
                            }
                        }}
                    />

                    {selectedEntry.category === 'Spells' ? (
                        spellJsonLoading ? (
                            <p className="text-gray-400 italic">Loading spell data...</p>
                        ) : spellJsonData ? (
                            <SpellCardTemplate
                                spell={spellJsonData}
                                referencedRules={spellReferencedRules}
                                onNavigateToGlossary={onNavigateToGlossary}
                            />
                        ) : (
                            <div className="text-red-400">
                                <p>Failed to load JSON for this spell.</p>
                                <p className="text-sm text-gray-500 mt-2">
                                    JSON file may not exist at: /data/spells/level-{gateResults[selectedEntry.id]?.level ?? '?'}
                                    /{selectedEntry.id}.json
                                </p>
                            </div>
                        )
                    ) : (
                        <FullEntryDisplay entry={selectedEntry} onNavigate={onNavigateToGlossary} />
                    )}

                    {isDevModeEnabled && selectedEntry.category === 'Spells' && gateResults[selectedEntry.id] && (
                        <SpellGateChecksPanel
                            selectedEntry={selectedEntry}
                            gateResults={gateResults}
                            spellJsonData={spellJsonData}
                        />
                    )}
                </>
            ) : (
                <p className="text-gray-500 italic text-center py-10">
                    Select an entry to view its details or use the search bar.
                </p>
            )}
        </div>
    );
};

export default GlossaryEntryPanel;
