// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:48:17
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
 * Light Domain (Cleric) Warding Flare and Domain Spells.
 *
 * Warding Flare spends a Reaction and one use (Wisdom-modifier uses per Long
 * Rest) to impose Disadvantage on an incoming attack roll. This file owns the
 * resource debit, Reaction payment, and the deterministic disadvantage outcome
 * the attack resolver reads, plus the always-prepared Light Domain spell list.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import type { LimitedUses } from '../../types/character';

export const WARDING_FLARE_ABILITY_ID = 'warding_flare';
export const WARDING_FLARE_RESOURCE_KEY = 'warding_flare';
export const WARDING_FLARE_DEFAULT_USES = 2;

export type WardingFlareFailure =
  | 'caster_missing'
  | 'not_light_domain'
  | 'reaction_unavailable'
  | 'no_warding_flare_uses';

export interface WardingFlareResult {
  state: CombatState;
  resolved: boolean;
  failure?: WardingFlareFailure;
  disadvantageApplied?: boolean;
  remainingUses?: number;
}

export function isLightDomainCaster(caster: CombatCharacter): boolean {
  return caster.abilities.some(ability => ability.id === WARDING_FLARE_ABILITY_ID);
}

export function getWardingFlareUses(caster: CombatCharacter): number {
  const pool = caster.limitedUses?.[WARDING_FLARE_RESOURCE_KEY];
  if (typeof pool?.current === 'number') return pool.current;
  return WARDING_FLARE_DEFAULT_USES;
}

export function canUseWardingFlare(caster: CombatCharacter): boolean {
  return (
    isLightDomainCaster(caster)
    && !caster.actionEconomy.reaction.used
    && getWardingFlareUses(caster) > 0
  );
}

// ============================================================================
// Warding Flare Transaction
// ============================================================================
// One Reaction + one use produce one Disadvantage result on the incoming attack.
// Both resources are paid only after eligibility is confirmed, so a failed
// reaction or an exhausted pool never spends either.
// ============================================================================

export function resolveWardingFlare(
  state: CombatState,
  request: { casterId: string; attackerId: string },
): WardingFlareResult {
  const caster = state.characters.find(character => character.id === request.casterId);
  if (!caster) {
    return { state, resolved: false, failure: 'caster_missing' };
  }

  if (!isLightDomainCaster(caster)) {
    return { state, resolved: false, failure: 'not_light_domain' };
  }

  if (caster.actionEconomy.reaction.used) {
    return { state, resolved: false, failure: 'reaction_unavailable' };
  }

  const uses = getWardingFlareUses(caster);
  if (uses <= 0) {
    return { state, resolved: false, failure: 'no_warding_flare_uses' };
  }

  const pool = caster.limitedUses?.[WARDING_FLARE_RESOURCE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : uses;
  const nextUses: LimitedUses = {
    ...(caster.limitedUses ?? {}),
    [WARDING_FLARE_RESOURCE_KEY]: {
      name: 'Warding Flare',
      current: uses - 1,
      max,
      resetOn: 'long_rest',
    },
  };
  const nextCaster: CombatCharacter = {
    ...caster,
    limitedUses: nextUses,
    actionEconomy: {
      ...caster.actionEconomy,
      reaction: { ...caster.actionEconomy.reaction, used: true, remaining: 0 },
    },
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === caster.id ? nextCaster : character
      )),
    },
    resolved: true,
    disadvantageApplied: true,
    remainingUses: uses - 1,
  };
}

// ============================================================================
// Domain Spells (always prepared)
// ============================================================================

export const LIGHT_DOMAIN_SPELL_IDS = [
  'burning_hands',
  'faerie_fire',
  'scorching_ray',
  'daylight',
  'fireball',
  'wall_of_fire',
];

export function mergeLightDomainPreparedSpells(preparedSpells: string[]): string[] {
  const merged = new Set(preparedSpells);
  for (const id of LIGHT_DOMAIN_SPELL_IDS) {
    merged.add(id);
  }
  return Array.from(merged);
}
