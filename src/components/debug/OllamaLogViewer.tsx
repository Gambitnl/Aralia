/**
 * @file OllamaLogViewer.tsx
 * This component displays a modal with a log of prompts sent to and responses received from Ollama.
 */
import React, { useEffect, useRef } from 'react';
import { OllamaLogEntry } from '../../types';

interface OllamaLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    logEntries: OllamaLogEntry[];
    isBanterPaused?: boolean;
    onToggleBanterPause?: () => void;
}

const OllamaLogViewer: React.FC<OllamaLogViewerProps> = ({ isOpen, onClose, logEntries, isBanterPaused, onToggleBanterPause }) => {
    const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            firstFocusableElementRef.current?.focus();
            // Scroll to top when opened
            logContainerRef.current?.scrollTo(0, 0);
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);


    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-[70] p-4"
            aria-modal="true"
            role="dialog"
            aria-labelledby="ollama-log-viewer-title"
        >
            <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <h2 id="ollama-log-viewer-title" className="text-2xl font-bold text-emerald-400 font-cinzel">
                            Ollama Llama Interaction Log
                        </h2>
                        {onToggleBanterPause && (
                            <button
                                onClick={onToggleBanterPause}
                                className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${isBanterPaused
                                        ? 'bg-red-900/50 text-red-200 border border-red-500 hover:bg-red-800/50'
                                        : 'bg-emerald-900/50 text-emerald-200 border border-emerald-500 hover:bg-emerald-800/50'
                                    }`}
                            >
                                {isBanterPaused ? 'Banter Paused' : 'Pause Banter Triggers'}
                            </button>
                        )}
                    </div>
                    <button
                        ref={firstFocusableElementRef}
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-200 text-3xl"
                        aria-label="Close Ollama log viewer"
                    >
                        &times;
                    </button>
                </div>

                <div
                    ref={logContainerRef}
                    className="overflow-y-auto scrollable-content flex-grow bg-black/30 p-3 rounded-md border border-gray-700"
                >
                    {(!logEntries || logEntries.length === 0) ? (
                        <p className="text-gray-500 text-center italic py-10">No Ollama interactions logged yet.</p>
                    ) : (
                        logEntries.map((entry, index) => (
                            <div key={index} className="mb-4 p-3 border border-gray-600 rounded-md bg-gray-800/50">
                                <p className="text-xs text-gray-500 mb-1">
                                    <span className="font-semibold text-emerald-400">Timestamp:</span> {new Date(entry.timestamp).toLocaleString()} |
                                    <span className="font-semibold text-emerald-400 ml-2">Model:</span> {entry.model}
                                </p>
                                <details className="text-xs">
                                    <summary className="cursor-pointer text-amber-400 hover:text-amber-300 font-medium">View Prompt & Response</summary>
                                    <div className="mt-2 space-y-2">
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-300 mb-0.5">Prompt Sent:</h4>
                                            <pre className="whitespace-pre-wrap break-all bg-gray-700/40 p-2 rounded text-gray-400 text-[11px] leading-relaxed max-h-60 overflow-y-auto scrollable-content">{entry.prompt}</pre>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-300 mb-0.5">Raw Response Received:</h4>
                                            <pre className="whitespace-pre-wrap break-all bg-gray-700/40 p-2 rounded text-gray-400 text-[11px] leading-relaxed max-h-60 overflow-y-auto scrollable-content">{entry.response}</pre>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        ))
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2 px-6 rounded-lg shadow self-center"
                    aria-label="Close Ollama log viewer"
                >
                    Close Log Viewer
                </button>
            </div>
        </div>
    );
};

export default OllamaLogViewer;
