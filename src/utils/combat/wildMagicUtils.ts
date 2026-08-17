// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:25:11
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
 * Wild Magic Sorcery (Sorcerer) Wild Magic Surge and Tides of Chaos.
 *
 * A qualifying spell cast triggers a Wild Magic Surge check: roll a d20 and a 1
 * forces a roll on the Wild Magic table. Tides of Chaos grants advantage on one
 * roll and then opens the surge window again. This file owns the surge check, an
 * authored surge table, and the Tides of Chaos resource transaction, so a caller
 * does not hand-roll the threshold or the table in preview text. Both are gated
 * on their feature abilities.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import type { LimitedUses } from '../../types/character';

export const WILD_MAGIC_SURGE_FEATURE_ID = 'wild_magic_surge';
export const TIDES_OF_CHAOS_FEATURE_ID = 'tides_of_chaos';
export const TIDES_OF_CHAOS_RESOURCE_KEY = 'tides_of_chaos';
export const TIDES_OF_CHAOS_DEFAULT_USES = 1;
export const WILD_MAGIC_SURGE_TRIGGER_ROLL = 1;

export function hasWildMagicSurge(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === WILD_MAGIC_SURGE_FEATURE_ID);
}

export function hasTidesOfChaos(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === TIDES_OF_CHAOS_FEATURE_ID);
}

// ============================================================================
// Wild Magic Surge Check
// ============================================================================

export interface WildMagicSurgeCheck {
  surgeTriggered: boolean;
  d20Roll: number;
}

export function resolveWildMagicSurgeCheck(character: CombatCharacter, d20Roll: number): WildMagicSurgeCheck {
  if (!hasWildMagicSurge(character)) return { surgeTriggered: false, d20Roll };
  return { surgeTriggered: d20Roll === WILD_MAGIC_SURGE_TRIGGER_ROLL, d20Roll };
}

// ============================================================================
// Wild Magic Surge Table
// ============================================================================
// A representative authored slice of the canonical table. The full 100-entry
// table is data that can be extended later; this keeps the resolver deterministic
// and honest about which effects are owned today.
// ============================================================================

export interface WildMagicSurgeEffect {
  id: string;
  name: string;
  description: string;
}

export const WILD_MAGIC_SURGE_TABLE: WildMagicSurgeEffect[] = [
  { id: 'fireball', name: 'Fireball', description: 'You cast Fireball centered on yourself.' },
  { id: 'confusion', name: 'Confusion', description: 'You cast Confusion centered on yourself.' },
  { id: 'invisibility', name: 'Invisibility', description: 'You cast Invisibility on yourself.' },
  { id: 'polymorph_sheep', name: 'Polymorph (Sheep)', description: 'You transform into a sheep for the next minute.' },
  { id: 'regain_sorcery_points', name: 'Regain Sorcery Points', description: 'You regain 2 Sorcery Points.' },
  { id: 'maximize_next_spell', name: 'Maximize Next Spell', description: 'The next spell you cast deals maximum damage.' },
  { id: 'resistance_all', name: 'Resistance to All Damage', description: 'You gain resistance to all damage for one minute.' },
  { id: 'teleport', name: 'Teleport', description: 'You teleport up to 60 feet to an unoccupied space you can see.' },
];

export function rollWildMagicSurgeEffect(rng: () => number = Math.random): WildMagicSurgeEffect {
  const index = Math.min(WILD_MAGIC_SURGE_TABLE.length - 1, Math.floor(rng() * WILD_MAGIC_SURGE_TABLE.length));
  return WILD_MAGIC_SURGE_TABLE[index];
}

// ============================================================================
// Tides of Chaos
// ============================================================================

export function getTidesOfChaosUses(character: CombatCharacter): number {
  const pool = character.limitedUses?.[TIDES_OF_CHAOS_RESOURCE_KEY];
  if (typeof pool?.current === 'number') return pool.current;
  return TIDES_OF_CHAOS_DEFAULT_USES;
}

export type TidesOfChaosFailure = 'sorcerer_missing' | 'missing_tides_of_chaos' | 'no_uses';

export interface TidesOfChaosResult {
  state: CombatState;
  resolved: boolean;
  failure?: TidesOfChaosFailure;
  advantageGranted: boolean;
  remainingUses?: number;
}

export function resolveTidesOfChaos(
  state: CombatState,
  request: { sorcererId: string },
): TidesOfChaosResult {
  const sorcerer = state.characters.find(character => character.id === request.sorcererId);
  if (!sorcerer) return { state, resolved: false, advantageGranted: false, failure: 'sorcerer_missing' };
  if (!hasTidesOfChaos(sorcerer)) {
    return { state, resolved: false, advantageGranted: false, failure: 'missing_tides_of_chaos' };
  }
  if (getTidesOfChaosUses(sorcerer) <= 0) {
    return { state, resolved: false, advantageGranted: false, failure: 'no_uses' };
  }

  const pool = sorcerer.limitedUses?.[TIDES_OF_CHAOS_RESOURCE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : TIDES_OF_CHAOS_DEFAULT_USES;
  const current = getTidesOfChaosUses(sorcerer) - 1;
  const nextUses: LimitedUses = {
    ...(sorcerer.limitedUses ?? {}),
    [TIDES_OF_CHAOS_RESOURCE_KEY]: {
      name: 'Tides of Chaos',
      current,
      max,
      resetOn: 'long_rest',
    },
  };
  const nextSorcerer: CombatCharacter = {
    ...sorcerer,
    limitedUses: nextUses,
    statusEffects: [
      ...sorcerer.statusEffects,
      {
        id: TIDES_OF_CHAOS_RESOURCE_KEY,
        name: 'Tides of Chaos',
        type: 'buff',
        duration: 1,
        source: 'Tides of Chaos',
        icon: '🌀',
      },
    ],
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === sorcerer.id ? nextSorcerer : character
      )),
    },
    resolved: true,
    advantageGranted: true,
    remainingUses: current,
  };
}
