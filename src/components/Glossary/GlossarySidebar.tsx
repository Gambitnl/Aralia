/**
 * @file GlossarySidebar.tsx
 * Sidebar component showing categories and entry tree for glossary navigation.
 * Extracted from Glossary.tsx for better modularity.
 */
import React, { MutableRefObject } from 'react';
import { GlossaryEntry } from '../../types';
import { GateResult } from '../../hooks/useSpellGateChecks';
import { getCategoryIcon, highlightSearchTerm, getCategoryColor } from './glossaryUIUtils';

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
    /** Whether there's an error */
    hasError: boolean;
    /** Spell gate check results for showing status dots */
    gateResults: Record<string, GateResult>;
    /** Refs for entry elements for scroll-into-view */
    entryRefs: MutableRefObject<Record<string, HTMLLIElement | HTMLButtonElement | null>>;
    /** Whether column resize is in progress */
    isColumnResizing: boolean;
}

/**
 * Renders a single entry node with optional sub-entries.
 */
const GlossaryEntryNode: React.FC<{
    entry: GlossaryEntry;
    level: number;
    selectedEntry: GlossaryEntry | null;
    expandedParentEntries: Set<string>;
    onToggleParentEntry: (entryId: string) => void;
    onEntrySelect: (entry: GlossaryEntry) => void;
    searchTerm: string;
    gateResults: Record<string, GateResult>;
    entryRefs: MutableRefObject<Record<string, HTMLLIElement | HTMLButtonElement | null>>;
}> = ({
    entry,
    level,
    selectedEntry,
    expandedParentEntries,
    onToggleParentEntry,
    onEntrySelect,
    searchTerm,
    gateResults,
    entryRefs,
}) => {
        const isParent = entry.subEntries && entry.subEntries.length > 0;
        const isExpanded = isParent && expandedParentEntries.has(entry.id);
        const indentClass = `pl-${level * 2}`;
        const hasContentToDisplay = (entry.category === 'Spells' && !isParent) || !!entry.filePath;
        // Parents are no longer disabled - we want them to be clickable to toggle expansion
        const disabled = !isParent && !hasContentToDisplay;
        const gate = entry.category === 'Spells' ? gateResults[entry.id] : undefined;
        const gateLabel = gate?.reasons?.join('; ');

        const gateDot = gate ? (
            <span
                className={
                    gate.status === 'pass'
                        ? 'ml-1 inline-block w-2 h-2 rounded-full bg-emerald-400'
                        : gate.status === 'gap'
                            ? 'ml-1 inline-block w-2 h-2 rounded-full bg-amber-400'
                            : 'ml-1 inline-block w-2 h-2 rounded-full bg-red-500'
                }
                title={gateLabel || undefined}
                aria-label={gateLabel || undefined}
            />
        ) : null;

        return (
            <li key={entry.id} ref={el => { entryRefs.current[entry.id] = el; }}>
                <div
                    className={`flex items-center rounded-md transition-colors text-sm group
                    ${selectedEntry?.id === entry.id ? 'bg-sky-700 text-white' : 'hover:bg-gray-700/60 text-gray-300'}`}
                >
                    {isParent && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onToggleParentEntry(entry.id); }}
                            className={`p-1 text-xs text-gray-400 group-hover:text-sky-300 transition-transform transform ${isExpanded ? 'rotate-90' : ''}`}
                            aria-label={isExpanded ? `Collapse ${entry.title}` : `Expand ${entry.title}`}
                        >
                            ▶
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onEntrySelect(entry)}
                        className={`w-full text-left px-2 py-1.5 ${indentClass} ${isParent && !isExpanded && selectedEntry?.id === entry.id ? 'font-semibold' : ''} ${!isParent && selectedEntry?.id === entry.id ? 'font-semibold' : ''}`}
                        disabled={disabled}
                        title={gateLabel || entry.title}
                    >
                        {searchTerm.trim() ? highlightSearchTerm(entry.title, searchTerm) : entry.title}
                        {gateDot}
                    </button>
                </div>
                {isParent && isExpanded && (
                    <ul role="group" className="ml-2 mt-0.5 space-y-px border-l border-gray-700">
                        {entry.subEntries!.map(subEntry => (
                            <GlossaryEntryNode
                                key={subEntry.id}
                                entry={subEntry}
                                level={level + 1}
                                selectedEntry={selectedEntry}
                                expandedParentEntries={expandedParentEntries}
                                onToggleParentEntry={onToggleParentEntry}
                                onEntrySelect={onEntrySelect}
                                searchTerm={searchTerm}
                                gateResults={gateResults}
                                entryRefs={entryRefs}
                            />
                        ))}
                    </ul>
                )}
            </li>
        );
    };

/**
 * Renders the glossary sidebar with category navigation and entry tree.
 */
export const GlossarySidebar: React.FC<GlossarySidebarProps> = ({
    sortedCategories,
    groupedEntries,
    expandedCategories,
    onToggleCategory,
    expandedParentEntries,
    onToggleParentEntry,
    selectedEntry,
    onEntrySelect,
    searchTerm,
    hasError,
    gateResults,
    entryRefs,
    isColumnResizing,
}) => {
    const hasNoResults = Object.keys(groupedEntries).length === 0;

    return (
        <div
            className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0 glossary-list-container"
            style={{ transition: isColumnResizing ? 'none' : 'width 0.2s ease' }}
        >
            {hasNoResults && !hasError && (
                <p className="text-gray-500 italic text-center py-4">No terms match your search.</p>
            )}

            {sortedCategories.map(category => (
                <details key={category} open={expandedCategories.has(category)} className="mb-1">
                    <summary
                        className={`p-2 font-semibold cursor-pointer hover:bg-gray-700/50 transition-colors rounded-md text-lg list-none flex justify-between items-center ${getCategoryColor(category)}`}
                        onClick={(e) => { e.preventDefault(); onToggleCategory(category); }}
                    >
                        <span className="flex items-center">
                            {getCategoryIcon(category)}
                            {category} ({groupedEntries[category]?.length || 0})
                        </span>
                        <span className={`ml-2 transform transition-transform duration-150 ${expandedCategories.has(category) ? 'rotate-90' : ''}`}>▶</span>
                    </summary>

                    {expandedCategories.has(category) && (
                        <ul className="space-y-px pl-1 pt-1">
                            {groupedEntries[category]?.sort((a, b) => a.title.localeCompare(b.title)).map(entry => (
                                <GlossaryEntryNode
                                    key={entry.id}
                                    entry={entry}
                                    level={1}
                                    selectedEntry={selectedEntry}
                                    expandedParentEntries={expandedParentEntries}
                                    onToggleParentEntry={onToggleParentEntry}
                                    onEntrySelect={onEntrySelect}
                                    searchTerm={searchTerm}
                                    gateResults={gateResults}
                                    entryRefs={entryRefs}
                                />
                            ))}
                        </ul>
                    )}
                </details>
            ))}
        </div>
    );
};

export default GlossarySidebar;
