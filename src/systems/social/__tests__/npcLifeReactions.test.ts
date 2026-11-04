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
  eventHelpQuestId, HARDSHIP_GIFT_GOLD, HARDSHIP_GIFT_WEALTH, hardshipQuestId, HELP_DISASTER_DAYS, HELP_TERMS, helpQuestGold, helpQuestKind, helpReceipt,
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

/**
 * 2026-11-04 (GG-596 follow-up 1): fire, plague and grief become help requests
 * through the same quest offer and the same HELP_TOWNSFOLK transaction.
 */
describe('fire, plague and grief help requests', () => {
  /** Append one chronicle event and return its id. */
  function addEvent(p: ReturnType<typeof make>, event: { day: number; kind: 'disaster' | 'death'; subjectId: number; summary: string }) {
    const chronicle = p.state.townSim[BURG].chronicle;
    const id = chronicle.nextEventId;
    chronicle.events.push({ id, relatedIds: [], ...event });
    chronicle.nextEventId = id + 1;
    return id;
  }

  /** A town fire `ago` days back that left the resident's home damaged. */
  function burnHome(p: ReturnType<typeof make>, ago: number) {
    const id = addEvent(p, { day: p.day - ago, kind: 'disaster', subjectId: 0, summary: 'A fire swept through the town.' });
    p.state.townSim[BURG].buildingEvents = { 93: [{ day: p.day - ago, kind: 'fire-damage',
      payload: { incidentId: `burg:${BURG}:day:${p.day - ago}:fire`, severity: 2 } }] } as never;
    return id;
  }

  /** Pay an offered request in full through the real reducers. */
  function acceptAndPay(state: GameState, quest: NonNullable<ReturnType<typeof resolveResidentTrouble>>['quest']) {
    let next = appReducer(state, { type: 'OFFER_QUEST', payload: quest });
    next = appReducer(next, { type: 'ACCEPT_QUEST', payload: quest });
    const help = processTopicSelection('household_help', next, { npcId: NPC_ID, discussedTopicIds: [], contactStatus: 'returning' }, 0).helpTownsfolk;
    expect(help).toEqual({ npcId: NPC_ID, questId: quest.id });
    return appReducer(next, { type: 'HELP_TOWNSFOLK', payload: help! });
  }

  it('asks for help to repair a home the fire damaged, and pays the fire terms', () => {
    const p = make();
    p.state.gold = 40;
    const fireId = burnHome(p, 20);
    const trouble = resolveResidentTrouble(p.state, NPC_ID)!;
    expect(trouble.kind).toBe('fire');
    expect(trouble.quest.id).toBe(eventHelpQuestId('fire', NPC_ID, fireId));
    expect(trouble.text).toContain(`${HELP_TERMS.fire.gold} gold`);
    const result = processTopicSelection('household_trouble', p.state, p.session, 0, p.npc);
    expect(result.offerQuest?.id).toBe(trouble.quest.id);

    const paid = acceptAndPay(p.state, trouble.quest);
    expect(paid.gold).toBe(40 - HELP_TERMS.fire.gold);
    expect(paid.townSim[BURG].villagers[1].wealth).toBe(50 + HELP_TERMS.fire.wealth);
    expect(helpReceipt(paid.townSim[BURG], trouble.quest.id)?.summary).toContain('after the fire');
    expect(paid.questLog.find((q) => q.id === trouble.quest.id)?.status).toBe(QuestStatus.Completed);
    // The fire is resolved for this resident; nothing else troubles them.
    expect(resolveResidentTrouble(paid, NPC_ID)).toBeUndefined();
  });

  it('does not ask about a fire when the home was not damaged or the fire is old', () => {
    const p = make();
    addEvent(p, { day: p.day - 10, kind: 'disaster', subjectId: 0, summary: 'A fire swept through the town.' });
    expect(resolveResidentTrouble(p.state, NPC_ID)).toBeUndefined();
    const old = make();
    burnHome(old, HELP_DISASTER_DAYS + 1);
    expect(resolveResidentTrouble(old.state, NPC_ID)).toBeUndefined();
  });

  it('asks for a healer during a plague when a spouse or child lives', () => {
    const p = make();
    const plagueId = addEvent(p, { day: p.day - 5, kind: 'disaster', subjectId: 0, summary: 'A plague struck the town.' });
    const trouble = resolveResidentTrouble(p.state, NPC_ID)!;
    expect(trouble).toMatchObject({ kind: 'plague', quest: { id: eventHelpQuestId('plague', NPC_ID, plagueId) } });
    expect(helpQuestGold(trouble.quest)).toBe(HELP_TERMS.plague.gold);
    const paid = acceptAndPay(p.state, trouble.quest);
    expect(paid.gold).toBe(20 - HELP_TERMS.plague.gold);
    expect(helpReceipt(paid.townSim[BURG], trouble.quest.id)?.summary).toContain('healer');
  });

  it('does not ask a rich resident to pay for a healer or a burial', () => {
    const p = make({ wealth: 150 });
    addEvent(p, { day: p.day - 5, kind: 'disaster', subjectId: 0, summary: 'A plague struck the town.' });
    widow(p, 3);
    expect(resolveResidentTrouble(p.state, NPC_ID)).toBeUndefined();
  });

  it('asks for a burial after a close kin death, keyed by that death', () => {
    const p = make();
    widow(p, 12);
    const trouble = resolveResidentTrouble(p.state, NPC_ID)!;
    expect(trouble).toMatchObject({ kind: 'grief', quest: { id: eventHelpQuestId('grief', NPC_ID, 1) } });
    expect(trouble.text).toContain('My spouse Ysolde Ironwell died 12 days ago.');
    expect(trouble.text).toContain(`${HELP_TERMS.grief.gold} gold`);
    // Grief ends with the mourning window.
    const later = make();
    widow(later, 61);
    expect(resolveResidentTrouble(later.state, NPC_ID)).toBeUndefined();
  });

  it('names troubles in order, and the next one after the first is paid', () => {
    const p = make({ wealth: 10 });
    p.state.gold = 100;
    burnHome(p, 4);
    // The spouse died in the same fire.
    p.state.townSim[BURG].villagers[2].diedDay = p.day - 4;
    addEvent(p, { day: p.day - 4, kind: 'death', subjectId: 2, summary: 'Ysolde Ironwell died in the fire.' });
    const first = resolveResidentTrouble(p.state, NPC_ID)!;
    expect(first.kind).toBe('fire');
    const afterFire = acceptAndPay(p.state, first.quest);
    const second = resolveResidentTrouble(afterFire, NPC_ID)!;
    expect(second.kind).toBe('grief');
    const afterGrief = acceptAndPay(afterFire, second.quest);
    // Fire wealth (+40) lifted the resident above the poor line, so no hardship.
    expect(resolveResidentTrouble(afterGrief, NPC_ID)).toBeUndefined();
    expect(afterGrief.gold).toBe(100 - HELP_TERMS.fire.gold - HELP_TERMS.grief.gold);
  });

  it('keeps the hardship request id and terms for older saves', () => {
    const p = make({ wealth: 10 });
    const trouble = resolveResidentTrouble(p.state, NPC_ID)!;
    expect(trouble.kind).toBe('hardship');
    expect(trouble.quest.id).toBe(hardshipQuestId(NPC_ID, p.day));
    expect(helpQuestKind(trouble.quest.id)).toBe('hardship');
    expect(HELP_TERMS.hardship).toEqual({ gold: HARDSHIP_GIFT_GOLD, wealth: HARDSHIP_GIFT_WEALTH });
    expect(helpQuestKind('some_other_quest')).toBeUndefined();
  });
});
