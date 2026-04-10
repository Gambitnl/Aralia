// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 30/03/2026, 01:32:38
 * Dependents: components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/Glossary/GlossaryEntryPanel.tsx, components/Glossary/SingleGlossaryEntryModal.tsx, components/Glossary/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useState } from 'react';
import { GlossaryEntry } from '../../types';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { assetUrl } from '../../config/env';
import { GlossaryEntryTemplate } from './GlossaryEntryTemplate';

/**
 * This file loads full glossary entry content and now also applies spell-rule enrichment.
 *
 * The glossary already knows how to fetch a rule entry from its normal JSON file, but the
 * spell-canonical lane introduced a second layer of truth: some rule terms are referenced by
 * captured spell pages and should show a "Referenced By Spells" section when the owner opens
 * that rule in the glossary. Instead of rewriting every rule JSON file, this component merges
 * the enrichment data in at render time.
 *
 * Called by: GlossaryEntryPanel when the selected entry is not a spell card
 * Depends on: glossary JSON files, spell_referenced_rules_enrichment.json, GlossaryEntryTemplate
 */

// ============================================================================
// Enrichment dataset types and cache
// ============================================================================
// This section describes the small slice of the referenced-rules enrichment file
// that the renderer cares about. The file is shared project data, so the viewer
// caches it in memory instead of re-downloading it every time a rule entry opens.
// ============================================================================

const REFERENCED_RULES_ENRICHMENT_PATH = '/data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json';

interface ReferencedBySpellRecord {
  spellId: string;
  spellName: string;
  level: number;
}

interface ReferencedRuleLookupRecord {
  glossaryTermId: string;
  label: string;
  spells: ReferencedBySpellRecord[];
}

interface ReferencedRulesEnrichmentPayload {
  enrichmentDataset?: {
    rulesByGlossaryTermId?: Record<string, ReferencedRuleLookupRecord>;
  };
}

let referencedRulesLookupPromise: Promise<Record<string, ReferencedRuleLookupRecord>> | null = null;

/**
 * Load the referenced-rules lookup only once per session.
 *
 * Why it exists:
 * Every rule entry could ask for the same enrichment file. Caching keeps the
 * glossary responsive and avoids turning this feature into a repeated network cost.
 */
const loadReferencedRulesLookup = async (): Promise<Record<string, ReferencedRuleLookupRecord>> => {
  if (!referencedRulesLookupPromise) {
    referencedRulesLookupPromise = fetchWithTimeout<ReferencedRulesEnrichmentPayload>(assetUrl(REFERENCED_RULES_ENRICHMENT_PATH))
      .then((payload) => payload.enrichmentDataset?.rulesByGlossaryTermId ?? {})
      .catch((error) => {
        console.error('Error loading spell referenced-rules enrichment:', error);
        return {};
      });
  }

  return referencedRulesLookupPromise;
};

// ============================================================================
// Markdown enrichment helpers
// ============================================================================
// This section converts the machine-readable rule lookup into a markdown section
// that the normal glossary renderer already knows how to display and cross-link.
// ============================================================================

const stripMainHeading = (markdownContent: string): string => {
  // Remove YAML frontmatter if it exists
  const yamlFrontmatterRegex = /^\s*---([\s\S]*?)---(?:\r?\n|\r|$)/;
  let content = markdownContent.replace(yamlFrontmatterRegex, '').trimStart();

  // TODO: Improve heading removal to support alternate Markdown H1 syntax (e.g., 'Title\n===') or use a Markdown AST parser to remove the first heading node safely, ensuring consistent rendering regardless of source formatting.
  // Remove the first H1 heading (e.g., "# Heading") as we now render it separately
  const h1Regex = /^#\s+.+$/m;
  content = content.replace(h1Regex, '').trimStart();

  return content;
};

/**
 * Decide whether a glossary entry should receive the spell backlink section.
 *
 * What it preserves:
 * - generated referenced-rule files already contain their own backlink section
 * - non-rule entries stay untouched
 * - hand-authored files are only augmented when the enrichment dataset has real data
 */
const shouldAppendReferencedBySpells = (filePath: string | null | undefined, markdownContent: string, referencedByRule: ReferencedRuleLookupRecord | undefined): boolean => {
  if (!filePath || !referencedByRule || referencedByRule.spells.length === 0) return false;
  if (filePath.includes('/rules/spells/referenced/')) return false;
  if (markdownContent.includes('## Referenced By Spells')) return false;
  return true;
};

/**
 * Render the backlink section as markdown so existing glossary link shorthand can be reused.
 */
const buildReferencedBySpellsMarkdown = (referencedByRule: ReferencedRuleLookupRecord): string => {
  const lines = [
    '',
    '---',
    '## Referenced By Spells',
    '',
    ...referencedByRule.spells
      .slice()
      .sort((a, b) => a.spellName.localeCompare(b.spellName))
      .map((spell) => `- [[${spell.spellId}|${spell.spellName}]]`),
    '',
  ];

  return lines.join('\n');
};

type GlossaryEntryFileJson = {
  markdown?: string;
  content?: string;
};

interface FullEntryDisplayProps {
  entry: GlossaryEntry | null;
  onNavigate?: (termId: string) => void;
}

export const FullEntryDisplay: React.FC<FullEntryDisplayProps> = ({ entry, onNavigate }) => {
  const [fetchState, setFetchState] = useState<{
    filePath: string | null;
    markdownContent: string | null;
    enrichedEntry: GlossaryEntry | null;
    error: string | null;
  }>({
    filePath: null,
    markdownContent: null,
    enrichedEntry: null,
    error: null
  });

  const filePath = entry?.filePath;
  const markdownContent = filePath === fetchState.filePath ? fetchState.markdownContent : null;
  const enrichedEntry = filePath === fetchState.filePath ? fetchState.enrichedEntry : null;
  const error = !filePath
    ? "No file path provided for glossary entry."
    : filePath === fetchState.filePath
      ? fetchState.error
      : null;
  const loading = Boolean(filePath && filePath !== fetchState.filePath);

  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;

    const fullPath = assetUrl(filePath);
    const isJsonEntry = filePath.toLowerCase().endsWith('.json');

    const fetchPromise = isJsonEntry
      ? fetchWithTimeout<Record<string, unknown>>(fullPath)
      : fetchWithTimeout<string>(fullPath, { responseType: 'text' });

    fetchPromise
      .then(async (data) => {
        if (cancelled) return;
        const referencedRulesLookup = await loadReferencedRulesLookup();
        const referencedByRule = entry ? referencedRulesLookup[entry.id] : undefined;

        if (isJsonEntry) {
          const json = data as Record<string, unknown>;
          const nextMarkdown =
            typeof json.markdown === 'string'
              ? json.markdown
              : typeof json.content === 'string'
                ? json.content
                : '';
          const strippedMarkdown = stripMainHeading(nextMarkdown);
          const enrichedMarkdown = shouldAppendReferencedBySpells(filePath, strippedMarkdown, referencedByRule)
            ? `${strippedMarkdown.trimEnd()}\n${buildReferencedBySpellsMarkdown(referencedByRule!)}`
            : strippedMarkdown;

          setFetchState({
            filePath,
            markdownContent: enrichedMarkdown,
            enrichedEntry: { ...entry, ...json } as GlossaryEntry,
            error: null
          });
          return;
        }

        const text = data as string;
        const strippedMarkdown = stripMainHeading(text);
        const enrichedMarkdown = shouldAppendReferencedBySpells(filePath, strippedMarkdown, referencedByRule)
          ? `${strippedMarkdown.trimEnd()}\n${buildReferencedBySpellsMarkdown(referencedByRule!)}`
          : strippedMarkdown;
        setFetchState({
          filePath,
          markdownContent: enrichedMarkdown,
          enrichedEntry: entry,
          error: null
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error(`Error fetching ${filePath}:`, err);
        setFetchState({
          filePath,
          markdownContent: null,
          enrichedEntry: null,
          error: err.message
        });
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, entry]); // Added entry as dependency to ensure we merge the right data

  if (loading) return <p className="text-gray-400 italic">Loading full entry...</p>;
  if (error) return <p className="text-red-400">Error loading content: {error}</p>;
  if (!markdownContent && !enrichedEntry) return <p className="text-gray-500 italic">No content found for this entry.</p>;

  return (
    <GlossaryEntryTemplate
      entry={enrichedEntry || entry}
      markdownContent={markdownContent}
      onNavigate={onNavigate}
    />
  );
};
