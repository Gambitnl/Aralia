import React from 'react';
import { Quest, QuestStatus } from '../../types';
import { formatQuestDate } from './questUtils';

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

interface QuestCardProps {
  quest: Quest;
}

export const QuestCard: React.FC<QuestCardProps> = ({ quest }) => {
  const progress = calculateProgress(quest);

  return (
    <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-sm">
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
};
