// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:21:59
 * Dependents: utils/combat/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Draconic Sorcery (Sorcerer) ancestry, affinity, and Draconic Resilience.
 *
 * The level-3 choice of dragon ancestor grants a matching damage resistance,
 * a themed affinity, and resilience (unarmored AC 10 + Dex + Cha, +1 HP per
 * sorcerer level). This file owns the ancestry → damage-type mapping, the
 * resistance merge, and the AC/HP formulas, so a caller does not hand-roll the
 * dragon-element mapping in preview text. It is gated on the `draconic_resilience`
 * ability where a character gate is needed.
 */

import type { CombatCharacter } from '../../types/combat';
import { getAbilityModifierValue } from '../character/statUtils';

export const DRACONIC_RESILIENCE_FEATURE_ID = 'draconic_resilience';
export const DRACONIC_SPELLS_FEATURE_ID = 'draconic_spells';
export const DRACONIC_RESILIENCE_AC_BASE = 10;

export type DraconicAncestry =
  | 'black' | 'blue' | 'brass' | 'bronze' | 'copper'
  | 'gold' | 'green' | 'red' | 'silver' | 'white';

export interface DraconicAncestryDefinition {
  id: DraconicAncestry;
  name: string;
  damageType: string;
}

export const DRACONIC_ANCESTRIES: Record<DraconicAncestry, DraconicAncestryDefinition> = {
  black: { id: 'black', name: 'Black Dragon', damageType: 'acid' },
  blue: { id: 'blue', name: 'Blue Dragon', damageType: 'lightning' },
  brass: { id: 'brass', name: 'Brass Dragon', damageType: 'fire' },
  bronze: { id: 'bronze', name: 'Bronze Dragon', damageType: 'lightning' },
  copper: { id: 'copper', name: 'Copper Dragon', damageType: 'acid' },
  gold: { id: 'gold', name: 'Gold Dragon', damageType: 'fire' },
  green: { id: 'green', name: 'Green Dragon', damageType: 'poison' },
  red: { id: 'red', name: 'Red Dragon', damageType: 'fire' },
  silver: { id: 'silver', name: 'Silver Dragon', damageType: 'cold' },
  white: { id: 'white', name: 'White Dragon', damageType: 'cold' },
};

/** Themed affinity spells a Draconic Sorcerer keeps prepared. */
export const DRACONIC_SPELLS = ['chromatic_orb', 'dragon_s_breath', 'protection_from_energy', 'fly'];

export function isDraconicAncestry(id: string): id is DraconicAncestry {
  return id in DRACONIC_ANCESTRIES;
}

export function draconicAncestryDamageType(ancestry: string): string | undefined {
  return DRACONIC_ANCESTRIES[ancestry as DraconicAncestry]?.damageType;
}

export function hasDraconicResilience(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === DRACONIC_RESILIENCE_FEATURE_ID);
}

// ============================================================================
// Ancestry and Resistance
// ============================================================================

export interface DraconicAncestryApplication {
  ancestry: string;
  resistances: string[];
  rejected?: boolean;
}

/**
 * Merges the chosen ancestor's damage resistance into an existing resistance
 * list. The caller persists the returned list onto the character. An unknown
 * ancestry is rejected without changing the list.
 */
export function applyDraconicAncestry(ancestry: string, resistances: string[] = []): DraconicAncestryApplication {
  const damageType = draconicAncestryDamageType(ancestry);
  if (!damageType) return { ancestry, resistances, rejected: true };
  const merged = new Set(resistances);
  merged.add(damageType);
  return { ancestry, resistances: Array.from(merged) };
}

// ============================================================================
// Draconic Resilience
// ============================================================================

/** +1 hit point per sorcerer level. */
export function calculateDraconicResilienceHpBonus(sorcererLevel: number): number {
  return Math.max(0, Math.floor(sorcererLevel));
}

/** Unarmored AC of 10 + Dexterity modifier + Charisma modifier. */
export function calculateDraconicResilienceAc(dexScore: number, charismaScore: number): number {
  return DRACONIC_RESILIENCE_AC_BASE
    + getAbilityModifierValue(dexScore)
    + getAbilityModifierValue(charismaScore);
}
