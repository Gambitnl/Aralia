/** A venue can change its NPC packet without changing the person who spoke.
 * Recall follows proved life provenance; publication and world ownership do not. */
import { describe, expect, it, vi } from 'vitest';
import { createMockGameState } from '../../../utils/core/factories';
import { createEmptyMemory } from '../../../utils/world/memoryUtils';
import { worldReducer } from '../../../state/reducers/worldReducer';
import { getAvailableTopics, processTopicSelection } from '../../../services/dialogueService';
import { npcDialogueSpeakerKey, latestSpokenDialogueReplies, latestSpokenGeneratedReplies,
  latestSpokenPersonalReply, latestSpokenWorkReply } from '../npcDialogueMemory';
import type { GameState, RichNPC } from '../../../types';
import type { Interaction } from '../../../types/memory';
import { handleStartDialogue, handleTalk } from '../../../hooks/actions/handleNpcInteraction';
import type { Action } from '../../../types';

const OLD = 'npc_burg_675_plot_123', CURRENT = 'npc_burg_675_plot_35';
function fixture() {
  const person = { name: 'Fenna Hartham', role: 'merchant', occupation: 'innkeeper',
    worldforgeHousehold: { burgId: 675, memberId: 'b34:head', legacyNameUnique: true }, biography: { family: [] } };
  const npc = { ...person, id: CURRENT } as unknown as RichNPC;
  const state = createMockGameState({ worldSeed: 1793146029630, gameTime: new Date('0351-01-06T11:00:00Z'),
    generatedNpcs: { [OLD]: { ...person, id: OLD } as unknown as RichNPC, [CURRENT]: npc },
    npcMemory: { [OLD]: createEmptyMemory(), [CURRENT]: createEmptyMemory() },
    townSim: { 675: { villagers: { 81: { occupantId: 81, name: person.name, householdMemberId: 'b34:head',
      homePlotId: 34, bornDay: -18613 } } } } as unknown as GameState['townSim'],
    activeDialogueSession: { npcId: CURRENT, discussedTopicIds: [] } });
  const speakerKey = npcDialogueSpeakerKey(state, OLD)!;
  const time = Number(state.gameTime) - 10000;
  const work = { id: 'old-work', date: time, type: 'dialogue', summary: 'I ran The Shadowed Provisions.',
    dialogue: { topicId: 'household_work', speakerKey, source: { kind: 'business-report', businessId: 'old-shop',
      day: 1, revenue: 10, costs: 8, profit: 2 } } } as Interaction;
  const family = { id: 'old-family', date: time + 1, type: 'dialogue', summary: 'Ysolde is my spouse.',
    dialogue: { topicId: 'household_family', speakerKey, source: { kind: 'household-personal', snapshot: 'old-family-source' } } } as Interaction;
  const generated = { id: 'old-generated', date: time + 2, type: 'dialogue', summary: 'I cannot confirm the undercity story.',
    dialogue: { topicId: 'generated_exchange', speakerKey, source: { kind: 'generated-exchange', requestId: 'heard-old', playerPrompt: 'What did you hear?' } } } as Interaction;
  state.npcMemory[OLD].interactions = [work, family, generated];
  return { state, npc, work, family, generated };
}

describe('same-person recall across venue NPC packets', () => {
  it('recalls each kind of delivered word through the admitted current life without copying memory', () => {
    const { state, work, family, generated } = fixture(), before = JSON.stringify(state);
    expect(latestSpokenWorkReply(state, CURRENT)).toBe(work);
    expect(latestSpokenPersonalReply(state, CURRENT, 'household_family')).toBe(family);
    expect(latestSpokenGeneratedReplies(state, CURRENT)).toEqual([generated]);
    expect(latestSpokenDialogueReplies(state, CURRENT)).toEqual([work, family, generated]);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.npcMemory[CURRENT].interactions).toEqual([]);
  });
  it('honors the latest real delivery pointer across aliases rather than an old record creation date', () => {
    const { state, work } = fixture();
    state.npcMemory[OLD].lastSpokenDialogue = { interactionId: work.id, deliveredAt: Number(state.gameTime) - 1 };
    expect(latestSpokenDialogueReplies(state, CURRENT, 1)).toEqual([work]);
  });
  it.each([1, 3, 4, 5, 6])('does not borrow history when provenance field %s differs', field => {
    const { state } = fixture();
    for (const record of state.npcMemory[OLD].interactions!) {
      const key = JSON.parse(record.dialogue!.speakerKey);
      key[field] = typeof key[field] === 'number' ? key[field] + 1 : key[field] + '-other';
      record.dialogue!.speakerKey = JSON.stringify(key);
    }
    expect(latestSpokenDialogueReplies(state, CURRENT)).toEqual([]);
    expect(latestSpokenWorkReply(state, CURRENT)).toBeUndefined();
    expect(latestSpokenPersonalReply(state, CURRENT, 'household_family')).toBeUndefined();
    expect(latestSpokenGeneratedReplies(state, CURRENT)).toEqual([]);
  });
  it.each(['wrong-owner', 'malformed', 'missing-life', 'future'])('keeps %s records out of current recall', kind => {
    const { state } = fixture();
    if (kind === 'missing-life') state.generatedNpcs[CURRENT].name = 'Another Fenna';
    for (const record of state.npcMemory[OLD].interactions!) {
      if (kind === 'malformed') record.dialogue!.speakerKey = '{bad';
      if (kind === 'wrong-owner') { const key = JSON.parse(record.dialogue!.speakerKey); key[2] = 'a-different-owner'; record.dialogue!.speakerKey = JSON.stringify(key); }
      if (kind === 'future') record.date = Number(state.gameTime) + 1;
    }
    expect(latestSpokenDialogueReplies(state, CURRENT)).toEqual([]);
  });
  it('uses the historical stamp even when the old venue packet is no longer registered', () => {
    const { state, generated } = fixture();
    delete state.generatedNpcs[OLD];
    expect(latestSpokenGeneratedReplies(state, CURRENT)).toEqual([generated]);
  });
  it('offers the actual recall topic without inventing a new exchange or current business report', () => {
    const { state, npc } = fixture(), before = JSON.stringify(state);
    expect(getAvailableTopics(state, CURRENT, state.activeDialogueSession!, npc).some(t => t.id === 'conversation_recall')).toBe(true);
    expect(processTopicSelection('conversation_recall', state, { npcId: CURRENT, discussedTopicIds: [] }, 0, npc).directReply?.text)
      .toBe('Last time, I told you: “I cannot confirm the undercity story.”');
    expect(JSON.stringify(state)).toBe(before);
  });
  it('still rejects an old venue request publishing into the new active conversation', () => {
    const { state, generated } = fixture();
    expect(worldReducer(state, { type: 'SET_LAST_NPC_INTERACTION', payload: { npcId: CURRENT,
      response: generated.summary, dialogue: generated.dialogue! } })).toEqual({});
  });
  it.each(['start', 'talk'] as const)('recognizes the prior conversation on the %s entry without a new first-meeting fact', async route => {
    const { state } = fixture(), dispatch = vi.fn();
    const action = { type: 'talk', label: 'Talk', targetId: CURRENT, payload: { npcId: CURRENT } } as Action;
    const args = { action, gameState: state, dispatch, addMessage: vi.fn(), addGeminiLog: vi.fn(), playPcmAudio: vi.fn(async () => undefined),
      playerContext: 'Sana', generalActionContext: 'Town Talk' };
    await (route === 'start' ? handleStartDialogue(args) : handleTalk(args));
    expect(dispatch).toHaveBeenCalledWith({ type: 'START_DIALOGUE_SESSION', payload: { npcId: CURRENT, contactStatus: 'returning' } });
    expect(dispatch.mock.calls.some(([a]) => a.type === 'ADD_NPC_KNOWN_FACT')).toBe(false);
    expect(state.npcMemory[CURRENT].knownFacts).toEqual([]);
    const session = { npcId: CURRENT, discussedTopicIds: [], contactStatus: 'returning' as const };
    expect(processTopicSelection('household_meeting', state, session, 0, state.generatedNpcs[CURRENT]).directReply?.text)
      .toBe("Yes, we've met before.");
  });
});
