/**
 * @file UnifiedDebugLogViewer.tsx
 * Combines Banter Debug Log and Ollama Log into a single window with tabs.
 */
import React, { useState } from 'react';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { OllamaLogEntry } from '../../types';

interface BanterDebugLogEntry {
    timestamp: Date;
    check: string;
    result: boolean | string;
    details?: string;
}

interface UnifiedDebugLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    // Banter Log Props
    banterLogs: BanterDebugLogEntry[];
    onClearBanterLogs: () => void;
    onForceBanterTrigger?: () => void;
    // Ollama Log Props
    ollamaLogs: OllamaLogEntry[];
    isBanterPaused?: boolean;
    onToggleBanterPause?: () => void;
}

export const UnifiedDebugLogViewer: React.FC<UnifiedDebugLogViewerProps> = ({
    isOpen,
    onClose,
    banterLogs,
    onClearBanterLogs,
    onForceBanterTrigger,
    ollamaLogs,
    isBanterPaused,
    onToggleBanterPause
}) => {
    const [activeTab, setActiveTab] = useState<'banter' | 'ollama'>('banter');

    if (!isOpen) return null;

    const formatBanterTimestamp = (ts: Date) => {
        const d = new Date(ts);
        return d.toLocaleTimeString();
    };

    const getBanterResultStyle = (result: boolean | string) => {
        if (result === true) return 'text-green-400';
        if (result === false) return 'text-red-400';
        return 'text-amber-400';
    };

    // Header Actions (Pause Toggle + Tabs could go here or in content)
    // We'll put Tabs in the top of the content area for better space usage with WindowFrame
    // But we can put the "Pause" button in the header actions area?
    // WindowFrame headerActions is a ReactNode.

    const headerActions = (
        <div className="flex items-center gap-2">
            {onToggleBanterPause && (
                <button
                    onClick={onToggleBanterPause}
                    className={`px-2 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors rounded ${isBanterPaused
                        ? 'bg-red-900/50 text-red-200 border border-red-500 hover:bg-red-800/50'
                        : 'bg-emerald-900/50 text-emerald-200 border border-emerald-500 hover:bg-emerald-800/50'
                        }`}
                    title={isBanterPaused ? "Resume Banter Triggers" : "Pause Banter Triggers"}
                >
                    {isBanterPaused ? 'Paused' : 'Active'}
                </button>
            )}
        </div>
    );

    return (
        <WindowFrame
            title="Banter & AI Inspector"
            onClose={onClose}
            headerActions={headerActions}
            storageKey={WINDOW_KEYS.UNIFIED_DEBUG_LOG}
        >
            <div className="flex flex-col h-full bg-gray-900 text-gray-200 text-sm">
                {/* Tabs */}
                <div className="flex border-b border-gray-700 bg-gray-800/50">
                    <button
                        onClick={() => setActiveTab('banter')}
                        className={`flex-1 py-2 px-4 text-center font-cinzel font-bold transition-colors ${activeTab === 'banter'
                            ? 'bg-gray-700 text-pink-400 border-b-2 border-pink-400'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
                            }`}
                    >
                        Banter Logic
                    </button>
                    <button
                        onClick={() => setActiveTab('ollama')}
                        className={`flex-1 py-2 px-4 text-center font-cinzel font-bold transition-colors ${activeTab === 'ollama'
                            ? 'bg-gray-700 text-emerald-400 border-b-2 border-emerald-400'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
                            }`}
                    >
                        Ollama Raw Logs
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden relative">
                    {/* Banter Tab Content */}
                    {activeTab === 'banter' && (
                        <div className="absolute inset-0 flex flex-col p-2">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <div className="text-xs text-gray-500 italic">
                                    Trigger checks every 10s.
                                </div>
                                <div className="flex gap-2">
                                    {onForceBanterTrigger && (
                                        <button
                                            onClick={onForceBanterTrigger}
                                            className="px-2 py-1 text-xs bg-green-700 hover:bg-green-600 text-white rounded shadow"
                                        >
                                            ⚡ Force Trigger
                                        </button>
                                    )}
                                    <button
                                        onClick={onClearBanterLogs}
                                        className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded shadow"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto scrollable-content bg-black/20 rounded border border-gray-700 p-2 font-mono text-xs space-y-1">
                                {banterLogs.length === 0 ? (
                                    <div className="text-gray-500 text-center py-8 italic mt-4">
                                        No banter trigger checks yet.
                                    </div>
                                ) : (
                                    banterLogs.map((entry, i) => {
                                        const isTriggerStart = entry.check === 'Trigger Check' || entry.check === 'FORCE TRIGGER';
                                        const isSuccess = entry.check === 'STARTED' || entry.check === 'FORCE STARTED';
                                        const isDetail = !isTriggerStart && !isSuccess;

                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-start gap-2 px-2 py-0.5 rounded ${isTriggerStart ? 'bg-gray-800 border-t border-gray-600 mt-2 pt-1' :
                                                    isSuccess ? 'bg-green-900/20 border border-green-800 my-1 py-1' : ''
                                                    }`}
                                            >
                                                <span className="text-gray-600 flex-shrink-0 w-[5.5rem] text-[10px] pt-0.5">
                                                    {formatBanterTimestamp(entry.timestamp)}
                                                </span>
                                                <span className={`flex-shrink-0 w-28 font-semibold ${isTriggerStart ? 'text-pink-300' : 'text-sky-300/80'
                                                    }`}>
                                                    {entry.check}
                                                </span>
                                                <span className={`flex-shrink-0 w-16 ${getBanterResultStyle(entry.result)}`}>
                                                    {typeof entry.result === 'boolean'
                                                        ? (entry.result ? '✓ PASS' : '✗ FAIL')
                                                        : entry.result
                                                    }
                                                </span>
                                                {entry.details && (
                                                    <span className={`break-all flex-grow ${isDetail ? 'text-gray-400' : 'text-gray-300'}`}>
                                                        {entry.details}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Ollama Tab Content */}
                    {activeTab === 'ollama' && (
                        <div className="absolute inset-0 flex flex-col p-2">
                            <div className="flex-1 overflow-y-auto scrollable-content bg-black/20 rounded border border-gray-700 p-2 text-xs">
                                {(!ollamaLogs || ollamaLogs.length === 0) ? (
                                    <p className="text-gray-500 text-center italic py-10">No Ollama interactions logged yet.</p>
                                ) : (
                                    ollamaLogs.map((entry, index) => (
                                        <div key={entry.id || index} className={`mb-3 p-2 border rounded bg-gray-800/40 ${entry.isPending ? 'border-amber-500/50 animate-pulse-slow' : 'border-gray-700'}`}>
                                            <div className="flex justify-between items-start mb-1 text-gray-500 text-[10px] uppercase tracking-wider">
                                                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                                                <div className="flex gap-2">
                                                    {entry.isPending && (
                                                        <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-400 border border-amber-500/30 rounded font-bold animate-pulse">
                                                            PENDING
                                                        </span>
                                                    )}
                                                    <span className="text-emerald-500">{entry.model}</span>
                                                </div>
                                            </div>

                                            <details className="group" open={entry.isPending}>
                                                <summary className="cursor-pointer text-amber-500/80 hover:text-amber-400 font-medium select-none list-none flex items-center gap-2">
                                                    <span className="group-open:rotate-90 transition-transform duration-200">▶</span>
                                                    {entry.isPending ? 'Generation in Progress...' : 'View Payload'}
                                                </summary>
                                                <div className="mt-2 grid grid-cols-1 gap-2 pl-4 border-l-2 border-gray-700 ml-1">
                                                    <div>
                                                        <div className="text-gray-400 font-bold mb-0.5">Prompt:</div>
                                                        <pre className="whitespace-pre-wrap break-all bg-black/30 p-2 rounded text-gray-300 font-mono text-[10px] max-h-40 overflow-y-auto custom-scrollbar">
                                                            {entry.prompt}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400 font-bold mb-0.5 mt-1">Response:</div>
                                                        <pre className={`whitespace-pre-wrap break-all bg-black/30 p-2 rounded font-mono text-[10px] max-h-40 overflow-y-auto custom-scrollbar ${entry.isPending ? 'text-amber-300 italic' : 'text-emerald-300/90'}`}>
                                                            {entry.response}
                                                        </pre>
                                                    </div>
                                                </div>
                                            </details>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};
