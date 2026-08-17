// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:28:03
 * Dependents: utils/combat/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Archfey Patron (Warlock) Fey Presence — an area-of-effect save transaction.
 *
 * As an Action the warlock projects a 10-foot cube; each creature inside makes
 * a Wisdom saving throw or is Charmed or Frightened (warlock's choice) until the
 * end of the warlock's next turn. This file owns the cube target set, the Wisdom
 * save against the warlock's spell save DC, the chosen outcome, and the
 * once-per-Short-or-Long-Rest resource spend. It is gated on the `fey_presence`
 * ability.
 */

import type { ActiveCondition, CombatCharacter, CombatState, StatusEffect } from '../../types/combat';
import type { LimitedUses } from '../../types/character';
import { getAbilityModifierValue } from '../character/statUtils';
import { calculateProficiencyBonus, rollSavingThrow, type SavingThrowResult } from '../character/savingThrowUtils';
import { applyRuntimeStatusCondition } from './statusConditionUtils';

export const FEY_PRESENCE_FEATURE_ID = 'fey_presence';
export const FEY_PRESENCE_RESOURCE_KEY = 'fey_presence';
export const FEY_PRESENCE_DEFAULT_USES = 1;
export const FEY_PRESENCE_CUBE_TILES = 2; // a 10-foot cube on a 5-foot grid

export type FeyPresenceOutcome = 'charmed' | 'frightened';

export function isFeyPresenceOutcome(id: string): id is FeyPresenceOutcome {
  return id === 'charmed' || id === 'frightened';
}

export function hasFeyPresence(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === FEY_PRESENCE_FEATURE_ID);
}

export function getFeyPresenceUses(character: CombatCharacter): number {
  const pool = character.limitedUses?.[FEY_PRESENCE_RESOURCE_KEY];
  if (typeof pool?.current === 'number') return pool.current;
  return FEY_PRESENCE_DEFAULT_USES;
}

function spendFeyPresenceUse(character: CombatCharacter): CombatCharacter {
  const uses = getFeyPresenceUses(character);
  if (uses <= 0) return character;
  const pool = character.limitedUses?.[FEY_PRESENCE_RESOURCE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : FEY_PRESENCE_DEFAULT_USES;
  const nextUses: LimitedUses = {
    ...(character.limitedUses ?? {}),
    [FEY_PRESENCE_RESOURCE_KEY]: {
      name: 'Fey Presence',
      current: uses - 1,
      max,
      resetOn: 'short_rest',
    },
  };
  return { ...character, limitedUses: nextUses };
}

export function calculateFeyPresenceSaveDc(warlock: CombatCharacter): number {
  const proficiency = calculateProficiencyBonus(warlock.level ?? 1);
  const charismaMod = getAbilityModifierValue(warlock.stats.charisma);
  return 8 + proficiency + charismaMod;
}

export interface FeyPresenceTargetOutcome {
  targetId: string;
  save: SavingThrowResult;
  affected: boolean;
}

export type FeyPresenceFailure =
  | 'warlock_missing'
  | 'missing_fey_presence'
  | 'unknown_outcome'
  | 'no_uses';

export interface FeyPresenceResult {
  state: CombatState;
  resolved: boolean;
  failure?: FeyPresenceFailure;
  outcome?: FeyPresenceOutcome;
  targets?: FeyPresenceTargetOutcome[];
  remainingUses?: number;
}

export function resolveFeyPresence(
  state: CombatState,
  request: { warlockId: string; outcome: string; rng?: () => number },
): FeyPresenceResult {
  const warlock = state.characters.find(character => character.id === request.warlockId);
  if (!warlock) return { state, resolved: false, failure: 'warlock_missing' };
  if (!hasFeyPresence(warlock)) return { state, resolved: false, failure: 'missing_fey_presence' };
  if (!isFeyPresenceOutcome(request.outcome)) return { state, resolved: false, failure: 'unknown_outcome' };
  if (getFeyPresenceUses(warlock) <= 0) return { state, resolved: false, failure: 'no_uses' };

  const outcome = request.outcome;
  const dc = calculateFeyPresenceSaveDc(warlock);
  const conditionName = outcome === 'charmed' ? 'Charmed' : 'Frightened';

  let nextState: CombatState = {
    ...state,
    characters: state.characters.map(character => (
      character.id === warlock.id ? spendFeyPresenceUse(character) : character
    )),
  };

  const targets: FeyPresenceTargetOutcome[] = [];
  for (const target of state.characters) {
    if (target.id === warlock.id) continue;
    const dx = target.position.x - warlock.position.x;
    const dy = target.position.y - warlock.position.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > FEY_PRESENCE_CUBE_TILES) continue;

    const save = rollSavingThrow(target, 'Wisdom', dc, [], undefined, undefined, {
      rng: request.rng,
    });
    const affected = !save.success;
    targets.push({ targetId: target.id, save, affected });

    if (affected) {
      const statusEffect: StatusEffect = {
        id: `fey-presence-${outcome}-${warlock.id}-${target.id}`,
        name: conditionName,
        type: 'debuff',
        duration: 1,
        source: 'Fey Presence',
        sourceCasterId: warlock.id,
        effect: { type: 'condition' },
      };
      const condition: ActiveCondition = {
        name: conditionName,
        duration: { type: 'rounds', value: 1 },
        appliedTurn: state.turnState?.currentTurn ?? 0,
        source: 'Fey Presence',
        sourceCasterId: warlock.id,
      };
      const applied = applyRuntimeStatusCondition(target, statusEffect, condition).character;
      nextState = {
        ...nextState,
        characters: nextState.characters.map(character => (
          character.id === target.id ? applied : character
        )),
      };
    }
  }

  const spentWarlock = nextState.characters.find(character => character.id === warlock.id);

  return {
    state: nextState,
    resolved: true,
    outcome,
    targets,
    remainingUses: spentWarlock ? getFeyPresenceUses(spentWarlock) : 0,
  };
}
