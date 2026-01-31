/**
 * @file CollapsibleBanterPanel.tsx
 * A flexible UI panel for banter that can be collapsed, expanded, or detached into a floating window.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WindowFrame } from './WindowFrame';

import { BanterMoment, Companion } from '../../types/companions';

export interface BanterHistoryLine {
    speakerId: string;
    speakerName: string;
    text: string;
}

interface CollapsibleBanterPanelProps {
    isActive: boolean;
    isWaiting: boolean;
    secondsRemaining: number;
    history: BanterHistoryLine[];
    archivedBanters: BanterMoment[];
    companions: Record<string, Companion>;
    onInterrupt: (message: string) => void;
    onEndBanter: () => void;
}

type PanelMode = 'COLLAPSED' | 'EXPANDED' | 'FLOATING';
type Tab = 'LIVE' | 'MEMORIES';

export const CollapsibleBanterPanel: React.FC<CollapsibleBanterPanelProps> = ({
    isActive,
    isWaiting,
    secondsRemaining,
    history,
    archivedBanters,
    companions,
    onInterrupt,
    onEndBanter
}) => {
    const [mode, setMode] = useState<PanelMode>('COLLAPSED');
    const [activeTab, setActiveTab] = useState<Tab>('LIVE');
    const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
    const [playerMessage, setPlayerMessage] = useState('');

    // If banter ends, reset to collapsed (optional preference)
    React.useEffect(() => {
        if (!isActive) {
            setMode('COLLAPSED');
        } else {
            setActiveTab('LIVE'); // Auto-switch to live when banter starts
        }
    }, [isActive]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerMessage.trim()) {
            onInterrupt(playerMessage.trim());
            setPlayerMessage('');
        }
    };

    /**
     * Resolves a speaker's display name.
     * Priority:
     * 1. Saved speakerName in the line (if available)
     * 2. 'You' if speakerId is 'player'
     * 3. Current Name from Companion state
     * 4. Formatted ID (Title Case, no underscores)
     */
    const resolveSpeakerName = (id: string, savedName?: string): string => {
        if (savedName) return savedName;
        if (id === 'player') return 'You';

        const companion = companions[id];
        if (companion?.identity?.name) return companion.identity.name;

        // Fallback: Format ID
        return id
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // --- RENDERERS ---

    const renderChatContent = () => (
        <div className="flex flex-col h-full">
            {/* History Area */}
            <div className="flex-grow overflow-y-auto mb-4 space-y-3 p-2 custom-scrollbar">
                {history.length === 0 && (
                    <div className="text-gray-500 text-sm italic text-center mt-4">
                        Conversation starting...
                    </div>
                )}
                {history.map((line, idx) => (
                    <div key={idx} className={`flex flex-col ${line.speakerId === 'player' ? 'items-end' : 'items-start'}`}>
                        <span className="text-xs text-amber-500/70 mb-0.5 px-1">
                            {line.speakerName}
                        </span>
                        <div className={`
                            px-3 py-2 rounded-lg max-w-[90%] text-sm
                            ${line.speakerId === 'player' ? 'bg-amber-900/30 text-amber-100 border border-amber-700/30' : 'bg-gray-700/50 text-gray-200 border border-gray-600/30'}
                        `}>
                            {line.text}
                        </div>
                    </div>
                ))}
                {isWaiting && secondsRemaining > 0 && (
                    <div className="text-xs text-gray-500 italic animate-pulse px-2">
                        Next line in {secondsRemaining}s...
                    </div>
                )}
            </div>

            {/* Input Area (Only if active) */}
            {isActive && (
                <form onSubmit={handleSubmit} className="flex gap-2 mt-auto">
                    <input
                        type="text"
                        value={playerMessage}
                        onChange={(e) => setPlayerMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-grow px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                        type="submit"
                        disabled={!playerMessage.trim()}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold rounded transition-colors"
                    >
                        Send
                    </button>
                </form>
            )}
            {!isActive && (
                <div className="mt-auto text-center text-gray-500 text-xs italic p-2 border-t border-gray-800">
                    Conversation ended.
                </div>
            )}
        </div>
    );

    const renderMemoriesContent = () => {
        if (selectedMomentId) {
            const moment = archivedBanters.find(m => m.id === selectedMomentId);
            if (!moment) return <div>Moment not found</div>;

            return (
                <div className="flex flex-col h-full">
                    <button
                        onClick={() => setSelectedMomentId(null)}
                        className="mb-2 text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1"
                    >
                        ← Back to List
                    </button>
                    <div className="flex-grow overflow-y-auto space-y-3 p-2 custom-scrollbar">
                        <div className="text-xs text-gray-500 mb-4 text-center">
                            {new Date(moment.timestamp).toLocaleString()} • {moment.locationId}
                        </div>
                        {moment.lines.map((line, idx) => (
                            <div key={idx} className={`flex flex-col ${line.speakerId === 'player' ? 'items-end' : 'items-start'}`}>
                                <span className="text-xs text-amber-500/70 mb-0.5 px-1">
                                    {resolveSpeakerName(line.speakerId, line.speakerName)}
                                </span>
                                <div className={`
                                    px-3 py-2 rounded-lg max-w-[90%] text-sm
                                    ${line.speakerId === 'player' ? 'bg-amber-900/30 text-amber-100 border border-amber-700/30' : 'bg-gray-700/50 text-gray-200 border border-gray-600/30'}
                                `}>
                                    {line.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
                {(!archivedBanters || archivedBanters.length === 0) && (
                    <div className="text-gray-500 text-sm italic text-center mt-8">
                        No memories archived yet.
                    </div>
                )}
                <div className="space-y-2">
                    {archivedBanters?.map(moment => (
                        <button
                            key={moment.id}
                            onClick={() => setSelectedMomentId(moment.id)}
                            className="w-full text-left p-3 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-amber-500 text-xs font-medium">
                                    {new Date(moment.timestamp).toLocaleDateString()}
                                </span>
                                <span className="text-gray-500 text-[10px]">
                                    {moment.locationId}
                                </span>
                            </div>
                            <div className="text-gray-300 text-sm line-clamp-2">
                                <span className="text-amber-500/80 mr-1">
                                    {resolveSpeakerName(moment.lines[0]?.speakerId, moment.lines[0]?.speakerName)}:
                                </span>
                                {moment.lines[0]?.text || "..."}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderContent = () => (
        <>
            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-2">
                <button
                    onClick={() => { setActiveTab('LIVE'); setSelectedMomentId(null); }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'LIVE' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Live Chat {isActive && <span className="ml-1 w-2 h-2 inline-block rounded-full bg-green-500 animate-pulse" />}
                </button>
                <button
                    onClick={() => { setActiveTab('MEMORIES'); }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'MEMORIES' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Memories
                </button>
            </div>

            <div className="flex-grow overflow-hidden relative">
                {activeTab === 'LIVE' ? renderChatContent() : renderMemoriesContent()}
            </div>
        </>
    );

    // --- MODES ---

    // 1. FLOATING WINDOW
    if (mode === 'FLOATING') {
        return (
            <WindowFrame
                title="Conversation"
                onClose={() => setMode('COLLAPSED')}
                headerActions={
                    <button
                        onClick={() => setMode('EXPANDED')}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                        title="Dock to side"
                    >
                        ⇲
                    </button>
                }
            >
                <div className="p-4 h-full bg-gray-800 flex flex-col">
                    {renderContent()}
                </div>
            </WindowFrame>
        );
    }

    // 2. SIDE PANEL (EXPANDED)
    if (mode === 'EXPANDED') {
        return (
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed right-0 top-1/4 bottom-1/4 w-96 bg-gray-800 border-l border-amber-500/50 shadow-2xl z-[var(--z-index-content-overlay-medium)] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-700 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-400">💬</span>
                        <span className="text-gray-200 font-medium text-sm">Conversation</span>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setMode('FLOATING')}
                            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                            title="Pop out"
                        >
                            ⇱
                        </button>
                        <button
                            onClick={() => setMode('COLLAPSED')}
                            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                            title="Collapse"
                        >
                            →
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow p-4 overflow-hidden flex flex-col">
                    {renderContent()}
                </div>
            </motion.div>
        );
    }

    // 3. COLLAPSED TAB
    // NOTE: Even when collapsed, if we are active, we might want to pulse or show something.
    // But primarily this just opens the full view.
    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="fixed right-0 top-1/3 z-[var(--z-index-content-overlay-medium)]"
        >
            <button
                onClick={() => setMode('EXPANDED')}
                className="flex items-center gap-2 pl-3 pr-2 py-3 bg-gray-800 border-l border-y border-amber-500/30 rounded-l-xl shadow-lg hover:bg-gray-700 transition-colors group"
            >
                <span className="text-amber-400 text-lg group-hover:scale-110 transition-transform">💬</span>
                <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Chat</span>
                    {isActive && isWaiting && secondsRemaining > 0 && (
                        <span className="text-[10px] text-amber-500 tabular-nums">{secondsRemaining}s</span>
                    )}
                    {!isActive && (
                        <span className="text-[10px] text-gray-500">History</span>
                    )}
                </div>
            </button>
        </motion.div>
    );
};
