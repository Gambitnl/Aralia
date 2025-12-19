import React from 'react';
import { Quest, QuestStatus, Deadline } from '../types';
import { formatGameDateTime, formatDuration } from '@/utils/timeUtils';

// Helper to show human friendly timestamps inside the modal
const formatQuestDate = (timestamp?: number): string => {
  if (!timestamp) return '—';
  return formatGameDateTime(new Date(timestamp));
};

const statusBadgeStyles: Record<QuestStatus, string> = {
  [QuestStatus.Active]: 'bg-amber-900/40 text-amber-200 border-amber-500',
  [QuestStatus.Completed]: 'bg-green-900/40 text-green-200 border-green-500',
  [QuestStatus.Failed]: 'bg-red-900/40 text-red-200 border-red-500',
};

const statusText: Record<QuestStatus, string> = {
  [QuestStatus.Active]: 'Active',
  [QuestStatus.Completed]: 'Completed',
  [QuestStatus.Failed]: 'Failed',
};

const calculateProgress = (quest: Quest): number => {
  if (!quest.objectives.length) return 0;
  const completed = quest.objectives.filter(obj => obj.isCompleted).length;
  return Math.round((completed / quest.objectives.length) * 100);
};

const renderRewards = (quest: Quest) => {
  if (!quest.rewards) return <p className="text-xs text-gray-500">No reward specified.</p>;
  const { gold, xp, items } = quest.rewards;
  return (
    <div className="flex flex-wrap gap-2 text-xs text-amber-200">
      {gold ? <span className="px-2 py-1 rounded bg-amber-800/50 border border-amber-600">{gold} gp</span> : null}
      {xp ? <span className="px-2 py-1 rounded bg-sky-800/50 border border-sky-600">{xp} xp</span> : null}
      {items?.length ? <span className="px-2 py-1 rounded bg-emerald-900/40 border border-emerald-600">Items: {items.join(', ')}</span> : null}
    </div>
  );
};

interface QuestLogProps {
  isOpen: boolean;
  onClose: () => void;
  quests: Quest[];
  deadlines?: Deadline[];
  currentTime?: Date;
}

const QuestLog: React.FC<QuestLogProps> = ({ isOpen, onClose, quests, deadlines = [], currentTime }) => {
  if (!isOpen) return null;

  const activeQuests = quests.filter(q => q.status === QuestStatus.Active);
  const completedQuests = quests.filter(q => q.status === QuestStatus.Completed);
  const failedQuests = quests.filter(q => q.status === QuestStatus.Failed);
  const activeDeadlines = deadlines.filter(d => !d.isCompleted && !d.isExpired);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
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
          {activeDeadlines.length > 0 && currentTime && (
            <section className="bg-red-950/20 border border-red-900/40 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-3 text-red-400 flex items-center gap-2">
                ⏳ Urgent Deadlines
                <span className="text-xs text-red-300/60 font-normal">({activeDeadlines.length})</span>
              </h3>
              <div className="space-y-3">
                {activeDeadlines.map(deadline => {
                  const timeLeft = Math.max(0, (deadline.dueDate - currentTime.getTime()) / 1000);
                  const isCritical = timeLeft < 3600 * 24; // Less than 24 hours

                  return (
                    <div key={deadline.id} className={`p-3 rounded border ${isCritical ? 'bg-red-900/30 border-red-500' : 'bg-gray-800 border-gray-700'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                           <h4 className="text-md font-bold text-amber-100">{deadline.title}</h4>
                           <p className="text-sm text-gray-400">{deadline.description}</p>
                        </div>
                        <div className="text-right">
                           <div className={`text-sm font-bold ${isCritical ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                             {formatDuration(timeLeft)} left
                           </div>
                           <div className="text-[10px] text-gray-500">
                             Due: {formatGameDateTime(new Date(deadline.dueDate))}
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xl font-semibold mb-4 text-amber-400 flex items-center gap-2">
              Active Quests
              <span className="text-xs text-gray-400 font-normal">({activeQuests.length})</span>
            </h3>
            {activeQuests.length === 0 ? (
              <p className="text-gray-400 italic">No active quests.</p>
            ) : (
              <div className="space-y-4">
                {activeQuests.map(quest => {
                  const progress = calculateProgress(quest);
                  return (
                    <div key={quest.id} className="bg-gray-800 p-4 rounded border border-gray-700 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                            {quest.title}
                            <span className={`text-[10px] uppercase px-2 py-1 rounded-full border ${statusBadgeStyles[quest.status]}`}>
                              {statusText[quest.status]}
                            </span>
                          </h4>
                          <p className="text-sm text-gray-400 mb-2">{quest.description}</p>
                          <p className="text-[11px] text-gray-500">Giver: {quest.giverId}</p>
                          {quest.regionHint && <p className="text-[11px] text-gray-500">Region: {quest.regionHint}</p>}
                          {quest.questType && <p className="text-[11px] text-gray-500">Type: {quest.questType}</p>}
                        </div>
                        <div className="w-full sm:w-48">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="mt-2">
                            {renderRewards(quest)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        {quest.objectives.map(obj => (
                          <div key={obj.id} className="flex items-center text-sm">
                            <span className={`mr-2 ${obj.isCompleted ? 'text-green-500' : 'text-gray-500'}`}>
                              {obj.isCompleted ? '☑' : '☐'}
                            </span>
                            <span className={obj.isCompleted ? 'line-through text-gray-500' : 'text-gray-300'}>
                              {obj.description}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-[11px] text-gray-500 flex gap-4">
                        <span>Started: {formatQuestDate(quest.dateStarted)}</span>
                        <span>Completed: {formatQuestDate(quest.dateCompleted)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {(completedQuests.length > 0 || failedQuests.length > 0) && (
            <section>
              <h3 className="text-xl font-semibold mb-4 text-gray-500">History</h3>
              <div className="space-y-3 opacity-90">
                {completedQuests.map(quest => (
                  <div key={quest.id} className="bg-gray-800 p-3 rounded border border-green-900/30">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-md font-bold text-green-500">{quest.title}</h4>
                        <p className="text-xs text-gray-500">Finished: {formatQuestDate(quest.dateCompleted)}</p>
                      </div>
                      <span className="text-xs text-green-400 uppercase border border-green-600 px-1 rounded">Completed</span>
                    </div>
                  </div>
                ))}
                {failedQuests.map(quest => (
                  <div key={quest.id} className="bg-gray-800 p-3 rounded border border-red-900/30">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-md font-bold text-red-500">{quest.title}</h4>
                        <p className="text-xs text-gray-500">Ended: {formatQuestDate(quest.dateCompleted)}</p>
                      </div>
                      <span className="text-xs text-red-400 uppercase border border-red-600 px-1 rounded">Failed</span>
                    </div>
                  </div>
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
