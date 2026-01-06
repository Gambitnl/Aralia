/**
 * @file GlossaryHeader.tsx
 * Header component for the glossary modal with title, action buttons, and search bar.
 * Extracted from Glossary.tsx for better modularity.
 */
import React, { RefObject } from 'react';

interface GlossaryHeaderProps {
    /** Current search term */
    searchTerm: string;
    /** Handler for search term changes */
    onSearchChange: (term: string) => void;
}

/**
 * Renders the glossary search input.
 */
export const GlossaryHeader: React.FC<GlossaryHeaderProps> = ({
    searchTerm,
    onSearchChange,
}) => {
    return (
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
    );
};

export default GlossaryHeader;
