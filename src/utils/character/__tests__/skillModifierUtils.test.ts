/**
 * Expertise is the doubled proficiency bonus on a chosen skill, and a divine
 * blessing is a structured rider on a status effect. Both have to read the same
 * on the character sheet and in the roll, so this file proves the shared math
 * (skillModifierUtils) and the resolver that consumes it (checkUtils) agree.
 *
 * agora-7601 (expertise) and agora-0a28 (blessing advantage).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateExpertiseBonus,
  calculateTotalSkillModifier,
  getExpertiseSkillIds,
  hasExpertiseInSkill,
  normalizeSkillId
} from '../skillModifierUtils';
import { getCheckAdvantageSources, rollAbilityCheck } from '../checkUtils';
import { PlayerCharacter } from '../../../types/character';
import { BLESSING_EFFECTS } from '../../../data/religion/blessings';
import { rollDice } from '../../../systems/dice/rollers';

vi.mock('../../../systems/dice/rollers', () => ({
  rollDice: vi.fn()
}));

const createCharacter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter => ({
  id: 'expert',
  name: 'Expert',
  level: 5,
  proficiencyBonus: 3,
  finalAbilityScores: { Strength: 10, Dexterity: 16, Constitution: 10, Intelligence: 10, Wisdom: 14, Charisma: 10 },
  skills: [{ id: 'stealth', name: 'Stealth', ability: 'Dexterity' }],
  statusEffects: [],
  modifiers: { advantage: [], disadvantage: [], bonuses: [] },
  ...overrides
} as unknown as PlayerCharacter);

describe('normalizeSkillId', () => {
  it('accepts a display name or an id', () => {
    expect(normalizeSkillId('Sleight of Hand')).toBe('sleight_of_hand');
    expect(normalizeSkillId('sleight_of_hand')).toBe('sleight_of_hand');
    expect(normalizeSkillId('  Animal Handling ')).toBe('animal_handling');
  });
});

describe('getExpertiseSkillIds', () => {
  it('collects the picks recorded by every granting feature', () => {
    const character = createCharacter({
      featChoices: {
        skill_expert: { selectedExpertiseSkills: ['Stealth'] },
        expertise: { selectedExpertiseSkills: ['Sleight of Hand', 'stealth'] }
      }
    } as unknown as Partial<PlayerCharacter>);

    expect(getExpertiseSkillIds(character).sort()).toEqual(['sleight_of_hand', 'stealth']);
  });

  it('returns nothing for a character with no recorded picks', () => {
    expect(getExpertiseSkillIds(createCharacter())).toEqual([]);
    expect(getExpertiseSkillIds(undefined)).toEqual([]);
    expect(getExpertiseSkillIds(createCharacter({
      featChoices: { skill_expert: { selectedAbilityScore: 'Dexterity' } }
    } as unknown as Partial<PlayerCharacter>))).toEqual([]);
  });

  it('matches by display name or id', () => {
    const character = createCharacter({
      featChoices: { skill_expert: { selectedExpertiseSkills: ['Sleight of Hand'] } }
    } as unknown as Partial<PlayerCharacter>);

    expect(hasExpertiseInSkill(character, 'sleight_of_hand')).toBe(true);
    expect(hasExpertiseInSkill(character, 'Sleight of Hand')).toBe(true);
    expect(hasExpertiseInSkill(character, 'Stealth')).toBe(false);
  });
});

describe('calculateExpertiseBonus', () => {
  it('is worth one more proficiency bonus, and only when proficient', () => {
    expect(calculateExpertiseBonus({ hasProficiency: true, hasExpertise: true, proficiencyBonus: 3 })).toBe(3);
    expect(calculateExpertiseBonus({ hasProficiency: true, hasExpertise: false, proficiencyBonus: 3 })).toBe(0);
    // Expertise doubles proficiency; with no proficiency there is nothing to double.
    expect(calculateExpertiseBonus({ hasProficiency: false, hasExpertise: true, proficiencyBonus: 3 })).toBe(0);
  });
});

describe('calculateTotalSkillModifier', () => {
  it('keeps its existing answer when no expertise is passed', () => {
    // Dex 16 -> +3, level 5 proficiency -> +3.
    expect(calculateTotalSkillModifier({ abilityScore: 16, hasProficiency: true, level: 5 })).toBe(6);
    expect(calculateTotalSkillModifier({ abilityScore: 16, hasProficiency: false, level: 5 })).toBe(3);
  });

  it('adds the doubled proficiency bonus with expertise', () => {
    expect(calculateTotalSkillModifier({ abilityScore: 16, hasProficiency: true, level: 5, hasExpertise: true })).toBe(9);
    expect(calculateTotalSkillModifier({ abilityScore: 16, hasProficiency: false, level: 5, hasExpertise: true })).toBe(3);
  });
});

describe('rollAbilityCheck expertise integration', () => {
  // mockClear leaves mockReturnValueOnce queues in place; mockReset drains them.
  beforeEach(() => {
    vi.mocked(rollDice).mockReset();
  });

  it('doubles proficiency on the picked skill and leaves other skills alone', () => {
    const character = createCharacter({
      skills: [
        { id: 'stealth', name: 'Stealth', ability: 'Dexterity' },
        { id: 'acrobatics', name: 'Acrobatics', ability: 'Dexterity' }
      ],
      featChoices: { skill_expert: { selectedExpertiseSkills: ['Stealth'] } }
    } as unknown as Partial<PlayerCharacter>);

    vi.mocked(rollDice).mockReturnValue(10);

    // Dex 16 -> +3, level 5 proficiency -> +3, expertise -> +3 more.
    const stealth = rollAbilityCheck(character, 'Dexterity', 'Stealth');
    expect(stealth.total).toBe(19);
    expect(stealth.modifiersApplied).toEqual([{ source: 'Expertise', value: 3 }]);

    const acrobatics = rollAbilityCheck(character, 'Dexterity', 'Acrobatics');
    expect(acrobatics.total).toBe(16);
    expect(acrobatics.modifiersApplied).toBeUndefined();
  });

  it('does not grant expertise on a skill the character is not proficient in', () => {
    const character = createCharacter({
      skills: [],
      featChoices: { skill_expert: { selectedExpertiseSkills: ['Stealth'] } }
    } as unknown as Partial<PlayerCharacter>);

    vi.mocked(rollDice).mockReturnValue(10);

    expect(rollAbilityCheck(character, 'Dexterity', 'Stealth').total).toBe(13);
  });
});

describe('divine blessing advantage', () => {
  // mockClear leaves mockReturnValueOnce queues in place; mockReset drains them.
  beforeEach(() => {
    vi.mocked(rollDice).mockReset();
  });

  const blessed = (): PlayerCharacter => createCharacter({
    // The repo carries two StatusEffect shapes; religionReducer bridges them the
    // same way when it grants a blessing.
    statusEffects: [BLESSING_EFFECTS['blessing_scales_of_justice'].effect] as unknown as PlayerCharacter['statusEffects']
  });

  it('gives Scales of Justice advantage on Insight checks only', () => {
    vi.mocked(rollDice).mockReturnValueOnce(4).mockReturnValueOnce(18);
    const insight = rollAbilityCheck(blessed(), 'Wisdom', 'Insight');
    expect(insight.roll).toBe(18);
    expect(rollDice).toHaveBeenCalledTimes(2);

    // Perception is also Wisdom, and a bare Wisdom check is not an Insight check.
    vi.mocked(rollDice).mockReset();
    vi.mocked(rollDice).mockReturnValueOnce(4).mockReturnValueOnce(18);
    expect(rollAbilityCheck(blessed(), 'Wisdom', 'Perception').roll).toBe(4);
    expect(rollDice).toHaveBeenCalledTimes(1);

    vi.mocked(rollDice).mockReset();
    vi.mocked(rollDice).mockReturnValueOnce(4).mockReturnValueOnce(18);
    expect(rollAbilityCheck(blessed(), 'Wisdom').roll).toBe(4);
    expect(rollDice).toHaveBeenCalledTimes(1);
  });

  it('adds no flat bonus, so the blessing is advantage and nothing else', () => {
    vi.mocked(rollDice).mockReturnValue(10);
    // Wis 14 -> +2, not proficient in Insight.
    expect(rollAbilityCheck(blessed(), 'Wisdom', 'Insight').total).toBe(12);
  });

  it('names the blessing through getCheckAdvantageSources for the character sheet', () => {
    expect(getCheckAdvantageSources(blessed(), 'Wisdom', 'Insight')).toEqual({
      advantage: ['Scales of Justice'],
      disadvantage: []
    });
    expect(getCheckAdvantageSources(blessed(), 'Wisdom', 'Perception')).toEqual({
      advantage: [],
      disadvantage: []
    });
  });

  it("leaves Artisan's Touch off ordinary checks, because it is a crafting bonus", () => {
    const artisan = createCharacter({
      statusEffects: [BLESSING_EFFECTS['blessing_artisans_touch'].effect] as unknown as PlayerCharacter['statusEffects']
    });

    vi.mocked(rollDice).mockReturnValue(10);
    expect(rollAbilityCheck(artisan, 'Strength', 'Athletics').total).toBe(10);
    expect(getCheckAdvantageSources(artisan, 'Strength', 'Athletics').advantage).toEqual([]);
  });
});
