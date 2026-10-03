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
export declare const GlossaryFooter: React.FC<GlossaryFooterProps>;
export default GlossaryFooter;
