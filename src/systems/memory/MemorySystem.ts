/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/memory/MemorySystem.ts
 * System for managing NPC memories, facts, and attitude changes.
 */

// TODO(Vector): Wire up Spell/Combat systems to call MemorySystem.recordInteraction when spells like Charm Person end.

import type { NPC } from '../../types';
import {
  Interaction,
  Fact,
  NPCMemory,
  MemoryInteractionType,
  GameDate,
  // TODO(lint-intent): 'MemoryImportance' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  MemoryImportance as _MemoryImportance
} from '../../types/memory';

/**
 * Manages the addition and retrieval of memories for NPCs.
 * This system is pure (stateless) and operates on NPC objects.
 */
export class MemorySystem {

  // TODO(2026-01-03 pass 4 Codex-CLI): NPC doesn't yet carry memory fields; use a local bridge type until the model is unified.
  private static readonly _memoryNpcTag = Symbol('memory-npc');
  private static asMemoryNpc(npc: NPC): NPC & { memory?: NPCMemory } {
    return npc as NPC & { memory?: NPCMemory };
  }

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
    const memoryNpc = MemorySystem.asMemoryNpc(npc);
    const memory = memoryNpc.memory || MemorySystem.createEmptyMemory(currentDate);

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
    const memoryNpc = MemorySystem.asMemoryNpc(npc);
    const memory = memoryNpc.memory || MemorySystem.createEmptyMemory(currentDate);

    // Check if fact is already known
    const existingFactIndex = memory.knownFacts.findIndex((f: Fact) => f.id === fact.id);
    // TODO(lint-intent): This binding never reassigns, so the intended mutability is unclear.
    // TODO(lint-intent): If it should stay stable, switch to const and treat it as immutable.
    // TODO(lint-intent): If mutation was intended, add the missing update logic to reflect that intent.
    const updatedFacts = [...memory.knownFacts];

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
    const memoryNpc = MemorySystem.asMemoryNpc(npc);
    if (!memoryNpc.memory) return false;
    return memoryNpc.memory.interactions.some((i: Interaction) => i.type === type && i.date >= sinceDate);
  }

  /**
   * Gets the NPC's current attitude towards the player.
   */
  static getAttitude(npc: NPC): number {
    const memoryNpc = MemorySystem.asMemoryNpc(npc);
    return memoryNpc.memory ? memoryNpc.memory.attitude : 0;
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
