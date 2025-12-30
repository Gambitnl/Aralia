
import { describe, it, expect } from 'vitest';
import { SpellValidator } from '../spellValidator';
import { createMockSpell } from '@/utils/factories';

describe('SpellValidator Material Components', () => {
  // Use factory to get a complete valid base spell
  const validSpellBase = createMockSpell({
    id: 'test-spell',
    name: 'Test Spell',
    components: {
      verbal: true,
      somatic: true,
      material: false,
      materialDescription: '',
      materialCost: 0,
      isConsumed: false,
    },
  });

  it('validates correct cost match', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'a diamond worth 50 gp',
        materialCost: 50,
        isConsumed: false,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });

  it('validates correct consumption match', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'incense worth 10 gp, which the spell consumes',
        materialCost: 10,
        isConsumed: true,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });

  it('validates multiple distinct material costs correctly', () => {
    // Tests logic: if (foundCosts.length >= 2)
    // "a diamond worth 50 gp and a ruby worth 50 gp" -> Sum is 100.
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'a diamond worth 50 gp and a ruby worth 50 gp',
        materialCost: 100, // Sum of costs
        isConsumed: false,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });

  it('fails on missing cost', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'a diamond worth 50 gp',
        // materialCost is required by schema, but if it is missing at runtime (or from JSON), Zod catches it
        // However, the schema says materialCost: z.number().
        // If we omit it, it's undefined.
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        materialCost: undefined as unknown,
        isConsumed: false,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(false);
    // Note: The missing cost error comes from the Zod structure check itself ("Required"),
    // NOT the superRefine check ("Material cost mismatch").
    // The original test expected "Material cost mismatch", but if the field is missing entirely,
    // Zod fails before superRefine.
    // To trigger the superRefine logic, we need the field to exist but be wrong (e.g. 0).
    // Let's adjust expectation: Missing field = Zod error.
    // But let's simulate the case where it IS a number (0) but mismatches description.
  });

  it('fails on mismatching cost (superRefine)', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'a diamond worth 50 gp',
        materialCost: 0, // Wrong cost (exists but 0)
        isConsumed: false,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Material cost mismatch');
    }
  });

  it('fails on cost mismatch (wrong value)', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'a diamond worth 50 gp',
        materialCost: 10, // Wrong cost
        isConsumed: false,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Material cost mismatch');
    }
  });

  it('fails on missing consumption flag', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'herbs that are consumed',
        materialCost: 0,
        isConsumed: false, // Should be true
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Material consumption mismatch');
    }
  });

  it('passes on pair pricing logic (Warding Bond case)', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'a pair of rings worth 50 gp each',
        materialCost: 100, // 2 * 50
        isConsumed: false,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });
});
