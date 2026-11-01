/** Fixtures for a real inventory handover, promise continuity and the existing
 * quest/recruit boundaries. These do not stand in for the played story chapter. */
import { describe, it, expect } from 'vitest';
import { createMockGameState, createMockPlayerCharacter } from '@/utils/core';
import { COMPANIONS } from '@/data/companions';
import { ITEMS } from '@/constants';
import { QuestStatus } from '@/types/quests';
import type { GameState } from '@/types/state';
import type { Companion, CompanionPreparationChoice } from '@/types/companions';
import { companionReducer } from '../companionReducer';
import { ELARA_PREPARATIONS_QUEST_ID, preparationChoices, preparationMeetingRecall } from '@/systems/companions/companionPreparations';
import { daysOfFood, daysOfWater } from '@/systems/travel/provisioning';
import { evaluateRecruitOffer } from '@/systems/party/recruitConsent';
import { promoteCompanionToMember } from '@/systems/party/npcToPartyMember';

const ELARA = 'elara_vance';
const fresh = (): GameState => createMockGameState({
  worldSeed: 77, currentLocationId: 'cell_3052', currentLocationActiveDynamicNpcIds: [ELARA], metNpcIds: [ELARA],
  companions: { [ELARA]: JSON.parse(JSON.stringify(COMPANIONS[ELARA])) as Companion },
  party: [createMockPlayerCharacter({ id: 'mara', name: 'Mara Tanner' })],
  inventory: [{ ...ITEMS.rations, quantity: 5, sourceId: 'actual-ration-stock' }, { ...ITEMS['water-day'], quantity: 5 }],
  gold: 12, questLog: [], gameTime: new Date('0351-09-14T07:31:00Z'),
  activeConversation: { id: 'meeting', participants: [ELARA], messages: [{ id: 'greeting', speakerId: ELARA, text: 'I am working to restore the temple.', timestamp: 1 }], startedAt: 1, isPlayerTurn: true, pendingResponse: false },
});
const choose = (state: GameState, choice: CompanionPreparationChoice): GameState => ({ ...state, ...companionReducer(state, { type: 'COMPANION_PREPARATION_CHOICE', payload: { companionId: ELARA, choice } }) });
const promised = () => choose(choose(fresh(), 'ask'), 'promise');

describe('companion road preparations', () => {
  it('reveals an authored need without making a promise or locating the temple', () => {
    const before = fresh();
    const next = choose(before, 'ask');
    expect(next.companions[ELARA].questline?.currentStageId).toBe('offered');
    expect(next.companions[ELARA].questline?.origin).toEqual({ worldSeed: 77, locationId: 'cell_3052' });
    expect(next.questLog).toEqual([]);
    expect(next.inventory).toBe(before.inventory);
    expect(next.companions[ELARA].goals).toBe(before.companions[ELARA].goals);
    expect(next.activeConversation?.messages.at(-1)?.text).not.toMatch(/paladin|redeem|east|west|kilometer/i);
    expect(next.companions[ELARA].relationships.player.approval).toBe(0);
  });

  it('respects refusal and remembers it without awarding or removing trust', () => {
    const next = choose(choose(fresh(), 'ask'), 'decline');
    expect(next.questLog).toHaveLength(0);
    expect(next.companions[ELARA].relationships.player.approval).toBe(0);
    expect(next.companions[ELARA].memories.at(-1)?.tags).toContain('declined');
    expect(choose(next, 'decline')).toEqual(next);
  });

  it('records one real promise and one canonical quest at the saved game time', () => {
    const next = promised();
    expect(next.questLog).toHaveLength(1);
    expect(next.questLog[0]).toMatchObject({ id: ELARA_PREPARATIONS_QUEST_ID, status: QuestStatus.Active, giverId: ELARA, dateStarted: next.gameTime.getTime() });
    expect(next.companions[ELARA].memories.at(-1)).toMatchObject({ timestamp: next.gameTime.getTime(), text: expect.stringContaining('Mara Tanner promised') });
    expect(next.journal?.pendingEvents.some(event => event.type === 'quest_accepted')).toBe(true);
    expect(choose(next, 'promise')).toEqual(next);
    expect(preparationMeetingRecall(next.companions[ELARA])).toContain('counting on the road supplies');
  });

  it('hands over both real stacks atomically and completes only the preparation chapter', () => {
    const before = promised();
    const original = JSON.stringify(before);
    const next = choose(before, 'deliver');
    expect(daysOfFood(next.inventory)).toBe(3);
    expect(daysOfWater(next.inventory)).toBe(3);
    expect(daysOfFood(next.companions[ELARA].inventory ?? [])).toBe(2);
    expect(daysOfWater(next.companions[ELARA].inventory ?? [])).toBe(2);
    expect(next.companions[ELARA].inventory?.[0].sourceId).toBe('actual-ration-stock');
    expect(next.questLog[0]).toMatchObject({ status: QuestStatus.Completed, dateCompleted: next.gameTime.getTime() });
    expect(next.journal?.pendingEvents.some(event => event.type === 'quest_completed')).toBe(true);
    expect(next.companions[ELARA].goals).toEqual(before.companions[ELARA].goals);
    expect(next.companions[ELARA].relationships.player.approval).toBe(5);
    expect(next.gold).toBe(12);
    expect(next.party).toEqual(before.party);
    expect(next.companions[ELARA].inParty).not.toBe(true);
    expect(evaluateRecruitOffer({ id: ELARA, name: 'Elara' }, next).willJoin).toBe(false);
    expect(JSON.stringify(before)).toBe(original);
    expect(choose(next, 'deliver')).toEqual(next);
    expect(preparationMeetingRecall(next.companions[ELARA])).toContain('promise you kept');
  });

  it('does not transfer food if water is missing or manufactured by a malformed stack', () => {
    for (const water of [0, Number.NaN, Number.POSITIVE_INFINITY, -2]) {
      const state = promised();
      state.inventory = [{ ...ITEMS.rations, quantity: 5 }, { ...ITEMS['water-day'], quantity: water }];
      expect(choose(state, 'deliver')).toEqual(state);
      expect(preparationChoices(state).find(item => item.choice === 'deliver')?.disabled).toBe(true);
    }
  });

  it('accepts split stacks without replacing their original properties', () => {
    const state = promised();
    state.inventory = [{ ...ITEMS.rations, quantity: 1, sourceId: 'first' }, { ...ITEMS.rations, quantity: 3, sourceId: 'second' }, { ...ITEMS['water-day'], quantity: 2 }];
    const next = choose(state, 'deliver');
    expect(next.companions[ELARA].inventory?.map(item => [item.sourceId, item.quantity])).toEqual([['first', 1], ['second', 1], [undefined, 2]]);
    expect(next.inventory).toEqual([{ ...ITEMS.rations, quantity: 2, sourceId: 'second' }]);
  });

  it.each(['absent', 'not-met', 'other-speaker', 'pending', 'wrong-world', 'other-quest'] as const)('rejects a stale or invalid story choice: %s', condition => {
    const state = promised();
    if (condition === 'absent') state.currentLocationActiveDynamicNpcIds = [];
    if (condition === 'not-met') state.metNpcIds = [];
    if (condition === 'other-speaker') state.activeConversation!.participants = ['kaelen_thorne'];
    if (condition === 'pending') state.activeConversation!.pendingResponse = true;
    if (condition === 'wrong-world') state.worldSeed = 78;
    if (condition === 'other-quest') state.companions[ELARA].questline!.id = 'existing-unfinished-story';
    expect(choose(state, 'deliver')).toEqual(state);
  });

  it('remembers withdrawal and reopens the same quest when a new promise is made', () => {
    const withdrawn = choose(promised(), 'withdraw');
    expect(withdrawn.questLog[0].status).toBe(QuestStatus.Abandoned);
    expect(withdrawn.companions[ELARA].memories.at(-1)?.tags).toContain('promise-withdrawn');
    const renewed = choose(withdrawn, 'promise');
    expect(renewed.questLog).toHaveLength(1);
    expect(renewed.questLog[0].status).toBe(QuestStatus.Active);
    expect(renewed.companions[ELARA].memories.some(memory => memory.tags.includes('promise-withdrawn'))).toBe(true);
    expect(renewed.companions[ELARA].relationships.player.approval).toBe(-3);
  });

  it('retains held supplies, goals, promise and fulfillment through serialized reunion fixtures', () => {
    const delivered = choose(promised(), 'deliver');
    const loaded = JSON.parse(JSON.stringify(delivered)) as GameState;
    loaded.gameTime = new Date(delivered.gameTime);
    const promoted = { ...loaded, ...companionReducer(loaded, { type: 'RECRUIT_COMPANION', payload: promoteCompanionToMember(loaded.companions[ELARA]) }) };
    const dismissed = { ...promoted, ...companionReducer(promoted, { type: 'DISMISS_PARTY_MEMBER', payload: { memberId: ELARA } }) };
    const recalled = choose(dismissed, 'recall');
    expect(recalled.activeConversation?.messages.at(-1)?.text).toContain('promise you kept');
    expect(recalled.companions[ELARA].inventory).toEqual(delivered.companions[ELARA].inventory);
    expect(recalled.companions[ELARA].goals).toEqual(delivered.companions[ELARA].goals);
    expect(recalled.companions[ELARA].memories.filter(memory => memory.tags.includes('promise-fulfilled'))).toHaveLength(1);
  });
});
