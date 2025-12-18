/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file EntityResolverService.ts
 * Provides validation and resolution for entities referenced in text (e.g., AI output).
 * Ensures that locations, factions, and NPCs mentioned in narrative text actually exist
 * in the game state, or flags them for potential creation (stubs).
 */

import { GameState } from '../types';
import { FACTIONS } from '../data/factions';
import { LANDMARK_TEMPLATES } from '../data/landmarks';

export type EntityType = 'location' | 'faction' | 'npc' | 'item';

export interface EntityReference {
  originalText: string;
  normalizedName: string;
  type: EntityType;
  exists: boolean;
  entityId?: string;
  confidence: number;
}

export interface ResolverResult {
  text: string; // The original text (potentially modified if we correct names)
  references: EntityReference[];
  validationErrors: string[]; // List of issues found (e.g., "Mentioned 'Silverdale' but it does not exist")
}

export class EntityResolverService {
  /**
   * Scans text for potential entity references and validates them against the Game State.
   * @param text The narrative text to scan.
   * @param state The current GameState.
   */
  static resolveEntities(text: string, state: GameState): ResolverResult {
    const references: EntityReference[] = [];
    const validationErrors: string[] = [];

    // 1. Extract potential Proper Nouns / Entities
    const potentialEntities = this.extractProperNouns(text);

    for (const name of potentialEntities) {
      let type = this.guessEntityType(name, text);
      const resolution = this.checkExistence(name, type, state);

      // If we found it, force the type to match the existing entity type
      if (resolution.exists) {
         if (resolution.entityType) {
             type = resolution.entityType;
         }

        references.push({
          originalText: name,
          normalizedName: resolution.normalizedName,
          type: type,
          exists: true,
          entityId: resolution.id,
          confidence: 1.0
        });
      } else {
        // High confidence checks (e.g., "The Iron Ledger") should flag errors if missing.
        // Lower confidence checks (e.g., "John") might just be flavor.

        if (this.isMajorEntityCandidate(name)) {
            references.push({
                originalText: name,
                normalizedName: name, // Keep original as normalized since we didn't find it
                type: type,
                exists: false,
                confidence: 0.8
            });
            validationErrors.push(`Potential coherence gap: Text mentions '${name}' which was not found in world state.`);
        }
      }
    }

    return {
      text,
      references,
      validationErrors
    };
  }

  /**
   * Checks if an entity exists in the static data or dynamic state.
   */
  private static checkExistence(name: string, assumedType: EntityType, state: GameState): { exists: boolean, id?: string, normalizedName: string, entityType?: EntityType } {
    const normalized = name.toLowerCase();

    // 1. Check Factions
    // Check static factions
    const staticFaction = Object.values(FACTIONS).find(f => f.name.toLowerCase() === normalized);
    if (staticFaction) return { exists: true, id: staticFaction.id, normalizedName: staticFaction.name, entityType: 'faction' };

    // Check dynamic factions (Noble Houses) in state
    if (state.factions) {
        const dynamicFaction = Object.values(state.factions).find(f => f.name.toLowerCase() === normalized);
        if (dynamicFaction) return { exists: true, id: dynamicFaction.id, normalizedName: dynamicFaction.name, entityType: 'faction' };
    }

    // 2. Check Locations / Landmarks
    // Static landmarks
    const landmark = LANDMARK_TEMPLATES.find(l => l.nameTemplate.some(t => t.toLowerCase() === normalized));
    if (landmark) return { exists: true, id: landmark.id, normalizedName: name, entityType: 'location' }; // Return matching name

    // 3. Check NPCs (State)
    // TODO: Connect to global NPC registry when it exists.

    return { exists: false, normalizedName: name };
  }

  /**
   * Extracts capitalized phrases from text.
   * e.g., "I went to Silverdale and saw King Arthur." -> ["Silverdale", "King Arthur"]
   */
  private static extractProperNouns(text: string): string[] {
    const ignoredWords = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'To', 'From', 'By', 'With', 'And', 'But', 'Or', 'Nor', 'For', 'Yet', 'So', 'I', 'My']);
    const found = new Set<string>();

    // Regex to match Capitalized Words (one or more)
    const regex = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const word = match[0];

        // Filter out single ignored words (e.g., "The" at start of sentence)
        // Check if the word is in the ignored list AND it's a single word (no spaces)
        if (!word.includes(' ') && ignoredWords.has(word)) continue;

        // Filter out common false positives
        if (word.length < 3) continue;

        found.add(word);
    }

    return Array.from(found);
  }

  /**
   * Guesses the type of entity based on context keywords.
   */
  private static guessEntityType(name: string, context: string): EntityType {
    const lowerContext = context.toLowerCase();

    if (lowerContext.includes(`visit ${name.toLowerCase()}`) || lowerContext.includes(`travel to ${name.toLowerCase()}`)) return 'location';
    if (lowerContext.includes(`join ${name.toLowerCase()}`) || lowerContext.includes(`fight ${name.toLowerCase()}`)) return 'faction';

    // Default to NPC for names
    return 'npc';
  }

  private static isMajorEntityCandidate(name: string): boolean {
    // Heuristic: Multi-word names or names with titles are more likely to be specific entities we should know about.
    // e.g. "Silverdale" vs "Barn" (if capitalized by mistake)
    // "The Iron Ledger" vs "The"
    if (name.split(' ').length > 1) return true;
    return false;
  }
}
