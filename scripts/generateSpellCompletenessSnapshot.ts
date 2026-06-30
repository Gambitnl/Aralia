import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates the maintained local Spell Completeness Audit snapshot.
 *
 * The retired 2025 report is useful history, but it cannot answer current
 * corpus questions because the live JSON/reference trees have moved on. This
 * script keeps the replacement snapshot local and deterministic: it reads the
 * current repository spell corpus, compares JSON files with reference markdown,
 * records legacy canonical-snapshot blockers, and states separate dataset and
 * runtime gates so data coverage is not mistaken for playable spell proof.
 *
 * Called by: `npm run spells:completeness`
 * Writes to:
 * - `docs/projects/spells/subprojects/spell-completeness-audit/SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md`
 */

// ============================================================================
// Paths and constants
// ============================================================================
// These paths are resolved from the script location so the generator behaves the
// same way no matter which shell directory calls it.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const SPELL_REFERENCE_ROOT = path.resolve(REPO_ROOT, 'docs', 'spells', 'reference');
const SNAPSHOT_OUT = path.resolve(
  REPO_ROOT,
  'docs',
  'projects',
  'spells',
  'subprojects',
  'spell-completeness-audit',
  'SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md',
);

const LEGACY_MARKER = 'Legacy Page: true';
const GUARDIAN_OF_NATURE_ID = 'guardian-of-nature';
const GENERATED_AT = new Date().toISOString();

interface SpellFileEntry {
  id: string;
  level: number;
  relativePath: string;
  absolutePath: string;
}

interface LevelCoverage {
  level: number;
  jsonCount: number;
  referenceCount: number;
  missingReferenceIds: string[];
  missingJsonIds: string[];
}

interface LegacyReference {
  id: string;
  level: number;
  relativePath: string;
}

// ============================================================================
// Corpus discovery
// ============================================================================
// The live spell corpus is the JSON tree plus the current per-spell reference
// markdown tree. The generator compares file ids by level rather than trusting
// older summary documents.
// ============================================================================

function listSpellFiles(root: string, extension: '.json' | '.md'): SpellFileEntry[] {
  const entries: SpellFileEntry[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelDir = path.join(root, `level-${level}`);
    if (!fs.existsSync(levelDir)) continue;

    for (const fileName of fs.readdirSync(levelDir).sort((a, b) => a.localeCompare(b))) {
      if (!fileName.endsWith(extension)) continue;
      if (extension === '.md' && fileName.endsWith('.scenarios.md')) continue;

      const absolutePath = path.join(levelDir, fileName);
      entries.push({
        id: path.basename(fileName, extension),
        level,
        relativePath: path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/'),
        absolutePath,
      });
    }
  }

  return entries;
}

function groupByLevel(entries: SpellFileEntry[]): Map<number, SpellFileEntry[]> {
  const grouped = new Map<number, SpellFileEntry[]>();

  for (const entry of entries) {
    const levelEntries = grouped.get(entry.level) ?? [];
    levelEntries.push(entry);
    grouped.set(entry.level, levelEntries);
  }

  return grouped;
}

function buildLevelCoverage(jsonEntries: SpellFileEntry[], referenceEntries: SpellFileEntry[]): LevelCoverage[] {
  const jsonByLevel = groupByLevel(jsonEntries);
  const referenceByLevel = groupByLevel(referenceEntries);
  const results: LevelCoverage[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const jsonIds = new Set((jsonByLevel.get(level) ?? []).map((entry) => entry.id));
    const referenceIds = new Set((referenceByLevel.get(level) ?? []).map((entry) => entry.id));

    results.push({
      level,
      jsonCount: jsonIds.size,
      referenceCount: referenceIds.size,
      missingReferenceIds: [...jsonIds].filter((id) => !referenceIds.has(id)).sort(),
      missingJsonIds: [...referenceIds].filter((id) => !jsonIds.has(id)).sort(),
    });
  }

  return results;
}

// ============================================================================
// Source and proof blockers
// ============================================================================
// Legacy canonical markers and incomplete local source text block stronger
// canonical claims. They are reported separately from JSON/reference count
// parity so the dataset gate remains honest.
// ============================================================================

function findLegacyReferences(referenceEntries: SpellFileEntry[]): LegacyReference[] {
  return referenceEntries
    .filter((entry) => fs.readFileSync(entry.absolutePath, 'utf8').includes(LEGACY_MARKER))
    .map((entry) => ({
      id: entry.id,
      level: entry.level,
      relativePath: entry.relativePath,
    }));
}

function guardianOfNatureSourceStatus(jsonEntries: SpellFileEntry[], referenceEntries: SpellFileEntry[]): string {
  const guardianJson = jsonEntries.find((entry) => entry.id === GUARDIAN_OF_NATURE_ID);
  const guardianReference = referenceEntries.find((entry) => entry.id === GUARDIAN_OF_NATURE_ID);

  const jsonText = guardianJson ? fs.readFileSync(guardianJson.absolutePath, 'utf8') : '';
  const referenceText = guardianReference ? fs.readFileSync(guardianReference.absolutePath, 'utf8') : '';
  const combined = `${jsonText}\n${referenceText}`;
  const normalizedReferenceText = referenceText.replace(/\r\n/g, '\n');
  const rulesTextMatch = normalizedReferenceText.match(/Rules Text:\s*([\s\S]*?)\n\nSpell Tags:/);
  const rulesText = rulesTextMatch?.[1] ?? combined;
  const hasFormNames = combined.includes('Primal Beast') && combined.includes('Great Tree');
  const hasBenefitPlaceholder = rulesText.includes('you gain the following benefits:');
  const hasConcreteBenefitSignals = /walking speed|climb speed|darkvision|advantage|temporary hit points|difficult terrain/i.test(rulesText);

  if (!guardianJson || !guardianReference) {
    return 'blocked: Guardian of Nature is missing either JSON or reference markdown.';
  }

  if (hasFormNames && hasBenefitPlaceholder && hasConcreteBenefitSignals) {
    return 'needs-human-review: local text has form names and possible benefit signals, but the generator does not certify mechanics from prose.';
  }

  if (hasFormNames && hasBenefitPlaceholder) {
    return 'blocked: local JSON/reference text names Primal Beast and Great Tree but still omits the actual benefit bullets.';
  }

  return 'blocked: local source text is insufficient to prove Guardian of Nature form mechanics.';
}

// ============================================================================
// Rendering
// ============================================================================
// The snapshot deliberately separates dataset coverage from runtime proof. A
// count-matched corpus can still have unimplemented playable mechanics.
// ============================================================================

function formatIdList(ids: string[]): string {
  return ids.length === 0 ? 'none' : ids.map((id) => `\`${id}\``).join(', ');
}

function renderSnapshot(): string {
  const jsonEntries = listSpellFiles(SPELL_JSON_ROOT, '.json');
  const referenceEntries = listSpellFiles(SPELL_REFERENCE_ROOT, '.md');
  const levelCoverage = buildLevelCoverage(jsonEntries, referenceEntries);
  const legacyReferences = findLegacyReferences(referenceEntries);
  const guardianStatus = guardianOfNatureSourceStatus(jsonEntries, referenceEntries);
  const missingReferenceTotal = levelCoverage.reduce((sum, level) => sum + level.missingReferenceIds.length, 0);
  const missingJsonTotal = levelCoverage.reduce((sum, level) => sum + level.missingJsonIds.length, 0);
  const jsonTotal = jsonEntries.length;
  const referenceTotal = referenceEntries.length;
  const datasetGatePasses = jsonTotal === referenceTotal && missingReferenceTotal === 0 && missingJsonTotal === 0;
  const canonicalGatePasses = legacyReferences.length === 0 && !guardianStatus.startsWith('blocked:');

  const lines: string[] = [
    '# Spell Completeness Coverage Snapshot',
    '',
    `Generated: ${GENERATED_AT}`,
    '',
    'This is the maintained local replacement for stale late-2025 spell completeness counts.',
    'It is generated from the current repository state and does not claim a fresh external PHB recapture.',
    '',
    '## Dataset Coverage Gate',
    '',
    'Gate definition: every live spell JSON file must have a matching per-spell reference markdown file at the same level, and every reference markdown file must have a matching JSON file at the same level.',
    '',
    `Current result: ${datasetGatePasses ? 'PASS' : 'FAIL'}.`,
    '',
    `- JSON spell files: ${jsonTotal}`,
    `- Reference markdown files: ${referenceTotal}`,
    `- Missing reference files for JSON ids: ${missingReferenceTotal}`,
    `- Missing JSON files for reference ids: ${missingJsonTotal}`,
    '',
    '| Level | JSON files | Reference files | Missing reference ids | Missing JSON ids |',
    '|---:|---:|---:|---|---|',
  ];

  for (const level of levelCoverage) {
    lines.push(`| ${level.level} | ${level.jsonCount} | ${level.referenceCount} | ${formatIdList(level.missingReferenceIds)} | ${formatIdList(level.missingJsonIds)} |`);
  }

  lines.push(
    '',
    '## Canonical Source Gate',
    '',
    'Gate definition: canonical-vs-structured claims require current-era source snapshots or explicit source-deferral notes for every legacy/incomplete snapshot.',
    '',
    `Current result: ${canonicalGatePasses ? 'PASS' : 'FAIL'}.`,
    '',
    `- Legacy reference markers remaining: ${legacyReferences.length}`,
    `- Guardian of Nature source status: ${guardianStatus}`,
    '',
    '### Legacy Reference Audit',
    '',
    '| Spell id | Level | Status | Owner | Reason | Next proof boundary | Evidence |',
    '|---|---:|---|---|---|---|---|',
  );

  for (const legacy of legacyReferences) {
    lines.push(`| \`${legacy.id}\` | ${legacy.level} | documented source deferral | Spell Completeness Audit / canonical recapture owner | The local reference still carries the legacy-era marker, so this generator cannot certify current canonical text from repo evidence alone. | Replace the snapshot with trustworthy current source text or keep an explicit source-owner deferral before closing G3. | \`${legacy.relativePath}\` still contains \`${LEGACY_MARKER}\` |`);
  }

  if (legacyReferences.length === 0) {
    lines.push('| none |  | pass | none | no legacy markers found | no recapture needed | current scan found zero legacy markers |');
  }

  lines.push(
    '',
    '## Runtime Verification Gate',
    '',
    'Gate definition: runtime completion requires focused proof for representative spell mechanics, not just JSON/reference count parity.',
    '',
    'Current result: FAIL.',
    '',
    'Runtime proof remains open while active Spells subproject rows still carry implementation-unverified or active runtime gaps. This snapshot therefore treats the corpus as dataset-count complete but not runtime-complete.',
    '',
    'Minimum proof required before this gate can pass:',
    '',
    '- focused validation for changed spell JSON/reference/schema artifacts',
    '- focused command/factory/runtime tests for any newly wired spell mechanic family',
    '- dated proof rows in the owning Spells child lane',
    '- no active runtime gap claiming only metadata presence as completion proof',
    '',
    '## Gap Mapping',
    '',
    '| Gap | Snapshot result | Follow-up |',
    '|---|---|---|',
    `| G1 stale local report | resolved locally: stale 2025 counts are replaced by this generated ${jsonTotal} JSON / ${referenceTotal} reference snapshot | fresh external PHB recapture remains represented by the canonical source gate, not by the retired local report |`,
    `| G3 legacy snapshots | resolved as documented deferrals: ${legacyReferences.length} legacy markers remain with owner, reason, next proof boundary, and evidence rows above | future source owner may recapture these snapshots, but the current code-backed audit no longer leaves them implicit |`,
    '| G4 missing completion gates | dataset, canonical source, and runtime gates are now defined here | keep applying these gates before marking spell migration complete |',
    `| G5 Guardian of Nature | ${guardianStatus} | do not encode form mechanics until trustworthy benefit text exists locally |`,
    '',
  );

  return `${lines.join('\n').trimEnd()}\n`;
}

function main(): void {
  fs.mkdirSync(path.dirname(SNAPSHOT_OUT), { recursive: true });
  fs.writeFileSync(SNAPSHOT_OUT, renderSnapshot(), 'utf8');
  console.log(`Wrote ${SNAPSHOT_OUT}`);
}

main();
