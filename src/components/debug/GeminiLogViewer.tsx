/**
 * @file GeminiLogViewer.tsx
 * This component displays a modal with a log of prompts sent to and responses received from Gemini.
 */
import React, { useEffect, useRef } from 'react';
import { GeminiLogEntry } from '../../types';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface GeminiLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
  logEntries: GeminiLogEntry[];
}

const GeminiLogViewer: React.FC<GeminiLogViewerProps> = ({ isOpen, onClose, logEntries }) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      firstFocusableElementRef.current?.focus();
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, logEntries]);


  if (!isOpen) {
    return null;
  }

  return (
    <WindowFrame
      title="Gemini API Interaction Log"
      onClose={onClose}
      storageKey={WINDOW_KEYS.GEMINI_LOG}
    >
      <div className="flex flex-col h-full bg-gray-900 p-6">
        <div className="overflow-y-auto scrollable-content flex-grow bg-black/30 p-3 rounded-md border border-gray-700">
          {logEntries.length === 0 ? (
            <p className="text-gray-500 text-center italic py-10">No Gemini interactions logged yet.</p>
          ) : (
            logEntries.map((entry, index) => (
              <div key={index} className="mb-4 p-3 border border-gray-600 rounded-md bg-gray-800/50">
                <p className="text-xs text-gray-500 mb-1">
                  <span className="font-semibold text-sky-400">Timestamp:</span> {entry.timestamp.toLocaleString()} |
                  <span className="font-semibold text-sky-400 ml-2">Function:</span> {entry.functionName}
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
          <div ref={logEndRef} />
        </div>

        <button
          onClick={onClose}
          className="mt-6 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 px-6 rounded-lg shadow self-center"
          aria-label="Close Gemini log viewer"
        >
          Close Log Viewer
        </button>
      </div>
    </WindowFrame>
  );
};

export default GeminiLogViewer;