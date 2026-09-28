/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/skillChallengeSystem.ts
 * Logic for running structured Skill Challenges (4e style).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 15:02:05
 * Dependents: systems/puzzles/dialogueBridge.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { PlayerCharacter, AbilityScoreName } from '../../types/index';
import { rollDice } from '../dice/rollers';
import { getAbilityModifierValue } from '../../utils/character';
import { SkillChallenge, SkillChallengeResult, ChallengeSkill } from './types';

// #912 resolved (2026-09-09): social boss fights now have a home. See
// ./dialogueBridge.ts, which builds a challenge from an NPC's authored
// conversation topics and returns each round in the ProcessTopicResult shape the
// dialogue outcome handler already consumes. The remaining step is a field on
// DialogueSession to hold the live challenge between rounds; that belongs to the
// dialogue package and is tracked as GG-216.

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
 * Reports whether a character is proficient in the named challenge skill.
 *
 * Resolves #916. `PlayerCharacter.skills` is the assembled proficiency list
 * (class picks, background, and racial grants), so a challenge skill counts as
 * proficient when it matches an entry by snake_case id or by display name. The
 * matching rules are copied from `rollAbilityCheck` in
 * `utils/character/checkUtils` on purpose: a skill challenge and an ordinary
 * ability check must agree about who is proficient. The class-name heuristics
 * used by the older puzzle files are deliberately NOT reused here because the
 * character sheet already carries the real answer.
 */
function isProficientInChallengeSkill(character: PlayerCharacter, skillName: string): boolean {
  const skillId = skillName.toLowerCase().replace(/\s+/g, '_');
  const lowerName = skillName.toLowerCase();

  return (character.skills ?? []).some(
    skill => skill.id === skillId || skill.name.toLowerCase() === lowerName
  );
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
  const skillDef = challenge.availableSkills.find(s => s.skillName === skillName);

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

  // #916 resolved: a proficient character adds their proficiency bonus, the
  // same way lock, trap, and glyph checks already do. Non-proficient characters
  // keep the previous ability-only total, so existing challenge DCs stay
  // calibrated for untrained approaches.
  const isProficient = isProficientInChallengeSkill(character, skillName);
  const proficiencyBonus = isProficient ? (character.proficiencyBonus ?? 0) : 0;

  const d20 = rollDice('1d20');
  const total = d20 + mod + proficiencyBonus;

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
