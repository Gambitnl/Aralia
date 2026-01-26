// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:37:36
 * Dependents: character/index.ts, identityUtils.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/identityUtils.ts
 * Provides logic for identity management, disguise checks, and secret handling.
 */

import type {
  PlayerIdentityState,
  Identity,
  Alias,
  Disguise,
  Secret,
  IntrigueCheckResult
} from '../../types/identity';
import { v4 as uuidv4 } from 'uuid';

// -----------------------------------------------------------------------------
// Factory Functions
// -----------------------------------------------------------------------------

export function createTrueIdentity(name: string, history: string): Identity {
  return {
    id: uuidv4(),
    name,
    type: 'true',
    history,
    fame: 0,
  };
}

export function createAlias(name: string, history: string, initialCredibility: number = 10): Alias {
  return {
    id: uuidv4(),
    name,
    type: 'alias',
    history,
    fame: 0,
    credibility: initialCredibility,
    establishedIn: [],
  };
}

export function createDisguise(
  targetAppearance: string,
  quality: number,
  vulnerabilities: string[] = []
): Disguise {
  return {
    id: uuidv4(),
    targetAppearance,
    quality,
    vulnerabilities,
  };
}

export function createSecret(
  subjectId: string,
  content: string,
  value: number,
  tags: Secret['tags'] = []
): Secret {
  return {
    id: uuidv4(),
    subjectId,
    content,
    verified: false,
    value,
    knownBy: [],
    tags,
  };
}

export function initializePlayerIdentity(characterId: string, name: string): PlayerIdentityState {
  const trueId = createTrueIdentity(name, 'A traveler seeking adventure.');
  return {
    characterId,
    trueIdentity: trueId,
    activeDisguise: null,
    currentPersonaId: trueId.id,
    aliases: [],
    knownSecrets: [],
    exposedSecrets: [],
  };
}

// -----------------------------------------------------------------------------
// Mechanics
// -----------------------------------------------------------------------------

/**
 * Calculates the effectiveness of a disguise against a passive observer.
 * @param disguise The disguise being worn.
 * @param observerPerception The observer's passive perception score.
 * @param situationalModifiers Bonuses/penalties (e.g., distance, lighting).
 */
export function checkDisguise(
  disguise: Disguise,
  observerPerception: number,
  situationalModifiers: number = 0
): IntrigueCheckResult {
  // In a real system, we might compare DC vs Passive Perception directly,
  // or roll Observer Perception vs DC.
  // Here, we'll assume the DC is the difficulty for the OBSERVER to spot it.
  // So: Observer Roll vs Disguise DC (Quality).
  // Wait, "Quality" is usually the DC to spot.
  // So if Observer Roll >= Quality, they spot it.

  // Let's model it as: Disguise Quality IS the DC.
  // We return the result of a hypothetical check.

  const spotCheckTotal = observerPerception + situationalModifiers; // This is a simplified "passive" check

  const detected = spotCheckTotal >= disguise.quality;

  return {
    success: !detected,
    detected,
    margin: Math.abs(spotCheckTotal - disguise.quality),
    consequences: detected ? ['Your disguise has been seen through.'] : [],
  };
}

/**
 * Attempts to switch the active persona to an alias.
 * Requires the alias to be in the player's list.
 */
export function switchPersona(
  state: PlayerIdentityState,
  targetAliasId: string
): PlayerIdentityState {
  // If switching to true identity
  if (targetAliasId === state.trueIdentity.id) {
    return {
      ...state,
      currentPersonaId: state.trueIdentity.id,
    };
  }

  // Verify alias exists
  const alias = state.aliases.find(a => a.id === targetAliasId);
  if (!alias) {
    throw new Error(`Alias with ID ${targetAliasId} not found.`);
  }

  return {
    ...state,
    currentPersonaId: targetAliasId,
  };
}

/**
 * Adds a new secret to the player's knowledge.
 * Handles duplicate checks.
 */
export function learnSecret(state: PlayerIdentityState, secret: Secret): PlayerIdentityState {
  if (state.knownSecrets.some(s => s.id === secret.id)) {
    return state; // Already known
  }

  return {
    ...state,
    knownSecrets: [...state.knownSecrets, secret],
  };
}

/**
 * Verifies a rumor, turning it into a confirmed secret and increasing its value.
 */
export function verifySecret(secret: Secret): Secret {
  if (secret.verified) return secret;

  return {
    ...secret,
    verified: true,
    value: Math.ceil(secret.value * 1.5), // Value increases when confirmed
  };
}

/**
 * Calculates the risk of a specific disguise vulnerability being triggered.
 * @param disguise The active disguise.
 * @param environmentTags Tags describing the current environment (e.g., 'raining', 'bright', 'elvish_court').
 */
export function checkDisguiseVulnerabilities(
  disguise: Disguise,
  environmentTags: string[]
): string[] {
  const triggered: string[] = [];

  for (const vul of disguise.vulnerabilities) {
    // Simple string matching for now. In a real system, this might be more semantic.
    // Case-insensitive check
    const normalizedVul = vul.toLowerCase();
    if (environmentTags.some(tag => normalizedVul.includes(tag.toLowerCase()))) {
      triggered.push(vul);
    }
  }

  return triggered;
}
