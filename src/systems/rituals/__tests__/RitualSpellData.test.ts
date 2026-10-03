import { describe, it, expect } from 'vitest';
import {
  canStartRitual,
  getBacklashOnFailure,
  startRitual,
  parseSpecialCastingTimeSeconds
} from '../RitualManager';
import { Spell, SpellSchool } from '../../../types/spells';
import { RitualState } from '../../../types/rituals';
import { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';

/**
 * These tests prove the two spell-side ritual paths the ritual runtime reads:
 * `ritualData.requirements` (can this ceremony start here and now?) and
 * `ritualData.backlash` (what happens when the ceremony breaks?).
 *
 * Before this fixture existed both paths were unreachable: the Spell type held
 * no ritual block, so requirement validation always returned valid and the
 * backlash getter always returned an empty list.
 */

// ============================================================================
// Spell Fixture With Requirements And Backlash
// ============================================================================
// One spell carries both blocks so a single fixture proves both code paths.
// The numbers follow Contact Other Plane: a night-only ceremony whose failure
// costs the caster 6d6 psychic damage.
// ============================================================================

const ritualSpell: Spell = {
  id: 'contact-other-plane',
  name: 'Contact Other Plane',
  level: 5,
  school: SpellSchool.Divination,
  classes: ['Wizard'],
  subClasses: [],
  subClassesVerification: 'unverified',
  description: 'You mentally contact a demigod...',
  ritual: true,
  castingTime: { value: 1, unit: 'minute' },
  range: { type: 'self', distance: 0 },
  components: { verbal: true, somatic: false, material: false },
  duration: { type: 'instantaneous', concentration: false },
  targeting: { type: 'self', validTargets: ['self'] },
  effects: [],
  ritualData: {
    requirements: [
      {
        type: 'time_of_day',
        value: ['Night', 'Evening'],
        description: 'The contact only opens after dark.'
      },
      {
        type: 'location',
        value: ['indoors', 'underground'],
        description: 'The ceremony needs a sheltered chamber.'
      }
    ],
    backlash: {
      type: 'damage',
      value: '6d6',
      damageType: 'psychic',
      saveDC: 15,
      minProgress: 0.5,
      description: 'The alien mind tears free and sears the caster.'
    }
  }
};

const plainRitualSpell: Spell = {
  ...ritualSpell,
  id: 'identify',
  name: 'Identify',
  ritualData: undefined
};

const caster: CombatCharacter = createMockCombatCharacter({ id: 'caster-1', name: 'Mage' });

/** Midnight and noon on the same day, used to drive the time_of_day requirement. */
const NIGHT = new Date('2026-01-01T23:30:00');
const NOON = new Date('2026-01-01T12:00:00');

function ritualAtProgress(spell: Spell, share: number): RitualState {
  const ritual = startRitual(caster, spell, 1);
  return {
    ...ritual,
    progressSeconds: ritual.durationTotalSeconds * share
  };
}

describe('spell-side ritual requirements', () => {
  it('reads requirements from spell.ritualData and accepts a matching context', () => {
    const result = canStartRitual(ritualSpell, {
      currentTime: NIGHT,
      locationType: 'indoors'
    });

    expect(result.valid).toBe(true);
  });

  it('rejects the ceremony and names the failed requirement when the time is wrong', () => {
    const result = canStartRitual(ritualSpell, {
      currentTime: NOON,
      locationType: 'indoors'
    });

    expect(result.valid).toBe(false);
    expect(result.failureReason).toBe('The contact only opens after dark.');
  });

  it('rejects the ceremony when the location type is wrong', () => {
    const result = canStartRitual(ritualSpell, {
      currentTime: NIGHT,
      locationType: 'outdoors'
    });

    expect(result.valid).toBe(false);
    expect(result.failureReason).toBe('The ceremony needs a sheltered chamber.');
  });

  it('treats a spell with no ritual block as unconditioned', () => {
    expect(canStartRitual(plainRitualSpell, {}).valid).toBe(true);
  });
});

describe('spell-side ritual backlash', () => {
  it('returns the spell backlash once the ceremony passes its minimum progress', () => {
    const backlash = getBacklashOnFailure(ritualAtProgress(ritualSpell, 0.75), ritualSpell);

    expect(backlash).toHaveLength(1);
    expect(backlash[0].value).toBe('6d6');
    expect(backlash[0].damageType).toBe('psychic');
    expect(backlash[0].saveDC).toBe(15);
  });

  it('withholds backlash while the ceremony is below its minimum progress', () => {
    expect(getBacklashOnFailure(ritualAtProgress(ritualSpell, 0.1), ritualSpell)).toEqual([]);
  });

  it('returns nothing for a spell that defines no backlash', () => {
    expect(getBacklashOnFailure(ritualAtProgress(plainRitualSpell, 1), plainRitualSpell)).toEqual([]);
  });

  it('prefers backlash already committed on the ritual state', () => {
    const committed = {
      ...ritualAtProgress(plainRitualSpell, 1),
      backlash: [{ type: 'status' as const, value: 'stunned', description: 'Committed at start.' }]
    };

    expect(getBacklashOnFailure(committed, plainRitualSpell)).toEqual(committed.backlash);
  });
});

describe('special casting times', () => {
  it('reads a prose casting time from spell.ritualData.castingTimeSpecial', () => {
    const specialSpell: Spell = {
      ...plainRitualSpell,
      id: 'special-rite',
      name: 'Special Rite',
      castingTime: { value: 0, unit: 'special' },
      ritualData: { castingTimeSpecial: '8 hours' }
    };

    expect(startRitual(caster, specialSpell, 1).durationTotalSeconds).toBe(28800);
  });

  it('fails loudly when a special casting time is not modeled at all', () => {
    const unmodeled: Spell = {
      ...plainRitualSpell,
      id: 'unmodeled-rite',
      name: 'Unmodeled Rite',
      castingTime: { value: 0, unit: 'special' }
    };

    expect(() => startRitual(caster, unmodeled, 1)).toThrow(/not modeled/);
  });

  it('parses the units the ritual runtime supports', () => {
    expect(parseSpecialCastingTimeSeconds('10 minutes')).toBe(600);
    expect(parseSpecialCastingTimeSeconds('1 hour')).toBe(3600);
    expect(parseSpecialCastingTimeSeconds('whenever the stars align')).toBeNull();
    expect(parseSpecialCastingTimeSeconds(undefined)).toBeNull();
  });
});
