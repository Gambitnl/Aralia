import React from 'react';
import { Quest, QuestStatus } from '../../types';
import { formatGameDateTime } from '@/utils/timeUtils';

const formatQuestDate = (timestamp?: number): string => {
  if (!timestamp) return '—';
  return formatGameDateTime(new Date(timestamp));
};

interface QuestHistoryRowProps {
  quest: Quest;
}

export const QuestHistoryRow: React.FC<QuestHistoryRowProps> = ({ quest }) => {
  const isCompleted = quest.status === QuestStatus.Completed;
  const borderColor = isCompleted ? 'border-green-900/30' : 'border-red-900/30';
  const titleColor = isCompleted ? 'text-green-500' : 'text-red-500';
  const statusLabel = isCompleted ? 'Completed' : 'Failed';
  const statusColor = isCompleted ? 'text-green-400 border-green-600' : 'text-red-400 border-red-600';
  const dateLabel = isCompleted ? 'Finished' : 'Ended';

  return (
    <div className={`bg-gray-800 p-3 rounded border ${borderColor}`}>
      <div className="flex justify-between items-center">
        <div>
          <h4 className={`text-md font-bold ${titleColor}`}>{quest.title}</h4>
          <p className="text-xs text-gray-500">{dateLabel}: {formatQuestDate(quest.dateCompleted)}</p>
        </div>
        <span className={`text-xs uppercase border px-1 rounded ${statusColor}`}>{statusLabel}</span>
      </div>
    </div>
  );
};
