
/**
 * @file src/state/reducers/characterReducer.ts
 * A slice reducer that handles character-related state changes (party, inventory, actions).
 */
import { GameState, LimitedUseAbility, SpellSlots, DiscoveryType, Item, RacialSelectionData } from '../../types';
import { AppAction } from '../actionTypes';
import { calculateArmorClass, createPlayerCharacterFromTemp, calculateFinalAbilityScores, getAbilityModifierValue } from '../../utils/characterUtils';
import { LOCATIONS, ITEMS, CLASSES_DATA } from '../../constants';

// Helper for resetting limited uses
const resolveMaxValue = (char: GameState['party'][0], ability: LimitedUseAbility): number => {
    if (typeof ability.max === 'number') return ability.max;
    // This is a simplified version. A full implementation would check specific ability modifiers.
    if (ability.max === 'proficiency_bonus') return char.proficiencyBonus || 2;
    return 1; // Fallback
};

export function characterReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'SET_PARTY_COMPOSITION':
            return {
                party: action.payload.map(tempMember => createPlayerCharacterFromTemp(tempMember)),
                tempParty: action.payload,
            };

        case 'ADD_GENERATED_CHARACTER':
            return {
                party: [...state.party, action.payload],
            };

        case 'EQUIP_ITEM': {
            const { itemId, characterId } = action.payload;
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            const itemToEquip = state.inventory.find(item => item.id === itemId);
            if (!itemToEquip) return {};

            const isOneHandedWeapon = itemToEquip.type === 'weapon' && !itemToEquip.properties?.includes('Two-Handed');
            let targetSlot = isOneHandedWeapon
                ? (!charToUpdate.equippedItems.MainHand ? 'MainHand' : !charToUpdate.equippedItems.OffHand ? 'OffHand' : 'MainHand')
                : itemToEquip.slot || null;

            if (!targetSlot) return {};

            const newEquippedItems = { ...charToUpdate.equippedItems };
            const newInventory = [...state.inventory];
            const itemInSlot = newEquippedItems[targetSlot];

            if (itemInSlot) newInventory.push(itemInSlot);

            newEquippedItems[targetSlot] = itemToEquip;
            const itemIndexInInventory = newInventory.findIndex(item => item.id === itemId);
            if (itemIndexInInventory > -1) newInventory.splice(itemIndexInInventory, 1);

            const updatedPlayerCharacter = { ...charToUpdate, equippedItems: newEquippedItems };

            // Recalculate Stats
            updatedPlayerCharacter.finalAbilityScores = calculateFinalAbilityScores(
                updatedPlayerCharacter.abilityScores,
                updatedPlayerCharacter.race,
                updatedPlayerCharacter.equippedItems
            );

            // Recalculate Max HP (if Con changed)
            const conMod = getAbilityModifierValue(updatedPlayerCharacter.finalAbilityScores.Constitution);
            updatedPlayerCharacter.maxHp = updatedPlayerCharacter.class.hitDie + conMod + (updatedPlayerCharacter.level! - 1) * (Math.floor(updatedPlayerCharacter.class.hitDie / 2) + 1 + conMod);
            // Ensure current HP doesn't exceed new Max HP
            if (updatedPlayerCharacter.hp > updatedPlayerCharacter.maxHp) {
                updatedPlayerCharacter.hp = updatedPlayerCharacter.maxHp;
            }

            updatedPlayerCharacter.armorClass = calculateArmorClass(updatedPlayerCharacter);

            const newParty = [...state.party];
            newParty[charIndex] = updatedPlayerCharacter;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedPlayerCharacter.id
                ? { ...state.characterSheetModal, character: updatedPlayerCharacter }
                : state.characterSheetModal;

            return { party: newParty, inventory: newInventory, characterSheetModal: newCharacterSheetModalState };
        }

        case 'UNEQUIP_ITEM': {
            const { slot, characterId } = action.payload;
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            const itemToUnequip = charToUpdate.equippedItems[slot];
            if (!itemToUnequip) return {};

            const newEquippedItems = { ...charToUpdate.equippedItems };
            delete newEquippedItems[slot];

            const updatedPlayerCharacter = { ...charToUpdate, equippedItems: newEquippedItems };

            // Recalculate Stats
            updatedPlayerCharacter.finalAbilityScores = calculateFinalAbilityScores(
                updatedPlayerCharacter.abilityScores,
                updatedPlayerCharacter.race,
                updatedPlayerCharacter.equippedItems
            );

            // Recalculate Max HP (if Con changed)
            const conMod = getAbilityModifierValue(updatedPlayerCharacter.finalAbilityScores.Constitution);
            updatedPlayerCharacter.maxHp = updatedPlayerCharacter.class.hitDie + conMod + (updatedPlayerCharacter.level! - 1) * (Math.floor(updatedPlayerCharacter.class.hitDie / 2) + 1 + conMod);
            // Ensure current HP doesn't exceed new Max HP
            if (updatedPlayerCharacter.hp > updatedPlayerCharacter.maxHp) {
                updatedPlayerCharacter.hp = updatedPlayerCharacter.maxHp;
            }

            updatedPlayerCharacter.armorClass = calculateArmorClass(updatedPlayerCharacter);

            const newParty = [...state.party];
            newParty[charIndex] = updatedPlayerCharacter;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedPlayerCharacter.id
                ? { ...state.characterSheetModal, character: updatedPlayerCharacter }
                : state.characterSheetModal;

            return {
                party: newParty,
                inventory: [...state.inventory, itemToUnequip],
                characterSheetModal: newCharacterSheetModalState
            };
        }

        case 'DROP_ITEM': {
            const { itemId, characterId } = action.payload;
            const itemToDrop = state.inventory.find(item => item.id === itemId);
            if (!itemToDrop) return {};

            const newDynamicItems = { ...state.dynamicLocationItemIds };
            if (!state.currentLocationId.startsWith('coord_')) {
                newDynamicItems[state.currentLocationId] = [...(newDynamicItems[state.currentLocationId] || []), itemToDrop.id];
            }

            return {
                inventory: state.inventory.filter(item => item.id !== itemId),
                dynamicLocationItemIds: newDynamicItems,
            };
        }

        case 'USE_ITEM': {
            const { itemId, characterId } = action.payload;
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            const itemToUse = state.inventory.find(item => item.id === itemId);
            if (!itemToUse || itemToUse.type !== 'consumable' || !itemToUse.effect) return {};

            let playerAfterEffect = { ...charToUpdate };
            if (itemToUse.effect.startsWith('heal_')) {
                const healAmount = parseInt(itemToUse.effect.split('_')[1]);
                if (!isNaN(healAmount)) {
                    playerAfterEffect.hp = Math.min(playerAfterEffect.maxHp, playerAfterEffect.hp + healAmount);
                }
            }

            const newParty = [...state.party];
            newParty[charIndex] = playerAfterEffect;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === playerAfterEffect.id
                ? { ...state.characterSheetModal, character: playerAfterEffect }
                : state.characterSheetModal;

            return {
                party: newParty,
                inventory: state.inventory.filter(item => item.id !== itemId),
                characterSheetModal: newCharacterSheetModalState,
            };
        }

        case 'TOGGLE_PREPARED_SPELL': {
            const { characterId, spellId } = action.payload;
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            if (!charToUpdate.spellbook) return {};

            const spellbook = { ...charToUpdate.spellbook };
            const preparedSpells = new Set(spellbook.preparedSpells);

            if (preparedSpells.has(spellId)) preparedSpells.delete(spellId);
            else preparedSpells.add(spellId);

            spellbook.preparedSpells = Array.from(preparedSpells);
            const updatedCharacter = { ...charToUpdate, spellbook };

            const newParty = [...state.party];
            newParty[charIndex] = updatedCharacter;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedCharacter.id
                ? { ...state.characterSheetModal, character: updatedCharacter }
                : state.characterSheetModal;

            return { party: newParty, characterSheetModal: newCharacterSheetModalState };
        }

        case 'CAST_SPELL': {
            const { characterId, spellLevel } = action.payload;
            if (spellLevel === 0) return {};

            const slotKey = `level_${spellLevel}` as const;
            const newParty = state.party.map(char => {
                if (char.id === characterId && char.spellSlots?.[slotKey] && char.spellSlots[slotKey].current > 0) {
                    return { ...char, spellSlots: { ...char.spellSlots, [slotKey]: { ...char.spellSlots[slotKey], current: char.spellSlots[slotKey].current - 1 } } };
                }
                return char;
            });
            return { party: newParty };
        }

        case 'USE_LIMITED_ABILITY': {
            const { characterId, abilityId } = action.payload;
            const newParty = state.party.map(char => {
                if (char.id === characterId && char.limitedUses?.[abilityId] && char.limitedUses[abilityId].current > 0) {
                    return { ...char, limitedUses: { ...char.limitedUses, [abilityId]: { ...char.limitedUses[abilityId], current: char.limitedUses[abilityId].current - 1 } } };
                }
                return char;
            });
            return { party: newParty };
        }

        case 'SHORT_REST': {
            const newParty = state.party.map(char => {
                const restoredUses = { ...char.limitedUses };
                let usesChanged = false;
                for (const id in restoredUses) {
                    if (restoredUses[id].resetOn === 'short_rest') {
                        restoredUses[id] = { ...restoredUses[id], current: resolveMaxValue(char, restoredUses[id]) };
                        usesChanged = true;
                    }
                }
                return usesChanged ? { ...char, limitedUses: restoredUses } : char;
            });
            return { party: newParty };
        }

        case 'LONG_REST': {
            const newParty = state.party.map(char => {
                const charCopy = { ...char };
                let hasChanged = true; // Assume change for simplicity

                // Restore Spell Slots
                if (charCopy.spellSlots) {
                    const restoredSlots: SpellSlots = { ...charCopy.spellSlots };
                    Object.keys(restoredSlots).forEach(key => {
                        const slotKey = key as keyof SpellSlots;
                        restoredSlots[slotKey] = { ...restoredSlots[slotKey], current: restoredSlots[slotKey].max };
                    });
                    charCopy.spellSlots = restoredSlots;
                }

                // Restore Limited Use Abilities
                if (charCopy.limitedUses) {
                    const restoredUses = { ...charCopy.limitedUses };
                    Object.keys(restoredUses).forEach(id => {
                        const ability = restoredUses[id];
                        if (ability.resetOn === 'long_rest' || ability.resetOn === 'short_rest' || ability.resetOn === 'daily') {
                            restoredUses[id] = { ...ability, current: resolveMaxValue(char, ability) };
                        }
                    });
                    charCopy.limitedUses = restoredUses;
                }

                // Restore HP
                charCopy.hp = charCopy.maxHp;

                return charCopy;
            });
            return { party: newParty };
        }

        case 'BUY_ITEM': {
            const { item, cost } = action.payload;
            if (state.gold >= cost) {
                return {
                    gold: state.gold - cost,
                    inventory: [...state.inventory, item]
                };
            }
            return {};
        }

        case 'SELL_ITEM': {
            const { itemId, value } = action.payload;
            const newInventory = [...state.inventory];

            const itemIndex = newInventory.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return {};

            newInventory.splice(itemIndex, 1);

            return {
                inventory: newInventory,
                gold: state.gold + value
            };
        }

        case 'UPDATE_CHARACTER_CHOICE': {
            const { characterId, choiceType, choiceId, secondaryValue } = action.payload;
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };

            // Handle Class Feature Updates
            if (choiceType === 'fighting_style') {
                const style = CLASSES_DATA[charToUpdate.class.id].fightingStyles?.find(s => s.id === choiceId);
                if (style) charToUpdate.selectedFightingStyle = style;
            } else if (choiceType === 'divine_order') {
                const order = CLASSES_DATA[charToUpdate.class.id].divineOrders?.find(o => o.id === choiceId);
                if (order) charToUpdate.selectedDivineOrder = order.id;
            } else if (choiceType === 'primal_order') {
                const order = CLASSES_DATA[charToUpdate.class.id].primalOrders?.find(o => o.id === choiceId);
                if (order) charToUpdate.selectedDruidOrder = order.id;
            } else if (choiceType === 'missing_racial_spell') {
                // Automatically add the missing spell
                const spellId = choiceId;
                const isCantrip = secondaryValue?.isCantrip;

                if (!charToUpdate.spellbook) {
                    charToUpdate.spellbook = { knownSpells: [], preparedSpells: [], cantrips: [] };
                }

                if (isCantrip) {
                    if (!charToUpdate.spellbook.cantrips.includes(spellId)) {
                        charToUpdate.spellbook = {
                            ...charToUpdate.spellbook,
                            cantrips: [...charToUpdate.spellbook.cantrips, spellId]
                        };
                    }
                } else {
                    if (!charToUpdate.spellbook.knownSpells.includes(spellId)) {
                        charToUpdate.spellbook = {
                            ...charToUpdate.spellbook,
                            knownSpells: [...charToUpdate.spellbook.knownSpells, spellId]
                        };
                    }
                    // Also prepare it, as racial spells are typically always prepared
                    if (!charToUpdate.spellbook.preparedSpells.includes(spellId)) {
                        charToUpdate.spellbook = {
                            ...charToUpdate.spellbook,
                            preparedSpells: [...charToUpdate.spellbook.preparedSpells, spellId]
                        };
                    }
                }
            }
            // Handle Racial Choice Updates
            else {
                // Initialize racialSelections if missing
                if (!charToUpdate.racialSelections) charToUpdate.racialSelections = {};

                // Helper to update racial selection
                const updateRacialSelection = (key: string, data: Partial<RacialSelectionData>) => {
                    charToUpdate.racialSelections = {
                        ...charToUpdate.racialSelections,
                        [key]: { ...(charToUpdate.racialSelections![key] || {}), ...data }
                    };
                };

                if (choiceType === 'dragonborn_ancestry') updateRacialSelection('dragonborn', { choiceId });
                else if (choiceType === 'elf_lineage') updateRacialSelection('elf', { choiceId });
                else if (choiceType === 'gnome_subrace') updateRacialSelection('gnome', { choiceId });
                else if (choiceType === 'goliath_ancestry') updateRacialSelection('goliath', { choiceId });
                else if (choiceType === 'tiefling_legacy') updateRacialSelection('tiefling', { choiceId });
                else if (choiceType === 'racial_spell_ability') updateRacialSelection(charToUpdate.race.id, { spellAbility: choiceId as any }); // choiceId here is the ability name
            }

            const newParty = [...state.party];
            newParty[charIndex] = charToUpdate;

            // If character sheet is open for this char, update it
            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === characterId
                ? { ...state.characterSheetModal, character: charToUpdate }
                : state.characterSheetModal;

            return { party: newParty, characterSheetModal: newCharacterSheetModalState };
        }

        default:
            return {};
    }
}
