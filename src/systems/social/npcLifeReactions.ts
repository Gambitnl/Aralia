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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 05/11/2026, 11:29:02
 * Dependents: hooks/actions/handleNpcInteraction.ts, hooks/useConversation.ts, hooks/useDialogueSystem.ts, services/dialogueService.ts, state/reducers/questReducer.ts, state/reducers/townReducer.ts, state/reducers/worldReducer.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types/state';
import type { RichNPC } from '../../types/world';
import { QuestStatus, type Quest } from '../../types/quests';
import { getGameDay } from '../../utils/core';
import { householdFamilyAt, householdNpcAliveAt } from '../worldforge/townsim/householdNpc';
import { GRIEF_DAYS, villagerMood, villagerRecentLife, WORRY_DAYS, type Mood } from '../worldforge/townsim/villagerMood';
import { POOR_WEALTH, RICH_WEALTH } from '../worldforge/townsim/shopLife';
import { disasterSummary } from '../worldforge/townsim/disasters';
import { hasUnrepairedBuildingFire } from '../worldforge/interior/buildingEventHistory';
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
  return state.party?.[0]?.name?.trim() || 'the stranger';
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

/**
 * The attitude line for a free-text chat reply (2026-11-04, GG-596 follow-up 2).
 * It is the same stance, mood and reasons that set the greeting, read again
 * from the current state, so a talk that changed the disposition changes the
 * next reply too. Both chat lanes use it: the dialogue window free text
 * (useDialogueSystem.generateResponse) and the conversation panel
 * (useConversation) for non-companion speakers.
 */
export function npcChatAttitudeHint(state: GameState, npcId: string): string {
  return `Your attitude toward the player now: ${npcGreetingPromptLine(state, npcId)}`;
}

/**
 * The authored reply when an NPC shuns the player in mid-talk. The greeting
 * already turns away a shunning NPC, so this applies only when the stance falls
 * to "shuns" during a conversation. No model call is made for it.
 */
export const NPC_SHUN_REPLY = 'I have nothing more to say to you.';

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
//
// 2026-11-04 (GG-596 follow-up 1): hardship was the only trouble. Fire, plague
// and grief now also become help requests. Each trouble reads a fact the sim
// already records; nothing here stores a second copy of it:
// - fire: a town fire within HELP_DISASTER_DAYS, and the resident's home still
//   has unrepaired fire damage (`hasUnrepairedBuildingFire`).
// - plague: a town plague within HELP_DISASTER_DAYS, the resident is not rich,
//   and a spouse or child of the resident is alive (a family to protect).
// - grief: a spouse, child or parent died within GRIEF_DAYS, and the resident
//   is not rich (the gift pays for the burial).
// - hardship: the resident is poor (wealth at or below POOR_WEALTH).
// All four use the same Quest shape, the same OFFER_QUEST and ACCEPT_QUEST path
// and the same HELP_TOWNSFOLK transaction. Only the gold, the sim wealth and the
// words change by kind. PRESERVED: the hardship quest id, gift and text are
// unchanged, so a hardship request in an older save still pays out.

export type TroubleKind = 'fire' | 'plague' | 'grief' | 'hardship';

/** Gold the player gives to see a poor resident through hard times. */
export const HARDSHIP_GIFT_GOLD = 10;
/** Sim wealth the gift adds. It lifts a resident above the poor line (POOR_WEALTH). */
export const HARDSHIP_GIFT_WEALTH = 30;
/** Every help request has one objective: give the gold. The id is shared by all kinds. */
export const HARDSHIP_OBJECTIVE_ID = 'give_coin';
export const HELP_OBJECTIVE_ID = HARDSHIP_OBJECTIVE_ID;
/** A fire or plague is a trouble for this many days after the town event. */
export const HELP_DISASTER_DAYS = WORRY_DAYS;

/** The gold the player gives and the sim wealth it adds, by trouble. */
export const HELP_TERMS: Record<TroubleKind, { gold: number; wealth: number }> = {
  // Repairs to a burned home cost the most, and the gift restores the most.
  fire: { gold: 25, wealth: 40 },
  // A healer's fee. The family stays, so the wealth gain is small.
  plague: { gold: 15, wealth: 15 },
  // A burial. A small gift; the family keeps a little more.
  grief: { gold: 5, wealth: 10 },
  hardship: { gold: HARDSHIP_GIFT_GOLD, wealth: HARDSHIP_GIFT_WEALTH },
};

/** The order in which a resident names a trouble. The first that applies wins. */
const TROUBLE_ORDER: TroubleKind[] = ['fire', 'plague', 'grief', 'hardship'];

const HELP_QUEST_PREFIX = 'townsfolk_';
const HELP_QUEST_ID = /^townsfolk_(fire|plague|grief|hardship)_/;
const HARDSHIP_QUEST_PREFIX = `${HELP_QUEST_PREFIX}hardship_`;

export interface ResidentTrouble {
  kind: TroubleKind;
  /** What the resident says when asked. */
  text: string;
  quest: Quest;
}

/** The deterministic id of a hardship request: one per resident per sim year. */
export function hardshipQuestId(npcId: string, day: number): string {
  return `${HARDSHIP_QUEST_PREFIX}${npcId}_y${Math.floor(day / 365)}`;
}

/**
 * The deterministic id of a fire, plague or grief request: one per resident per
 * source chronicle event (the disaster or the death), so a second fire is a new
 * request and a replay of the same one is not.
 */
export function eventHelpQuestId(kind: Exclude<TroubleKind, 'hardship'>, npcId: string, sourceEventId: number): string {
  return `${HELP_QUEST_PREFIX}${kind}_${npcId}_e${sourceEventId}`;
}

export function isHardshipQuestId(questId: string): boolean {
  return questId.startsWith(HARDSHIP_QUEST_PREFIX);
}

/** The trouble kind of a townsfolk help request id, or undefined for any other quest. */
export function helpQuestKind(questId: string): TroubleKind | undefined {
  return HELP_QUEST_ID.exec(questId)?.[1] as TroubleKind | undefined;
}

export function isHelpQuestId(questId: string): boolean {
  return helpQuestKind(questId) !== undefined;
}

/** The gold an accepted help request asks for. */
export function helpQuestGold(quest: Pick<Quest, 'id'>): number {
  return HELP_TERMS[helpQuestKind(quest.id) ?? 'hardship'].gold;
}

type Relation = 'spouse' | 'child' | 'parent';

/** Close kin of a villager with the relation word. A dead spouse keeps spouseId. */
function closeKin(town: TownSimState, occupantId: number): Map<number, Relation> {
  const self = town.villagers[occupantId];
  const kin = new Map<number, Relation>();
  if (!self) return kin;
  if (self.spouseId !== undefined) kin.set(self.spouseId, 'spouse');
  for (const id of self.parentIds ?? []) kin.set(id, 'parent');
  for (const id of self.childIds ?? []) kin.set(id, 'child');
  return kin;
}

/** The newest town disaster of one kind within the help window, or undefined. */
function recentDisaster(town: TownSimState, kind: 'fire' | 'plague', day: number): LifeEvent | undefined {
  const summary = disasterSummary(kind);
  return town.chronicle.events
    .filter((event) => event.kind === 'disaster' && event.summary === summary
      && event.day <= day && day - event.day <= HELP_DISASTER_DAYS)
    .sort((a, b) => b.day - a.day || b.id - a.id)[0];
}

/** Days-ago words for a resident's own speech. */
function agoWords(eventDay: number, day: number): string {
  const n = day - eventDay;
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}

interface TroubleDraft {
  kind: TroubleKind;
  id: string;
  title: string;
  /** Quest log text after the resident's name. */
  ask: string;
  text: string;
}

/** Every trouble that applies to this resident now, in TROUBLE_ORDER. */
function troubleDrafts(life: ResidentLife, npcId: string): TroubleDraft[] {
  const { town, occupantId, day } = life;
  const person = town.villagers[occupantId];
  if (!person) return [];
  const name = life.resident.name;
  const rich = person.wealth >= RICH_WEALTH;
  const kin = closeKin(town, occupantId);
  const alive = (id: number) => {
    const v = town.villagers[id];
    return v !== undefined && v.bornDay <= day && (v.diedDay === undefined || v.diedDay > day);
  };
  const drafts: TroubleDraft[] = [];
  for (const kind of TROUBLE_ORDER) {
    const gold = HELP_TERMS[kind].gold;
    if (kind === 'fire') {
      const fire = recentDisaster(town, 'fire', day);
      if (!fire || !hasUnrepairedBuildingFire(town.buildingEvents?.[person.homePlotId])) continue;
      drafts.push({ kind, id: eventHelpQuestId('fire', npcId, fire.id), title: `Rebuild After the Fire for ${name}`,
        ask: `lost part of their home in the fire and asked you for ${gold} gold to repair it.`,
        text: `The fire ${agoWords(fire.day, day)} burned my home, and it still stands damaged. With ${gold} gold I could repair it.` });
    } else if (kind === 'plague') {
      const plague = recentDisaster(town, 'plague', day);
      const family = [...kin].some(([id, relation]) => relation !== 'parent' && alive(id));
      if (!plague || rich || !family) continue;
      drafts.push({ kind, id: eventHelpQuestId('plague', npcId, plague.id), title: `A Healer for ${name}'s Family`,
        ask: `fears the plague for their family and asked you for ${gold} gold to pay a healer.`,
        text: `The sickness came ${agoWords(plague.day, day)} and I fear for my family. A healer asks ${gold} gold, and I cannot pay it.` });
    } else if (kind === 'grief') {
      if (rich) continue;
      const death = town.chronicle.events
        .filter((event) => event.kind === 'death' && kin.has(event.subjectId)
          && event.day <= day && day - event.day <= GRIEF_DAYS)
        .sort((a, b) => b.day - a.day || b.id - a.id)[0];
      if (!death) continue;
      const relation = kin.get(death.subjectId)!;
      const dead = town.villagers[death.subjectId]?.name ?? 'my kin';
      drafts.push({ kind, id: eventHelpQuestId('grief', npcId, death.id), title: `A Burial for ${dead}`,
        ask: `is in mourning for their ${relation} ${dead} and asked you for ${gold} gold for the burial.`,
        text: `My ${relation} ${dead} died ${agoWords(death.day, day)}. I cannot pay for a proper burial. Could you spare ${gold} gold?` });
    } else if (person.wealth <= POOR_WEALTH) {
      drafts.push({ kind, id: hardshipQuestId(npcId, day), title: `Hard Times for ${name}`,
        ask: `has fallen on hard times and asked you for ${gold} gold to get through them.`,
        text: `Times are hard. My purse is nearly empty. If you could spare ${gold} gold, I would not forget it.` });
    }
  }
  return drafts;
}

/**
 * The trouble a resident would ask the player to help with, if any. The first
 * trouble in TROUBLE_ORDER that is not already in the quest log wins. A request
 * already in the log (offered, active or done) is not repeated; an abandoned one
 * can be offered again. So after the player helps with a fire, the same resident
 * can still ask for help with a burial.
 */
export function resolveResidentTrouble(state: GameState, npcId: string): ResidentTrouble | undefined {
  const life = resolveResidentLife(state, npcId);
  if (!life) return undefined;
  const open = troubleDrafts(life, npcId).find((draft) => {
    const prior = state.questLog.find((quest) => quest.id === draft.id);
    return !prior || prior.status === QuestStatus.Abandoned;
  });
  if (!open) return undefined;
  const name = life.resident.name;
  const gold = HELP_TERMS[open.kind].gold;
  const quest: Quest = {
    id: open.id,
    title: open.title,
    description: `${name} ${open.ask}`,
    giverId: npcId,
    giverName: name,
    status: QuestStatus.Available,
    objectives: [{ id: HELP_OBJECTIVE_ID, description: `Give ${name} ${gold} gold.`, isCompleted: false }],
  };
  return { kind: open.kind, text: open.text, quest };
}

/** The accepted help request (any kind) this resident is waiting on, if any. */
export function activeHelpQuest(state: GameState, npcId: string): Quest | undefined {
  return state.questLog.find((quest) => isHelpQuestId(quest.id) && quest.giverId === npcId && quest.status === QuestStatus.Active);
}

/** @deprecated Kept for older callers; every help kind now counts. Use activeHelpQuest. */
export const activeHardshipQuest = activeHelpQuest;

/** The town receipt for a help gift, keyed by the quest id. */
export function helpReceipt(town: TownSimState, questId: string): LifeEvent | undefined {
  return town.chronicle.events.find((event) => event.kind === 'player_intervention' && event.provenance?.sourceKey === `help:${questId}`);
}

export type HelpTownsfolkResult =
  | { status: 'resolved'; burgId: number; town: TownSimState; gold: number; outcome: LifeEvent }
  | { status: 'not_found' | 'insufficient_gold' | 'already_resolved' };

/** The receipt line, by trouble. The hardship words are the original ones. */
const HELP_RECEIPT_WORDS: Record<TroubleKind, string> = {
  fire: 'to repair their home after the fire',
  plague: 'to pay a healer during the plague',
  grief: 'for a burial',
  hardship: 'in hard times',
};

/**
 * One atomic help transaction, in the style of resolveTownSituation: the player
 * pays the gift, the resident's sim wealth rises, and the town chronicle gets a
 * `player_intervention` receipt that the news and rumor surfaces already read.
 * Stale, replayed and unaffordable inputs fail closed and change nothing.
 */
export function resolveHelpTownsfolk(state: GameState, npcId: string, questId: string): HelpTownsfolkResult {
  const quest = state.questLog.find((entry) => entry.id === questId && isHelpQuestId(entry.id)
    && entry.giverId === npcId && entry.status === QuestStatus.Active);
  if (!quest) return { status: 'not_found' };
  const kind = helpQuestKind(quest.id)!;
  const terms = HELP_TERMS[kind];
  const life = resolveResidentLife(state, npcId);
  if (!life) return { status: 'not_found' };
  if (helpReceipt(life.town, questId)) return { status: 'already_resolved' };
  if (state.gold < terms.gold) return { status: 'insufficient_gold' };
  const person = life.town.villagers[life.occupantId];
  const actorName = state.party?.[0]?.name?.trim() || 'A traveler';
  const outcome: LifeEvent = {
    id: life.town.chronicle.nextEventId,
    day: life.day,
    kind: 'player_intervention',
    subjectId: life.occupantId,
    relatedIds: [],
    summary: `${actorName} gave ${person.name} ${terms.gold} gold ${HELP_RECEIPT_WORDS[kind]}.`,
    provenance: { sourceKey: `help:${questId}`, actorName },
  };
  const town: TownSimState = {
    ...life.town,
    villagers: { ...life.town.villagers, [life.occupantId]: { ...person, wealth: person.wealth + terms.wealth } },
    chronicle: { ...life.town.chronicle, events: [...life.town.chronicle.events, outcome], nextEventId: life.town.chronicle.nextEventId + 1 },
  };
  return { status: 'resolved', burgId: life.burgId, town, gold: state.gold - terms.gold, outcome };
}
