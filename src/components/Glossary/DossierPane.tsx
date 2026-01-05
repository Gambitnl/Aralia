
/**
 * @file DossierPane.tsx
 * This component displays the player's "Dossier" (formerly Logbook),
 * showing details about NPCs they have met and their relationships.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { GameState, NPC, SuspicionLevel, GoalStatus } from '../types';

interface DossierPaneProps {
  isOpen: boolean;
  onClose: () => void;
  metNpcIds: string[];
  npcMemory: GameState['npcMemory'];
  allNpcs: Record<string, NPC>;
}

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const panelMotion: MotionProps = {
  initial: { y: -30, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -30, opacity: 0 },
};

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
        default: return { label: 'Unknown', colorClass: 'text-gray-500' };
    }
};

const DossierPane: React.FC<DossierPaneProps> = ({ isOpen, onClose, metNpcIds, npcMemory, allNpcs }) => {
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const metNpcs = useMemo(() => {
    return metNpcIds.map(id => allNpcs[id]).filter((npc): npc is NPC => !!npc);
  }, [metNpcIds, allNpcs]);

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


  if (!isOpen) return null;

  const selectedNpc = selectedNpcId ? allNpcs[selectedNpcId] : null;
  const selectedNpcMemory = selectedNpcId ? npcMemory[selectedNpcId] : null;

  return (
    <motion.div
      {...overlayMotion}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true" role="dialog" aria-labelledby="dossier-title"
    >
      <motion.div
        {...panelMotion}
        className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700">
          <div className="flex gap-4 items-baseline">
              <h2 id="dossier-title" className="text-3xl font-bold text-amber-400 font-cinzel">Dossiers</h2>
          </div>
          <button ref={closeButtonRef} onClick={onClose} className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Close Dossier">&times;</button>
        </div>

        {/* Main Content */}
        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
          {/* Left Pane: NPC List */}
          <div className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0">
            {metNpcs.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">You haven&apos;t spoken to anyone yet.</p>
            ) : (
                <ul className="space-y-1">
                {metNpcs.map(npc => (
                    <li key={npc.id}>
                    <button
                        onClick={() => setSelectedNpcId(npc.id)}
                        className={`w-full text-left p-2.5 rounded-md transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-sky-400
                                    ${selectedNpcId === npc.id ? 'bg-sky-700 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600/70 text-gray-300'}`}
                    >
                        <span className="font-semibold">{npc.name}</span>
                    </button>
                    </li>
                ))}
                </ul>
            )}
          </div>

          {/* Right Pane: Dossier Detail */}
          <div className="flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-y-auto scrollable-content">
            {selectedNpc && selectedNpcMemory ? (
              <article>
                <h3 className="text-2xl font-semibold text-amber-300 mb-2 font-cinzel">{selectedNpc.name}</h3>
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
                    <p className="text-gray-500 italic text-sm">You have no significant history with this person.</p>
                )}
              </article>
            ) : (
              <p className="text-gray-500 italic text-center py-10">Select a character to view their dossier.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DossierPane;
