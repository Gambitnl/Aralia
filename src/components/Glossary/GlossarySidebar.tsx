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
// Import React core functionality and hooks for state management
// - React: Core React library for component creation
// - MutableRefObject: TypeScript type for mutable refs that can be updated
// - useState: Hook for managing component state
import React, { MutableRefObject, useState } from 'react';

// Import custom types and interfaces for type safety
// - GlossaryEntry: Type definition for glossary entry data structure
import { GlossaryEntry } from '../../types';

// Import spell gate check result type for displaying spell status indicators
// - GateResult: Type containing spell gate check status and reasons
import { GateResult } from '../../hooks/useSpellGateChecks';

// Import utility functions for glossary UI formatting and styling
// - getCategoryIcon: Returns appropriate icon for each category
// - highlightSearchTerm: Wraps search terms in highlighting markup
// - getCategoryColor: Returns color classes for category headers
import { getCategoryIcon, highlightSearchTerm, getCategoryColor } from './glossaryUIUtils';

// Define the props interface for the GlossarySidebar component
// This ensures type safety and documents all expected input properties
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
 * GlossaryEntryNode Component
 * Renders a single entry node with optional sub-entries (nested structure).
 * This is a recursive component that can display hierarchies of glossary entries.
 */
const GlossaryEntryNode: React.FC<{
    /** The glossary entry data to display */
    entry: GlossaryEntry;

    /** Current nesting level (for indentation calculation) */
    level: number;

    /** Currently selected entry for highlighting */
    selectedEntry: GlossaryEntry | null;

    /** Set of expanded parent entry IDs */
    expandedParentEntries: Set<string>;

    /** Handler for toggling parent entry expansion */
    onToggleParentEntry: (entryId: string) => void;

    /** Handler for entry selection */
    onEntrySelect: (entry: GlossaryEntry) => void;

    /** Current search term for highlighting */
    searchTerm: string;

    /** Spell gate check results */
    gateResults: Record<string, GateResult>;

    /** Refs for entry elements */
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
        // Determine if this entry has sub-entries (is a parent node)
        const isParent = entry.subEntries && entry.subEntries.length > 0;

        // Check if this parent entry is currently expanded
        const isExpanded = isParent && expandedParentEntries.has(entry.id);

        // Calculate indentation class based on nesting level (multiplied by 2 for visual spacing)
        const indentClass = `pl-${level * 2}`;

        // Determine if this entry has content to display
        // - Spells can be displayed if they're not parent entries
        // - Other entries need a valid filePath to have content
        const hasContentToDisplay = (entry.category === 'Spells' && !isParent) || !!entry.filePath;

        // Disable the entry button if it's not a parent and has no content to display
        // Parent entries are always clickable to toggle expansion
        const disabled = !isParent && !hasContentToDisplay;

        // Get gate check result for this entry if it's a spell
        // Used to display status indicators (pass/gap/fail)
        const gate = entry.category === 'Spells' ? gateResults[entry.id] : undefined;

        // Extract gate reason message for tooltip display
        const gateLabel = gate?.reasons?.join('; ');

        // Create status indicator dot based on gate check result
        // - Green (bg-emerald-400): Pass - spell meets all requirements
        // - Amber (bg-amber-400): Gap - spell has some missing information
        // - Red (bg-red-500): Fail - spell fails gate checks
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

        // Render the entry node
        return (
            // List item with ref for scroll-into-view functionality
            <li key={entry.id} ref={el => { entryRefs.current[entry.id] = el; }}>
                {/* Container div for entry button with styling */}
                <div
                    className={`flex items-center rounded-md transition-colors text-sm group
                    ${selectedEntry?.id === entry.id ? 'bg-sky-700 text-white' : 'hover:bg-gray-700/60 text-gray-300'}`}
                >
                    {/* Expand/collapse button for parent entries */}
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


                    {/* Entry selection button with title and optional gate dot */}
                    <button
                        type="button"
                        onClick={() => onEntrySelect(entry)}
                        className={`w-full text-left px-2 py-1.5 ${indentClass} ${isParent && !isExpanded && selectedEntry?.id === entry.id ? 'font-semibold' : ''} ${!isParent && selectedEntry?.id === entry.id ? 'font-semibold' : ''}`}
                        disabled={disabled}
                        title={gateLabel || entry.title}
                    >
                        {/* Display entry title with search highlighting if search term exists */}
                        {searchTerm.trim() ? highlightSearchTerm(entry.title, searchTerm) : entry.title}

                        {/* Display gate status indicator dot for spells */}
                        {gateDot}
                    </button>
                </div>

                {/* Recursively render sub-entries if this is a parent and is expanded */}
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
 * GlossarySidebar Component
 * Main sidebar component that displays category navigation and entry tree structure.
 * Provides search functionality and hierarchical navigation through glossary entries.
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
     * State: Controls whether the search input field is visible.
     * When true, the search input expands below the "Search" button.
     * This keeps the search functionality accessible without taking constant header space.
     */
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    // Determine if there are no entries to display (empty search results)
    const hasNoResults = Object.keys(groupedEntries).length === 0;

    // Render the sidebar container with categories and entries
    return (
        <div
            className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0 glossary-list-container"
            style={{ transition: isColumnResizing ? 'none' : 'width 0.2s ease' }}
        >
            {/* Search Section - Pinned at the top of the sidebar */}
            <div className="mb-2">
                {/* Search toggle button - expands/collapses the search input */}
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
                {/* Search input field - only visible when search is expanded */}
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

            {/* Visual separator line between search section and category list */}
            <div className="border-b border-gray-700 mb-2" />

            {/* Display message when search returns no results and there's no error */}
            {hasNoResults && !hasError && (
                <p className="text-gray-500 italic text-center py-4">No terms match your search.</p>
            )}

            {/* Render each category with its entries */}
            {sortedCategories.map(category => {
                // Check if this category is currently expanded
                const isExpanded = expandedCategories.has(category);

                return (
                    // Category container
                    <div key={category} className="mb-1">
                        {/* Category header button - toggles category expansion */}
                        <button
                            type="button"
                            className={`w-full p-2 font-semibold cursor-pointer hover:bg-gray-700/50 transition-colors rounded-md text-lg flex justify-between items-center text-left ${getCategoryColor(category)}`}
                            onClick={() => onToggleCategory(category)}
                            aria-expanded={isExpanded}
                        >
                            <span className="flex items-center">
                                {/* Display category icon and name with entry count */}
                                {getCategoryIcon(category)}
                                {category} ({categoryCounts[category] || 0})
                            </span>
                            <span className={`ml-2 transform transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        </button>

                        {isExpanded && (
                            <ul className="space-y-px pl-1 pt-1">
                                {/* Sort entries alphabetically and render each entry node */}
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

