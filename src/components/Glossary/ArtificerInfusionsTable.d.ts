/**
 * @file ArtificerInfusionsTable.tsx
 * Premium table layout for displaying Artificer Infusions in the glossary.
 * Parses infusion data from markdown content and renders in a structured table.
 */
import React from 'react';
interface ArtificerInfusionsTableProps {
    markdownContent: string;
    onNavigate?: (termId: string) => void;
}
export declare const ArtificerInfusionsTable: React.FC<ArtificerInfusionsTableProps>;
export default ArtificerInfusionsTable;
