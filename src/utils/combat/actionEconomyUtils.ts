// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/05/2026, 17:10:25
 * Dependents: hooks/combat/useActionEconomy.ts, hooks/combat/useTurnManager.ts, hooks/useAbilitySystem.ts, utils/combat/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/combat/actionEconomyUtils.ts
 * Shared helpers for the D&D-style action economy used by battle-map combat.
 *
 * The turn manager resets these counters at the start of each creature turn,
 * the action executor spends them when a character moves or uses an ability,
 * and the UI reads the same state to decide which buttons are still legal.
 */

import { CombatCharacter, ActionEconomyState, AbilityCost } from '../../types/combat';
import { SpellSlots } from '../../types';

// ============================================================================
// Economy Creation And Reset
// ============================================================================
// This section creates the per-turn counters that every combatant carries.
// They stay in one helper so players, monsters, tests, and turn starts all use
// the same shape for actions, bonus actions, reactions, movement, and free use.
// ============================================================================

/**
 * Creates a default action economy state object for a character.
 * @param moveTotal - The total movement units for the character.
 * @returns A new ActionEconomyState object.
 */
export function createDefaultActionEconomy(moveTotal: number): ActionEconomyState {
    return {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        movement: { used: 0, total: moveTotal },
        freeActions: 1,
    };
}

/**
 * Resets a character's action economy for the start of their turn.
 * @param character The character whose turn is starting.
 * @returns A new CombatCharacter object with the reset action economy.
 */
export function resetEconomy(character: CombatCharacter): CombatCharacter {
    const newEconomy: ActionEconomyState = {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 }, // Reaction resets at start of own turn in 5e
        movement: { used: 0, total: character.stats.speed },
        freeActions: 1, // Reset free actions
    };

    return { ...character, actionEconomy: newEconomy };
}

// ============================================================================
// Economy Validation And Spending
// ============================================================================
// This section answers "can this character pay this cost?" and creates the
// post-payment character state. It is shared by the hook and command bridge so
// ability effects cannot accidentally restore an action that was just spent.
// ============================================================================

/**
 * Checks whether a combatant still has enough per-turn resources to pay a cost.
 * Movement is checked in feet, spell slots are checked by level, and the action
 * type decides whether the action, bonus action, reaction, or free use is spent.
 */
export function canAffordActionCost(character: CombatCharacter | undefined, cost: AbilityCost): boolean {
    if (!character) return false;

    const economy = character.actionEconomy;

    // Movement-only actions are legal only while the character still has enough
    // movement left for the path being attempted.
    if ((cost.movementCost || 0) > economy.movement.total - economy.movement.used) {
        return false;
    }

    // Leveled spells consume from the same action path, but also need an
    // available spell slot at the requested level.
    if (cost.spellSlotLevel && cost.spellSlotLevel > 0) {
        if (!character.spellSlots) return false;
        const slotKey = `level_${cost.spellSlotLevel}` as keyof SpellSlots;
        const slot = character.spellSlots[slotKey];
        if (!slot || slot.current <= 0) {
            return false;
        }
    }

    // The cost type maps onto the D&D combat economy. A creature normally has
    // one action, one bonus action, one reaction, and one free object use.
    switch (cost.type) {
        case 'action':
            return !economy.action.used;
        case 'bonus':
            return !economy.bonusAction.used;
        case 'reaction':
            return !economy.reaction.used;
        case 'free':
            return economy.freeActions > 0;
        case 'movement-only':
            return true;
        default:
            return false;
    }
}

/**
 * Returns a new character with the requested action cost paid.
 * The original character is not changed, which lets React state updates and
 * command simulations use the same result without mutating old snapshots.
 */
export function consumeActionCost(character: CombatCharacter, cost: AbilityCost): CombatCharacter {
    const newEconomy: ActionEconomyState = {
        ...character.actionEconomy,
        action: { ...character.actionEconomy.action },
        bonusAction: { ...character.actionEconomy.bonusAction },
        reaction: { ...character.actionEconomy.reaction },
        movement: {
            ...character.actionEconomy.movement,
            used: character.actionEconomy.movement.used + (cost.movementCost || 0)
        },
    };

    // Spending the named resource marks it unavailable for the rest of this
    // creature's turn. Movement-only actions only change the movement counter.
    switch (cost.type) {
        case 'action':
            newEconomy.action = { ...newEconomy.action, used: true };
            break;
        case 'bonus':
            newEconomy.bonusAction = { ...newEconomy.bonusAction, used: true };
            break;
        case 'reaction':
            newEconomy.reaction = { ...newEconomy.reaction, used: true };
            break;
        case 'free':
            newEconomy.freeActions = Math.max(0, newEconomy.freeActions - 1);
            break;
        default:
            break;
    }

    let newCharacter: CombatCharacter = { ...character, actionEconomy: newEconomy };

    // Spell slots are part of the same "pay the cost" operation, so a spell
    // cannot resolve and then restore the slot by replaying an older character.
    if (cost.spellSlotLevel && cost.spellSlotLevel > 0 && newCharacter.spellSlots) {
        const slotKey = `level_${cost.spellSlotLevel}` as keyof SpellSlots;
        const currentSlot = newCharacter.spellSlots[slotKey];
        if (currentSlot && currentSlot.current > 0) {
            newCharacter = {
                ...newCharacter,
                spellSlots: {
                    ...newCharacter.spellSlots,
                    [slotKey]: {
                        ...currentSlot,
                        current: currentSlot.current - 1
                    }
                }
            };
        }
    }

    return newCharacter;
}
