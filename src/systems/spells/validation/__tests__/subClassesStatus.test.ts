import { describe, it, expect } from 'vitest';
import { SpellValidator } from '../spellValidator';
import { createMockSpell } from '@/utils/factories';

describe('SpellValidator subclass status marker', () => {
  it('accepts a normalized empty lane with an explicit status marker', () => {
    const spell = createMockSpell({
      subClasses: [],
      subClassesVerification: 'verified',
    });

    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });

  it('keeps the marker out of the real subclass array', () => {
    const spell = createMockSpell({
      subClasses: ['Wizard - School of Evocation'],
    });

    // Re-attach the marker after factory normalization so we test the validator
    // directly instead of re-testing the helper's cleanup rule.
    spell.subClassesVerification = 'unverified';

    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path.join('.') === 'subClassesVerification')).toBe(true);
    }
  });
});
