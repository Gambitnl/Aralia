/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/dialogueBridge.ts
 * Runs a Skill Challenge as a multi-round social encounter inside dialogue.
 *
 * This file resolves marker #912: "Integrate Skill Challenges into the Dialogue
 * System for social boss fights."
 *
 * The gap it closes. Dialogue already has a social skill check
 * (`SocialSkillCheck` on `ConversationTopic`), but it is a single roll with a
 * pass/fail outcome. A social boss fight is exactly the thing that single roll
 * cannot express: several exchanges, an accumulating success count, a failure
 * budget, and a conversation that ends when either total is reached. The Skill
 * Challenge record already models all of that and was an orphan with no caller.
 *
 * What this file does. It builds a `SkillChallenge` from the conversation topics
 * an NPC offers, runs one topic selection as one challenge attempt, and returns
 * the outcome in the `ProcessTopicResult` shape the dialogue outcome handler
 * already consumes. Nothing new has to be taught to the reducer: a challenge
 * round reports `success` / `failure` / `neutral`, an unlock list, a disposition
 * change, and XP, exactly like an ordinary topic.
 *
 * What it deliberately does not do. It does not store the live challenge. The
 * dialogue session type has no field for one, and adding it belongs to the
 * dialogue package rather than to the puzzle package; that call site is tracked
 * as GG-216. Callers own the challenge object between rounds - which is safe,
 * because `attemptSkillChallenge` already mutates and returns the same record.
 *
 * Called by: the dialogue topic path once the session field exists.
 * Depends on: skillChallengeSystem for the rule, types/dialogue and
 * services/dialogueService for the shapes the dialogue layer already speaks.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 09/09/2026, 15:02:05
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PlayerCharacter } from '../../types/character';
import type { ConversationTopic } from '../../types/dialogue';
import type { ProcessTopicResult } from '../../services/dialogueService';
import { attemptSkillChallenge, createSkillChallenge } from './skillChallengeSystem';
import type { ChallengeSkill, SkillChallenge, SkillChallengeResult } from './types';

// ============================================================================
// Building A Social Challenge From Dialogue Content
// ============================================================================
// A social boss fight is authored as ordinary topics: each topic that carries a
// skill check becomes one approach the player may take. Reusing the authored
// topics means no second content format has to exist for social encounters, and
// an NPC's existing topic list can be promoted to a challenge without rewriting
// it.
// ============================================================================

export interface SocialChallengeDefinition {
  id: string;
  name: string;
  description: string;
  /** Topics that may be used as approaches. Only ones with a skillCheck count. */
  topics: ConversationTopic[];
  requiredSuccesses: number;
  maxFailures: number;
  baseDC: number;
  onSuccessMessage: string;
  onFailureMessage: string;
}

/**
 * Maps one topic onto a challenge approach.
 *
 * The topic's own DC is preserved as an offset from the challenge base DC, so a
 * hard-to-land intimidation stays hard relative to the encounter rather than
 * being flattened to the base number. `maxUses: 1` mirrors the dialogue rule
 * that a discussed topic does not come back around in the same conversation.
 */
function topicToChallengeSkill(
  topic: ConversationTopic,
  baseDC: number,
): Omit<ChallengeSkill, 'uses'> | null {
  if (!topic.skillCheck) return null;

  return {
    skillName: topic.skillCheck.skill.name,
    description: topic.label,
    dcModifier: topic.skillCheck.dc - baseDC,
    maxUses: topic.isOneTime === false ? undefined : 1,
  };
}

export function createSocialChallenge(definition: SocialChallengeDefinition): SkillChallenge {
  const approaches = definition.topics
    .map(topic => topicToChallengeSkill(topic, definition.baseDC))
    .filter((skill): skill is Omit<ChallengeSkill, 'uses'> => skill !== null);

  return createSkillChallenge(
    definition.id,
    definition.name,
    definition.description,
    definition.requiredSuccesses,
    definition.maxFailures,
    definition.baseDC,
    approaches,
    definition.onSuccessMessage,
    definition.onFailureMessage,
  );
}

// ============================================================================
// Running One Round
// ============================================================================
// One topic selection is one challenge attempt. The result is translated into
// the dialogue outcome shape so the existing outcome handler can dispatch XP,
// disposition, and unlocks without learning what a skill challenge is.
// ============================================================================

export interface SocialChallengeRoundInput {
  challenge: SkillChallenge;
  character: PlayerCharacter;
  topic: ConversationTopic;
  /**
   * Disposition swing applied per round. Positive on a landed approach and
   * negated on a missed one, so a social fight moves the NPC either way.
   */
  dispositionPerRound?: number;
}

export interface SocialChallengeRound {
  /** Dialogue-shaped outcome, ready for the existing topic outcome handler. */
  outcome: ProcessTopicResult;
  /** Raw challenge result, for callers that want the running totals. */
  challengeResult: SkillChallengeResult;
  /** True when this round ended the encounter either way. */
  isResolved: boolean;
}

const DEFAULT_DISPOSITION_PER_ROUND = 5;

export function attemptSocialChallengeRound(
  input: SocialChallengeRoundInput,
): SocialChallengeRound {
  const skillName = input.topic.skillCheck?.skill.name ?? '';
  const challengeResult = attemptSkillChallenge(
    input.challenge,
    input.character,
    skillName,
  );

  const isResolved = challengeResult.challengeStatus !== 'active';
  const swing = input.dispositionPerRound ?? DEFAULT_DISPOSITION_PER_ROUND;

  // Unlocks only fire on the round that lands. A social boss fight that ends in
  // failure grants nothing, which is what the challenge's own failure branch
  // already says.
  const unlocks = challengeResult.success
    ? input.topic.skillCheck?.successUnlocks ?? []
    : [];

  // XP is paid once, at the end, and only for winning the encounter. Paying per
  // round would let a player farm a boss fight they are losing.
  const xpReward = challengeResult.challengeStatus === 'success'
    ? input.challenge.onSuccess.rewards?.xp
    : undefined;

  const outcome: ProcessTopicResult = {
    status: challengeResult.success ? 'success' : 'failure',
    responsePrompt: challengeResult.message,
    unlocks,
    dispositionChange: challengeResult.success ? swing : -swing,
    xpReward,
    // A failed encounter closes the approach for good; a failed single round
    // does not, because the player still has failures left to spend.
    lockTopic: challengeResult.challengeStatus === 'failure'
      ? true
      : input.topic.skillCheck?.failureConsequence?.lockTopic,
  };

  return { outcome, challengeResult, isResolved };
}
