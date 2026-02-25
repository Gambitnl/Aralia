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
export type MemoryInteractionType = 'dialogue' | 'trade' | 'combat' | 'gift' | 'theft' | 'quest_given' | 'quest_complete' | 'insult' | 'aid' | 'observation';
/**
 * Importance level for memory retention.
 */
export declare enum MemoryImportance {
    Trivial = 0,// Forgotten after a day
    Minor = 1,// Forgotten after a week
    Standard = 3,// Forgotten after a month
    Major = 5,// Retained for a year
    Critical = 10
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
 * A specific piece of information an NPC knows about the player.
 */
export interface Fact {
    /** Unique identifier for the fact (e.g., "player_is_dragonborn", "player_killed_king") */
    id: string;
    /** When the NPC learned this fact */
    dateLearned: GameDate;
    /** How confident the NPC is in this fact (0.0 to 1.0) */
    confidence: number;
    /** Importance score determining retention (0-10) */
    significance: number;
    /** When this fact becomes irrelevant (optional) */
    expirationDate?: GameDate;
    /** The source of the information (e.g., "witnessed", "gossip", "told_by_player") */
    source: 'witnessed' | 'gossip' | 'told_by_player' | 'inference';
}
/**
 * Tracks what an NPC remembers about interactions.
 * Used by the dialogue and AI systems to maintain coherent conversations and relationships.
 */
export interface NPCMemory {
    /**
     * Chronological list of past interactions with this NPC.
     * Newest interactions should be appended to the end.
     */
    interactions: Interaction[];
    /**
     * Facts the NPC has learned about the player or world.
     */
    knownFacts: Fact[];
    /**
     * Overall attitude toward the player.
     * Range: -100 (Hostile/Nemesis) to 100 (Devoted/Ally).
     * 0 is Neutral.
     */
    attitude: number;
    /**
     * When the NPC last interacted with the player.
     * Used to determine greeting familiarity or "long time no see" dialogue.
     */
    lastInteractionDate: GameDate;
    /**
     * Topics the NPC has already discussed to avoid repetitive dialogue.
     * Keys are topic IDs, values are the timestamp when discussed.
     */
    discussedTopics: Record<string, GameDate>;
}
