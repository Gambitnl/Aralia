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
import React, { MutableRefObject, useState } from 'react';
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
    onSearchChange,
    hasError,
    gateResults,
    categoryCounts,
    entryRefs,
    isColumnResizing,
}) => {
    /**
     * Controls whether the search input field is visible.
     * When true, the search input expands below the "Search" button.
     * This keeps the search functionality accessible without taking constant header space.
     */
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const hasNoResults = Object.keys(groupedEntries).length === 0;

    return (
        <div
            className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0 glossary-list-container"
            style={{ transition: isColumnResizing ? 'none' : 'width 0.2s ease' }}
        >
            {/* Pinned Search Entry */}
            <div className="mb-2">
                <button
                    type="button"
                    onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                    className={`w-full p-2 font-semibold cursor-pointer hover:bg-gray-700/50 transition-colors rounded-md text-lg flex justify-between items-center ${searchTerm ? 'text-sky-400' : 'text-purple-400'}`}
                >
                    <span className="flex items-center">
                        <span className="mr-2">🔍</span>
                        Search{searchTerm && <span className="ml-2 text-sm font-normal text-gray-400">"{searchTerm}"</span>}
                    </span>
                    <span className={`ml-2 transform transition-transform duration-150 ${isSearchExpanded ? 'rotate-90' : ''}`}>▶</span>
                </button>
                {isSearchExpanded && (
                    <div className="mt-1 px-2">
                        <input
                            type="search"
                            placeholder="Search glossary..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                            aria-label="Search glossary terms"
                            autoFocus
                        />
                    </div>
                )}
            </div>

            {/* Separator line between search and category list */}
            <div className="border-b border-gray-700 mb-2" />

            {hasNoResults && !hasError && (
                <p className="text-gray-500 italic text-center py-4">No terms match your search.</p>
            )}

            {sortedCategories.map(category => {
                const isExpanded = expandedCategories.has(category);
                return (
                    <div key={category} className="mb-1">
                        <button
                            type="button"
                            className={`w-full p-2 font-semibold cursor-pointer hover:bg-gray-700/50 transition-colors rounded-md text-lg flex justify-between items-center text-left ${getCategoryColor(category)}`}
                            onClick={() => onToggleCategory(category)}
                            aria-expanded={isExpanded}
                        >
                            <span className="flex items-center">
                                {getCategoryIcon(category)}
                                {category} ({categoryCounts[category] || 0})
                            </span>
                            <span className={`ml-2 transform transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        </button>

                        {isExpanded && (
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
                    </div>
                );
            })}
        </div>
    );
};

export default GlossarySidebar;

