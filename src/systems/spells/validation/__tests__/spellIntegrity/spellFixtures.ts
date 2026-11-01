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
 * The following all-level checks are HARD FAILURES: if a spell breaks one,
 * `systematicAllSpellValidation.test.ts` fails and blocks the build. Its guard
 * checks this list against the actual corpus-wide tests, so adding or removing
 * a gate requires updating the human overview too. Named-spell examples and
 * narrower per-area tests remain separate; this list does not replace them.
 *
 * BEGIN ALL-LEVEL HARD GATES
 * - `hard-fails unclassified restricted-filter mismatches`: Effect Target Filter Completeness and reviewed classifications.
 * - `hard-fails concentration tag mismatches across all spells`: Concentration Sync.
 * - `hard-fails ritual tag mismatches across all spells`: Ritual Sync.
 * - `hard-fails duration progression mismatches across all spells`: Duration Progression.
 * - `hard-fails unclassified mode choice mismatches across all spells`: Mode Choice.
 * - `hard-fails unclassified malformed action-cost metadata across all spells`: Action Cost Metadata.
 * - `hard-fails malformed light metadata across all spells`: Light Metadata.
 * - `hard-fails unconstrained Enchantment targeting across all spells`: Enchantment Targeting.
 * - `hard-fails missing upcast scaling across all spells`: Upcast Scaling Sync.
 * - `hard-fails stale Enchantment targeting exemptions across all spells`: Reviewed Enchantment exemptions must still match spell data.
 * - `keeps every reviewed Enchantment exemption pointed at a real corpus spell`: Reviewed Enchantment exemptions cannot reference removed spells.
 * - `hard-fails monolithic spell effects across all spells`: Monolithic Effect Formulation.
 * - `hard-fails blank or generic effect descriptions across all spells`: Effect Description Completeness.
 * - `hard-fails importer scaffold wording in effect descriptions across all spells`: Effect descriptions must explain player-facing behavior, not importer machinery.
 * END ALL-LEVEL HARD GATES
 *
 * Existing corpus assertions and reviewed exceptions remain unchanged. The
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
