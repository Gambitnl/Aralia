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
  | 'aid'
  | 'observation';

/**
 * Importance level for memory retention.
 */
export enum MemoryImportance {
  Trivial = 0,    // Forgotten after a day
  Minor = 1,      // Forgotten after a week
  Standard = 3,   // Forgotten after a month
  Major = 5,      // Retained for a year
  Critical = 10   // Never forgotten
}

/**
 * A record of a single past interaction between an NPC and a player.
 */
export interface Interaction {
  /** Unique ID for referencing this memory */
  id: string;
  /** When the interaction occurred */
  date: GameDate;
  /** The nature of the interaction */
  type: MemoryInteractionType;
  /** A brief summary of what happened (e.g., "Sold 50 healing potions", "Insulted their mother") */
  summary: string;
  /** How much the NPC's attitude changed as a result of this interaction */
  attitudeChange: number;
  /** Importance score determining retention (0-10) */
  significance: number;
  /** IDs of other entities who witnessed this event */
  witnesses?: string[];
  /** Emotional context associated with this memory */
  emotion?: 'joy' | 'anger' | 'fear' | 'sadness' | 'surprise' | 'trust' | 'disgust' | 'anticipation';
}

/**
 * The forked richer memory model (`NPCMemory`/`Fact`) has been merged onto the canonical live
 * `NpcMemory`/`KnownFact` in `./world`. `NPCMemory` is kept as an alias so the handful of
 * type-only importers (Gemini item prompts, the game-guide modal) keep resolving; new code should
 * import `NpcMemory` from `./world` directly. `Fact`'s contribution (semantic key, confidence,
 * significance, richer source labels) now lives on the optional fields of `KnownFact`.
 */
export type { NpcMemory as NPCMemory } from './world';
