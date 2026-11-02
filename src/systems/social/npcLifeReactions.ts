/**
 * @file npcLifeReactions.ts — how a town resident reacts to the player, from
 * the resident's real sim life and from what the player did.
 *
 * Added 2026-11-02 for "NPCs start living their lives" (part 3, reactions).
 * This file adds no second store. It reads the existing systems:
 * - disposition and memory: `GameState.npcMemory` (npcReducer)
 * - the resident's sim life: `GameState.townSim` (villagerMood, villagerRecentLife)
 * - the player's deeds as town talk: `GameState.townRumors` (RumorMillSystem)
 * - crimes: `GameState.notoriety.knownCrimes` (watchReaction.isWantedInTown)
 * - work offers: the existing Quest type, sent through OFFER_QUEST
 * Everything here is pure and deterministic for one game state.
 */

import type { GameState } from '../../types/state';
import type { RichNPC } from '../../types/world';
import { QuestStatus, type Quest } from '../../types/quests';
import { getGameDay } from '../../utils/core';
import { householdFamilyAt, householdNpcAliveAt } from '../worldforge/townsim/householdNpc';
import { villagerMood, villagerRecentLife, type Mood } from '../worldforge/townsim/villagerMood';
import { POOR_WEALTH } from '../worldforge/townsim/shopLife';
import type { LifeEvent, TownSimState } from '../worldforge/townsim/types';
import { getRumorsForNpc } from '../intrigue/RumorMillSystem';
import { isWantedInTown } from './watchReaction';

type HouseholdResident = RichNPC & { worldforgeHousehold?: { burgId: number; memberId: string; legacyNameUnique?: boolean } };

/** A living town resident joined to its sim villager on the current day. */
export interface ResidentLife {
  resident: HouseholdResident;
  burgId: number;
  town: TownSimState;
  occupantId: number;
  day: number;
}

/** Resolve a generated NPC to its living sim villager, or undefined. */
export function resolveResidentLife(state: GameState, npcId: string): ResidentLife | undefined {
  const resident = state.generatedNpcs?.[npcId] as HouseholdResident | undefined;
  const identity = resident?.worldforgeHousehold;
  if (!resident || !identity) return undefined;
  const day = getGameDay(state.gameTime);
  if (!householdNpcAliveAt(resident, state.townSim, day)) return undefined;
  const town = state.townSim?.[identity.burgId];
  // A life registry entry can hold villagers without a chronicle (a partial
  // or older record). With no chronicle there is no life history to react to.
  if (!town?.chronicle) return undefined;
  const family = householdFamilyAt(town, identity.memberId, resident.name, day, identity.legacyNameUnique);
  if (!family) return undefined;
  return { resident, burgId: identity.burgId, town, occupantId: family.person.occupantId, day };
}

// ---------------------------------------------------------------------------
// Greeting stance
// ---------------------------------------------------------------------------

export type GreetingStance = 'warm' | 'friendly' | 'neutral' | 'wary' | 'cold' | 'shuns';

export interface NpcGreetingStance {
  stance: GreetingStance;
  /** The score that set the stance: disposition plus talk, crime and mood terms. */
  score: number;
  reasons: string[];
  /** The resident's own mood, when the NPC is a tracked resident. */
  mood?: Mood;
  /** True only for 'shuns': the NPC turns away and opens no conversation. */
  refuses: boolean;
}

/** Weight of one heard rumor about the player, by tone. */
export const GOOD_TALK_WEIGHT = 12;
export const BAD_TALK_WEIGHT = -18;
/** A witnessed crime in this town. The watch arrests; others keep away. */
export const WANTED_WEIGHT = -45;
export const MOOD_WEIGHT: Record<Mood, number> = { joyful: 10, content: 0, grieving: 0, worried: -5, bitter: -15 };

/** Lower bounds of each stance band. A score below -70 shuns the player. */
const STANCE_BANDS: [number, GreetingStance][] = [[40, 'warm'], [15, 'friendly'], [-15, 'neutral'], [-40, 'wary'], [-70, 'cold']];

const STANCE_WORDS: Record<GreetingStance, string> = {
  warm: 'You like this person and are glad to see them. Greet them warmly.',
  friendly: 'You think well of this person. Be friendly.',
  neutral: 'You have no strong feeling about this person. Be civil.',
  wary: 'You distrust this person. Be guarded and brief.',
  cold: 'You dislike this person. Be cold and curt, and do not offer help.',
  shuns: 'You refuse to speak with this person.',
};

const MOOD_WORDS: Record<Mood, string> = {
  joyful: 'You are in high spirits.',
  content: 'You are content.',
  grieving: 'You are grieving.',
  worried: 'You are worried.',
  bitter: 'You are bitter about how this year has gone.',
};

function playerName(state: GameState): string {
  return state.party[0]?.name?.trim() || 'the stranger';
}

/**
 * How an NPC feels about the player as they approach. The stance comes from:
 * - the NPC's stored disposition (-100..100)
 * - each fresh rumor this NPC has heard about the player (good or bad)
 * - a witnessed crime by the player in this town
 * - the NPC's own mood, when the sim tracks the NPC
 */
export function npcGreetingStance(state: GameState, npcId: string): NpcGreetingStance {
  const day = getGameDay(state.gameTime);
  const reasons: string[] = [];
  const disposition = state.npcMemory?.[npcId]?.disposition ?? 0;
  let score = disposition;
  if (disposition !== 0) reasons.push(`disposition ${disposition}`);

  // Read the player's name only when this NPC heard talk to match it against.
  const talk = getRumorsForNpc(state.townRumors ?? [], npcId, day);
  const subject = talk.length ? playerName(state) : '';
  const heard = talk.filter((rumor) => rumor.subject === subject || rumor.subject === 'the stranger');
  const good = heard.filter((rumor) => rumor.tone === 'positive').length;
  const bad = heard.filter((rumor) => rumor.tone === 'negative').length;
  if (good) { score += good * GOOD_TALK_WEIGHT; reasons.push(`heard ${good} good report(s) of the player`); }
  if (bad) { score += bad * BAD_TALK_WEIGHT; reasons.push(`heard ${bad} bad report(s) of the player`); }

  if (isWantedInTown(state.notoriety?.knownCrimes, state.currentLocationId)) {
    score += WANTED_WEIGHT;
    reasons.push('the player is wanted for a crime in this town');
  }

  const life = resolveResidentLife(state, npcId);
  const mood = life ? villagerMood(life.town, life.occupantId, life.day) : undefined;
  if (mood) {
    score += MOOD_WEIGHT[mood.mood];
    if (mood.mood !== 'content') reasons.push(`mood ${mood.mood}`);
  }

  const stance = STANCE_BANDS.find(([floor]) => score >= floor)?.[1] ?? 'shuns';
  return { stance, score, reasons, mood: mood?.mood, refuses: stance === 'shuns' };
}

/** One prompt line for the greeting: the stance, the mood and its reasons. */
export function npcGreetingPromptLine(state: GameState, npcId: string): string {
  const reaction = npcGreetingStance(state, npcId);
  const life = resolveResidentLife(state, npcId);
  const mood = life ? villagerMood(life.town, life.occupantId, life.day) : undefined;
  const parts = [STANCE_WORDS[reaction.stance]];
  if (reaction.reasons.length) parts.push(`(Why: ${reaction.reasons.join('; ')}.)`);
  if (mood) parts.push(`${MOOD_WORDS[mood.mood]}${mood.reasons.length ? ` (${mood.reasons.join('; ')})` : ''} Let this show.`);
  return parts.join(' ');
}

/** The narration when an NPC shuns the player. */
export function npcShunMessage(npcName: string, state: GameState): string {
  return isWantedInTown(state.notoriety?.knownCrimes, state.currentLocationId)
    ? `${npcName} looks at you, then turns away. People here know what you did.`
    : `${npcName} turns away and will not speak with you.`;
}

// ---------------------------------------------------------------------------
// "How have you been?"
// ---------------------------------------------------------------------------

const MOOD_OPENING: Record<Mood, string> = {
  joyful: 'Life has been good to me lately.',
  content: 'Well enough.',
  grieving: 'Not well. I am in mourning.',
  worried: 'I have had troubles lately.',
  bitter: 'Badly. Too much has gone wrong this year.',
};

/** A resident's own recent life in their words, or undefined when untracked. */
export function resolveNpcRecentLifeReply(state: GameState, npcId: string): string | undefined {
  const life = resolveResidentLife(state, npcId);
  if (!life) return undefined;
  const mood = villagerMood(life.town, life.occupantId, life.day);
  if (!mood) return undefined;
  const lines = villagerRecentLife(life.town, life.occupantId, life.day, 3);
  if (!lines.length) return `${MOOD_OPENING[mood.mood]} Nothing much has changed for me this year.`;
  return `${MOOD_OPENING[mood.mood]} This is what has happened: ${lines.join(' ')}`;
}

// ---------------------------------------------------------------------------
// Troubles and help requests (existing quest system)
// ---------------------------------------------------------------------------

/** Gold the player gives to see a poor resident through hard times. */
export const HARDSHIP_GIFT_GOLD = 10;
/** Sim wealth the gift adds. It lifts a resident above the poor line (POOR_WEALTH). */
export const HARDSHIP_GIFT_WEALTH = 30;
export const HARDSHIP_OBJECTIVE_ID = 'give_coin';
const HARDSHIP_QUEST_PREFIX = 'townsfolk_hardship_';

export interface ResidentTrouble {
  kind: 'hardship';
  /** What the resident says when asked. */
  text: string;
  quest: Quest;
}

/** The deterministic id of a hardship request: one per resident per sim year. */
export function hardshipQuestId(npcId: string, day: number): string {
  return `${HARDSHIP_QUEST_PREFIX}${npcId}_y${Math.floor(day / 365)}`;
}

export function isHardshipQuestId(questId: string): boolean {
  return questId.startsWith(HARDSHIP_QUEST_PREFIX);
}

/**
 * The trouble a resident would ask the player to help with, if any.
 * Only hardship is a trouble for now: a living adult at or below POOR_WEALTH.
 * A request already in the quest log (offered, active or done) is not repeated;
 * an abandoned one can be offered again.
 */
export function resolveResidentTrouble(state: GameState, npcId: string): ResidentTrouble | undefined {
  const life = resolveResidentLife(state, npcId);
  if (!life) return undefined;
  const person = life.town.villagers[life.occupantId];
  if (!person || person.wealth > POOR_WEALTH) return undefined;
  const id = hardshipQuestId(npcId, life.day);
  const prior = state.questLog.find((quest) => quest.id === id);
  if (prior && prior.status !== QuestStatus.Abandoned) return undefined;
  const name = life.resident.name;
  const quest: Quest = {
    id,
    title: `Hard Times for ${name}`,
    description: `${name} has fallen on hard times and asked you for ${HARDSHIP_GIFT_GOLD} gold to get through them.`,
    giverId: npcId,
    giverName: name,
    status: QuestStatus.Available,
    objectives: [{ id: HARDSHIP_OBJECTIVE_ID, description: `Give ${name} ${HARDSHIP_GIFT_GOLD} gold.`, isCompleted: false }],
  };
  return {
    kind: 'hardship',
    text: `Times are hard. My purse is nearly empty. If you could spare ${HARDSHIP_GIFT_GOLD} gold, I would not forget it.`,
    quest,
  };
}

/** The accepted hardship request this resident is waiting on, if any. */
export function activeHardshipQuest(state: GameState, npcId: string): Quest | undefined {
  return state.questLog.find((quest) => isHardshipQuestId(quest.id) && quest.giverId === npcId && quest.status === QuestStatus.Active);
}

/** The town receipt for a help gift, keyed by the quest id. */
export function helpReceipt(town: TownSimState, questId: string): LifeEvent | undefined {
  return town.chronicle.events.find((event) => event.kind === 'player_intervention' && event.provenance?.sourceKey === `help:${questId}`);
}

export type HelpTownsfolkResult =
  | { status: 'resolved'; burgId: number; town: TownSimState; gold: number; outcome: LifeEvent }
  | { status: 'not_found' | 'insufficient_gold' | 'already_resolved' };

/**
 * One atomic help transaction, in the style of resolveTownSituation: the player
 * pays the gift, the resident's sim wealth rises, and the town chronicle gets a
 * `player_intervention` receipt that the news and rumor surfaces already read.
 * Stale, replayed and unaffordable inputs fail closed and change nothing.
 */
export function resolveHelpTownsfolk(state: GameState, npcId: string, questId: string): HelpTownsfolkResult {
  const quest = activeHardshipQuest(state, npcId);
  if (!quest || quest.id !== questId) return { status: 'not_found' };
  const life = resolveResidentLife(state, npcId);
  if (!life) return { status: 'not_found' };
  if (helpReceipt(life.town, questId)) return { status: 'already_resolved' };
  if (state.gold < HARDSHIP_GIFT_GOLD) return { status: 'insufficient_gold' };
  const person = life.town.villagers[life.occupantId];
  const actorName = state.party[0]?.name?.trim() || 'A traveler';
  const outcome: LifeEvent = {
    id: life.town.chronicle.nextEventId,
    day: life.day,
    kind: 'player_intervention',
    subjectId: life.occupantId,
    relatedIds: [],
    summary: `${actorName} gave ${person.name} ${HARDSHIP_GIFT_GOLD} gold in hard times.`,
    provenance: { sourceKey: `help:${questId}`, actorName },
  };
  const town: TownSimState = {
    ...life.town,
    villagers: { ...life.town.villagers, [life.occupantId]: { ...person, wealth: person.wealth + HARDSHIP_GIFT_WEALTH } },
    chronicle: { ...life.town.chronicle, events: [...life.town.chronicle.events, outcome], nextEventId: life.town.chronicle.nextEventId + 1 },
  };
  return { status: 'resolved', burgId: life.burgId, town, gold: state.gold - HARDSHIP_GIFT_GOLD, outcome };
}
