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

    const grants = deriveRacialSkillGrants({
      raceId: 'bugbear',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });

    expect(grants.athletics).toEqual({ granted: true, source: "Human 'Skillful' trait" });
    expect(grants.survival).toEqual({ granted: true, source: "Centaur 'Natural Affinity' trait" });
    expect(grants.deception).toEqual({ granted: true, source: "Changeling 'Instincts' trait" });
    expect(grants.insight).toEqual({ granted: true, source: "Changeling 'Instincts' trait" });
    expect(grants.stealth).toEqual({ granted: true, source: "Bugbear 'Sneaky' trait" });
  });

  it('buildSkillsForSubmit aggregates uniquely across class and racial sources', () => {
    const racialSelections: Record<string, RacialSelectionData> = {
      human: { skillIds: ['athletics'] },
      centaur: { skillIds: ['survival'] },
      changeling: { skillIds: ['deception', 'insight'] },
    };

    const selectedClassSkillIds = new Set(['athletics', 'stealth']); // athletics duplicates human

    const skills = buildSkillsForSubmit({
      skillsById: SKILLS,
      selectedClassSkillIds,
      raceId: 'bugbear',
      racialSelections,
      selectedKeenSensesSkillId: null,
    });

    const ids = skills.map((s) => s.id).sort();
    expect(ids).toEqual(['athletics', 'deception', 'insight', 'stealth', 'survival']);
  });
});

