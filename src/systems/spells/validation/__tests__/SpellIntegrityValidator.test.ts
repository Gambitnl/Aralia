
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SpellIntegrityValidator } from '../SpellIntegrityValidator';
import { Spell } from '../../../../types/spells';

/**
 * SpellIntegrityValidator — Regression Test Suite
 *
 * This file runs the SpellIntegrityValidator against real spell JSON data from
 * the public/data/spells/ directory. Its job is to make sure that data quality
 * problems introduced by early prototyping don't silently grow unchecked.
 *
 * There are two kinds of tests in this file:
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
 *            `npx vitest src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts --run`
 */

// ---------------------------------------------------------------------------
// Spell loader helper
// ---------------------------------------------------------------------------
// Points to the real spell JSON directory, relative to this test file's
// location. Tests use actual data so we catch real regressions, not toy cases.
const SPELLS_ROOT = path.resolve(__dirname, '../../../../../public/data/spells');

/**
 * Reads all spell JSON files for a given level from disk and returns them as
 * parsed Spell objects. Returns an empty array if the level directory doesn't
 * exist (e.g., if level-10 is never added).
 */
function getSpells(level: number): Spell[] {
  const dir = path.join(SPELLS_ROOT, `level-${level}`);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
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

const filterReviewedMonolithicClearance = (spell: Spell, errors: string[]): string[] => {
  // Reviewed one-effect spells should stop appearing as monolithic warnings,
  // but every other integrity rule must remain visible for those rows.
  if (!MONOLITHIC_SAFE_LIST.includes(spell.id)) {
    return errors;
  }

  return errors.filter(error => error !== 'Monolithic Effect Description');
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Concentration Sync rule
  // -------------------------------------------------------------------------
  // These are small isolated tests using hand-crafted minimal spell objects.
  // They exist to verify the rule itself is wired correctly, independent of
  // whether any real spells are currently broken.
  describe('Rule: Concentration Sync', () => {

    it('fails if concentration tag is missing', () => {
      // This spell claims to require concentration in its duration, but its
      // tags array doesn't include the "concentration" string — a mismatch.
      const badSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage']
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Concentration Mismatch: duration.concentration is true but \'tags\' is missing "concentration"');
    });

    it('passes if sync is correct', () => {
      // Both duration.concentration and the tags array agree — this is valid.
      const goodSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage', 'concentration']
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Unit tests: Effect Description Completeness rule
  // -------------------------------------------------------------------------
  // These tests lock G8/G9's cleanup into the validator itself. A spell effect
  // with valid structured mechanics but an empty or placeholder description is
  // still too opaque for UI, glossary, audits, and runtime trace debugging.
  describe('Rule: Effect Description Completeness', () => {

    it('fails if an effect description is blank', () => {
      const badSpell = {
        id: 'blank-effect-description',
        duration: { concentration: false },
        tags: [],
        school: 'Evocation',
        targeting: { type: 'single' },
        effects: [
          {
            type: 'DAMAGE',
            description: '   '
          }
        ]
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Gap: effect 0 has a blank description');
    });

    it('fails if an effect description is a generic placeholder', () => {
      const badSpell = {
        id: 'generic-effect-description',
        duration: { concentration: false },
        tags: [],
        school: 'Evocation',
        targeting: { type: 'single' },
        effects: [
          {
            type: 'UTILITY',
            description: 'See description.'
          }
        ]
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Placeholder: effect 0 uses generic placeholder "See description."');
    });
  });

  // -------------------------------------------------------------------------
  // Regression test: all Level 2 spells (hard failure gate)
  // -------------------------------------------------------------------------
  // This test loads every Level 2 spell from disk and validates them all.
  // Concentration and Enchantment targeting are treated as hard failures here
  // because those issues were fully remediated — any new file that reintroduces
  // them should immediately fail CI.
  //
  // Monolithic Effect warnings are NOT hard-gated here; they appear in the
  // Systematic test below.
  describe('Level 2 Regression Test', () => {
    const spells = getSpells(2);

    it('all Level 2 spells pass integrity checks', () => {
      const failures: string[] = [];

      // Run every Level 2 spell through the validator and collect all failures.
      spells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));
        if (errors.length > 0) {
          failures.push(`${spell.name}: ${errors.join(', ')}`);
        }
      });

      // Print the full failure list to the console for visibility even when
      // only certain categories are being hard-asserted below.
      if (failures.length > 0) {
        console.warn(`Integrity Failures Found (${failures.length}):\n${failures.join('\n')}`);
      }

      // HARD GATE: No Concentration mismatches allowed. This was fully remediated.
      const criticalFailures = failures.filter(f => f.includes('Concentration Mismatch'));
      expect(criticalFailures).toHaveLength(0);

      // HARD GATE: No Enchantment targeting gaps allowed. This was fully remediated.
      const enchantmentFailures = failures.filter(f => f.includes('Enchantment Gap'));
      expect(enchantmentFailures).toHaveLength(0);

      // HARD GATE: No blank or generic effect descriptions allowed. G8/G9 were
      // fully remediated, and future opaque descriptions should fail locally.
      const descriptionFailures = failures.filter(f => f.includes('Effect Description'));
      expect(descriptionFailures).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Systematic all-spell scan: Monolithic Effect tracking
  // -------------------------------------------------------------------------
  // This test scans every spell across all 10 levels (0-9) to generate the
  // working hit list of monolithic spell effects. G5 cleared the current hit
  // list, so this is now a hard regression gate: future one-effect copy-paste
  // blobs should fail locally instead of re-entering the corpus silently.
  describe('Systematic All-Spell Validation', () => {

    // Load every spell across all levels into one flat array.
    const allSpells: Spell[] = [];
    for (let level = 0; level <= 9; level++) {
      allSpells.push(...getSpells(level));
    }

    it('hard-fails monolithic spell effects across all spells', () => {
      const monolithicFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));

        // Collect only the monolithic-effect failures; ignore other rule errors.
        if (errors.some(e => e === 'Monolithic Effect Description')) {
          monolithicFailures.push(spell.id || spell.name);
        }
      });

      // Print the full hit list before failing so the next repair pass knows
      // exactly which rows reintroduced monolithic effect descriptions.
      if (monolithicFailures.length > 0) {
        console.warn(`Monolithic Effect Failures (${monolithicFailures.length}):\n${monolithicFailures.join('\n')}`);
      }

      expect(monolithicFailures).toHaveLength(0);
    });

    it('hard-fails blank or generic effect descriptions across all spells', () => {
      const descriptionFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));
        const relevantErrors = errors.filter(error => error.includes('Effect Description'));

        if (relevantErrors.length > 0) {
          descriptionFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      if (descriptionFailures.length > 0) {
        console.warn(`Effect Description Failures (${descriptionFailures.length}):\n${descriptionFailures.join('\n')}`);
      }

      expect(descriptionFailures).toHaveLength(0);
    });
  });
});
