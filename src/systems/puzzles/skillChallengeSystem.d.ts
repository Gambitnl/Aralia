/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/skillChallengeSystem.ts
 * Logic for running structured Skill Challenges (4e style).
 */
import { PlayerCharacter } from '../../types/index';
import { SkillChallenge, SkillChallengeResult, ChallengeSkill } from './types';
/**
 * Creates a new skill challenge instance.
 */
export declare function createSkillChallenge(id: string, name: string, description: string, requiredSuccesses: number, maxFailures: number, baseDC: number, availableSkills: Omit<ChallengeSkill, 'uses'>[], onSuccessMessage: string, onFailureMessage: string): SkillChallenge;
/**
 * Attempts a step in the skill challenge.
 * @param challenge The current challenge state (mutated or cloned).
 * @param character The character performing the action.
 * @param skillName The name of the skill/ability being used (e.g., 'Athletics').
 * @returns Result of the attempt.
 */
export declare function attemptSkillChallenge(challenge: SkillChallenge, character: PlayerCharacter, skillName: string): SkillChallengeResult;
