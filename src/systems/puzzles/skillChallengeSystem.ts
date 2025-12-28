/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/skillChallengeSystem.ts
 * Logic for running structured Skill Challenges (4e style).
 */

import { PlayerCharacter, AbilityScoreName } from '../../types/index';
import { rollDice } from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { SkillChallenge, SkillChallengeResult, ChallengeSkill } from './types';

// TODO(Lockpick): Integrate Skill Challenges into the Dialogue System for social boss fights.

/**
 * Creates a new skill challenge instance.
 */
export function createSkillChallenge(
  id: string,
  name: string,
  description: string,
  requiredSuccesses: number,
  maxFailures: number,
  baseDC: number,
  availableSkills: Omit<ChallengeSkill, 'uses'>[],
  onSuccessMessage: string,
  onFailureMessage: string
): SkillChallenge {
  return {
    id,
    name,
    description,
    requiredSuccesses,
    maxFailures,
    baseDC,
    availableSkills: availableSkills.map(s => ({ ...s, uses: 0 })),
    allowCreativeSkills: false,
    currentSuccesses: 0,
    currentFailures: 0,
    status: 'active',
    log: [],
    onSuccess: { message: onSuccessMessage },
    onFailure: { message: onFailureMessage }
  };
}

/**
 * Helper to map skill names to Ability Score names.
 * In a full implementation, this would live in a centralized Skill registry.
 */
function getAbilityForSkill(skillName: string): AbilityScoreName {
  const map: Record<string, AbilityScoreName> = {
    'Athletics': 'Strength',
    'Acrobatics': 'Dexterity',
    'Sleight of Hand': 'Dexterity',
    'Stealth': 'Dexterity',
    'Arcana': 'Intelligence',
    'History': 'Intelligence',
    'Investigation': 'Intelligence',
    'Nature': 'Intelligence',
    'Religion': 'Intelligence',
    'Insight': 'Wisdom',
    'Medicine': 'Wisdom',
    'Perception': 'Wisdom',
    'Survival': 'Wisdom',
    'Deception': 'Charisma',
    'Intimidation': 'Charisma',
    'Performance': 'Charisma',
    'Persuasion': 'Charisma'
  };

  // Default fallback if unknown skill
  return map[skillName] || 'Dexterity';
}

/**
 * Attempts a step in the skill challenge.
 * @param challenge The current challenge state (mutated or cloned).
 * @param character The character performing the action.
 * @param skillName The name of the skill/ability being used (e.g., 'Athletics').
 * @returns Result of the attempt.
 */
export function attemptSkillChallenge(
  challenge: SkillChallenge,
  character: PlayerCharacter,
  skillName: string
): SkillChallengeResult {
  // 1. Validation
  if (challenge.status !== 'active') {
    return {
      success: false,
      challengeStatus: challenge.status,
      message: `The challenge is already ${challenge.status}.`,
      challengeState: challenge
    };
  }

  // 2. Determine DC and Validity
  let dc = challenge.baseDC;
  let skillDef = challenge.availableSkills.find(s => s.skillName === skillName);

  if (!skillDef) {
    if (challenge.allowCreativeSkills) {
      dc += 5; // Penalty for off-script solutions
    } else {
      return {
        success: false,
        challengeStatus: 'active',
        message: `That approach doesn't seem applicable here.`,
        challengeState: challenge
      };
    }
  } else {
    // Check usage limits
    if (skillDef.maxUses && skillDef.uses >= skillDef.maxUses) {
      return {
        success: false,
        challengeStatus: 'active',
        message: `You've already exhausted that approach.`,
        challengeState: challenge
      };
    }
    if (skillDef.dcModifier) {
      dc += skillDef.dcModifier;
    }
  }

  // 3. Roll Check
  const abilityName = getAbilityForSkill(skillName);

  // PlayerCharacter uses `abilityScores` (Strength, Dexterity, etc.)
  const score = character.abilityScores[abilityName];
  const mod = getAbilityModifierValue(score);

  // TODO: Add proficiency bonus if character is proficient in the skill.
  // For now, we rely on ability mod.

  const d20 = rollDice('1d20');
  const total = d20 + mod;

  const isSuccess = total >= dc;

  // 4. Update State
  if (skillDef) {
    skillDef.uses++;
  }

  let message = '';
  if (isSuccess) {
    challenge.currentSuccesses++;
    message = `Success! (${total} vs DC ${dc})`;
    challenge.log.push(`Success: ${character.name} used ${skillName} (${total})`);
  } else {
    challenge.currentFailures++;
    message = `Failure. (${total} vs DC ${dc})`;
    challenge.log.push(`Failure: ${character.name} used ${skillName} (${total})`);
  }

  // 5. Check Completion
  let status: 'active' | 'success' | 'failure' = 'active';

  if (challenge.currentFailures >= challenge.maxFailures) {
    status = 'failure';
    message = `${message} - CHALLENGE FAILED: ${challenge.onFailure.message}`;
  } else if (challenge.currentSuccesses >= challenge.requiredSuccesses) {
    status = 'success';
    message = `${message} - CHALLENGE COMPLETE: ${challenge.onSuccess.message}`;
  }

  challenge.status = status;

  return {
    success: isSuccess,
    challengeStatus: status,
    message,
    challengeState: challenge
  };
}
