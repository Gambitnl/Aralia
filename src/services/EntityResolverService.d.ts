/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file EntityResolverService.ts
 * Provides validation and resolution for entities referenced in text (e.g., AI output).
 * Ensures that locations, factions, and NPCs mentioned in narrative text actually exist
 * in the game state, or flags them for potential creation (stubs).
 */
import { GameState, Location, Faction, NPC } from '../types';
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
    text: string;
    references: EntityReference[];
    validationErrors: string[];
}
export interface EntityCreationResult {
    entity: Location | Faction | NPC | null;
    created: boolean;
    type: EntityType;
}
export declare class EntityResolverService {
    /**
     * Scans text for potential entity references and validates them against the Game State.
     * @param text The narrative text to scan.
     * @param state The current GameState.
     */
    static resolveEntities(text: string, state: GameState): ResolverResult;
    /**
     * Wraps resolveEntities for simple use cases, returning just the entities that need creation.
     * @param text Narrative text.
     * @param state GameState.
     * @returns Array of entity references that were NOT found.
     */
    static resolveEntitiesInText(text: string, state: GameState): EntityReference[];
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
    static ensureEntityExists(type: EntityType, name: string, state: GameState): Promise<EntityCreationResult>;
    /**
     * Checks if an entity exists in the static data or dynamic state.
     */
    private static checkExistence;
    /**
     * Generates a new Faction stub.
     */
    private static createFaction;
    /**
     * Generates a new Location stub.
     */
    private static createLocation;
    /**
     * Generates a new NPC stub.
     */
    private static createNPC;
    /**
     * Extracts capitalized phrases from text.
     * e.g., "I went to Silverdale and saw King Arthur." -> ["Silverdale", "King Arthur"]
     */
    private static extractProperNouns;
    /**
     * Guesses the type of entity based on context keywords.
     */
    private static guessEntityType;
    private static isMajorEntityCandidate;
}
