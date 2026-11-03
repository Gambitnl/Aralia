/**
 * @file GlossaryFooter.tsx
 * Footer component for the glossary modal with metadata and keyboard hints.
 * Extracted from Glossary.tsx for better modularity.
 */
import React from 'react';
// GG-378: shared button style and control roles.
import { Button } from '../ui/Button';

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
            <Button
                type="button"
                onClick={onClose}
                variant="primary"
                aria-label="Close glossary"
            >
                Close
            </Button>
        </div>
    );
};

export default GlossaryFooter;
