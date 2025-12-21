import React from 'react';
import { Quest, QuestStatus } from '../../types';
import { formatQuestDate } from './questUtils';

const statusStyles: Record<string, { border: string; title: string; label: string; badge: string; dateLabel: string }> = {
  [QuestStatus.Completed]: {
    border: 'border-green-900/30',
    title: 'text-green-500',
    label: 'Completed',
    badge: 'text-green-400 border-green-600',
    dateLabel: 'Finished'
  },
  [QuestStatus.Failed]: {
    border: 'border-red-900/30',
    title: 'text-red-500',
    label: 'Failed',
    badge: 'text-red-400 border-red-600',
    dateLabel: 'Ended'
  }
};

interface QuestHistoryRowProps {
  quest: Quest;
}

export const QuestHistoryRow: React.FC<QuestHistoryRowProps> = ({ quest }) => {
  const style = statusStyles[quest.status] || statusStyles[QuestStatus.Failed];

  return (
    <div className={`bg-gray-800 p-3 rounded border ${style.border}`}>
      <div className="flex justify-between items-center">
        <div>
          <h4 className={`text-md font-bold ${style.title}`}>{quest.title}</h4>
          <p className="text-xs text-gray-500">{style.dateLabel}: {formatQuestDate(quest.dateCompleted)}</p>
        </div>
        <span className={`text-xs uppercase border px-1 rounded ${style.badge}`}>{style.label}</span>
      </div>
    </div>
  );
};
