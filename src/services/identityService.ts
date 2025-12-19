/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/identityService.ts
 * Service for managing player identities, disguises, and secrets.
 * Supports the "Identity & Secrets" pillar.
 */

import {
  PlayerIdentityState,
  Identity,
  Disguise,
  Alias,
  Secret,
  IntrigueCheckResult
} from '@/types/identity';
import { PlayerCharacter } from '@/types/index';
import { rollDice } from '@/utils/combatUtils';
import { generateId } from '@/utils/idGenerator';

/**
 * Initializes a new identity state for a character.
 */
export function initializeIdentityState(character: PlayerCharacter): PlayerIdentityState {
  const trueIdentity: Identity = {
    id: `id-${generateId()}`,
    name: character.name,
    type: 'true',
    history: character.race.description || 'Unknown background',
    fame: 0 // Starts unknown
  };

  return {
    characterId: character.id,
    trueIdentity,
    activeDisguise: null,
    currentPersonaId: trueIdentity.id,
    aliases: [],
    knownSecrets: [],
    exposedSecrets: []
  };
}

/**
 * Equips a disguise.
 * This does not automatically change the persona, but changes the physical appearance.
 */
export function equipDisguise(state: PlayerIdentityState, disguise: Disguise): PlayerIdentityState {
  return {
    ...state,
    activeDisguise: disguise
  };
}

/**
 * Removes the active disguise.
 */
export function removeDisguise(state: PlayerIdentityState): PlayerIdentityState {
  return {
    ...state,
    activeDisguise: null
  };
}

/**
 * Creates a new alias (false identity).
 */
export function createAlias(
  state: PlayerIdentityState,
  aliasName: string,
  background: string
): PlayerIdentityState {
  const newAlias: Alias = {
    id: `alias-${generateId()}`,
    name: aliasName,
    type: 'alias',
    history: background,
    fame: 0,
    credibility: 50, // Starting credibility
    establishedIn: []
  };

  return {
    ...state,
    aliases: [...state.aliases, newAlias]
  };
}

/**
 * Switches the persona the player is currently presenting as.
 * This is "Who am I saying I am?".
 */
export function switchPersona(state: PlayerIdentityState, personaId: string): PlayerIdentityState {
  // Validate persona exists (is true identity or in aliases)
  const isTrue = state.trueIdentity.id === personaId;
  const isAlias = state.aliases.some(a => a.id === personaId);

  if (!isTrue && !isAlias) {
    console.warn(`Attempted to switch to invalid persona ID: ${personaId}`);
    return state;
  }

  return {
    ...state,
    currentPersonaId: personaId
  };
}

/**
 * Adds a discovered secret to the player's knowledge.
 */
export function learnSecret(state: PlayerIdentityState, secret: Secret): PlayerIdentityState {
  // Prevent duplicates
  if (state.knownSecrets.some(s => s.id === secret.id)) {
    return state;
  }

  return {
    ...state,
    knownSecrets: [...state.knownSecrets, secret]
  };
}

/**
 * Reveals a secret (consumes it? or just marks it used? For now, we just return state,
 * logic for "using" it would be in a higher level handler involving consequences).
 */
export function revealSecret(state: PlayerIdentityState, secretId: string): PlayerIdentityState {
  // Logic for revealing might involve reducing its value or flagging it as "leaked by player"
  // For now, this is a placeholder for that mechanic.
  return state;
}

/**
 * Checks if a disguise holds up against observation.
 * @param disguise The disguise being worn
 * @param observerPerception The Passive Perception or Investigation check of the observer
 * @param modifiers Situational modifiers (positive = harder to spot, negative = easier)
 * @returns boolean True if disguise holds, False if spotted
 */
export function checkDisguise(
  disguise: Disguise,
  observerPerception: number,
  modifiers: number = 0
): boolean {
  const dc = disguise.quality + modifiers;
  return dc >= observerPerception;
}

/**
 * Performs an active deception check (e.g., trying to lie to a guard).
 *
 * @param state Current identity state
 * @param deceptionBonus Player's Deception skill bonus
 * @param observerInsight Observer's Insight check (or Passive Insight)
 * @param situationalDC Difficulty Class based on the lie's plausibility
 */
export function attemptDeception(
  state: PlayerIdentityState,
  deceptionBonus: number,
  observerInsight: number,
  situationalDC: number
): IntrigueCheckResult {
  const d20 = rollDice('1d20');
  const roll = d20 + deceptionBonus;

  // Use Disguise quality as a bonus if the lie depends on the disguise
  let disguiseBonus = 0;
  if (state.activeDisguise) {
     // If the disguise is high quality, it helps. If low, it hinders?
     // For simplicity, we assume the disguise check passed already or is separate.
     // But a good disguise gives confidence.
     disguiseBonus = Math.floor(state.activeDisguise.quality / 10);
  }

  const finalRoll = roll + disguiseBonus;
  const targetDC = Math.max(observerInsight, situationalDC);

  const success = finalRoll >= targetDC;
  const margin = finalRoll - targetDC;

  return {
    success,
    detected: !success && margin < -5, // Critical fail logic: they know you're lying if you fail bad
    margin,
    consequences: !success ? ['Suspicion raised'] : []
  };
}

/**
 * Gets the current active persona object (Identity or Alias).
 */
export function getCurrentPersona(state: PlayerIdentityState): Identity {
  if (state.currentPersonaId === state.trueIdentity.id) {
    return state.trueIdentity;
  }
  const alias = state.aliases.find(a => a.id === state.currentPersonaId);
  return alias || state.trueIdentity; // Fallback
}
