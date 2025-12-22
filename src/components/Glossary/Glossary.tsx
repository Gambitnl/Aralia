import React, { useEffect, useRef, useState, useCallback, useContext, useMemo } from 'react';
import GlossaryContext from '../../context/GlossaryContext';
import { GlossaryEntry } from '../../types';
import { FullEntryDisplay } from './FullEntryDisplay';
import { findGlossaryEntryAndPath } from '../../utils/glossaryUtils';
import { useSpellGateChecks } from '../../hooks/useSpellGateChecks';
import SpellCardTemplate, { SpellData } from './SpellCardTemplate';
import { SafeStorage } from '../../utils/storageUtils';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { assetUrl } from '../../config/env';
import { getCategoryIcon, highlightSearchTerm, Breadcrumb, getCategoryColor } from './glossaryUIUtils';

interface GlossaryProps {
  isOpen: boolean;
  onClose: () => void;
  initialTermId?: string;
}

const entryMatchesSearch = (entry: GlossaryEntry, term: string): boolean => {
  const lowerTerm = term.toLowerCase();
  if (entry.title.toLowerCase().includes(lowerTerm)) return true;
  if (entry.aliases?.some(alias => alias.toLowerCase().includes(lowerTerm))) return true;
  if (entry.tags?.some(tag => tag.toLowerCase().includes(lowerTerm))) return true;
  return false;
};

// TODO: Split this 800+ line component into smaller sub-components (e.g., GlossaryHeader, GlossarySearch, GlossarySidebar, GlossaryEntryView) for better maintainability and testability
const Glossary: React.FC<GlossaryProps> = ({ isOpen, onClose, initialTermId }) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const glossaryIndex = useContext(GlossaryContext);
  const { results: gateResults, recheck: recheckSpells, isLoading: isCheckingSpells } = useSpellGateChecks();
  const modalRef = useRef<HTMLDivElement>(null);

  const [selectedEntry, setSelectedEntry] = useState<GlossaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedParentEntries, setExpandedParentEntries] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const [spellJsonData, setSpellJsonData] = useState<SpellData | null>(null);
  const [spellJsonLoading, setSpellJsonLoading] = useState(false);

  // Resize state - all useState hooks must be at the top before any effects
  const [modalSize, setModalSize] = useState(() => {
    const saved = SafeStorage.getItem('glossary-modal-size');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { width: parsed.width || 1024, height: parsed.height || 835 };
      } catch {
        return { width: 1024, height: 835 };
      }
    }
    return { width: 1024, height: 835 };
  });

  // Track modal position for left/top edge resizing - declared here before effects that use it
  const [modalPosition, setModalPosition] = useState<{ left: number; top: number } | null>(null);

  const [resizeState, setResizeState] = useState<{
    isResizing: boolean;
    handle: string | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
  }>({
    isResizing: false,
    handle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
    startTop: 0,
  });

  // Track resize state for the column resizer
  const [columnResizeState, setColumnResizeState] = useState<{
    isResizing: boolean;
    startX: number;
    startListWidth: number;
    startEntryWidth: number;
  }>({
    isResizing: false,
    startX: 0,
    startListWidth: 0,
    startEntryWidth: 0,
  });

  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  const entryRefs = useRef<Record<string, HTMLLIElement | HTMLButtonElement | null>>({});

  // Get breadcrumb path for current entry
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

  const handleNavigateToGlossary = useCallback((termId: string) => {
    if (glossaryIndex) {
      const { entry: targetEntry, path: entryPath } = findGlossaryEntryAndPath(termId, glossaryIndex);

      if (targetEntry) {
        setSelectedEntry(targetEntry);
        // Expand category and all parent entries in the path
        if (targetEntry.category && !expandedCategories.has(targetEntry.category)) {
          setExpandedCategories(prev => new Set(prev).add(targetEntry.category));
        }
        entryPath.forEach(parentId => {
          if (parentId !== targetEntry.id && !expandedParentEntries.has(parentId)) { // Don't expand the target itself, only its parents
            setExpandedParentEntries(prev => new Set(prev).add(parentId));
          }
        });
      } else {
        console.warn(`Glossary internal navigation: Term ID "${termId}" not found.`);
      }
    }
  }, [glossaryIndex, expandedCategories, expandedParentEntries]);


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

  const filteredGlossaryIndex = useMemo(() => {
    return filterAndExpandEntries(glossaryIndex || [], searchTerm).filteredEntries;
  }, [glossaryIndex, searchTerm, filterAndExpandEntries]);

  useEffect(() => {
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch) {
      const { categoriesToExpand, parentsToExpand } = filterAndExpandEntries(glossaryIndex || [], trimmedSearch);
      setExpandedCategories(categoriesToExpand);
      setExpandedParentEntries(parentsToExpand);
    } else {
      setExpandedCategories(new Set());
      setExpandedParentEntries(new Set());
    }
  }, [searchTerm, glossaryIndex, filterAndExpandEntries]);


  const groupedEntries = useMemo(() => filteredGlossaryIndex.reduce((acc, entry) => {
    const category = entry.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {} as Record<string, GlossaryEntry[]>), [filteredGlossaryIndex]);

  const sortedCategories = useMemo(() => Object.keys(groupedEntries).sort(), [groupedEntries]);

  // Keyboard navigation - flattened list of visible entries for arrow key nav
  const flattenedEntries = useMemo(() => {
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
      setExpandedCategories(new Set());
      setExpandedParentEntries(new Set());
      setSearchTerm('');
    }
  }, [isOpen, initialTermId, glossaryIndex]);

  useEffect(() => {
    if (!selectedEntry && filteredGlossaryIndex.length > 0) {
      handleEntrySelect(filteredGlossaryIndex[0]);
    } else if (filteredGlossaryIndex.length > 0 && !filteredGlossaryIndex.some(e => e.id === selectedEntry?.id)) {
      handleEntrySelect(filteredGlossaryIndex[0]);
    } else if (filteredGlossaryIndex.length === 0) {
      setSelectedEntry(null);
    }
  }, [filteredGlossaryIndex]);

  useEffect(() => {
    if (selectedEntry && entryRefs.current[selectedEntry.id]) {
      entryRefs.current[selectedEntry.id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedEntry]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const toggleParentEntry = (entryId: string) => {
    setExpandedParentEntries(prev => {
      const newSet = new Set(prev);
      newSet.has(entryId) ? newSet.delete(entryId) : newSet.add(entryId);
      return newSet;
    });
  };

  const handleEntrySelect = useCallback((entry: GlossaryEntry) => {
    setSelectedEntry(entry);
    if (entry.subEntries && entry.subEntries.length > 0) {
      toggleParentEntry(entry.id);
    }
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      newSet.has(category) ? newSet.delete(category) : newSet.add(category);
      return newSet;
    });
  };

  // Keyboard navigation for arrow keys
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
  }, [isOpen, selectedEntry, flattenedEntries, expandedParentEntries, handleEntrySelect]);

  // Initialize column widths when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset to default widths when opening
      const listElement = document.querySelector('.glossary-list-container') as HTMLElement;
      const entryElement = document.querySelector('.glossary-entry-container') as HTMLElement;

      if (listElement && entryElement) {
        listElement.style.width = '';
        entryElement.style.width = '';
      }
    }
  }, [isOpen]);

  // Calculate centered position when modal opens
  useEffect(() => {
    if (!isOpen || resizeState.isResizing || modalPosition) return;

    const left = (window.innerWidth - modalSize.width) / 2;
    const top = (window.innerHeight - modalSize.height) / 2;
    setModalPosition({ left, top });
  }, [isOpen, modalSize, resizeState.isResizing, modalPosition]);

  // Reset position when modal closes
  useEffect(() => {
    if (!isOpen) {
      setModalPosition(null);
    }
  }, [isOpen]);

  // Fetch lastGenerated timestamp from glossary main.json
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
      .catch((error) => {
        if (error.name !== 'AbortError') {
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

    // Get spell level from gate results or default to searching
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
      .catch((error) => {
        // Only clear data if it wasn't an abort (which means the component unmounted or changed selection)
        // If it was an abort, we might have already started a new fetch
        if (error.name !== 'AbortError') {
          setSpellJsonData(null);
          setSpellJsonLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedEntry, gateResults]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!modalRef.current) return;

    const rect = modalRef.current.getBoundingClientRect();
    setResizeState({
      isResizing: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
    });
  }, []);

  useEffect(() => {
    if (!resizeState.isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modalRef.current) return;

      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      const { handle, startWidth, startHeight, startLeft, startTop } = resizeState;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      const minWidth = 600;
      const minHeight = 400;
      const maxWidth = window.innerWidth - 40;
      const maxHeight = window.innerHeight - 40;

      // Handle different resize directions
      if (handle && handle.includes('right')) {
        newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
      }
      if (handle && handle.includes('left')) {
        const widthChange = startWidth - deltaX;
        if (widthChange >= minWidth && widthChange <= maxWidth) {
          newWidth = widthChange;
          newLeft = startLeft + deltaX;
        }
      }
      if (handle && handle.includes('bottom')) {
        newHeight = Math.min(Math.max(startHeight + deltaY, minHeight), maxHeight);
      }
      if (handle && handle.includes('top')) {
        const heightChange = startHeight - deltaY;
        if (heightChange >= minHeight && heightChange <= maxHeight) {
          newHeight = heightChange;
          newTop = startTop + deltaY;
        }
      }

      const newSize = { width: newWidth, height: newHeight };
      setModalSize(newSize);

      // Update position when resizing from left or top
      if (handle && (handle.includes('left') || handle.includes('top'))) {
        setModalPosition({ left: newLeft, top: newTop });
      }
    };

    const handleMouseUp = () => {
      const finalSize = modalSize;
      setResizeState(prev => ({ ...prev, isResizing: false, handle: null }));
      // Save only on mouse up to avoid layout thrashing/lag
      try {
        SafeStorage.setItem('glossary-modal-size', JSON.stringify(finalSize));
      } catch (e) {
        console.warn('Failed to save glossary size:', e);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, modalSize]);

  // Column resize handlers
  const handleColumnResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const listElement = document.querySelector('.glossary-list-container');
    const entryElement = document.querySelector('.glossary-entry-container');

    if (!listElement || !entryElement) return;

    const listRect = listElement.getBoundingClientRect();
    const entryRect = entryElement.getBoundingClientRect();

    setColumnResizeState({
      isResizing: true,
      startX: e.clientX,
      startListWidth: listRect.width,
      startEntryWidth: entryRect.width,
    });
  }, []);

  useEffect(() => {
    if (!columnResizeState.isResizing) return;

    const handleColumnMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.glossary-main-container');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const deltaX = e.clientX - columnResizeState.startX;

      // Calculate new widths maintaining the total width
      const totalWidth = columnResizeState.startListWidth + columnResizeState.startEntryWidth;
      let newListWidth = columnResizeState.startListWidth + deltaX;
      let newEntryWidth = columnResizeState.startEntryWidth - deltaX;

      // Apply minimum widths (10% of container width each for more flexibility)
      const minWidth = containerRect.width * 0.1;
      if (newListWidth < minWidth) {
        newListWidth = minWidth;
        newEntryWidth = totalWidth - minWidth;
      }
      if (newEntryWidth < minWidth) {
        newEntryWidth = minWidth;
        newListWidth = totalWidth - minWidth;
      }

      // Apply the new widths
      const listElement = document.querySelector('.glossary-list-container') as HTMLElement;
      const entryElement = document.querySelector('.glossary-entry-container') as HTMLElement;

      if (listElement && entryElement) {
        listElement.style.width = `${newListWidth}px`;
        entryElement.style.width = `${newEntryWidth}px`;
      }
    };

    const handleColumnMouseUp = () => {
      setColumnResizeState(prev => ({ ...prev, isResizing: false }));
    };

    document.addEventListener('mousemove', handleColumnMouseMove);
    document.addEventListener('mouseup', handleColumnMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleColumnMouseMove);
      document.removeEventListener('mouseup', handleColumnMouseUp);
    };
  }, [columnResizeState]);

  const handleResetLayout = useCallback(() => {
    const defaultSize = { width: 1024, height: 835 };
    setModalSize(defaultSize);
    SafeStorage.removeItem('glossary-modal-size');

    // Reset to centered position
    const left = (window.innerWidth - defaultSize.width) / 2;
    const top = (window.innerHeight - defaultSize.height) / 2;
    setModalPosition({ left, top });

    // Reset column widths
    const listElement = document.querySelector('.glossary-list-container') as HTMLElement;
    const entryElement = document.querySelector('.glossary-entry-container') as HTMLElement;
    if (listElement && entryElement) {
      listElement.style.width = '';
      entryElement.style.width = '';
    }
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (resizeState.isResizing || columnResizeState.isResizing) return;
    if (!modalRef.current || e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, [role="button"], a')) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = modalRef.current.getBoundingClientRect();
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    });
  }, [resizeState.isResizing, columnResizeState.isResizing]);

  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modalRef.current) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const rect = modalRef.current.getBoundingClientRect();

      const minLeft = 20;
      const minTop = 20;
      const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - 20);
      const maxTop = Math.max(minTop, window.innerHeight - rect.height - 20);

      const nextLeft = Math.min(Math.max(dragState.startLeft + deltaX, minLeft), maxLeft);
      const nextTop = Math.min(Math.max(dragState.startTop + deltaY, minTop), maxTop);

      setModalPosition({ left: nextLeft, top: nextTop });
    };

    const handleMouseUp = () => {
      setDragState(prev => ({ ...prev, isDragging: false }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, setModalPosition]);

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
    )
  }

  const renderEntryNode = (entry: GlossaryEntry, level: number): React.ReactElement => {
    const isParent = entry.subEntries && entry.subEntries.length > 0;
    const isExpanded = isParent && expandedParentEntries.has(entry.id);
    const indentClass = `pl-${level * 2}`;
    const hasContentToDisplay = (entry.category === 'Spells' && !isParent) || !!entry.filePath;
    const gate = entry.category === 'Spells' ? gateResults[entry.id] : undefined;
    const disabled = (entry.category === 'Spells' && isParent) || (!hasContentToDisplay && !isParent);
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
              onClick={(e) => { e.stopPropagation(); toggleParentEntry(entry.id); }}
              className={`p-1 text-xs text-gray-400 group-hover:text-sky-300 transition-transform transform ${isExpanded ? 'rotate-90' : ''}`}
              aria-label={isExpanded ? `Collapse ${entry.title}` : `Expand ${entry.title}`}
            >
              ▶
            </button>
          )}
          <button
            type="button"
            onClick={() => handleEntrySelect(entry)}
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
            {entry.subEntries!.map(subEntry => renderEntryNode(subEntry, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 z-50 p-4 overflow-visible"
      aria-modal="true" role="dialog" aria-labelledby="glossary-title"
      onMouseDown={(e) => {
        if (resizeState.isResizing) {
          e.preventDefault();
        }
      }}
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
        {/* Modal resize handles - subtle, appear on hover */}
        {/* Corner grips - small dots that glow on hover */}
        <div
          className="absolute -top-1 -left-1 w-2.5 h-2.5 cursor-nwse-resize rounded-full z-[120] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'top-left')}
          title="Resize"
        />
        <div
          className="absolute -top-1 -right-1 w-2.5 h-2.5 cursor-nesw-resize rounded-full z-[120] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'top-right')}
          title="Resize"
        />
        <div
          className="absolute -bottom-1 -left-1 w-2.5 h-2.5 cursor-nesw-resize rounded-full z-[120] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
          title="Resize"
        />
        <div
          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 cursor-nwse-resize rounded-full z-[120] bg-amber-400/30 hover:bg-amber-400 hover:shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
          title="Resize"
        />

        {/* Edge handles - thin bars that appear on hover */}
        <div
          className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 w-12 h-1 cursor-ns-resize z-[110] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
          title="Resize"
        />
        <div
          className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-12 h-1 cursor-ns-resize z-[110] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
          title="Resize"
        />
        <div
          className="absolute -left-0.5 top-1/2 transform -translate-y-1/2 w-1 h-12 cursor-ew-resize z-[110] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
          title="Resize"
        />
        <div
          className="absolute -right-0.5 top-1/2 transform -translate-y-1/2 w-1 h-12 cursor-ew-resize z-[110] rounded-full bg-amber-400/20 hover:bg-amber-400/80 hover:shadow-[0_0_4px_rgba(251,191,36,0.5)] transition-all duration-200 select-none pointer-events-auto"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
          title="Resize"
        />
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-600">
          <div
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleDragStart}
            title="Drag to move the glossary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M9 4.5a1 1 0 0 1 2 0v2.086l1.293-1.293a1 1 0 1 1 1.414 1.414L12.414 8H14.5a1 1 0 1 1 0 2h-2.086l1.293 1.293a1 1 0 1 1-1.414 1.414L11 11.414V13.5a1 1 0 1 1-2 0v-2.086l-1.293 1.293a1 1 0 0 1-1.414-1.414L7.586 10H5.5a1 1 0 0 1 0-2h2.086L6.293 6.707a1 1 0 0 1 1.414-1.414L9 6.586V4.5Z" />
            </svg>
            <h2 id="glossary-title" className="text-3xl font-bold text-amber-400 font-cinzel">Game Glossary</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Re-check Spells Button */}
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
            <button
              type="button"
              onClick={handleResetLayout}
              className="text-gray-500 hover:text-amber-400 p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              aria-label="Reset layout"
              title="Reset to default size and position"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button type="button" ref={firstFocusableElementRef} onClick={onClose} className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Close glossary">&times;</button>
          </div>
        </div>

        <div className="mb-4">
          <input type="search" placeholder="Search glossary (e.g., Rage, Spell Slot, Expertise)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
            aria-label="Search glossary terms" />
        </div>

        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0 glossary-main-container">
          <div className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0 glossary-list-container" style={{ transition: columnResizeState.isResizing ? 'none' : 'width 0.2s ease' }}>
            {filteredGlossaryIndex.length === 0 && !error && <p className="text-gray-500 italic text-center py-4">No terms match your search.</p>}
            {sortedCategories.map(category => (
              <details key={category} open={expandedCategories.has(category)} className="mb-1">
                <summary className={`p-2 font-semibold cursor-pointer hover:bg-gray-700/50 transition-colors rounded-md text-lg list-none flex justify-between items-center ${getCategoryColor(category)}`}
                  onClick={(e) => { e.preventDefault(); toggleCategory(category); }}>
                  <span className="flex items-center">
                    {getCategoryIcon(category)}
                    {category} ({groupedEntries[category]?.length || 0})
                  </span>
                  <span className={`ml-2 transform transition-transform duration-150 ${expandedCategories.has(category) ? 'rotate-90' : ''}`}>▶</span>
                </summary>
                {(expandedCategories.has(category)) && (
                  <ul className="space-y-px pl-1 pt-1">
                    {groupedEntries[category]?.sort((a, b) => a.title.localeCompare(b.title)).map(entry => (
                      renderEntryNode(entry, 1)
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>

          {/* Column resize grabber - subtle divider that glows on hover */}
          <div
            className="w-1 cursor-col-resize self-stretch flex items-center justify-center group"
            onMouseDown={handleColumnResizeStart}
            title="Drag to resize columns"
          >
            <div className="w-0.5 h-16 rounded-full bg-amber-400/30 group-hover:bg-amber-400/80 group-hover:shadow-[0_0_6px_rgba(251,191,36,0.5)] transition-all duration-200" />
          </div>

          <div className="flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-y-auto scrollable-content glossary-entry-container" style={{ transition: columnResizeState.isResizing ? 'none' : 'width 0.2s ease' }}>
            {selectedEntry ? (
              <>
                {/* Breadcrumb navigation */}
                <Breadcrumb
                  category={selectedEntry.category}
                  parentPath={breadcrumbPath.parents}
                  currentTitle={selectedEntry.title}
                  onNavigateToCategory={() => {
                    if (!expandedCategories.has(selectedEntry.category)) {
                      setExpandedCategories(prev => new Set(prev).add(selectedEntry.category));
                    }
                  }}
                  onNavigateToParent={(index) => {
                    const parentId = breadcrumbPath.parentIds[index];
                    if (parentId) {
                      handleNavigateToGlossary(parentId);
                    }
                  }}
                />
                {selectedEntry.category === 'Spells' ? (
                  spellJsonLoading ? (
                    <p className="text-gray-400 italic">Loading spell data...</p>
                  ) : spellJsonData ? (
                    <SpellCardTemplate spell={spellJsonData} />
                  ) : (
                    <div className="text-red-400">
                      <p>Failed to load JSON for this spell.</p>
                      <p className="text-sm text-gray-500 mt-2">JSON file may not exist at: /data/spells/level-{gateResults[selectedEntry.id]?.level ?? '?'}/{selectedEntry.id}.json</p>
                    </div>
                  )
                ) : (
                  <FullEntryDisplay entry={selectedEntry} onNavigate={handleNavigateToGlossary} />
                )}
                {selectedEntry.category === 'Spells' && gateResults[selectedEntry.id] && (
                  <div className="mt-4 p-3 border border-gray-700 rounded bg-gray-900/70 text-sm">
                    <div className="font-semibold mb-2 text-gray-200">Spell Gate Checks: {selectedEntry.title}</div>
                    <ul className="space-y-1 text-gray-300">
                      {(() => {
                        const gate = gateResults[selectedEntry.id];
                        const checks = [
                          { label: "Manifest path under correct level", ok: gate.checklist.manifestPathOk },
                          { label: "Spell JSON exists", ok: gate.checklist.spellJsonExists },
                          { label: "Spell JSON passes schema", ok: gate.checklist.spellJsonValid },
                          { label: "No known behavior gaps", ok: gate.checklist.noKnownGaps },
                        ];
                        return checks.map((c, idx) => {
                          const pass = c.ok;
                          return (
                            <li key={idx} className="flex items-center gap-2">
                              <span className={`inline-block w-4 text-center ${pass ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pass ? '✓' : '✕'}
                              </span>
                              <span>{c.label}</span>
                            </li>
                          );
                        });
                      })()}
                      {gateResults[selectedEntry.id].status === 'gap' && (
                        <li className="text-amber-300 mt-1">Marked as a gap: This spell has engine-level limitations in the combat system.</li>
                      )}
                      {gateResults[selectedEntry.id].gapAnalysis && (
                        <div className="mt-2 text-xs border-t border-gray-700 pt-2">
                          <div className="text-gray-400 uppercase tracking-tighter font-bold">Audit Status</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gateResults[selectedEntry.id].gapAnalysis!.state === 'analyzed_clean' ? 'bg-emerald-900 text-emerald-300' :
                              gateResults[selectedEntry.id].gapAnalysis!.state === 'analyzed_with_gaps' ? 'bg-amber-900 text-amber-300' :
                                'bg-gray-700 text-gray-400'
                              }`}>
                              {gateResults[selectedEntry.id].gapAnalysis!.state.replace('_', ' ')}
                            </span>
                            <span className="text-gray-500 italic">Last Audit: {gateResults[selectedEntry.id].gapAnalysis!.lastAuditDate || 'Never'}</span>
                          </div>
                          {gateResults[selectedEntry.id].gapAnalysis!.notes && (
                            <p className="mt-1.5 text-gray-400 line-clamp-3 hover:line-clamp-none transition-all">{gateResults[selectedEntry.id].gapAnalysis!.notes}</p>
                          )}
                        </div>
                      )}
                      {gateResults[selectedEntry.id].status === 'fail' && gateResults[selectedEntry.id].reasons.length > 0 && (
                        <li className="text-red-300 mt-1">Issues: {gateResults[selectedEntry.id].reasons.join('; ')}</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 italic text-center py-10">Select an entry to view its details or use the search bar.</p>
            )}
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-600 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {lastGenerated && (
              <span className="text-xs text-gray-500">
                Index last generated: {new Date(lastGenerated).toLocaleString()}
              </span>
            )}
            <span className="text-xs text-gray-600 hidden md:inline">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 ml-0.5">↓</kbd>
              <span className="ml-1">navigate</span>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 ml-2">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 ml-0.5">→</kbd>
              <span className="ml-1">expand/collapse</span>
            </span>
          </div>
          <button type="button" onClick={onClose} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow" aria-label="Close glossary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default Glossary;
