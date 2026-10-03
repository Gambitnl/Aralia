/**
 * @file src/state/reducers/__tests__/factReducer.test.ts
 * Cross-NPC unlock propagation + save/reload durability (DIAL-002 + DIAL-004).
 *
 * The scenario under test is the whole point of the system: NPC A tells you a
 * secret (topic outcome unlocks topic X) -> the unlock is stored as a durable
 * WORLD fact -> the prerequisite check for topic X passes when talking to
 * NPC B -> and still passes after a save/reload round trip.
 */
import { describe, it, expect } from 'vitest';
import { factReducer } from '../factReducer';
import { initialGameState } from '../../initialState';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import {
  topicUnlockKey,
  hasWorldFact,
  normalizeWorldFactStore,
} from '../../../systems/facts/worldFactStore';
import { checkTopicPrerequisites } from '../../../services/dialogueService';
import type { ConversationTopic } from '../../../types/dialogue';

const learnAction = (topicId: string, sourceNpcId: string): AppAction => ({
  type: 'LEARN_WORLD_FACT',
  payload: {
    fact: {
      key: topicUnlockKey(topicId),
      sourceNpcId,
      sourceTopicId: 'rumor_ruins',
      learnedAt: 1000,
    },
  },
});

describe('factReducer LEARN_WORLD_FACT', () => {
  it('stores a durable world fact with provenance', () => {
    const changes = factReducer(initialGameState, learnAction('ask_about_ruins', 'npc_a'));
    expect(changes.worldFacts).toBeDefined();
    expect(hasWorldFact(changes.worldFacts, topicUnlockKey('ask_about_ruins'))).toBe(true);
    expect(
      changes.worldFacts!.facts[topicUnlockKey('ask_about_ruins')].sourceNpcId
    ).toBe('npc_a');
  });

  it('heals a legacy state with no store (pre-fact-store saves)', () => {
    const legacy = { ...initialGameState, worldFacts: undefined } as GameState;
    const changes = factReducer(legacy, learnAction('ask_about_ruins', 'npc_a'));
    expect(hasWorldFact(changes.worldFacts, topicUnlockKey('ask_about_ruins'))).toBe(true);
  });

  it('is a no-op when the fact is already known', () => {
    const once = {
      ...initialGameState,
      ...factReducer(initialGameState, learnAction('ask_about_ruins', 'npc_a')),
    } as GameState;
    const changes = factReducer(once, learnAction('ask_about_ruins', 'npc_b'));
    expect(changes).toEqual({});
  });

  it('ignores unrelated actions', () => {
    expect(factReducer(initialGameState, { type: 'END_DIALOGUE_SESSION' })).toEqual({});
  });
});

describe('cross-NPC unlock propagation (DIAL-002)', () => {
  const gatedTopic: ConversationTopic = {
    id: 'ask_about_ruins',
    label: 'Ask about the ruins',
    category: 'lore',
    playerPrompt: 'Tell me about the ruins.',
    prerequisites: [{ type: 'topic_known', targetId: 'ask_about_ruins' }],
  };

  it('a fact learned from NPC A satisfies the topic_known prerequisite with NPC B', () => {
    // Before: the gated topic is not available with anyone.
    expect(checkTopicPrerequisites(gatedTopic, initialGameState, 'npc_b')).toBe(false);

    // NPC A's topic outcome unlocks it (dispatched by useDialogueSystem).
    const state = {
      ...initialGameState,
      ...factReducer(initialGameState, learnAction('ask_about_ruins', 'npc_a')),
    } as GameState;

    // After: prerequisite passes when talking to a DIFFERENT NPC.
    expect(checkTopicPrerequisites(gatedTopic, state, 'npc_b')).toBe(true);
  });

  it('the unlock survives a save/reload round trip (DIAL-004)', () => {
    const state = {
      ...initialGameState,
      ...factReducer(initialGameState, learnAction('ask_about_ruins', 'npc_a')),
    } as GameState;

    // Saves serialize GameState wholesale; simulate the round trip for the slice.
    const reloadedFacts = normalizeWorldFactStore(
      JSON.parse(JSON.stringify(state.worldFacts))
    );
    const reloaded = { ...state, worldFacts: reloadedFacts } as GameState;

    expect(checkTopicPrerequisites(gatedTopic, reloaded, 'npc_c')).toBe(true);
  });

  it('legacy discoveryLog topic_unlocked flags still satisfy the prerequisite', () => {
    // Back-compat: saves from before the fact store recorded unlocks as
    // discovery-log flags; those must keep working.
    const state = {
      ...initialGameState,
      discoveryLog: [
        {
          id: 'd1',
          timestamp: 1,
          gameTime: 'Day 1',
          type: 'Lore Uncovered',
          title: 'Secret',
          content: 'x',
          source: { type: 'NPC' as const },
          flags: [{ key: 'topic_unlocked', value: 'ask_about_ruins' }],
          isRead: false,
        },
      ],
    } as unknown as GameState;

    expect(checkTopicPrerequisites(gatedTopic, state, 'npc_b')).toBe(true);
  });
});
