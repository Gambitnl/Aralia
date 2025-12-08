import React, { useEffect, useRef, useState, useCallback, useContext, useMemo } from 'react';
import GlossaryContext from '../context/GlossaryContext'; 
import { GlossaryEntry } from '../types';
import { FullEntryDisplay } from './Glossary/FullEntryDisplay';
import { findGlossaryEntryAndPath } from '../utils/glossaryUtils';
import { useSpellGateChecks } from '../hooks/useSpellGateChecks';

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

const Glossary: React.FC<GlossaryProps> = ({ isOpen, onClose, initialTermId }) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const glossaryIndex = useContext(GlossaryContext); 
  const gateResults = useSpellGateChecks(glossaryIndex);
  
  const [selectedEntry, setSelectedEntry] = useState<GlossaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null); 
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedParentEntries, setExpandedParentEntries] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  const entryRefs = useRef<Record<string, HTMLLIElement | HTMLButtonElement | null>>({});
  
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

  const handleEntrySelect = useCallback((entry: GlossaryEntry) => {
    setSelectedEntry(entry);
    if(entry.subEntries && entry.subEntries.length > 0) { 
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

  const toggleParentEntry = (entryId: string) => {
    setExpandedParentEntries(prev => {
      const newSet = new Set(prev);
      newSet.has(entryId) ? newSet.delete(entryId) : newSet.add(entryId);
      return newSet;
    });
  };
  
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
    const hasContentToDisplay = !!entry.filePath;
    const gate = entry.category === 'Spells' ? gateResults[entry.id] : undefined;
    const disabled = (!hasContentToDisplay && !isParent); // allow selection even if gate fails to view details
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
      <li key={entry.id} ref={el => { entryRefs.current[entry.id] = el; }} role="treeitem" aria-expanded={isParent ? isExpanded : undefined} aria-selected={selectedEntry?.id === entry.id}>
        <div
          className={`flex items-center rounded-md transition-colors text-sm group
                      ${selectedEntry?.id === entry.id ? 'bg-sky-700 text-white' : 'hover:bg-gray-700/60 text-gray-300'}`}
        >
          {isParent && (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleParentEntry(entry.id); }} 
              className={`p-1 text-xs text-gray-400 group-hover:text-sky-300 transition-transform transform ${isExpanded ? 'rotate-90' : ''}`}
              aria-label={isExpanded ? `Collapse ${entry.title}` : `Expand ${entry.title}`}
            >
              ▶
            </button>
          )}
          <button
            onClick={() => handleEntrySelect(entry)}
            className={`w-full text-left px-2 py-1.5 ${indentClass} ${isParent && !isExpanded && selectedEntry?.id === entry.id ? 'font-semibold' : ''} ${!isParent && selectedEntry?.id === entry.id ? 'font-semibold' : ''}`}
            disabled={disabled}
            title={gateLabel || entry.title}
          >
            {entry.title}
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
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      aria-modal="true" role="dialog" aria-labelledby="glossary-title"
    >
      <div className="bg-gray-900 text-gray-200 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-600">
          <h2 id="glossary-title" className="text-3xl font-bold text-amber-400 font-cinzel">Game Glossary</h2>
          <button ref={firstFocusableElementRef} onClick={onClose} className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Close glossary">&times;</button>
        </div>
        
        <div className="mb-4">
          <input type="search" placeholder="Search glossary (e.g., Rage, Spell Slot, Expertise)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
            aria-label="Search glossary terms" />
        </div>

        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
          <div className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0" role="tree" aria-label="Glossary Categories and Terms">
            {filteredGlossaryIndex.length === 0 && !error && <p className="text-gray-500 italic text-center py-4">No terms match your search.</p>}
            {sortedCategories.map(category => (
              <details key={category} open={expandedCategories.has(category)} className="mb-1" role="group">
                <summary className="p-2 font-semibold text-sky-300 cursor-pointer hover:bg-gray-700/50 transition-colors rounded-md text-lg list-none flex justify-between items-center"
                    onClick={(e) => { e.preventDefault(); toggleCategory(category); }}>
                  {category} ({groupedEntries[category]?.length || 0})
                  <span className={`ml-2 transform transition-transform duration-150 ${expandedCategories.has(category) ? 'rotate-90' : ''}`}>▶</span>
                </summary>
                {(expandedCategories.has(category)) && (
                  <ul className="space-y-px pl-1 pt-1">
                    {groupedEntries[category]?.sort((a,b) => a.title.localeCompare(b.title)).map(entry => (
                      renderEntryNode(entry, 1)
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>

          <div className="flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-y-auto scrollable-content">
            {selectedEntry ? (
                <>
                  <FullEntryDisplay entry={selectedEntry} onNavigate={handleNavigateToGlossary} />
                  {selectedEntry.category === 'Spells' && gateResults[selectedEntry.id] && (
                    <div className="mt-4 p-3 border border-gray-700 rounded bg-gray-900/70 text-sm">
                      <div className="font-semibold mb-2 text-gray-200">Spell Gate Checks</div>
                      <ul className="space-y-1 text-gray-300">
                        {(() => {
                          const gate = gateResults[selectedEntry.id];
                          const checks = [
                            { label: "Manifest path under correct level", ok: gate.checklist.manifestPathOk },
                            { label: "Glossary card exists", ok: gate.checklist.glossaryExists },
                            { label: "Glossary card has level tag", ok: gate.checklist.levelTagOk },
                            { label: "Known gap (allowed)", ok: gate.checklist.knownGap, invert: true },
                          ];
                          return checks.map((c, idx) => {
                            const pass = c.invert ? !c.ok : c.ok;
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
                          <li className="text-amber-300 mt-1">Known schema gap logged; content allowed but not fully structured.</li>
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
         <div className="mt-6 pt-4 border-t border-gray-600 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow" aria-label="Close glossary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default Glossary;
