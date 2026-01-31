import React, { useMemo } from 'react';
import { Quest, QuestStatus } from '../../types';
import { QuestCard } from './QuestCard';
import { QuestHistoryRow } from './QuestHistoryRow';

interface QuestLogProps {
  isOpen: boolean;
  onClose: () => void;
  quests: Quest[];
}

const QuestLog: React.FC<QuestLogProps> = ({ isOpen, onClose, quests }) => {
  const activeQuests = useMemo(() => quests.filter(q => q.status === QuestStatus.Active), [quests]);
  const completedQuests = useMemo(() => quests.filter(q => q.status === QuestStatus.Completed), [quests]);
  const failedQuests = useMemo(() => quests.filter(q => q.status === QuestStatus.Failed), [quests]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-index-modal-background)] flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border-2 border-amber-700 rounded-lg shadow-2xl p-6 text-amber-100 font-serif">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-amber-500 hover:text-amber-300 text-xl font-bold"
          aria-label="Close quest log"
        >
          X
        </button>

        <h2 className="text-3xl font-bold mb-6 text-center text-amber-500 border-b border-amber-800 pb-2">Quest Log</h2>

        <div className="space-y-8">
          <section>
            <h3 className="text-xl font-semibold mb-4 text-amber-400 flex items-center gap-2">
              Active Quests
              <span className="text-xs text-gray-400 font-normal">({activeQuests.length})</span>
            </h3>
            {activeQuests.length === 0 ? (
              <p className="text-gray-400 italic">No active quests.</p>
            ) : (
              <div className="space-y-4">
                {activeQuests.map(quest => (
                  <QuestCard key={quest.id} quest={quest} />
                ))}
              </div>
            )}
          </section>

          {(completedQuests.length > 0 || failedQuests.length > 0) && (
            <section>
              <h3 className="text-xl font-semibold mb-4 text-gray-500">History</h3>
              <div className="space-y-3 opacity-90">
                {completedQuests.map(quest => (
                  <QuestHistoryRow key={quest.id} quest={quest} />
                ))}
                {failedQuests.map(quest => (
                  <QuestHistoryRow key={quest.id} quest={quest} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestLog;
