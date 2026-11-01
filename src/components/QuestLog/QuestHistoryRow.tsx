// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:39:44
 * Dependents: components/QuestLog/QuestLog.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  [QuestStatus.Abandoned]: {
    border: 'border-stone-700/60', title: 'text-stone-300', label: 'Withdrawn',
    badge: 'text-stone-300 border-stone-600', dateLabel: 'Withdrawn'
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
          <p className="text-xs text-gray-400">{style.dateLabel}: {formatQuestDate(quest.status === QuestStatus.Abandoned ? quest.dateAbandoned : quest.dateCompleted)}</p>
        </div>
        <span className={`text-xs uppercase border px-1 rounded ${style.badge}`}>{style.label}</span>
      </div>
      {/* Surface the legacy quest note trail so deadline-specific failure details stay visible in the history card. */}
      {quest.notes && (
        <p className="mt-2 whitespace-pre-line text-xs text-gray-300">
          {quest.notes}
        </p>
      )}
    </div>
  );
};
