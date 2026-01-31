
/**
 * @file src/state/reducers/characterReducer.ts
 * A slice reducer that handles character-related state changes (party, inventory, actions).
 */
// TODO(lint-intent): 'DiscoveryType' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState, LimitedUseAbility, SpellSlots, DiscoveryType as _DiscoveryType, Item, RacialSelectionData, LevelUpChoices, EquipmentSlotType, ArmorCategory, AbilityScoreName } from '../../types';
import { AppAction } from '../actionTypes';
import { calculateArmorClass, createPlayerCharacterFromTemp, calculateFinalAbilityScores, getAbilityModifierValue, applyXpAndHandleLevelUps, canLevelUp, performLevelUp, getCharacterMaxArmorProficiency, getArmorCategoryHierarchy, buildHitPointDicePools, updateDerivedStats } from '../../utils/characterUtils';
import { getMaxPreparedSpells } from '../../utils/character/getMaxPreparedSpells';
import { isWeaponProficient } from '../../utils/weaponUtils';
// TODO(lint-intent): 'LOCATIONS' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { LOCATIONS as _LOCATIONS, ITEMS, CLASSES_DATA } from '../../constants';

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
            // TODO(FEATURES): Add explicit party recruitment/leave actions wired to gameplay (NPC join/leave flow), not just dev generation (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
            return {
                party: [...state.party, action.payload],
            };

        case 'ADD_ITEM': {
            const { itemId, count = 1 } = action.payload;
            const item = ITEMS[itemId] || Object.values(ITEMS).find(i => i.id === itemId);

            if (!item) {
                console.warn(`ADD_ITEM: Item ${itemId} not found.`);
                return {};
            }

            // Create independent copies of the item to avoid shared reference issues
            const newItems = Array.from({ length: count }, () => ({ ...item, id: item.id === 'gold_piece' ? item.id : crypto.randomUUID() }));

            // For stackable items (like gold), we might want to just add them as is, but current inventory is a flat list.
            // If the item is generic (like gold_piece), we keep the ID. If it's a unique gear item, we give it a unique ID.
            // However, the game seems to use shared IDs for generic items often.
            // Safer to just clone the object.

            return {
                inventory: [...state.inventory, ...newItems],
            };
        }

        case 'REMOVE_ITEM': {
            const { itemId, count = 1 } = action.payload;
            let remaining = count;
            const newInventory: Array<Item | null> = [...state.inventory];

            // First pass: look for stacked items (item.count > 1)
            for (let i = 0; i < newInventory.length; i++) {
                const inventoryItem = newInventory[i];
                if (!inventoryItem) continue;
                if (remaining <= 0) break;
                if (inventoryItem.id === itemId) {
                    const stackSize = inventoryItem.quantity ?? 1;

                    if (stackSize > 1) {
                        // It's a stack
                        if (stackSize > remaining) {
                            // Partial stack removal
                            newInventory[i] = { ...inventoryItem, quantity: stackSize - remaining };
                            remaining = 0;
                        } else {
                            // Consume entire stack
                            remaining -= stackSize;
                            newInventory[i] = null;
                        }
                    } else {
                        // Single item
                        remaining--;
                        newInventory[i] = null;
                    }
                }
            }

            // If we still need to remove items and we found some single items that we marked as null, we are good.
            // But what if we didn't find enough?
            if (remaining > 0) {
                console.warn(`REMOVE_ITEM: Could not find enough of item ${itemId} to remove. Requested: ${count}, Found: ${count - remaining}`);
            }

            // Filter out the nulls (removed items)
            const finalInventory = newInventory.filter((item): item is Item => item !== null);

            return {
                inventory: finalInventory
            };
        }

        case 'MODIFY_GOLD': {
            const { amount } = action.payload;
            // Round to nearest copper to avoid floating point issues
            const newGold = Math.max(0, Math.round((state.gold + amount) * 100) / 100);
            return { gold: newGold };
        }

        case 'GRANT_EXPERIENCE': {
            const { amount } = action.payload;
            const newParty = state.party.map(char => applyXpAndHandleLevelUps(char, amount));
            return { party: newParty };
        }

        case 'MODIFY_PARTY_HEALTH': {
            const { amount, characterIds } = action.payload;

            const newParty = state.party.map(char => {
                // If specific IDs provided, only update those; otherwise update all
                if (characterIds) {
                    const targetId = char.id;
                    if (!targetId || !characterIds.includes(targetId)) {
                        return char;
                    }
                }

                // Apply damage/healing, clamping between 0 and maxHp
                let newHp = char.hp + amount;
                newHp = Math.max(0, Math.min(newHp, char.maxHp));

                return { ...char, hp: newHp };
            });

            return { party: newParty };
        }

        case 'EQUIP_ITEM': {
            // RALPH: Equipment Adapter.
            // When an item moves from Inventory -> Slot, we must recalculate EVERY derived stat.
            // 1. Ability Scores (from magic items).
            // 2. Armor Class (Base AC + Dex Mod + Shield).
            // 3. Max HP (if Constitution changed).
            // TODO(2026-01-03 pass 4 Codex-CLI): Equip payload is still loosely typed; tighten once action payloads are formalized.
            const payload = action.payload as { itemId?: string; characterId?: string };
            const itemId = payload.itemId;
            const characterId = payload.characterId;
            if (!itemId || !characterId) return {};
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            const itemToEquip = state.inventory.find(item => item.id === itemId);
            if (!itemToEquip) return {};

            const isOneHandedWeapon = itemToEquip.type === 'weapon' && !itemToEquip.properties?.includes('Two-Handed');
            const targetSlot = isOneHandedWeapon
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

            // RALPH: Logic Extraction.
            // Uses centralized utility to recalculate AC, HP, and Ability Scores.
            const updatedPlayerCharacter = updateDerivedStats({ ...charToUpdate, equippedItems: newEquippedItems });

            const newParty = [...state.party];
            newParty[charIndex] = updatedPlayerCharacter;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedPlayerCharacter.id
                ? { ...state.characterSheetModal, character: updatedPlayerCharacter }
                : state.characterSheetModal;

            return { party: newParty, inventory: newInventory, characterSheetModal: newCharacterSheetModalState };
        }

        case 'UNEQUIP_ITEM': {
            // TODO(2026-01-03 pass 4 Codex-CLI): Unequip payload is still loosely typed; tighten once action payloads are formalized.
            const payload = action.payload as { slot?: EquipmentSlotType; characterId?: string };
            const { slot, characterId } = payload;
            if (!slot || !characterId) return {};
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            const itemToUnequip = charToUpdate.equippedItems[slot];
            if (!itemToUnequip) return {};

            const newEquippedItems = { ...charToUpdate.equippedItems };
            delete newEquippedItems[slot];

            const updatedPlayerCharacter = updateDerivedStats({ ...charToUpdate, equippedItems: newEquippedItems });

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
            // TODO(lint-intent): 'characterId' is declared but unused, suggesting an unfinished state/behavior hook in this block.
            // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
            // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
            // TODO(2026-01-03 pass 4 Codex-CLI): Drop payload is still loosely typed; tighten once action payloads are formalized.
            const { itemId, characterId: _characterId } = action.payload as { itemId?: string; characterId?: string };
            if (!itemId) return {};
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
            // TODO(2026-01-03 pass 4 Codex-CLI): Use-item payload is still loosely typed; tighten once action payloads are formalized.
            const { itemId, characterId } = action.payload as { itemId?: string; characterId?: string };
            if (!itemId || !characterId) return {};
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            const itemToUse = state.inventory.find(item => item.id === itemId);
            if (!itemToUse || itemToUse.type !== 'consumable' || !itemToUse.effect) return {};

            const playerAfterEffect = { ...charToUpdate };

            // Handle legacy string effects
            if (typeof itemToUse.effect === 'string') {
                if (itemToUse.effect.startsWith('heal_')) {
                    const healAmount = parseInt(itemToUse.effect.split('_')[1]);
                    if (!isNaN(healAmount)) {
                        playerAfterEffect.hp = Math.min(playerAfterEffect.maxHp, playerAfterEffect.hp + healAmount);
                    }
                }
            } else {
                // Handle new structured ItemEffect
                if (itemToUse.effect.type === 'heal') {
                    playerAfterEffect.hp = Math.min(playerAfterEffect.maxHp, playerAfterEffect.hp + itemToUse.effect.value);
                }
                // Add logic for other effect types (buffs, etc.) here in the future
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

            if (preparedSpells.has(spellId)) {
                // Always allow unpreparing
                preparedSpells.delete(spellId);
            } else {
                // Check limit before adding
                const maxPrepared = getMaxPreparedSpells(charToUpdate);

                // If maxPrepared is null (known caster), no limit applies
                // Otherwise, enforce the limit
                if (maxPrepared !== null && preparedSpells.size >= maxPrepared) {
                    console.log(`Cannot prepare more spells. Already at max (${maxPrepared}).`);
                    return {}; // Don't add - already at limit
                }
                preparedSpells.add(spellId);
            }

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

            const slotKey = `level_${spellLevel}` as keyof SpellSlots;
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
            const healingByCharacterId = action.payload?.healingByCharacterId || {};
            const hitPointDiceUpdates = action.payload?.hitPointDiceUpdates || {};

            const newParty = state.party.map(char => {
                const charId = char.id;
                let hasChanged = false;
                let updatedChar = char;

                // Restore limited-use abilities that reset on short rests.
                if (char.limitedUses) {
                    const restoredUses = { ...char.limitedUses };
                    let usesChanged = false;
                    for (const id in restoredUses) {
                        if (restoredUses[id].resetOn === 'short_rest') {
                            restoredUses[id] = { ...restoredUses[id], current: resolveMaxValue(char, restoredUses[id]) };
                            usesChanged = true;
                        }
                    }
                    if (usesChanged) {
                        updatedChar = { ...updatedChar, limitedUses: restoredUses };
                        hasChanged = true;
                    }
                }

                // Apply any hit dice spend updates calculated by the short rest handler.
                if (charId && hitPointDiceUpdates[charId]) {
                    updatedChar = { ...updatedChar, hitPointDice: hitPointDiceUpdates[charId] };
                    hasChanged = true;
                }

                // Apply healing from spent hit dice (clamped in handler, but also bounded here).
                if (charId) {
                    const healing = healingByCharacterId[charId];
                    if (typeof healing === 'number' && healing !== 0) {
                        const newHp = Math.max(0, Math.min(updatedChar.maxHp, updatedChar.hp + healing));
                        if (newHp !== updatedChar.hp) {
                            updatedChar = { ...updatedChar, hp: newHp };
                            hasChanged = true;
                        }
                    }
                }

                return hasChanged ? updatedChar : char;
            });
            return { party: newParty };
        }

        case 'LONG_REST': {
            const deniedIds = action.payload?.deniedCharacterIds || [];

            const newParty = state.party.map(char => {
                const charId = char.id;
                if (charId && deniedIds.includes(charId)) {
                    return char; // No benefits for denied characters
                }

                const charCopy = { ...char };
                // TODO(lint-intent): 'hasChanged' is declared but unused, suggesting an unfinished state/behavior hook in this block.
                // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
                // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
                const _hasChanged = true; // Assume change for simplicity

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

                // Restore Hit Point Dice (2024 rules: Long Rest restores all spent dice).
                const restoredHitPointDice = buildHitPointDicePools(charCopy).map(pool => ({
                    ...pool,
                    current: pool.max,
                }));
                charCopy.hitPointDice = restoredHitPointDice;

                return charCopy;
            });
            return { party: newParty };
        }

        case 'BUY_ITEM': {
            const { item, cost } = action.payload;
            if (state.gold >= cost) {
                // Currency is represented in GP but many prices are fractional (CP/SP),
                // so we round to the nearest copper (0.01 GP) to avoid floating-point drift.
                const newGold = Math.round((state.gold - cost) * 100) / 100;

                // Also remove the item from merchant inventory (finite stock).
                // We find and remove only the first matching item by id.
                const currentMerchantInventory = state.merchantModal?.merchantInventory || [];
                const itemIndex = currentMerchantInventory.findIndex(i => i.id === item.id);
                const newMerchantInventory = itemIndex !== -1
                    ? [...currentMerchantInventory.slice(0, itemIndex), ...currentMerchantInventory.slice(itemIndex + 1)]
                    : currentMerchantInventory;

                return {
                    gold: newGold,
                    inventory: [...state.inventory, item],
                    merchantModal: state.merchantModal ? {
                        ...state.merchantModal,
                        merchantInventory: newMerchantInventory
                    } : undefined
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
                // Round to the nearest copper (0.01 GP) to keep GP display stable.
                gold: Math.round((state.gold + value) * 100) / 100
            };
        }

        case 'UPDATE_CHARACTER_CHOICE': {
            const { characterId, choiceType, choiceId, secondaryValue } = action.payload as { characterId?: string; choiceType?: string; choiceId?: string; secondaryValue?: unknown };
            if (!characterId || !choiceType || !choiceId) return {};
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            let charToUpdate = { ...state.party[charIndex] };
            const parsedSecondary = (secondaryValue ?? {}) as { choices?: LevelUpChoices; xpGained?: number; isCantrip?: boolean };

            // Level up handling uses a generic choiceType so UI flows can supply XP gains
            // and the desired class/ASI/feat selections without adding a new action type.
            if (choiceType === 'level_up') {
                const levelChoices = parsedSecondary.choices;
                const xpGain = typeof parsedSecondary.xpGained === 'number' ? parsedSecondary.xpGained : 0;

                if (xpGain !== 0) {
                    charToUpdate = applyXpAndHandleLevelUps(charToUpdate, xpGain, levelChoices);
                } else if (canLevelUp(charToUpdate)) {
                    charToUpdate = performLevelUp(charToUpdate, levelChoices);
                }

                // RALPH: Logic Extraction.
                // Ensures all derived stats (HP, AC, Proficiency) are recalculated after level-up choices.
                charToUpdate = updateDerivedStats(charToUpdate);
                
                const leveledParty = [...state.party];
                leveledParty[charIndex] = charToUpdate;

                const leveledCharacterSheetState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === characterId
                    ? { ...state.characterSheetModal, character: charToUpdate }
                    : state.characterSheetModal;

                return { party: leveledParty, characterSheetModal: leveledCharacterSheetState };
            }

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
                const isCantrip = parsedSecondary.isCantrip;

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
                // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
                // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                else if (choiceType === 'racial_spell_ability') updateRacialSelection(charToUpdate.race.id, { spellAbility: choiceId as AbilityScoreName }); // choiceId here is the ability name
            }

            const newParty = [...state.party];
            newParty[charIndex] = charToUpdate;

            // If character sheet is open for this char, update it
            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === characterId
                ? { ...state.characterSheetModal, character: charToUpdate }
                : state.characterSheetModal;

            return { party: newParty, characterSheetModal: newCharacterSheetModalState };
        }

        case 'AUTO_EQUIP': {
            const { characterId } = action.payload;
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            let newInventory = [...state.inventory];
            const newEquippedItems = { ...charToUpdate.equippedItems };

            // Get character's max armor proficiency level
            const maxArmorProficiencyLevel = getCharacterMaxArmorProficiency(charToUpdate);
            const maxArmorValue = getArmorCategoryHierarchy(maxArmorProficiencyLevel.charAt(0).toUpperCase() + maxArmorProficiencyLevel.slice(1) as ArmorCategory);

            // Define slot mappings from item slot to equipment slot
            const armorSlots: EquipmentSlotType[] = ['Torso', 'Head', 'Hands', 'Legs', 'Feet', 'Wrists'];
            const accessorySlots: EquipmentSlotType[] = ['Neck', 'Cloak', 'Belt', 'Ring1', 'Ring2'];

            // Helper to find best item for a slot from inventory
            const findBestItemForSlot = (slot: EquipmentSlotType, items: Item[]): Item | null => {
                // For Ring slots, treat them as 'Ring' type items
                const slotToMatch = slot === 'Ring1' || slot === 'Ring2' ? 'Ring' : slot;

                const candidates = items.filter(item => {
                    if (item.slot !== slotToMatch) return false;

                    // For armor, check proficiency
                    if (item.type === 'armor' && item.armorCategory) {
                        if (item.armorCategory === 'Shield') {
                            return charToUpdate.class.armorProficiencies.map(p => p.toLowerCase()).includes('shields');
                        }
                        const itemArmorValue = getArmorCategoryHierarchy(item.armorCategory);
                        return itemArmorValue <= maxArmorValue;
                    }
                    return true;
                });

                if (candidates.length === 0) return null;

                // For armor slots, pick highest AC
                if (armorSlots.includes(slot)) {
                    return candidates.reduce((best, current) => {
                        const bestAC = best.baseArmorClass ?? 0;
                        const currentAC = current.baseArmorClass ?? 0;
                        return currentAC > bestAC ? current : best;
                    });
                }

                // For accessories, just pick the first one
                return candidates[0];
            };

            // Equip armor slots
            for (const slot of armorSlots) {
                if (!newEquippedItems[slot]) {
                    const bestItem = findBestItemForSlot(slot, newInventory);
                    if (bestItem) {
                        newEquippedItems[slot] = bestItem;
                        newInventory = newInventory.filter(i => i.id !== bestItem.id);
                    }
                }
            }

            // Equip accessory slots
            for (const slot of accessorySlots) {
                if (!newEquippedItems[slot]) {
                    const bestItem = findBestItemForSlot(slot, newInventory);
                    if (bestItem) {
                        newEquippedItems[slot] = bestItem;
                        newInventory = newInventory.filter(i => i.id !== bestItem.id);
                    }
                }
            }

            // Equip Shield in OffHand if proficient and not already equipped
            if (!newEquippedItems.OffHand) {
                const hasShieldProficiency = charToUpdate.class.armorProficiencies.map(p => p.toLowerCase()).includes('shields');
                if (hasShieldProficiency) {
                    const shield = newInventory.find(item => item.type === 'armor' && item.armorCategory === 'Shield');
                    if (shield) {
                        newEquippedItems.OffHand = shield;
                        newInventory = newInventory.filter(i => i.id !== shield.id);
                    }
                }
            }

            // Equip weapon in MainHand if not already equipped (pick best proficient weapon)
            if (!newEquippedItems.MainHand) {
                const proficientWeapons = newInventory.filter(item =>
                    item.type === 'weapon' && isWeaponProficient(charToUpdate, item)
                );

                if (proficientWeapons.length > 0) {
                    // Simple heuristic: prefer higher damage dice (compare first character of damageDice like "1d12" vs "1d6")
                    const bestWeapon = proficientWeapons.reduce((best, current) => {
                        const bestDice = parseInt(best.damageDice?.split('d')[1] ?? '0');
                        const currentDice = parseInt(current.damageDice?.split('d')[1] ?? '0');
                        return currentDice > bestDice ? current : best;
                    });

                    newEquippedItems.MainHand = bestWeapon;
                    newInventory = newInventory.filter(i => i.id !== bestWeapon.id);
                }
            }

            // Update character with new equipment
            const updatedCharWithGear = updateDerivedStats({ ...charToUpdate, equippedItems: newEquippedItems });

            const newParty = [...state.party];
            newParty[charIndex] = updatedCharWithGear;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedCharWithGear.id
                ? { ...state.characterSheetModal, character: updatedCharWithGear }
                : state.characterSheetModal;

            return { party: newParty, inventory: newInventory, characterSheetModal: newCharacterSheetModalState };
        }

        default:
            return {};
    }
}
