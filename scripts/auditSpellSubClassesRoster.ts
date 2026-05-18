import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Phase 1 parity script - Sub-Classes bucket (canonical -> structured),
 * roster-aware variant.
 *
 * Compares the `- **Sub-Classes**:` field in the structured Aralia block
 * against the canonical `Available For:` block in the same markdown file,
 * filtered through the supported-subclass roster doc:
 *
 *   docs/tasks/spells/sub-classes/SPELL_SUPPORTED_SUBCLASS_ROSTERS.md
 *
 * Why this exists: `auditSpellStructuredAgainstCanonical.ts` reports raw
 * field-level drift between structured and canonical, but does NOT enforce
 * Decision 6 ("only repo-supported subclasses move into normalized spell
 * data") or Decision 2 ("repeated-base entries already covered by Classes
 * are normalized away"). A spell that is correctly cleaned per those
 * decisions still surfaces as drifty in the raw audit because canonical
 * carries unsupported labels that the structured layer intentionally omits.
 *
 * This script applies both decisions before reporting drift, so it
 * surfaces only the work that's actually left to do for the
 * `incomplete_structured_subclasses` (and adjacent) subbuckets in
 * SPELL_SUB_CLASSES_BUCKET_TRACKER.md.
 *
 * Output files:
 *   docs/tasks/spells/sub-classes/SPELL_SUB_CLASSES_ROSTER_REPORT.md
 *   .agent/roadmap-local/spell-validation/spell-sub-classes-roster-report.json
 *
 * Run:
 *   npx tsx scripts/auditSpellSubClassesRoster.ts
 *   npm run audit:sub-classes-roster
 *
 * Part of: Sub-Classes bucket - Phase 1 (canonical -> structured).
 */

// ============================================================================
// Paths
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR  = path.dirname(SCRIPT_FILE);
const REPO_ROOT   = path.resolve(SCRIPT_DIR, '..');

const SPELL_REF_ROOT  = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const ROSTER_PATH     = path.join(
  REPO_ROOT, 'docs', 'tasks', 'spells', 'sub-classes',
  'SPELL_SUPPORTED_SUBCLASS_ROSTERS.md',
);
const REPORT_MD_PATH  = path.join(
  REPO_ROOT, 'docs', 'tasks', 'spells', 'sub-classes',
  'SPELL_SUB_CLASSES_ROSTER_REPORT.md',
);
const REPORT_JSON_PATH = path.join(
  REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation',
  'spell-sub-classes-roster-report.json',
);

const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const CANONICAL_FROM_FIVE_E_TOOLS_MARKER = '<!-- CANONICAL-FROM-5ETOOLS -->';

// ============================================================================
// Types
// ============================================================================

type MatchKind =
  | 'no_field'              // structured has no Sub-Classes line
  | 'empty_field'           // line present but value blank
  | 'roster_clean'          // structured already matches the roster-clean expected set
  | 'needs_strip'           // structured has unsupported or repeated-base entries to remove
  | 'needs_add'             // structured is missing roster-supported subclass-only entries
  | 'needs_both'            // both - strip + add
  | 'no_supported_access'   // canonical has no roster-supported subclass-only entries; structured should be empty or marker
  | 'marker_applied'        // structured value is one of the three sentinel markers
  | 'partial_canonical_source_boundary' // public D&D Beyond block is unavailable, but a partial 5etools identity cross-check exists
  | 'no_canonical_block';   // markdown has no canonical comment block or approved partial replacement at all

const VALID_MARKERS: ReadonlySet<string> = new Set([
  'Folded into Classes',
  'Unsupported Entries',
  'No Subclass Entries',
]);

type Marker =
  | 'Folded into Classes'   // all canonical subclass entries have a parent class already in `Classes`
  | 'Unsupported Entries'   // canonical has subclass entries but none are roster-supported (with or without repeated-base mixed in)
  | 'No Subclass Entries';  // canonical has zero `Class - Subclass` entries in `Available For`

interface SpellRecord {
  spellId:               string;
  spellName:             string;
  level:                 number;
  mdPath:                string;
  classes:               string[];
  structuredEntries:     string[];   // raw `Class - Subclass` entries from the structured field
  canonicalEntries:      string[];   // raw `Class - Subclass` entries from canonical Available For
  expectedEntries:       string[];   // what structured *should* hold per Decision 6 + 2
  toStrip:               string[];   // entries currently in structured that don't belong
  toAdd:                 string[];   // entries that belong but aren't in structured
  matchKind:             MatchKind;
  recommendedMarker?:    Marker;     // the marker string a `no_supported_access` / `no_field` / `empty_field` row should carry
  note:                  string;
}

interface RosterReport {
  generatedAt:    string;
  scriptPath:     string;
  rosterPath:     string;
  scannedFiles:   number;
  counts:         Record<MatchKind, number>;
  records:        SpellRecord[];
}

// ============================================================================
// Roster parsing
// ============================================================================

/**
 * Parse SPELL_SUPPORTED_SUBCLASS_ROSTERS.md into a Map<class, Set<subclass>>.
 * Roster format:
 *   ### Cleric
 *   - `Life Domain`
 *   - `Light Domain`
 *   ...
 *
 * The class header (`### Cleric`) opens a section; bullet items prefixed
 * with backtick-wrapped strings are subclass labels. Sections end at the
 * next `### `, `## `, or end of file.
 */
function loadRoster(): Map<string, Set<string>> {
  const md = fs.readFileSync(ROSTER_PATH, 'utf8');
  const lines = md.split(/\r?\n/);
  const roster = new Map<string, Set<string>>();
  let currentClass: string | null = null;
  let inSupportedSection = false;
  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionMatch) {
      inSupportedSection = sectionMatch[1].trim() === 'Supported Rosters';
      currentClass = null;
      continue;
    }
    const classMatch = line.match(/^###\s+(.+?)\s*$/);
    if (classMatch) {
      currentClass = inSupportedSection ? classMatch[1].trim() : null;
      if (currentClass) roster.set(currentClass, new Set());
      continue;
    }
    if (!currentClass) continue;
    const bulletMatch = line.match(/^-\s+`([^`]+)`\s*$/);
    if (bulletMatch) {
      roster.get(currentClass)!.add(bulletMatch[1].trim());
    }
  }
  return roster;
}

function isLabelSupported(roster: Map<string, Set<string>>, className: string, subclassName: string): boolean {
  const set = roster.get(className);
  return !!set && set.has(subclassName);
}

// ============================================================================
// File discovery
// ============================================================================

function listMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (ent.isFile() && ent.name.endsWith('.md')) out.push(full);
    }
  }
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

function levelFromPath(mdPath: string): number {
  const m = mdPath.match(/[\\/]level-(\d+)[\\/]/);
  return m ? Number(m[1]) : -1;
}

function spellIdFromPath(mdPath: string): string {
  return path.basename(mdPath, '.md');
}

// ============================================================================
// Structured-layer parsing
// ============================================================================

function extractStructuredBlock(markdown: string): string {
  const idx = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  return idx !== -1 ? markdown.slice(0, idx) : markdown;
}

function parseStructuredField(markdown: string, label: string): string | null {
  const structuredBlock = extractStructuredBlock(markdown);
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = structuredBlock.match(new RegExp(`^- \\*\\*${escaped}\\*\\*:\\s*(.*)$`, 'm'));
  return m ? (m[1] ?? '') : null;
}

function parseStructuredFieldFollowupLine(markdown: string, label: string): string | null {
  // Some structured rows now keep the machine-readable `not_applicable`
  // sentinel in the field itself and place the older human-readable marker on
  // the immediately following line. The subclass audit needs that second line
  // so it can preserve the user's schema-friendly format without forgetting
  // which policy reason was recorded for reviewers.
  const structuredBlock = extractStructuredBlock(markdown);
  const lines = structuredBlock.split(/\r?\n/);
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldPattern = new RegExp(`^- \\*\\*${escaped}\\*\\*:\\s*(.*)$`);

  for (let index = 0; index < lines.length; index += 1) {
    if (!fieldPattern.test(lines[index] ?? '')) continue;
    const followup = (lines[index + 1] ?? '').trim();
    return followup.length > 0 ? followup : null;
  }

  return null;
}

function parseSpellName(markdown: string): string {
  const m = markdown.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : '';
}

/**
 * Split a structured `Sub-Classes` value into an array of `Class - Subclass`
 * entries. Comma-separated, trimmed, empty entries dropped.
 */
function splitEntryList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Split `Classes` value into an array of class names. */
function parseClassesList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// ============================================================================
// Canonical-layer parsing
// ============================================================================

function extractCanonicalBlock(markdown: string): string | null {
  const hIdx = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  if (hIdx === -1) return null;
  const cStart = markdown.indexOf('<!--', hIdx);
  const cEnd   = markdown.indexOf('-->', cStart);
  if (cStart === -1 || cEnd === -1) return null;
  return markdown.slice(cStart + 4, cEnd).trim();
}

function hasFiveEtoolsPartialCanonicalBoundary(markdown: string): boolean {
  // Three spells intentionally use the same 5etools partial-source escape hatch
  // that the broader canonical parity audit already recognizes. Treating those
  // files as a distinct boundary here keeps the subclass report honest: the
  // source limitation is visible, but it is not presented as unfinished roster
  // cleanup when no standard D&D Beyond block exists to compare against.
  return markdown.includes(CANONICAL_FROM_FIVE_E_TOOLS_MARKER);
}

/**
 * Pull the `Available For:` block (multi-line list of classes / subclass
 * entries) from a canonical comment block. Lines after `Available For:` and
 * before the next blank line or known terminator label are the list.
 */
function extractCanonicalAvailableFor(canonicalBlock: string): string[] {
  const lines = canonicalBlock.split(/\r?\n/);
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBlock) {
      if (trimmed === 'Available For:') { inBlock = true; }
      continue;
    }
    // Terminate at blank line or another labelled section
    if (!trimmed) break;
    if (/^[A-Z][\w\s/]*:\s*$/.test(trimmed)) break;
    if (/^(?:Capture Method|Legacy Page|Referenced Rules|Spell Tags|Material Component):/i.test(trimmed)) break;
    out.push(trimmed);
  }
  return out;
}

/**
 * Split canonical `Available For:` lines into base classes vs subclass entries.
 * A subclass entry contains ` - ` (e.g. "Cleric - War Domain"); a base
 * class entry is a single token (e.g. "Cleric").
 */
function splitAvailableForEntries(entries: string[]): { classes: string[]; subClasses: string[] } {
  const classes: string[] = [];
  const subClasses: string[] = [];
  for (const e of entries) {
    if (e.includes(' - ')) subClasses.push(e);
    else classes.push(e);
  }
  return { classes, subClasses };
}

// ============================================================================
// Per-entry classification helpers
// ============================================================================

interface EntryParse {
  raw:       string;
  className: string;
  subclass:  string;
}

function parseEntry(raw: string): EntryParse | null {
  const idx = raw.indexOf(' - ');
  if (idx < 0) return null;
  return {
    raw,
    className: raw.slice(0, idx).trim(),
    subclass:  raw.slice(idx + 3).trim(),
  };
}

/**
 * Decide what the structured `Sub-Classes` field SHOULD be for this spell,
 * per Decision 6 (only roster-supported labels) + Decision 2 (repeated-base
 * entries normalised away when parent class already in `Classes`).
 *
 * Input: canonical subclass entries + the spell's `Classes` line.
 * Output: ordered list of `Class - Subclass` strings to live in structured.
 */
function computeExpectedEntries(
  canonicalSubClasses: string[],
  classes: string[],
  roster: Map<string, Set<string>>,
): string[] {
  const classesSet = new Set(classes);
  const out: string[] = [];
  for (const raw of canonicalSubClasses) {
    const parsed = parseEntry(raw);
    if (!parsed) continue;
    // Decision 2: strip if base class already in `Classes`
    if (classesSet.has(parsed.className)) continue;
    // Decision 6: keep only roster-supported labels
    if (!isLabelSupported(roster, parsed.className, parsed.subclass)) continue;
    out.push(`${parsed.className} - ${parsed.subclass}`);
  }
  return out;
}

// ============================================================================
// Marker recommendation
// ============================================================================

/**
 * Pick the right marker string for a spell that has no roster-supported
 * subclass-only access. Looks at the canonical `Available For` block:
 *
 * - zero subclass entries at all  -> `No Subclass Entries`
 * - has entries but all have a parent class already in spell's `Classes` -> `Folded into Classes`
 * - has entries and at least one has a parent NOT in `Classes` (so it's a
 *   real subclass-only access label that just isn't roster-supported) -> `Unsupported Entries`
 *
 * Returns undefined when the input set has roster-supported entries (which
 * shouldn't happen for `no_supported_access` / `no_field` rows but is
 * guarded for safety).
 */
function recommendMarker(
  canonicalSubClasses: string[],
  classes: string[],
  roster: Map<string, Set<string>>,
): Marker | undefined {
  if (canonicalSubClasses.length === 0) return 'No Subclass Entries';
  const classesSet = new Set(classes);
  let sawUnsupportedSubclassOnly = false;
  let allRepeatedBase = true;
  for (const raw of canonicalSubClasses) {
    const parsed = parseEntry(raw);
    if (!parsed) continue;
    // If this is a roster-supported subclass-only entry we shouldn't be
    // recommending a marker - bail.
    if (
      !classesSet.has(parsed.className)
      && isLabelSupported(roster, parsed.className, parsed.subclass)
    ) {
      return undefined;
    }
    if (!classesSet.has(parsed.className)) {
      // Real subclass-only access, but the label isn't roster-supported.
      sawUnsupportedSubclassOnly = true;
      allRepeatedBase = false;
    }
  }
  if (allRepeatedBase) return 'Folded into Classes';
  if (sawUnsupportedSubclassOnly) return 'Unsupported Entries';
  return 'No Subclass Entries';
}

// ============================================================================
// Per-spell classification
// ============================================================================

function classifySpell(
  mdPath: string,
  markdown: string,
  roster: Map<string, Set<string>>,
): SpellRecord {
  const spellId   = spellIdFromPath(mdPath);
  const spellName = parseSpellName(markdown);
  const level     = levelFromPath(mdPath);

  const classesRaw   = parseStructuredField(markdown, 'Classes') ?? '';
  const subClassesRaw = parseStructuredField(markdown, 'Sub-Classes');
  const subClassesFollowup = parseStructuredFieldFollowupLine(markdown, 'Sub-Classes');
  const classes        = parseClassesList(classesRaw);
  const structuredEntries = subClassesRaw == null ? [] : splitEntryList(subClassesRaw);

  const canonicalBlock = extractCanonicalBlock(markdown);
  if (!canonicalBlock) {
    if (hasFiveEtoolsPartialCanonicalBoundary(markdown)) {
      return {
        spellId, spellName, level, mdPath: path.relative(REPO_ROOT, mdPath).replace(/\\/g, '/'),
        classes,
        structuredEntries,
        canonicalEntries: [],
        expectedEntries: [],
        toStrip: [],
        toAdd: [],
        matchKind: 'partial_canonical_source_boundary',
        note: 'No public D&D Beyond canonical block exists; this spell uses the approved partial 5etools identity cross-check already recognized by the main canonical parity audit.',
      };
    }

    return {
      spellId, spellName, level, mdPath: path.relative(REPO_ROOT, mdPath).replace(/\\/g, '/'),
      classes,
      structuredEntries,
      canonicalEntries: [],
      expectedEntries: [],
      toStrip: [],
      toAdd: [],
      matchKind: 'no_canonical_block',
      note: 'No canonical comment block found in the .md file.',
    };
  }

  const availableForRaw   = extractCanonicalAvailableFor(canonicalBlock);
  const split             = splitAvailableForEntries(availableForRaw);
  const canonicalEntries  = split.subClasses;
  const expectedEntries   = computeExpectedEntries(canonicalEntries, classes, roster);

  const structuredSet = new Set(structuredEntries);
  const expectedSet   = new Set(expectedEntries);

  const toStrip: string[] = [];
  for (const e of structuredEntries) if (!expectedSet.has(e)) toStrip.push(e);
  const toAdd: string[] = [];
  for (const e of expectedEntries) if (!structuredSet.has(e)) toAdd.push(e);

  let matchKind: MatchKind;
  let note: string;

  // Recognize marker values as a distinct terminal state BEFORE the strip logic.
  // A marker is the literal field value (e.g. `- **Sub-Classes**: Folded into Classes`),
  // not a comma-separated list, so the structured side parses to a single
  // entry equal to the marker string.
  const trimmedRaw = (subClassesRaw ?? '').trim();
  if (VALID_MARKERS.has(trimmedRaw)) {
    const recommendedMarker = recommendMarker(canonicalEntries, classes, roster);
    const honest = recommendedMarker === trimmedRaw;
    return {
      spellId, spellName, level,
      mdPath: path.relative(REPO_ROOT, mdPath).replace(/\\/g, '/'),
      classes,
      structuredEntries: [trimmedRaw],
      canonicalEntries,
      expectedEntries,
      toStrip: [],
      toAdd: [],
      matchKind: 'marker_applied',
      recommendedMarker,
      note: honest
        ? `Marker \`${trimmedRaw}\` matches canonical analysis.`
        : `Marker \`${trimmedRaw}\` is applied but canonical analysis recommends \`${recommendedMarker ?? '(none)'}\`. Review.`,
    };
  }

  // The newer spell templates prefer a schema-friendly explicit sentinel in
  // the field value (`not_applicable`) while keeping the reviewer-facing marker
  // on the following prose line. Treat that pair as the same closed policy state
  // as the legacy inline marker form, so the audit measures real subclass work
  // rather than reopening already-normalized spells.
  if (trimmedRaw === 'not_applicable' && subClassesFollowup && VALID_MARKERS.has(subClassesFollowup)) {
    const recommendedMarker = recommendMarker(canonicalEntries, classes, roster);
    const honest = recommendedMarker === subClassesFollowup;
    return {
      spellId, spellName, level,
      mdPath: path.relative(REPO_ROOT, mdPath).replace(/\\/g, '/'),
      classes,
      structuredEntries: [trimmedRaw],
      canonicalEntries,
      expectedEntries,
      toStrip: [],
      toAdd: [],
      matchKind: 'marker_applied',
      recommendedMarker,
      note: honest
        ? `Explicit \`not_applicable\` sentinel plus marker \`${subClassesFollowup}\` matches canonical analysis.`
        : `Explicit \`not_applicable\` sentinel uses marker \`${subClassesFollowup}\`, but canonical analysis recommends \`${recommendedMarker ?? '(none)'}\`. Review.`,
    };
  }

  if (subClassesRaw == null) {
    matchKind = 'no_field';
    note = expectedEntries.length === 0
      ? 'No `Sub-Classes` line and no roster-supported subclass-only access exists; insert with marker or leave unset.'
      : `No \`Sub-Classes\` line; should add ${expectedEntries.length} supported entries: ${expectedEntries.join(', ')}.`;
  } else if (subClassesRaw.trim() === '') {
    matchKind = 'empty_field';
    note = expectedEntries.length === 0
      ? 'Empty `Sub-Classes` field and no roster-supported subclass-only access; current empty state is consistent with no-supported-access marker.'
      : `Empty \`Sub-Classes\` field; should add ${expectedEntries.length} supported entries: ${expectedEntries.join(', ')}.`;
  } else if (toStrip.length === 0 && toAdd.length === 0) {
    matchKind = 'roster_clean';
    note = expectedEntries.length === 0
      ? 'Structured matches the empty expected set (no roster-supported subclass-only access in canonical).'
      : `Structured matches the ${expectedEntries.length}-entry roster-clean expected set.`;
  } else if (toStrip.length > 0 && toAdd.length === 0) {
    matchKind = 'needs_strip';
    note = `Strip ${toStrip.length} unsupported/repeated-base: ${toStrip.join(', ')}.`;
  } else if (toStrip.length === 0 && toAdd.length > 0) {
    matchKind = 'needs_add';
    note = `Add ${toAdd.length} missing supported: ${toAdd.join(', ')}.`;
  } else {
    matchKind = 'needs_both';
    note = `Strip ${toStrip.length} (${toStrip.join(', ')}) AND add ${toAdd.length} (${toAdd.join(', ')}).`;
  }

  // Special case: no_supported_access overrides the field-state classifications
  // when the field is non-empty but expected is empty AND structured had only
  // unsupported entries (everything got stripped). This catches cases where
  // the field exists but should be a marker per the bucket policies.
  if (
    expectedEntries.length === 0
    && structuredEntries.length > 0
    && toAdd.length === 0
  ) {
    matchKind = 'no_supported_access';
    note = `Canonical has no roster-supported subclass-only access; strip all ${structuredEntries.length} structured entries and apply a marker (Folded into Classes / Unsupported Entries / No Subclass Entries).`;
  }

  // Recommend a marker for any row that should carry one. This populates
  // `no_field`, `empty_field`, and `no_supported_access` rows. roster_clean
  // and needs_* rows with real expected entries don't carry a marker.
  let recommendedMarker: Marker | undefined;
  if (
    matchKind === 'no_supported_access'
    || (matchKind === 'no_field' && expectedEntries.length === 0)
    || (matchKind === 'empty_field' && expectedEntries.length === 0)
  ) {
    recommendedMarker = recommendMarker(canonicalEntries, classes, roster);
  }

  return {
    spellId, spellName, level,
    mdPath: path.relative(REPO_ROOT, mdPath).replace(/\\/g, '/'),
    classes,
    structuredEntries,
    canonicalEntries,
    expectedEntries,
    toStrip,
    toAdd,
    matchKind,
    recommendedMarker,
    note,
  };
}

// ============================================================================
// Report writers
// ============================================================================

function writeJsonReport(report: RosterReport): void {
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2) + '\n');
}

function writeMarkdownReport(report: RosterReport): void {
  const lines: string[] = [];
  lines.push('# Spell Sub-Classes Roster Audit');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Roster:    \`${path.relative(REPO_ROOT, report.rosterPath).replace(/\\/g, '/')}\``);
  lines.push(`Scanned:   ${report.scannedFiles} spell files`);
  lines.push('');
  lines.push('## What this audits');
  lines.push('');
  lines.push('Compares each spell\'s structured `- **Sub-Classes**:` line against');
  lines.push('the canonical `Available For:` block, after applying:');
  lines.push('');
  lines.push('- Decision 6 — only roster-supported subclass labels are kept');
  lines.push('- Decision 2 — repeated-base entries (parent class already in `Classes`) are stripped');
  lines.push('');
  lines.push('A spell shows as `roster_clean` only when its current structured value matches');
  lines.push('the expected post-Decision-2/6 set exactly. `needs_*` rows are real edits left to do.');
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| match_kind | count |');
  lines.push('| --- | --- |');
  for (const [k, v] of Object.entries(report.counts)) {
    lines.push(`| \`${k}\` | ${v} |`);
  }
  lines.push('');

  // Group records by matchKind. The clean and source-boundary rows are still
  // shown for transparency, but they do not represent edit queues.
  const byKind = new Map<MatchKind, SpellRecord[]>();
  for (const r of report.records) {
    if (!byKind.has(r.matchKind)) byKind.set(r.matchKind, []);
    byKind.get(r.matchKind)!.push(r);
  }
  const ORDERED: MatchKind[] = [
    'no_field',
    'empty_field',
    'needs_add',
    'needs_strip',
    'needs_both',
    'no_supported_access',
    'roster_clean',
    'marker_applied',
    'partial_canonical_source_boundary',
    'no_canonical_block',
  ];

  for (const kind of ORDERED) {
    const recs = byKind.get(kind) ?? [];
    if (recs.length === 0) continue;
    lines.push(`## \`${kind}\` (${recs.length})`);
    lines.push('');
    if (kind === 'roster_clean') {
      lines.push('No edits needed. Listed for completeness:');
      lines.push('');
      for (const r of recs) {
        lines.push(`- ${r.spellId} (L${r.level})`);
      }
      lines.push('');
      continue;
    }
    lines.push('| spell | level | strip | add | note |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const r of recs) {
      const strip = r.toStrip.length === 0 ? '-' : r.toStrip.join(' \\| ');
      const add   = r.toAdd.length === 0 ? '-' : r.toAdd.join(' \\| ');
      lines.push(`| \`${r.spellId}\` | ${r.level} | ${strip} | ${add} | ${r.note} |`);
    }
    lines.push('');
  }

  fs.mkdirSync(path.dirname(REPORT_MD_PATH), { recursive: true });
  fs.writeFileSync(REPORT_MD_PATH, lines.join('\n') + '\n');
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const roster = loadRoster();
  const files = listMarkdownFiles(SPELL_REF_ROOT);
  const records: SpellRecord[] = [];
  const counts: Record<MatchKind, number> = {
    no_field: 0,
    empty_field: 0,
    roster_clean: 0,
    needs_strip: 0,
    needs_add: 0,
    needs_both: 0,
    no_supported_access: 0,
    marker_applied: 0,
    partial_canonical_source_boundary: 0,
    no_canonical_block: 0,
  };
  for (const f of files) {
    const md = fs.readFileSync(f, 'utf8');
    const rec = classifySpell(f, md, roster);
    records.push(rec);
    counts[rec.matchKind]++;
  }
  records.sort((a, b) =>
    a.matchKind === b.matchKind
      ? a.spellId.localeCompare(b.spellId)
      : a.matchKind.localeCompare(b.matchKind),
  );
  const report: RosterReport = {
    generatedAt:  new Date().toISOString(),
    scriptPath:   path.relative(REPO_ROOT, SCRIPT_FILE).replace(/\\/g, '/'),
    rosterPath:   ROSTER_PATH,
    scannedFiles: files.length,
    counts,
    records,
  };
  writeJsonReport(report);
  writeMarkdownReport(report);
  // Console summary for CI / interactive runs
  /* eslint-disable no-console */
  console.log(`Sub-Classes roster audit complete. ${files.length} spells scanned.`);
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(22)} ${v}`);
  }
  const markerCounts: Record<Marker, number> = {
    'Folded into Classes': 0,
    'Unsupported Entries': 0,
    'No Subclass Entries': 0,
  };
  for (const r of records) {
    if (r.recommendedMarker) markerCounts[r.recommendedMarker]++;
  }
  console.log('');
  console.log('Recommended marker distribution:');
  for (const [m, c] of Object.entries(markerCounts)) {
    console.log(`  ${m.padEnd(22)} ${c}`);
  }
  console.log(`Reports: ${path.relative(REPO_ROOT, REPORT_MD_PATH).replace(/\\/g, '/')}`);
  console.log(`         ${path.relative(REPO_ROOT, REPORT_JSON_PATH).replace(/\\/g, '/')}`);
  /* eslint-enable no-console */
}

main();
