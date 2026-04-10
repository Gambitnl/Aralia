import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script generates the dedicated tracker for the canonical-retrieval lane.
 *
 * The broader spell-truth tracker mixes many lanes together. This file exists so
 * the owner can see only the retrieval stages for each spell: whether a D&D Beyond
 * page was mapped and whether the raw canonical snapshot has been written into the
 * spell reference markdown file yet.
 *
 * Called manually by: Codex during the canonical-retrieval lane
 * Depends on:
 * - `public/data/spells/**`
 * - `.agent/roadmap-local/spell-validation/spell-corpus-dndbeyond-report.json`
 * Writes:
 * - `docs/tasks/spells/SPELL_CANONICAL_RETRIEVAL_TRACKER.md`
 */

// ============================================================================
// Paths
// ============================================================================
// This section centralizes the corpus inputs and the tracker output file so the
// generator stays stable no matter which working directory invoked it.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const CORPUS_REPORT_PATH = path.resolve(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-corpus-dndbeyond-report.json');
const TRACKER_OUT = path.resolve(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_CANONICAL_RETRIEVAL_TRACKER.md');
const SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const CANONICAL_ONLY_MARKER = '<!-- CANONICAL-ONLY-REFERENCE -->';
const RETRIEVAL_EXCLUDED_IDS = new Set([
  'galders-tower',
  'galders-speedy-courier',
  'blade-of-disaster',
]);
const APPROVED_ALTERNATE_SOURCE_BY_ID = new Map([
  ['arcane-sword', 'Approved alternate source: https://roll20.net/compendium/dnd5e/Arcane%20Sword#content'],
]);

interface SpellEntry {
  id: string;
  name: string;
  level: number;
  levelFolder: string;
  markdownPath: string;
}

interface CorpusReportSpellResult {
  spellId: string;
  matchedListing: boolean;
  listingUrl: string;
}

interface TrackerStageRecord {
  pageFound: boolean;
  mdWritten: boolean;
  captureComplete: boolean;
  notes: string;
}

// ============================================================================
// Corpus loading
// ============================================================================
// This section builds the live spell list from JSON, then layers the known page
// mapping report on top of that list. The markdown files themselves are now the
// canonical retrieval storage surface, so no separate bulk capture artifact is used.
// ============================================================================

function listSpellEntries(): SpellEntry[] {
  const entries: SpellEntry[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelFolder = `level-${level}`;
    const jsonDir = path.join(SPELL_JSON_ROOT, levelFolder);
    const markdownDir = path.join(REPO_ROOT, 'docs', 'spells', 'reference', levelFolder);
    if (!fs.existsSync(jsonDir)) continue;

    const files = fs.readdirSync(jsonDir)
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const jsonPath = path.join(jsonDir, file);
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;

      entries.push({
        id: typeof parsed.id === 'string' ? parsed.id : path.basename(file, '.json'),
        name: typeof parsed.name === 'string' ? parsed.name : path.basename(file, '.json'),
        level: typeof parsed.level === 'number' ? parsed.level : level,
        levelFolder,
        markdownPath: path.join(markdownDir, file.replace(/\.json$/i, '.md')),
      });
    }
  }

  return entries;
}

function readCorpusReport(): Map<string, CorpusReportSpellResult> {
  const parsed = JSON.parse(fs.readFileSync(CORPUS_REPORT_PATH, 'utf8')) as { spellResults: CorpusReportSpellResult[] };
  return new Map(parsed.spellResults.map((entry) => [entry.spellId, entry]));
}

// ============================================================================
// Stage resolution
// ============================================================================
// This section translates the raw artifacts into the checklist stages the owner
// wants to see. The tracker is not trying to infer truth; it is only showing the
// current retrieval state for each spell.
// ============================================================================

function markdownHasSnapshot(markdownPath: string): boolean {
  if (!fs.existsSync(markdownPath)) return false;
  return fs.readFileSync(markdownPath, 'utf8').includes(SNAPSHOT_HEADING);
}

function markdownIsCanonicalOnly(markdownPath: string): boolean {
  if (!fs.existsSync(markdownPath)) return false;
  return fs.readFileSync(markdownPath, 'utf8').includes(CANONICAL_ONLY_MARKER);
}

function resolveStages(
  spell: SpellEntry,
  reportBySpellId: Map<string, CorpusReportSpellResult>,
): TrackerStageRecord {
  if (RETRIEVAL_EXCLUDED_IDS.has(spell.id)) {
    return {
      pageFound: true,
      mdWritten: true,
      captureComplete: true,
      notes: 'Excluded from active canonical retrieval backlog by user decision.',
    };
  }

  const reportEntry = reportBySpellId.get(spell.id);
  const pageFound = Boolean(reportEntry?.matchedListing && reportEntry.listingUrl);
  const mdWritten = markdownHasSnapshot(spell.markdownPath);
  const hasApprovedAlternateSource = APPROVED_ALTERNATE_SOURCE_BY_ID.has(spell.id);
  const captureComplete = (pageFound || hasApprovedAlternateSource) && mdWritten;

  if (!pageFound) {
    if (hasApprovedAlternateSource && mdWritten) {
      return {
        pageFound: true,
        mdWritten,
        captureComplete,
        notes: 'Captured and written using the approved alternate source.',
      };
    }

    return {
      pageFound,
      mdWritten,
      captureComplete,
      notes: APPROVED_ALTERNATE_SOURCE_BY_ID.get(spell.id) ?? 'Needs alternate source or new page mapping.',
    };
  }

  if (mdWritten) {
    return {
      pageFound,
      mdWritten,
      captureComplete,
      notes: markdownIsCanonicalOnly(spell.markdownPath)
        ? 'Captured and written into a canonical-only placeholder markdown file.'
        : 'Captured and written into the existing spell reference markdown file.',
    };
  }

  return {
    pageFound,
    mdWritten,
    captureComplete,
    notes: 'Ready for canonical capture.',
  };
}

// ============================================================================
// Markdown rendering
// ============================================================================
// This section renders a compact per-level table. The owner asked for stage
// checkoffs, so each stage gets its own column rather than being collapsed into
// one broad checkbox.
// ============================================================================

function asCheckmark(value: boolean): string {
  return value ? 'x' : ' ';
}

function renderTracker(entries: SpellEntry[], reportBySpellId: Map<string, CorpusReportSpellResult>): string {
  const lines: string[] = [
    '# Spell Canonical Retrieval Tracker',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Total Spells In Corpus: ${entries.length}`,
    '',
    'This tracker is the dedicated execution surface for the canonical-retrieval lane only.',
    '',
    'Stage meanings:',
    '- `Page Found`: an existing D&D Beyond page mapping is available from the corpus review artifact',
    '- `Wrote MD`: the spell reference markdown already contains the raw canonical snapshot block',
    '- `Complete`: the retrieval lane is complete for that spell because the mapped page was found and the markdown now stores the canonical capture',
    '',
  ];

  for (let level = 0; level <= 9; level += 1) {
    const levelEntries = entries.filter((entry) => entry.level === level);
    if (levelEntries.length === 0) continue;

    lines.push(`## Level ${level} (${levelEntries.length})`);
    lines.push('');
    lines.push('| Spell | Page Found | Wrote MD | Complete | Notes |');
    lines.push('| --- | --- | --- | --- | --- |');

    for (const spell of levelEntries) {
      const stages = resolveStages(spell, reportBySpellId);
      lines.push(`| ${spell.name} | [${asCheckmark(stages.pageFound)}] | [${asCheckmark(stages.mdWritten)}] | [${asCheckmark(stages.captureComplete)}] | ${stages.notes} |`);
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

// ============================================================================
// Execution
// ============================================================================
// This section writes the tracker to the spell task docs lane.
// ============================================================================

function main(): void {
  const entries = listSpellEntries();
  const reportBySpellId = readCorpusReport();
  const content = renderTracker(entries, reportBySpellId);
  fs.writeFileSync(TRACKER_OUT, content, 'utf8');
  console.log(`Wrote canonical retrieval tracker to ${TRACKER_OUT}`);
  console.log(`Tracked ${entries.length} spells.`);
}

main();
