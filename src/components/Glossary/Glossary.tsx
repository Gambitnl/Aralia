// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:09
 * Dependents: components/DesignPreview/steps/PreviewSpellGlossary.tsx, components/Glossary/index.ts
 * Imports: 16 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { useSpellGateChecks } from './spellGateChecker/useSpellGateChecks';
import { SpellData } from './SpellCardTemplate';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { assetUrl } from '../../config/env';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { buildGlossaryDisplayIndex, findFirstSelectableGlossaryEntry } from './glossaryRuleChapters';

// Sub-components
import { GlossarySidebar } from './GlossarySidebar';
import { GlossaryEntryPanel } from './GlossaryEntryPanel';
import { GlossaryResizeHandles } from './GlossaryResizeHandles';

// Hooks
import { useGlossaryModal } from './hooks/useGlossaryModal';
import { useGlossarySearch } from './hooks/useGlossarySearch';
import { useGlossaryKeyboardNav, useFlattenedEntries } from './hooks/useGlossaryKeyboardNav';

interface SpellReferencedRule {
  label: string;
  description: string;
  glossaryTermId?: string;
}

interface SpellReferencedRulesEnrichmentFile {
  enrichmentDataset?: {
    spells?: Array<{
      spellId: string;
      referencedRules?: SpellReferencedRule[];
    }>;
  };
}

interface GlossaryProps {
  isOpen: boolean;
  onClose: () => void;
  initialTermId?: string;
  /** Whether developer-only glossary diagnostics should be visible. */
  isDevModeEnabled: boolean;
  /** Optional preview/testing override for the initial spell gate toggle state. */
  defaultShowSpellGateChecks?: boolean;
}

const Glossary: React.FC<GlossaryProps> = ({
  isOpen,
  onClose,
  initialTermId,
  isDevModeEnabled,
  defaultShowSpellGateChecks = false,
}) => {
  // This endpoint exists only on the Vite dev server. When dev mode is enabled, opening the
  // glossary asks the server to rebuild the glossary indexes so newly added rule files show up
  // without relying on the user to remember a separate terminal command.
  const GLOSSARY_REBUILD_ENDPOINT = '/api/glossary/rebuild-index';
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const glossaryIndex = useContext(GlossaryContext);
  const displayGlossaryIndex = useMemo(() => buildGlossaryDisplayIndex(glossaryIndex), [glossaryIndex]);
  const modalRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<Record<string, HTMLLIElement | HTMLButtonElement | null>>({});
  const hasNavigatedInitial = useRef<string | null>(null);
  const preserveSelectedEntryOutsideFilterRef = useRef(false);
  const hasRequestedDevGlossaryRebuildForOpenRef = useRef(false);

  // State
  const [selectedEntry, setSelectedEntry] = useState<GlossaryEntry | null>(null);
  const [error, _setError] = useState<string | null>(null);
  const [spellJsonData, setSpellJsonData] = useState<SpellData | null>(null);
  const [spellJsonLoading, setSpellJsonLoading] = useState(false);
  const [spellReferencedRulesBySpellId, setSpellReferencedRulesBySpellId] = useState<Record<string, SpellReferencedRule[]>>({});
  const [showSpellGateChecks, setShowSpellGateChecks] = useState(defaultShowSpellGateChecks);
  // The gate checker now has two modes:
  // - broad artifact-backed startup data for every spell
  // - a fresh per-spell refresh for the one spell the user is actively viewing
  // Keeping the active spell id here lets the hook request that narrower live
  // answer without changing the rest of the glossary selection flow.
  const activeSpellId = selectedEntry?.category === 'Spells' ? selectedEntry.id : null;
  const { results: gateResults, recheck: recheckSpells, isLoading: isCheckingSpells } = useSpellGateChecks(
    activeSpellId,
    isDevModeEnabled && showSpellGateChecks,
    isDevModeEnabled && showSpellGateChecks,
  );

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
  } = useGlossarySearch(displayGlossaryIndex);

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
    if (!selectedEntry || !displayGlossaryIndex) return { parents: [] as string[], parentIds: [] as string[] };
    const { path } = findGlossaryEntryAndPath(selectedEntry.id, displayGlossaryIndex);
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
      const title = findTitle(displayGlossaryIndex, id);
      if (title) parents.push(title);
    });

    return { parents, parentIds };
  }, [selectedEntry, displayGlossaryIndex]);

  // Navigate to a specific glossary entry
  const handleNavigateToGlossary = useCallback((termId: string) => {
    // Guard: If termId is not a string (e.g., a React SyntheticEvent passed by an onClick
    // handler that didn't wrap the call), silently bail out to prevent "[object Object]" errors.
    if (typeof termId !== 'string') return;

    if (displayGlossaryIndex) {
      const { entry: targetEntry, path: entryPath } = findGlossaryEntryAndPath(termId, displayGlossaryIndex);

      if (targetEntry) {
        // When a user clicks an internal glossary link, that explicit navigation should
        // win over any stale search filter. Without this flag, the auto-select effect
        // below immediately snaps the panel back to the first search hit if the newly
        // opened entry does not match the current search term.
        preserveSelectedEntryOutsideFilterRef.current = true;
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
  }, [displayGlossaryIndex, expandedCategories, expandedParentEntries, setExpandedCategories, setExpandedParentEntries]);

  // Initialize on open
  useEffect(() => {
    if (isOpen && displayGlossaryIndex) {
      if (initialTermId && hasNavigatedInitial.current !== initialTermId) {
        handleNavigateToGlossary(initialTermId);
        hasNavigatedInitial.current = initialTermId;
      } else if (!selectedEntry && !hasNavigatedInitial.current && filteredGlossaryIndex.length > 0) {
        const firstCategory = sortedCategories[0];
        const firstSelectableEntry = findFirstSelectableGlossaryEntry(filteredGlossaryIndex);
        if (firstSelectableEntry) {
          handleEntrySelect(firstSelectableEntry);
        }
        if (firstCategory && !expandedCategories.has(firstCategory)) {
          setExpandedCategories(prev => new Set(prev).add(firstCategory));
        }
        hasNavigatedInitial.current = 'default'; // Mark as initialized with default selection
      }
      firstFocusableElementRef.current?.focus();
    } else if (!isOpen) {
      setSelectedEntry(null);
      setSearchTerm('');
      // Reset back to the caller-provided default each time the glossary closes
      // so preview surfaces can keep diagnostics visible by default without
      // changing the normal in-game glossary behavior.
      setShowSpellGateChecks(defaultShowSpellGateChecks);
      hasNavigatedInitial.current = null; // Reset when closed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTermId, displayGlossaryIndex, defaultShowSpellGateChecks, filteredGlossaryIndex, sortedCategories, expandedCategories, handleNavigateToGlossary, handleEntrySelect, selectedEntry, setExpandedCategories, setSearchTerm]);

  // Auto-select first filtered entry
  useEffect(() => {
    if (!selectedEntry && filteredGlossaryIndex.length > 0) {
      // Default selection should only happen when nothing is selected yet.
      // This keeps first-open behavior convenient without overriding explicit
      // in-glossary navigation that may point outside the active search filter.
      const firstSelectableEntry = findFirstSelectableGlossaryEntry(filteredGlossaryIndex);
      if (firstSelectableEntry) {
        handleEntrySelect(firstSelectableEntry);
      }
    } else if (filteredGlossaryIndex.length > 0 && !filteredGlossaryIndex.some(e => e.id === selectedEntry?.id)) {
      if (preserveSelectedEntryOutsideFilterRef.current) {
        // The user deliberately navigated to an entry that the current search does not
        // include. Keep that entry visible until they make a new manual selection or
        // change the search again, rather than forcing them back to the first hit.
        preserveSelectedEntryOutsideFilterRef.current = false;
        return;
      }
      const firstSelectableEntry = findFirstSelectableGlossaryEntry(filteredGlossaryIndex);
      if (firstSelectableEntry) {
        handleEntrySelect(firstSelectableEntry);
      }
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

  // Load the spell-to-rule enrichment map once per glossary open session.
  // This keeps the spell card UI fast: each spell card just reads its already-loaded
  // rule references instead of re-parsing markdown or re-fetching one file per spell.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    fetchWithTimeout<SpellReferencedRulesEnrichmentFile>(
      assetUrl('data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json'),
    )
      .then((data) => {
        if (cancelled) return;

        const bySpellId = Object.fromEntries(
          (data.enrichmentDataset?.spells ?? []).map((spellRecord) => [
            spellRecord.spellId,
            spellRecord.referencedRules ?? [],
          ]),
        );

        setSpellReferencedRulesBySpellId(bySpellId);
      })
      .catch(() => {
        if (cancelled) return;
        // DEBT: We currently fail open here because missing enrichment data should not
        // break the whole glossary. If the canonical rule-link lane becomes mandatory,
        // surface a user-visible warning instead of silently hiding the chips.
        setSpellReferencedRulesBySpellId({});
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // ============================================================================
  // Dev-only glossary index refresh
  // ============================================================================
  // This keeps the glossary discoverability layer in sync during content authoring.
  // It is intentionally best-effort:
  // - only in dev mode
  // - only once per glossary open
  // - safe to fail silently on non-dev or remote builds where the endpoint does not exist
  // ============================================================================
  useEffect(() => {
    if (!isOpen) {
      hasRequestedDevGlossaryRebuildForOpenRef.current = false;
      return;
    }

    if (!isDevModeEnabled || hasRequestedDevGlossaryRebuildForOpenRef.current) {
      return;
    }

    hasRequestedDevGlossaryRebuildForOpenRef.current = true;

    fetchWithTimeout<{ ok?: boolean; error?: string }>(GLOSSARY_REBUILD_ENDPOINT, {
      method: 'POST',
      timeoutMs: 20000,
    }).catch((rebuildError) => {
      // We only log here because glossary opening should never be blocked by a missing local
      // dev endpoint. The user still gets the current glossary data even if the refresh failed.
      console.warn('Glossary dev-only index rebuild failed:', rebuildError);
    });
  }, [GLOSSARY_REBUILD_ENDPOINT, isDevModeEnabled, isOpen]);

  // ============================================================================
  // Manual glossary refresh action
  // ============================================================================
  // The visible header refresh button is the explicit "do both" maintenance path:
  // - always re-run the spell gate checker against the latest local files
  // - in dev mode, also ask the local glossary index endpoint to rebuild so new
  //   glossary/rule entry files become discoverable without a second manual step
  //
  // This stays best-effort for the rebuild half because the endpoint only exists
  // on the local dev server. The spell recheck still runs even if the endpoint
  // is missing or fails.
  // ============================================================================
  const handleRefreshGlossaryDiagnostics = useCallback(() => {
    recheckSpells();

    if (!isDevModeEnabled) {
      return;
    }

    fetchWithTimeout<{ ok?: boolean; error?: string }>(GLOSSARY_REBUILD_ENDPOINT, {
      method: 'POST',
      timeoutMs: 20000,
    }).catch((rebuildError) => {
      // We intentionally fail open here. The main refresh action is still useful
      // even if the local glossary index endpoint is unavailable in this session.
      console.warn('Glossary manual rebuild failed:', rebuildError);
    });
  }, [GLOSSARY_REBUILD_ENDPOINT, isDevModeEnabled, recheckSpells]);

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
    <div className="flex items-center gap-2">
      {/* This toggle makes spell diagnostics truly local to the glossary instead of piggybacking
          only on global dev mode. Dev mode still grants permission to see the diagnostics at all,
          but the glossary now owns whether they are currently shown. */}
      {isDevModeEnabled && (
        <button
          type="button"
          onClick={() => setShowSpellGateChecks((current) => !current)}
          className={`px-2 py-1 rounded-md text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 ${
            showSpellGateChecks
              ? 'bg-sky-700 border-sky-500 text-white'
              : 'bg-gray-800 border-gray-600 text-gray-300 hover:text-white hover:border-gray-500'
          }`}
          aria-label={showSpellGateChecks ? 'Hide spell gate checks' : 'Show spell gate checks'}
          title={showSpellGateChecks ? 'Hide spell gate checks' : 'Show spell gate checks'}
        >
          {showSpellGateChecks ? 'Hide Spell Checks' : 'Show Spell Checks'}
        </button>
      )}

      <button
        type="button"
        onClick={handleRefreshGlossaryDiagnostics}
        disabled={isCheckingSpells}
        className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${
          isCheckingSpells
            ? 'text-emerald-400 animate-pulse cursor-wait'
            : 'text-gray-500 hover:text-emerald-400'
        }`}
        aria-label="Re-check spells"
        title={isCheckingSpells ? 'Checking spells...' : 'Re-run spell validation checks and refresh glossary indexes'}
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
    </div>
  );

  return (
    <WindowFrame
      title="Game Glossary"
      onClose={onClose}
      headerActions={headerActions}
      storageKey={WINDOW_KEYS.GLOSSARY}
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
            isDevModeEnabled={isDevModeEnabled && showSpellGateChecks}
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
            spellReferencedRules={selectedEntry ? (spellReferencedRulesBySpellId[selectedEntry.id] ?? []) : []}
            spellJsonLoading={spellJsonLoading}
            gateResults={gateResults}
            isColumnResizing={columnResizeState.isResizing}
            isDevModeEnabled={isDevModeEnabled && showSpellGateChecks}
          />
        </div>
      </div>
    </WindowFrame>
  );
};

export default Glossary;
