
/**
 * @file LogbookPane.tsx
 * This component displays the player's character logbook in a modal,
 * showing details about NPCs they have met and tracking Quests.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState, NPC, SuspicionLevel, Goal, GoalStatus, KnownFact, Quest, QuestStatus } from '../types';

interface LogbookPaneProps {
  isOpen: boolean;
  onClose: () => void;
  metNpcIds: string[];
  npcMemory: GameState['npcMemory'];
  allNpcs: Record<string, NPC>;
  questLog?: Quest[];
}

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

const getQuestStatusDetails = (status: QuestStatus): { label: string; colorClass: string } => {
    switch(status) {
        case QuestStatus.Completed: return { label: 'Completed', colorClass: 'text-green-400' };
        case QuestStatus.Failed: return { label: 'Failed', colorClass: 'text-red-400' };
        case QuestStatus.Active: return { label: 'Active', colorClass: 'text-amber-300' };
        default: return { label: 'Unknown', colorClass: 'text-gray-500' };
    }
};


const LogbookPane: React.FC<LogbookPaneProps> = ({ isOpen, onClose, metNpcIds, npcMemory, allNpcs, questLog = [] }) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'quests'>('characters');
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const metNpcs = useMemo(() => {
    return metNpcIds.map(id => allNpcs[id]).filter((npc): npc is NPC => !!npc);
  }, [metNpcIds, allNpcs]);

  const sortedQuests = useMemo(() => {
    return [...questLog].sort((a, b) => {
        if (a.status === QuestStatus.Active && b.status !== QuestStatus.Active) return -1;
        if (a.status !== QuestStatus.Active && b.status === QuestStatus.Active) return 1;
        return b.dateStarted - a.dateStarted;
    });
  }, [questLog]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'characters' && (!selectedNpcId || !metNpcIds.includes(selectedNpcId)) && metNpcs.length > 0) {
        setSelectedNpcId(metNpcs[0].id);
      } else if (activeTab === 'quests' && (!selectedQuestId || !questLog.find(q => q.id === selectedQuestId)) && sortedQuests.length > 0) {
        setSelectedQuestId(sortedQuests[0].id);
      }
      closeButtonRef.current?.focus();
    }
  }, [isOpen, activeTab, metNpcs, selectedNpcId, metNpcIds, selectedQuestId, questLog, sortedQuests]);
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);


  if (!isOpen) return null;
  
  const renderCharacterView = () => {
      const selectedNpc = selectedNpcId ? allNpcs[selectedNpcId] : null;
      const selectedNpcMemory = selectedNpcId ? npcMemory[selectedNpcId] : null;

      return (
        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
          {/* Left Pane: NPC List */}
          <div className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0">
            {metNpcs.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">You haven't spoken to anyone yet.</p>
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

          {/* Right Pane: Dossier */}
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
                                        (Heard from {allNpcs[fact.sourceNpcId!]?.name || 'a traveler'}): "{fact.text}"
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
      );
  };

  const renderQuestView = () => {
      const selectedQuest = selectedQuestId ? sortedQuests.find(q => q.id === selectedQuestId) : null;

      return (
        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
          {/* Left Pane: Quest List */}
          <div className="md:w-1/3 border border-gray-700 rounded-lg bg-gray-800/50 p-2 overflow-y-auto scrollable-content flex-shrink-0">
            {sortedQuests.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">Your quest log is empty.</p>
            ) : (
                <ul className="space-y-1">
                {sortedQuests.map(quest => {
                    const statusDetails = getQuestStatusDetails(quest.status);
                    return (
                        <li key={quest.id}>
                        <button
                            onClick={() => setSelectedQuestId(quest.id)}
                            className={`w-full text-left p-2.5 rounded-md transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-sky-400
                                        ${selectedQuestId === quest.id ? 'bg-sky-700 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600/70 text-gray-300'}`}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-semibold truncate pr-2">{quest.title}</span>
                                <span className={`text-xs ${statusDetails.colorClass} font-bold uppercase tracking-wider`}>{quest.status}</span>
                            </div>
                            <span className="text-xs text-gray-500 block mt-0.5">{allNpcs[quest.giverId]?.name || 'Unknown'}</span>
                        </button>
                        </li>
                    );
                })}
                </ul>
            )}
          </div>

          {/* Right Pane: Quest Detail */}
          <div className="flex-grow md:w-2/3 border border-gray-700 rounded-lg bg-gray-800/50 p-4 overflow-y-auto scrollable-content">
            {selectedQuest ? (
              <article>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-semibold text-amber-300 font-cinzel">{selectedQuest.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getQuestStatusDetails(selectedQuest.status).colorClass} bg-gray-900 border border-gray-600`}>
                        {selectedQuest.status}
                    </span>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">
                    Provided by: <span className="text-sky-300 font-semibold">{allNpcs[selectedQuest.giverId]?.name || 'Unknown'}</span>
                </p>
                
                <div className="bg-gray-900/40 p-3 rounded border border-gray-600/50 mb-6">
                    <p className="text-gray-300 text-sm italic">"{selectedQuest.description}"</p>
                </div>

                <h4 className="text-lg font-semibold text-sky-300 mb-2 border-b border-sky-800 pb-1">Objectives</h4>
                <ul className="space-y-2 mb-6">
                    {selectedQuest.objectives.map(obj => (
                        <li key={obj.id} className="flex items-start gap-2">
                             <span className={`mt-1 text-lg ${obj.isCompleted ? 'text-green-500' : 'text-gray-600'}`}>
                                {obj.isCompleted ? '☑' : '☐'}
                             </span>
                             <span className={`text-sm ${obj.isCompleted ? 'text-gray-400 line-through decoration-gray-600' : 'text-gray-200'}`}>
                                 {obj.description}
                             </span>
                        </li>
                    ))}
                </ul>

                {selectedQuest.rewards && (
                    <>
                        <h4 className="text-lg font-semibold text-sky-300 mb-2 border-b border-sky-800 pb-1">Rewards</h4>
                        <div className="text-sm text-amber-200 flex flex-col gap-1 pl-2">
                            {selectedQuest.rewards.gold && <p>💰 {selectedQuest.rewards.gold} Gold</p>}
                            {selectedQuest.rewards.xp && <p>✨ {selectedQuest.rewards.xp} XP</p>}
                            {selectedQuest.rewards.items && selectedQuest.rewards.items.length > 0 && (
                                <p>📦 Items: {selectedQuest.rewards.items.join(', ')}</p>
                            )}
                        </div>
                    </>
                )}
              </article>
            ) : (
              <p className="text-gray-500 italic text-center py-10">Select a quest to view details.</p>
            )}
          </div>
        </div>
      );
  };


  return (
    <motion.div
      {...{
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      } as any}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true" role="dialog" aria-labelledby="logbook-title"
    >
      <motion.div
        {...{
          initial: { y: -30, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: -30, opacity: 0 },
        } as any}
        className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700">
          <div className="flex gap-4 items-baseline">
              <h2 id="logbook-title" className="text-3xl font-bold text-amber-400 font-cinzel">Logbook</h2>
              <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('characters')}
                    className={`px-3 py-1 text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'characters' ? 'border-amber-500 text-amber-200 font-bold bg-gray-700' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                  >
                      Dossiers
                  </button>
                  <button 
                    onClick={() => setActiveTab('quests')}
                    className={`px-3 py-1 text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === 'quests' ? 'border-amber-500 text-amber-200 font-bold bg-gray-700' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                  >
                      Quest Log
                  </button>
              </div>
          </div>
          <button ref={closeButtonRef} onClick={onClose} className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Close Logbook">&times;</button>
        </div>

        {/* Main Content Switcher */}
        {activeTab === 'characters' ? renderCharacterView() : renderQuestView()}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LogbookPane;
