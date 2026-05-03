import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Phase 1 parity script — Damage Type bucket (canonical → structured).
 *
 * Compares the `- **Damage Type**:` field in the structured Aralia block
 * against damage-type tokens extracted from the canonical D&D Beyond snapshot
 * in the same markdown file.  Chooser spells (where the caster picks one of a
 * set at cast time) are handled as a first-class classification rather than
 * flagged as generic drift — see "Chooser classification" section below.
 *
 * Output files:
 *   docs/tasks/spells/damage-type/SPELL_DAMAGE_TYPE_CANONICAL_PARITY_REPORT.md
 *   .agent/roadmap-local/spell-validation/spell-damage-type-canonical-parity.json
 *
 * Run:
 *   npx tsx scripts/auditSpellDamageTypeCanonical.ts
 *   npm run audit:damage-type-canonical
 *
 * Part of: Damage Type bucket — Phase 1 (canonical → structured).
 * Phase 2 (structured → runtime JSON) is a separate script, blocked until
 * Phase 1 closes (Gap 15).
 */

// ============================================================================
// Paths
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR  = path.dirname(SCRIPT_FILE);
const REPO_ROOT   = path.resolve(SCRIPT_DIR, '..');

const SPELL_REF_ROOT  = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const REPORT_MD_PATH  = path.join(
  REPO_ROOT, 'docs', 'tasks', 'spells', 'damage-type',
  'SPELL_DAMAGE_TYPE_CANONICAL_PARITY_REPORT.md',
);
const REPORT_JSON_PATH = path.join(
  REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation',
  'spell-damage-type-canonical-parity.json',
);

const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const CANONICAL_ONLY_MARKER      = '<!-- CANONICAL-ONLY-REFERENCE -->';

// ============================================================================
// Known single-token set (PascalCase, same as runtime JSON allowlist)
// ============================================================================

const KNOWN_SINGLE_TOKENS = new Set([
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
  'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder',
]);

// ============================================================================
// Types
// ============================================================================

type MatchKind =
  | 'clean'                // structured token matches canonical; single-type spell
  | 'chooser_match'        // chooser spell; structured options match canonical options
  | 'chooser_mismatch'     // chooser spell; options differ between layers
  | 'absorb_triggering'    // absorb-elements-like: damage type follows triggering event
  | 'multi_effect'         // hunger-of-hadar-like: multiple distinct DAMAGE effect timings
  | 'random_table'         // prismatic-spray-like: random from a table, not one_of
  | 'structured_empty'     // structured field is blank; canonical has a type
  | 'canonical_no_damage'  // canonical shows no damage token (utility/buff spell)
  | 'mismatch'             // structured single-token doesn't match canonical single-token
  | 'structured_only'      // structured has a value; canonical block absent or no damage
  | 'no_canonical_block';  // markdown has no canonical comment block at all

interface SpellRecord {
  spellId:     string;
  spellName:   string;
  level:       number;
  mdPath:      string;
  // Structured layer
  structuredRaw:        string;   // raw value of "- **Damage Type**:" (may be empty)
  structuredOptions:    string[]; // normalised list of tokens parsed from structuredRaw
  structuredIsChooser:  boolean;  // slash- or comma-glued (or explicit list)
  // Canonical layer
  canonicalRulesText:   string;   // full Rules Text block
  canonicalDamageEffect: string;  // value of "Damage/Effect:" line
  canonicalOptions:     string[]; // tokens extracted from canonical prose
  canonicalIsChooser:   boolean;  // prose says "your choice"
  // Result
  matchKind:  MatchKind;
  note:       string;
}

interface DamageTypeParityReport {
  generatedAt:        string;
  scriptPath:         string;
  scannedFiles:       number;
  // Counts by matchKind
  counts: Record<MatchKind, number>;
  // All spell records
  records: SpellRecord[];
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
  const m = mdPath.match(/level-(\d+)/);
  return m ? Number(m[1]) : -1;
}

// ============================================================================
// Structured-layer parsing
// ============================================================================

/**
 * Returns the structured Aralia block (lines before the canonical snapshot heading).
 * This prevents the regex from accidentally matching labels inside the HTML comment.
 */
function extractStructuredBlock(markdown: string): string {
  const idx = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  return idx !== -1 ? markdown.slice(0, idx) : markdown;
}

/** Extract the value of `- **Label**:` from the top structured block. */
function parseStructuredField(markdown: string, label: string): string {
  // Scope to the structured block only — do not read into the canonical comment.
  const structuredBlock = extractStructuredBlock(markdown);
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = structuredBlock.match(new RegExp(`^- \\*\\*${escaped}\\*\\*:\\s*(.*)$`, 'm'));
  return m ? (m[1] ?? '').trim() : '';
}

/**
 * Parse a Damage Type field value into an array of canonical PascalCase tokens.
 * Handles:
 *   - Single token:  "Fire"
 *   - Slash-glued:   "Acid/Cold/Fire/Lightning/Thunder"
 *   - Comma-OR list: "Acid, Cold, Fire, or Lightning"
 *   - OR-only list:  "Fire or Cold"
 *   - Named sub-fields: "Damage Type Selection" / "Damage Type Options" (future shape)
 */
function parseStructuredDamageTokens(raw: string): string[] {
  if (!raw) return [];
  // Split on slash, comma, or " or " (with surrounding whitespace)
  const parts = raw
    .split(/\/|,|\bor\b/i)
    .map((p) => p.replace(/^\s+|\s+$/g, '').replace(/^\s*(?:or\s+)?/i, '').trim())
    .filter(Boolean);
  // Only keep known damage tokens — discard prose leakage.
  // Deliberately strict: only PHB-like PascalCase tokens are accepted so
  // that long Description-field bleed-through doesn't produce phantom results.
  return parts
    .map(titleCase)
    .filter((p) => KNOWN_SINGLE_TOKENS.has(p));
}

function isChooserStructured(raw: string): boolean {
  if (!raw) return false;
  // Must contain a separator (slash, comma, or " or ") AND at least one known token on each side.
  // This guards against long Description-field bleed-through containing arbitrary " or " prose.
  const tokens = parseStructuredDamageTokens(raw);
  return tokens.length >= 2;
}

function titleCase(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
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

/** Extract the value of a single-line field like "School: Evocation" */
function extractCanonicalField(block: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = block.match(new RegExp(`(?:^|\\r?\\n)${escaped}:\\s*(.+)$`, 'im'));
  return m ? m[1].trim() : '';
}

/** Extract the Rules Text section from a canonical block. */
function extractRulesText(block: string): string {
  const m = block.match(
    /(?:^|\r?\n)Rules Text:\r?\n([\s\S]*?)(?=\r?\n(?:Material Component|Spell Tags|Available For|Referenced Rules|Capture Method|Legacy Page):|$)/i,
  );
  return m ? m[1].trim() : '';
}

/**
 * Extract damage-type tokens from canonical Rules Text prose.
 *
 * Patterns handled:
 *   1. "takes Xd8 Acid, Cold, Fire, Lightning, or Thunder damage (your choice…)"
 *   2. "deals X Acid damage" / "X fire damage"
 *   3. "choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type"
 *   4. "cold and fire damage" (multi-effect, e.g. hunger-of-hadar)
 *   5. "the same type as the triggering damage" (absorb-elements)
 *   6. "1d10 force damage" or generic single-type sentence
 *
 * Returns: { tokens: string[], isChooser: boolean, isTriggering: boolean, isMultiEffect: boolean }
 */
function extractCanonicalDamageTokens(rulesText: string): {
  tokens: string[];
  isChooser: boolean;
  isTriggering: boolean;
  isMultiEffect: boolean;
} {
  const text = rulesText.toLowerCase();

  // ── Triggering / mirroring (absorb-elements pattern)
  const triggeringPatterns = [
    /same type as the triggering/i,
    /same damage type as the triggering/i,
    /of the triggering damage/i,
  ];
  const isTriggering = triggeringPatterns.some((re) => re.test(rulesText));

  // ── Extract all known type tokens mentioned in the prose
  const mentionedTokens = new Set<string>();
  for (const token of KNOWN_SINGLE_TOKENS) {
    // Match "fire damage" or "fire," (part of a list) case-insensitively
    if (new RegExp(`\\b${token}\\b`, 'i').test(rulesText)) {
      mentionedTokens.add(token);
    }
  }
  const tokens = [...mentionedTokens].sort();

  // ── Chooser detection: "your choice" must appear near damage-dealing context.
  // Narrow guard prevents non-damage spells (modify-memory, mislead, etc.) from
  // matching on incidental "your choice" prose about targets or memory edits.
  const isChooser =
    // Damage-type chooser: "X, Y, or Z damage (your choice"
    /(?:acid|cold|fire|lightning|poison|thunder|necrotic|radiant|psychic|force|bludgeoning|piercing|slashing)\b[^.]*?\(your choice/i.test(rulesText) ||
    // "choose Acid, Cold, Fire..." directly followed by known token list
    /choose\s+(?:acid|cold|fire|lightning|poison|thunder|necrotic|radiant|psychic|force)/i.test(rulesText) ||
    // "damage (your choice)" or "damage of your choice" directly
    /damage[^.]*?\(?your choice/i.test(rulesText);

  // ── Multi-effect detection: different damage types appear in separate
  //    timing contexts (at the start of its turn / at end of turn etc.)
  const multiEffectPatterns = [
    /at the start of.*\b(\w+) damage.*at the end of.*\b(\w+) damage/is,
    /\b(\w+) damage.*each turn.*\b(\w+) damage/is,
  ];
  const isMultiEffect =
    !isChooser && tokens.length >= 2 && multiEffectPatterns.some((re) => re.test(rulesText));

  return { tokens, isChooser, isTriggering, isMultiEffect };
}

// ============================================================================
// Chooser-shape helpers
// Canonical options list is extracted from prose like:
//   "Acid, Cold, Fire, Lightning, or Thunder damage (your choice…)"
// or
//   "Choose Acid, Cold, Fire, Lightning, Poison, or Thunder"
// ============================================================================

function extractChooserOptions(rulesText: string): string[] {
  // Find all canonical tokens adjacent to a chooser phrase
  const patterns = [
    // "X, Y, Z, or W damage (your choice"
    /(?:(\w+)[,\s]+)+(?:or\s+)?(\w+)\s+damage\s+\(your choice/gi,
    // "choose Acid, Cold, Fire, Lightning, Poison, or Thunder"
    /choose\s+((?:\w+[,\s]+)+(?:or\s+)?\w+)\s+for/gi,
    // "choose … for the type of orb"
    /choose\s+((?:\w+[,\s]+)+(?:or\s+)?\w+)\s+(?:for|as)/gi,
  ];

  // Try each pattern; use the first that yields at least 2 known tokens
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = re.exec(rulesText);
    if (!m) continue;

    // Collect all words from the match, filter to known tokens
    const words = m[0].split(/\W+/).map(titleCase).filter((w) => KNOWN_SINGLE_TOKENS.has(w));
    if (words.length >= 2) return words;
  }

  // Fallback: just return all known tokens found in the prose
  const fallback: string[] = [];
  for (const token of KNOWN_SINGLE_TOKENS) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(rulesText)) fallback.push(token);
  }
  return fallback.sort();
}

// ============================================================================
// Classification
// ============================================================================

// Known special-case spells that need manual classification rather than
// pure pattern matching — documented here so the script stays transparent.
const KNOWN_TRIGGERING_SPELLS = new Set(['absorb-elements']);
const KNOWN_MULTI_EFFECT_SPELLS = new Set(['hunger-of-hadar']);
const KNOWN_RANDOM_TABLE_SPELLS = new Set(['prismatic-spray']);

function classifySpell(rec: Omit<SpellRecord, 'matchKind' | 'note'>): { matchKind: MatchKind; note: string } {
  const { spellId, structuredRaw, structuredOptions, structuredIsChooser,
          canonicalOptions, canonicalIsChooser, canonicalRulesText } = rec;

  // Hard-coded special cases
  if (KNOWN_TRIGGERING_SPELLS.has(spellId)) {
    return { matchKind: 'absorb_triggering', note: 'Damage type follows triggering event; typeResolution shape.' };
  }
  if (KNOWN_MULTI_EFFECT_SPELLS.has(spellId)) {
    return { matchKind: 'multi_effect', note: 'Multiple distinct DAMAGE effect timings; split into multiple DAMAGE effects at runtime.' };
  }
  if (KNOWN_RANDOM_TABLE_SPELLS.has(spellId)) {
    return { matchKind: 'random_table', note: 'Random from d8 table; not a caster-choice one_of — future weighted/table subbucket.' };
  }

  // No canonical block
  if (!rec.canonicalRulesText && !rec.canonicalDamageEffect) {
    if (structuredRaw) return { matchKind: 'structured_only', note: 'Canonical snapshot absent; cannot compare.' };
    return { matchKind: 'no_canonical_block', note: 'No canonical block and no structured value.' };
  }

  // Canonical shows no damage type (buff/utility spell)
  if (canonicalOptions.length === 0 && !canonicalIsChooser) {
    if (!structuredRaw) {
      return { matchKind: 'canonical_no_damage', note: 'Non-damage spell; structured field correctly empty.' };
    }
    return { matchKind: 'structured_only', note: 'Canonical prose shows no damage type; structured has a value — may be derived / summon damage.' };
  }

  // Structured field is blank but canonical has damage
  if (!structuredRaw && (canonicalOptions.length > 0 || canonicalIsChooser)) {
    return { matchKind: 'structured_empty', note: 'Structured Damage Type field is absent or blank; canonical has damage tokens.' };
  }

  // Chooser path
  if (canonicalIsChooser || structuredIsChooser) {
    // Compare option sets (order-independent)
    const sSet = new Set(structuredOptions.map((t) => t.toLowerCase()));
    const cSet = new Set(canonicalOptions.map((t) => t.toLowerCase()));
    const setsMatch = sSet.size === cSet.size && [...sSet].every((t) => cSet.has(t));

    if (setsMatch || sSet.size === 0) {
      // sSet.size === 0 means structured was slash-glued but matched via parsed canonicalOptions
      return {
        matchKind: 'chooser_match',
        note: `Chooser spell; options: [${canonicalOptions.join(', ')}]. Structured uses slash-glue — migrate to typeSelection.typeOptions.`,
      };
    }
    return {
      matchKind: 'chooser_mismatch',
      note: `Options differ. Structured: [${structuredOptions.join(', ')}] Canonical: [${canonicalOptions.join(', ')}]`,
    };
  }

  // Single-token path
  const structuredToken = structuredOptions[0] ?? '';
  const canonicalToken  = canonicalOptions[0] ?? '';

  if (structuredToken && canonicalToken) {
    if (structuredToken.toLowerCase() === canonicalToken.toLowerCase()) {
      return { matchKind: 'clean', note: '' };
    }
    return {
      matchKind: 'mismatch',
      note: `Structured: "${structuredToken}" | Canonical: "${canonicalToken}"`,
    };
  }

  // Structured has a single known token but canonical only shows it in
  // the Damage/Effect field, not in Rules Text prose (common for straightforward spells).
  // Treat as clean if the tokens agree with the canonical Damage/Effect line.
  const effectLine = rec.canonicalDamageEffect.split(/\s/)[0]; // "Fire (...)" → "Fire"
  if (structuredToken && effectLine) {
    if (structuredToken.toLowerCase() === effectLine.toLowerCase()) {
      return { matchKind: 'clean', note: 'Token matched via Damage/Effect canonical line (no explicit prose token).' };
    }
    if (KNOWN_SINGLE_TOKENS.has(titleCase(effectLine))) {
      return {
        matchKind: 'mismatch',
        note: `Structured: "${structuredToken}" | Canonical Damage/Effect: "${effectLine}"`,
      };
    }
  }

  if (!structuredToken && !canonicalToken) {
    return { matchKind: 'canonical_no_damage', note: 'Non-damage spell.' };
  }

  return { matchKind: 'structured_empty', note: 'Could not resolve canonical token from Rules Text or Damage/Effect line.' };
}

// ============================================================================
// Main scan
// ============================================================================

function main(): void {
  const files = listMarkdownFiles(SPELL_REF_ROOT);

  const records: SpellRecord[] = [];

  for (const mdPath of files) {
    const markdown = fs.readFileSync(mdPath, 'utf8');

    // Skip canonical-only placeholders
    if (markdown.includes(CANONICAL_ONLY_MARKER)) continue;

    const spellId   = path.basename(mdPath, '.md');
    const level     = levelFromPath(mdPath);
    const nameMatch = markdown.match(/^# (.+)$/m);
    const spellName = nameMatch ? nameMatch[1].trim() : spellId;

    // ── Structured layer
    const structuredRaw       = parseStructuredField(markdown, 'Damage Type');
    const structuredOptions   = parseStructuredDamageTokens(structuredRaw);
    const structuredIsChooser = isChooserStructured(structuredRaw);

    // ── Canonical layer
    const canonicalBlock = extractCanonicalBlock(markdown);
    const canonicalRulesText  = canonicalBlock ? extractRulesText(canonicalBlock) : '';
    const canonicalDamageEffect = canonicalBlock
      ? extractCanonicalField(canonicalBlock, 'Damage/Effect')
      : '';

    const { tokens: canonicalOptions, isChooser: canonicalIsChooser } =
      extractCanonicalDamageTokens(canonicalRulesText);

    // Build chooser options if applicable
    const resolvedCanonicalOptions = (canonicalIsChooser || structuredIsChooser)
      ? extractChooserOptions(canonicalRulesText)
      : canonicalOptions;

    const base = {
      spellId, spellName, level, mdPath,
      structuredRaw, structuredOptions, structuredIsChooser,
      canonicalRulesText, canonicalDamageEffect,
      canonicalOptions: resolvedCanonicalOptions,
      canonicalIsChooser,
    };

    const { matchKind, note } = classifySpell(base);

    records.push({ ...base, matchKind, note });
  }

  // ── Sort by spellId
  records.sort((a, b) => a.spellId.localeCompare(b.spellId));

  // ── Tally counts
  const counts = {} as Record<MatchKind, number>;
  const allKinds: MatchKind[] = [
    'clean', 'chooser_match', 'chooser_mismatch', 'absorb_triggering',
    'multi_effect', 'random_table', 'structured_empty', 'canonical_no_damage',
    'mismatch', 'structured_only', 'no_canonical_block',
  ];
  for (const k of allKinds) counts[k] = 0;
  for (const r of records) counts[r.matchKind]++;

  const report: DamageTypeParityReport = {
    generatedAt: new Date().toISOString(),
    scriptPath:  'scripts/auditSpellDamageTypeCanonical.ts',
    scannedFiles: records.length,
    counts,
    records,
  };

  // ── Write JSON
  const jsonDir = path.dirname(REPORT_JSON_PATH);
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');

  // ── Write Markdown
  writeMdReport(report);

  // ── Console summary
  console.log(`\nDamage Type — Phase 1 parity report`);
  console.log(`Scanned: ${report.scannedFiles} spell markdown files`);
  console.log('');
  const maxLen = Math.max(...allKinds.map((k) => k.length));
  for (const k of allKinds) {
    if (counts[k] > 0) {
      console.log(`  ${k.padEnd(maxLen)}  ${String(counts[k]).padStart(4)}`);
    }
  }
  console.log('');
  console.log(`MD  → ${REPORT_MD_PATH}`);
  console.log(`JSON→ ${REPORT_JSON_PATH}`);
}

// ============================================================================
// Markdown report writer
// ============================================================================

function writeMdReport(report: DamageTypeParityReport): void {
  const d = new Date(report.generatedAt);
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const lines: string[] = [];
  lines.push('# Spell Damage Type — Phase 1 Canonical vs Structured Parity Report');
  lines.push('');
  lines.push(`Generated: ${today} (\`${report.scriptPath}\`).`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`Scanned **${report.scannedFiles}** spell markdown files.`);
  lines.push('');
  lines.push('| Classification | Count | Notes |');
  lines.push('| --- | ---: | --- |');

  const kindMeta: Record<MatchKind, string> = {
    clean:               'Structured token matches canonical — no action needed',
    chooser_match:       'Chooser spell; option sets agree — migrate structured to typeSelection.typeOptions',
    chooser_mismatch:    'Chooser spell; option sets differ — needs review',
    absorb_triggering:   'Damage mirrors triggering event — typeResolution shape',
    multi_effect:        'Multiple distinct damage-timing effects — split DAMAGE effects',
    random_table:        'Random from table — future weighted/table subbucket',
    structured_empty:    'Structured field blank but canonical has damage tokens',
    canonical_no_damage: 'Non-damage spell — field correctly absent/empty',
    mismatch:            'Single-token value mismatch',
    structured_only:     'Structured has value but canonical snapshot absent',
    no_canonical_block:  'No canonical block in file',
  };

  const allKinds: MatchKind[] = [
    'clean', 'canonical_no_damage',
    'chooser_match', 'chooser_mismatch',
    'absorb_triggering', 'multi_effect', 'random_table',
    'structured_empty', 'mismatch', 'structured_only', 'no_canonical_block',
  ];

  for (const k of allKinds) {
    lines.push(`| \`${k}\` | ${report.counts[k]} | ${kindMeta[k]} |`);
  }

  lines.push('');
  lines.push('## Chooser spells (migrate to typeSelection)');
  lines.push('');
  lines.push(
    'These spells store a slash-glued or comma-glued string in structured ' +
    '`Damage Type`. They should be migrated to `Damage Type Selection: one_of` + ' +
    '`Damage Type Options: <list>` in the structured layer, and to ' +
    '`damage.typeSelection.{ kind, options }` in the runtime JSON.',
  );
  lines.push('');

  const chooserSpells = report.records.filter(
    (r) => r.matchKind === 'chooser_match' || r.matchKind === 'chooser_mismatch',
  );
  if (chooserSpells.length === 0) {
    lines.push('*(none found)*');
  } else {
    lines.push('| Spell | Level | Structured raw | Canonical options | Status |');
    lines.push('| --- | ---: | --- | --- | --- |');
    for (const r of chooserSpells) {
      const status = r.matchKind === 'chooser_match' ? 'options agree' : '**MISMATCH**';
      lines.push(
        `| \`${r.spellId}\` | ${r.level} | \`${r.structuredRaw}\` | ${r.canonicalOptions.join(', ')} | ${status} |`,
      );
    }
  }

  lines.push('');
  lines.push('## Special cases');
  lines.push('');

  for (const kind of ['absorb_triggering', 'multi_effect', 'random_table'] as MatchKind[]) {
    const group = report.records.filter((r) => r.matchKind === kind);
    if (group.length === 0) continue;
    lines.push(`### ${kindMeta[kind]}`);
    lines.push('');
    for (const r of group) {
      lines.push(`- **\`${r.spellId}\`** (level ${r.level}) — ${r.note}`);
    }
    lines.push('');
  }

  lines.push('## Needs attention — mismatches and empties');
  lines.push('');

  const attention = report.records.filter(
    (r) => r.matchKind === 'mismatch' || r.matchKind === 'structured_empty',
  );
  if (attention.length === 0) {
    lines.push('*(none)*');
  } else {
    lines.push('| Spell | Level | matchKind | Structured | Canonical | Note |');
    lines.push('| --- | ---: | --- | --- | --- | --- |');
    for (const r of attention) {
      lines.push(
        `| \`${r.spellId}\` | ${r.level} | \`${r.matchKind}\` | \`${r.structuredRaw || '(blank)'}\` | ${r.canonicalOptions.join(', ') || '?'} | ${r.note} |`,
      );
    }
  }

  lines.push('');
  lines.push('## Structured-only (no canonical block)');
  lines.push('');

  const soOnly = report.records.filter(
    (r) => r.matchKind === 'structured_only' || r.matchKind === 'no_canonical_block',
  );
  if (soOnly.length === 0) {
    lines.push('*(none)*');
  } else {
    for (const r of soOnly) {
      lines.push(`- \`${r.spellId}\` — ${r.note}`);
    }
  }

  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Full record list (all spells)</summary>');
  lines.push('');
  lines.push('| Spell | Lv | matchKind | Structured | Canonical options |');
  lines.push('| --- | ---: | --- | --- | --- |');
  for (const r of report.records) {
    lines.push(
      `| \`${r.spellId}\` | ${r.level} | \`${r.matchKind}\` | \`${r.structuredRaw || '(blank)'}\` | ${r.canonicalOptions.join(', ') || '—'} |`,
    );
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  const mdDir = path.dirname(REPORT_MD_PATH);
  if (!fs.existsSync(mdDir)) fs.mkdirSync(mdDir, { recursive: true });
  fs.writeFileSync(REPORT_MD_PATH, lines.join('\n'), 'utf8');
}

// ============================================================================

main();
