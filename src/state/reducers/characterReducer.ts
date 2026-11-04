// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 06:28:41
 * Dependents: state/appState.ts, state/reducers/questReducer.ts, systems/worldforge/dungeon/world/dungeonObjectResolution.ts
 * Imports: 26 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { isPreparedMageArmor } from '../../utils/spells/preparedMageArmor';
import { planRestMeals } from '../../systems/gameplay/restMeals';
import { removePreviousPreparedConcentration } from '../../utils/spells/outOfCombatCasting';
import {prepareObjectLightCast} from '../../systems/gameplay/objectLightCasting';
import {containedWaterDays,consumeProvision} from '../../systems/travel/containedWater';
import {prepareContainedWaterCast,CONTAINED_WATER_SPELL_ID} from '../../systems/gameplay/containedWaterCasting';
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
import { isCurrencyItemId } from '../../utils/character/coinPurseUtils';
import { applyMerchantPurchase, applyMerchantSale } from './merchantTransactions';
import {prepareCarriedTorch} from '../../systems/underdark/carriedItemLight';
import {prepareAdventuringPack} from '../../systems/gameplay/adventuringPacks';
import { preparePartyMeal } from '../../systems/travel/partyMeal';
import { SKILLS_DATA } from '../../data/skills';
import { getRulesEdition } from '../../config/rulesEdition';
import { exhaustionLevelFromConditions } from '../../utils/combat/physicsUtils';
import { lodgingRestError, consumeLodgingRest } from '../../systems/gameplay/lodging';
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
  getRacialSpellGrantForSpell,
  isRacialSpellCastLevelAllowed,
  resolveRacialSpellLimitedUseId,
  resolveRacialResourceId,
  isTwoHandedWeapon,
} from '../../utils/character';
import { completePreparation, togglePreparationPlan } from '../../systems/gameplay/spellPreparation';
import { slotAcceptsItem } from '../../utils/character/slotCompatibility';
import { spellSlotsForClassLevel } from '../../systems/character/spellSlotProgression';
import { isWeaponProficient } from '../../utils/character';
import { rollDice } from '../../systems/dice/rollers';
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
export const stampItemAcquiredAt = (item: Item, acquiredAt = Date.now()): Item => ({
    ...item,
    acquiredAt: item.acquiredAt ?? acquiredAt,
});

/**
 * Items whose canonical id is preserved on ADD_ITEM (instead of a fresh unique
 * id) so they stack and can be counted/removed by template id. Coins already
 * relied on this; travel provisions (rations, water) need it for the
 * provisioning math (daysOfFood) and ration spend (REMOVE_ITEM) to find them.
 */
export const STABLE_STACKABLE_ITEM_IDS = new Set(['gold_piece', 'rations', 'water-day']);

/**
 * Creates an independent item instance with a unique id (unless it is a stable
 * stackable item) and stamps acquiredAt if not already present (GG-460).
 */
export const instantiateItem = (item: Item, acquiredAt = Date.now()): Item =>
    stampItemAcquiredAt(
        {
            ...item,
            // Currency keeps its catalog identity for face-value payment; gear stays independent.
            id: STABLE_STACKABLE_ITEM_IDS.has(item.id) || isCurrencyItemId(item.id) ? item.id : generateId(),
        },
        acquiredAt
    );

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

        // Apply a status condition to a single character (e.g. forced march 'exhaustion' on a failed save).
        // Idempotent: if already present, the character is untouched.
        case 'SET_CHARACTER_CONDITION': {
            const { characterId, condition } = action.payload;
            return {
                party: state.party.map(pc =>
                    pc.id === characterId && !pc.conditions?.includes(condition)
                        ? { ...pc, conditions: [...(pc.conditions ?? []), condition] }
                        : pc,
                ),
            };
        }

        // Clear a condition from a single character.
        case 'CLEAR_CHARACTER_CONDITION': {
            const { characterId, condition } = action.payload;
            return {
                party: state.party.map(pc =>
                    pc.id === characterId
                        ? { ...pc, conditions: (pc.conditions ?? []).filter(c => c !== condition) }
                        : pc,
                ),
            };
        }

        // GG-471: Track elapsed travel minutes accumulated toward the next whole-day ration deduction
        case 'SET_TRAVEL_MINUTES_REMAINDER': {
            return {
                travelMinutesRemainder: Math.max(0, action.payload.minutes),
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
            const newItems = Array.from({ length: count }, () => instantiateItem(item, acquiredAt));

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
            if (action.payload.itemId==='water-day'&&state.inventory.some(item=>containedWaterDays(item)>0)) {
                return {inventory:consumeProvision(state.inventory,'water-day',action.payload.count??1).inventory};
            }
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
            const rulesEdition = getRulesEdition(state);
            const newParty = state.party.map(char => applyXpAndHandleLevelUps(char, amount, undefined, rulesEdition));
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
            const payload = action.payload;
            const itemId = payload.itemId;
            const characterId = payload.characterId;
            if (!itemId || !characterId) return {};
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            const charToUpdate = { ...state.party[charIndex] };
            // A filtered row can share its item ID with another purchase. Keep
            // its original source and reject stale clicks instead of switching it.
            const sourceIndex = payload.inventoryIndex ?? state.inventory.findIndex(item => item.id === itemId);
            if (!Number.isInteger(sourceIndex) || sourceIndex < 0) return {};
            const itemToEquip = state.inventory[sourceIndex];
            if (!itemToEquip || itemToEquip.id !== itemId || (payload.inventoryItem && payload.inventoryItem !== itemToEquip)) return {};
            const quantity = itemToEquip.quantity ?? 1;
            if (!Number.isSafeInteger(quantity) || quantity < 1) return {};

            const isOneHandedWeapon = itemToEquip.type === 'weapon' && !isTwoHandedWeapon(itemToEquip);
            const isMainHandTwoHanded = isTwoHandedWeapon(charToUpdate.equippedItems.MainHand);
            const targetSlot = isOneHandedWeapon
                ? (isMainHandTwoHanded ? 'MainHand' : !charToUpdate.equippedItems.MainHand ? 'MainHand' : !charToUpdate.equippedItems.OffHand ? 'OffHand' : 'MainHand')
                : itemToEquip.slot || null;

            if (!targetSlot) return {};

            // GG-167: Enforce shared mannequin weapon/armor slot-acceptance rules so
            // mis-slotted items (e.g., a weapon with slot 'Torso' or body armor with
            // slot 'MainHand') are refused cleanly before writing to equippedItems.
            if (
                (itemToEquip.slot && !slotAcceptsItem(itemToEquip.slot, itemToEquip)) ||
                !slotAcceptsItem(targetSlot, itemToEquip)
            ) {
                return {};
            }

            // GG-502: If trying to equip into OffHand while wielding a Two-Handed weapon in MainHand, refuse!
            if (targetSlot === 'OffHand' && isMainHandTwoHanded) {
                return {};
            }

            const newEquippedItems = { ...charToUpdate.equippedItems };
            const newInventory = [...state.inventory];
            const itemInSlot = newEquippedItems[targetSlot];

            if (itemInSlot) newInventory.push(itemInSlot);

            // GG-502: If equipping a Two-Handed weapon in MainHand, unequip any item currently in OffHand!
            if (targetSlot === 'MainHand' && isTwoHandedWeapon(itemToEquip)) {
                const offHandItem = newEquippedItems.OffHand;
                if (offHandItem) {
                    newInventory.push(offHandItem);
                    delete newEquippedItems.OffHand;
                }
            }

            // One hand or armor slot takes one unit. Its spare stays with the
            // same provenance; existing gear returns to the pack as before.
            newEquippedItems[targetSlot] = quantity > 1 ? { ...itemToEquip, quantity: 1 } : itemToEquip;
            if (quantity > 1) newInventory[sourceIndex] = { ...itemToEquip, quantity: quantity - 1 };
            else newInventory.splice(sourceIndex, 1);

            // RALPH: Logic Extraction.
            // Uses centralized utility to recalculate AC, HP, and Ability Scores.
            // Donning body armor ends this generated cast; unequipping later
            // must not revive its old eight-hour benefit. Other conditions stay.
            const statusEffects = targetSlot === 'Torso' && itemToEquip.type === 'armor'
                ? charToUpdate.statusEffects.filter(effect => !isPreparedMageArmor(effect))
                : charToUpdate.statusEffects;
            const updatedPlayerCharacter = updateDerivedStats({ ...charToUpdate, statusEffects, equippedItems: newEquippedItems });

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
            if (action.payload.unpack) {
                const result = prepareAdventuringPack(state,action.payload);
                return 'patch' in result ? result.patch : {};
            }
            if (action.payload.meal) {
                if (!state.party.some(member => member.id === action.payload.characterId)) return {};
                const meal = preparePartyMeal(state, action.payload.meal);
                return 'patch' in meal ? meal.patch : {};
            }
            // Inventory and burning fuel change atomically; repeated use cannot spend a second torch.
            if (action.payload.itemId === 'torch' || action.payload.light) {
                const result = prepareCarriedTorch(state, action.payload);
                return 'patch' in result ? result.patch : {};
            }
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
                    let healAmount = itemToUse.effect.value ?? 0;
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

        case 'APPLY_HEALERS_KIT': {
            const { kitItemId, kitUsesRemaining, targetCharacterId, stabilized, healing, hitPointDice } = action.payload;
            const charIndex = state.party.findIndex(c => c.id === targetCharacterId);
            if (charIndex === -1) return {};

            const target = { ...state.party[charIndex] };

            if (healing > 0) {
                target.hp = Math.min(target.maxHp, target.hp + healing);
            }
            if (hitPointDice) {
                target.hitPointDice = hitPointDice;
            }
            if (stabilized) {
                // Refresh the Stable marker rather than stacking duplicates, the
                // same contract the combat stabilization path keeps
                // (src/commands/effects/utility/combatSupport.ts).
                target.statusEffects = [
                    ...(target.statusEffects || []).filter(existing => existing.name !== 'Stable'),
                    {
                        id: generateId(),
                        name: 'Stable',
                        // The party-side StatusEffect union has no neutral band;
                        // Stable is a beneficial state, so it files under 'buff'.
                        type: 'buff' as const,
                        duration: 0,
                        source: "Healer's Kit",
                        description: `${target.name} is stable and is no longer making death saves.`,
                        effect: { type: 'condition' },
                    },
                ];
                target.conditions = [
                    ...(target.conditions || []).filter(condition => condition !== 'Stable'),
                    'Stable',
                ];
            }

            const newParty = [...state.party];
            newParty[charIndex] = target;

            // A kit with no uses left is spent and leaves the inventory; otherwise
            // the remaining-use counter is written back onto the kit instance.
            const newInventory = kitUsesRemaining <= 0
                ? state.inventory.filter(item => item.id !== kitItemId)
                : state.inventory.map(item => (
                    item.id === kitItemId ? { ...item, usesRemaining: kitUsesRemaining } : item
                ));

            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === target.id
                ? { ...state.characterSheetModal, character: target }
                : state.characterSheetModal;

            return {
                party: newParty,
                inventory: newInventory,
                characterSheetModal: newCharacterSheetModalState,
            };
        }

        case 'TOGGLE_PREPARED_SPELL': {
            const {characterId, spellId, spellLevels, resetPlan} = action.payload;
            const index = state.party.findIndex(character => character.id === characterId);
            if (index < 0 || (!resetPlan && !spellLevels)) return {};
            const result = togglePreparationPlan(state.party[index], spellId, spellLevels ?? {}, getRulesEdition(state), resetPlan);
            if (result.character === state.party[index]) return {};
            const party = [...state.party];
            party[index] = result.character;
            // The open sheet displays the draft; casting still reads active spells.
            const characterSheetModal = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === characterId
                ? {...state.characterSheetModal, character: result.character} : state.characterSheetModal;
            return {party, characterSheetModal};
        }

        case 'APPLY_CHARACTER_STATUS_EFFECT': {
            // Out-of-combat effect persistence (the combat engine only writes to
            // CombatState snapshots). Mirrors the engine's same-source de-dup so
            // re-casting replaces rather than stacks.
            const { characterId, statusEffect } = action.payload;
            if (!state.party.some(char => char.id === characterId)) return {};
            return {
                party: state.party.map(char => {
                    // Concentration belongs to the caster, even when its old
                    // effect was on somebody else. Preserve all other owners.
                    const remaining = removePreviousPreparedConcentration(char.statusEffects ?? [], statusEffect);
                    if (char.id !== characterId) return remaining === char.statusEffects ? char : { ...char, statusEffects: remaining };
                    const retained = remaining.filter(existing =>
                        existing.source !== statusEffect.source ||
                        existing.sourceCasterId !== statusEffect.sourceCasterId,
                    );
                    const updated = { ...char, statusEffects: [...retained, statusEffect] };
                    // Applying the lasting cast updates AC without recasting or
                    // resetting its paid resource and world-clock ownership.
                    return isPreparedMageArmor(statusEffect)
                        ? { ...updated, armorClass: calculateArmorClass(updated, updated.activeEffects) }
                        : updated;
                }),
            };
        }

        case 'CAST_SPELL': {
            // Object choice, binding and recast replacement settle atomically.
            if(action.payload.outOfCombat&&action.payload.spellId==='light') {
                const result=prepareObjectLightCast(state,action.payload);
                return 'error'in result?{}:result.patch;
            }
            // Container, source, current preparation and slot are settled together.
            // The generic spell path cannot spend a water slot without a choice.
            if (action.payload.outOfCombat&&action.payload.spellId===CONTAINED_WATER_SPELL_ID) {
                const result=prepareContainedWaterCast(state,action.payload);
                return 'error' in result?{}:result.patch;
            }
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

                // Restore Warlock Pact Magic spell slots on Short Rest.
                // In D&D 5e (both 2014 and 2024), Warlock Pact Magic slots recharge on a short rest.
                // For multiclass characters, only the slots belonging to the Warlock level pool are recharged,
                // leaving long-rest caster slots (Wizard, Cleric, etc.) untouched.
                const warlockLevel = updatedChar.class?.id?.toLowerCase() === 'warlock'
                    ? (updatedChar.level ?? 1)
                    : (updatedChar.classLevels?.warlock ?? 0);

                if (warlockLevel > 0 && updatedChar.spellSlots) {
                    const warlockSlots = spellSlotsForClassLevel('warlock', warlockLevel);
                    if (warlockSlots) {
                        let slotsChanged = false;
                        const restoredSlots = { ...updatedChar.spellSlots };
                        for (let lvl = 1; lvl <= 5; lvl++) {
                            const slotKey = `level_${lvl}` as keyof SpellSlots;
                            const pactMax = warlockSlots[slotKey]?.max ?? 0;
                            if (pactMax > 0 && restoredSlots[slotKey]) {
                                const current = restoredSlots[slotKey].current;
                                const max = restoredSlots[slotKey].max;
                                // Restore expended pact slots up to the available max capacity
                                const newCurrent = Math.min(max, Math.max(current, pactMax));
                                if (newCurrent !== current) {
                                    restoredSlots[slotKey] = {
                                        ...restoredSlots[slotKey],
                                        current: newCurrent,
                                    };
                                    slotsChanged = true;
                                }
                            }
                        }
                        if (slotsChanged) {
                            updatedChar = { ...updatedChar, spellSlots: restoredSlots };
                            hasChanged = true;
                        }
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
            // A paid night grants benefits only after reaching its reserved bed.
            // Expired, moved or already-used admissions cannot bypass recovery.
            if (action.payload?.lodgingRestAdmission && lodgingRestError(state, action.payload.lodgingRestAdmission)) return {};
            // GG-449: A party can only benefit from one Long Rest in a 24-hour period,
            // with at least 16 hours between rests (D&D 5e / glossary long_rest).
            // If less than 16 hours have passed since the last Long Rest, refuse the rest.
            const currentTime = state.gameTime ? new Date(state.gameTime) : null;
            if (state.lastLongRestAt && currentTime) {
                const lastRestMs = new Date(state.lastLongRestAt).getTime();
                const currentMs = currentTime.getTime();
                const cooldownMs = 16 * 3600 * 1000;
                if (!isNaN(lastRestMs) && !isNaN(currentMs) && (currentMs - lastRestMs < cooldownMs)) {
                    return state;
                }
            }

            const rulesEdition = getRulesEdition(state);
            const deniedIds = action.payload?.deniedCharacterIds || [];
            const racialChoices = action.payload?.racialRestChoices || {};

            // Preview and settlement use the same owned-meal allocation. A
            // private bag feeds its owner; shared-only behavior stays intact.
            const meals = planRestMeals(state, deniedIds);

            const newParty = state.party.map(char => {
                const charId = char.id;
                const partyEats = meals.fedIds.includes(charId);
                if (charId && deniedIds.includes(charId)) {
                    return char; // No benefits for denied characters
                }

                // GG-449: In D&D 5e (PHB 2014 p. 186 / PHB 2024 p. 367), a character
                // must have at least 1 HP at the start of a Long Rest to gain its benefits.
                // A character at 0 HP is unconscious/dying and does not regain HP, spell slots,
                // Hit Dice, or features from resting.
                if (char.hp <= 0) {
                    return char;
                }

                // Only an eligible completed long rest commits the saved spell plan.
                const charCopy = { ...completePreparation(char, rulesEdition) };
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
                // Recover one level using the same legacy/numbered forms combat
                // reads. Other persistent conditions and denied/downed members
                // keep their existing rules. Older-edition recovery needs a meal.
                const exhaustion = exhaustionLevelFromConditions(charCopy.conditions);
                if (exhaustion > 0 && (rulesEdition === '2024' || partyEats)) {
                    charCopy.conditions = (charCopy.conditions ?? []).filter(c => !/^exhaustion(?:[_ -]?\d)?$/i.test(c));
                    if (exhaustion > 1) charCopy.conditions.push(`exhaustion_${exhaustion - 1}`);
                }
                const stillStarving = (charCopy.conditions ?? []).includes('starving');

                // Restore HP — unless the member is still starving (PRV9): you
                // cannot recover on an empty stomach.
                if (!stillStarving) {
                    charCopy.hp = charCopy.maxHp;
                }

                // Reset flight status
                charCopy.isFlying = false;

                // GG-450: Clear temporary hit points (PHB 2014 p. 198 / PHB 2024 p. 25:
                // temporary hit points last until depleted or until finishing a Long Rest).
                charCopy.tempHP = 0;

                // GG-451: Restore Hit Point Dice according to the active rules edition:
                // - 2024 rules: Long Rest restores all spent Hit Dice.
                // - 2014 rules: Long Rest restores up to half of the character's total Hit Dice (minimum of 1).
                const currentPools = buildHitPointDicePools(charCopy);
                if (rulesEdition === '2024') {
                    charCopy.hitPointDice = currentPools.map(pool => ({
                        ...pool,
                        current: pool.max,
                    }));
                } else {
                    // 2014: regain up to floor(total/2) spent dice, minimum 1 die if any were spent.
                    const totalMax = currentPools.reduce((sum, p) => sum + p.max, 0);
                    const totalSpent = currentPools.reduce((sum, p) => sum + (p.max - p.current), 0);
                    let diceToRegain = Math.min(totalSpent, Math.max(1, Math.floor(totalMax / 2)));

                    // Regain dice starting from the largest die size down to smallest (d12 down to d6)
                    // so multiclass characters recover their most valuable dice first.
                    const sortedByDieDesc = [...currentPools].sort((a, b) => b.die - a.die);
                    const regainedByDie = new Map<number, number>();

                    for (const pool of sortedByDieDesc) {
                        if (diceToRegain <= 0) break;
                        const spentInPool = pool.max - pool.current;
                        if (spentInPool > 0) {
                            const regain = Math.min(spentInPool, diceToRegain);
                            regainedByDie.set(pool.die, regain);
                            diceToRegain -= regain;
                        }
                    }

                    charCopy.hitPointDice = currentPools.map(pool => ({
                        ...pool,
                        current: pool.current + (regainedByDie.get(pool.die) ?? 0),
                    }));
                }

                // Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest.
                if (charCopy.race?.traits?.some(t => t.toLowerCase().includes('resourceful'))) {
                    charCopy.heroicInspiration = true;
                }

                return charCopy;
            });
            // The cooldown begins when the eight-hour rest FINISHES. Recording
            // its start allowed a new rest only eight hours after waking.
            const restStart = currentTime?.getTime() ?? Date.now();
            const lastLongRestAt = new Date(restStart + 8 * 3600 * 1000).toISOString();
            return {
                // Permission is consumed only with the accepted recovery update.
                ...(action.payload?.lodgingRestAdmission ? consumeLodgingRest(state, action.payload.lodgingRestAdmission) : {}),
                party: newParty,
                lastLongRestAt,
                travelMinutesRemainder: 0,
                ...meals.patch,
                ...appendAdventureLogEntry(state, {
                    kind: 'rest',
                    summary: meals.fedIds.length
                        ? `The party took a long rest. Meals: ${state.party.filter(person => meals.fedIds.includes(person.id)).map(person => person.name).join(', ')}.`
                        : 'The party took a long rest.',
                }),
            };
        }

        case 'BUY_ITEM': {
            // Settle coin, one acquired unit and both shelf views together.
            // The helper rechecks current stock/funds for repeated clicks.
            return applyMerchantPurchase(state, action.payload, stampItemAcquiredAt);
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
            // Sell one unit from the clicked row, retaining other stacks and
            // returning carried stock to this shop when it sells that item.
            return applyMerchantSale(state, action.payload);
        }

        case 'SELL_FENCED_ITEM': {
            const { itemId, value } = action.payload;
            // Legal coin pays at face value; stale fence requests cannot discard it.
            if (isCurrencyItemId(itemId)) return {};
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

                const rulesEdition = getRulesEdition(state);
                if (xpGain !== 0) {
                    charToUpdate = applyXpAndHandleLevelUps(charToUpdate, xpGain, levelChoices, rulesEdition);
                } else if (canLevelUp(charToUpdate)) {
                    charToUpdate = performLevelUp(charToUpdate, levelChoices, { rulesEdition });
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

            // GG-502: Equip weapon in MainHand first if not already equipped (pick best proficient weapon)
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

            // GG-502: Equip Shield in OffHand only if MainHand is not two-handed
            if (isTwoHandedWeapon(newEquippedItems.MainHand)) {
                if (newEquippedItems.OffHand) {
                    newInventory.push(newEquippedItems.OffHand);
                    delete newEquippedItems.OffHand;
                }
            } else if (!newEquippedItems.OffHand) {
                const hasShieldProficiency = charToUpdate.class.armorProficiencies.map(p => p.toLowerCase()).includes('shields');
                if (hasShieldProficiency) {
                    const shield = newInventory.find(item => item.type === 'armor' && item.armorCategory === 'Shield');
                    if (shield) {
                        newEquippedItems.OffHand = shield;
                        newInventory = newInventory.filter(i => i.id !== shield.id);
                    }
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
            
            // GG-501: D&D 5e restricts active attunement to 3 magic items per character across inventory and all equipment
            const equippedAttunedCount = Object.values(character.equippedItems).filter(
                item => item && item.requiresAttunement && item.isAttuned && item.attunedCharacterId === characterId
            ).length;
            const inventoryAttunedCount = state.inventory.filter(
                item => item && item.requiresAttunement && item.isAttuned && item.attunedCharacterId === characterId
            ).length;
            const otherPartyEquippedAttunedCount = state.party.reduce((count, member) => {
                if (member.id === characterId) return count;
                return count + Object.values(member.equippedItems).filter(
                    item => item && item.requiresAttunement && item.isAttuned && item.attunedCharacterId === characterId
                ).length;
            }, 0);
            
            if (equippedAttunedCount + inventoryAttunedCount + otherPartyEquippedAttunedCount >= 3) {
                // Reject attunement if the character is at the 3-item limit
                return {};
            }

            // Find and attune the target item, whether it resides in the player's general bag or is equipped
            let itemFound = false;
            const newParty = state.party.map(p => ({
                ...p,
                equippedItems: { ...p.equippedItems }
            }));

            const newInventory = state.inventory.map(item => {
                if (item.id === itemId) {
                    itemFound = true;
                    return { ...item, isAttuned: true, attunedCharacterId: characterId };
                }
                return item;
            });

            if (!itemFound) {
                for (const member of newParty) {
                    for (const slot of Object.keys(member.equippedItems) as EquipmentSlotType[]) {
                        const item = member.equippedItems[slot];
                        if (item && item.id === itemId) {
                            member.equippedItems[slot] = { ...item, isAttuned: true, attunedCharacterId: characterId };
                            itemFound = true;
                            break;
                        }
                    }
                    if (itemFound) break;
                }
            }

            if (!itemFound) return {};

            // Recalculate all ability scores and AC since magical bonuses are now active
            for (let i = 0; i < newParty.length; i++) {
                newParty[i] = updateDerivedStats(newParty[i]);
            }

            const updatedChar = newParty[charIndex];
            const newCharacterSheetModalState = state.characterSheetModal.isOpen && state.characterSheetModal.character?.id === updatedChar.id
                ? { ...state.characterSheetModal, character: updatedChar }
                : state.characterSheetModal;

            return { party: newParty, inventory: newInventory, characterSheetModal: newCharacterSheetModalState };
        }

        case 'UNATTUNE_ITEM': {
            const { characterId, itemId } = action.payload as { characterId: string; itemId: string };
            const charIndex = state.party.findIndex(c => c.id === characterId);
            if (charIndex === -1) return {};

            let itemFound = false;
            const newParty = state.party.map(p => ({
                ...p,
                equippedItems: { ...p.equippedItems }
            }));

            // Clear attunement state on the target item in player inventory or equipment slots across party
            const newInventory = state.inventory.map(item => {
                if (item.id === itemId) {
                    itemFound = true;
                    return { ...item, isAttuned: false, attunedCharacterId: undefined };
                }
                return item;
            });

            if (!itemFound) {
                for (const member of newParty) {
                    for (const slot of Object.keys(member.equippedItems) as EquipmentSlotType[]) {
                        const item = member.equippedItems[slot];
                        if (item && item.id === itemId) {
                            member.equippedItems[slot] = { ...item, isAttuned: false, attunedCharacterId: undefined };
                            itemFound = true;
                            break;
                        }
                    }
                    if (itemFound) break;
                }
            }

            if (!itemFound) return {};

            // Recalculate derived attributes since magical stat/AC modifiers are no longer active
            for (let i = 0; i < newParty.length; i++) {
                newParty[i] = updateDerivedStats(newParty[i]);
            }

            const updatedChar = newParty[charIndex];
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

        // Persist where an item is stowed. The character sheet used to keep
        // container assignments in local component state, so they were lost on
        // unmount and never reached a save. The assignment now lives on the item
        // itself (`Item.containerId`), which the sheet already reads (agora-17eb).
        case 'MOVE_ITEM_TO_CONTAINER': {
            const { itemId, containerId, inventoryIndex, sourceItem } = action.payload;

            // One dropdown selects one source stack. Same catalog IDs can carry
            // different ages or pack origins; never reorganize all of them.
            // Older callers remain valid only when their bare ID is unambiguous.
            let selectedIndex: number;
            if (inventoryIndex !== undefined) {
                if (!Number.isInteger(inventoryIndex) || inventoryIndex < 0) return {};
                selectedIndex = inventoryIndex;
                const selected = state.inventory[selectedIndex];
                if (!selected || selected.id !== itemId || (sourceItem !== undefined && sourceItem !== selected)) return {};
            } else {
                if (sourceItem !== undefined) return {};
                const matches = state.inventory.flatMap((item, index) => item.id === itemId ? [index] : []);
                if (matches.length !== 1) return {};
                selectedIndex = matches[0];
            }

            // An item cannot be stowed inside itself; that would build a cycle the
            // sheet's recursive weight walk has to defend against.
            if (containerId === itemId) return {};

            // The target must be a container the party actually carries. An
            // unknown id is a bug at the dispatch site, not something to guess at.
            if (containerId !== null) {
                const target = state.inventory.find(entry => entry.id === containerId);
                const targetIsContainer =
                    !!target &&
                    (target.isContainer === true ||
                        typeof target.capacitySlots === 'number' ||
                        typeof target.capacityWeight === 'number');
                if (!targetIsContainer) return {};
            }

            let moved = false;
            const newInventory = state.inventory.map((item, index) => {
                if (index !== selectedIndex) return item;
                if ((item.containerId ?? null) === containerId) return item;
                moved = true;
                if (containerId === null) {
                    // Back in the root backpack: drop the pointer rather than
                    // storing a sentinel the item type does not define.
                    const { containerId: _dropped, ...rest } = item;
                    return rest;
                }
                return { ...item, containerId };
            });

            if (!moved) return {};

            return { inventory: newInventory };
        }

        case 'SELL_ALL_JUNK': {
            const { items } = action.payload as { items: { itemId: string; value: number }[] };
            const newInventory = [...state.inventory];
            let goldEarned = 0;

            // Remove sold junk items and calculate total transaction earnings
            items.forEach(({ itemId, value }) => {
                // Even a legacy coin marked junk remains available money.
                if (isCurrencyItemId(itemId)) return;
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
