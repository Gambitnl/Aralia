/**
 * This file proves marker #912: a Skill Challenge can run as a multi-round
 * social encounter inside dialogue, and each round comes back in the shape the
 * dialogue outcome handler already consumes.
 *
 * The point of the coverage is the thing a single SocialSkillCheck cannot do:
 * accumulate successes and failures across several topic selections and end the
 * conversation when either budget runs out.
 */

import { describe, expect, it } from 'vitest';
import type { ConversationTopic } from '../../../types/dialogue';
import type { PlayerCharacter } from '../../../types/character';
import { createMockPlayerCharacter } from '../../../utils/core';
import { attemptSocialChallengeRound, createSocialChallenge } from '../dialogueBridge';

function createTopic(
  id: string,
  skillId: string,
  skillName: string,
  ability: 'Charisma' | 'Wisdom' | 'Intelligence',
  dc: number,
): ConversationTopic {
  return {
    id,
    label: `Try ${skillName}`,
    category: 'personal',
    playerPrompt: `You lean on ${skillName}.`,
    skillCheck: {
      skill: { id: skillId, name: skillName, ability },
      dc,
      successUnlocks: [`${id}-followup`],
      xpReward: 25,
    },
  };
}

const PERSUASION = createTopic('sway', 'persuasion', 'Persuasion', 'Charisma', 12);
const INSIGHT = createTopic('read', 'insight', 'Insight', 'Wisdom', 15);

// A topic's own DC is authoritative: the bridge stores it as an offset from the
// encounter base so the effective DC is always the authored number. These two
// sit far outside the roll range on purpose so the round outcomes are certain.
const EASY_PERSUASION = createTopic('sway', 'persuasion', 'Persuasion', 'Charisma', 5);
const EASY_INSIGHT = createTopic('read', 'insight', 'Insight', 'Wisdom', 5);
const HARD_PERSUASION = createTopic('sway', 'persuasion', 'Persuasion', 'Charisma', 40);
const HARD_INSIGHT = createTopic('read', 'insight', 'Insight', 'Wisdom', 40);

/** A character who cannot miss a DC 5 approach, for deterministic outcomes. */
function createOrator(): PlayerCharacter {
  const character = createMockPlayerCharacter();
  character.name = 'Orator';
  character.abilityScores = {
    ...character.abilityScores,
    Charisma: 20,
    Wisdom: 20,
    Intelligence: 20,
  };
  return character;
}

/** A character who cannot beat a DC 40 approach. */
function createOaf(): PlayerCharacter {
  const character = createMockPlayerCharacter();
  character.name = 'Oaf';
  character.abilityScores = {
    ...character.abilityScores,
    Charisma: 1,
    Wisdom: 1,
    Intelligence: 1,
  };
  character.skills = [];
  return character;
}

function createDebate(
  topics: ConversationTopic[],
  requiredSuccesses = 2,
  maxFailures = 2,
  baseDC = 10,
) {
  return createSocialChallenge({
    id: 'court-debate',
    name: 'The Magistrate',
    description: 'Win the room before the magistrate loses patience.',
    topics,
    requiredSuccesses,
    maxFailures,
    baseDC,
    onSuccessMessage: 'The magistrate rules in your favour.',
    onFailureMessage: 'The magistrate has heard enough.',
  });
}

describe('dialogueBridge createSocialChallenge (#912)', () => {
  it('promotes each skill-checked topic into a challenge approach', () => {
    const challenge = createDebate([PERSUASION, INSIGHT], 2, 2, 12);

    expect(challenge.availableSkills.map(s => s.skillName)).toEqual(['Persuasion', 'Insight']);
    // A topic DC above the encounter base stays harder than the base.
    expect(challenge.availableSkills[1].dcModifier).toBe(3);
    expect(challenge.status).toBe('active');
  });

  it('ignores topics that carry no skill check', () => {
    const smallTalk: ConversationTopic = {
      id: 'weather',
      label: 'The weather',
      category: 'personal',
      playerPrompt: 'Fine day.',
    };

    const challenge = createSocialChallenge({
      id: 'c', name: 'n', description: 'd',
      topics: [smallTalk, PERSUASION],
      requiredSuccesses: 1, maxFailures: 1, baseDC: 10,
      onSuccessMessage: 'ok', onFailureMessage: 'no',
    });

    expect(challenge.availableSkills).toHaveLength(1);
  });
});

describe('dialogueBridge attemptSocialChallengeRound (#912)', () => {
  it('accumulates successes across rounds and ends the encounter on a win', () => {
    const challenge = createDebate([EASY_PERSUASION, EASY_INSIGHT], 2, 2);
    const character = createOrator();

    const first = attemptSocialChallengeRound({ challenge, character, topic: EASY_PERSUASION });
    expect(first.challengeResult.success).toBe(true);
    expect(first.isResolved).toBe(false);
    expect(first.outcome.status).toBe('success');
    expect(first.outcome.unlocks).toEqual(['sway-followup']);
    // XP is withheld until the encounter itself is won.
    expect(first.outcome.xpReward).toBeUndefined();

    const second = attemptSocialChallengeRound({ challenge, character, topic: EASY_INSIGHT });
    expect(second.isResolved).toBe(true);
    expect(second.challengeResult.challengeStatus).toBe('success');
    expect(challenge.currentSuccesses).toBe(2);
  });

  it('accumulates failures and locks the approach when the encounter is lost', () => {
    const challenge = createDebate([HARD_PERSUASION, HARD_INSIGHT], 2, 2);
    const character = createOaf();

    const first = attemptSocialChallengeRound({ challenge, character, topic: HARD_PERSUASION });
    expect(first.outcome.status).toBe('failure');
    expect(first.isResolved).toBe(false);
    // A single missed round is survivable, so the topic is not burned yet.
    expect(first.outcome.lockTopic).toBeFalsy();
    expect(first.outcome.dispositionChange).toBeLessThan(0);

    const second = attemptSocialChallengeRound({ challenge, character, topic: HARD_INSIGHT });
    expect(second.isResolved).toBe(true);
    expect(second.challengeResult.challengeStatus).toBe('failure');
    expect(second.outcome.lockTopic).toBe(true);
    expect(second.outcome.responsePrompt).toContain('The magistrate has heard enough.');
  });

  it('spends each approach once, matching the one-shot topic rule', () => {
    const challenge = createDebate([EASY_PERSUASION, EASY_INSIGHT], 5, 5);
    const character = createOrator();

    attemptSocialChallengeRound({ challenge, character, topic: EASY_PERSUASION });
    const repeat = attemptSocialChallengeRound({ challenge, character, topic: EASY_PERSUASION });

    expect(repeat.outcome.status).toBe('failure');
    expect(repeat.outcome.responsePrompt).toContain('exhausted');
    // A refused approach must not spend one of the encounter's failures.
    expect(challenge.currentFailures).toBe(0);
  });

  it('lets the caller tune how far one round swings disposition', () => {
    const challenge = createDebate([EASY_PERSUASION, EASY_INSIGHT], 3, 3);
    const round = attemptSocialChallengeRound({
      challenge,
      character: createOrator(),
      topic: EASY_PERSUASION,
      dispositionPerRound: 12,
    });

    expect(round.outcome.dispositionChange).toBe(12);
  });
});
