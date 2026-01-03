/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file EntityResolverService.ts
 * Provides validation and resolution for entities referenced in text (e.g., AI output).
 * Ensures that locations, factions, and NPCs mentioned in narrative text actually exist
 * in the game state, or flags them for potential creation (stubs).
 */

import { GameState, Location, Faction, FactionRank, NPC } from '../types';
import { FACTIONS } from '../data/factions';
import { LOCATIONS } from '../data/world/locations';
import { LANDMARK_TEMPLATES } from '../data/landmarks';
import { NPCS } from '../data/world/npcs';

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

export interface EntityCreationResult {
  entity: Location | Faction | NPC | null;
  created: boolean;
  type: EntityType;
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
   * Wraps resolveEntities for simple use cases, returning just the entities that need creation.
   * @param text Narrative text.
   * @param state GameState.
   * @returns Array of entity references that were NOT found.
   */
  static resolveEntitiesInText(text: string, state: GameState): EntityReference[] {
      const result = this.resolveEntities(text, state);
      return result.references.filter(ref => !ref.exists);
  }

  /**
   * Ensures an entity referenced by name exists in the game world.
   * If it exists, returns it.
   * If not, generates a new entity structure for it.
   *
   * @param type The type of entity (location, faction, npc)
   * @param name The name of the entity
   * @param state The current game state (to check for dynamic entities)
   * @returns An object containing the entity and a boolean indicating if it was newly created.
   */
  static async ensureEntityExists(type: EntityType, name: string, state: GameState): Promise<EntityCreationResult> {
    const resolution = this.checkExistence(name, type, state);

    if (resolution.exists && resolution.id) {
      // Fetch existing entity
      if (resolution.entityType === 'faction') {
        const faction = state.factions[resolution.id] || FACTIONS[resolution.id];
        return { entity: faction, created: false, type: 'faction' };
      }
      if (resolution.entityType === 'location') {
        const location = state.dynamicLocations[resolution.id] || LOCATIONS[resolution.id];
        // We might also match a landmark, which isn't a full location, but for now treat it as found.
        // If it was a template landmark, we might need to instantiate it, but let's assume existence for now.
        return { entity: location || null, created: false, type: 'location' };
      }
      if (resolution.entityType === 'npc') {
          // Attempt to fetch from static list first
          const npc = NPCS[resolution.id];
          // If not static, it might be in npcMemory (though npcMemory doesn't store full NPC objects, just state)
          // For now, if we found an ID, we assume it's valid.
          // If we had a dynamic NPC registry, we'd fetch it there.
          if (npc) {
              return { entity: npc, created: false, type: 'npc' };
          }
          // If it was found via metNpcIds but not in NPCS, we might need to construct a partial or fetch from a different source.
          // Fallback to creating a fresh one if we can't fully resolve the object?
          // For safety, let's treat "found ID but no object" as needing re-generation or a deep search.
          // But checkExistence only returns true if we found a match.
      }
    }

    // Entity does not exist - Create it
    if (type === 'faction') {
      const newFaction = this.createFaction(name);
      return { entity: newFaction, created: true, type: 'faction' };
    } else if (type === 'location') {
      const newLocation = this.createLocation(name);
      return { entity: newLocation, created: true, type: 'location' };
    } else if (type === 'npc') {
      const newNPC = this.createNPC(name);
      return { entity: newNPC, created: true, type: 'npc' };
    }

    return { entity: null, created: false, type };
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

    // Check dynamic factions in state
    if (state.factions) {
        const dynamicFaction = Object.values(state.factions).find(f => f.name.toLowerCase() === normalized);
        if (dynamicFaction) return { exists: true, id: dynamicFaction.id, normalizedName: dynamicFaction.name, entityType: 'faction' };
    }

    // 2. Check Locations / Landmarks
    // Check static locations
    const staticLocation = Object.values(LOCATIONS).find(l => l.name.toLowerCase() === normalized);
    if (staticLocation) return { exists: true, id: staticLocation.id, normalizedName: staticLocation.name, entityType: 'location' };

    // Check dynamic locations in state
    if (state.dynamicLocations) {
      const dynamicLocation = Object.values(state.dynamicLocations).find(l => l.name.toLowerCase() === normalized);
      if (dynamicLocation) return { exists: true, id: dynamicLocation.id, normalizedName: dynamicLocation.name, entityType: 'location' };
    }

    // Static landmarks (Templates)
    const landmark = LANDMARK_TEMPLATES.find(l => l.nameTemplate.some(t => t.toLowerCase() === normalized));
    if (landmark) return { exists: true, id: landmark.id, normalizedName: name, entityType: 'location' };

    // 3. Check NPCs
    // Check static NPCs
    const staticNPC = Object.values(NPCS).find(n => n.name.toLowerCase() === normalized);
    if (staticNPC) return { exists: true, id: staticNPC.id, normalizedName: staticNPC.name, entityType: 'npc' };

    // Check met NPCs (State) - we only have IDs, so we can't easily search by name unless we have a lookup
    // But we can check if the normalized name matches any ID if IDs are name-based (often true: 'old_hermit')
    // This is a weak check but better than nothing.
    // Ideally, GameState would cache names of met NPCs.
    // For now, let's assume if it's not in NPCS, we don't know its name unless we scan `npcMemory` or similar?
    // npcMemory is keyed by ID.
    // If we can't find it by name in a registry, we assume it doesn't exist.

    return { exists: false, normalizedName: name };
  }

  /**
   * Generates a new Faction stub.
   */
  private static createFaction(name: string): Faction {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Basic stub ranks
    const ranks: FactionRank[] = [
      { id: 'associate', name: 'Associate', level: 1, description: 'A known associate.', perks: [] },
      { id: 'member', name: 'Member', level: 2, description: 'A full member.', perks: [] }
    ];

    return {
      id,
      name,
      description: `A faction known as ${name}.`,
      type: 'GUILD', // Default type, could be inferred later
      colors: { primary: '#000000', secondary: '#ffffff' },
      ranks,
      allies: [],
      enemies: [],
      rivals: [],
      relationships: {},
      values: [],
      hates: [],
      power: 50,
      assets: []
    };
  }

  /**
   * Generates a new Location stub.
   */
  private static createLocation(name: string): Location {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return {
      id,
      name,
      baseDescription: `You have arrived at ${name}.`,
      exits: {},
      mapCoordinates: { x: -1, y: -1 }, // Off-map / abstract location
      biomeId: 'plains' // Default biome
    };
  }

  /**
   * Generates a new NPC stub.
   */
  private static createNPC(name: string): NPC {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return {
      id,
      name,
      baseDescription: `You see ${name}.`,
      initialPersonalityPrompt: `You are ${name}. You are a stranger to the player.`,
      role: 'civilian',
      dialoguePromptSeed: `${name} looks at you curiously.`
    };
  }

  /**
   * Extracts capitalized phrases from text.
   * e.g., "I went to Silverdale and saw King Arthur." -> ["Silverdale", "King Arthur"]
   */
  private static extractProperNouns(text: string): string[] {
    const ignoredWords = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'To', 'From', 'By', 'With', 'And', 'But', 'Or', 'Nor', 'For', 'Yet', 'So', 'I', 'My', 'We', 'They', 'It', 'He', 'She']);
    const found = new Set<string>();

    // Regex to match Capitalized Words (one or more)
    // Avoid matching start of sentences if they are common words (handled by ignoredWords check mostly)
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
    const lowerName = name.toLowerCase();

    if (lowerContext.includes(`visit ${lowerName}`) || lowerContext.includes(`travel to ${lowerName}`) || lowerContext.includes(`in ${lowerName}`)) return 'location';
    if (lowerContext.includes(`join ${lowerName}`) || lowerContext.includes(`fight ${lowerName}`) || lowerContext.includes(`guild`)) return 'faction';

    // Default to NPC for names
    return 'npc';
  }

  private static isMajorEntityCandidate(name: string): boolean {
    // Heuristic: Multi-word names or names with titles are more likely to be specific entities we should know about.
    // e.g. "Silverdale" vs "Barn" (if capitalized by mistake)
    // "The Iron Ledger" vs "The"
    if (name.split(' ').length > 1) return true;
    // Single names like "Gandalf" are also major, but hard to distinguish from "Chair" if capitalized at start.
    // We rely on extractProperNouns to filter common words.
    return false;
  }
}
