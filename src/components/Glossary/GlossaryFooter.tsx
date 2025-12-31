/**
 * @file GlossaryFooter.tsx
 * Footer component for the glossary modal with metadata and keyboard hints.
 * Extracted from Glossary.tsx for better modularity.
 */
import React from 'react';

interface GlossaryFooterProps {
    /** Last generated timestamp for the glossary index */
    lastGenerated: string | null;
    /** Handler for closing the modal */
    onClose: () => void;
}

/**
 * Renders the glossary modal footer with timestamp and keyboard shortcuts hints.
 */
export const GlossaryFooter: React.FC<GlossaryFooterProps> = ({
    lastGenerated,
    onClose,
}) => {
    return (
        <div className="mt-6 pt-4 border-t border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-4">
                {lastGenerated && (
                    <span className="text-xs text-gray-500">
                        Index last generated: {new Date(lastGenerated).toLocaleString()}
                    </span>
                )}
                <span className="text-xs text-gray-600 hidden md:inline">
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 ml-0.5">↓</kbd>
                    <span className="ml-1">navigate</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 ml-2">←</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 ml-0.5">→</kbd>
                    <span className="ml-1">expand/collapse</span>
                </span>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
                aria-label="Close glossary"
            >
                Close
            </button>
        </div>
    );
};

export default GlossaryFooter;
