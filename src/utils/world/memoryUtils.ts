/**
 * @file src/utils/memoryUtils.ts
 * Utilities for managing NPC memories, including formation, retrieval, and forgetting (decay).
 */

import { NPCMemory, Interaction, Fact, MemoryImportance, GameDate } from '../../types/memory';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a blank memory structure for a new NPC.
 */
export const createEmptyMemory = (): NPCMemory => ({
  interactions: [],
  knownFacts: [],
  attitude: 0,
  lastInteractionDate: 0,
  discussedTopics: {},
});

/**
 * Adds a new interaction to the NPC's memory.
 * Handles duplicate checks or merging if necessary (though usually interactions are unique events).
 */
export const addInteraction = (
  memory: NPCMemory,
  interaction: Omit<Interaction, 'id'> & { id?: string }
): NPCMemory => {
  const newInteraction: Interaction = {
    ...interaction,
    id: interaction.id || uuidv4(),
  };

  // Keep most recent first or append?
  // memory.ts says "Newest interactions should be appended to the end"
  return {
    ...memory,
    interactions: [...memory.interactions, newInteraction],
    lastInteractionDate: Math.max(memory.lastInteractionDate, newInteraction.date),
    attitude: Math.min(100, Math.max(-100, memory.attitude + newInteraction.attitudeChange)),
  };
};

/**
 * Retrieves relevant memories for a given context.
 * Currently uses simple keyword matching and importance sorting.
 * In the future, this could use semantic search.
 *
 * @param memory The NPC's memory bank
 * @param contextKeywords Keywords relevant to the current conversation (e.g. "theft", "king")
 * @param limit Max number of memories to return
 */
export const getRelevantMemories = (
  memory: NPCMemory,
  contextKeywords: string[] = [],
  limit: number = 5
): Interaction[] => {
  // If no keywords, just return the most significant recent memories
  if (contextKeywords.length === 0) {
    return [...memory.interactions]
      .sort((a, b) => b.significance - a.significance) // Sort by importance
      .slice(0, limit);
  }

  // Simple keyword matching
  const scoredMemories = memory.interactions.map(mem => {
    let score = mem.significance;
    const summaryLower = mem.summary.toLowerCase();

    contextKeywords.forEach(word => {
      if (summaryLower.includes(word.toLowerCase())) {
        score += 10; // High bonus for relevance
      }
    });

    return { memory: mem, score };
  });

  return scoredMemories
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.memory);
};

/**
 * Formats NPC memory into a context string for the AI.
 * Includes disposition, recent/relevant interactions, and known facts.
 *
 * @param memory The NPC's memory object.
 * @param contextKeywords Optional keywords to fetch specific relevant memories.
 */
export const formatMemoryForAI = (memory: NPCMemory, contextKeywords: string[] = []): string => {
  let contextString = `Disposition towards player: ${memory.attitude} (Range: -100 to 100).`;

  // 1. Relevant Interactions
  const relevantInteractions = getRelevantMemories(memory, contextKeywords, 5);
  if (relevantInteractions.length > 0) {
    const interactionSummaries = relevantInteractions.map(i =>
      `[${i.type.toUpperCase()}] "${i.summary}" (Sentiment: ${i.attitudeChange > 0 ? 'Positive' : 'Negative'})`
    );
    contextString += `\nPast Interactions:\n- ${interactionSummaries.join('\n- ')}`;
  } else {
    contextString += `\nPast Interactions: None relevant.`;
  }

  // 2. Known Facts (Sort by significance and recency)
  const sortedFacts = [...memory.knownFacts]
    .sort((a, b) => b.significance - a.significance || b.dateLearned - a.dateLearned)
    .slice(0, 5);

  if (sortedFacts.length > 0) {
    const factStrings = sortedFacts.map(fact => {
       const sourceText = fact.source === 'gossip'
          ? `(Heard Rumor)`
          : `(Witnessed)`;
       // Use dynamic access for 'text' if it exists at runtime (legacy support), otherwise fallback to id.
       // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
       // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
       // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
       const description = (fact as any)?.text || fact.id;
       return `${sourceText}: "${description}"`;
    });

    contextString += `\nKnown Facts:\n- ${factStrings.join('\n- ')}`;
  }

  return contextString;
};

/**
 * Processes memory decay based on time passed.
 * Removes low-significance memories that are too old.
 *
 * Decay Rules:
 * - Trivial (0): 1 day
 * - Minor (1): 7 days
 * - Standard (3): 30 days
 * - Major (5): 365 days
 * - Critical (10): Never
 *
 * @param memory The NPC's memory
 * @param currentDate The current game date (timestamp)
 */
export const decayMemories = (memory: NPCMemory, currentDate: GameDate): NPCMemory => {
  const ONE_DAY = 24 * 60 * 60 * 1000; // Assuming ms timestamp, adjust if GameDate is different

  const isExpired = (interaction: Interaction): boolean => {
    const age = currentDate - interaction.date;

    // Safety check for future dates
    if (age < 0) return false;

    if (interaction.significance >= MemoryImportance.Critical) return false;

    if (interaction.significance >= MemoryImportance.Major) {
      return age > 365 * ONE_DAY;
    }

    if (interaction.significance >= MemoryImportance.Standard) {
      return age > 30 * ONE_DAY;
    }

    if (interaction.significance >= MemoryImportance.Minor) {
      return age > 7 * ONE_DAY;
    }

    // Trivial
    return age > 1 * ONE_DAY;
  };

  const remainingInteractions = memory.interactions.filter(i => !isExpired(i));

  // If nothing changed, return original object to preserve reference if possible,
  // but for immutability usually we return new.
  // Optimization: check length
  if (remainingInteractions.length === memory.interactions.length) {
    return memory;
  }

  return {
    ...memory,
    interactions: remainingInteractions,
  };
};

/**
 * Teaches an NPC a new fact, or updates confidence if they already knew it.
 */
export const learnFact = (memory: NPCMemory, fact: Fact): NPCMemory => {
  const existingIndex = memory.knownFacts.findIndex(f => f.id === fact.id);

  if (existingIndex >= 0) {
    const existing = memory.knownFacts[existingIndex];
    // Update if new info is more confident or more significant
    if (fact.confidence > existing.confidence || fact.significance > existing.significance) {
      const newFacts = [...memory.knownFacts];
      newFacts[existingIndex] = {
        ...existing,
        confidence: Math.max(existing.confidence, fact.confidence),
        significance: Math.max(existing.significance, fact.significance),
        source: fact.source, // Update source to the latest one?
        dateLearned: fact.dateLearned
      };
      return { ...memory, knownFacts: newFacts };
    }
    return memory;
  }

  return {
    ...memory,
    knownFacts: [...memory.knownFacts, fact]
  };
};
