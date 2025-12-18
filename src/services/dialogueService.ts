/**
 * @file src/services/dialogueService.ts
 * Service for managing dialogue topics, checking prerequisites, and handling conversation flow.
 */

import {
  ConversationTopic,
  TopicPrerequisite,
  DialogueSession
} from '../types/dialogue';
import { GameState, QuestStatus, Item } from '../types/index';
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
 * Filters the list of all potential topics to find valid ones for the current context.
 */
export function getAvailableTopics(
  gameState: GameState,
  npcId: string,
  session: DialogueSession
): ConversationTopic[] {
  const allTopics = Object.values(TOPIC_REGISTRY);

  return allTopics.filter(topic => {
    if (topic.isOneTime && session.discussedTopicIds.includes(topic.id)) {
      return false;
    }
    return checkTopicPrerequisites(topic, gameState, npcId);
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
  skillModifier: number = 0
): ProcessTopicResult {
  const topic = TOPIC_REGISTRY[topicId];
  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  session.discussedTopicIds.push(topicId);

  // Handle Skill Check
  if (topic.skillCheck) {
    const roll = rollDice('1d20');
    const total = roll + skillModifier;

    if (total >= topic.skillCheck.dc) {
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
  return {
    status: 'neutral',
    responsePrompt: topic.playerPrompt,
    unlocks
  };
}
