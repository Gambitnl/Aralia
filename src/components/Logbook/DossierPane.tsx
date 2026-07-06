
/**
 * @file DossierPane.tsx
 * This component displays the player's "Dossier" (formerly Logbook),
 * showing details about NPCs they have met and their relationships.
 *
 * The logbook modal opens this pane when the player wants to review social
 * memory: who they have met, what those people want, and what facts each NPC
 * remembers. It keeps long NPC lists paged so the game can grow without making
 * the dossier unusable, and it preserves a split-pane reading layout on wide
 * screens while giving cramped windows a single scroll path.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState, NPC, SuspicionLevel, GoalStatus } from '../../types';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface DossierPaneProps {
  isOpen: boolean;
  onClose: () => void;
  metNpcIds: string[];
  npcMemory: GameState['npcMemory'];
  allNpcs: Record<string, NPC>;
}

const DOSSIER_LIST_PAGE_SIZE = 25;

const getDispositionDetails = (score: number): { label: string; colorClass: string } => {
  if (score > 80) return { label: 'Adored', colorClass: 'text-green-300' };
  if (score > 40) return { label: 'Friendly', colorClass: 'text-green-400' };
  if (score > -41) return { label: 'Neutral', colorClass: 'text-gray-300' };
  if (score > -81) return { label: 'Unfriendly', colorClass: 'text-yellow-400' };
  return { label: 'Hostile', colorClass: 'text-red-400' };
};

const getSuspicionDetails = (level: SuspicionLevel): { label: string; colorClass: string } => {
    switch(level) {
        case SuspicionLevel.Suspicious: return { label: 'Suspicious', colorClass: 'text-yellow-400' };
        case SuspicionLevel.Alert: return { label: 'Alert', colorClass: 'text-red-400' };
        case SuspicionLevel.Unaware:
        default: return { label: 'Unaware', colorClass: 'text-gray-400' };
    }
};

const getGoalStatusDetails = (status: GoalStatus): { label: string; colorClass: string } => {
    switch(status) {
        case GoalStatus.Completed: return { label: 'Completed', colorClass: 'text-green-400' };
        case GoalStatus.Failed: return { label: 'Failed', colorClass: 'text-red-400' };
        case GoalStatus.Active: return { label: 'Active', colorClass: 'text-yellow-300' };
        default: return { label: 'Unknown', colorClass: 'text-gray-400' };
    }
};

const DossierPane: React.FC<DossierPaneProps> = ({ isOpen, onClose, metNpcIds, npcMemory, allNpcs }) => {
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const detailPaneRef = useRef<HTMLDivElement>(null);

  const metNpcs = useMemo(() => {
    return metNpcIds.map(id => allNpcs[id]).filter((npc): npc is NPC => !!npc);
  }, [metNpcIds, allNpcs]);

  const totalPages = Math.max(1, Math.ceil(metNpcs.length / DOSSIER_LIST_PAGE_SIZE));
  const pagedNpcs = useMemo(() => {
    // Keep the dossier list bounded per page so campaigns with many met NPCs
    // do not render the entire memory index at once.
    const pageStart = (currentPage - 1) * DOSSIER_LIST_PAGE_SIZE;
    return metNpcs.slice(pageStart, pageStart + DOSSIER_LIST_PAGE_SIZE);
  }, [currentPage, metNpcs]);

  useEffect(() => {
    // If the set of met NPCs changes, keep the current page within the
    // available dossier pages instead of showing an empty page.
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (isOpen) {
      if ((!selectedNpcId || !metNpcIds.includes(selectedNpcId)) && metNpcs.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedNpcId(metNpcs[0].id);
      }
      closeButtonRef.current?.focus();
    }
  }, [isOpen, metNpcs, selectedNpcId, metNpcIds]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleNpcSelect = (npcId: string) => {
    setSelectedNpcId(npcId);

    // Cramped windows stack the NPC list above the detail card. Move the shared
    // scroll container to the detail card after a player chooses someone so the
    // selection has immediate visible feedback instead of staying buried below
    // the list.
    if (window.innerWidth < 768) {
      window.requestAnimationFrame(() => {
        const mainContainer = mainContainerRef.current;
        const detailPane = detailPaneRef.current;

        if (!mainContainer || !detailPane) return;

        mainContainer.scrollTo({
          top: detailPane.offsetTop - mainContainer.offsetTop,
          behavior: 'smooth',
        });
      });
    }
  };

  if (!isOpen) return null;

  const selectedNpc = selectedNpcId ? allNpcs[selectedNpcId] : null;
  const selectedNpcMemory = selectedNpcId ? npcMemory[selectedNpcId] : null;

  return (
    <WindowFrame
      title="Dossiers"
      onClose={onClose}
      storageKey={WINDOW_KEYS.DOSSIER}
      initialMaximized={false}
    >
      <div className="flex flex-col h-full p-6">
        {/* Main Content */}
        <div
          ref={mainContainerRef}
          className="flex-grow flex flex-col md:flex-row gap-4 overflow-y-auto pb-28 pr-1 scrollable-content md:overflow-hidden md:pb-0 md:pr-0 min-h-0"
        >
          {/* Left Pane: NPC List */}
          <div data-testid="dossier-npc-list" className="md:w-1/3 max-h-72 md:max-h-none border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-hidden flex-shrink-0 flex flex-col min-h-0">
            {metNpcs.length === 0 ? (
                <p className="text-gray-400 italic text-center py-4">You haven&apos;t spoken to anyone yet.</p>
            ) : (
                <>
                  <ul className="space-y-1 flex-grow overflow-y-auto scrollable-content min-h-0">
                  {pagedNpcs.map(npc => (
                      <li key={npc.id}>
                      <button
                          onClick={() => handleNpcSelect(npc.id)}
                          className={`min-h-11 w-full rounded-md p-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400
                                      ${selectedNpcId === npc.id ? 'bg-sky-700 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600/70 text-gray-300'}`}
                      >
                          <span className="font-semibold">{npc.name}</span>
                      </button>
                      </li>
                  ))}
                  </ul>
                  {totalPages > 1 && (
                    <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between gap-2 text-xs text-gray-300">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        className="min-h-11 rounded bg-gray-700 px-3 py-2 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span aria-live="polite">Page {currentPage} of {totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                        disabled={currentPage === totalPages}
                        className="min-h-11 rounded bg-gray-700 px-3 py-2 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
            )}
          </div>

          {/* Right Pane: Dossier Detail */}
          <div
            ref={detailPaneRef}
            className="flex-shrink-0 md:flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-visible md:overflow-y-auto scrollable-content"
          >
            {selectedNpc && selectedNpcMemory ? (
              <article>
                <h3 className="text-xl sm:text-2xl font-semibold text-amber-300 mb-2 font-cinzel break-words leading-snug">{selectedNpc.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-4">
                    <p><strong>Disposition:</strong> <span className={`font-bold ${getDispositionDetails(selectedNpcMemory.disposition).colorClass}`}>{getDispositionDetails(selectedNpcMemory.disposition).label}</span></p>
                    <p><strong>Suspicion:</strong> <span className={`font-bold ${getSuspicionDetails(selectedNpcMemory.suspicion).colorClass}`}>{getSuspicionDetails(selectedNpcMemory.suspicion).label}</span></p>
                </div>

                {selectedNpcMemory.goals && selectedNpcMemory.goals.length > 0 && (
                    <>
                        <h4 className="text-lg font-semibold text-sky-300 mt-4 mb-2 border-b border-sky-800 pb-1">Known Goals</h4>
                        <ul className="space-y-3 text-gray-300 text-sm">
                            {selectedNpcMemory.goals.map((goal) => {
                                const statusDetails = getGoalStatusDetails(goal.status);
                                return (
                                    <li key={goal.id} className="pl-2">
                                        <p>{goal.description}</p>
                                        <p className="text-xs">
                                            Status: <span className={`font-semibold ${statusDetails.colorClass}`}>{statusDetails.label}</span>
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}

                <h4 className="text-lg font-semibold text-sky-300 mt-4 mb-2 border-b border-sky-800 pb-1">Chronicle</h4>
                {selectedNpcMemory.knownFacts.length > 0 ? (
                    <ul className="list-disc list-inside space-y-2 text-gray-300 text-sm">
                        {[...selectedNpcMemory.knownFacts].sort((a,b) => b.timestamp - a.timestamp).map((fact) => (
                            <li key={fact.id} className="pl-2">
                                {fact.source === 'gossip' ? (
                                    <span className="italic text-gray-400">
                                        (Heard from {allNpcs[fact.sourceNpcId!]?.name || 'a traveler'}): &quot;{fact.text}&quot;
                                    </span>
                                ) : (
                                    <span>{fact.text}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-400 italic text-sm">You have no significant history with this person.</p>
                )}
              </article>
            ) : (
              <p className="text-gray-400 italic text-center py-10">Select a character to view their dossier.</p>
            )}
          </div>
        </div>

      </div>
    </WindowFrame>
  );
};

export default DossierPane;
