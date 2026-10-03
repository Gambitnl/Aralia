/**
 * Level-up persistence of every `featChoices` entry (agora-db71.21).
 *
 * The level-up modal records a class feature's pick under that feature's own
 * key ("expertise" for the bard, "scholar" for the wizard), not under a feat
 * id. `performLevelUp` used to copy only `choices.featChoices[featId]`, so a
 * pick made for a class feature was dropped the moment the level was applied
 * and the sheet read no expertise (WF-G269). These cases pin the whole map
 * surviving the level-up, and the expertise math reading it afterwards.
 */
import { describe, it, expect } from 'vitest';
import { performLevelUp } from '../progression';
import {
  calculateExpertiseBonus,
  hasExpertiseInSkill,
} from '../skillModifierUtils';
import { calculateProficiencyBonus } from '../savingThrowUtils';
import { createMockPlayerCharacter } from '../../core/factories';
import { CLASSES_DATA } from '../../../data/classes';
import { SKILLS_DATA } from '../../../data/skills';
import type { PlayerCharacter } from '../../../types';

/** A bard sitting on exactly enough XP for level 2, proficient in Persuasion. */
const createLevelReadyBard = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter =>
  createMockPlayerCharacter({
    name: 'Expertise Bard',
    class: CLASSES_DATA.bard,
    classLevels: { bard: 1 },
    level: 1,
    xp: 300,
    skills: [SKILLS_DATA.persuasion, SKILLS_DATA.deception],
    ...overrides,
  });

describe('performLevelUp featChoices persistence (agora-db71.21)', () => {
  it('keeps a class-feature expertise pick made during the level-up', () => {
    const bard = createLevelReadyBard();

    const leveled = performLevelUp(bard, {
      classId: 'bard',
      featChoices: {
        expertise: { selectedExpertiseSkills: ['persuasion', 'deception'] },
      },
    });

    expect(leveled.level).toBe(2);
    expect(leveled.featChoices?.expertise).toEqual({
      selectedExpertiseSkills: ['persuasion', 'deception'],
    });
  });

  it('feeds the surviving pick to the expertise bonus math', () => {
    const bard = createLevelReadyBard();

    const leveled = performLevelUp(bard, {
      classId: 'bard',
      featChoices: {
        expertise: { selectedExpertiseSkills: ['persuasion'] },
      },
    });

    const proficiencyBonus = calculateProficiencyBonus(leveled.level ?? 1);

    expect(hasExpertiseInSkill(leveled, 'persuasion')).toBe(true);
    expect(calculateExpertiseBonus({
      hasProficiency: true,
      hasExpertise: hasExpertiseInSkill(leveled, 'persuasion'),
      proficiencyBonus,
    })).toBe(proficiencyBonus);

    // A skill never picked gains nothing, so the merge is not a blanket grant.
    expect(hasExpertiseInSkill(leveled, 'deception')).toBe(false);
    expect(calculateExpertiseBonus({
      hasProficiency: true,
      hasExpertise: hasExpertiseInSkill(leveled, 'deception'),
      proficiencyBonus,
    })).toBe(0);
  });

  it('merges this level over the picks an earlier level already recorded', () => {
    const bard = createLevelReadyBard({
      featChoices: {
        skill_expert: { selectedExpertiseSkills: ['stealth'] },
        expertise: { selectedExpertiseSkills: ['athletics'] },
      },
    });

    const leveled = performLevelUp(bard, {
      classId: 'bard',
      featChoices: {
        expertise: { selectedExpertiseSkills: ['persuasion'] },
      },
    });

    // Untouched key survives; the re-picked key takes this level's value.
    expect(leveled.featChoices?.skill_expert).toEqual({ selectedExpertiseSkills: ['stealth'] });
    expect(leveled.featChoices?.expertise).toEqual({ selectedExpertiseSkills: ['persuasion'] });
    expect(hasExpertiseInSkill(leveled, 'stealth')).toBe(true);
    expect(hasExpertiseInSkill(leveled, 'athletics')).toBe(false);
  });

  it('still records the chosen feat own entry alongside the class-feature entry', () => {
    const bard = createLevelReadyBard();

    const leveled = performLevelUp(bard, {
      classId: 'bard',
      featId: 'skill_expert',
      featChoices: {
        skill_expert: { selectedAbilityScore: 'Charisma', selectedExpertiseSkills: ['deception'] },
        expertise: { selectedExpertiseSkills: ['persuasion'] },
      },
    });

    expect(leveled.feats).toContain('skill_expert');
    expect(leveled.featChoices?.skill_expert).toEqual({
      selectedAbilityScore: 'Charisma',
      selectedExpertiseSkills: ['deception'],
    });
    expect(leveled.featChoices?.expertise).toEqual({ selectedExpertiseSkills: ['persuasion'] });
  });

  it('leaves featChoices alone when the level-up carried no choices', () => {
    const bard = createLevelReadyBard({
      featChoices: { expertise: { selectedExpertiseSkills: ['persuasion'] } },
    });

    const leveled = performLevelUp(bard, { classId: 'bard' });

    expect(leveled.level).toBe(2);
    expect(leveled.featChoices).toEqual({ expertise: { selectedExpertiseSkills: ['persuasion'] } });
  });
});
