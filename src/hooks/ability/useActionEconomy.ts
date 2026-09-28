// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:54:38
 * Dependents: hooks/ability/useAbilityExecution.ts, hooks/useAbilitySystem.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/ability/useActionEconomy.ts
 * Manages action economy budgeting, turn resource spending, and spell slot recovery.
 *
 * In tabletop combat, every character has a budget of actions each turn: an Action,
 * a Bonus Action, a Reaction, free actions, and movement distance. Characters also
 * have limited-use abilities (like once-per-day powers) and spell slots. This hook
 * and its helper functions check whether a character can afford an ability, spend
 * those resources when an ability is used, and restore spell slots when an interrupted
 * spell (such as one stopped by Counterspell) fails to resolve.
 *
 * Called by: useAbilityExecution.ts, useAbilitySystem.ts
 * Depends on: actionEconomyUtils.ts, combat types
 */

import { useCallback } from 'react';
import type { CombatCharacter, AbilityCost, Ability } from '../../types/combat';
import type { Spell } from '../../types/spells';
import { canAffordActionCost, consumeActionCost } from '../../utils/combat/actionEconomyUtils';
import { applyResourceSnapshotToCaster } from '../actionUtils';

// ============================================================================
// Action Cost Translation
// ============================================================================
// Spells with special triggers (like Counterspell or Hellish Rebuke) declare
// their required action cost in their trigger metadata. This helper translates
// that trigger declaration into a standard action economy cost object.
// ============================================================================

/**
 * Translates a spell's casting trigger cost into a standard action economy payment object.
 *
 * For example, if a spell declares that it triggers on a reaction, this produces
 * a payment object requiring 1 Reaction and the appropriate spell slot level.
 */
export const getCastingTriggerActionCost = (spell: Spell) => {
  // Casting-trigger spells pay the cost declared by their own trigger metadata.
  // Smites and Counterspell use Reactions or Bonus Actions; this keeps after-hit
  // and interruption spells on the same unified payment structure.
  const requiredCost = spell.castingTrigger?.requiredCost ?? 'reaction';
  const actionType = requiredCost === 'bonus_action' ? 'bonus' : requiredCost;

  return {
    type: actionType,
    spellSlotLevel: Math.max(spell.level ?? 0, 1)
  } as const;
};

// ============================================================================
// Spell Slot Restoration
// ============================================================================
// When a spell is interrupted by Counterspell, 5e rules state that the action
// used to cast the spell is lost, but the spell slot is preserved.
// This function gives the caster back the spent spell slot without refunding
// the spent action, bonus action, or reaction.
// ============================================================================

/**
 * Restores a spent spell slot to a caster whose spell was interrupted.
 *
 * Counterspell wastes the caster's action time, but does not consume their spell slot.
 * This helper returns a new character object with that slot incremented back by 1.
 */
export const restoreInterruptedSpellSlot = (
  caster: CombatCharacter,
  spell: Spell,
  castAtLevel: number
): CombatCharacter => {
  // Figure out which spell slot level was spent (defaulting to the spell's base level).
  const slotLevel = Math.max(castAtLevel || spell.level || 0, spell.level || 0);

  // Cantrips (level 0) don't use spell slots, and creatures without spell slots need no update.
  if (slotLevel <= 0 || !caster.spellSlots) {
    return caster;
  }

  const slotKey = `level_${slotLevel}` as keyof NonNullable<CombatCharacter['spellSlots']>;
  const currentSlot = caster.spellSlots[slotKey];

  if (!currentSlot) {
    return caster;
  }

  // Restore one slot up to the maximum capacity.
  const restoredCurrent = Math.min(currentSlot.max, currentSlot.current + 1);

  // If the slot is already full, make no changes.
  if (restoredCurrent === currentSlot.current) {
    return caster;
  }

  // Return a new character record with the restored slot count.
  return {
    ...caster,
    spellSlots: {
      ...caster.spellSlots,
      [slotKey]: {
        ...currentSlot,
        current: restoredCurrent
      }
    }
  };
};

// ============================================================================
// Ability Usage and Cooldown Accounting
// ============================================================================
// Some abilities can only be used once per day, recharge on specific dice rolls,
// or have round-based cooldown timers. This helper updates those tracking fields
// on the character after the ability has successfully fired.
// ============================================================================

/**
 * Updates an ability's cooldown, recharge state, and remaining daily uses on a character.
 */
export const applyAbilityUsageState = (
  caster: CombatCharacter,
  ability: Ability,
  casterAfterCost?: CombatCharacter
): CombatCharacter => {
  // Start from the caster with action economy costs already applied if provided.
  const baseCaster = casterAfterCost ? applyResourceSnapshotToCaster(caster, casterAfterCost) : caster;

  // Handle round-based cooldowns (e.g. abilities that need 3 turns to cool down).
  if (ability.cooldown) {
    return {
      ...baseCaster,
      abilities: baseCaster.abilities.map(a =>
        a.id === ability.id ? { ...a, currentCooldown: ability.cooldown } : a
      )
    };
  }

  // Handle recharge abilities (e.g. Dragon Breath recharging on a d6 roll of 5-6).
  if (ability.recharge?.threshold) {
    return {
      ...baseCaster,
      abilities: baseCaster.abilities.map(a =>
        a.id === ability.id ? { ...a, isRecharging: true } : a
      )
    };
  }

  // Handle limited-use abilities (e.g. 1/Day or 3/Day powers).
  // Uses bottom out at 0 so the ability remains visible in UI inspect panels even when spent.
  if (ability.maxUses !== undefined) {
    return {
      ...baseCaster,
      abilities: baseCaster.abilities.map(a =>
        a.id === ability.id
          ? { ...a, usesRemaining: Math.max(0, (a.usesRemaining ?? a.maxUses ?? 1) - 1) }
          : a
      )
    };
  }

  return baseCaster;
};

// ============================================================================
// React Sub-Hook: useActionEconomy
// ============================================================================
// Provides memoized action economy checking, cost consumption, and slot recovery
// for combat components and ability orchestrators.
// ============================================================================

export const useActionEconomy = () => {
  // Check if a character has enough actions/bonus actions/reactions left to pay for an ability.
  const canAfford = useCallback((character: CombatCharacter | undefined, cost: AbilityCost): boolean => {
    return canAffordActionCost(character, cost);
  }, []);

  // Deduct the ability's required actions/bonus actions/reactions from the character.
  const consumeAction = useCallback((character: CombatCharacter, cost: AbilityCost): CombatCharacter => {
    return consumeActionCost(character, cost);
  }, []);

  // Restore a spell slot if casting was interrupted.
  const restoreInterruptedSlot = useCallback((caster: CombatCharacter, spell: Spell, castAtLevel: number): CombatCharacter => {
    return restoreInterruptedSpellSlot(caster, spell, castAtLevel);
  }, []);

  // Update cooldown and limited-use counters.
  const updateUsageState = useCallback((caster: CombatCharacter, ability: Ability, casterAfterCost?: CombatCharacter): CombatCharacter => {
    return applyAbilityUsageState(caster, ability, casterAfterCost);
  }, []);

  return {
    canAfford,
    consumeAction,
    restoreInterruptedSlot,
    updateUsageState,
    getCastingTriggerActionCost,
  };
};

export type UseActionEconomyReturn = ReturnType<typeof useActionEconomy>;
