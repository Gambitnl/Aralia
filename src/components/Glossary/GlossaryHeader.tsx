/**
 * @file GlossaryHeader.tsx
 * Header component for the glossary modal with title, action buttons, and search bar.
 * Extracted from Glossary.tsx for better modularity.
 */
import React, { RefObject } from 'react';

interface GlossaryHeaderProps {
    /** Reference to the first focusable element for accessibility */
    firstFocusableElementRef: RefObject<HTMLButtonElement | null>;
    /** Handler for drag start on the title */
    onDragStart: (e: React.MouseEvent) => void;
    /** Handler for re-checking spell validations */
    onRecheckSpells: () => void;
    /** Whether spell checking is in progress */
    isCheckingSpells: boolean;
    /** Handler for resetting modal layout */
    onResetLayout: () => void;
    /** Handler for closing the modal */
    onClose: () => void;
    /** Handler for maximizing the modal */
    onMaximize: () => void;
    /** Current search term */
    searchTerm: string;
    /** Handler for search term changes */
    onSearchChange: (term: string) => void;
}

/**
 * Renders the glossary modal header with drag handle, title, action buttons, and search input.
 */
export const GlossaryHeader: React.FC<GlossaryHeaderProps> = ({
    firstFocusableElementRef,
    onDragStart,
    onRecheckSpells,
    isCheckingSpells,
    onResetLayout,
    onClose,
    onMaximize,
    searchTerm,
    onSearchChange,
}) => {
    return (
        <>
            {/* Title bar */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-600">
                <button
                    type="button"
                    aria-label="Drag to move the glossary"
                    className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none bg-transparent border-0"
                    onMouseDown={onDragStart}
                    title="Drag to move the glossary"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M9 4.5a1 1 0 0 1 2 0v2.086l1.293-1.293a1 1 0 1 1 1.414 1.414L12.414 8H14.5a1 1 0 1 1 0 2h-2.086l1.293 1.293a1 1 0 1 1-1.414 1.414L11 11.414V13.5a1 1 0 1 1-2 0v-2.086l-1.293 1.293a1 1 0 0 1-1.414-1.414L7.586 10H5.5a1 1 0 0 1 0-2h2.086L6.293 6.707a1 1 0 0 1 1.414-1.414L9 6.586V4.5Z" />
                    </svg>
                    <h2 id="glossary-title" className="text-3xl font-bold text-amber-400 font-cinzel">Game Glossary</h2>
                </button>

                <div className="flex items-center gap-3">
                    {/* Re-check Spells Button */}
                    <button
                        type="button"
                        onClick={onRecheckSpells}
                        disabled={isCheckingSpells}
                        className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${isCheckingSpells
                            ? 'text-emerald-400 animate-pulse cursor-wait'
                            : 'text-gray-500 hover:text-emerald-400'
                            }`}
                        aria-label="Re-check spells"
                        title={isCheckingSpells ? "Checking spells..." : "Re-run spell validation checks"}
                    >
                        {isCheckingSpells ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </button>

                    {/* Maximize Button */}
                    <button
                        type="button"
                        onClick={onMaximize}
                        className="text-gray-500 hover:text-amber-400 p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                        aria-label="Maximize to window"
                        title="Maximize to fit window"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>

                    {/* Reset Layout Button */}
                    <button
                        type="button"
                        onClick={onResetLayout}
                        className="text-gray-500 hover:text-amber-400 p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                        aria-label="Reset layout"
                        title="Reset to default size and position"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>

                    {/* Close Button */}
                    <button
                        type="button"
                        ref={firstFocusableElementRef}
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
                        aria-label="Close glossary"
                    >
                        &times;
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div className="mb-4">
                <input
                    type="search"
                    placeholder="Search glossary (e.g., Rage, Spell Slot, Expertise)..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                    aria-label="Search glossary terms"
                />
            </div>
        </>
    );
};

export default GlossaryHeader;
