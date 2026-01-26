// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:38
 * Dependents: planar/index.ts, planarTargeting.ts
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/planarTargeting.ts
 * Utilities for determining interaction rules between different planar phases.
 */

import { CombatCharacter, CombatState } from '@/types/combat';
import { ETHEREAL_PLANE, MATERIAL_PLANE } from '@/data/planes';

/**
 * Gets the current planar phase of a character.
 * Defaults to the combat state's current plane (usually Material) if no active effect overrides it.
 *
 * @param character - The character to check
 * @param gameState - The current combat state
 * @returns The plane ID the character is currently "on"
 */
export function getCharacterPhase(character: CombatCharacter, gameState: CombatState): string {
  // Check for active effects that override planar phase (e.g. Blink, Etherealness)
  if (character.activeEffects) {
    for (const effect of character.activeEffects) {
      if (effect.mechanics?.planarPhase) {
        return effect.mechanics.planarPhase;
      }
    }
  }

  // Fallback to the map's current plane
  return gameState.currentPlane?.id || MATERIAL_PLANE.id;
}

/**
 * Checks if a character can perceive another character across planes.
 *
 * @param observer - The character looking
 * @param target - The character being looked at
 * @param gameState - The current combat state
 * @returns true if the observer can see the target
 */
export function canSeeTarget(observer: CombatCharacter, target: CombatCharacter, gameState: CombatState): boolean {
  const observerPhase = getCharacterPhase(observer, gameState);
  const targetPhase = getCharacterPhase(target, gameState);

  // Same plane: always visible (unless hidden by other means, handled by stealth system)
  if (observerPhase === targetPhase) {
    return true;
  }

  // Check for specific cross-planar vision capabilities
  // e.g., Blink allows seeing Material from Ethereal
  // Check observer's active effects for 'planarVision'
  if (observer.activeEffects) {
    for (const effect of observer.activeEffects) {
      if (effect.mechanics?.planarVision?.includes(targetPhase)) {
        return true;
      }
    }
  }

  // Specific hardcoded rule: Ethereal creatures can see Material Plane (usually)
  // But strictly per 5e, "Material Plane... is cast in shades of gray".
  if (observerPhase === ETHEREAL_PLANE.id && targetPhase === MATERIAL_PLANE.id) {
    return true;
  }

  // Otherwise, cannot see
  return false;
}

/**
 * Checks if a character can physically interact with (target/attack) another character.
 *
 * @param source - The character initiating interaction
 * @param target - The target character
 * @param gameState - The current combat state
 * @param damageType - Optional, if dealing force damage (which often crosses Ethereal)
 * @returns true if interaction is possible
 */
export function canInteract(
  source: CombatCharacter,
  target: CombatCharacter,
  gameState: CombatState,
  damageType?: string
): boolean {
  const sourcePhase = getCharacterPhase(source, gameState);
  const targetPhase = getCharacterPhase(target, gameState);

  // Same plane: always interactable
  if (sourcePhase === targetPhase) {
    return true;
  }

  // Force damage exception (PHB: "Wall of Force... extends into Ethereal")
  // Magic Missile is Force damage.
  if (damageType === 'force') {
    // Force effects on Material affect Ethereal?
    // 5e Rules: "Creatures on Ethereal Plane can see into Material... but can't affect or be affected... unless a special ability or magic has a particular effect."
    // Force damage is NOT a general exception in 5e for *creatures*, but Wall of Force blocks ethereal travel.
    // However, "Ghost" has "Incorporeal Movement" but usually takes normal damage from Force?
    // Actually, Ghost (MM p.147) has resistances but not immunity to non-magical, except Force is normal.
    // Blink spell: "You can only affect and be affected by other creatures on the Ethereal Plane."
    // No mention of Force damage exception for Blink specifically.
    // So for Blink, it is strict.

    // We will stick to strict phase matching unless an explicit override exists.
    return false;
  }

  return false;
}
