/**
 * @file hooks/index.ts
 * Export all glossary-related hooks for convenient importing.
 */
export { useGlossaryModal } from './useGlossaryModal';
export type { ModalSize, ModalPosition, ResizeState, DragState, ColumnResizeState } from './useGlossaryModal';

export { useGlossarySearch, entryMatchesSearch } from './useGlossarySearch';
export type { UseGlossarySearchResult } from './useGlossarySearch';

export { useGlossaryKeyboardNav, useFlattenedEntries } from './useGlossaryKeyboardNav';
