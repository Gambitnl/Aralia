/**
 * NPC lives, part 3 (2026-11-02): a town resident reacts to the player from
 * its disposition, the talk it heard, the player's crimes and its own sim life,
 * and asks for help with a real trouble through the existing quest system.
 */
import { describe, it, expect } from 'vitest';
import { createMockGameState } from '../../../utils/core/factories';
import { createEmptyMemory } from '../../../utils/world/memoryUtils';
import { getGameDay } from '../../../utils/core';
import { appReducer } from '../../../state/appState';
import { getAvailableTopics, processTopicSelection } from '../../../services/dialogueService';
import { QuestStatus } from '../../../types/quests';
import type { GameState, RichNPC } from '../../../types';
import { RUMOR_DIALOGUE_DELAY_DAYS, type TownRumor } from '../../intrigue/RumorMillSystem';
import {
  HARDSHIP_GIFT_GOLD, HARDSHIP_GIFT_WEALTH, hardshipQuestId, helpReceipt,
  npcGreetingPromptLine, npcGreetingStance, resolveNpcRecentLifeReply, resolveResidentTrouble,
} from '../npcLifeReactions';

const NPC_ID = 'sten';
const BURG = 675;

function make(opts: { wealth?: number; disposition?: number } = {}) {
  const npc = { id: NPC_ID, name: 'Sten Ironwell', role: 'civilian', occupation: 'innkeeper',
    worldforgeHousehold: { memberId: 'b93:head', burgId: BURG, signature: 'source' } } as unknown as RichNPC;
  const base = createMockGameState({
    generatedNpcs: { [NPC_ID]: npc },
    npcMemory: { [NPC_ID]: { ...createEmptyMemory(), disposition: opts.disposition ?? 0 } },
  });
  const day = getGameDay(base.gameTime);
  const person = (id: number, name: string) => ({ occupantId: id, name, race: 'Human', bornDay: day - 40 * 365,
    parentIds: [] as number[], childIds: [] as number[], homePlotId: 93, wealth: 50 });
  const self = { ...person(1, npc.name), spouseId: 2, wealth: opts.wealth ?? 50 };
  const spouse = { ...person(2, 'Ysolde Ironwell'), spouseId: 1 };
  const state: GameState = {
    ...base,
    gold: 20,
    townSim: { [BURG]: { burgId: BURG, villagers: { 1: self, 2: spouse },
      chronicle: { burgId: BURG, events: [], nextEventId: 1 }, lastSimDay: day, nextVillagerId: 3 } },
  } as GameState;
  const session = { npcId: NPC_ID, discussedTopicIds: [] as string[], contactStatus: 'returning' as const };
  return { npc, state, session, day };
}

/** Kill the spouse `ago` days before today and record the death in the chronicle. */
function widow(p: ReturnType<typeof make>, ago: number) {
  const town = p.state.townSim[BURG];
  town.villagers[2].diedDay = p.day - ago;
  town.chronicle.events.push({ id: 1, day: p.day - ago, kind: 'death', subjectId: 2, relatedIds: [], summary: 'Ysolde Ironwell died.' });
  town.chronicle.nextEventId = 2;
}

/** Talk that spread one dialogue delay ago, so this NPC can now repeat it. */
function rumor(tone: TownRumor['tone'], day: number, subject: string): TownRumor {
  const spreadDay = day - RUMOR_DIALOGUE_DELAY_DAYS;
  return { id: `r-${tone}`, text: 'talk', sourceNpc: 'other', spreadDay, reachedNpcs: ['other', NPC_ID],
    tone, kind: 'custom', virality: 0.5, weight: 0.5, lastSpreadDay: spreadDay, subject };
}

describe('greeting stance', () => {
  it('is neutral for a stranger with no history', () => {
    const p = make();
    expect(npcGreetingStance(p.state, NPC_ID)).toMatchObject({ stance: 'neutral', refuses: false, mood: 'content' });
  });

  it('follows the stored disposition', () => {
    expect(npcGreetingStance(make({ disposition: 50 }).state, NPC_ID).stance).toBe('warm');
    expect(npcGreetingStance(make({ disposition: -30 }).state, NPC_ID).stance).toBe('wary');
    expect(npcGreetingStance(make({ disposition: -80 }).state, NPC_ID)).toMatchObject({ stance: 'shuns', refuses: true });
  });

  it('reacts to good and bad talk this NPC heard about the player', () => {
    const p = make();
    const name = p.state.party[0]?.name?.trim() || 'the stranger';
    const good = { ...p.state, townRumors: [rumor('positive', p.day, name), { ...rumor('positive', p.day, name), id: 'r2' }] };
    expect(npcGreetingStance(good, NPC_ID).stance).toBe('friendly');
    const bad = { ...p.state, townRumors: [rumor('negative', p.day, name), { ...rumor('negative', p.day, name), id: 'r2' }] };
    expect(npcGreetingStance(bad, NPC_ID).stance).toBe('wary');
    const aboutSomeoneElse = { ...p.state, townRumors: [rumor('negative', p.day, 'Another Person')] };
    expect(npcGreetingStance(aboutSomeoneElse, NPC_ID).stance).toBe('neutral');
  });

  it('turns cold toward a player wanted for a crime in this town', () => {
    const p = make();
    const wanted = { ...p.state, currentLocationId: 'coord_1_1',
      notoriety: { ...p.state.notoriety, knownCrimes: [{ witnessed: true, locationId: 'coord_1_1' }] } } as unknown as GameState;
    const reaction = npcGreetingStance(wanted, NPC_ID);
    expect(reaction.stance).toBe('cold');
    expect(reaction.reasons.join(' ')).toContain('wanted');
  });

  it('puts the resident\'s own grief into the greeting prompt', () => {
    const p = make();
    widow(p, 10);
    const line = npcGreetingPromptLine(p.state, NPC_ID);
    expect(line).toContain('You are grieving.');
    expect(line).toContain('Ysolde Ironwell');
  });
});

describe('"How have you been?"', () => {
  it('tells the resident\'s own recent life from the sim', () => {
    const p = make();
    widow(p, 10);
    const reply = resolveNpcRecentLifeReply(p.state, NPC_ID);
    expect(reply).toContain('I am in mourning.');
    expect(reply).toContain('10 days ago: Ysolde Ironwell died.');
    expect(getAvailableTopics(p.state, NPC_ID, p.session, p.npc).some((t) => t.id === 'household_news')).toBe(true);
  });

  it('says little when nothing happened, and is absent for an untracked NPC', () => {
    const p = make();
    expect(resolveNpcRecentLifeReply(p.state, NPC_ID)).toBe('Well enough. Nothing much has changed for me this year.');
    const untracked = { ...p.state, townSim: {} };
    expect(resolveNpcRecentLifeReply(untracked, NPC_ID)).toBeUndefined();
  });
});

describe('troubles and help requests', () => {
  it('asks a poor resident\'s help through an OFFER_QUEST work offer', () => {
    const p = make({ wealth: 10 });
    expect(getAvailableTopics(p.state, NPC_ID, p.session, p.npc).some((t) => t.id === 'household_trouble')).toBe(true);
    const result = processTopicSelection('household_trouble', p.state, p.session, 0, p.npc);
    expect(result.directReply?.text).toContain(`${HARDSHIP_GIFT_GOLD} gold`);
    expect(result.offerQuest).toMatchObject({ id: hardshipQuestId(NPC_ID, p.day), giverId: NPC_ID, status: QuestStatus.Available });
  });

  it('has no trouble to share when the resident is not poor, or dislikes the player', () => {
    expect(resolveResidentTrouble(make({ wealth: 50 }).state, NPC_ID)).toBeUndefined();
    const cold = make({ wealth: 10, disposition: -50 });
    expect(getAvailableTopics(cold.state, NPC_ID, cold.session, cold.npc).some((t) => t.id === 'household_trouble')).toBe(false);
  });

  it('pays an accepted request in one action: gold, sim wealth, receipt and quest', () => {
    const p = make({ wealth: 10 });
    const quest = resolveResidentTrouble(p.state, NPC_ID)!.quest;
    let state = appReducer(p.state, { type: 'OFFER_QUEST', payload: quest });
    state = appReducer(state, { type: 'ACCEPT_QUEST', payload: quest });
    expect(state.questLog.find((q) => q.id === quest.id)?.status).toBe(QuestStatus.Active);
    // An accepted request is not offered again.
    expect(resolveResidentTrouble(state, NPC_ID)).toBeUndefined();

    const help = processTopicSelection('household_help', state, { ...p.session }, 0, p.npc).helpTownsfolk;
    expect(help).toEqual({ npcId: NPC_ID, questId: quest.id });
    const paid = appReducer(state, { type: 'HELP_TOWNSFOLK', payload: help! });

    expect(paid.gold).toBe(20 - HARDSHIP_GIFT_GOLD);
    expect(paid.townSim[BURG].villagers[1].wealth).toBe(10 + HARDSHIP_GIFT_WEALTH);
    expect(helpReceipt(paid.townSim[BURG], quest.id)).toMatchObject({ kind: 'player_intervention', subjectId: 1 });
    expect(paid.questLog.find((q) => q.id === quest.id)?.status).toBe(QuestStatus.Completed);

    // A replayed action changes nothing.
    const replay = appReducer(paid, { type: 'HELP_TOWNSFOLK', payload: help! });
    expect(replay.gold).toBe(paid.gold);
    expect(replay.townSim[BURG].chronicle.events.length).toBe(paid.townSim[BURG].chronicle.events.length);
  });

  it('fails closed without enough gold and completes nothing', () => {
    const p = make({ wealth: 10 });
    const quest = resolveResidentTrouble(p.state, NPC_ID)!.quest;
    let state = appReducer(p.state, { type: 'OFFER_QUEST', payload: quest });
    state = appReducer({ ...state, gold: 3 }, { type: 'ACCEPT_QUEST', payload: quest });
    expect(getAvailableTopics(state, NPC_ID, p.session, p.npc).some((t) => t.id === 'household_help')).toBe(false);
    const after = appReducer(state, { type: 'HELP_TOWNSFOLK', payload: { npcId: NPC_ID, questId: quest.id } });
    expect(after.gold).toBe(3);
    expect(after.townSim[BURG].villagers[1].wealth).toBe(10);
    expect(after.questLog.find((q) => q.id === quest.id)?.status).toBe(QuestStatus.Active);
  });
});
