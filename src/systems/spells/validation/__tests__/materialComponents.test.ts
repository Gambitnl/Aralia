
import { describe, it, expect } from 'vitest';
import { SpellValidator } from '../spellValidator';

describe('SpellValidator Material Components', () => {
  const validSpellBase = {
    id: 'test-spell',
    name: 'Test Spell',
    level: 1,
    school: 'Evocation',
    classes: ['Wizard'],
    description: 'A test spell.',
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'ranged', distance: 60 },
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'single', validTargets: ['creatures'] },
    effects: [],
  };

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

  it('fails on missing cost', () => {
    const spell = {
      ...validSpellBase,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialDescription: 'a diamond worth 50 gp',
        // materialCost missing
        isConsumed: false,
      },
    };
    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Material cost mismatch');
    }
  });

  it('fails on cost mismatch', () => {
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
