/**
 * @file src/types/dialogue.ts
 * Defines the types for the structured dialogue and conversation system.
 * This system allows for topic-based conversations, knowledge tracking, and social skill checks.
 */

import { Skill } from './core';

export type TopicCategory = 'rumor' | 'personal' | 'quest' | 'lore' | 'trade' | 'intimidate' | 'flirt';

export interface TopicPrerequisite {
  type: 'topic_known' | 'relationship' | 'quest_status' | 'item_owned' | 'faction_standing' | 'min_gold';
  /** The ID of the topic, quest, item, or faction needed. (Ignored for min_gold) */
  targetId?: string;
  /**
   * For relationships: minimum disposition value.
   * For quests: required status (e.g., 'Completed').
   * For items: quantity (default 1).
   * For faction standing: minimum rank/value.
   * For min_gold: amount of gold.
   */
  value?: string | number;
  /** If true, the condition is inverted (e.g., must NOT know topic) */
  negate?: boolean;
}

export interface FailureResult {
  /** Text to display on failure */
  response: string;
  /** Disposition change on failure */
  dispositionChange?: number;
  /** If the topic becomes permanently locked for this interaction/forever */
  lockTopic?: boolean;
}

export interface SocialSkillCheck {
  skill: Skill;
  dc: number;
  /** IDs of topics unlocked on success */
  successUnlocks: string[];
  /** Consequence of failure */
  failureConsequence?: FailureResult;
  /** Experience awarded on success */
  xpReward?: number;
}

export interface ConversationTopic {
  id: string;
  /** Display name of the topic (e.g., "Ask about the ruins") */
  label: string;
  category: TopicCategory;
  /** Text prompt to send to the AI or display as player dialogue */
  playerPrompt: string;
  /** Requirements to see/select this topic */
  prerequisites?: TopicPrerequisite[];
  /** IDs of topics this topic unlocks immediately when discussed */
  unlocksTopics?: string[];
  /** Optional skill check required to succeed in this topic */
  skillCheck?: SocialSkillCheck;
  /** If true, this topic is removed after being discussed once */
  isOneTime?: boolean;
  /** If true, this topic is available to all NPCs by default (e.g. "Who are you?") */
  isGlobal?: boolean;
}

/**
 * Tracks what an individual NPC knows and is willing to discuss.
 */
export interface NPCKnowledgeProfile {
  /** Map of TopicID -> Willingness/Specific Knowledge overrides */
  topicOverrides: Record<string, {
    known: boolean;
    willingnessModifier?: number; // Adjusts base disposition check
    customResponse?: string; // Static response override
  }>;
  /** Base openness of the NPC (0-100) */
  baseOpenness: number;
}

/**
 * Represents the state of a dialogue session.
 */
export interface DialogueSession {
  npcId: string;
  /** Topics currently available to choose from */
  availableTopicIds: string[];
  /** Topics already discussed in this session */
  discussedTopicIds: string[];
  /** Current 'mood' or temporary disposition modifier for this session */
  sessionDispositionMod: number;
}
