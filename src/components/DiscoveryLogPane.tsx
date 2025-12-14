/**
 * @file DiscoveryLogPane.tsx
 * This component displays the player's discovery journal in a modal.
 * It allows browsing, filtering, and searching of discovered entries.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState, DiscoveryEntry, DiscoveryType, DiscoveryFlag, DiscoverySource, NPC, KnownFact } from '../types';
import { formatGameDate, formatGameDateTime } from '@/utils/timeUtils';
import Tooltip from './Tooltip';

interface DiscoveryLogPaneProps {
  isOpen: boolean;
  entries: DiscoveryEntry[];
  unreadCount: number; // For potential future use, though not directly displayed in this pane
  onClose: () => void;
  onMarkRead: (entryId: string) => void;
  onMarkAllRead: () => void;
  npcMemory: GameState['npcMemory'];
  allNpcs: Record<string, NPC>;
  // onUpdateRequestInLog: (payload: { questId: string; newStatus: string; newContent?: string }) => void; // For future use
}

type SortOrder = 'newest' | 'oldest' | 'title_asc' | 'title_desc';

const DiscoveryLogPane: React.FC<DiscoveryLogPaneProps> = ({
  isOpen,
  entries,
  onClose,
  onMarkRead,
  onMarkAllRead,
  npcMemory,
  allNpcs,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<DiscoveryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<DiscoveryType | 'ALL'>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      firstFocusableElementRef.current?.focus();
      // If opening and an entry was previously selected, try to re-select it or select first
      if (selectedEntry && !entries.find(e => e.id === selectedEntry.id)) {
         setSelectedEntry(filteredAndSortedEntries.length > 0 ? filteredAndSortedEntries[0] : null);
      } else if (!selectedEntry && filteredAndSortedEntries.length > 0) {
         setSelectedEntry(filteredAndSortedEntries[0]);
         if(filteredAndSortedEntries[0] && !filteredAndSortedEntries[0].isRead) {
           onMarkRead(filteredAndSortedEntries[0].id);
         }
      }
    }
  }, [isOpen]);

  const handleEntrySelect = (entry: DiscoveryEntry) => {
    setSelectedEntry(entry);
    if (!entry.isRead) {
      onMarkRead(entry.id);
    }
  };
  
  const filteredAndSortedEntries = useMemo(() => {
    let processedEntries = [...entries];

    // Filter by type
    if (filterType !== 'ALL') {
      processedEntries = processedEntries.filter(entry => entry.type === filterType);
    }

    // Filter by search term (case-insensitive search in title and content)
    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      processedEntries = processedEntries.filter(entry =>
        entry.title.toLowerCase().includes(lowerSearchTerm) ||
        entry.content.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Sort
    switch (sortOrder) {
      case 'oldest':
        processedEntries.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case 'title_asc':
        processedEntries.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title_desc':
        processedEntries.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'newest':
      default:
        processedEntries.sort((a, b) => b.timestamp - a.timestamp);
        break;
    }
    return processedEntries;
  }, [entries, filterType, searchTerm, sortOrder]);

  useEffect(() => {
    // If no entry is selected or the selected one is no longer in the filtered list, select the first one.
    if (filteredAndSortedEntries.length > 0) {
      if (!selectedEntry || !filteredAndSortedEntries.find(e => e.id === selectedEntry.id)) {
        const firstEntry = filteredAndSortedEntries[0];
        setSelectedEntry(firstEntry);
        if (firstEntry && !firstEntry.isRead) {
          // No onMarkRead call here, as it's an automatic selection.
          // Marking read should happen on explicit click via handleEntrySelect.
        }
      }
    } else {
      setSelectedEntry(null); // No entries match filter/search
    }
  }, [filteredAndSortedEntries, selectedEntry]);


  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  const consequences = useMemo(() => {
    if (!selectedEntry || !npcMemory) return [];

    const foundConsequences: { npc: NPC; fact: KnownFact }[] = [];
    for (const npcId in npcMemory) {
      const memory = npcMemory[npcId];
      const relevantFact = memory.knownFacts.find(
        (fact) => fact.sourceDiscoveryId === selectedEntry.id
      );
      if (relevantFact) {
        const npc = allNpcs[npcId];
        if (npc) {
          foundConsequences.push({ npc, fact: relevantFact });
        }
      }
    }
    return foundConsequences;
  }, [selectedEntry, npcMemory, allNpcs]);


  if (!isOpen) {
    return null;
  }

  const discoveryTypeOptions = Object.values(DiscoveryType);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="discovery-log-title"
    >
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700">
          <h2 id="discovery-log-title" className="text-3xl font-bold text-amber-400 font-cinzel">
            Discovery Log
          </h2>
          <button
            ref={firstFocusableElementRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-md"
            aria-label="Close journal"
          >
            &times;
          </button>
        </div>

        {/* Controls: Search, Filter, Sort */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label htmlFor="journalSearch" className="block text-sm font-medium text-sky-300 mb-1">Search</label>
            <input
              type="text"
              id="journalSearch"
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
          </div>
          <div>
            <label htmlFor="journalFilterType" className="block text-sm font-medium text-sky-300 mb-1">Filter by Type</label>
            <select
              id="journalFilterType"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DiscoveryType | 'ALL')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none scrollable-content"
            >
              <option value="ALL">All Types</option>
              {discoveryTypeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
           <div>
            <label htmlFor="journalSortOrder" className="block text-sm font-medium text-sky-300 mb-1">Sort by</label>
            <select
              id="journalSortOrder"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title_asc">Title (A-Z)</option>
              <option value="title_desc">Title (Z-A)</option>
            </select>
          </div>
        </div>


        {/* Main Content: List and Detail Panes */}
        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
          {/* Left Pane: Entry List */}
          <div ref={listContainerRef} className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0">
            {filteredAndSortedEntries.length === 0 ? (
                 <p className="text-gray-500 italic text-center py-4">No entries match your criteria.</p>
            ) : (
                <ul className="space-y-1">
                {filteredAndSortedEntries.map(entry => (
                    <li key={entry.id}>
                    <button
                        onClick={() => handleEntrySelect(entry)}
                        className={`w-full text-left p-2.5 rounded-md transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-sky-400
                                    ${selectedEntry?.id === entry.id ? 'bg-sky-700 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600/70 text-gray-300'}`}
                    >
                        <div className="flex items-center">
                        {!entry.isRead && (
                            <Tooltip content="Unread">
                                <span className="w-2 h-2 bg-amber-400 rounded-full mr-2 flex-shrink-0" aria-label="Unread entry"></span>
                            </Tooltip>
                        )}
                        <span className={`flex-grow truncate ${!entry.isRead ? 'font-semibold' : ''}`}>{entry.title}</span>
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">{entry.type} - {formatGameDate(new Date(entry.timestamp))}</span>
                    </button>
                    </li>
                ))}
                </ul>
            )}
          </div>

          {/* Right Pane: Entry Detail */}
          <div className="flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-y-auto scrollable-content">
            {selectedEntry ? (
              <article>
                <h3 className="text-2xl font-semibold text-amber-300 mb-2 font-cinzel tracking-wide">{selectedEntry.title}</h3>
                <div className="text-xs text-gray-500 mb-3 space-x-3">
                  <span><strong className="text-gray-400">Type:</strong> {selectedEntry.type}</span>
                  <span><strong className="text-gray-400">Logged:</strong> {formatGameDateTime(new Date(selectedEntry.timestamp))}</span>
                  <span><strong className="text-gray-400">In-Game Time:</strong> {selectedEntry.gameTime}</span>
                </div>
                {selectedEntry.source && (
                    <p className="text-xs text-gray-500 mb-3">
                        <strong className="text-gray-400">Source:</strong> {selectedEntry.source.type}
                        {selectedEntry.source.name && ` - ${selectedEntry.source.name}`}
                        {selectedEntry.source.id && ` (ID: ${selectedEntry.source.id})`}
                    </p>
                )}
                {selectedEntry.flags && selectedEntry.flags.length > 0 && (
                    <div className="mb-3 text-xs">
                        <strong className="text-gray-400">Tags:</strong>
                        {selectedEntry.flags.map(flag => (
                            <span key={`${flag.key}-${flag.value}`} className="ml-1.5 inline-block bg-sky-800 text-sky-200 px-1.5 py-0.5 rounded-full text-[10px]">
                                {flag.label || `${flag.key}: ${flag.value}`}
                            </span>
                        ))}
                    </div>
                )}
                 {selectedEntry.isQuestRelated && (
                    <p className="text-xs text-yellow-400 italic mb-3">
                        Related to Quest: {selectedEntry.questId || 'Unknown Quest'} (Status: {selectedEntry.questStatus || 'N/A'})
                    </p>
                )}


                <div className="prose prose-sm prose-invert max-w-none text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selectedEntry.content}
                </div>
                
                {consequences.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                        <h4 className="text-lg font-semibold text-sky-300 mb-2">Consequences</h4>
                        <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                        {consequences.map(({ npc, fact }) => (
                            <li key={fact.id}>
                            <strong>{npc.name}</strong> learned that: <em>"{fact.text}"</em>
                            <span className="text-xs text-gray-500 ml-2">
                                ({fact.source === 'gossip' ? `Heard from ${allNpcs[fact.sourceNpcId!]?.name || 'a traveler'}` : 'Learned directly'})
                            </span>
                            </li>
                        ))}
                        </ul>
                    </div>
                )}
              </article>
            ) : (
              <p className="text-gray-500 italic text-center py-10">Select an entry to view its details.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={onMarkAllRead}
            disabled={entries.every(e => e.isRead)}
            className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark All as Read
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
          >
            Close Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiscoveryLogPane;