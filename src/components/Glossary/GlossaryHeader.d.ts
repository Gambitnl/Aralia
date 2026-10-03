/**
 * @file GlossaryHeader.tsx
 * Header component for the glossary modal with title, action buttons, and search bar.
 * Extracted from Glossary.tsx for better modularity.
 */
import React from 'react';
interface GlossaryHeaderProps {
    /** Current search term */
    searchTerm: string;
    /** Handler for search term changes */
    onSearchChange: (term: string) => void;
}
/**
 * Renders the glossary search input.
 */
export declare const GlossaryHeader: React.FC<GlossaryHeaderProps>;
export default GlossaryHeader;
