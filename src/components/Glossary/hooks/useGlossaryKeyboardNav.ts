/**
 * @file useGlossaryKeyboardNav.ts
 * Custom hook for managing keyboard navigation (arrow keys, Escape) in the glossary.
 * Extracted from Glossary.tsx for better modularity and testability.
 */
import { useEffect, useMemo } from 'react';
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
export function useFlattenedEntries({
    sortedCategories,
    groupedEntries,
    expandedCategories,
    expandedParentEntries,
}: UseFlattenedEntriesProps): GlossaryEntry[] {
    return useMemo(() => {
        const result: GlossaryEntry[] = [];
        const flatten = (entries: GlossaryEntry[]) => {
            entries.forEach(entry => {
                result.push(entry);
                if (entry.subEntries && expandedParentEntries.has(entry.id)) {
                    flatten(entry.subEntries);
                }
            });
        };
        sortedCategories.forEach(category => {
            if (expandedCategories.has(category)) {
                flatten(groupedEntries[category] || []);
            }
        });
        return result;
    }, [sortedCategories, groupedEntries, expandedCategories, expandedParentEntries]);
}

/**
 * Hook to handle keyboard navigation in the glossary.
 */
export function useGlossaryKeyboardNav({
    isOpen,
    onClose,
    selectedEntry,
    flattenedEntries,
    expandedParentEntries,
    setExpandedParentEntries,
    handleEntrySelect,
}: UseGlossaryKeyboardNavProps): void {

    // Escape key handler
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Arrow key navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyNav = (event: KeyboardEvent) => {
            // Only handle arrow keys when not in search input
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT') return;

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const currentIndex = selectedEntry
                    ? flattenedEntries.findIndex(e => e.id === selectedEntry.id)
                    : -1;

                let newIndex: number;
                if (event.key === 'ArrowDown') {
                    newIndex = currentIndex < flattenedEntries.length - 1 ? currentIndex + 1 : 0;
                } else {
                    newIndex = currentIndex > 0 ? currentIndex - 1 : flattenedEntries.length - 1;
                }

                if (flattenedEntries[newIndex]) {
                    handleEntrySelect(flattenedEntries[newIndex]);
                }
            } else if (event.key === 'ArrowRight' && selectedEntry?.subEntries?.length) {
                // Expand current entry
                if (!expandedParentEntries.has(selectedEntry.id)) {
                    setExpandedParentEntries(prev => new Set(prev).add(selectedEntry.id));
                }
            } else if (event.key === 'ArrowLeft' && selectedEntry) {
                // Collapse current entry or go to parent
                if (expandedParentEntries.has(selectedEntry.id)) {
                    setExpandedParentEntries(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(selectedEntry.id);
                        return newSet;
                    });
                }
            }
        };

        window.addEventListener('keydown', handleKeyNav);
        return () => window.removeEventListener('keydown', handleKeyNav);
    }, [isOpen, selectedEntry, flattenedEntries, expandedParentEntries, setExpandedParentEntries, handleEntrySelect]);
}
