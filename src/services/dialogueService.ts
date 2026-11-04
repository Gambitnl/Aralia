/**
 * @file src/services/dialogueService.ts
 * Service for managing dialogue topics, checking prerequisites, and handling conversation flow.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 22:28:58
 * Dependents: components/Dialogue/DialogueConversationView.tsx, components/Dialogue/DialogueInterface.tsx, hooks/useConversation.ts, hooks/useDialogueSystem.ts, systems/puzzles/dialogueBridge.ts
 * Imports: 16 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  ConversationTopic,
  DialogueSession,
  NPCKnowledgeProfile,
  TopicCost
} from '../types/dialogue';
import { GameState, QuestStatus, Item, NPC, WorldRumor } from '../types/index';
import { rollDice } from '../systems/dice/rollers';
import { INITIAL_TOPICS } from '../data/dialogue/topics';
import { getGameDay } from '../utils/core';
import { hasWorldFact, topicUnlockKey } from '../systems/facts/worldFactStore';
import { buildWitnessDialogueContext } from '../systems/social/npcWitnessMemory';
import type { NpcMemory, RichNPC } from '../types/world';
import { householdNpcAliveAt } from '../systems/worldforge/townsim/householdNpc';
import { latestSpokenWorkReply, latestSpokenPersonalReply, npcDialogueSpeakerKey, latestSpokenDialogueReplies } from '../systems/social/npcDialogueMemory';
import {resolveNpcInstitutionStatement} from '../systems/social/npcInstitutionStatements';
import { resolveNpcPersonalStatement } from '../systems/social/npcPersonalStatements';
import type { NpcDialoguePublication } from '../types/memory';
import type { WorldBusiness } from '../types/business';
import { shareableRumorNotes, rumorSubject } from '../systems/companions/companionRumors';
import { resolveNpcLocalDirections } from '../systems/travel/npcLocalDirections';
import { activeHelpQuest, helpQuestGold, npcGreetingStance, resolveNpcRecentLifeReply, resolveResidentTrouble } from '../systems/social/npcLifeReactions';
import type { Quest } from '../types/quests';

const TOPIC_REGISTRY: Record<string, ConversationTopic> = {};

// Initialize registry with default topics
INITIAL_TOPICS.forEach(topic => {
  TOPIC_REGISTRY[topic.id] = topic;
});

export function registerTopic(topic: ConversationTopic) {
  TOPIC_REGISTRY[topic.id] = topic;
}

export function getTopic(topicId: string): ConversationTopic | undefined {
  return TOPIC_REGISTRY[topicId];
}

/**
 * Checks if a player meets the prerequisites for a specific topic with a given NPC.
 */
export function checkTopicPrerequisites(
  topic: ConversationTopic,
  gameState: GameState,
  npcId: string
): boolean {
  if (!topic.prerequisites || topic.prerequisites.length === 0) {
    return true;
  }

  return topic.prerequisites.every(prereq => {
    let met = false;

    switch (prereq.type) {
      case 'relationship': {
        const memory = gameState.npcMemory[npcId];
        const disposition = memory ? memory.disposition : 0;
        met = disposition >= (Number(prereq.value) || 0);
        break;
      }

      case 'topic_known': {
        // Durable world-level fact store first (DIAL-002/DIAL-004): unlocks
        // learned from ANY NPC gate topics with every other NPC and survive
        // save/reload. Legacy discovery-log flags keep older saves working.
        met =
          (!!prereq.targetId &&
            hasWorldFact(gameState.worldFacts, topicUnlockKey(prereq.targetId))) ||
          gameState.discoveryLog.some(entry =>
            entry.flags.some(f => f.key === 'topic_unlocked' && f.value === prereq.targetId)
          );
        break;
      }

      case 'quest_status': {
        const quest = gameState.questLog.find(q => q.id === prereq.targetId);
        const requiredStatus = prereq.value as QuestStatus;
        if (!quest) {
            met = false;
        } else {
            met = quest.status === requiredStatus;
        }
        break;
      }

      case 'item_owned': {
        if (!prereq.targetId) { met = false; break; }
        // Count total quantity, handling both unstacked objects and stacked items (if 'count' or 'quantity' exists)
        const totalQuantity = gameState.inventory.reduce((sum, item: Item & { count?: number; quantity?: number }) => {
          if (item.id !== prereq.targetId) return sum;
          const stackSize = item.count || item.quantity || 1;
          return sum + stackSize;
        }, 0);

        const requiredCount = Number(prereq.value) || 1;
        met = totalQuantity >= requiredCount;
        break;
      }

      case 'min_gold': {
        const requiredGold = Number(prereq.value) || 0;
        met = gameState.gold >= requiredGold;
        break;
      }

      case 'faction_standing': {
        const factionId = prereq.targetId;
        if (!factionId) {
          met = false;
          break;
        }

        const standingValue = gameState.playerFactionStandings[factionId]?.publicStanding ?? 0;
        met = standingValue >= (Number(prereq.value) || 0);
        break;
      }
    }

    return prereq.negate ? !met : met;
  });
}

/**
 * Checks if the player can afford the costs associated with a topic.
 */
export function canAffordTopic(
  topic: ConversationTopic,
  gameState: GameState
): boolean {
  if (!topic.costs || topic.costs.length === 0) {
    return true;
  }

  return topic.costs.every(cost => {
    if (cost.type === 'gold') {
      return gameState.gold >= cost.value;
    }

    if (cost.type === 'item' && cost.targetId) {
      const totalQuantity = gameState.inventory.reduce((sum, item: Item & { count?: number; quantity?: number }) => {
        if (item.id !== cost.targetId) return sum;
        const stackSize = item.count || item.quantity || 1;
        return sum + stackSize;
      }, 0);
      return totalQuantity >= cost.value;
    }

    return false;
  });
}

/**
 * Determines if an NPC knows about a topic and is willing to discuss it.
 * This logic enforces that even if a player unlocks a topic globally, a specific NPC
 * must also have the knowledge or it must be a global topic.
 */
export function canNPCDiscuss(
  topic: ConversationTopic,
  npc: NPC,
  _disposition: number
): boolean {
  // 1. Check if the topic is globally available (generic topics like "Weather" or "Who are you")
  if (topic.isGlobal) {
    return true;
  }

  // 2. Check if the NPC has a knowledge profile
  if (!npc.knowledgeProfile) {
    // If no profile is defined, we assume they rely on global topics only,
    // UNLESS the system design implies all NPCs know all non-private topics.
    // For "Dialogist" strictness: No profile = No knowledge of specific topics.
    return false;
  }

  const { topicOverrides, baseOpenness: _baseOpenness } = npc.knowledgeProfile;

  // 3. Check specific knowledge override
  const override = topicOverrides[topic.id];
  if (override) {
    // If explicitly marked as NOT known, they can't discuss it
    if (!override.known) return false;

    // Check willingness if they know it
    // Disposition + Base Openness + Topic Modifier >= Threshold?
    // We'll treat willingness as a soft gate here.
    // If they are unwilling, they might still show the topic but require a harder check (handled in skill check logic).
    // For *availability* (showing the option), we might hide it if they absolutely refuse?
    // Let's say we hide it only if they don't KNOW it.
    // Willingness affects the Outcome, not visibility (usually).
    // However, if it's a "Secret", maybe they don't even reveal they know it unless disposition is high?

    // Implementation: If willingness is very low, maybe hide it?
    // For now, we return TRUE if they KNOW it.
    return true;
  }

  // 4. If no specific override, do they know it by default?
  // We can assume topics are 'unknown' by default unless isGlobal is true.
  return false;
}

function convertRumorToTopic(rumor: WorldRumor, receipt: Item): ConversationTopic {
  const subject = rumorSubject(receipt);
  return {
    id: `rumor_${rumor.id}`,
    label: subject === 'Rumor' || subject === 'Lead' ? 'Discuss this account' : `Discuss ${subject}`,
    description: receipt.description,
    category: 'rumor',
    // A bought note is a frozen account. Do not replace its words with newer
    // world data or turn a second-hand story into a witnessed event or route.
    playerPrompt: `I was told this account: ${receipt.description}. What do you know about it? Treat this as hearsay, not a witnessed event or a confirmed route. If you have no supporting knowledge, say so.`,
    isGlobal: false, // It's generated specifically for this context
    isOneTime: false,
  };
}

/**
 * Upper bound on how many retained-account topics a
 * single NPC will surface at once.
 *
 * The living-world chronicle can accumulate dozens of buyable rumors in a busy
 * town (every marriage / succession / disaster syncs one), and each becomes a
 * near-identical dynamic topic. Left uncapped, they bury the authored core
 * topics (Who are you?, Show me your wares., Heard any rumors?, I need
 * directions., Invite to party). We keep only the top few — ranked by
 * prominence (virality) then recency — so the Topics list stays readable while
 * the "Heard any rumors?" flow still fronts the town's freshest talk.
 */
export const MAX_DYNAMIC_RUMOR_TOPICS = 3;

/**
 * Generates dynamic topics based on active rumors in the game state.
 * NPCs will gossip about things relevant to their faction or location.
 */
export function getDynamicRumorTopics(
  gameState: GameState,
  npc: NPC
): ConversationTopic[] {
  if (!gameState.activeRumors || gameState.activeRumors.length === 0) {
    return [];
  }

  // Determine NPC Location Context
  // 1. Check dynamic lists (e.g., they are a wandering NPC in the current location)
  // 2. Check current location (e.g., they are a static NPC in the town we are in)
  // Default to current location if we can't be sure, as dialogue usually happens face-to-face.

  const npcLocationId: string | undefined = gameState.currentLocationId;
  const currentGameDay = getGameDay(gameState.gameTime);

  // activeRumors is the world offer pool, not the player's knowledge. Reuse
  // the same retained ordinary notes already shared with companions. Secrets
  // retain their own disclosure path; no purchase or duplicate ledger is made.
  const receipts = new Map<string, Item>();
  for (const { item } of shareableRumorNotes(gameState)) {
    if (!receipts.has(item.sourceId!)) receipts.set(item.sourceId!, item);
  }
  const relevantRumors = gameState.activeRumors.filter(rumor => {
    if (!receipts.has(`gossip_${rumor.id}`)) return false;
    // 0. Expiration Check
    // If expiration timestamp (in game days) is less than current game day, it's old news.
    // Note: If timestamps are different units, this logic fails.
    // WorldRumor defines: `timestamp: number; // Game day timestamp`
    if (rumor.expiration && rumor.expiration <= currentGameDay) {
        return false;
    }

    // 1. Faction relevance
    if (npc.faction && (rumor.sourceFactionId === npc.faction || rumor.targetFactionId === npc.faction)) {
      return true;
    }

    // 2. Location relevance
    if (npcLocationId && rumor.locationId === npcLocationId) {
        return true;
    }

    // 3. High virality / Global rumors (no region/location restriction)
    if (!rumor.region && !rumor.locationId && (rumor.virality || 0) > 0.5) {
        return true;
    }

    return false;
  });

  // Cap the flood: keep only the most prominent / most recent rumors so they
  // don't bury the authored core topics. Rank by virality (how loudly the news
  // travels) then by recency (higher timestamp = more recent game day).
  const ranked = [...relevantRumors].sort(
    (a, b) =>
      (b.virality || 0) - (a.virality || 0) ||
      (b.timestamp || 0) - (a.timestamp || 0),
  );

  return ranked.slice(0, MAX_DYNAMIC_RUMOR_TOPICS).map(rumor => convertRumorToTopic(rumor, receipts.get(`gossip_${rumor.id}`)!));
}

/** Resolve the same registered person/storefront identity used by merchant
 * execution. A linked shop wins; an unlinked legacy person needs one unique
 * owned business. Static NPCs and ambiguous businesses keep their old dialogue
 * path instead of generating a replacement person or guessing an inventory. */
export function resolveDialogueStorefront(gameState: GameState, npcId: string): WorldBusiness | undefined {
  const speaker = gameState.generatedNpcs?.[npcId];
  if (!speaker) return undefined;
  const businesses = gameState.worldBusinesses ?? {};
  const linked = speaker.businessId ? businesses[speaker.businessId] : undefined;
  const owned = Object.values(businesses).filter(business => business.ownerId === npcId);
  const business = linked ?? (owned.length === 1 ? owned[0] : undefined);
  return business?.ownerId === npcId && Array.isArray(business.stock)
    ? business : undefined;
}

/** A global question is not proof that a resident has goods for sale.
 * Merchant roles retain legacy shops; other residents need their own persisted
 * storefront stock, including an empty sold-out list. A farm/mine simulation
 * or another person's business link does not create a shop. */
function canOfferTrade(gameState: GameState, npcId: string, npc?: NPC): boolean {
  const speaker = npc ?? gameState.generatedNpcs?.[npcId];
  if (!speaker) return false;
  if (speaker.role === 'merchant') return true;
  return Object.values(gameState.worldBusinesses ?? {}).some(
    business => business.ownerId === speaker.id && Array.isArray(business.stock)
  );
}

/** Resolve the same owned report for both speech and its immutable source receipt. */
function resolveHouseholdWorkReport(gameState: GameState,resident: RichNPC) {
    const owned = Object.values(gameState.worldBusinesses ?? {}).filter(b => b.ownerId === resident.id && b.ownerType === 'npc');
    const linked = resident.businessId ? owned.find(b => b.id === resident.businessId) : undefined;
    const business = linked ?? (!resident.businessId && owned.length === 1 ? owned[0] : undefined);
    if (!business?.name?.trim()) return undefined;
    // Saved legacy trades can disagree with the real household job (GF-G25).
    // Do not turn a misconfigured enchanter ledger into an innkeeper's hardship.
    if (resident.occupation === 'innkeeper' && business.businessType !== 'tavern') return undefined;
    if (resident.occupation === 'shopkeeper' && !['general_store','apothecary','trading_company','enchanter_shop'].includes(business.businessType)) return undefined;
    const report = business.lastDailyReport;
    const day = getGameDay(gameState.gameTime);
    // Newly registered all-zero reports are placeholders. Old, future or
    // inconsistent figures cannot establish how somebody's work is going now.
    if (!report || ![report.day,report.revenue,report.costs,report.profit].every(Number.isFinite)
        || !Number.isInteger(report.day) || report.day > day || day - report.day > 1
        || report.revenue < 0 || report.costs < 0 || report.revenue + report.costs === 0
        || Math.abs(report.revenue - report.costs - report.profit) > 0.011
        || ![report.supplyIssues,report.competitorActions,report.staffIssues].every(v=>v===undefined || Array.isArray(v)&&v.every(x=>typeof x==='string'))) return undefined;
    return {business,report};
}

/** Personal facts come from the registered household; conversation recall
 * quotes actually delivered history. Neither is inferred from an old biography
 * or a business slot. New open conversation still uses the model. Explicit
 * knowledge overrides keep their authored/guarded behavior. */
const HOUSEHOLD_TOPICS: ConversationTopic[] = [
  {id:'household_temple',label:"I read the temple's dedication.",category:'lore',playerPrompt:"I read the temple's dedication. Tell me about the temple you serve.",isOneTime:true},
  {id:'household_office_history',label:'How did you become the priest?',category:'personal',playerPrompt:'How did you become the priest?',isOneTime:true},
  {id:'household_public_history',label:"Where can I read the town's history?",category:'lore',playerPrompt:"Where can I read the town's history?",isOneTime:true},
  {id:'conversation_recall',label:'What did we last discuss?',category:'personal',playerPrompt:'What did we last discuss?',isOneTime:true},
  {id:'household_identity_recall',label:'What did you tell me about yourself?',category:'personal',playerPrompt:'What did you tell me about yourself?',isOneTime:true},
  {id:'household_family_recall',label:'What did you tell me about your family?',category:'personal',playerPrompt:'What did you tell me about your family?',isOneTime:true},
  {id:'household_family', label:'Tell me about your family.', category:'personal', playerPrompt:'Tell me about your family.', isOneTime:true},
  {id:'household_work_recall', label:'What did you tell me about work?', category:'personal', playerPrompt:'What did you tell me about work?', isOneTime:true},
  {id:'household_work', label:'How is work going?', category:'personal', playerPrompt:'How is work going?', isOneTime:true},
  {id:'household_meeting', label:'Have we met before?', category:'personal', playerPrompt:'Have we met before?', isOneTime:true},
  // NPC lives (2026-11-02): the resident's own sim life, troubles and the help the player gives.
  {id:'household_news', label:'How have you been?', category:'personal', playerPrompt:'How have you been?', isOneTime:true},
  {id:'household_trouble', label:'Is something troubling you?', category:'personal', playerPrompt:'Is something troubling you?', isOneTime:true},
  // 2026-11-04: the gift now depends on the trouble (fire, plague, grief or
  // hardship), so the player line names no fixed amount.
  {id:'household_help', label:'Here is the coin you asked for.', category:'personal', playerPrompt:'Here is the gold you asked for.', isOneTime:true},
];
export function resolveHouseholdPersonalReply(gameState: GameState, session: DialogueSession, topicId: string, npc?: NPC): string | undefined {
  if (topicId==='conversation_recall') {
    if (npc && npc.id!==session.npcId || npc?.knowledgeProfile?.topicOverrides?.[topicId]) return undefined;
    const previous=latestSpokenDialogueReplies(gameState,session.npcId,1).at(-1);
    const speaker=npc??gameState.generatedNpcs?.[session.npcId];
    // Remembering old words does not remove today's authored refusal to
    // discuss that subject. Keep the history; do not voice it through recall.
    if (previous?.dialogue&&speaker?.knowledgeProfile?.topicOverrides?.[previous.dialogue.topicId]) return undefined;
    return previous ? 'Last time, I told you: “'+previous.summary+'”' : undefined;
  }
  const resident = gameState.generatedNpcs?.[session.npcId] as (RichNPC & {worldforgeHousehold?: {memberId:string}}) | undefined;
  if (!resident?.worldforgeHousehold || (npc && npc.id !== resident.id)
      || !householdNpcAliveAt(resident, gameState.townSim, getGameDay(gameState.gameTime))) return undefined;
  // An authored answer, refusal or secret cannot be overwritten by public facts.
  if (resident.knowledgeProfile?.topicOverrides?.[topicId] || npc?.knowledgeProfile?.topicOverrides?.[topicId]) return undefined;
  if (topicId==='household_temple'||topicId==='household_office_history'||topicId==='household_public_history') return resolveNpcInstitutionStatement(gameState,resident.id,topicId)?.text;
  // Basic local directions use this resident's own canonical town/workplace.
  // The existing factual publication guard re-reads the same answer before effects.
  if (topicId === 'global_directions') return resolveNpcLocalDirections(gameState, resident);
  if (topicId === 'global_who_are_you' || topicId === 'household_family') return resolveNpcPersonalStatement(gameState,resident.id,topicId)?.text;
  if (topicId === 'household_identity_recall' || topicId === 'household_family_recall') {
    const original=topicId==='household_identity_recall'?'global_who_are_you':'household_family';
    if (resident.knowledgeProfile?.topicOverrides?.[original] || npc?.knowledgeProfile?.topicOverrides?.[original]) return undefined;
    const previous=latestSpokenPersonalReply(gameState,resident.id,original);
    if (!previous) return undefined;
    const yesterday=getGameDay(gameState.gameTime)-getGameDay(new Date(previous.date))===1;
    return (yesterday?'Yesterday, when':'When')+' you asked '+(original==='household_family'?'about my family':'who I was')+', I told you: “'+previous.summary+'”';
  }
  if (topicId === 'household_work_recall') {
    if (resident.knowledgeProfile?.topicOverrides?.household_work || npc?.knowledgeProfile?.topicOverrides?.household_work) return undefined;
    const previous=latestSpokenWorkReply(gameState,resident.id);
    if (!previous) return undefined;
    const yesterday=getGameDay(gameState.gameTime)-getGameDay(new Date(previous.date))===1;
    return `${yesterday ? 'Yesterday, when' : 'When'} you asked about work, I told you: “${previous.summary}”`;
  }
  if (topicId === 'household_work') {
    const work = resolveHouseholdWorkReport(gameState,resident);
    if (!work) return undefined;
    const {business,report}=work;
    const trading = report.profit < -0.005 ? "The latest day's takings didn't cover costs."
      : report.profit > 0.005 ? "The latest day's takings covered costs, with something left over."
      : "The latest day's takings just covered costs.";
    // These concerns come from the report, not seeded metrics or stereotypes.
    // They name no culprit, location, hardship, reward or unoffered quest.
    const concerns = [
      report.supplyIssues?.length ? 'There are problems with deliveries to sort out.' : '',
      report.competitorActions?.length ? 'Competition has been making trade harder.' : '',
      report.staffIssues?.length ? 'There are problems with staffing to sort out.' : '',
    ].filter(Boolean);
    return [`I run ${business.name.trim()}.`,trading,...concerns].join(' ');
  }
  if (topicId === 'household_news') return resolveNpcRecentLifeReply(gameState,resident.id);
  if (topicId === 'household_trouble') {
    // A resident who dislikes the player does not ask them for help.
    const stance=npcGreetingStance(gameState,resident.id).stance;
    return stance==='cold'||stance==='shuns' ? undefined : resolveResidentTrouble(gameState,resident.id)?.text;
  }
  if (topicId === 'household_help') {
    const quest=activeHelpQuest(gameState,resident.id);
    return quest && gameState.gold >= helpQuestGold(quest)
      ? 'Thank you. I will not forget this.' : undefined;
  }
  if (topicId === 'household_meeting') {
    if (session.contactStatus === 'first-meeting') return "We're meeting for the first time.";
    const direct = gameState.npcMemory?.[resident.id]?.knownFacts?.some(f => f.source === 'direct' && f.factKey === 'player_met_npc');
    return direct || latestSpokenDialogueReplies(gameState,resident.id,1).length>0
      ? "Yes, we've met before." : "I don't remember meeting you before.";
  }
  return undefined;
}

/**
 * Filters the list of all potential topics to find valid ones for the current context.
 */
export function getAvailableTopics(
  gameState: GameState,
  npcId: string,
  session: DialogueSession,
  npc?: NPC // Added NPC parameter for knowledge checks
): ConversationTopic[] {
  // Start with static registry topics
  const availableTopics = Object.values(TOPIC_REGISTRY);

  // Merge dynamic topics WITHOUT polluting registry
  if (npc) {
      const rumorTopics = getDynamicRumorTopics(gameState, npc);
      availableTopics.push(...rumorTopics);
      const personal=HOUSEHOLD_TOPICS.filter(topic => resolveHouseholdPersonalReply(gameState, session, topic.id, npc) !== undefined);
      // The reached book and this person's real career lead this encounter.
      // Keep ordinary introductions, rumors and prior recall in their old order.
      const institution=(topic:ConversationTopic)=>topic.id==='household_temple'||topic.id==='household_office_history'||topic.id==='household_public_history';
      availableTopics.unshift(...personal.filter(institution));
      availableTopics.push(...personal.filter(topic=>!institution(topic)));
  }

  // Get current disposition
  const memory = gameState.npcMemory[npcId];
  const disposition = memory ? memory.disposition : 0;

  return availableTopics.filter(topic => {
    if (topic.id === 'global_trade' && !canOfferTrade(gameState, npcId, npc)) return false;

    // 1. One-time check
    if (topic.isOneTime && session.discussedTopicIds.includes(topic.id)) {
      return false;
    }

    // 2. Player prerequisites (Can the player ask?)
    if (!checkTopicPrerequisites(topic, gameState, npcId)) {
      return false;
    }

    // 3. NPC Knowledge check (Can the NPC answer?)
    if (npc) {
        // A retained account can be raised in this local conversation. The
        // prompt still requires uncertainty; visibility is not corroboration.
        if (HOUSEHOLD_TOPICS.some(personal => personal.id === topic.id)) return true;
        if (topic.id.startsWith('rumor_')) {
            return true;
        }

        if (!canNPCDiscuss(topic, npc, disposition)) {
            return false;
        }
    }

    return true;
  });
}

export interface ProcessTopicResult {
  status: 'success' | 'failure' | 'neutral';
  responsePrompt: string;
  unlocks: string[];
  dispositionChange?: number;
  xpReward?: number;
  lockTopic?: boolean;
  deductions?: TopicCost[];
  /** Hand off to the existing shop action; this is not generated NPC speech.
   * The hook re-resolves ownership and execution still checks attendance. */
  openMerchant?: { npcId: string; businessId: string; initialTab?: 'gossip' };
  /** Explicit factual topic, not a fallback after generation fails. */
  directReply?: { npcId: string; text: string; dialogue?: NpcDialoguePublication };
  /** A resident's help request, offered through the existing OFFER_QUEST action. */
  offerQuest?: Quest;
  /** Pay an accepted help request (HELP_TOWNSFOLK). The reducer re-checks it. */
  helpTownsfolk?: { npcId: string; questId: string };
}

/**
 * Handles the outcome of selecting a topic.
 * Performs skill checks if present.
 *
 * @param topicId The ID of the selected topic
 * @param gameState Current game state
 * @param session Active dialogue session
 * @param skillModifier (Optional) The player's bonus for the skill being checked (e.g. +5 for Persuasion)
 */
export function processTopicSelection(
  topicId: string,
  gameState: GameState,
  session: DialogueSession,
  skillModifier: number = 0,
  npc?: NPC // Added NPC for dynamic DC adjustments
): ProcessTopicResult {
  let topic: ConversationTopic | undefined = TOPIC_REGISTRY[topicId];

  if (!topic && HOUSEHOLD_TOPICS.some(personal => personal.id === topicId)) {
    if (resolveHouseholdPersonalReply(gameState, session, topicId, npc) === undefined) {
      throw new Error('This personal subject is no longer available.');
    }
    topic = HOUSEHOLD_TOPICS.find(personal => personal.id === topicId);
  }

  // Dynamic Topic Lookup (if not in registry)
  if (!topic && topicId.startsWith('rumor_')) {
      // Revalidate a stale click against the same player knowledge, speaker,
      // location and expiry rules that produced the visible choice. Do this
      // before recording the topic or applying any costs/outcomes.
      const speaker = npc ?? gameState.generatedNpcs?.[session.npcId];
      if (speaker?.id === session.npcId) {
          topic = getDynamicRumorTopics(gameState, speaker).find(candidate => candidate.id === topicId);
      }
      if (!topic) throw new Error('This account is not available for this conversation.');
  }

  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  // Recheck stale or direct trade selections before recording a choice or cost.
  if (topic.id === 'global_trade' && !canOfferTrade(gameState, session.npcId, npc)) {
    throw new Error('This resident has no wares to offer.');
  }

  // Verify costs first
  if (!canAffordTopic(topic, gameState)) {
    return {
      status: 'failure',
      responsePrompt: "You cannot afford to do that.",
      unlocks: [],
      lockTopic: false
    };
  }

  session.discussedTopicIds.push(topicId);

  // Calculate Dynamic DC based on Willingness
  let dcModifier = 0;
  if (npc && npc.knowledgeProfile && npc.knowledgeProfile.topicOverrides[topicId]) {
      // If the NPC is unwilling (negative modifier), the DC should be HIGHER.
      // Willingness Modifier: +10 means they are MORE willing.
      // So DC should DECREASE by the modifier.
      // Or, logic: Disposition + Openness + Mod < Threshold -> Harder.

      // Let's simply subtract the willingness modifier from the DC (or add to the roll).
      // If willingnessMod is -5 (reluctant), we ADD 5 to DC? Or subtract -5 from roll?
      // Simpler: Effective DC = Base DC - WillingnessModifier.
      const mod = npc.knowledgeProfile.topicOverrides[topicId].willingnessModifier || 0;
      dcModifier = -mod;
  }

  // Prepare deductions (if any)
  const deductions = topic.costs;

  // Handle Skill Check
  if (topic.skillCheck) {
    const roll = rollDice('1d20');
    const total = roll + skillModifier;
    const finalDC = topic.skillCheck.dc + dcModifier;

    if (total >= finalDC) {
      // Success
      return {
        status: 'success',
        responsePrompt: topic.playerPrompt,
        unlocks: [...(topic.unlocksTopics || []), ...topic.skillCheck.successUnlocks],
        xpReward: topic.skillCheck.xpReward,
        deductions
      };
    } else {
      // Failure
      const consequence = topic.skillCheck.failureConsequence;
      return {
        status: 'failure',
        responsePrompt: consequence?.response || topic.playerPrompt, // Fallback to standard prompt if no specific failure text
        unlocks: [], // Usually failure doesn't unlock, or unlocks different things
        dispositionChange: consequence?.dispositionChange,
        lockTopic: consequence?.lockTopic,
        // Typically you don't pay if you fail a skill check? Or do you?
        // E.g. "Bribe Guard" -> Roll Persuasion.
        // If fail: Guard takes money and says no? Or Guard refuses money?
        // In D&D, a failed bribe usually means they don't take it and get mad, or take it and arrest you.
        // For simplicity, let's assume costs are paid ONLY on success for 'trade', but 'bribe' is tricky.
        // If it's a Transaction (Trade), you pay and get.
        // If it's a Bribe (Persuasion), the cost is usually part of the attempt.
        // Let's assume you PAY regardless if the topic is "selected" and it has a cost.
        // But if it's a 'failure', maybe we handle it differently?
        // Let's default to: Deductions happen if 'deductions' is returned.
        // For now, I'll return deductions on failure too, assuming "You tried".
        // BUT, if it's a Shop transaction, failure shouldn't happen via dice usually.
        // If it's a Bribe, failure implies loss of gold.
        deductions
      };
    }
  }

  // Real storefronts use the existing stock/attendance action, never prose
  // that pretends to sell goods. Other authored/legacy topics retain speech.
  const speaker = npc ?? gameState.generatedNpcs?.[session.npcId];
  // A tavern's ordinary inquiry opens its posted information offers. Opening
  // reveals no paid account and creates no invented spoken reply. Authored
  // answers and non-tavern conversation retain their existing voice path.
  const rumorInquiry = topicId === 'global_rumors' && speaker?.id === session.npcId
    && !speaker.knowledgeProfile?.topicOverrides?.[topicId];
  const candidate = topicId === 'global_trade' || rumorInquiry
    ? resolveDialogueStorefront(gameState, session.npcId) : undefined;
  const storefront = topicId === 'global_trade' || candidate?.businessType === 'tavern'
    ? candidate : undefined;

  // Standard (Neutral) Outcome
  const unlocks = topic.unlocksTopics || [];
  const directText=resolveHouseholdPersonalReply(gameState,session,topicId,npc);
  const speakerKey=directText && topicId==='household_work' ? npcDialogueSpeakerKey(gameState,session.npcId) : undefined;
  const work=speakerKey ? resolveHouseholdWorkReport(gameState,gameState.generatedNpcs[session.npcId]) : undefined;
  let dialogue: NpcDialoguePublication|undefined=work && speakerKey ? {topicId:'household_work',speakerKey,source:{kind:'business-report',businessId:work.business.id,day:work.report.day,revenue:work.report.revenue,costs:work.report.costs,profit:work.report.profit,supplyIssues:[...(work.report.supplyIssues??[])],competitorActions:[...(work.report.competitorActions??[])],staffIssues:[...(work.report.staffIssues??[])]}} : undefined;
  if (directText && (topicId==='global_who_are_you' || topicId==='household_family')) {
    const personal=resolveNpcPersonalStatement(gameState,session.npcId,topicId);
    const personalKey=npcDialogueSpeakerKey(gameState,session.npcId);
    if (personalKey && personal?.snapshot && personal.text===directText) dialogue={topicId,speakerKey:personalKey,source:{kind:'household-personal',snapshot:personal.snapshot}};
  }
  if (directText && (topicId==='household_temple'||topicId==='household_office_history'||topicId==='household_public_history')) {
    const statement=resolveNpcInstitutionStatement(gameState,session.npcId,topicId);
    const key=npcDialogueSpeakerKey(gameState,session.npcId);
    if (key && statement?.text===directText) dialogue={topicId,speakerKey:key,source:{kind:'institution-statement',snapshot:statement.snapshot}};
  }
  return {
    status: 'neutral',
    responsePrompt: topic.playerPrompt,
    unlocks,
    deductions,
    ...(directText !== undefined ? {directReply: {npcId: session.npcId, text: directText,...(dialogue ? {dialogue} : {})}} : {}),
    ...(storefront ? { openMerchant: { npcId: session.npcId, businessId: storefront.id, ...(rumorInquiry ? {initialTab: 'gossip' as const} : {}) } } : {}),
    ...(directText !== undefined && topicId==='household_trouble' ? (() => { const trouble=resolveResidentTrouble(gameState,session.npcId); return trouble ? {offerQuest: trouble.quest} : {}; })() : {}),
    ...(directText !== undefined && topicId==='household_help' ? (() => { const quest=activeHelpQuest(gameState,session.npcId); return quest ? {helpTownsfolk: {npcId: session.npcId, questId: quest.id}} : {}; })() : {}),
  };
}

/**
 * Serializes an NPC's knowledge profile into a prompt fragment for the AI
 * dialogue path (`useDialogueSystem.generateResponse`), so the model answers
 * with the same knowledge the deterministic topic path already enforces.
 *
 * Three buckets, by design:
 *  - KNOWN AND OPEN   (`known: true`, willingnessModifier >= 0): the label and the
 *    authored `customResponse` are both sent — this is what the NPC may say.
 *  - KNOWN BUT GUARDED (`known: true`, willingnessModifier < 0): only the label is
 *    sent, with an instruction to deflect. The `customResponse` is the secret and
 *    is NEVER serialized, so the model cannot leak it.
 *  - UNKNOWN          (`known: false`): only the label is sent, as something the
 *    NPC has never heard of.
 *
 * Returns '' for a missing profile so the caller can concatenate unconditionally.
 */
export function describeKnowledgeProfile(
  profile?: NPCKnowledgeProfile | null,
  topics: ConversationTopic[] = INITIAL_TOPICS
): string {
  if (!profile) return '';

  const labelFor = (topicId: string): string =>
    topics.find((t) => t.id === topicId)?.label ?? topicId;

  const open: string[] = [];
  const guarded: string[] = [];
  const unknown: string[] = [];

  for (const [topicId, override] of Object.entries(profile.topicOverrides ?? {})) {
    const label = labelFor(topicId);
    if (!override.known) {
      unknown.push(label);
      continue;
    }
    if ((override.willingnessModifier ?? 0) < 0) {
      // Guarded: the authored customResponse stays out of the prompt.
      guarded.push(label);
      continue;
    }
    open.push(override.customResponse ? `${label}: ${override.customResponse}` : label);
  }

  const parts: string[] = [
    `Your openness to strangers is ${profile.baseOpenness} out of 100.`,
  ];
  if (open.length > 0) {
    parts.push(`You know about and will freely discuss: ${open.join('; ')}.`);
  }
  if (guarded.length > 0) {
    parts.push(
      `You know about but guard these subjects: ${guarded.join('; ')}. Deflect if asked; never volunteer what you know.`
    );
  }
  if (unknown.length > 0) {
    parts.push(`You know nothing about: ${unknown.join('; ')}. Say so plainly if asked.`);
  }

  return parts.join(' ');
}

/**
 * Upper bound on how many witness recall lines reach a prompt.
 *
 * Three is the same cap `buildWitnessDialogueContext` defaults to. More than
 * that and the recall block starts to outweigh the NPC's own personality prompt,
 * which is the thing that actually decides how the line sounds.
 */
export const MAX_WITNESS_RECALL_LINES = 3;

/**
 * Serializes what an NPC personally saw or heard the player do into a prompt
 * fragment, the witness-memory twin of {@link describeKnowledgeProfile}
 * (agora-f58b).
 *
 * `src/systems/social/npcWitnessMemory.ts` already records observations into
 * `GameState.npcMemory` through the `RECORD_NPC_WITNESSED_ACT` reducer, and
 * already renders them as first-person recall lines ("I saw you cut down 3
 * guards.", "I heard you spared a surrendering foe."). What was missing was a
 * dialogue-side reader. This is it: the strongest-belief lines, decayed to the
 * current game day, wrapped in an instruction that forbids the model from
 * inventing memories the NPC does not hold.
 *
 * Returns '' when the NPC remembers nothing, so the caller can concatenate
 * unconditionally exactly as it does with the knowledge profile.
 */
export function describeWitnessRecall(
  memory: NpcMemory | undefined | null,
  gameDay: number,
  max: number = MAX_WITNESS_RECALL_LINES
): string {
  if (!memory) return '';

  const recall = buildWitnessDialogueContext(memory, gameDay, max);
  if (recall.length === 0) return '';

  return `You personally remember this about them: ${recall.join(' ')} Speak as someone who holds those memories, and never claim to remember anything else about them.`;
}

/**
 * Composes every prompt fragment this service owns for one NPC in one call, in a
 * fixed order: guarded knowledge, supplied identity, direct contact, then what
 * they have seen the player do.
 *
 * The order is deliberate. The knowledge profile sets the NPC's subject-matter
 * boundaries; the witness recall is evidence about the player specifically. A
 * model that reads the boundary first is less likely to answer a guarded topic
 * just because the recall block made the player feel familiar.
 *
 * This is the seam the AI dialogue path (`useDialogueSystem.generateResponse`,
 * outside this module) should call instead of assembling the fragments itself.
 */
export function buildNpcDialoguePromptContext(
  gameState: GameState,
  npcId: string,
  npc?: NPC
): string {
  const knowledge = describeKnowledgeProfile(npc?.knowledgeProfile);
  const recall = describeWitnessRecall(
    gameState.npcMemory[npcId],
    getGameDay(gameState.gameTime)
  );
  // Knowing a job does not supply a workplace name. Use the existing owner
  // records for names only; legacy business types do not rewrite anyone's job.
  const names = npc?.id === npcId ? [...new Set(Object.values(gameState.worldBusinesses ?? {})
    .filter(business => business.ownerId === npcId && typeof business.name === 'string' && business.name.trim())
    .map(business => business.name.trim()))] : [];
  const identity = npc?.id === npcId ? [
    names.length ? `Your registered business names: ${names.map(name => JSON.stringify(name)).join(', ')}.` : '',
    'Use only names supplied in your character context or records. Do not invent names for businesses, places or people; if a name is missing, leave it unnamed.',
  ].filter(Boolean).join(' ') : '';

  // A saved direct first-contact fact was previously visible in greetings but
  // absent from this AI prompt. Preserve its provenance and the pre-contact
  // session snapshot so a newly recorded first visit cannot become a reunion.
  const meeting = gameState.npcMemory[npcId]?.knownFacts?.find(fact => fact.source === 'direct' && fact.factKey === 'player_met_npc');
  const contactStatus = gameState.activeDialogueSession?.npcId === npcId ? gameState.activeDialogueSession.contactStatus : undefined;
  const contact = meeting ? [
    contactStatus === 'first-meeting' ? 'This is your first conversation; do not claim an earlier visit.'
      : contactStatus === 'returning' ? 'You have previously met this person.' : '',
    `Direct contact record: ${meeting.text} Do not invent other shared history.`,
  ].filter(Boolean).join(' ') : '';
  // Quoted dialogue recalls what was said, not proof that those claims were true.
  // Retain only three recent exchanges so old speech cannot bury today's facts.
  const spoken=latestSpokenDialogueReplies(gameState,npcId).map(record=>{
    const topic=HOUSEHOLD_TOPICS.find(candidate=>candidate.id===record.dialogue?.topicId)??TOPIC_REGISTRY[record.dialogue?.topicId??''];
    const input=record.dialogue?.source.kind==='generated-exchange'?record.dialogue.source.playerPrompt:topic?.playerPrompt;
    return 'At '+new Date(record.date).toISOString()+', the conversation input was '+JSON.stringify(input??'a prior conversation')
      +' and you replied '+JSON.stringify(record.summary)+'.';
  });
  const conversation=spoken.length ? 'Your recorded conversations: '+spoken.join(' ')
    +' These are words exchanged, not independent evidence or permission. Do not turn questions or unsupported past claims into world facts.' : '';
  return [knowledge, identity, contact, recall, conversation].filter(Boolean).join(' ');
}
