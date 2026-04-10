import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script keeps the spell access fields together at the top level of every
 * spell JSON file.
 *
 * The spell-truth lane now treats `classes`, `subClasses`, and
 * `subClassesVerification` as one conceptual cluster. JSON key order does not
 * matter to the validator or runtime, but it matters a lot for human review,
 * corpus audits, and diff readability. This script normalizes only the top-level
 * key order so that the access fields stay adjacent without rewriting the deeper
 * nested structures that still need their own lane-specific review.
 *
 * Called manually by: Codex during spell corpus normalization
 * Depends on: `public/data/spells/**.json`
 */

// ============================================================================
// Path Resolution
// ============================================================================
// Resolve the spell-data root from the script location so this tool can be run
// from anywhere without depending on the caller's current working directory.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const SPELLS_ROOT = path.resolve(SCRIPT_DIR, '..', 'public', 'data', 'spells');

// ============================================================================
// Top-Level Ordering Rule
// ============================================================================
// Only the top-level key order is normalized here. The chosen order keeps the
// access fields together immediately after the spell identity fields, while any
// unexpected future keys retain their original relative order at the end.
// ============================================================================

const TOP_LEVEL_ORDER = [
  'id',
  'name',
  'aliases',
  'level',
  'school',
  'legacy',
  'classes',
  'subClasses',
  'subClassesVerification',
  'ritual',
  'rarity',
  'attackType',
  'castingTime',
  'range',
  'components',
  'duration',
  'targeting',
  'effects',
  'arbitrationType',
  'aiContext',
  'description',
  'higherLevels',
  'tags',
  'metadata',
] as const;

// ============================================================================
// File Discovery
// ============================================================================
// Walk every level folder so the normalization applies to the whole corpus
// instead of drifting level by level.
// ============================================================================

function listSpellJsonFiles(): string[] {
  const files: string[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelDir = path.join(SPELLS_ROOT, `level-${level}`);
    if (!fs.existsSync(levelDir)) continue;

    for (const entry of fs.readdirSync(levelDir)) {
      if (entry.endsWith('.json')) {
        files.push(path.join(levelDir, entry));
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

// ============================================================================
// Reordering Logic
// ============================================================================
// Rebuild only the top-level object. Known keys are emitted in the preferred
// order above, then any unknown keys are appended in their original order so we
// do not accidentally erase future schema growth.
// ============================================================================

function reorderTopLevelKeys(parsed: Record<string, unknown>): Record<string, unknown> {
  const reordered: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const key of TOP_LEVEL_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
    reordered[key] = parsed[key];
    seen.add(key);
  }

  for (const key of Object.keys(parsed)) {
    if (seen.has(key)) continue;
    reordered[key] = parsed[key];
  }

  return reordered;
}

function normalizeSpellFile(filePath: string): boolean {
  const rawJson = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  const reordered = reorderTopLevelKeys(parsed);
  const nextJson = `${JSON.stringify(reordered, null, 2)}\n`;

  if (nextJson === rawJson) {
    return false;
  }

  fs.writeFileSync(filePath, nextJson, 'utf8');
  return true;
}

// ============================================================================
// Execution
// ============================================================================
// Apply the normalization across the corpus and print a compact summary so the
// owner can see that this was a readability-only sweep rather than a schema or
// mechanic rewrite.
// ============================================================================

function main(): void {
  const spellFiles = listSpellJsonFiles();
  let updatedCount = 0;

  for (const filePath of spellFiles) {
    if (normalizeSpellFile(filePath)) {
      updatedCount += 1;
      console.log(`Reordered access fields in ${filePath}`);
    }
  }

  console.log(`Checked ${spellFiles.length} spell files; reordered ${updatedCount}.`);
}

main();
