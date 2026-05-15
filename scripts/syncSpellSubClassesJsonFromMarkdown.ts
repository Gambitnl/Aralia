import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Phase 2 sync companion to `applySpellSubClassesRosterCleanup.ts`.
 *
 * Reads each spell's structured `- **Sub-Classes**:` value from the .md file
 * and writes the equivalent into the runtime spell JSON's `subClasses`
 * field. Closes the Phase 2 (structured -> runtime JSON) parity gap that
 * the WIDE marker pass on 2026-05-11 opened.
 *
 * Mapping rules:
 *   - `Sub-Classes: <Class - Subclass>, ...`  -> JSON `subClasses: [<entries>]`
 *   - `Sub-Classes: Folded into Classes`      -> JSON `subClasses: []`
 *   - `Sub-Classes: Unsupported Entries`      -> JSON `subClasses: []`
 *   - `Sub-Classes: No Subclass Entries`      -> JSON `subClasses: []`
 *   - line missing or blank                   -> JSON `subClasses: []`
 *
 * NOTE: marker information (which of the three sentinel values applied) is
 * NOT preserved in JSON. That requires adding `subClassesStatus` to the
 * Spell type, which is Phase 3 fixture/schema-alignment work. For now,
 * marker info lives in the .md layer only; JSON carries the post-policy
 * spell list (often empty for marker spells).
 *
 * Modes:
 *   --apply    actually write the JSON files (default is dry-run)
 *
 * Run:
 *   npx tsx scripts/syncSpellSubClassesJsonFromMarkdown.ts          # dry-run
 *   npx tsx scripts/syncSpellSubClassesJsonFromMarkdown.ts --apply  # write
 *   npm run sync:sub-classes-json -- --apply                        # via npm
 *
 * After --apply, re-run `npx tsx scripts/auditSpellStructuredAgainstJson.ts`
 * to verify zero Sub-Classes mismatches.
 */

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR  = path.dirname(SCRIPT_FILE);
const REPO_ROOT   = path.resolve(SCRIPT_DIR, '..');

const SPELL_REF_ROOT  = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const SPELL_JSON_ROOT = path.join(REPO_ROOT, 'public', 'data', 'spells');

const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const VALID_MARKERS: ReadonlySet<string> = new Set([
  'Folded into Classes',
  'Unsupported Entries',
  'No Subclass Entries',
]);

// ============================================================================
// File discovery + parsing
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

function extractStructuredBlock(markdown: string): string {
  const idx = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  return idx !== -1 ? markdown.slice(0, idx) : markdown;
}

function parseSubClassesField(markdown: string): { raw: string | null; entries: string[]; marker: string | null } {
  const structuredBlock = extractStructuredBlock(markdown);
  const m = structuredBlock.match(/^- \*\*Sub-Classes\*\*:\s*(.*)$/m);
  if (!m) return { raw: null, entries: [], marker: null };
  const raw = (m[1] ?? '').trim();
  if (raw === '') return { raw: '', entries: [], marker: null };
  if (VALID_MARKERS.has(raw)) return { raw, entries: [], marker: raw };
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return { raw, entries, marker: null };
}

// ============================================================================
// JSON updates
// ============================================================================

/**
 * Replace the `"subClasses": [...]` value in a JSON file's raw text. We
 * deliberately do textual replacement instead of JSON.parse + stringify
 * because the existing JSON files use idiosyncratic formatting (varying
 * indentation, blank lines) that we don't want to normalize away on every
 * touch. The replacement preserves the surrounding formatting and only
 * swaps the array contents.
 *
 * Returns null if the field isn't present.
 */
function rewriteSubClassesJson(jsonText: string, entries: string[]): string | null {
  // Match `"subClasses":` followed by an array literal (may span lines).
  const re = /("subClasses":\s*)\[[\s\S]*?\]/m;
  if (!re.test(jsonText)) return null;
  const arrayLiteral = entries.length === 0
    ? '[]'
    : '[\n    ' + entries.map((e) => JSON.stringify(e)).join(',\n    ') + '\n  ]';
  return jsonText.replace(re, (_full, prefix: string) => `${prefix}${arrayLiteral}`);
}

function loadJsonText(jsonPath: string): string | null {
  if (!fs.existsSync(jsonPath)) return null;
  return fs.readFileSync(jsonPath, 'utf8');
}

function jsonSubClassesArray(jsonText: string): string[] | null {
  const re = /"subClasses":\s*\[([\s\S]*?)\]/m;
  const m = jsonText.match(re);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner) return [];
  // Pull out each quoted string.
  const items: string[] = [];
  const strRe = /"((?:[^"\\]|\\.)*)"/g;
  let sm: RegExpExecArray | null;
  while ((sm = strRe.exec(inner)) !== null) {
    items.push(sm[1]);
  }
  return items;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const ax = [...a].sort();
  const bx = [...b].sort();
  for (let i = 0; i < ax.length; i++) if (ax[i] !== bx[i]) return false;
  return true;
}

// ============================================================================
// Main
// ============================================================================

interface Stats {
  scanned: number;
  alreadyMatching: number;
  rewritten: number;
  markerSpells: number;
  jsonMissing: number;
  jsonFieldMissing: number;
}

function main(): void {
  const apply = process.argv.includes('--apply');
  const mdFiles = listMarkdownFiles(SPELL_REF_ROOT);

  const stats: Stats = {
    scanned: 0,
    alreadyMatching: 0,
    rewritten: 0,
    markerSpells: 0,
    jsonMissing: 0,
    jsonFieldMissing: 0,
  };
  const failures: string[] = [];
  const sampleRewrites: string[] = [];

  /* eslint-disable no-console */
  console.log(`Sub-Classes JSON sync (${apply ? 'APPLY' : 'DRY-RUN'})`);
  console.log('');

  for (const mdPath of mdFiles) {
    stats.scanned++;
    const spellId = spellIdFromPath(mdPath);
    const level = levelFromPath(mdPath);
    const md = fs.readFileSync(mdPath, 'utf8');
    const parsed = parseSubClassesField(md);
    if (parsed.marker) stats.markerSpells++;

    const jsonPath = path.join(SPELL_JSON_ROOT, `level-${level}`, `${spellId}.json`);
    const jsonText = loadJsonText(jsonPath);
    if (jsonText == null) {
      stats.jsonMissing++;
      failures.push(`${spellId}: JSON file not found (${path.relative(REPO_ROOT, jsonPath).replace(/\\/g, '/')})`);
      continue;
    }
    const currentArray = jsonSubClassesArray(jsonText);
    if (currentArray == null) {
      stats.jsonFieldMissing++;
      failures.push(`${spellId}: subClasses field not present in JSON`);
      continue;
    }

    const expected = parsed.entries; // empty if marker or blank
    if (arraysEqual(currentArray, expected)) {
      stats.alreadyMatching++;
      continue;
    }
    const next = rewriteSubClassesJson(jsonText, expected);
    if (next == null) {
      failures.push(`${spellId}: subClasses rewrite failed (regex match mismatch)`);
      continue;
    }
    stats.rewritten++;
    if (sampleRewrites.length < 8) {
      const before = currentArray.length === 0 ? '[]' : `[${currentArray.length} entries]`;
      const after = expected.length === 0
        ? (parsed.marker ? `[] (md marker: ${parsed.marker})` : '[]')
        : `[${expected.length} entries]`;
      sampleRewrites.push(`  ${spellId.padEnd(28)} ${before} -> ${after}`);
    }
    if (apply) fs.writeFileSync(jsonPath, next);
  }

  console.log(`Scanned:          ${stats.scanned}`);
  console.log(`Already matching: ${stats.alreadyMatching}`);
  console.log(`Rewritten:        ${stats.rewritten}`);
  console.log(`Marker spells:    ${stats.markerSpells} (writing [] for these; marker info stays in .md only)`);
  console.log(`JSON missing:     ${stats.jsonMissing}`);
  console.log(`JSON field gap:   ${stats.jsonFieldMissing}`);
  if (sampleRewrites.length) {
    console.log('');
    console.log('Sample rewrites:');
    for (const s of sampleRewrites) console.log(s);
    if (stats.rewritten > sampleRewrites.length) {
      console.log(`  ... and ${stats.rewritten - sampleRewrites.length} more`);
    }
  }
  if (failures.length) {
    console.log('');
    console.log(`Failures (${failures.length}):`);
    for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  }
  if (!apply) {
    console.log('');
    console.log('Dry-run only. Re-run with --apply to write the changes.');
  } else {
    console.log('');
    console.log('Re-run `npx tsx scripts/auditSpellStructuredAgainstJson.ts` to verify.');
  }
  /* eslint-enable no-console */
}

main();
