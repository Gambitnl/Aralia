// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 01:10:56
 * Dependents: state/appState.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This reducer manages everything related to characters in the world.
 *
 * It handles party composition (joining/leaving), equipment changes, XP gains,
 * health modifications, and spell preparation. It is the central authority for
 * the character lifecycle.
 *
 * Called by: appState.ts (as part of the root reducer)
 * Depends on: characterUtils for stat calculations, actionTypes for signal definitions
 */

// ============================================================================
// Imports and Helpers
// ============================================================================

/**
 * @file src/state/reducers/characterReducer.ts
 * A slice reducer that handles character-related state changes (party, inventory, actions).
 */
import { GameState, LimitedUseAbility, SpellSlots, Item, RacialSelectionData, LevelUpChoices, EquipmentSlotType, ArmorCategory, AbilityScoreName, Skill } from '../../types';
import { AppAction } from '../actionTypes';
import { SKILLS_DATA } from '../../data/skills';
import {
  calculateArmorClass,
  createPlayerCharacterFromTemp,
  calculateFinalAbilityScores,
  getAbilityModifierValue,
  applyXpAndHandleLevelUps,
  canLevelUp,
  performLevelUp,
  getCharacterMaxArmorProficiency,
  getArmorCategoryHierarchy,
  buildHitPointDicePools,
  updateDerivedStats,
  getPreparedSpellsAffectingLimit,
  isRacialSpellLockedForPreparation,
  getRacialSpellGrantForSpell,
  isRacialSpellCastLevelAllowed,
  resolveRacialSpellLimitedUseId,
  resolveRacialResourceId,
} from '../../utils/characterUtils';
import { getMaxPreparedSpells } from '../../utils/character/getMaxPreparedSpells';
import { isWeaponProficient } from '../../utils/weaponUtils';
import { rollDice } from '../../utils/combat/combatUtils';
import { ITEMS, CLASSES_DATA } from '../../constants';
import { generateId } from '../../utils/core/idGenerator';
import { isWildernessLocationId } from '../../utils/location/cellLocationId';
import { appendAdventureLogEntry } from '../../systems/adventureLog/adventureLog';

// Helper for resetting limited uses
const resolveMaxValue = (char: GameState['party'][0], ability: LimitedUseAbility): number => {
    if (typeof ability.max === 'number') return ability.max;
    // This is a simplified version. A full implementation would check specific ability modifiers.
    if (ability.max === 'proficiency_bonus') return char.proficiencyBonus || 2;
    return 1; // Fallback
};

/**
 * Stamps newly acquired inventory items with the real-world time they entered
 * the party inventory.
 *
 * Existing saves and older item templates may not have this field yet, so this
 * helper preserves any timestamp that already exists and only fills the missing
 * value at acquisition boundaries owned by this reducer.
 */
const stampItemAcquiredAt = (item: Item, acquiredAt = Date.now()): Item => ({
    ...item,
    acquiredAt: item.acquiredAt ?? acquiredAt,
});

/**
 * Items whose canonical id is preserved on ADD_ITEM (instead of a fresh unique
 * id) so they stack and can be counted/removed by template id. Coins already
 * relied on this; travel provisions (rations, water) need it for the
 * provisioning math (daysOfFood) and ration spend (REMOVE_ITEM) to find them.
 */
const STABLE_STACKABLE_ITEM_IDS = new Set(['gold_piece', 'rations', 'water-day']);

// ============================================================================
// Main Reducer Logic
// ============================================================================
export function characterReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'SET_PARTY_COMPOSITION':
            return {
                party: action.payload.map(tempMember => createPlayerCharacterFromTemp(tempMember)),
                tempParty: action.payload,
            };

        // Premade party action: Sets the party using full PlayerCharacter objects
        // WHAT CHANGED: Added SET_FULL_PARTY to support pre-generated characters.
        // WHY IT CHANGED: Standard SET_PARTY_COMPOSITION generates stats from a 
        // template. For premade characters (like those loaded from JSON), we 
        // want to preserve their hand-crafted stats, spells, and equipment exactly.
        case 'SET_FULL_PARTY':
            return {
                party: action.payload,
                tempParty: action.payload.map(p => ({
                    id: p.id,
                    name: p.name,
                    level: p.level || 1,
                    classId: p.class?.id || 'fighter',
                })),
            };


        case 'ADD_GENERATED_CHARACTER':
            return {
                party: [...state.party, action.payload],
            };

        // Apply a status condition (e.g. travel 'starving'/'fatigued') to the whole
        // party. Idempotent: a member already carrying the condition is untouched so
        // repeated starving days don't stack duplicates.
        case 'SET_PARTY_CONDITION': {
            const { condition } = action.payload;
            return {
                party: state.party.map(pc =>
                    pc.conditions?.includes(condition)
                        ? pc
                        : { ...pc, conditions: [...(pc.conditions ?? []), condition] },
                ),
            };
        }

        // Clear a party-wide condition (e.g. on resupply / a good meal).
        case 'CLEAR_PARTY_CONDITION': {
            const { condition } = action.payload;
            return {
                party: state.party.map(pc => ({
                    ...pc,
                    conditions: (pc.conditions ?? []).filter(c => c !== condition),
                })),
            };
        }

        case 'ADD_ITEM': {
            const { itemId, count = 1 } = action.payload;
            const item = ITEMS[itemId] || Object.values(ITEMS).find(i => i.id === itemId);

            if (!item) {
                console.warn(`ADD_ITEM: Item ${itemId} not found.`);
                return {};
            }

            // Create independent item instances and stamp when they entered
            // inventory so perishable food can expire from durable item data.
            const acquiredAt = Date.now();
            const newItems = Array.from({ length: count }, () => stampItemAcquiredAt({ ...item, id: STABLE_STACKABLE_ITEM_IDS.has(item.id) ? item.id : generateId() }, acquiredAt));

            // For stackable items (like gold), we might want to just add them as is, but current inventory is a flat list.
            // If the item is generic (like gold_piece), we keep the ID. If it's a unique gear item, we give it a unique ID.
            // However, the game seems to use shared IDs for generic items often.
            // Safer to just clone the object.

            return {
                inventory: [...state.inventory, ...newItems],
            };
        }

        // Append a fully-formed bespoke item (e.g. a broadsheet keepsake carrying
        // a frozen news snapshot in readableContent) that ADD_ITEM's registry
        // lookup cannot represent. Stamps acquiredAt like the other acquisition
        // boundaries owned by this reducer.
        case 'GIVE_ITEM': {
            return {
                inventory: [...state.inventory, stampItemAcquiredAt(action.payload.item)],
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

                let updatedChar = { ...char };
                let remainingAmount = amount;

                // Handle damage (negative amount)
                if (remainingAmount < 0) {
                    let damageToApply = Math.abs(remainingAmount);

                    // 1. Apply to Temporary Hit Points first
                    if (updatedChar.tempHP && updatedChar.tempHP > 0) {
                        const absorbed = Math.min(updatedChar.tempHP, damageToApply);
                        updatedChar.tempHP -= absorbed;
                        damageToApply -= absorbed;
                    }

                    // 2. Apply remaining damage to actual HP
                    if (damageToApply > 0) {
                        const potentialNewHp = updatedChar.hp - damageToApply;

                        // 3. Relentless Endurance check (Orc trait)
                        // Trigger if reduced to 0 but not killed, and has the resource.
                        const reResourceId = resolveRacialResourceId('feature', 'orc__relentless_endurance__resource');
                        const hasRelentlessEndurance = updatedChar.limitedUses?.[reResourceId] && updatedChar.limitedUses[reResourceId].current > 0;

                        if (potentialNewHp <= 0 && updatedChar.hp > 0 && hasRelentlessEndurance) {
                            updatedChar.hp = 1;
                            updatedChar.limitedUses = {
                                ...updatedChar.limitedUses,
                                [reResourceId]: {
                                    ...updatedChar.limitedUses![reResourceId],
                                    current: 0
                                }
                            };
                        } else {
                            updatedChar.hp = Math.max(0, potentialNewHp);
                        }
                    }
                } else if (remainingAmount > 0) {
                    // Handle healing (positive amount)
                    updatedChar.hp = Math.min(updatedChar.hp + remainingAmount, updatedChar.maxHp);
                }

                return updatedChar;
            });

            return { ...state, party: newParty };
        }

        case 'EQUIP_ITEM': {
            // RALPH: Equipment Adapter.
            // When an item moves from Inventory -> Slot, we must recalculate EVERY derived stat.
            // 1. Ability Scores (from magic items).
            // 2. Armor Class (Base AC + Dex Mod + Shield).
            // 3. Max HP (if Constitution changed).
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
            const { itemId, characterId: _characterId } = action.payload as { itemId?: string; characterId?: string };
            if (!itemId) return {};
            const itemToDrop = state.inventory.find(item => item.id === itemId);
            if (!itemToDrop) return {};

            const newDynamicItems = { ...state.dynamicLocationItemIds };
            if (!isWildernessLocationId(state.currentLocationId)) {
                newDynamicItems[state.currentLocationId] = [...(newDynamicItems[state.currentLocationId] || []), itemToDrop.id];
            }

            return {
                inventory: state.inventory.filter(item => item.id !== itemId),
                dynamicLocationItemIds: newDynamicItems,
            };
        }

        case 'USE_ITEM': {
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
                    let healAmount = itemToUse.effect.value;
                    if (itemToUse.effect.dice) {
                        healAmount += rollDice(itemToUse.effect.dice);
                    }
                    playerAfterEffect.hp = Math.min(playerAfterEffect.maxHp, playerAfterEffect.hp + healAmount);
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

            const isLockedForRacialPrep = isRacialSpellLockedForPreparation(charToUpdate, spellId);
            const spellbook = { ...charToUpdate.spellbook };
            const preparedSpells = new Set(spellbook.preparedSpells);

            if (preparedSpells.has(spellId)) {
                if (isLockedForRacialPrep) {
                    return {};
                }
                preparedSpells.delete(spellId);
            } else {
                // Check limit before adding
                const maxPrepared = getMaxPreparedSpells(charToUpdate);
                const preparedSpellCountAffectingLimit = getPreparedSpellsAffectingLimit(charToUpdate).size;

                // If maxPrepared is null (known caster), no limit applies
                // Otherwise, enforce the limit
                if (maxPrepared !== null && preparedSpellCountAffectingLimit >= maxPrepared) {
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

        case 'APPLY_CHARACTER_STATUS_EFFECT': {
            // Out-of-combat effect persistence (the combat engine only writes to
            // CombatState snapshots). Mirrors the engine's same-source de-dup so
            // re-casting replaces rather than stacks.
            const { characterId, statusEffect } = action.payload;
            return {
                party: state.party.map(char => {
                    if (char.id !== characterId) return char;
                    const retained = (char.statusEffects ?? []).filter(existing =>
                        existing.source !== statusEffect.source ||
                        existing.sourceCasterId !== statusEffect.sourceCasterId,
                    );
                    return { ...char, statusEffects: [...retained, statusEffect] };
                }),
            };
        }

        case 'CAST_SPELL': {
            const { characterId, spellLevel, spellId, castSource, materialComponentItemIdToConsume } = action.payload;

            // Resolve the new inventory state if a material component was consumed during casting.
            let nextInventory = state.inventory;
            if (materialComponentItemIdToConsume) {
                nextInventory = state.inventory.filter(item => item.id !== materialComponentItemIdToConsume);
            }

            // Cantrips (spellLevel === 0) do not consume spell slots, so we skip slot consumption
            // but still return the updated inventory if a component was consumed.
            if (spellLevel === 0) {
                return materialComponentItemIdToConsume ? { inventory: nextInventory } : {};
            }
            const explicitRacialCastSource = castSource?.type === 'racial';
            const defaultRacialConsumption = castSource == null || explicitRacialCastSource;
            const allowSlotFallbackForRacialCast = explicitRacialCastSource
                ? (castSource.allowSlotFallback ?? true)
                : true;

            const slotKey = `level_${spellLevel}` as keyof SpellSlots;
            const newParty = state.party.map(char => {
                if (char.id !== characterId) return char;

                // Racial spell grants only exist for a known spell id. Plain slot
                // casts without a spell id should skip this racial-resource path.
                const grant = spellId ? getRacialSpellGrantForSpell(char, spellId) : undefined;
                if (spellId && grant) {
                    if (!isRacialSpellCastLevelAllowed(char, spellId, spellLevel)) {
                        return char;
                    }

                    if (grant.castingMethod === 'at_will') {
                        return char;
                    }

                    if (defaultRacialConsumption) {
                        const limitedUseId = resolveRacialSpellLimitedUseId(grant.sourceRaceId, spellId);
                        const limitedUse = char.limitedUses?.[limitedUseId];

                        if (limitedUse && limitedUse.current > 0) {
                            return {
                                ...char,
                                limitedUses: {
                                    ...char.limitedUses,
                                    [limitedUseId]: {
                                        ...limitedUse,
                                        current: limitedUse.current - 1,
                                    },
                                },
                            };
                        }
                    }

                    if (allowSlotFallbackForRacialCast && spellLevel > 0 && char.spellSlots?.[slotKey] && char.spellSlots[slotKey].current > 0) {
                        return {
                            ...char,
                            spellSlots: {
                                ...char.spellSlots,
                                [slotKey]: { ...char.spellSlots[slotKey], current: char.spellSlots[slotKey].current - 1 },
                            },
                        };
                    }

                    return char;
                }

                if (!char.spellSlots?.[slotKey] || char.spellSlots[slotKey].current <= 0) {
                    return char;
                }

                return {
                    ...char,
                    spellSlots: {
                        ...char.spellSlots,
                        [slotKey]: { ...char.spellSlots[slotKey], current: char.spellSlots[slotKey].current - 1 },
                    },
                };
            });
            return { party: newParty, inventory: nextInventory };
        }

        case 'USE_LIMITED_ABILITY': {
            const { characterId, abilityId } = action.payload;
            const newParty = state.party.map(char => {
                if (char.id !== characterId) return char;
                if (!char.limitedUses?.[abilityId] || char.limitedUses[abilityId].current <= 0) return char;

                let updatedChar = {
                    ...char,
                    limitedUses: {
                        ...char.limitedUses,
                        [abilityId]: {
                            ...char.limitedUses[abilityId],
                            current: char.limitedUses[abilityId].current - 1
                        }
                    }
                };

                // Adrenaline Rush Logic
                if (abilityId.includes('adrenaline_rush')) {
                    const pb = updatedChar.proficiencyBonus || 2;
                    // Temporary hit points do not stack; they are replaced if higher.
                    if ((updatedChar.tempHP || 0) < pb) {
                        updatedChar.tempHP = pb;
                    }
                }

                // Draconic Flight Logic
                if (abilityId.includes('draconic_flight')) {
                    updatedChar.isFlying = true;
                }

                return updatedChar;
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
            const racialChoices = action.payload?.racialRestChoices || {};

            // PRV9 — overnight provisions: the party eats a proper meal during the
            // rest only if EVERYONE can (1 ration + 1 water per member, all-or-
            // nothing so a partial stock isn't silently nibbled away). Eating
            // clears the travel hardships ('starving'/'fatigued'); a member who
            // stays starving cannot recover HP from the rest. 'poisoned' is
            // purged by the night's rest itself, food or not.
            const need = state.party.length;
            const heldInventory = state.inventory ?? [];
            const rationsHeld = heldInventory.filter(i => i.id === 'rations').length;
            const waterHeld = heldInventory.filter(i => i.id === 'water-day').length;
            const partyEats = need > 0 && rationsHeld >= need && waterHeld >= need;
            let newInventory = heldInventory;
            if (partyEats) {
                let rationsToEat = need, waterToDrink = need;
                newInventory = heldInventory.filter(item => {
                    if (item.id === 'rations' && rationsToEat > 0) { rationsToEat--; return false; }
                    if (item.id === 'water-day' && waterToDrink > 0) { waterToDrink--; return false; }
                    return true;
                });
            }

            const newParty = state.party.map(char => {
                const charId = char.id;
                if (charId && deniedIds.includes(charId)) {
                    return char; // No benefits for denied characters
                }

                const charCopy = { ...char };
                // Process Racial Rest Choices
                if (charId && racialChoices[charId]) {
                    const newChoicesForChar = racialChoices[charId];
                    // Revert old choices
                    if (charCopy.racialRestChoices) {
                        for (const choiceId in charCopy.racialRestChoices) {
                            const oldChoice = charCopy.racialRestChoices[choiceId];
                            if (oldChoice.skillIds) {
                                charCopy.skills = charCopy.skills.filter(s => 
                                    !oldChoice.skillIds?.some(id => 
                                        id.toLowerCase() === s.id?.toLowerCase() || 
                                        id.toLowerCase() === s.name?.toLowerCase()
                                    )
                                );
                            }
                            if (oldChoice.toolIds) {
                                charCopy.toolProficiencies = (charCopy.toolProficiencies || []).filter(t => !oldChoice.toolIds?.includes(t));
                            }
                            if (oldChoice.weaponIds) {
                                charCopy.weaponProficiencies = (charCopy.weaponProficiencies || []).filter(w => !oldChoice.weaponIds?.includes(w));
                            }
                        }
                    }
                    
                    // Apply new choices
                    charCopy.racialRestChoices = { ...charCopy.racialRestChoices, ...newChoicesForChar };
                    for (const choiceId in newChoicesForChar) {
                        const newChoice = newChoicesForChar[choiceId];
                        if (newChoice.skillIds) {
                            const skillsToAdd = newChoice.skillIds.filter(id => 
                                !charCopy.skills.some(s => 
                                    s.id?.toLowerCase() === id.toLowerCase() || 
                                    s.name?.toLowerCase() === id.toLowerCase()
                                )
                            );
                            const resolvedSkills = skillsToAdd
                                .map(id => Object.values(SKILLS_DATA).find(s => 
                                    s.id.toLowerCase() === id.toLowerCase() || 
                                    s.name.toLowerCase() === id.toLowerCase()
                                ))
                                .filter((s): s is Skill => !!s);
                            charCopy.skills = [...charCopy.skills, ...resolvedSkills];
                        }
                        if (newChoice.toolIds) {
                            const toolsToAdd = newChoice.toolIds.filter(id => !(charCopy.toolProficiencies || []).includes(id));
                            charCopy.toolProficiencies = [...(charCopy.toolProficiencies || []), ...toolsToAdd];
                        }
                        if (newChoice.weaponIds) {
                            const weaponsToAdd = newChoice.weaponIds.filter(id => !(charCopy.weaponProficiencies || []).includes(id));
                            charCopy.weaponProficiencies = [...(charCopy.weaponProficiencies || []), ...weaponsToAdd];
                        }
                    }
                }

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

                // PRV9 — condition recovery: the night purges 'poisoned'; eating a
                // proper meal (partyEats) clears 'starving' and 'fatigued'.
                if (charCopy.conditions?.length) {
                    charCopy.conditions = charCopy.conditions.filter(c =>
                        c !== 'poisoned' && !(partyEats && (c === 'starving' || c === 'fatigued')),
                    );
                }
                const stillStarving = (charCopy.conditions ?? []).includes('starving');

                // Restore HP — unless the member is still starving (PRV9): you
                // cannot recover on an empty stomach.
                if (!stillStarving) {
                    charCopy.hp = charCopy.maxHp;
                }

                // Reset flight status
                charCopy.isFlying = false;

                // Restore Hit Point Dice (2024 rules: Long Rest restores all spent dice).
                const restoredHitPointDice = buildHitPointDicePools(charCopy).map(pool => ({
                    ...pool,
                    current: pool.max,
                }));
                charCopy.hitPointDice = restoredHitPointDice;

                // Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest.
                if (charCopy.race?.traits?.some(t => t.toLowerCase().includes('resourceful'))) {
                    charCopy.heroicInspiration = true;
                }

                return charCopy;
            });
            return {
                party: newParty,
                ...(partyEats ? { inventory: newInventory } : {}),
                ...appendAdventureLogEntry(state, {
                    kind: 'rest',
                    summary: partyEats
                        ? 'The party took a long rest and a proper meal.'
                        : 'The party took a long rest.',
                }),
            };
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
                    // Purchased items enter the player inventory here, so this
                    // is the merchant acquisition boundary for freshness timing.
                    inventory: [...state.inventory, stampItemAcquiredAt(item)],
                    merchantModal: state.merchantModal ? {
                        ...state.merchantModal,
                        merchantInventory: newMerchantInventory
                    } : undefined
                };
            }
            return {};
        }

        case 'ADD_SPELL_CREATED_ITEMS': {
            return {
                inventory: [
                    ...state.inventory,
                    ...action.payload.items.map(item => stampItemAcquiredAt(item))
                ]
            };
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

        case 'SELL_FENCED_ITEM': {
            const { itemId, value } = action.payload;
            const newInventory = [...state.inventory];

            const itemIndex = newInventory.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return {};

            newInventory.splice(itemIndex, 1);

            return {
                inventory: newInventory,
                // Fenced goods pay through the same wallet as legal sales, but
                // the separate action lets the crime reducer add the risk.
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

                if (choiceType.includes('::skillChoice')) {
                    const raceId = choiceType.split('::')[0];
                    const currentSkills = charToUpdate.racialSelections[raceId]?.skillIds || [];
                    if (!currentSkills.includes(choiceId)) {
                        updateRacialSelection(raceId, { skillIds: [...currentSkills, choiceId] });
                    }
                } else if (choiceType.includes('::featChoice')) {
                    const raceId = choiceType.split('::')[0];
                    updateRacialSelection(raceId, { choiceId });
                    if (!charToUpdate.feats) charToUpdate.feats = [];
                    if (!charToUpdate.feats.includes(choiceId)) {
                        charToUpdate.feats = [...charToUpdate.feats, choiceId];
                    }
                } else if (choiceType === 'dragonborn_ancestry') updateRacialSelection('dragonborn', { choiceId });
                else if (choiceType === 'elf_lineage') updateRacialSelection('elf', { choiceId });
                else if (choiceType === 'gnome_subrace') updateRacialSelection('gnome', { choiceId });
                else if (choiceType === 'goliath_ancestry') updateRacialSelection('goliath', { choiceId });
                else if (choiceType === 'tiefling_legacy') updateRacialSelection('tiefling', { choiceId });
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

        // ============================================================================
        // Magic Item Attunement Actions
        // ============================================================================
        // These cases handle attuning and unattuning magic items to character slots,
        // enforcing the 3-item attunement limit per character.
        // ============================================================================

        case 'ATTUNE_ITEM': {
            const { characterId, itemId } = action.payload as { characterId: string; itemId: string };
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const character = state.party[charIndex];
            
            // Limit check: D&D 5e restricts active attunement to 3 magic items per character
            const equippedAttunedCount = Object.values(character.equippedItems).filter(
                item => item && item.requiresAttunement && item.isAttuned
            ).length;
            const inventoryAttunedCount = state.inventory.filter(
                item => item && item.requiresAttunement && item.isAttuned && item.attunedCharacterId === characterId
            ).length;
            
            if (equippedAttunedCount + inventoryAttunedCount >= 3) {
                // Reject attunement if the character is at the 3-item limit
                return {};
            }

            // Find and attune the target item, whether it resides in the player's general bag or is equipped
            let itemFound = false;
            const newEquippedItems = { ...character.equippedItems };
            const newInventory = state.inventory.map(item => {
                if (item.id === itemId) {
                    itemFound = true;
                    return { ...item, isAttuned: true, attunedCharacterId: characterId };
                }
                return item;
            });

            if (!itemFound) {
                for (const slot of Object.keys(newEquippedItems) as EquipmentSlotType[]) {
                    const item = newEquippedItems[slot];
                    if (item && item.id === itemId) {
                        newEquippedItems[slot] = { ...item, isAttuned: true, attunedCharacterId: characterId };
                        itemFound = true;
                        break;
                    }
                }
            }

            if (!itemFound) return {};

            // Recalculate all ability scores and AC since magical bonuses are now active
            const updatedChar = updateDerivedStats({ ...character, equippedItems: newEquippedItems });
            const newParty = [...state.party];
            newParty[charIndex] = updatedChar;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedChar.id
                ? { ...state.characterSheetModal, character: updatedChar }
                : state.characterSheetModal;

            return { party: newParty, inventory: newInventory, characterSheetModal: newCharacterSheetModalState };
        }

        case 'UNATTUNE_ITEM': {
            const { characterId, itemId } = action.payload as { characterId: string; itemId: string };
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const character = state.party[charIndex];
            const newEquippedItems = { ...character.equippedItems };
            let itemFound = false;

            // Clear attunement state on the target item in player inventory or equipment slots
            const newInventory = state.inventory.map(item => {
                if (item.id === itemId) {
                    itemFound = true;
                    return { ...item, isAttuned: false, attunedCharacterId: undefined };
                }
                return item;
            });

            if (!itemFound) {
                for (const slot of Object.keys(newEquippedItems) as EquipmentSlotType[]) {
                    const item = newEquippedItems[slot];
                    if (item && item.id === itemId) {
                        newEquippedItems[slot] = { ...item, isAttuned: false, attunedCharacterId: undefined };
                        itemFound = true;
                        break;
                    }
                }
            }

            if (!itemFound) return {};

            // Recalculate derived attributes since magical stat/AC modifiers are no longer active
            const updatedChar = updateDerivedStats({ ...character, equippedItems: newEquippedItems });
            const newParty = [...state.party];
            newParty[charIndex] = updatedChar;

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedChar.id
                ? { ...state.characterSheetModal, character: updatedChar }
                : state.characterSheetModal;

            return { party: newParty, inventory: newInventory, characterSheetModal: newCharacterSheetModalState };
        }

        // ============================================================================
        // Inventory Junk Management Actions
        // ============================================================================
        // These cases handle marking items as junk and mass-selling all marked junk
        // items when trading with a merchant.
        // ============================================================================

        case 'TOGGLE_ITEM_JUNK': {
            const { itemId } = action.payload as { itemId: string };
            let itemFound = false;

            // Toggle junk status in player inventory
            const newInventory = state.inventory.map(item => {
                if (item.id === itemId) {
                    itemFound = true;
                    return { ...item, isJunk: !item.isJunk };
                }
                return item;
            });

            // Toggle junk status in equipped slots if needed
            const newParty = state.party.map(char => {
                let charUpdated = false;
                const newEquipped = { ...char.equippedItems };
                
                for (const slot of Object.keys(newEquipped) as EquipmentSlotType[]) {
                    const item = newEquipped[slot];
                    if (item && item.id === itemId) {
                        newEquipped[slot] = { ...item, isJunk: !item.isJunk };
                        charUpdated = true;
                        itemFound = true;
                    }
                }

                if (charUpdated) {
                    return { ...char, equippedItems: newEquipped };
                }
                return char;
            });

            if (!itemFound) return {};

            const activeCharId = state.characterSheetModal.character?.id;
            const updatedActiveChar = activeCharId ? newParty.find(c => c.id === activeCharId) : undefined;
            const newCharacterSheetModalState = state.characterSheetModal.isOpen && updatedActiveChar
                ? { ...state.characterSheetModal, character: updatedActiveChar }
                : state.characterSheetModal;

            return { inventory: newInventory, party: newParty, characterSheetModal: newCharacterSheetModalState };
        }

        case 'SELL_ALL_JUNK': {
            const { items } = action.payload as { items: { itemId: string; value: number }[] };
            const newInventory = [...state.inventory];
            let goldEarned = 0;

            // Remove sold junk items and calculate total transaction earnings
            items.forEach(({ itemId, value }) => {
                const itemIndex = newInventory.findIndex(i => i.id === itemId);
                if (itemIndex > -1) {
                    newInventory.splice(itemIndex, 1);
                    goldEarned += value;
                }
            });

            return {
                inventory: newInventory,
                // Round gold amount to copper decimal precision
                gold: Math.round((state.gold + goldEarned) * 100) / 100
            };
        }

        default:
            return {};
    }
}
