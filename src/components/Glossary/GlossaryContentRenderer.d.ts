import React from 'react';
interface GlossaryContentRendererProps {
    markdownContent: string;
    onNavigate?: (termId: string) => void;
    className?: string;
}
/**
 * Expands glossary link shorthand syntaxes to full HTML spans.
 * Only creates links for terms that exist in the validTermIds set.
 *
 * Supports multiple formats for writing glossary links more concisely:
 *
 * SHORTHAND FORMATS (use these in source content):
 * - [[term_id]]           -> displays "Term Id" (auto title-cased)
 * - [[term_id|Display]]   -> displays "Display" linking to term_id
 * - {{term_id}}           -> same as [[term_id]]
 * - {{term_id|Display}}   -> same as [[term_id|Display]]
 * - <g t="id">Text</g>    -> ultra-compact, 18 chars vs 70+
 *
 * COMPARISON (linking "Rage" to "rage"):
 * - Old: <span data-term-id="rage" class="glossary-term-link-from-markdown">Rage</span> (70 chars)
 * - New: [[rage|Rage]] (12 chars) or <g t="rage">Rage</g> (18 chars)
 * - Auto: [[rage]] (8 chars) -> auto-displays "Rage"
 *
 * If a term doesn't exist in the glossary, the shorthand is replaced with just the display text (no link).
 */
export declare const expandGlossaryShorthand: (content: string, validTermIds?: Set<string>, loadableTermIds?: Set<string>) => string;
export declare const GlossaryContentRenderer: React.FC<GlossaryContentRendererProps>;
export {};
