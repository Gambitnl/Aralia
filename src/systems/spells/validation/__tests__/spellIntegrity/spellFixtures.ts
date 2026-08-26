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
 * Nearly every rule is now a HARD FAILURE: if a spell breaks one, the test
 * fails and blocks the build. `systematicAllSpellValidation.test.ts` hard-gates
 * Concentration Sync, Ritual Sync, Duration Progression, Mode Choice, Action
 * Cost Metadata, Light Metadata, Monolithic Effect Formulation, Effect
 * Description Completeness, and Effect Target Filter Completeness. The
 * Monolithic Effect rule finished its soft-warning phase: its hit list reached
 * zero and the assertion is live, so the shared reviewed clearances are the only
 * way a single-effect spell passes.
 *
 * Enchantment Targeting and Upcast Scaling Sync now have all-level gates too,
 * both in `systematicAllSpellValidation.test.ts`, after their corpus hit lists
 * reached zero. Enchantment Targeting keeps its narrower level-2 gate in
 * level2Regression.test.ts as well.
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

// The CLI gate and the test suite must apply the same reviewed clearances.
export { filterReviewedMonolithicClearance } from '../../spellIntegrityClearances';
