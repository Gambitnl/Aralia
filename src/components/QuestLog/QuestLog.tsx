// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:39:44
 * Dependents: components/QuestLog/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo } from 'react';
import { Quest, QuestStatus } from '../../types';
import { QuestCard } from './QuestCard';
import { QuestHistoryRow } from './QuestHistoryRow';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface QuestLogProps {
  isOpen: boolean;
  onClose: () => void;
  quests: Quest[];
}

const QuestLog: React.FC<QuestLogProps> = ({ isOpen, onClose, quests }) => {
  const activeQuests = useMemo(() => quests.filter(q => q.status === QuestStatus.Active), [quests]);
  const availableQuests = useMemo(() => quests.filter(q => q.status === QuestStatus.Available), [quests]);
  const completedQuests = useMemo(() => quests.filter(q => q.status === QuestStatus.Completed), [quests]);
  const endedQuests = useMemo(() => quests.filter(q => q.status === QuestStatus.Failed || q.status === QuestStatus.Abandoned), [quests]);

  if (!isOpen) return null;

  return (
    <WindowFrame
      title="Quest Log"
      onClose={onClose}
      storageKey={WINDOW_KEYS.QUEST_LOG}
      initialMaximized={false}
    >
      <div className="flex flex-col h-full text-amber-100 font-serif">
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-8">
          {availableQuests.length > 0 && <section aria-label="Available work">
            <h3 className="text-xl font-semibold mb-2 text-sky-300">Available work ({availableQuests.length})</h3>
            <p className="mb-4 text-sm text-gray-400">Speak with the giver to accept or decline an offer.</p>
            <div className="space-y-4">{availableQuests.map(quest => <QuestCard key={quest.id} quest={quest} />)}</div>
          </section>}
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

          {(completedQuests.length > 0 || endedQuests.length > 0) && (
            <section>
              <h3 className="text-xl font-semibold mb-4 text-gray-400">History</h3>
              <div className="space-y-3 opacity-90">
                {completedQuests.map(quest => (
                  <QuestHistoryRow key={quest.id} quest={quest} />
                ))}
                {endedQuests.map(quest => (
                  <QuestHistoryRow key={quest.id} quest={quest} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </WindowFrame>
  );
};

export default QuestLog;
