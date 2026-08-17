// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:25:27
 * Dependents: utils/combat/index.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Battle Master (Fighter) superiority dice and maneuver resolution.
 *
 * The level-3 `combat_superiority` grant needs a production resource model, not
 * a preview-only button. This file owns the canonical 2024 pool (four d8 dice,
 * restored on a Short or Long Rest), the maneuver catalog, and the resolver that
 * spends a die, adds its d8 to the attack's damage (or attack roll for Precision
 * Attack), and applies the authored save-gated condition for Trip and Menacing
 * Attack. The dice live in the same `limitedUses` shape the character sheet and
 * rest logic already track, so spending here is visible to every other surface.
 */

import type { ActiveCondition, CombatCharacter, CombatState, StatusEffect } from '../../types/combat';
import type { LimitedUses } from '../../types/character';
import type { SavingThrowAbility } from '../../types/spells';
import { getAbilityModifierValue } from '../character/statUtils';
import {
  calculateProficiencyBonus,
  rollSavingThrow,
  type SavingThrowResult,
} from '../character/savingThrowUtils';
import { rollDice } from './combatUtils';
import { applyRuntimeStatusCondition } from './statusConditionUtils';

// ============================================================================
// Canonical Resource Contract
// ============================================================================
// The 2024 Battle Master begins with four d8 Superiority Dice and regains them
// on a Short or Long Rest. The pool is stored as a `limitedUses` entry so the
// existing resource, UI, and rest machinery owns reset without a parallel table.
// ============================================================================

export const BATTLE_MASTER_SUPERIORITY_DICE_KEY = 'superiority_dice';
export const BATTLE_MASTER_SUPERIORITY_DICE_MAX = 4;
// Dice notation the shared roller parses (`1d8`), matching how the rest of the
// combat helpers spell single-die formulas.
export const SUPERIORITY_DIE = '1d8';

// ============================================================================
// Maneuver Catalog
// ============================================================================
// Each maneuver keeps its authored rider here so spending, save resolution, and
// condition application stay in one place instead of being re-decided per caller.
// ============================================================================

export interface BattleMasterManeuver {
  id: string;
  name: string;
  description: string;
  /** Adds the superiority die to the attack's damage on a hit. */
  addsDamage: boolean;
  /** Adds the superiority die to the attack roll (Precision Attack). */
  addsAttackRollBonus: boolean;
  /** Save the target makes to avoid the rider. */
  saveAbility?: SavingThrowAbility;
  /** Canonical condition applied when the target fails the save. */
  conditionOnFailedSave?: string;
}

export const BATTLE_MASTER_MANEUVERS: Record<string, BattleMasterManeuver> = {
  trip_attack: {
    id: 'trip_attack',
    name: 'Trip Attack',
    description: 'Add the superiority die to the damage, and the target must succeed on a Strength save or fall Prone.',
    addsDamage: true,
    addsAttackRollBonus: false,
    saveAbility: 'Strength',
    conditionOnFailedSave: 'Prone',
  },
  menacing_attack: {
    id: 'menacing_attack',
    name: 'Menacing Attack',
    description: 'Add the superiority die to the damage, and the target must succeed on a Wisdom save or be Frightened.',
    addsDamage: true,
    addsAttackRollBonus: false,
    saveAbility: 'Wisdom',
    conditionOnFailedSave: 'Frightened',
  },
  precision_attack: {
    id: 'precision_attack',
    name: 'Precision Attack',
    description: 'Add the superiority die to the attack roll, possibly turning a miss into a hit.',
    addsDamage: false,
    addsAttackRollBonus: true,
  },
};

export function isBattleMasterManeuver(id: string): id is keyof typeof BATTLE_MASTER_MANEUVERS {
  return id in BATTLE_MASTER_MANEUVERS;
}

// ============================================================================
// Superiority Dice Resource Helpers
// ============================================================================
// These preserve the immutable character contract: each transition returns a
// fresh object and leaves the original snapshot untouched. The `limitedUses`
// entry keeps the same `resetOn` metadata the rest system already understands.
// ============================================================================

export interface SuperiorityDicePool {
  current: number;
  max: number;
}

// The helpers only read/write `limitedUses`, so they stay usable on both the
// character sheet (`PlayerCharacter`) and the combat runtime (`CombatCharacter`).
interface HasLimitedUses {
  limitedUses?: LimitedUses;
}

export function getSuperiorityDice(character: HasLimitedUses): SuperiorityDicePool {
  const pool = character.limitedUses?.[BATTLE_MASTER_SUPERIORITY_DICE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : BATTLE_MASTER_SUPERIORITY_DICE_MAX;
  const current = typeof pool?.current === 'number' ? pool.current : max;
  return { current, max };
}

function setSuperiorityDice<T extends HasLimitedUses>(character: T, current: number): T {
  const { max } = getSuperiorityDice(character);
  const nextUses: LimitedUses = {
    ...(character.limitedUses ?? {}),
    [BATTLE_MASTER_SUPERIORITY_DICE_KEY]: {
      name: 'Superiority Dice',
      current: Math.max(0, current),
      max,
      resetOn: 'short_rest',
    },
  };
  return { ...character, limitedUses: nextUses };
}

export function grantSuperiorityDice<T extends HasLimitedUses>(
  character: T,
  count: number = BATTLE_MASTER_SUPERIORITY_DICE_MAX,
): T {
  const nextUses: LimitedUses = {
    ...(character.limitedUses ?? {}),
    [BATTLE_MASTER_SUPERIORITY_DICE_KEY]: {
      name: 'Superiority Dice',
      current: count,
      max: count,
      resetOn: 'short_rest',
    },
  };
  return { ...character, limitedUses: nextUses };
}

export function spendSuperiorityDie<T extends HasLimitedUses>(character: T): T {
  const { current } = getSuperiorityDice(character);
  if (current <= 0) return character;
  return setSuperiorityDice(character, current - 1);
}

export function restoreSuperiorityDice<T extends HasLimitedUses>(character: T): T {
  const { max } = getSuperiorityDice(character);
  return setSuperiorityDice(character, max);
}

// ============================================================================
// Maneuver Save DC
// ============================================================================
// The 2024 maneuver save DC is 8 + Proficiency Bonus + the higher of Strength
// or Dexterity modifier, matching the fighter's martial-training options.
// ============================================================================

export function calculateManeuverSaveDc(attacker: CombatCharacter): number {
  const proficiency = calculateProficiencyBonus(attacker.level ?? 1);
  const strengthMod = getAbilityModifierValue(attacker.stats.strength);
  const dexterityMod = getAbilityModifierValue(attacker.stats.dexterity);
  return 8 + proficiency + Math.max(strengthMod, dexterityMod);
}

// ============================================================================
// Maneuver Resolution
// ============================================================================
// One transaction owns dice spending, the d8 roll, the damage/attack bonus, and
// the save-gated condition. A missing actor, unknown maneuver, or exhausted pool
// rejects the whole resolution without changing state, so a caller can never pay
// a die and then discover the rider was illegal.
// ============================================================================

export type ManeuverResolutionFailure =
  | 'attacker_missing'
  | 'target_missing'
  | 'unknown_maneuver'
  | 'no_superiority_dice';

export interface ManeuverResolution {
  state: CombatState;
  resolved: boolean;
  failure?: ManeuverResolutionFailure;
  maneuverId?: string;
  dieRolled?: number;
  damageBonus?: number;
  attackRollBonus?: number;
  save?: SavingThrowResult;
  conditionApplied?: string;
}

export function resolveBattleMasterManeuver(
  state: CombatState,
  request: {
    attackerId: string;
    targetId: string;
    maneuverId: string;
    dieRng?: () => number;
    saveRng?: () => number;
  },
): ManeuverResolution {
  const attacker = state.characters.find(character => character.id === request.attackerId);
  if (!attacker) {
    return { state, resolved: false, failure: 'attacker_missing' };
  }

  const maneuver = BATTLE_MASTER_MANEUVERS[request.maneuverId];
  if (!maneuver) {
    return { state, resolved: false, failure: 'unknown_maneuver' };
  }

  const { current } = getSuperiorityDice(attacker);
  if (current <= 0) {
    return { state, resolved: false, failure: 'no_superiority_dice' };
  }

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) {
    return { state, resolved: false, failure: 'target_missing' };
  }

  // Spend the die up front and roll the d8 once. Precision Attack feeds that
  // roll into the attack roll; Trip and Menacing feed it into damage.
  const spentAttacker = spendSuperiorityDie(attacker);
  const dieRolled = rollDice(SUPERIORITY_DIE, { rng: request.dieRng });

  let nextState: CombatState = {
    ...state,
    characters: state.characters.map(character => (
      character.id === attacker.id ? spentAttacker : character
    )),
  };

  let save: SavingThrowResult | undefined;
  let conditionApplied: string | undefined;

  if (maneuver.saveAbility && maneuver.conditionOnFailedSave) {
    const dc = calculateManeuverSaveDc(attacker);
    const saveResult = rollSavingThrow(target, maneuver.saveAbility, dc, [], undefined, undefined, {
      rng: request.saveRng,
    });
    save = saveResult;

    if (!saveResult.success) {
      const statusEffect: StatusEffect = {
        id: `battle-master-${maneuver.id}-${attacker.id}-${target.id}`,
        name: maneuver.conditionOnFailedSave,
        type: 'debuff',
        duration: 1,
        source: maneuver.name,
        sourceCasterId: attacker.id,
        effect: { type: 'condition' },
      };
      const condition: ActiveCondition = {
        name: maneuver.conditionOnFailedSave,
        duration: { type: 'rounds', value: 1 },
        appliedTurn: state.turnState?.currentTurn ?? 0,
        source: maneuver.name,
        sourceCasterId: attacker.id,
      };
      const applied = applyRuntimeStatusCondition(target, statusEffect, condition).character;
      conditionApplied = maneuver.conditionOnFailedSave;
      nextState = {
        ...nextState,
        characters: nextState.characters.map(character => (
          character.id === target.id ? applied : character
        )),
      };
    }
  }

  return {
    state: nextState,
    resolved: true,
    maneuverId: maneuver.id,
    dieRolled,
    damageBonus: maneuver.addsDamage ? dieRolled : undefined,
    attackRollBonus: maneuver.addsAttackRollBonus ? dieRolled : undefined,
    save,
    conditionApplied,
  };
}
