/**
 * @file useGlossarySearch.ts
 * Custom hook for filtering glossary entries by search term and managing
 * category/entry expansion state. 
 * Extracted from Glossary.tsx for better modularity and testability.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { GlossaryEntry } from '../../../types';

/**
 * Checks if a glossary entry matches the search term by title, aliases, or tags.
 */
export const entryMatchesSearch = (entry: GlossaryEntry, term: string): boolean => {
    const lowerTerm = term.toLowerCase();
    if (entry.title.toLowerCase().includes(lowerTerm)) return true;
    if (entry.aliases?.some(alias => alias.toLowerCase().includes(lowerTerm))) return true;
    if (entry.tags?.some(tag => tag.toLowerCase().includes(lowerTerm))) return true;
    return false;
};

export interface UseGlossarySearchResult {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filteredGlossaryIndex: GlossaryEntry[];
    groupedEntries: Record<string, GlossaryEntry[]>;
    categoryCounts: Record<string, number>;
    sortedCategories: string[];
    expandedCategories: Set<string>;
    setExpandedCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
    expandedParentEntries: Set<string>;
    setExpandedParentEntries: React.Dispatch<React.SetStateAction<Set<string>>>;
    toggleCategory: (category: string) => void;
    toggleParentEntry: (entryId: string) => void;
}

/**
 * Recursively counts entries that have content (file path or are spell leaves).
 */
const countRecursiveEntries = (entries: GlossaryEntry[]): number => {
    let count = 0;
    entries.forEach(entry => {
        const isParent = entry.subEntries && entry.subEntries.length > 0;
        const hasContent = !!entry.filePath || (entry.category === 'Spells' && !isParent);

        if (hasContent) {
            count += 1;
        }

        if (isParent) {
            count += countRecursiveEntries(entry.subEntries!);
        }
    });
    return count;
};

/**
 * Hook to manage search filtering and expansion state for glossary entries.
 */
export function useGlossarySearch(
    glossaryIndex: GlossaryEntry[] | null
): UseGlossarySearchResult {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedParentEntries, setExpandedParentEntries] = useState<Set<string>>(new Set());

    /**
     * Recursively filters entries by search term and collects which categories/parents to expand.
     */
    const filterAndExpandEntries = useCallback((entries: GlossaryEntry[] | undefined, term: string): {
        filteredEntries: GlossaryEntry[];
        categoriesToExpand: Set<string>;
        parentsToExpand: Set<string>;
    } => {
        if (!entries) return { filteredEntries: [], categoriesToExpand: new Set(), parentsToExpand: new Set() };
        const trimmedTerm = term.trim();
        if (!trimmedTerm) return { filteredEntries: entries, categoriesToExpand: new Set(), parentsToExpand: new Set() };

        const categoriesToExpandSet = new Set<string>();
        const parentsToExpandSet = new Set<string>();

        function recurseSearch(currentEntries: GlossaryEntry[], parentIdPath: string[]): GlossaryEntry[] {
            const matchedHere: GlossaryEntry[] = [];
            currentEntries.forEach(entry => {
                const directMatch = entryMatchesSearch(entry, trimmedTerm);
                let subMatches: GlossaryEntry[] = [];
                if (entry.subEntries) {
                    subMatches = recurseSearch(entry.subEntries, [...parentIdPath, entry.id]);
                }

                if (directMatch || subMatches.length > 0) {
                    const entryCopy = { ...entry };
                    if (subMatches.length > 0) {
                        entryCopy.subEntries = subMatches;
                        parentsToExpandSet.add(entry.id);
                        categoriesToExpandSet.add(entry.category);
                    }
                    if (directMatch) {
                        parentIdPath.forEach(pid => parentsToExpandSet.add(pid));
                        categoriesToExpandSet.add(entry.category);
                    }
                    matchedHere.push(entryCopy);
                }
            });
            return matchedHere;
        }

        const finalResults = recurseSearch(entries, []);

        return {
            filteredEntries: finalResults,
            categoriesToExpand: categoriesToExpandSet,
            parentsToExpand: parentsToExpandSet
        };
    }, []);

    // Compute filtered index based on search term
    const filteredGlossaryIndex = useMemo(() => {
        return filterAndExpandEntries(glossaryIndex || [], searchTerm).filteredEntries;
    }, [glossaryIndex, searchTerm, filterAndExpandEntries]);

    // Track the previous search term to detect when search is cleared vs initial empty state
    const [wasSearching, setWasSearching] = useState(false);

    // Auto-expand matching categories and parents when search changes
    // IMPORTANT: Only reset expansion state when actively clearing a search, not on every render
    useEffect(() => {
        const trimmedSearch = searchTerm.trim();
        const isCurrentlySearching = trimmedSearch.length > 0;

        if (isCurrentlySearching) {
            // Active search: auto-expand matching categories and entries
            const { categoriesToExpand, parentsToExpand } = filterAndExpandEntries(glossaryIndex || [], trimmedSearch);
            setExpandedCategories(categoriesToExpand);
            setExpandedParentEntries(parentsToExpand);
            setWasSearching(true);
        } else if (wasSearching) {
            // User just cleared the search: reset expansion state to allow fresh manual navigation
            setExpandedCategories(new Set());
            setExpandedParentEntries(new Set());
            setWasSearching(false);
        }
        // When searchTerm is empty and wasSearching is false, do nothing
        // This preserves manual expand/collapse actions during normal browsing
    }, [searchTerm, glossaryIndex, filterAndExpandEntries, wasSearching]);

    // Group by category
    const groupedEntries = useMemo(() => filteredGlossaryIndex.reduce((acc, entry) => {
        const category = entry.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(entry);
        return acc;
    }, {} as Record<string, GlossaryEntry[]>), [filteredGlossaryIndex]);

    // Compute recursive counts for each category
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        Object.entries(groupedEntries).forEach(([category, entries]) => {
            counts[category] = countRecursiveEntries(entries);
        });
        return counts;
    }, [groupedEntries]);

    // Sorted category names
    const sortedCategories = useMemo(() => Object.keys(groupedEntries).sort(), [groupedEntries]);

    // Toggle category expansion
    const toggleCategory = useCallback((category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    }, []);

    // Toggle parent entry expansion
    const toggleParentEntry = useCallback((entryId: string) => {
        setExpandedParentEntries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(entryId)) {
                newSet.delete(entryId);
            } else {
                newSet.add(entryId);
            }
            return newSet;
        });
    }, []);

    return {
        searchTerm,
        setSearchTerm,
        filteredGlossaryIndex,
        groupedEntries,
        categoryCounts,
        sortedCategories,
        expandedCategories,
        setExpandedCategories,
        expandedParentEntries,
        setExpandedParentEntries,
        toggleCategory,
        toggleParentEntry,
    };
}
