import React from 'react';
import { GlossaryEntry } from '../../types';
interface GlossaryEntryTemplateProps {
    entry: GlossaryEntry | null;
    markdownContent: string | null;
    onNavigate?: (termId: string) => void;
}
/**
 * A standardized template for displaying non-spell glossary entries.
 * Supports both legacy markdownContent and new structured data fields.
 */
export declare const GlossaryEntryTemplate: React.FC<GlossaryEntryTemplateProps>;
export {};
