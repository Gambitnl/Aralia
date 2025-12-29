/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/memory/MemorySystem.ts
 * System for managing NPC memories, facts, and attitude changes.
 */

// TODO(Vector): Wire up Spell/Combat systems to call MemorySystem.recordInteraction when spells like Charm Person end.

import { NPC } from '../../types/creatures';
import {
  Interaction,
  Fact,
  NPCMemory,
  MemoryInteractionType,
  GameDate,
  MemoryImportance
} from '../../types/memory';

/**
 * Manages the addition and retrieval of memories for NPCs.
 * This system is pure (stateless) and operates on NPC objects.
 */
export class MemorySystem {

  /**
   * Records a new interaction in the NPC's memory and updates their attitude.
   *
   * @param npc The NPC who is remembering the interaction
   * @param interaction Data about the interaction (id and date generated if missing)
   * @param currentDate Current game date/time
   * @returns Updated NPC object
   */
  static recordInteraction(
    npc: NPC,
    interaction: Partial<Interaction> & { type: MemoryInteractionType, summary: string, attitudeChange: number, significance: number },
    currentDate: GameDate
  ): NPC {
    const memory = npc.memory || MemorySystem.createEmptyMemory(currentDate);

    const newInteraction: Interaction = {
      id: interaction.id || crypto.randomUUID(),
      date: interaction.date || currentDate,
      type: interaction.type,
      summary: interaction.summary,
      attitudeChange: interaction.attitudeChange,
      significance: interaction.significance,
      witnesses: interaction.witnesses || [],
      emotion: interaction.emotion
    };

    // Update attitude
    const newAttitude = Math.max(-100, Math.min(100, memory.attitude + newInteraction.attitudeChange));

    // Append memory
    // In a real implementation, we might prune trivial memories here
    const updatedInteractions = [...memory.interactions, newInteraction];

    return {
      ...npc,
      memory: {
        ...memory,
        interactions: updatedInteractions,
        attitude: newAttitude,
        lastInteractionDate: currentDate
      }
    };
  }

  /**
   * Teaches the NPC a new fact about the world or player.
   *
   * @param npc The NPC
   * @param fact Data about the fact
   * @param currentDate Current game date
   * @returns Updated NPC object
   */
  static learnFact(
    npc: NPC,
    fact: Partial<Fact> & { id: string, confidence: number, significance: number, source: Fact['source'] },
    currentDate: GameDate
  ): NPC {
    const memory = npc.memory || MemorySystem.createEmptyMemory(currentDate);

    // Check if fact is already known
    const existingFactIndex = memory.knownFacts.findIndex(f => f.id === fact.id);
    let updatedFacts = [...memory.knownFacts];

    const newFact: Fact = {
      id: fact.id,
      dateLearned: fact.dateLearned || currentDate,
      confidence: fact.confidence,
      significance: fact.significance,
      source: fact.source,
      expirationDate: fact.expirationDate
    };

    if (existingFactIndex >= 0) {
      // Update existing fact if new one is more confident
      if (newFact.confidence >= updatedFacts[existingFactIndex].confidence) {
        updatedFacts[existingFactIndex] = newFact;
      }
    } else {
      updatedFacts.push(newFact);
    }

    return {
      ...npc,
      memory: {
        ...memory,
        knownFacts: updatedFacts
      }
    };
  }

  /**
   * Checks if an NPC remembers a specific type of interaction within a timeframe.
   */
  static hasRecentMemory(
    npc: NPC,
    type: MemoryInteractionType,
    sinceDate: GameDate
  ): boolean {
    if (!npc.memory) return false;
    return npc.memory.interactions.some(i => i.type === type && i.date >= sinceDate);
  }

  /**
   * Gets the NPC's current attitude towards the player.
   */
  static getAttitude(npc: NPC): number {
    return npc.memory ? npc.memory.attitude : 0;
  }

  /**
   * Creates an empty memory structure for a new NPC.
   */
  static createEmptyMemory(currentDate: GameDate): NPCMemory {
    return {
      interactions: [],
      knownFacts: [],
      attitude: 0,
      lastInteractionDate: currentDate,
      discussedTopics: {}
    };
  }
}
