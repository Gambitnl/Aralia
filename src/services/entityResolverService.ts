
import { v4 as uuidv4 } from 'uuid';
import { GameState } from '../types';
import { logger } from '../utils/logger';

// --- Types ---

export type EntityType = 'npc' | 'location';

export interface EntityRef {
  id: string;
  name: string;
  type: EntityType;
  confidence: number; // 0-1, how sure we are this is a real entity mention
  isNew: boolean;
}

export interface EntityResolverContext {
  gameState?: GameState;
  // We can add a registry of "known names" here if needed
}

// Global registry for session-lived entities (to prevent re-creating the same entity 5 seconds later)
const sessionEntityRegistry: Record<string, EntityRef> = {};

// --- Regex Patterns for Extraction ---

// Basic patterns to catch capitalized names that look like proper nouns.
// Now stricter to avoid sentence starters unless they appear to be titles.
// Checks for "Title Name" or "Location Name" patterns primarily.
const TITLED_NAME_PATTERN = /\b(Captain|Lady|Lord|Sir|Madam|Master|Mistress|Brother|Sister|Mayor|King|Queen|Prince|Princess|Doctor|Professor|Baron|Baroness|Count|Countess|Duke|Duchess) ([A-Z][a-z]+)\b/g;
const LOCATION_PATTERN = /\b([A-Z][a-z]+) (Village|Town|City|Forest|Cave|Mountain|Inn|Tavern|Shop|Road|River|Castle|Keep|Valley|Hills)\b/g;

/**
 * Service to ensure world coherence by resolving entity mentions in text
 * to actual game state objects.
 */
export const EntityResolverService = {

  /**
   * Resets the session registry. Useful for testing.
   */
  resetRegistry: () => {
    for (const key in sessionEntityRegistry) {
      delete sessionEntityRegistry[key];
    }
  },

  /**
   * Main entry point: Extracts entities from text and ensures they exist.
   * Returns a list of resolved entity references.
   */
  resolveEntitiesInText: async (
    text: string,
    context: EntityResolverContext = {}
  ): Promise<EntityRef[]> => {
    const mentions = extractMentions(text);
    const resolvedEntities: EntityRef[] = [];

    for (const mention of mentions) {
      const resolved = await ensureEntityExists(mention.name, mention.inferredType, context);
      if (resolved) {
        resolvedEntities.push(resolved);
      }
    }

    return resolvedEntities;
  },

  /**
   * Checks if an entity exists, and if not, creates a stub for it.
   */
  ensureEntityExists: async (
    name: string,
    type: EntityType,
    context: EntityResolverContext = {}
  ): Promise<EntityRef> => {
    return ensureEntityExists(name, type, context);
  }
};

// --- Internal Helper Functions ---

function extractMentions(text: string): { name: string, inferredType: EntityType }[] {
  const results: { name: string, inferredType: EntityType }[] = [];
  const seenNames = new Set<string>();

  // 1. Extract Titled NPCs (High Confidence)
  const npcMatches = text.matchAll(TITLED_NAME_PATTERN);
  for (const match of npcMatches) {
    const fullName = match[0]; // e.g. "Captain Vane"
    if (!seenNames.has(fullName)) {
      results.push({ name: fullName, inferredType: 'npc' });
      seenNames.add(fullName);
    }
  }

  // 2. Extract Suffix Locations (High Confidence)
  const locationMatches = text.matchAll(LOCATION_PATTERN);
  for (const match of locationMatches) {
    const fullName = match[0]; // e.g. "Silverdale Village"
    if (!seenNames.has(fullName)) {
      results.push({ name: fullName, inferredType: 'location' });
      seenNames.add(fullName);
    }
  }

  return results;
}

async function ensureEntityExists(
  name: string,
  type: EntityType,
  context: EntityResolverContext
): Promise<EntityRef> {
  const normalizedName = name.trim();
  const registryKey = `${type}:${normalizedName.toLowerCase()}`;

  // 1. Check Session Registry (Fastest)
  if (sessionEntityRegistry[registryKey]) {
    return sessionEntityRegistry[registryKey];
  }

  // 2. Check Game State (if provided)
  if (context.gameState) {
    // TODO: Implement actual search against context.gameState.npcs or context.gameState.locations
    // For now, we simulate a "not found" unless we mock it.

    // Example: Check metNpcIds (which are IDs, not names, so we can't easily check names without a lookup map)
    // This confirms the "Name -> ID" lookup gap.
  }

  // 3. Not found - Create New Stub
  const newId = uuidv4();

  const newEntity: EntityRef = {
    id: newId,
    name: normalizedName,
    type,
    confidence: 0.9,
    isNew: true
  };

  // Register it
  sessionEntityRegistry[registryKey] = newEntity;

  logger.info(`[EntityResolver] Registered new ${type}: "${normalizedName}" (${newId})`);

  return newEntity;
}
