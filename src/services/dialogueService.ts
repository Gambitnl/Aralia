/**
 * @file src/services/dialogueService.ts
 * Service for managing dialogue topics, checking prerequisites, and handling conversation flow.
 */

import {
  ConversationTopic,
  TopicPrerequisite,
  DialogueSession,
  NPCKnowledgeProfile
} from '../types/dialogue';
import { GameState, QuestStatus, Item, NPC } from '../types/index';
import { rollDice } from '../utils/combatUtils';

// In a real implementation, this would likely load from a data file
const TOPIC_REGISTRY: Record<string, ConversationTopic> = {};

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
      case 'relationship':
        const memory = gameState.npcMemory[npcId];
        const disposition = memory ? memory.disposition : 0;
        met = disposition >= (Number(prereq.value) || 0);
        break;

      case 'topic_known':
        met = gameState.discoveryLog.some(entry =>
           entry.flags.some(f => f.key === 'topic_unlocked' && f.value === prereq.targetId)
        );
        break;

      case 'quest_status':
        const quest = gameState.questLog.find(q => q.id === prereq.targetId);
        const requiredStatus = prereq.value as QuestStatus;
        if (!quest) {
            met = false;
        } else {
            met = quest.status === requiredStatus;
        }
        break;

      case 'item_owned':
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

      case 'min_gold':
        const requiredGold = Number(prereq.value) || 0;
        met = gameState.gold >= requiredGold;
        break;

      case 'faction_standing':
        met = true; // Placeholder
        break;
    }

    return prereq.negate ? !met : met;
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
  disposition: number
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

  const { topicOverrides, baseOpenness } = npc.knowledgeProfile;

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

/**
 * Filters the list of all potential topics to find valid ones for the current context.
 */
export function getAvailableTopics(
  gameState: GameState,
  npcId: string,
  session: DialogueSession,
  npc?: NPC // Added NPC parameter for knowledge checks
): ConversationTopic[] {
  const allTopics = Object.values(TOPIC_REGISTRY);

  // Get current disposition
  const memory = gameState.npcMemory[npcId];
  const disposition = memory ? memory.disposition : 0;

  return allTopics.filter(topic => {
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
  const topic = TOPIC_REGISTRY[topicId];
  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  session.discussedTopicIds.push(topicId);

  // TODO(Recorder): Record this interaction in gameState.npcMemory[npcId].interactions
  // We need to:
  // 1. Get the current memory for this NPC
  // 2. Create a new Interaction object { date: now, type: 'dialogue', summary: topic.playerPrompt, ... }
  // 3. Append to interactions array
  // 4. Update discussedTopics map with timestamp
  // This logic should probably be in a helper in npcService or dialogueService called 'recordInteraction'.

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
        xpReward: topic.skillCheck.xpReward
      };
    } else {
      // Failure
      const consequence = topic.skillCheck.failureConsequence;
      return {
        status: 'failure',
        responsePrompt: consequence?.response || topic.playerPrompt, // Fallback to standard prompt if no specific failure text
        unlocks: [], // Usually failure doesn't unlock, or unlocks different things
        dispositionChange: consequence?.dispositionChange,
        lockTopic: consequence?.lockTopic
      };
    }
  }

  // Standard (Neutral) Outcome
  const unlocks = topic.unlocksTopics || [];
  // TODO(Bard): Use `responsePrompt` to generate full flavor text via Gemini, integrating `npc.knowledgeProfile.customResponse` if available.
  return {
    status: 'neutral',
    responsePrompt: topic.playerPrompt,
    unlocks
  };
}
