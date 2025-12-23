/**
 * @file GeminiLogViewer.tsx
 * This component displays a modal with a log of prompts sent to and responses received from Gemini.
 */
import React, { useEffect, useRef } from 'react';
import { GeminiLogEntry } from '../../types';

interface GeminiLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
  logEntries: GeminiLogEntry[];
}

const GeminiLogViewer: React.FC<GeminiLogViewerProps> = ({ isOpen, onClose, logEntries }) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      firstFocusableElementRef.current?.focus();
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, logEntries]);


  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-[70] p-4" // Higher z-index than DevMenu
      aria-modal="true"
      role="dialog"
      aria-labelledby="gemini-log-viewer-title"
    >
      <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 id="gemini-log-viewer-title" className="text-2xl font-bold text-sky-300 font-cinzel">
            Gemini API Interaction Log
          </h2>
          <button
            ref={firstFocusableElementRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-3xl"
            aria-label="Close Gemini log viewer"
          >
            &times;
          </button>
        </div>

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
    </div>
  );
};

export default GeminiLogViewer;