import { describe, expect, it } from 'vitest';
import type { RacialSelectionData, Skill } from '../../../../types';
import {
  buildSkillsForSubmit,
  deriveRacialSkillGrants,
  isSkillSelectionValid,
} from '../skillSelectionUtils';

const SKILLS: Record<string, Skill> = {
  athletics: { id: 'athletics', name: 'Athletics', ability: 'Strength' },
  stealth: { id: 'stealth', name: 'Stealth', ability: 'Dexterity' },
  insight: { id: 'insight', name: 'Insight', ability: 'Wisdom' },
  perception: { id: 'perception', name: 'Perception', ability: 'Wisdom' },
  survival: { id: 'survival', name: 'Survival', ability: 'Wisdom' },
  deception: { id: 'deception', name: 'Deception', ability: 'Charisma' },
};

describe('skillSelectionUtils', () => {
  it('isSkillSelectionValid enforces class count and elf keen senses', () => {
    expect(
      isSkillSelectionValid({
        selectedClassSkillIds: new Set(['athletics']),
        requiredClassSkillCount: 2,
        raceId: 'human',
        selectedKeenSensesSkillId: null,
      }),
    ).toBe(false);

    expect(
      isSkillSelectionValid({
        selectedClassSkillIds: new Set(['athletics', 'stealth']),
        requiredClassSkillCount: 2,
        raceId: 'elf',
        selectedKeenSensesSkillId: null,
      }),
    ).toBe(false);

    expect(
      isSkillSelectionValid({
        selectedClassSkillIds: new Set(['athletics', 'stealth']),
        requiredClassSkillCount: 2,
        raceId: 'elf',
        selectedKeenSensesSkillId: 'perception',
      }),
    ).toBe(true);
  });

  it('deriveRacialSkillGrants returns expected sources and ids', () => {
    const racialSelections: Record<string, RacialSelectionData> = {
      human: { skillIds: ['athletics'] },
      centaur: { skillIds: ['survival'] },
      changeling: { skillIds: ['deception', 'insight'] },
    };

    const grantsBugbear = deriveRacialSkillGrants({
      raceId: 'bugbear',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });
    expect(grantsBugbear.stealth).toEqual({ granted: true, source: "Bugbear 'Sneaky' trait" });

    const grantsHuman = deriveRacialSkillGrants({
      raceId: 'human',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });
    expect(grantsHuman.athletics).toEqual({ granted: true, source: "Human 'Skillful' trait" });

    const grantsCentaur = deriveRacialSkillGrants({
      raceId: 'centaur',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });
    expect(grantsCentaur.survival).toEqual({ granted: true, source: "Racial trait choice" });

    const grantsChangeling = deriveRacialSkillGrants({
      raceId: 'changeling',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });
    expect(grantsChangeling.deception).toEqual({ granted: true, source: "Racial trait choice" });
    expect(grantsChangeling.insight).toEqual({ granted: true, source: "Racial trait choice" });
  });

  it('buildSkillsForSubmit aggregates uniquely across class and racial sources', () => {
    const racialSelections: Record<string, RacialSelectionData> = {
      human: { skillIds: ['athletics'] },
      centaur: { skillIds: ['survival'] },
      changeling: { skillIds: ['deception', 'insight'] },
    };

    const selectedClassSkillIds = new Set(['athletics', 'stealth']);

    // Test for Bugbear (sneaky trait auto-grants stealth)
    const bugbearSkills = buildSkillsForSubmit({
      skillsById: SKILLS,
      selectedClassSkillIds,
      raceId: 'bugbear',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });
    expect(bugbearSkills.map((s) => s.id).sort()).toEqual(['athletics', 'stealth']);

    // Test for Human (human trait choice grants athletics which duplicates selectedClassSkillIds)
    const humanSkills = buildSkillsForSubmit({
      skillsById: SKILLS,
      selectedClassSkillIds,
      raceId: 'human',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });
    expect(humanSkills.map((s) => s.id).sort()).toEqual(['athletics', 'stealth']);

    // Test for Changeling (grants deception and insight)
    const changelingSkills = buildSkillsForSubmit({
      skillsById: SKILLS,
      selectedClassSkillIds,
      raceId: 'changeling',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });
    expect(changelingSkills.map((s) => s.id).sort()).toEqual(['athletics', 'deception', 'insight', 'stealth']);
  });
});

