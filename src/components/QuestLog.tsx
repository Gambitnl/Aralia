import React from 'react';
import { Quest, QuestStatus } from '../types';

interface QuestLogProps {
  isOpen: boolean;
  onClose: () => void;
  quests: Quest[];
}

const QuestLog: React.FC<QuestLogProps> = ({ isOpen, onClose, quests }) => {
  if (!isOpen) return null;

  const activeQuests = quests.filter(q => q.status === QuestStatus.Active);
  const completedQuests = quests.filter(q => q.status === QuestStatus.Completed);
  const failedQuests = quests.filter(q => q.status === QuestStatus.Failed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-2 border-amber-700 rounded-lg shadow-2xl p-6 text-amber-100 font-serif">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-amber-500 hover:text-amber-300 text-xl font-bold"
        >
          X
        </button>

        <h2 className="text-3xl font-bold mb-6 text-center text-amber-500 border-b border-amber-800 pb-2">Quest Log</h2>

        <div className="space-y-8">
          <section>
            <h3 className="text-xl font-semibold mb-4 text-amber-400">Active Quests</h3>
            {activeQuests.length === 0 ? (
              <p className="text-gray-400 italic">No active quests.</p>
            ) : (
              <div className="space-y-4">
                {activeQuests.map(quest => (
                  <div key={quest.id} className="bg-gray-800 p-4 rounded border border-gray-700">
                    <h4 className="text-lg font-bold text-amber-300">{quest.title}</h4>
                    <p className="text-sm text-gray-400 mb-2">{quest.description}</p>
                    <div className="mt-2 space-y-1">
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
                  </div>
                ))}
              </div>
            )}
          </section>

          {(completedQuests.length > 0 || failedQuests.length > 0) && (
             <section>
              <h3 className="text-xl font-semibold mb-4 text-gray-500">History</h3>
              <div className="space-y-2 opacity-75">
                 {completedQuests.map(quest => (
                  <div key={quest.id} className="bg-gray-800 p-3 rounded border border-green-900/30">
                    <div className="flex justify-between items-center">
                        <h4 className="text-md font-bold text-green-600 line-through">{quest.title}</h4>
                        <span className="text-xs text-green-600 uppercase border border-green-600 px-1 rounded">Completed</span>
                    </div>
                  </div>
                ))}
                {failedQuests.map(quest => (
                  <div key={quest.id} className="bg-gray-800 p-3 rounded border border-red-900/30">
                     <div className="flex justify-between items-center">
                        <h4 className="text-md font-bold text-red-600 line-through">{quest.title}</h4>
                        <span className="text-xs text-red-600 uppercase border border-red-600 px-1 rounded">Failed</span>
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
