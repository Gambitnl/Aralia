/**
 * @file src/services/__tests__/dialogueServiceWitnessRecall.test.ts
 * Proof that the dialogue service now reads NPC witness memory (agora-f58b).
 *
 * `buildWitnessDialogueContext` shipped in
 * `src/systems/social/npcWitnessMemory.ts` with no dialogue-side reader, so an
 * NPC who had watched the player hang a man still greeted them like a stranger.
 * `describeWitnessRecall` is that reader, and
 * `buildNpcDialoguePromptContext` is the single seam the AI dialogue path calls
 * to get both the knowledge profile and the recall in a fixed order.
 */

import { describe, it, expect } from 'vitest';
import {
  MAX_WITNESS_RECALL_LINES,
  buildNpcDialoguePromptContext,
  describeWitnessRecall,
} from '../dialogueService';
import type { GameState, NPC } from '../../types/index';
import { SuspicionLevel } from '../../types/index';
import type { NpcMemory } from '../../types/world';
import { getGameDay, getGameEpoch } from '../../utils/core';
import {
  createWitnessedAct,
  recordWitnessedAct,
  type WitnessedAct,
} from '../../systems/social/npcWitnessMemory';

const GAME_DAY = 11;

function emptyMemory(): NpcMemory {
  return {
    disposition: 0,
    knownFacts: [],
    suspicion: SuspicionLevel.Unaware,
    goals: [],
  };
}

function memoryOf(...acts: WitnessedAct[]): NpcMemory {
  return acts.reduce<NpcMemory>((memory, act) => recordWitnessedAct(memory, act), emptyMemory());
}

describe('describeWitnessRecall (agora-f58b)', () => {
  it('returns an empty fragment for a missing memory, so callers can concatenate blindly', () => {
    expect(describeWitnessRecall(undefined, GAME_DAY)).toBe('');
    expect(describeWitnessRecall(null, GAME_DAY)).toBe('');
  });

  it('returns an empty fragment for an NPC who saw nothing', () => {
    expect(describeWitnessRecall(emptyMemory(), GAME_DAY)).toBe('');
  });

  it('speaks an eyewitness memory in the first person', () => {
    const memory = memoryOf(
      createWitnessedAct('executed_surrendering', 10, { detail: 'a man on his knees' })
    );

    const fragment = describeWitnessRecall(memory, GAME_DAY);

    expect(fragment).toContain('I saw you');
    expect(fragment).toContain('a man on his knees');
  });

  it('keeps hearsay grammatically separate from an eyewitness account', () => {
    const memory = memoryOf(
      createWitnessedAct('defeated_foes', 10, {
        channel: 'secondhand',
        magnitude: 3,
        detail: 'guards',
      })
    );

    const fragment = describeWitnessRecall(memory, GAME_DAY);

    expect(fragment).toContain('I heard you');
    expect(fragment).not.toContain('I saw you');
  });

  it('forbids the model from inventing memories the NPC does not hold', () => {
    const memory = memoryOf(createWitnessedAct('spared_surrendering', 10));

    expect(describeWitnessRecall(memory, GAME_DAY)).toContain(
      'never claim to remember anything else about them'
    );
  });

  it('caps the recall block so it cannot outweigh the personality prompt', () => {
    const memory = memoryOf(
      createWitnessedAct('defeated_foes', 10, { magnitude: 2, detail: 'guards' }),
      createWitnessedAct('spared_surrendering', 10, { detail: 'the beaten captain' }),
      createWitnessedAct('executed_surrendering', 10, { detail: 'a kneeling man' }),
      createWitnessedAct('kept_word', 10, { detail: 'the debt' }),
      createWitnessedAct('broke_word', 10, { detail: 'the oath' })
    );

    const fragment = describeWitnessRecall(memory, GAME_DAY);
    const recallLines = fragment.split(/I (?:saw|heard) you/).length - 1;

    expect(recallLines).toBe(MAX_WITNESS_RECALL_LINES);
  });

  it('forgets an act that has decayed past the belief threshold', () => {
    const memory = memoryOf(createWitnessedAct('defeated_foes', 0, { detail: 'a thug' }));

    // One act, read hundreds of days later: the weight falls under
    // WITNESS_FORGOTTEN_THRESHOLD and the line drops out entirely.
    expect(describeWitnessRecall(memory, 600)).toBe('');
  });
});

describe('buildNpcDialoguePromptContext (agora-f58b)', () => {
  const npc = {
    id: 'npc_1',
    name: 'Bran',
    knowledgeProfile: {
      baseOpenness: 40,
      topicOverrides: {
        global_rumors: { known: true, willingnessModifier: 0 },
      },
    },
  } as unknown as NPC;

  // `getGameDay` counts from the campaign epoch, not from the wall clock, so a
  // `new Date()` here would read as game day ~20000 and decay every act to
  // nothing. Anchor the fixture to the epoch instead.
  const gameTimeAt = (day: number): Date =>
    new Date(getGameEpoch().getTime() + (day - 1) * 24 * 60 * 60 * 1000);

  function stateWith(memory: NpcMemory): GameState {
    return {
      npcMemory: { npc_1: memory },
      gameTime: gameTimeAt(GAME_DAY),
    } as unknown as GameState;
  }

  it('puts the knowledge boundary before the evidence about the player', () => {
    const memory = memoryOf(
      createWitnessedAct('executed_surrendering', 10, { detail: 'a man on his knees' })
    );

    const context = buildNpcDialoguePromptContext(stateWith(memory), 'npc_1', npc);

    const opennessAt = context.indexOf('Your openness to strangers');
    const recallAt = context.indexOf('You personally remember this about them');
    expect(opennessAt).toBeGreaterThanOrEqual(0);
    expect(recallAt).toBeGreaterThan(opennessAt);
  });

  it('emits only the knowledge half when the NPC has witnessed nothing', () => {
    const context = buildNpcDialoguePromptContext(stateWith(emptyMemory()), 'npc_1', npc);

    expect(context).toContain('Your openness to strangers');
    expect(context).not.toContain('You personally remember this about them');
  });

  it('emits only the recall half for an NPC with no knowledge profile', () => {
    const memory = memoryOf(createWitnessedAct('spared_surrendering', 10));

    const context = buildNpcDialoguePromptContext(stateWith(memory), 'npc_1', undefined);

    expect(context).not.toContain('Your openness to strangers');
    expect(context).toContain('You personally remember this about them');
  });

  it('returns an empty string when there is nothing at all to say', () => {
    const context = buildNpcDialoguePromptContext(stateWith(emptyMemory()), 'npc_1', undefined);

    expect(context).toBe('');
  });

  it('says nothing about an NPC with no memory record at all', () => {
    const state = { npcMemory: {}, gameTime: gameTimeAt(GAME_DAY) } as unknown as GameState;

    expect(buildNpcDialoguePromptContext(state, 'npc_unknown', undefined)).toBe('');
  });

  it('reads the game day from gameTime, so recall decays as the campaign runs', () => {
    const memory = memoryOf(createWitnessedAct('defeated_foes', 1, { detail: 'a thug' }));
    const state = {
      npcMemory: { npc_1: memory },
      gameTime: gameTimeAt(600),
    } as unknown as GameState;

    expect(getGameDay(state.gameTime)).toBe(600);
    expect(buildNpcDialoguePromptContext(state, 'npc_1', undefined)).toBe('');
  });
});
