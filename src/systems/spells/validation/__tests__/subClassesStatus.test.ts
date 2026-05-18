import { describe, it, expect } from 'vitest';
import { SpellValidator } from '../spellValidator';
import { createMockSpell } from '@/utils/factories';

// Retired 2026-05-11 with the Sub-Classes bucket closure. The field
// `subClassesVerification` was needed while the lane was being filled out;
// it is now optional on the schema and may be absent entirely. The tests
// below document the retirement contract: presence with either status is
// still legal, absence is legal, and the previous refinement (that a
// non-empty subClasses list could not also carry `unverified`) is gone.

describe('SpellValidator subclass-verification retirement', () => {
  it('accepts a spell without subClassesVerification (post-retirement default shape)', () => {
    const spell = createMockSpell({
      subClasses: [],
    });
    delete (spell as { subClassesVerification?: 'unverified' | 'verified' }).subClassesVerification;

    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });

  it('still accepts a spell that carries the legacy "verified" marker', () => {
    const spell = createMockSpell({
      subClasses: [],
      subClassesVerification: 'verified',
    });

    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });

  it('accepts non-empty subClasses with the legacy "unverified" marker (refinement retired)', () => {
    const spell = createMockSpell({
      subClasses: ['Wizard - School of Evocation'],
    });
    spell.subClassesVerification = 'unverified';

    const result = SpellValidator.safeParse(spell);
    expect(result.success).toBe(true);
  });
});
