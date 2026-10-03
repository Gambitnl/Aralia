import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

// Unit tests for the checks consolidated into SpellIntegrityValidator on
// 2026-09-20, when LegacySpellValidator, spellAuditor, and
// spellConsistencyValidator were retired. Suite overview lives in
// ./spellFixtures.ts.

describe('SpellIntegrityValidator consolidated checks', () => {

  // -------------------------------------------------------------------------
  // Rule 8: Upcast Scaling Sync — cantrip tier tables
  // -------------------------------------------------------------------------
  // A cantrip records its growth as a scalingTiers table keyed by character
  // level, not as a per-slot bonus. Before the consolidation only the retired
  // spellAuditor read that shape, so the Upcast rule fired on every cantrip
  // that scaled correctly.
  describe('Rule: Upcast Scaling Sync', () => {

    const upcastText = 'The damage increases when you reach higher character levels.';

    it('accepts a scalingTiers table as real scaling', () => {
      const cantrip = {
        id: 'test-cantrip',
        duration: {},
        higherLevels: upcastText,
        effects: [
          { scaling: { type: 'character_level', scalingTiers: { 5: '2d10', 11: '3d10', 17: '4d10' } } },
        ],
      } as unknown as Spell;

      // Scoped to this rule: the minimal fixture deliberately omits the
      // structured payload other rules look for.
      expect(SpellIntegrityValidator.validate(cantrip).filter(error => error.startsWith('Upcast Gap'))).toHaveLength(0);
    });

    it('still fails when no effect carries any scaling shape', () => {
      const unscaled = {
        id: 'test-unscaled',
        duration: {},
        higherLevels: upcastText,
        effects: [{ scaling: { type: 'slot_level', bonusPerLevel: '', customFormula: '' } }],
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(unscaled)).toContain(
        `Upcast Gap: 'higherLevels' description exists but no effect scaling or target scaling detected.`
      );
    });

    it('treats an empty scalingTiers table as no scaling', () => {
      const emptyTiers = {
        id: 'test-empty-tiers',
        duration: {},
        higherLevels: upcastText,
        effects: [{ scaling: { type: 'character_level', scalingTiers: {} } }],
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(emptyTiers)).toContain(
        `Upcast Gap: 'higherLevels' description exists but no effect scaling or target scaling detected.`
      );
    });
  });

  // -------------------------------------------------------------------------
  // Rule 7: Enchantment Targeting - size limits
  // -------------------------------------------------------------------------
  // Remy ruling, combat sheet q10 (2026-09-20 23:21Z): a size limit is a valid
  // restricted-target declaration. Antipathy/Sympathy is the spell that needs
  // it - its text gates the anchor on "Huge or smaller" and names no creature
  // type at all, so a creature-type gate would be invented rules data.
  describe('Rule: Enchantment Targeting size gate', () => {

    const enchantment = (filter: Record<string, unknown>) => ({
      id: 'test-enchantment',
      school: 'Enchantment',
      duration: {},
      targeting: { type: 'single', filter },
      effects: [],
    } as unknown as Spell);

    const enchantmentGaps = (spell: Spell) =>
      SpellIntegrityValidator.validate(spell).filter(error => error.startsWith('Enchantment Gap'));

    it('accepts a concrete size list as a restricted-target declaration', () => {
      expect(enchantmentGaps(enchantment({
        creatureTypes: [],
        excludeCreatureTypes: [],
        sizes: ['Tiny', 'Small', 'Medium', 'Large', 'Huge'],
      }))).toHaveLength(0);
    });

    it('accepts the "Huge or smaller" source phrase the corpus records', () => {
      expect(enchantmentGaps(enchantment({
        creatureTypes: [],
        excludeCreatureTypes: [],
        sizes: ['Huge or smaller'],
      }))).toHaveLength(0);
    });

    it('still fails when the size list is empty', () => {
      expect(enchantmentGaps(enchantment({
        creatureTypes: [],
        excludeCreatureTypes: [],
        sizes: [],
      }))).toHaveLength(1);
    });

    it('still fails when the size list holds only the not_applicable sentinel', () => {
      expect(enchantmentGaps(enchantment({
        creatureTypes: [],
        excludeCreatureTypes: [],
        sizes: ['not_applicable'],
      }))).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 7: Enchantment Targeting - reviewed exemptions
  // -------------------------------------------------------------------------
  // Remy ruling, combat sheet q12 (2026-09-21 23:20Z), option A with a misuse
  // guard: hex and power-word-heal carry no creature-type restriction by
  // design, so a named exemption list lives inside the validator - not in the
  // spell JSON, so a data author cannot self-exempt - and a listed spell that
  // later gains a creature-type filter fails as a stale exemption.
  describe('Rule: Enchantment Targeting reviewed exemptions', () => {

    const exemptSpell = (spellId: string, filter: Record<string, unknown>) => ({
      id: spellId,
      school: 'Enchantment',
      duration: {},
      targeting: { type: 'single', filter },
      effects: [],
    } as unknown as Spell);

    const emptyFilter = {
      creatureTypes: [],
      excludeCreatureTypes: [],
      sizes: [],
    };

    const errorsFor = (spell: Spell) => SpellIntegrityValidator.validate(spell);

    it('names hex and power-word-heal with a reason, reviewer, and review date', () => {
      const exemptions = SpellIntegrityValidator.getEnchantmentTargetingExemptions();

      expect(exemptions.map(entry => entry.spellId).sort()).toEqual(['hex', 'power-word-heal']);

      exemptions.forEach(entry => {
        expect(entry.reason.length).toBeGreaterThan(20);
        expect(entry.reviewedBy.length).toBeGreaterThan(0);
        expect(entry.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('passes Rule 7 for a listed spell that declares no target filter at all', () => {
      ['hex', 'power-word-heal'].forEach(spellId => {
        const errors = errorsFor(exemptSpell(spellId, emptyFilter));
        expect(errors.filter(error => error.startsWith('Enchantment Gap'))).toHaveLength(0);
        expect(errors.filter(error => error.startsWith('Stale Exemption'))).toHaveLength(0);
      });
    });

    it('fails a listed spell as a stale exemption once it gains an inclusion filter', () => {
      const errors = errorsFor(exemptSpell('hex', {
        ...emptyFilter,
        creatureTypes: ['Humanoid'],
      }));

      expect(errors.filter(error => error.startsWith('Stale Exemption'))).toHaveLength(1);
      expect(errors.join('\n')).toContain('Remove the exemption entry in SpellIntegrityValidator.ts');
    });

    it('fails a listed spell as a stale exemption once it gains an exclusion filter', () => {
      const errors = errorsFor(exemptSpell('power-word-heal', {
        ...emptyFilter,
        excludeCreatureTypes: ['Construct', 'Undead'],
      }));

      expect(errors.filter(error => error.startsWith('Stale Exemption'))).toHaveLength(1);
    });

    it('fails a listed spell as a stale exemption when the creature-type gate sits on an effect', () => {
      const spell = {
        id: 'hex',
        school: 'Enchantment',
        duration: {},
        targeting: { type: 'single', filter: emptyFilter },
        effects: [
          { condition: { targetFilter: { excludeCreatureTypes: ['Undead'] } } },
        ],
      } as unknown as Spell;

      expect(errorsFor(spell).filter(error => error.startsWith('Stale Exemption'))).toHaveLength(1);
    });

    it('keeps the strict rule for any Enchantment spell not on the list', () => {
      const errors = errorsFor(exemptSpell('some-other-enchantment', emptyFilter));

      expect(errors.filter(error => error.startsWith('Enchantment Gap'))).toHaveLength(1);
      expect(errors.filter(error => error.startsWith('Stale Exemption'))).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // validateSemantics: named-spell targeting backstop
  // -------------------------------------------------------------------------
  // These two spell-ID sets came from LegacySpellValidator. scripts/validate-data.ts
  // is the caller, and it stops the build on an error while printing a warning.
  describe('validateSemantics: named-spell targeting', () => {

    const humanoidOnlySpell = (filterCreatureTypes: string[], validTargets: string[] = ['creatures']) => ({
      id: 'friends',
      school: 'Enchantment',
      targeting: { validTargets, filter: { creatureTypes: filterCreatureTypes, excludeCreatureTypes: [] } },
      effects: [],
    } as unknown as Spell);

    it('raises a generic_targeting error when a Humanoid-only spell targets any creature', () => {
      const issues = SpellIntegrityValidator.validateSemantics(humanoidOnlySpell([]));

      expect(issues).toHaveLength(1);
      expect(issues[0].issueType).toBe('generic_targeting');
      expect(issues[0].severity).toBe('error');
    });

    it('accepts a Humanoid-only spell whose filter names Humanoid', () => {
      expect(SpellIntegrityValidator.validateSemantics(humanoidOnlySpell(['Humanoid']))).toHaveLength(0);
    });

    it('accepts a Humanoid-only spell whose validTargets name humanoids', () => {
      expect(SpellIntegrityValidator.validateSemantics(humanoidOnlySpell([], ['humanoids']))).toHaveLength(0);
    });

    it('warns when a named mental enchantment carries no creature-type gate', () => {
      const command = {
        id: 'command',
        school: 'Enchantment',
        targeting: { validTargets: ['creatures'], filter: { creatureTypes: [], excludeCreatureTypes: [] } },
        effects: [],
      } as unknown as Spell;

      const issues = SpellIntegrityValidator.validateSemantics(command);

      expect(issues).toHaveLength(1);
      expect(issues[0].issueType).toBe('missing_immunity_filter');
      expect(issues[0].severity).toBe('warning');
    });

    it('accepts a creature-type gate declared on an effect condition', () => {
      const command = {
        id: 'command',
        school: 'Enchantment',
        targeting: { validTargets: ['creatures'], filter: { creatureTypes: [], excludeCreatureTypes: [] } },
        effects: [{ condition: { targetFilter: { excludeCreatureTypes: ['Construct', 'Undead'] } } }],
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validateSemantics(command)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // validateSemantics: bonusPerLevel format
  // -------------------------------------------------------------------------
  // Moved from spellAuditor's "complex_scaling" check. A bonus the dice math can
  // read is "+1d6", "1d6", "+5", or "-1"; anything else still needs custom
  // handling, which is debt rather than an authoring mistake.
  describe('validateSemantics: bonusPerLevel format', () => {

    const spellWithBonus = (bonusPerLevel: string) => ({
      id: 'test-scaling',
      school: 'Evocation',
      targeting: { validTargets: ['creatures'], filter: { creatureTypes: [], excludeCreatureTypes: [] } },
      effects: [{ scaling: { bonusPerLevel } }],
    } as unknown as Spell);

    it.each(['+1d6', '1d6', '+5', '-1', '+1 d6'])('accepts the standard bonus "%s"', bonus => {
      expect(SpellIntegrityValidator.validateSemantics(spellWithBonus(bonus))).toHaveLength(0);
    });

    it.each(['+1 target', '+5 temp HP', '+1 maximum devil CR per slot level above 4th'])(
      'warns about the non-standard bonus "%s"',
      bonus => {
        const issues = SpellIntegrityValidator.validateSemantics(spellWithBonus(bonus));

        expect(issues).toHaveLength(1);
        expect(issues[0].issueType).toBe('nonstandard_scaling_format');
        expect(issues[0].severity).toBe('warning');
        expect(issues[0].message).toContain(bonus);
      }
    );

    it('names the effect index that carries the non-standard bonus', () => {
      const spell = {
        id: 'test-scaling',
        school: 'Evocation',
        targeting: { validTargets: ['creatures'], filter: { creatureTypes: [], excludeCreatureTypes: [] } },
        effects: [{ scaling: { bonusPerLevel: '+1d6' } }, { scaling: { bonusPerLevel: '+1 target' } }],
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validateSemantics(spell)[0].message).toContain('Effect 1');
    });
  });
});
