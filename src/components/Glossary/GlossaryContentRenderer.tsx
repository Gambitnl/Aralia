import React, { useMemo, useEffect, useRef, useContext } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import GlossaryContext from '../../context/GlossaryContext';
import { GlossaryEntry } from '../../types';

interface GlossaryContentRendererProps {
  markdownContent: string;
  onNavigate?: (termId: string) => void;
  className?: string;
}

type GlossaryLinkElement = HTMLSpanElement & {
  _glossaryClickHandler?: boolean;
};

/**
 * Build a Set of all valid term IDs from the glossary index (including sub-entries).
 */
const buildValidTermIds = (entries: GlossaryEntry[] | null): Set<string> => {
  const ids = new Set<string>();
  if (!entries) return ids;

  const addIds = (entryList: GlossaryEntry[]) => {
    for (const entry of entryList) {
      ids.add(entry.id);
      // Also add aliases as valid term IDs
      if (entry.aliases) {
        entry.aliases.forEach(alias => ids.add(alias.toLowerCase().replace(/\s+/g, '_')));
      }
      if (entry.subEntries) {
        addIds(entry.subEntries);
      }
    }
  };

  addIds(entries);
  return ids;
};

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
export const expandGlossaryShorthand = (content: string, validTermIds?: Set<string>): string => {
  // Pattern 1: [[term_id]] or [[term_id|Display Text]]
  const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  // Pattern 2: {{term_id}} or {{term_id|Display Text}}
  const mustachePattern = /\{\{([^}|]+)(?:\|([^}]+))?\}\}/g;

  // Pattern 3: <g t="term_id">Display</g> - compact custom element
  const compactElementPattern = /<g\s+t="([^"]+)"(?:\s+c="([^"]+)")?>(.*?)<\/g>/g;

  // Helper to create the span HTML or just return display text if term doesn't exist
  const createSpanOrText = (termId: string, displayText?: string): string => {
    const display = displayText || termId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const trimmedId = termId.trim();

    // Determine if the link is valid (exists in the index)
    const isValid = validTermIds && validTermIds.has(trimmedId);

    // If not valid, we still render a span but with a "missing" style (red/underline) for debugging
    const extraClass = isValid ? '' : ' text-red-500 underline decoration-dotted opacity-80 cursor-help';

    return `<span data-term-id="${trimmedId}" class="glossary-term-link-from-markdown${extraClass}">${display}</span>`;
  };

  let result = content;

  // Expand [[...]] syntax
  result = result.replace(wikiLinkPattern, (_, termId, display) => createSpanOrText(termId.trim(), display?.trim()));

  // Expand {{...}} syntax
  result = result.replace(mustachePattern, (_, termId, display) => createSpanOrText(termId.trim(), display?.trim()));

  // Expand <g t="...">...</g> syntax
  result = result.replace(compactElementPattern, (_, termId, _cls, display) => createSpanOrText(termId.trim(), display?.trim()));

  return result;
};

// Security Hardening: Ensure external links are secure against tabnabbing
// Register hook once at module level to avoid duplicate hooks on re-renders
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const GlossaryContentRenderer: React.FC<GlossaryContentRendererProps> = ({ markdownContent, onNavigate, className }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const glossaryIndex = useContext(GlossaryContext);

  // Build the set of valid term IDs once when the index changes
  const validTermIds = useMemo(() => buildValidTermIds(glossaryIndex), [glossaryIndex]);

  const structuredHtml = useMemo(() => {
    if (!markdownContent) return '';

    // First expand any shorthand glossary link syntaxes, validating against known terms
    const expandedContent = expandGlossaryShorthand(markdownContent, validTermIds);

    // Replace Markdown horizontal rules with styled HTML ones before parsing
    const preppedMarkdown = expandedContent.replace(/^---$/gm, '<hr />');

    const rawHtml = marked.parse(preppedMarkdown, { gfm: true, breaks: true, async: false }) as string;
    const safeHtml = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = safeHtml;

    const finalContainer = document.createElement('div');
    let currentDetails: HTMLDetailsElement | null = null;
    let currentContentDiv: HTMLDivElement | null = null;
    let inFeatureSection = false;

    const hasFeaturesHeader = Array.from(tempDiv.querySelectorAll('h2')).some(h2 => h2.textContent?.includes('Features'));

    Array.from(tempDiv.childNodes).forEach(node => {
      const nodeName = node.nodeName;

      if (!hasFeaturesHeader) inFeatureSection = true;

      if (nodeName === 'H2' && node.textContent?.includes('Features')) {
        inFeatureSection = true;
        currentDetails = null;
        currentContentDiv = null;
        finalContainer.appendChild(node.cloneNode(true));
        return;
      }

      if (inFeatureSection && nodeName === 'H3') {
        currentDetails = document.createElement('details');
        currentDetails.className = 'feature-card';
        currentDetails.open = true;

        const summary = document.createElement('summary');
        const summaryH3 = document.createElement('h3');
        summaryH3.innerHTML = (node as HTMLElement).innerHTML;
        summary.appendChild(summaryH3);
        currentDetails.appendChild(summary);

        currentContentDiv = document.createElement('div');
        currentDetails.appendChild(currentContentDiv);

        finalContainer.appendChild(currentDetails);
      } else if (currentDetails && currentContentDiv) {
        currentContentDiv.appendChild(node.cloneNode(true));
      } else {
        finalContainer.appendChild(node.cloneNode(true));
      }
    });

    // Re-sanitize final output to ensure no DOM manipulation introduced vulnerabilities
    // Pass same config to ensure target attributes are preserved if safe
    return DOMPurify.sanitize(finalContainer.innerHTML, { ADD_ATTR: ['target'] });
  }, [markdownContent, validTermIds]);

  useEffect(() => {
    if (structuredHtml && contentRef.current && onNavigate) {
      const links = contentRef.current.querySelectorAll('span.glossary-term-link-from-markdown[data-term-id]');
      links.forEach(link => {
        const termId = link.getAttribute('data-term-id');
        if (termId) {
          const glossaryLink = link as GlossaryLinkElement;
          const handler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            onNavigate(termId);
          };
          if (!glossaryLink._glossaryClickHandler) {
            glossaryLink.addEventListener('click', handler);
            glossaryLink.addEventListener('keydown', (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handler(e);
              }
            });
            glossaryLink._glossaryClickHandler = true;
          }
        }
      });
    }
  }, [structuredHtml, onNavigate]);

  return <div ref={contentRef} className={className} dangerouslySetInnerHTML={{ __html: structuredHtml }} />;
};
