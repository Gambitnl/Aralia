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
 * Whether a glossary entry resolves to renderable content when opened.
 * Mirrors the modal's loaders: spell entries render from their bundled JSON
 * (`hasSpellJson`), every other entry renders from its `filePath`. An entry
 * with neither cannot display anything — its inline links are "broken".
 */
const isEntryLoadable = (entry: GlossaryEntry): boolean =>
  entry.category === 'Spells' ? !!entry.hasSpellJson : !!entry.filePath;

/**
 * Build the Set of term IDs (and aliases) that resolve to a LOADABLE entry.
 * A term not in this set either doesn't exist or has no displayable content, so
 * its inline link is rendered in red instead of the usual blue.
 */
const buildLoadableTermIds = (entries: GlossaryEntry[] | null): Set<string> => {
  const ids = new Set<string>();
  if (!entries) return ids;

  const addIds = (entryList: GlossaryEntry[]) => {
    for (const entry of entryList) {
      if (isEntryLoadable(entry)) {
        ids.add(entry.id);
        if (entry.aliases) {
          entry.aliases.forEach(alias => ids.add(alias.toLowerCase().replace(/\s+/g, '_')));
        }
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
export const expandGlossaryShorthand = (content: string, validTermIds?: Set<string>, loadableTermIds?: Set<string>): string => {
  // Pattern 1: [[term_id]] or [[term_id|Display Text]]
  const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  // Pattern 2: {{term_id}} or {{term_id|Display Text}}
  const mustachePattern = /\{\{([^}|]+)(?:\|([^}]+))?\}\}/g;

  // Pattern 3: <g t="term_id">Display</g> - compact custom element
  const compactElementPattern = /<g\s+t="([^"]+)"(?:\s+c="([^"]+)")?>(.*?)<\/g>/g;

  // Convert a snake_case term id into a clean, title-cased display label, and
  // reconstruct possessive apostrophes that were lost when the id was slugified.
  // `magic_initiate` -> `Magic Initiate`; `holy_symbol` -> `Holy Symbol`;
  // `calligrapher_s_supplies` -> `Calligrapher's Supplies` (the `_s_` run is a
  // collapsed possessive, so it becomes "'s " rather than " s ").
  const titleCaseFromId = (id: string): string =>
    id
      .replace(/_s_/g, "'s_")          // collapsed possessive: calligrapher_s_supplies -> calligrapher's_supplies
      .replace(/_s$/g, "'s")            // trailing possessive: smith_s -> smith's
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/'S\b/g, "'s");          // keep the possessive "s" lowercase after title-casing

  // Normalize the raw token inside [[...]]/{{...}} into a clean { id, display }.
  //
  // Some upstream-ingested entries carry a corrupted token where the snake_case
  // id has had a redundant word (and sometimes a mangled possessive) appended,
  // e.g. `[[magic_initiate Initiate]]`, `[[holy_symbol Symbol]]`, or
  // `[[calligrapher_s_supplies's Supplies]]`. The leading snake_case run is the
  // real term id; everything after it (an echoed word and/or a stray `'s`
  // possessive) is garbage to be discarded.
  //
  // We therefore split the id from any trailing display fragment, validate the
  // id against the known-terms set, and derive the display label from the id
  // itself so the link reads "Magic Initiate" (a link to itself), not
  // "Magic Initiate Initiate". This makes the term replacement idempotent.
  const normalizeTermToken = (rawTermId: string, displayText?: string): { id: string; display: string } => {
    const raw = rawTermId.trim();

    // The id is the leading run up to the first whitespace OR the first stray
    // apostrophe-possessive. `holy_symbol Symbol` -> `holy_symbol`;
    // `calligrapher_s_supplies's Supplies` -> `calligrapher_s_supplies`.
    const cut = raw.search(/\s|'/);
    let id = cut === -1 ? raw : raw.slice(0, cut);

    // If the leading run isn't a known term, try the full token with whitespace
    // collapsed to underscores — this rescues cleanly-authored multi-word ids
    // (e.g. an actual `[[some multi word]]` whose id is `some_multi_word`).
    if (validTermIds && !validTermIds.has(id)) {
      const collapsedRaw = raw.replace(/'/g, '').replace(/\s+/g, '_');
      if (validTermIds.has(collapsedRaw)) id = collapsedRaw;
    }

    // Explicit display text (from `[[id|Display]]`) always wins; otherwise the
    // label is derived purely from the resolved id, never from the echoed garbage.
    const display = displayText && displayText.trim()
      ? displayText.trim()
      : titleCaseFromId(id);

    return { id, display };
  };

  // Helper to create the span HTML or just return display text if term doesn't exist
  const createSpanOrText = (termId: string, displayText?: string): string => {
    const { id: trimmedId, display } = normalizeTermToken(termId, displayText);

    // A link "works" only if it opens to renderable content. When loadability
    // info is supplied, a term is broken unless it resolves to a loadable entry
    // (missing, or present-but-no-content both count as broken). Without that
    // info, fall back to bare existence in the index.
    const isWorking = loadableTermIds
      ? loadableTermIds.has(trimmedId)
      : !!(validTermIds && validTermIds.has(trimmedId));

    // Broken links are rendered red with a help cursor + tooltip so it's obvious
    // they won't open anything; working links keep the default (blue) style.
    const extraClass = isWorking ? '' : ' text-red-500 underline decoration-dotted opacity-80 cursor-help';
    const titleAttr = isWorking ? '' : ' title="Glossary entry unavailable"';

    return `<span data-term-id="${trimmedId}" class="glossary-term-link-from-markdown${extraClass}"${titleAttr}>${display}</span>`;
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

  // Keep track of which collapsible cards are open so we can preserve their state across parent re-renders/HMR
  const openCardsRef = useRef<Set<string>>(new Set());

  // Build the set of valid term IDs once when the index changes
  const validTermIds = useMemo(() => buildValidTermIds(glossaryIndex), [glossaryIndex]);
  // Subset that actually resolves to renderable content — drives the red "broken" styling.
  const loadableTermIds = useMemo(() => buildLoadableTermIds(glossaryIndex), [glossaryIndex]);

  const structuredHtml = useMemo(() => {
    if (!markdownContent) return '';

    // Normalize doubled label colons before anything else. Some upstream-ingested
    // entries emit field labels that already end in ":" and then have a separator
    // ":" appended, producing "Feat::", "Ability Scores::", "Equipment::". Collapse
    // any run of 2+ colons back to a single colon so labels read "Feat:" not "Feat::".
    const deColoned = markdownContent.replace(/:{2,}/g, ':');

    // First expand any shorthand glossary link syntaxes, validating against known terms
    const expandedContent = expandGlossaryShorthand(deColoned, validTermIds, loadableTermIds);

    // Replace Markdown horizontal rules with styled HTML ones before parsing.
    // The surrounding blank lines are REQUIRED: a raw `<hr />` opens an HTML block
    // that swallows every following line until a blank line, so `---` immediately
    // followed by a `## Heading` would emit the heading as literal text. Padding
    // with blank lines keeps the rule isolated and lets the next block parse.
    const preppedMarkdown = expandedContent.replace(/^---$/gm, '\n<hr />\n');

    const rawHtml = marked.parse(preppedMarkdown, { gfm: true, breaks: true, async: false }) as string;
    const safeHtml = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = safeHtml;

    const finalContainer = document.createElement('div');
    let currentDetails: HTMLDetailsElement | null = null;
    let currentContentDiv: HTMLDivElement | null = null;
    let inFeatureSection = false;
    let featureCardIndex = 0;

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
        featureCardIndex++;
        const cardId = `feature-card-${featureCardIndex}`;
        
        currentDetails = document.createElement('details');
        currentDetails.className = 'feature-card';
        
        // Preserve collapsible card open state across re-renders for the same entry
        if (openCardsRef.current.has(cardId)) {
          currentDetails.open = true;
          currentDetails.setAttribute('open', '');
        }

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
  }, [markdownContent, validTermIds, loadableTermIds]);

  useEffect(() => {
    if (structuredHtml && contentRef.current && onNavigate) {
      const cleanupFunctions: Array<() => void> = [];

      // Use EVENT DELEGATION on the stable container instead of binding a listener
      // to each span. The spans live inside `dangerouslySetInnerHTML`, so their DOM
      // nodes are recreated whenever the HTML re-commits — per-node listeners get
      // silently orphaned onto detached nodes. The container element is owned by
      // React and persists, so one delegated listener reliably catches every term
      // click, now and after any re-render.
      const container = contentRef.current;
      const termIdFromEvent = (target: EventTarget | null): string | null => {
        if (!(target instanceof Element)) return null;
        const link = target.closest<HTMLElement>('span.glossary-term-link-from-markdown[data-term-id]');
        return link?.getAttribute('data-term-id') ?? null;
      };
      const clickHandler = (e: MouseEvent) => {
        const termId = termIdFromEvent(e.target);
        if (termId) {
          e.preventDefault();
          e.stopPropagation();
          onNavigate(termId);
        }
      };
      const keydownHandler = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const termId = termIdFromEvent(e.target);
        if (termId) {
          e.preventDefault();
          e.stopPropagation();
          onNavigate(termId);
        }
      };
      container.addEventListener('click', clickHandler);
      container.addEventListener('keydown', keydownHandler);
      cleanupFunctions.push(() => {
        container.removeEventListener('click', clickHandler);
        container.removeEventListener('keydown', keydownHandler);
      });

      // Track toggling of details cards to preserve open/collapse state
      const detailsElements = contentRef.current.querySelectorAll('details.feature-card');
      detailsElements.forEach((detailsEl, index) => {
        const htmlDetails = detailsEl as HTMLDetailsElement;
        const cardId = `feature-card-${index + 1}`;
        
        const toggleHandler = () => {
          if (!htmlDetails.isConnected) return;
          if (htmlDetails.open) {
            openCardsRef.current.add(cardId);
          } else {
            openCardsRef.current.delete(cardId);
          }
        };
        htmlDetails.addEventListener('toggle', toggleHandler);
        
        cleanupFunctions.push(() => htmlDetails.removeEventListener('toggle', toggleHandler));
      });

      return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
      };
    }
  }, [structuredHtml, onNavigate]);

  return <div ref={contentRef} className={className} dangerouslySetInnerHTML={{ __html: structuredHtml }} />;
};
