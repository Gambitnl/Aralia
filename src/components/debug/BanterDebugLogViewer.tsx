/**
 * @file BanterDebugLogViewer.tsx
 * Displays the banter trigger calculation debug log.
 */
import React from 'react';

interface BanterDebugLogEntry {
    timestamp: Date;
    check: string;
    result: boolean | string;
    details?: string;
}

interface BanterDebugLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    logs: BanterDebugLogEntry[];
    onClear: () => void;
    onForceTrigger?: () => void;
}

export const BanterDebugLogViewer: React.FC<BanterDebugLogViewerProps> = ({
    isOpen,
    onClose,
    logs,
    onClear,
    onForceTrigger
}) => {
    if (!isOpen) return null;

    const formatTimestamp = (ts: Date) => {
        const d = new Date(ts);
        return d.toLocaleTimeString();
    };

    const getResultStyle = (result: boolean | string) => {
        if (result === true) return 'text-green-400';
        if (result === false) return 'text-red-400';
        return 'text-amber-400';
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700 w-full max-w-3xl max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-pink-400 font-cinzel">
                        🎭 Banter Debug Log
                    </h2>
                    <div className="flex gap-2">
                        {onForceTrigger && (
                            <button
                                onClick={onForceTrigger}
                                className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 text-white rounded font-semibold"
                            >
                                ⚡ Force Trigger
                            </button>
                        )}
                        <button
                            onClick={onClear}
                            className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded"
                        >
                            Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white text-2xl"
                            aria-label="Close"
                        >
                            &times;
                        </button>
                    </div>
                </div>

                <div className="text-xs text-gray-400 mb-3">
                    Showing trigger calculation checks every 10 seconds. Look for "STARTED" or "TRIGGER!" entries.
                </div>

                <div className="flex-grow overflow-y-auto scrollable-content bg-gray-900/50 rounded-lg p-2 space-y-1 font-mono text-xs">
                    {logs.length === 0 ? (
                        <div className="text-gray-500 text-center py-8 italic">
                            No banter trigger checks yet. Wait 10 seconds...
                        </div>
                    ) : (
                        logs.map((entry, i) => {
                            const isTriggerStart = entry.check === 'Trigger Check';
                            const isSuccess = entry.check === 'STARTED';

                            return (
                                <div
                                    key={i}
                                    className={`flex items-start gap-2 px-2 py-1 rounded ${isTriggerStart ? 'bg-gray-700/50 border-t border-gray-600 mt-2' :
                                        isSuccess ? 'bg-green-900/30 border border-green-600' : ''
                                        }`}
                                >
                                    <span className="text-gray-500 flex-shrink-0 w-20">
                                        {formatTimestamp(entry.timestamp)}
                                    </span>
                                    <span className="text-sky-300 flex-shrink-0 w-28">
                                        {entry.check}
                                    </span>
                                    <span className={`flex-shrink-0 w-16 ${getResultStyle(entry.result)}`}>
                                        {typeof entry.result === 'boolean'
                                            ? (entry.result ? '✓ PASS' : '✗ FAIL')
                                            : entry.result
                                        }
                                    </span>
                                    {entry.details && (
                                        <span className="text-gray-400 truncate flex-grow">
                                            {entry.details}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                    <strong>Legend:</strong>
                    <span className="text-green-400 ml-2">✓ PASS</span> = check passed,
                    <span className="text-red-400 ml-2">✗ FAIL</span> = check failed (banter blocked)
                </div>
            </div>
        </div>
    );
};

export default BanterDebugLogViewer;
