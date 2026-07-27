import React from 'react';
interface Characteristic {
    label: string;
    value: string;
}
interface GlossarySummaryTableProps {
    characteristics: Characteristic[];
    onNavigate?: (termId: string) => void;
}
/**
 * Renders a summary dashboard of core characteristics for a glossary entry.
 * Uses the premium table style with borders and shadows.
 */
export declare const GlossarySummaryTable: React.FC<GlossarySummaryTableProps>;
export {};
