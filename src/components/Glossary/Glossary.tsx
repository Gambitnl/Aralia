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

// Sub-components
import { GlossaryHeader } from './GlossaryHeader';
import { GlossarySidebar } from './GlossarySidebar';
import { GlossaryEntryPanel } from './GlossaryEntryPanel';
import { GlossaryFooter } from './GlossaryFooter';
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

  // State
  const [selectedEntry, setSelectedEntry] = useState<GlossaryEntry | null>(null);
  const [error, _setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
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
  } = useGlossaryModal(isOpen, modalRef);

  const {
    searchTerm,
    setSearchTerm,
    filteredGlossaryIndex,
    groupedEntries,
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
    setSelectedEntry(entry);
    if (entry.subEntries && entry.subEntries.length > 0) {
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
      if (initialTermId) {
        handleNavigateToGlossary(initialTermId);
      } else if (!selectedEntry && filteredGlossaryIndex.length > 0) {
        const firstCategory = sortedCategories[0];
        if (firstCategory && groupedEntries[firstCategory]?.[0]) {
          handleEntrySelect(groupedEntries[firstCategory][0]);
          if (!expandedCategories.has(firstCategory)) {
            setExpandedCategories(prev => new Set(prev).add(firstCategory));
          }
        }
      }
      firstFocusableElementRef.current?.focus();
    } else if (!isOpen) {
      setSelectedEntry(null);
      setSearchTerm('');
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

  // Fetch lastGenerated timestamp
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    fetchWithTimeout<{ lastGenerated?: string }>(
      assetUrl('data/glossary/index/main.json'),
      { signal: controller.signal }
    )
      .then(data => {
        if (data?.lastGenerated) {
          setLastGenerated(data.lastGenerated);
        }
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') {
          setLastGenerated(null);
        }
      });

    return () => controller.abort();
  }, [isOpen]);

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
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 text-gray-200 p-6 rounded-xl shadow-2xl border border-gray-700">
          <p className="text-gray-400 italic">Loading glossary...</p>
        </div>
      </div>
    );
  }

  if ((glossaryIndex && glossaryIndex.length === 0 && !error) || error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 text-gray-200 p-6 rounded-xl shadow-2xl border border-gray-700">
          <p className="text-red-400">{error || "Glossary index is empty or failed to load. Please check console."}</p>
          <button ref={firstFocusableElementRef} onClick={onClose} className="mt-4 px-4 py-2 bg-sky-600 text-white rounded">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 z-50 p-4 overflow-visible"
      aria-modal="true"
      role="dialog"
      aria-labelledby="glossary-title"
    >
      <div
        ref={modalRef}
        className="bg-gray-900 text-gray-200 p-6 rounded-xl shadow-2xl border border-gray-700 flex flex-col relative overflow-visible"
        style={{
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          minWidth: '600px',
          minHeight: '400px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 40px)',
          position: 'fixed',
          left: modalPosition ? `${modalPosition.left}px` : '50%',
          top: modalPosition ? `${modalPosition.top}px` : '50%',
          transform: modalPosition ? 'none' : 'translate(-50%, -50%)',
          margin: modalPosition ? '0' : undefined,
          userSelect: resizeState.isResizing || dragState.isDragging ? 'none' : undefined,
          cursor: dragState.isDragging ? 'grabbing' : undefined,
        }}
      >
        {/* Resize handles */}
        <GlossaryResizeHandles onResizeStart={handleResizeStart} />

        {/* Header with title, search, and action buttons */}
        <GlossaryHeader
          firstFocusableElementRef={firstFocusableElementRef}
          onDragStart={handleDragStart}
          onRecheckSpells={recheckSpells}
          isCheckingSpells={isCheckingSpells}
          onResetLayout={handleResetLayout}
          onClose={onClose}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

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
            hasError={!!error}
            gateResults={gateResults}
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

        {/* Footer with timestamp and keyboard hints */}
        <GlossaryFooter lastGenerated={lastGenerated} onClose={onClose} />
      </div>
    </div>
  );
};

export default Glossary;
