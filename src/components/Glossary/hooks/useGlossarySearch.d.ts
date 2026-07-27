import { GlossaryEntry } from '../../../types';
/**
 * Checks if a glossary entry matches the search term by title, aliases, or tags.
 */
export declare const entryMatchesSearch: (entry: GlossaryEntry, term: string) => boolean;
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
 * Hook to manage search filtering and expansion state for glossary entries.
 */
export declare function useGlossarySearch(glossaryIndex: GlossaryEntry[] | null): UseGlossarySearchResult;
