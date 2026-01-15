/**
 * @file src/components/CharacterSheet/QuestLogSidebar.tsx
 * Quest log sidebar component showing active and completed quests.
 */
import React, { useState } from 'react';
import { Quest, QuestStatus, QuestType } from '../../../types';

interface QuestLogSidebarProps {
    quests: Quest[];
    onQuestSelect?: (quest: Quest) => void;
    selectedQuestId?: string;
}

const QUEST_TYPE_BADGES: Record<QuestType, { label: string; className: string }> = {
    Main: { label: 'Main Quest', className: 'text-amber-400' },
    Side: { label: 'Side Quest', className: 'text-slate-400' },
    Guild: { label: 'Guild', className: 'text-blue-400' },
    Dynamic: { label: 'Event', className: 'text-green-400' },
    Companion: { label: 'Personal', className: 'text-purple-400' },
    Rumor: { label: 'Rumor', className: 'text-gray-500' },
};

export const QuestLogSidebar: React.FC<QuestLogSidebarProps> = ({
    quests,
    onQuestSelect,
    selectedQuestId,
}) => {
    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

    const activeQuests = quests.filter(q => q.status === QuestStatus.Active);
    const completedQuests = quests.filter(q => q.status === QuestStatus.Completed);

    const displayedQuests = activeTab === 'active' ? activeQuests : completedQuests;

    const getQuestTypeInfo = (quest: Quest) => {
        const type = quest.questType || 'Side';
        return QUEST_TYPE_BADGES[type] || QUEST_TYPE_BADGES.Side;
    };

    return (
        <aside className="w-72 bg-slate-900/50 border-r border-slate-700/50 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-amber-400 text-sm tracking-widest uppercase">Quest Log</h2>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 text-xs font-bold uppercase tracking-tight">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`pb-2 transition-colors ${activeTab === 'active'
                            ? 'border-b-2 border-amber-400 text-amber-400'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Active ({activeQuests.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`pb-2 transition-colors ${activeTab === 'completed'
                            ? 'border-b-2 border-amber-400 text-amber-400'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Completed ({completedQuests.length})
                    </button>
                </div>
            </div>

            {/* Quest List */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-2">
                {displayedQuests.length === 0 ? (
                    <p className="text-slate-500 text-sm italic text-center py-4">
                        {activeTab === 'active' ? 'No active quests' : 'No completed quests'}
                    </p>
                ) : (
                    displayedQuests.map(quest => {
                        const typeInfo = getQuestTypeInfo(quest);
                        const isSelected = quest.id === selectedQuestId;
                        const isMain = quest.questType === 'Main';

                        return (
                            <div
                                key={quest.id}
                                onClick={() => onQuestSelect?.(quest)}
                                className={`
                  p-3 rounded-lg cursor-pointer transition-all
                  ${isSelected
                                        ? 'bg-slate-800/60 border border-amber-500/40'
                                        : isMain
                                            ? 'bg-slate-800/40 border border-amber-600/30 hover:bg-slate-800/60'
                                            : 'bg-slate-800/20 border border-slate-700/30 hover:bg-slate-800/40'
                                    }
                `}
                            >
                                {/* Quest Type Badge */}
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-bold text-[10px] uppercase tracking-tight ${typeInfo.className}`}>
                                        {typeInfo.label}
                                    </span>
                                    {isMain && (
                                        <span className="text-amber-400 text-xs">⚠</span>
                                    )}
                                </div>

                                {/* Quest Title */}
                                <h3 className={`font-body text-sm font-bold ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                                    {quest.title}
                                </h3>

                                {/* Quest Description Preview */}
                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 italic">
                                    {quest.description}
                                </p>

                                {/* Quest Rewards & Level */}
                                {quest.rewards && (
                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex -space-x-1">
                                            {quest.rewards.gold && quest.rewards.gold > 0 && (
                                                <div className="w-5 h-5 rounded-full bg-yellow-600/80 border border-slate-900 flex items-center justify-center" title={`${quest.rewards.gold} Gold`}>
                                                    <span className="text-[10px]">💰</span>
                                                </div>
                                            )}
                                            {quest.rewards.xp && quest.rewards.xp > 0 && (
                                                <div className="w-5 h-5 rounded-full bg-purple-600/80 border border-slate-900 flex items-center justify-center" title={`${quest.rewards.xp} XP`}>
                                                    <span className="text-[10px]">✨</span>
                                                </div>
                                            )}
                                            {quest.rewards.items && quest.rewards.items.length > 0 && (
                                                <div className="w-5 h-5 rounded-full bg-blue-600/80 border border-slate-900 flex items-center justify-center" title="Item Rewards">
                                                    <span className="text-[10px]">🎁</span>
                                                </div>
                                            )}
                                        </div>
                                        {quest.regionHint && (
                                            <span className="text-[10px] text-slate-500 font-mono">{quest.regionHint}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
};

export default QuestLogSidebar;
