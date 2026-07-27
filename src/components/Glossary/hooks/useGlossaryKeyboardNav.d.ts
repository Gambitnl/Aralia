import { GlossaryEntry } from '../../../types';
interface UseGlossaryKeyboardNavProps {
    isOpen: boolean;
    onClose: () => void;
    selectedEntry: GlossaryEntry | null;
    flattenedEntries: GlossaryEntry[];
    expandedParentEntries: Set<string>;
    setExpandedParentEntries: React.Dispatch<React.SetStateAction<Set<string>>>;
    handleEntrySelect: (entry: GlossaryEntry) => void;
}
interface UseFlattenedEntriesProps {
    sortedCategories: string[];
    groupedEntries: Record<string, GlossaryEntry[]>;
    expandedCategories: Set<string>;
    expandedParentEntries: Set<string>;
}
/**
 * Compute a flattened list of visible entries for keyboard navigation.
 */
export declare function useFlattenedEntries({ sortedCategories, groupedEntries, expandedCategories, expandedParentEntries, }: UseFlattenedEntriesProps): GlossaryEntry[];
/**
 * Hook to handle keyboard navigation in the glossary.
 */
export declare function useGlossaryKeyboardNav({ isOpen, onClose, selectedEntry, flattenedEntries, expandedParentEntries, setExpandedParentEntries, handleEntrySelect, }: UseGlossaryKeyboardNavProps): void;
export {};
