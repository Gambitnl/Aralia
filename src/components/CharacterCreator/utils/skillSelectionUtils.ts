// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 05/02/2026, 21:42:05
 * Dependents: SkillSelection.tsx
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { RacialSelectionData, Skill } from '../../../types';
import { BUGBEAR_AUTO_SKILL_ID, KEEN_SENSES_OPTION_SKILL_IDS } from '../config/skillSelectionConfig';

export type SkillId = string;

export type SkillGrantInfo =
  | { granted: true; source: string }
  | { granted: false; source: '' };

export type SkillGrantsById = Record<SkillId, SkillGrantInfo>;

export function getKeenSensesOptions(skillsById: Record<string, Skill | undefined>): Skill[] {
  return KEEN_SENSES_OPTION_SKILL_IDS.map((id) => skillsById[id]).filter((s): s is Skill => !!s);
}

export function deriveRacialSkillGrants(params: {
  raceId: string;
  racialSelections: Record<string, RacialSelectionData>;
  selectedKeenSensesSkillId: string | null;
}): SkillGrantsById {
  const { raceId, racialSelections, selectedKeenSensesSkillId } = params;

  const grants: SkillGrantsById = {};

  const humanSkillId = racialSelections['human']?.skillIds?.[0];
  if (humanSkillId) {
    grants[humanSkillId] = { granted: true, source: "Human 'Skillful' trait" };
  }

  if (raceId === 'elf' && selectedKeenSensesSkillId) {
    grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };
  }

  if (raceId === 'bugbear') {
    grants[BUGBEAR_AUTO_SKILL_ID] = { granted: true, source: "Bugbear 'Sneaky' trait" };
  }

  const centaurSkillId = racialSelections['centaur']?.skillIds?.[0];
  if (centaurSkillId) {
    grants[centaurSkillId] = { granted: true, source: "Centaur 'Natural Affinity' trait" };
  }

  const changelingSkillIds = racialSelections['changeling']?.skillIds;
  if (changelingSkillIds) {
    for (const skillId of changelingSkillIds) {
      grants[skillId] = { granted: true, source: "Changeling 'Instincts' trait" };
    }
  }

  return grants;
}

export function isSkillSelectionValid(params: {
  selectedClassSkillIds: Set<string>;
  requiredClassSkillCount: number;
  raceId: string;
  selectedKeenSensesSkillId: string | null;
}): boolean {
  const { selectedClassSkillIds, requiredClassSkillCount, raceId, selectedKeenSensesSkillId } = params;
  if (selectedClassSkillIds.size !== requiredClassSkillCount) return false;
  if (raceId === 'elf' && !selectedKeenSensesSkillId) return false;
  return true;
}

function pushUniqueSkill(
  skillsById: Record<string, Skill | undefined>,
  into: Skill[],
  skillId: string | undefined | null,
): void {
  if (!skillId) return;
  const skill = skillsById[skillId];
  if (!skill) return;
  if (into.some((s) => s.id === skill.id)) return;
  into.push(skill);
}

export function buildSkillsForSubmit(params: {
  skillsById: Record<string, Skill | undefined>;
  selectedClassSkillIds: Set<string>;
  raceId: string;
  racialSelections: Record<string, RacialSelectionData>;
  selectedKeenSensesSkillId: string | null;
}): Skill[] {
  const { skillsById, selectedClassSkillIds, raceId, racialSelections, selectedKeenSensesSkillId } = params;

  const allSelectedSkills: Skill[] = Array.from(selectedClassSkillIds)
    .map((id) => skillsById[id])
    .filter((s): s is Skill => !!s);

  pushUniqueSkill(skillsById, allSelectedSkills, racialSelections['human']?.skillIds?.[0]);

  if (raceId === 'elf') {
    pushUniqueSkill(skillsById, allSelectedSkills, selectedKeenSensesSkillId);
  }

  if (raceId === 'bugbear') {
    pushUniqueSkill(skillsById, allSelectedSkills, BUGBEAR_AUTO_SKILL_ID);
  }

  pushUniqueSkill(skillsById, allSelectedSkills, racialSelections['centaur']?.skillIds?.[0]);

  const changelingSkillIds = racialSelections['changeling']?.skillIds ?? [];
  for (const skillId of changelingSkillIds) {
    pushUniqueSkill(skillsById, allSelectedSkills, skillId);
  }

  return allSelectedSkills;
}

