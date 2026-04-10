
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
        const errors = SpellIntegrityValidator.validate(spell);
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
    });
  });

  // -------------------------------------------------------------------------
  // Systematic all-spell scan: Monolithic Effect tracking (soft warning)
  // -------------------------------------------------------------------------
  // This test scans every spell across all 10 levels (0–9) to generate the
  // working hit list of monolithic spell effects. It is currently a SOFT TEST
  // — it prints the hit list as a console.warn but does NOT fail the test run.
  //
  // This design lets the team see the hit list shrink as spells are fixed
  // during Phase 2, without blocking CI on a known and tracked debt.
  //
  // PHASE 3 UPGRADE: Once the hit list reaches zero, uncomment the
  // expect(monolithicFailures).toHaveLength(0) assertion at the bottom of
  // this test. That permanently locks the rule as a hard failure.
  describe('Systematic All-Spell Validation', () => {

    // Load every spell across all levels into one flat array.
    const allSpells: Spell[] = [];
    for (let level = 0; level <= 9; level++) {
      allSpells.push(...getSpells(level));
    }

    // Safe-list: spell IDs that genuinely have only one effect despite sounding
    // like they might have more. Any spell on this list is skipped by the
    // monolithic check to prevent false positives.
    // Example entry: 'blade-ward' (one effect, long description, no copy-paste).
    const MONOLITHIC_SAFE_LIST: string[] = [
      // Add spell IDs here as they are reviewed and confirmed as legitimate.
    ];

    it('flags monolithic spell effects without failing (for now)', () => {
      const monolithicFailures: string[] = [];

      allSpells.forEach(spell => {
        // Skip any spells the team has manually confirmed as genuine one-effect spells.
        if (MONOLITHIC_SAFE_LIST.includes(spell.id)) return;

        const errors = SpellIntegrityValidator.validate(spell);

        // Collect only the monolithic-effect failures; ignore other rule errors.
        if (errors.some(e => e === 'Monolithic Effect Description')) {
          monolithicFailures.push(spell.id || spell.name);
        }
      });

      // Print the full hit list so the team can track progress during Phase 2.
      if (monolithicFailures.length > 0) {
        console.warn(`Monolithic Effect Failures (${monolithicFailures.length}):\n${monolithicFailures.join('\n')}`);
      }

      // TODO(next-agent / Phase 3): When the hit list above reaches zero spells,
      // uncomment this assertion to permanently lock the rule as a hard failure.
      // This prevents any new monolithic spell from being merged going forward.
      // expect(monolithicFailures).toHaveLength(0);
    });
  });
});
