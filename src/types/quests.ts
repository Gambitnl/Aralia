/**
 * @file src/types/quests.ts
 * Type definitions for the advanced Quest system.
 *
 * This module defines the structure for branching, multi-stage quests with
 * diverse objective types, prerequisites, and failure conditions.
 */

import type { Item } from './items';
import type { NPC } from './world';
import { QuestStatus } from './questEnums';

/**
 * The high-level category of a quest, used for UI filtering and prioritization.
 */
export type QuestType =
  | 'Main'      // Core narrative path
  | 'Side'      // Optional content
  | 'Guild'     // Faction-specific jobs
  | 'Dynamic'   // Procedurally generated events
  | 'Companion' // Character-specific arcs
  | 'Rumor';    // Unverified leads

export { QuestStatus };

/**
 * Defines the mechanical nature of a specific objective.
 * This allows the game engine to automatically track progress.
 */
export type QuestObjectiveType =
  | 'Kill'      // Defeat X enemies of type Y
  | 'Fetch'     // Obtain X items of type Y
  | 'Deliver'   // Give item X to NPC Y
  | 'Visit'     // Enter Location Y
  | 'Interact'  // Use object Y
  | 'Talk'      // Dialogue with NPC Y
  | 'Escort'    // Protect NPC Y until Location Z
  | 'Survive'   // Endure for X turns/minutes
  | 'Custom';   // Scripted/manual triggers

/**
 * A single task that must be completed to advance the quest.
 */
export interface QuestObjective {
  /** Unique identifier for this objective within the quest */
  id: string;
  /** Player-facing description (e.g., "Collect 5 Wolf Pelts") */
  description: string;
  /** The mechanical type of the objective */
  type: QuestObjectiveType;
  /** Current completion status */
  isCompleted: boolean;

  /**
   * ID of the target entity (Item ID, NPC ID, Monster ID, Location ID).
   * Context depends on `type`.
   */
  targetId?: string;

  /** For 'Kill', 'Fetch', etc. The number required to complete. */
  requiredCount?: number;
  /** Current progress towards the required count. */
  currentCount?: number;

  /** Whether this objective is optional (doesn't block stage progression). */
  isOptional?: boolean;
  /** Whether this objective is hidden until revealed. */
  isHidden?: boolean;
}

/**
 * A distinct phase of a quest. A quest may have multiple stages,
 * but typically only one is active at a time.
 */
export interface QuestStage {
  /** unique ID for the stage (e.g., "1_investigation", "2_confrontation") */
  id: string;
  /** Narrative description of the current situation */
  journalEntry: string;
  /** The set of objectives active during this stage */
  objectives: QuestObjective[];
  /**
   * IDs of the next stage(s) upon completion.
   * If empty, the quest is complete.
   * Multiple IDs imply branching paths based on choices.
   */
  nextStageIds?: string[];
}

/**
 * Conditions required before a quest becomes available to the player.
 */
export interface QuestPrerequisites {
  /** Minimum character level */
  level?: number;
  /** Specific quests that must be 'Completed' */
  completedQuestIds?: string[];
  /** Specific quests that must NOT be 'Completed' (mutually exclusive) */
  excludedQuestIds?: string[];
  /** Faction reputation requirements */
  factionReputation?: Array<{ factionId: string; minReputation: number }>;
  /** Required items in inventory (e.g., a map or key) */
  requiredItemIds?: string[];
}

/**
 * Rewards granted upon successful completion.
 */
export interface QuestReward {
  /** Experience points awarded */
  xp?: number;
  /** Gold currency awarded */
  gold?: number;
  /** IDs of items given */
  itemIds?: string[];
  /** Reputation changes (positive or negative) */
  reputation?: Array<{ factionId: string; change: number }>;
  /** Unlocks specific recipes, titles, or game features */
  unlocks?: string[];
  /** Follow-up quest to automatically trigger */
  nextQuestId?: string;
}

/**
 * Failure states and consequences.
 */
export interface QuestFailureCondition {
  /** The type of failure trigger */
  type: 'Deadline' | 'Death' | 'Action';
  /**
   * For deadlines: Game day timestamp.
   * For actions: Description of the forbidden act (e.g., "Attack the King").
   */
  triggerValue: number | string;
  /** Narrative reason shown to the player */
  description: string;
  /** Consequence: fail normally, or trigger a specific divergent stage? */
  consequence: 'Fail' | 'Branch';
  /** If branching, which stage ID to jump to (e.g., "failed_negotiation") */
  branchToStageId?: string;
}

/**
 * The complete definition of a Quest.
 */
export interface QuestDefinition {
  id: string;
  title: string;
  /** General description or briefing */
  description: string;
  /** NPC ID of the quest giver */
  giverId: string;
  /** The narrative category */
  type: QuestType;
  /** Current lifecycle status */
  status: QuestStatus;

  /**
   * The list of all possible stages in this quest.
   * Logic dictates which is active.
   */
  stages: Record<string, QuestStage>;

  /** ID of the currently active stage */
  currentStageId: string;

  /** Requirements to accept this quest */
  prerequisites?: QuestPrerequisites;
  /** Rewards for completion */
  rewards?: QuestReward;
  /** Conditions that cause failure */
  failureConditions?: QuestFailureCondition[];

  /** Timestamps */
  dateStarted?: number;
  dateCompleted?: number;

  /** Region hint for UI grouping */
  regionId?: string;
}
