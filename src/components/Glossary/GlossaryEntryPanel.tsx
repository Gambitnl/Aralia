/**
 * @file GlossaryEntryPanel.tsx
 * Entry display panel showing the selected glossary entry content.
 * Extracted from Glossary.tsx for better modularity.
 */
import React from 'react';
import { GlossaryEntry } from '../../types';
import { GateResult } from '../../hooks/useSpellGateChecks';
import { FullEntryDisplay } from './FullEntryDisplay';
import SpellCardTemplate, { SpellData } from './SpellCardTemplate';
import { Breadcrumb } from './glossaryUIUtils';

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
    /** Whether spell JSON is loading */
    spellJsonLoading: boolean;
    /** Spell gate check results */
    gateResults: Record<string, GateResult>;
    /** Whether column resize is in progress */
    isColumnResizing: boolean;
}

/**
 * Renders the spell gate checks panel for a spell entry.
 */
const SpellGateChecks: React.FC<{
    selectedEntry: GlossaryEntry;
    gateResults: Record<string, GateResult>;
}> = ({ selectedEntry, gateResults }) => {
    const gate = gateResults[selectedEntry.id];
    if (!gate) return null;

    const checks = [
        { label: "Manifest path under correct level", ok: gate.checklist.manifestPathOk },
        { label: "Spell JSON exists", ok: gate.checklist.spellJsonExists },
        { label: "Spell JSON passes schema", ok: gate.checklist.spellJsonValid },
        { label: "No known behavior gaps", ok: gate.checklist.noKnownGaps },
    ];

    return (
        <div className="mt-4 p-3 border border-gray-700 rounded bg-gray-900/70 text-sm">
            <div className="font-semibold mb-2 text-gray-200">Spell Gate Checks: {selectedEntry.title}</div>
            <ul className="space-y-1 text-gray-300">
                {checks.map((c, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                        <span className={`inline-block w-4 text-center ${c.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                            {c.ok ? '✓' : '✕'}
                        </span>
                        <span>{c.label}</span>
                    </li>
                ))}

                {gate.status === 'gap' && (
                    <li className="text-amber-300 mt-1">Marked as a gap: This spell has engine-level limitations in the combat system.</li>
                )}

                {gate.gapAnalysis && (
                    <div className="mt-2 text-xs border-t border-gray-700 pt-2">
                        <div className="text-gray-400 uppercase tracking-tighter font-bold">Audit Status</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gate.gapAnalysis.state === 'analyzed_clean' ? 'bg-emerald-900 text-emerald-300' :
                                gate.gapAnalysis.state === 'analyzed_with_gaps' ? 'bg-amber-900 text-amber-300' :
                                    'bg-gray-700 text-gray-400'
                                }`}>
                                {gate.gapAnalysis.state.replace('_', ' ')}
                            </span>
                            <span className="text-gray-500 italic">Last Audit: {gate.gapAnalysis.lastAuditDate || 'Never'}</span>
                        </div>
                        {gate.gapAnalysis.notes && (
                            <p className="mt-1.5 text-gray-400 line-clamp-3 hover:line-clamp-none transition-all">{gate.gapAnalysis.notes}</p>
                        )}
                    </div>
                )}

                {gate.status === 'fail' && gate.reasons.length > 0 && (
                    <li className="text-red-300 mt-1">Issues: {gate.reasons.join('; ')}</li>
                )}
            </ul>
        </div>
    );
};

/**
 * Renders the entry display panel with breadcrumbs and content.
 */
export const GlossaryEntryPanel: React.FC<GlossaryEntryPanelProps> = ({
    selectedEntry,
    breadcrumbPath,
    expandedCategories,
    onExpandCategory,
    onNavigateToGlossary,
    spellJsonData,
    spellJsonLoading,
    gateResults,
    isColumnResizing,
}) => {
    return (
        <div
            className="flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-y-auto scrollable-content glossary-entry-container"
            style={{ transition: isColumnResizing ? 'none' : 'width 0.2s ease' }}
        >
            {selectedEntry ? (
                <>
                    {/* Breadcrumb navigation */}
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

                    {/* Entry content */}
                    {selectedEntry.category === 'Spells' ? (
                        spellJsonLoading ? (
                            <p className="text-gray-400 italic">Loading spell data...</p>
                        ) : spellJsonData ? (
                            <SpellCardTemplate spell={spellJsonData} />
                        ) : (
                            <div className="text-red-400">
                                <p>Failed to load JSON for this spell.</p>
                                <p className="text-sm text-gray-500 mt-2">
                                    JSON file may not exist at: /data/spells/level-{gateResults[selectedEntry.id]?.level ?? '?'}/{selectedEntry.id}.json
                                </p>
                            </div>
                        )
                    ) : (
                        <FullEntryDisplay entry={selectedEntry} onNavigate={onNavigateToGlossary} />
                    )}

                    {/* Spell gate checks */}
                    {selectedEntry.category === 'Spells' && gateResults[selectedEntry.id] && (
                        <SpellGateChecks selectedEntry={selectedEntry} gateResults={gateResults} />
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
