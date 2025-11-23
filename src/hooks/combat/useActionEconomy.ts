/**
 * @file src/hooks/combat/useActionEconomy.ts
 * Manages the action economy for a character in combat.
 */
import { CombatCharacter, AbilityCost } from '../../types/combat';
import { SpellSlots } from '../../types';

export const useActionEconomy = () => {
    
    /**
     * Checks if a character can afford to pay the cost of an ability.
     * @param character The character performing the action.
     * @param cost The cost of the ability.
     * @returns True if the character can afford the action, false otherwise.
     */
    const canAfford = (character: CombatCharacter | undefined, cost: AbilityCost): boolean => {
        if (!character) return false;
        
        const eco = character.actionEconomy;
        
        // 1. Check Movement
        if ((cost.movementCost || 0) > eco.movement.total - eco.movement.used) {
            return false;
        }

        // 2. Check Spell Slots
        if (cost.spellSlotLevel && cost.spellSlotLevel > 0) {
            if (!character.spellSlots) return false;
            const slotKey = `level_${cost.spellSlotLevel}` as keyof SpellSlots;
            const slot = character.spellSlots[slotKey];
            if (!slot || slot.current <= 0) {
                return false;
            }
        }
        
        // 3. Check Action Economy Types
        switch (cost.type) {
            case 'action':
                return !eco.action.used;
            case 'bonus':
                return !eco.bonusAction.used;
            case 'reaction':
                return !eco.reaction.used;
            case 'free':
                return eco.freeActions > 0;
            case 'movement-only':
                return true; // Only checked against movement cost above
            default:
                return false;
        }
    };

    /**
     * Consumes resources from a character's action economy based on an ability's cost.
     * @param character The character whose resources are being consumed.
     * @param cost The cost of the ability.
     * @returns A new CombatCharacter object with the updated action economy. Does not mutate the original.
     */
    const consumeAction = (character: CombatCharacter, cost: AbilityCost): CombatCharacter => {
        // Deep copy necessary parts
        const newCharacter = { ...character };
        const newEconomy = { ...character.actionEconomy };
        
        // Consume Movement
        newEconomy.movement = {
            ...newEconomy.movement,
            used: newEconomy.movement.used + (cost.movementCost || 0)
        };

        // Consume Action Type
        switch(cost.type) {
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

        newCharacter.actionEconomy = newEconomy;

        // Consume Spell Slot
        if (cost.spellSlotLevel && cost.spellSlotLevel > 0 && newCharacter.spellSlots) {
            const slotKey = `level_${cost.spellSlotLevel}` as keyof SpellSlots;
            const currentSlot = newCharacter.spellSlots[slotKey];
            if (currentSlot && currentSlot.current > 0) {
                newCharacter.spellSlots = {
                    ...newCharacter.spellSlots,
                    [slotKey]: {
                        ...currentSlot,
                        current: currentSlot.current - 1
                    }
                };
            }
        }

        return newCharacter;
    };

    /**
     * Resets a character's action economy for the start of their turn.
     * @param character The character whose turn is starting.
     * @returns A new CombatCharacter object with the reset action economy.
     */
    const resetEconomy = (character: CombatCharacter): CombatCharacter => {
        const newEconomy = {
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            reaction: { used: false, remaining: 1 }, // Reaction resets at start of own turn in 5e
            movement: { used: 0, total: character.stats.speed },
            freeActions: 1, // Reset free actions
        };

        return { ...character, actionEconomy: newEconomy };
    };

    return { canAfford, consumeAction, resetEconomy };
};