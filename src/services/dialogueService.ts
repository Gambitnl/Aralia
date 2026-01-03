/**
 * @file src/services/dialogueService.ts
 * Service for managing dialogue topics, checking prerequisites, and handling conversation flow.
 */

import {
  ConversationTopic,
  DialogueSession,
  TopicCost
} from '../types/dialogue';
import { GameState, QuestStatus, Item, NPC, WorldRumor } from '../types/index';
import { rollDice } from '../utils/combatUtils';
import { INITIAL_TOPICS } from '../data/dialogue/topics';
import { getGameDay } from '../utils/timeUtils';

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
        met = gameState.discoveryLog.some(entry =>
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

function convertRumorToTopic(rumor: WorldRumor): ConversationTopic {
  return {
    id: `rumor_${rumor.id}`,
    label: `Hear anything about ${rumor.text.substring(0, 20)}...?`, // Shorten for label
    category: 'rumor',
    playerPrompt: `I heard whispers about ${rumor.text}. What do you know?`,
    // TODO(lint-preserve): If we want NPCs to parrot/expand the rumor automatically, thread this through an NPC response prompt.
    isGlobal: false, // It's generated specifically for this context
    isOneTime: false,
  };
}

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

  const relevantRumors = gameState.activeRumors.filter(rumor => {
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

  return relevantRumors.map(convertRumorToTopic);
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
  }

  // Get current disposition
  const memory = gameState.npcMemory[npcId];
  const disposition = memory ? memory.disposition : 0;

  return availableTopics.filter(topic => {
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
        // Special case for dynamic rumors: If we generated it for this NPC, they can discuss it!
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
  let topic = TOPIC_REGISTRY[topicId];

  // Dynamic Topic Lookup (if not in registry)
  if (!topic && topicId.startsWith('rumor_')) {
      // Try to find the rumor in active rumors
      const rumorId = topicId.replace('rumor_', '');
      const rumor = gameState.activeRumors?.find(r => r.id === rumorId);
      if (rumor) {
          topic = convertRumorToTopic(rumor);
      }
  }

  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
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

  // Standard (Neutral) Outcome
  const unlocks = topic.unlocksTopics || [];
  return {
    status: 'neutral',
    responsePrompt: topic.playerPrompt,
    unlocks,
    deductions
  };
}

// TODO(Dialogist): Integrate with AI service to generate dynamic responses based on NPC Knowledge Profile.
