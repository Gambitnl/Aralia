/**
 * @file src/types/memory.ts
 * Type definitions for NPC memory and social knowledge.
 *
 * This module defines how NPCs track past interactions, learn facts about the player,
 * and evolve their attitude over time.
 */

/**
 * Represents a specific date/time in the game world.
 * We use a number (timestamp) for simple serialization and comparison.
 */
export type GameDate = number;

/**
 * The type of interaction that occurred.
 * Distinct from TownInteractionType which is about UI actions.
 * These are the categories stored in memory.
 */
export type MemoryInteractionType =
  | 'dialogue'
  | 'trade'
  | 'combat'
  | 'gift'
  | 'theft'
  | 'quest_given'
  | 'quest_complete'
  | 'insult'
  | 'aid';

/**
 * A record of a single past interaction between an NPC and a player.
 */
export interface Interaction {
  /** When the interaction occurred */
  date: GameDate;
  /** The nature of the interaction */
  type: MemoryInteractionType;
  /** A brief summary of what happened (e.g., "Sold 50 healing potions", "Insulted their mother") */
  summary: string;
  /** How much the NPC's attitude changed as a result of this interaction */
  attitudeChange: number;
}

// --- Core State Enums & Types (Migrated from index.ts) ---

export enum SuspicionLevel {
  Unaware,
  Suspicious,
  Alert,
}

export enum GoalStatus {
  Unknown = 'Unknown',
  Active = 'Active',
  Completed = 'Completed',
  Failed = 'Failed',
}

export interface Goal {
  id: string;
  description: string;
  status: GoalStatus;
}

export interface GoalUpdatePayload {
  npcId: string;
  goalId: string;
  newStatus: GoalStatus;
}

/**
 * A specific piece of information an NPC knows about the player or world.
 * Includes mechanics for fading memory (lifespan) and confidence (strength).
 */
export interface KnownFact {
  id: string;
  text: string;
  source: 'direct' | 'gossip';
  sourceNpcId?: string;
  isPublic: boolean;
  timestamp: number;
  strength: number;
  lifespan: number;
  sourceDiscoveryId?: string;
}

/**
 * Tracks what an NPC remembers about interactions.
 * Used by the dialogue and AI systems to maintain coherent conversations and relationships.
 *
 * Unified interface combining legacy state with narrative history.
 */
export interface NPCMemory {
  /**
   * Overall attitude toward the player.
   * Range: -100 (Hostile/Nemesis) to 100 (Devoted/Ally).
   * 0 is Neutral.
   */
  disposition: number;

  /**
   * Current level of suspicion towards the player.
   */
  suspicion: SuspicionLevel;

  /**
   * Facts the NPC has learned about the player or world.
   */
  knownFacts: KnownFact[];

  /**
   * NPC's personal goals and their status.
   */
  goals: Goal[];

  /**
   * Chronological list of past interactions with this NPC.
   * Newest interactions should be appended to the end.
   */
  interactions: Interaction[];

  /**
   * Topics the NPC has already discussed to avoid repetitive dialogue.
   * Keys are topic IDs, values are the timestamp when discussed.
   */
  discussedTopics: Record<string, number>;

  /**
   * When the NPC last interacted with the player.
   * Used to determine greeting familiarity or "long time no see" dialogue.
   */
  lastInteractionTimestamp?: number;
}
