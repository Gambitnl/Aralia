/**
 * @file Glossary.tsx
 * Main Glossary modal component - now modularized into smaller sub-components.
 * 
 * Sub-components:
 * - GlossaryHeader: Title bar, action buttons, search input
 * - GlossarySidebar: Category navigation and entry tree
 * - GlossaryEntryPanel: Entry content display with breadcrumbs
 * - GlossaryFooter: Timestamp and keyboard hints
 * - GlossaryResizeHandles: Modal resize controls
 * 
 * Hooks:
 * - useGlossaryModal: Modal position, size, drag, and resize state
 * - useGlossarySearch: Search filtering and expansion state
 * - useGlossaryKeyboardNav: Keyboard navigation
 */
import React, { useEffect, useRef, useState, useCallback, useContext, useMemo } from 'react';
import GlossaryContext from '../../context/GlossaryContext';
import { GlossaryEntry } from '../../types';
import { findGlossaryEntryAndPath } from '../../utils/glossaryUtils';
import { useSpellGateChecks } from '../../hooks/useSpellGateChecks';
import { SpellData } from './SpellCardTemplate';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { assetUrl } from '../../config/env';
import { WindowFrame } from '../ui/WindowFrame';

// Sub-components
import { GlossarySidebar } from './GlossarySidebar';
import { GlossaryEntryPanel } from './GlossaryEntryPanel';
import { GlossaryResizeHandles } from './GlossaryResizeHandles';

// Hooks
import { useGlossaryModal } from './hooks/useGlossaryModal';
import { useGlossarySearch } from './hooks/useGlossarySearch';
import { useGlossaryKeyboardNav, useFlattenedEntries } from './hooks/useGlossaryKeyboardNav';

interface GlossaryProps {
  isOpen: boolean;
  onClose: () => void;
  initialTermId?: string;
}

const Glossary: React.FC<GlossaryProps> = ({ isOpen, onClose, initialTermId }) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const glossaryIndex = useContext(GlossaryContext);
  const { results: gateResults, recheck: recheckSpells, isLoading: isCheckingSpells } = useSpellGateChecks();
  const modalRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<Record<string, HTMLLIElement | HTMLButtonElement | null>>({});
  const hasNavigatedInitial = useRef<string | null>(null);

  // State
  const [selectedEntry, setSelectedEntry] = useState<GlossaryEntry | null>(null);
  const [error, _setError] = useState<string | null>(null);
  const [spellJsonData, setSpellJsonData] = useState<SpellData | null>(null);
  const [spellJsonLoading, setSpellJsonLoading] = useState(false);

  // Custom hooks
  const {
    modalSize,
    modalPosition,
    resizeState,
    dragState,
    columnResizeState,
    handleResizeStart,
    handleDragStart,
    handleColumnResizeStart,
    handleResetLayout,
    handleMaximize,
  } = useGlossaryModal(isOpen, modalRef);

  const {
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
  } = useGlossarySearch(glossaryIndex);

  // Entry selection handler
  const handleEntrySelect = useCallback((entry: GlossaryEntry) => {
    const isParent = entry.subEntries && entry.subEntries.length > 0;
    const hasFilePath = !!entry.filePath;
    // For spells, we consider them potentially selectable even without a filePath if they are children
    const isSpellChild = entry.category === 'Spells' && !isParent;

    // Only set as selected entry if it has content (file path or is a spell child)
    if (hasFilePath || isSpellChild) {
      setSelectedEntry(entry);
    }

    // Toggle expansion for parent entries
    if (isParent) {
      toggleParentEntry(entry.id);
    }
  }, [toggleParentEntry]);

  // Flattened entries for keyboard navigation
  const flattenedEntries = useFlattenedEntries({
    sortedCategories,
    groupedEntries,
    expandedCategories,
    expandedParentEntries,
  });

  // Keyboard navigation
  useGlossaryKeyboardNav({
    isOpen,
    onClose,
    selectedEntry,
    flattenedEntries,
    expandedParentEntries,
    setExpandedParentEntries,
    handleEntrySelect,
  });

  // Breadcrumb path calculation
  const breadcrumbPath = useMemo(() => {
    if (!selectedEntry || !glossaryIndex) return { parents: [] as string[], parentIds: [] as string[] };
    const { path } = findGlossaryEntryAndPath(selectedEntry.id, glossaryIndex);
    const parentIds = path.filter(id => id !== selectedEntry.id);
    const parents: string[] = [];

    const findTitle = (entries: GlossaryEntry[], id: string): string | null => {
      for (const e of entries) {
        if (e.id === id) return e.title;
        if (e.subEntries) {
          const found = findTitle(e.subEntries, id);
          if (found) return found;
        }
      }
      return null;
    };

    parentIds.forEach(id => {
      const title = findTitle(glossaryIndex, id);
      if (title) parents.push(title);
    });

    return { parents, parentIds };
  }, [selectedEntry, glossaryIndex]);

  // Navigate to a specific glossary entry
  const handleNavigateToGlossary = useCallback((termId: string) => {
    // Guard: If termId is not a string (e.g., a React SyntheticEvent passed by an onClick
    // handler that didn't wrap the call), silently bail out to prevent "[object Object]" errors.
    if (typeof termId !== 'string') return;

    if (glossaryIndex) {
      const { entry: targetEntry, path: entryPath } = findGlossaryEntryAndPath(termId, glossaryIndex);

      if (targetEntry) {
        setSelectedEntry(targetEntry);
        if (targetEntry.category && !expandedCategories.has(targetEntry.category)) {
          setExpandedCategories(prev => new Set(prev).add(targetEntry.category));
        }
        entryPath.forEach(parentId => {
          if (parentId !== targetEntry.id && !expandedParentEntries.has(parentId)) {
            setExpandedParentEntries(prev => new Set(prev).add(parentId));
          }
        });
      } else {
        console.warn(`Glossary internal navigation: Term ID "${termId}" not found.`);
      }
    }
  }, [glossaryIndex, expandedCategories, expandedParentEntries, setExpandedCategories, setExpandedParentEntries]);

  // Initialize on open
  useEffect(() => {
    if (isOpen && glossaryIndex) {
      if (initialTermId && hasNavigatedInitial.current !== initialTermId) {
        handleNavigateToGlossary(initialTermId);
        hasNavigatedInitial.current = initialTermId;
      } else if (!selectedEntry && !hasNavigatedInitial.current && filteredGlossaryIndex.length > 0) {
        const firstCategory = sortedCategories[0];
        if (firstCategory && groupedEntries[firstCategory]?.[0]) {
          handleEntrySelect(groupedEntries[firstCategory][0]);
          if (!expandedCategories.has(firstCategory)) {
            setExpandedCategories(prev => new Set(prev).add(firstCategory));
          }
          hasNavigatedInitial.current = 'default'; // Mark as initialized with default selection
        }
      }
      firstFocusableElementRef.current?.focus();
    } else if (!isOpen) {
      setSelectedEntry(null);
      setSearchTerm('');
      hasNavigatedInitial.current = null; // Reset when closed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTermId, glossaryIndex]);

  // Auto-select first filtered entry
  useEffect(() => {
    if (!selectedEntry && filteredGlossaryIndex.length > 0) {
      handleEntrySelect(filteredGlossaryIndex[0]);
    } else if (filteredGlossaryIndex.length > 0 && !filteredGlossaryIndex.some(e => e.id === selectedEntry?.id)) {
      handleEntrySelect(filteredGlossaryIndex[0]);
    } else if (filteredGlossaryIndex.length === 0) {
      setSelectedEntry(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGlossaryIndex]);

  // Scroll selected entry into view
  useEffect(() => {
    if (selectedEntry && entryRefs.current[selectedEntry.id]) {
      entryRefs.current[selectedEntry.id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedEntry]);

  // Fetch spell JSON when a spell is selected
  useEffect(() => {
    if (!selectedEntry || selectedEntry.category !== 'Spells') {
      setSpellJsonData(null);
      return;
    }

    const controller = new AbortController();
    const gateResult = gateResults[selectedEntry.id];
    const level = gateResult?.level ?? 0;

    setSpellJsonLoading(true);
    fetchWithTimeout<SpellData>(
      assetUrl(`data/spells/level-${level}/${selectedEntry.id}.json`),
      { signal: controller.signal }
    )
      .then((data: SpellData) => {
        setSpellJsonData(data);
        setSpellJsonLoading(false);
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') {
          setSpellJsonData(null);
          setSpellJsonLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedEntry, gateResults]);

  // Early returns for loading/error states
  if (!isOpen) return null;

  if (glossaryIndex === null && !error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[var(--z-index-modal-background)] p-4">
        <div className="bg-gray-900 text-gray-200 p-6 rounded-xl shadow-2xl border border-gray-700">
          <p className="text-gray-400 italic">Loading glossary...</p>
        </div>
      </div>
    );
  }

  if ((glossaryIndex && glossaryIndex.length === 0 && !error) || error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[var(--z-index-modal-background)] p-4">
        <div className="bg-gray-900 text-gray-200 p-6 rounded-xl shadow-2xl border border-gray-700">
          <p className="text-red-400">{error || "Glossary index is empty or failed to load. Please check console."}</p>
          <button ref={firstFocusableElementRef} onClick={onClose} className="mt-4 px-4 py-2 bg-sky-600 text-white rounded">Close</button>
        </div>
      </div>
    );
  }

  // Header actions for the WindowFrame
  const headerActions = (
    <button
      type="button"
      onClick={recheckSpells}
      disabled={isCheckingSpells}
      className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${isCheckingSpells
        ? 'text-emerald-400 animate-pulse cursor-wait'
        : 'text-gray-500 hover:text-emerald-400'
        }`}
      aria-label="Re-check spells"
      title={isCheckingSpells ? "Checking spells..." : "Re-run spell validation checks"}
    >
      {isCheckingSpells ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
    </button>
  );

  return (
    <WindowFrame
      title="Game Glossary"
      onClose={onClose}
      headerActions={headerActions}
      storageKey="glossary-modal-size"
    >
      <div className="flex flex-col h-full p-6 bg-gray-900 text-gray-200">
        {/* Main content area */}
        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0 glossary-main-container">
          {/* Sidebar with categories and entries */}
          <GlossarySidebar
            sortedCategories={sortedCategories}
            groupedEntries={groupedEntries}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            expandedParentEntries={expandedParentEntries}
            onToggleParentEntry={toggleParentEntry}
            selectedEntry={selectedEntry}
            onEntrySelect={handleEntrySelect}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            hasError={!!error}
            gateResults={gateResults}
            categoryCounts={categoryCounts}
            entryRefs={entryRefs}
            isColumnResizing={columnResizeState.isResizing}
          />

          {/* Column resize grabber */}
          <button
            type="button"
            aria-label="Resize glossary columns"
            className="w-1 cursor-col-resize self-stretch flex items-center justify-center group"
            onMouseDown={handleColumnResizeStart}
            title="Drag to resize columns"
          >
            <div className="w-0.5 h-16 rounded-full bg-amber-400/30 group-hover:bg-amber-400/80 group-hover:shadow-[0_0_6px_rgba(251,191,36,0.5)] transition-all duration-200" />
          </button>

          {/* Entry display panel */}
          <GlossaryEntryPanel
            selectedEntry={selectedEntry}
            breadcrumbPath={breadcrumbPath}
            expandedCategories={expandedCategories}
            onExpandCategory={(category) => setExpandedCategories(prev => new Set(prev).add(category))}
            onNavigateToGlossary={handleNavigateToGlossary}
            spellJsonData={spellJsonData}
            spellJsonLoading={spellJsonLoading}
            gateResults={gateResults}
            isColumnResizing={columnResizeState.isResizing}
          />
        </div>
      </div>
    </WindowFrame>
  );
};

export default Glossary;
