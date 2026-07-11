import fs from 'fs';
import path from 'path';
import { Spell } from '../../../../../types/spells';

/**
 * SpellIntegrityValidator — Regression Test Suite (shared fixtures)
 *
 * The per-area test files in this directory run the SpellIntegrityValidator
 * against real spell JSON data from the public/data/spells/ directory. Their
 * job is to make sure that data quality problems introduced by early
 * prototyping don't silently grow unchecked.
 *
 * There are two kinds of tests in this suite:
 *
 *   HARD FAILURES — rules that are fully fixed and must stay clean. If a spell
 *   breaks one of these, the test fails and blocks the build. Right now, that
 *   covers Concentration Sync and Enchantment Targeting (both were manually
 *   remediated across all affected spells).
 *
 *   SOFT WARNINGS — rules that track known ongoing debt. These print a hit list
 *   to the console on every test run but do NOT fail the test. This lets us see
 *   progress as spells are fixed without breaking CI. The Monolithic Effect
 *   rule lives here during Phase 2 of the spell overhaul.
 *
 * Phase 3 upgrade path: once the monolithic spell hit list reaches zero, the
 * commented-out expect() assertion at the bottom of the Systematic test should
 * be uncommented. That will permanently lock the rule as a hard failure.
 *
 * Called by: `npx vitest` (full suite) or
 *            `npx vitest src/systems/spells/validation/__tests__/spellIntegrity --run`
 */

// ---------------------------------------------------------------------------
// Spell loader helper
// ---------------------------------------------------------------------------
// Points to the real spell JSON directory, relative to this test file's
// location. Tests use actual data so we catch real regressions, not toy cases.
const SPELLS_ROOT = path.resolve(__dirname, '../../../../../../public/data/spells');

/**
 * Reads all spell JSON files for a given level from disk and returns them as
 * parsed Spell objects. Returns an empty array if the level directory doesn't
 * exist (e.g., if level-10 is never added).
 */
export function getSpells(level: number): Spell[] {
  const dir = path.join(SPELLS_ROOT, `level-${level}`);
  if (!fs.existsSync(dir)) return [];

  // Some checked-in spell JSON files carry a UTF-8 BOM. Strip it here so the
  // regression suite keeps exercising spell content instead of tripping over
  // file-encoding noise in the loader.
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8').replace(/^\uFEFF/, '')));
}

// ---------------------------------------------------------------------------
// Reviewed monolithic-effect clearances
// ---------------------------------------------------------------------------
// These spell IDs were manually checked and confirmed as legitimate single-effect
// rows. Keeping the list shared prevents the level-specific visibility scan and
// the all-spell monolithic scan from disagreeing about the same reviewed data.
const MONOLITHIC_SAFE_LIST: string[] = [
  // Light is one structured light-emission effect with object targeting, radius
  // metadata, color choice, cover blocking, and recast ending data. Its long
  // top-level prose does not imply a missing second combat effect.
  'light',
  // Gentle Repose is one structured corpse/remains protection utility. The
  // target special-identity filter carries the important mechanical gate, so
  // splitting it would create artificial effects rather than real behavior.
  'gentle-repose',
  // See Invisibility is one self-applied sensory utility. Its single effect
  // already names sensory behavior, duration, and self targeting; there is no
  // separate damage/status/action payload to extract.
  'see-invisibility',
  // Enhance Ability is one advantage-granting utility effect. The important
  // complexity lives in targeting metadata: scalable target count and a
  // required per-target ability choice, so splitting the effect would duplicate
  // that already structured target-side rule.
  'enhance-ability'
];

export const filterReviewedMonolithicClearance = (spell: Spell, errors: string[]): string[] => {
  // Reviewed one-effect spells should stop appearing as monolithic warnings,
  // but every other integrity rule must remain visible for those rows.
  if (!MONOLITHIC_SAFE_LIST.includes(spell.id)) {
    return errors;
  }

  return errors.filter(error => error !== 'Monolithic Effect Description');
};
