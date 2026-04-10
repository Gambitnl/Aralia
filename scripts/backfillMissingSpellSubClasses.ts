import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script makes the new `subClasses` field explicit across the full spell corpus.
 *
 * The spell validator now requires every spell JSON file to declare both:
 * - whether subclass/domain-specific access exists (`subClasses`)
 * - whether that answer has actually been verified (`subClassesVerification`)
 *
 * Most of the older spell files never stored either answer explicitly, so this
 * script backfills the conservative defaults:
 * - `subClasses: []`
 * - `subClassesVerification: "unverified"`
 *
 * That keeps the field testable without pretending the whole corpus has already
 * been source-checked.
 *
 * Called manually by: Codex during the spell-truth validation lane
 * Depends on: `public/data/spells/**.json`
 */

// ============================================================================
// Path Resolution
// ============================================================================
// This section resolves the spell-data root from the script location so the tool
// can be run from anywhere without relying on the caller's current directory.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const SPELLS_ROOT = path.resolve(SCRIPT_DIR, '..', 'public', 'data', 'spells');

// ============================================================================
// File Discovery
// ============================================================================
// This section walks the level folders and returns the full set of spell JSON files.
// The spell corpus is intentionally scanned broadly because the new validator rule
// applies to every spell file, not only to one repaired subset.
// ============================================================================

function listSpellJsonFiles(): string[] {
  const files: string[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelDir = path.join(SPELLS_ROOT, `level-${level}`);
    if (!fs.existsSync(levelDir)) continue;

    for (const entry of fs.readdirSync(levelDir)) {
      if (!entry.endsWith('.json')) continue;
      files.push(path.join(levelDir, entry));
    }
  }

  return files;
}

// ============================================================================
// Backfill Logic
// ============================================================================
// This section applies the minimal safe corpus-wide repair:
// if a spell does not yet declare `subClasses`, add an explicit empty array
// if a spell does not yet declare `subClassesVerification`, mark it unverified
//
// We do not guess subclass/domain access here. This script only makes absence
// explicit and records that the field still needs review unless another
// verification-specific script has already promoted it to `verified`.
// ============================================================================

function ensureSubClassesField(filePath: string): boolean {
  const rawJson = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  let changed = false;

  if (!Object.prototype.hasOwnProperty.call(parsed, 'subClasses')) {
    // Add the explicit empty array so future validation can distinguish
    // "field intentionally empty" from "field never modeled."
    parsed.subClasses = [];
    changed = true;
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, 'subClassesVerification')) {
    // Default the verification state to unverified unless a narrower script
    // has already established source-checked subclass access for this spell.
    parsed.subClassesVerification = 'unverified';
    changed = true;
  }

  if (!changed) {
    return false;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  return true;
}

// ============================================================================
// Execution
// ============================================================================
// This section applies the backfill and prints a compact summary so the owner
// can see how many older spell files had to be brought up to the new rule.
// ============================================================================

function main(): void {
  const spellFiles = listSpellJsonFiles();
  let updatedCount = 0;

  for (const filePath of spellFiles) {
    if (ensureSubClassesField(filePath)) {
      updatedCount += 1;
      console.log(`Added subClasses field to ${filePath}`);
    }
  }

  console.log(`Checked ${spellFiles.length} spell files; updated ${updatedCount}.`);
}

main();
