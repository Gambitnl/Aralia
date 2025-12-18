/**
 * @file src/systems/necromancy/CorpseLifecycle.ts
 * Manages the creation and validation of Corpses.
 */

import { CombatCharacter, CombatState, Position } from '../../types/combat';
import { Corpse, CorpseState } from './models';

/**
 * Creates a Corpse object from a dying CombatCharacter.
 * @param character The character who just died (HP <= 0).
 * @param currentTurn The current combat turn number.
 * @returns A new Corpse object ready to be added to the map state.
 */
export function createCorpse(character: CombatCharacter, currentTurn: number): Corpse {
  // Determine initial state based on creature type or damage type (e.g. Acid might leave bones?)
  // For now, default to 'fresh'.
  let initialState: CorpseState = 'fresh';

  // Example logic: specific damage types could accelerate decay state
  // This is a framework placeholder.

  return {
    id: `corpse-${character.id}-${Date.now()}`,
    originalCharacterId: character.id,
    characterSnapshot: JSON.parse(JSON.stringify(character)), // Deep copy to preserve state at death
    turnOfDeath: currentTurn,
    state: initialState,
    position: { ...character.position },
    isLooted: false,
  };
}

/**
 * Checks if a Corpse is a valid target for a specific Necromancy requirement.
 * @param corpse The corpse to check.
 * @param requiredStates Array of allowed states (e.g., ['fresh', 'bones']).
 * @param requiredCreatureTypes Array of allowed creature types (e.g., ['Humanoid']).
 * @returns true if the corpse matches the requirements.
 */
export function isValidCorpseTarget(
  corpse: Corpse,
  requiredStates: CorpseState[],
  requiredCreatureTypes?: string[]
): boolean {
  // Check state (Fresh vs Bones)
  if (!requiredStates.includes(corpse.state)) {
    return false;
  }

  // Check Creature Type (e.g. Animate Dead requires Humanoid)
  if (requiredCreatureTypes && requiredCreatureTypes.length > 0) {
    const originalTypes = corpse.characterSnapshot.creatureTypes || [];
    const hasType = requiredCreatureTypes.some(type => originalTypes.includes(type));
    if (!hasType) return false;
  }

  return true;
}

/**
 * Determines if a corpse is valid for Revivify (died within 1 minute/10 rounds).
 */
export function canRevivify(corpse: Corpse, currentTurn: number): boolean {
  if (corpse.state !== 'fresh') return false;

  // 1 minute = 10 rounds
  const turnsSinceDeath = currentTurn - corpse.turnOfDeath;
  return turnsSinceDeath <= 10;
}
