import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState, AbilityScoreName, Class, Item } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockPlayerCharacter } from '../../../utils/factories';
import { DEEP_GNOME_DATA } from '../../../data/races/deep_gnome';
import {
  applyRacialSpellGrantsByLevel,
  resolveRacialSpellLimitedUseId,
} from '../../../utils/character/characterUtils';

describe('characterReducer', () => {
    // Mock initial state
    const initialState: GameState = {
        party: [
            createMockPlayerCharacter({ id: 'char1', xp: 0, level: 1 })
        ],
        inventory: [],
        gold: 100,
        // ... other state props needed for reducer context if any
        dynamicLocationItemIds: {},
        currentLocationId: 'loc1',
        merchantModal: undefined,
        characterSheetModal: { isOpen: false, character: null },
    } as unknown as GameState;

    it('should handle MODIFY_GOLD', () => {
        const action: AppAction = { type: 'MODIFY_GOLD', payload: { amount: 50.5 } };
        const newState = characterReducer(initialState, action);
        expect(newState.gold).toBe(150.5);

        const action2: AppAction = { type: 'MODIFY_GOLD', payload: { amount: -200 } };
        const newState2 = characterReducer(initialState, action2);
        expect(newState2.gold).toBe(0); // Should clamp to 0
    });

    it('should handle SELL_FENCED_ITEM by paying gold and removing the fenced item', () => {
        const fencedItem = {
            id: 'silver_chalice',
            name: 'Silver Chalice',
            type: 'misc',
            description: 'A cup that should not be sold in daylight.',
            weight: 1,
            costInGp: 200,
            quantity: 1,
        } as unknown as Item;
        const state = { ...initialState, inventory: [fencedItem], gold: 10 } as GameState;

        const newState = characterReducer(state, {
            type: 'SELL_FENCED_ITEM',
            payload: {
                itemId: fencedItem.id,
                value: 140,
                locationId: 'black_market',
                heatGenerated: 2,
            },
        });

        // Fence sales share the same inventory and wallet outcome as ordinary
        // sales, while the crime reducer handles the illegal heat.
        expect(newState.inventory).toEqual([]);
        expect(newState.gold).toBe(150);
    });

    it('should handle GRANT_EXPERIENCE', () => {
        const action: AppAction = { type: 'GRANT_EXPERIENCE', payload: { amount: 300 } };
        const newState = characterReducer(initialState, action);

        // At level 1, 300 XP is enough to reach level 2 (cumulative: 1->0, 2->300)
        // Wait, standard 5e: Level 2 at 300 XP.
        // Factory char starts at 0 XP. +300 => 300.
        // applyXpAndHandleLevelUps should trigger level up if logic holds.

        expect(newState.party).toBeDefined();
        if (newState.party) {
             const char = newState.party[0];
             expect(char.xp).toBe(300);
             expect(char.level).toBe(2);
        }
    });

    it('should apply short rest healing, hit dice updates, and limited use resets', () => {
        const character = createMockPlayerCharacter({
            id: 'short-rest-char',
            hp: 5,
            maxHp: 12,
            hitPointDice: [{ die: 10, current: 2, max: 2 }],
            limitedUses: {
                second_wind: { name: 'Second Wind', current: 0, max: 1, resetOn: 'short_rest' }
            }
        });
        const state = { ...initialState, party: [character] } as GameState;
        const action: AppAction = {
            type: 'SHORT_REST',
            payload: {
                healingByCharacterId: { 'short-rest-char': 4 },
                hitPointDiceUpdates: { 'short-rest-char': [{ die: 10, current: 1, max: 2 }] }
            }
        };

        const newState = characterReducer(state, action);
        const updated = newState.party?.[0];

        expect(updated?.hp).toBe(9);
        expect(updated?.hitPointDice?.[0].current).toBe(1);
        expect(updated?.limitedUses?.second_wind.current).toBe(1);
    });

    it('should restore hit point dice on long rest', () => {
        const character = createMockPlayerCharacter({
            id: 'long-rest-char',
            hp: 3,
            maxHp: 10,
            level: 2, // Set level to 2 to support 2 max hit dice
            hitPointDice: [{ die: 8, current: 0, max: 2 }]
        });
        const state = { ...initialState, party: [character] } as GameState;
        const action: AppAction = { type: 'LONG_REST', payload: { deniedCharacterIds: [] } };

        const newState = characterReducer(state, action);
        const updated = newState.party?.[0];

        expect(updated?.hp).toBe(10);
        expect(updated?.hitPointDice?.[0].current).toBe(2);
    });

    it('should apply racial rest choices (e.g. Astral Knowledge) on long rest', () => {
        const character = createMockPlayerCharacter({
            id: 'long-rest-githyanki',
            skills: [{ name: 'Athletics', proficiencyLevel: 'proficient' }],
            weaponProficiencies: ['Shortsword']
        });
        const state = { ...initialState, party: [character] } as GameState;
        
        const action: AppAction = { 
            type: 'LONG_REST', 
            payload: { 
                deniedCharacterIds: [],
                racialRestChoices: {
                    'long-rest-githyanki': {
                        'astral_knowledge': {
                            skillIds: ['Arcana'],
                            weaponIds: ['Longsword']
                        }
                    }
                }
            } 
        };

        const newState = characterReducer(state, action);
        const updated = newState.party?.[0];

        // Should have old skill + new skill
        expect(updated?.skills.some(s => s.name === 'Athletics')).toBe(true);
        expect(updated?.skills.some(s => s.name === 'Arcana')).toBe(true);
        // Should have old weapon + new weapon
        expect(updated?.weaponProficiencies).toContain('Shortsword');
        expect(updated?.weaponProficiencies).toContain('Longsword');

        // And it should have stored the choices so they can be removed next time
        expect(updated?.racialRestChoices?.['astral_knowledge'].skillIds).toEqual(['Arcana']);

        // Now do ANOTHER long rest with different choices, to verify old ones are removed
        const secondAction: AppAction = {
            type: 'LONG_REST', 
            payload: { 
                deniedCharacterIds: [],
                racialRestChoices: {
                    'long-rest-githyanki': {
                        'astral_knowledge': {
                            skillIds: ['History'],
                            toolIds: ["Thieves' Tools"]
                        }
                    }
                }
            } 
        };

        const finalState = characterReducer(newState as GameState, secondAction);
        const finalChar = finalState.party?.[0];

        // Should have removed Arcana and Longsword, added History and Thieves' Tools
        expect(finalChar?.skills.some(s => s.name === 'Arcana')).toBe(false);
        expect(finalChar?.skills.some(s => s.name === 'History')).toBe(true);
        expect(finalChar?.weaponProficiencies).not.toContain('Longsword');
        expect(finalChar?.toolProficiencies).toContain("Thieves' Tools");
    });

    it('should consume deep gnome race spells from long-rest resources first', () => {
        const wizardClass: Class = {
            id: 'wizard',
            name: 'Wizard',
            description: 'A prepared wizard.',
            hitDie: 6,
            primaryAbility: ['Intelligence'] as AbilityScoreName[],
            savingThrowProficiencies: ['Intelligence', 'Wisdom'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 2,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: [],
            spellcasting: {
                ability: 'Intelligence',
                knownCantrips: 3,
                knownSpellsL1: 6,
                spellList: [],
            },
        };

        const baseCharacter = createMockPlayerCharacter({
            id: 'deep-gnome-caster',
            level: 5,
            race: DEEP_GNOME_DATA,
            class: wizardClass,
            racialSelections: {
                deep_gnome: { spellAbility: 'Intelligence' },
            },
            spellSlots: {
                level_1: { current: 4, max: 4 },
                level_2: { current: 4, max: 4 },
                level_3: { current: 1, max: 4 },
                level_4: { current: 4, max: 4 },
                level_5: { current: 4, max: 4 },
                level_6: { current: 0, max: 0 },
                level_7: { current: 0, max: 0 },
                level_8: { current: 0, max: 0 },
                level_9: { current: 0, max: 0 },
            },
        });
        const deepGnome = applyRacialSpellGrantsByLevel(baseCharacter, 5);
        const state = { ...initialState, party: [deepGnome] } as GameState;
        const action: AppAction = {
            type: 'CAST_SPELL',
            payload: {
                characterId: 'deep-gnome-caster',
                spellId: 'disguise-self',
                spellLevel: 3,
                castSource: { type: 'racial', allowSlotFallback: false },
            },
        };
        const casted = characterReducer(state, action);
        const castedChar = casted.party?.[0];
        const limitedUseId = resolveRacialSpellLimitedUseId('deep_gnome', 'disguise-self');

        expect(castedChar?.limitedUses?.[limitedUseId].current).toBe(0);
        expect(castedChar?.spellSlots?.level_3.current).toBe(1);
        expect(castedChar?.limitedUses?.[limitedUseId].max).toBe(1);

        const blockedCastAction: AppAction = {
            type: 'CAST_SPELL',
            payload: {
                characterId: 'deep-gnome-caster',
                spellId: 'disguise-self',
                spellLevel: 3,
                castSource: { type: 'racial', allowSlotFallback: false },
            },
        };
        const blockedCast = characterReducer({ ...state, party: [castedChar!] }, blockedCastAction);
        const blockedChar = blockedCast.party?.[0];

        expect(blockedChar?.limitedUses?.[limitedUseId].current).toBe(0);
        expect(blockedChar?.spellSlots?.level_3.current).toBe(1);
    });

    it('should restore deep gnome racial spell resources on long rest but not short rest', () => {
        const wizardClass: Class = {
            id: 'wizard',
            name: 'Wizard',
            description: 'A prepared wizard.',
            hitDie: 6,
            primaryAbility: ['Intelligence'] as AbilityScoreName[],
            savingThrowProficiencies: ['Intelligence', 'Wisdom'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 2,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: [],
            spellcasting: {
                ability: 'Intelligence',
                knownCantrips: 3,
                knownSpellsL1: 6,
                spellList: [],
            },
        };

        const baseCharacter = createMockPlayerCharacter({
            id: 'deep-gnome-restore',
            level: 5,
            race: DEEP_GNOME_DATA,
            class: wizardClass,
            racialSelections: {
                deep_gnome: { spellAbility: 'Intelligence' },
            },
            spellbook: {
                knownSpells: [],
                cantrips: [],
                preparedSpells: [],
            },
        });
        const deepGnome = applyRacialSpellGrantsByLevel(baseCharacter, 5);
        const depleteAction: AppAction = {
            type: 'CAST_SPELL',
            payload: {
                characterId: 'deep-gnome-restore',
                spellId: 'disguise-self',
                spellLevel: 3,
                castSource: { type: 'racial', allowSlotFallback: false },
            },
        };
        const depletedState = characterReducer({ ...initialState, party: [deepGnome] }, depleteAction);
        const depletedChar = depletedState.party?.[0];
        const limitedUseId = resolveRacialSpellLimitedUseId('deep_gnome', 'disguise-self');
        expect(depletedChar?.limitedUses?.[limitedUseId].current).toBe(0);

        const shortRest = characterReducer(depletedState as GameState, { type: 'SHORT_REST', payload: {} });
        expect(shortRest.party?.[0].limitedUses?.[limitedUseId].current).toBe(0);

        const longRest = characterReducer(depletedState as GameState, { type: 'LONG_REST', payload: {} });
        expect(longRest.party?.[0].limitedUses?.[limitedUseId].current).toBe(1);
    });

    it('should block deep gnome racial spell casts above the defined max cast level', () => {
        const wizardClass: Class = {
            id: 'wizard',
            name: 'Wizard',
            description: 'A prepared wizard.',
            hitDie: 6,
            primaryAbility: ['Intelligence'] as AbilityScoreName[],
            savingThrowProficiencies: ['Intelligence', 'Wisdom'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 2,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: [],
            spellcasting: {
                ability: 'Intelligence',
                knownCantrips: 3,
                knownSpellsL1: 6,
                spellList: [],
            },
        };
        const deepGnome = applyRacialSpellGrantsByLevel(
            createMockPlayerCharacter({
                id: 'deep-gnome-overlevel',
                level: 5,
                race: DEEP_GNOME_DATA,
                class: wizardClass,
                racialSelections: {
                    deep_gnome: { spellAbility: 'Intelligence' },
                },
            }),
            5
        );

        const state = { ...initialState, party: [deepGnome] } as GameState;
        const blockedAction: AppAction = {
            type: 'CAST_SPELL',
            payload: {
                characterId: 'deep-gnome-overlevel',
                spellId: 'disguise-self',
                spellLevel: 4,
                castSource: { type: 'racial', allowSlotFallback: false },
            },
        };
        const castResult = characterReducer(state, blockedAction);
        const castChar = castResult.party?.[0];
        const limitedUseId = resolveRacialSpellLimitedUseId('deep_gnome', 'disguise-self');

        expect(castChar?.limitedUses?.[limitedUseId].current).toBe(1);
    });

    it('should grant heroicInspiration on long rest for Resourceful characters', () => {
        const character = createMockPlayerCharacter({
            id: 'resourceful-char',
            hp: 5,
            maxHp: 10,
            race: {
                id: 'human',
                name: 'Human',
                traits: ['Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest.']
            } as any
        });
        const state = { ...initialState, party: [character] } as GameState;
        const action: AppAction = { type: 'LONG_REST', payload: {} };

        const newState = characterReducer(state, action);
        const updated = newState.party?.[0];

        expect(updated?.heroicInspiration).toBe(true);
    });

    it('should handle USE_ITEM by applying a healing effect and removing the item from inventory', () => {
        const character = createMockPlayerCharacter({
            id: 'use-item-char',
            hp: 3,
            maxHp: 10,
        });

        const healingPotion: Item = {
            id: 'health_potion',
            name: 'Health Potion',
            description: 'A basic healing potion.',
            type: 'consumable',
            effect: 'heal_5',
        };

        const state = {
            ...initialState,
            party: [character],
            inventory: [healingPotion],
            currentLocationId: 'town_square',
            characterSheetModal: { isOpen: false, character: null },
        } as GameState;

        const action: AppAction = {
            type: 'USE_ITEM',
            payload: {
                itemId: 'health_potion',
                characterId: 'use-item-char',
            },
        };

        const newState = characterReducer(state, action);

        expect(newState.party?.[0].hp).toBe(8);
        expect(newState.inventory).toHaveLength(0);
    });

    it('should keep equip and drop item actions on the normalized item contract path', () => {
        const character = createMockPlayerCharacter({
            id: 'equip-drop-char',
            hp: 10,
            maxHp: 10,
        });

        const steelSword: Item = {
            id: 'steel_sword',
            name: 'Steel Sword',
            description: 'A reliable weapon.',
            type: 'weapon',
            slot: 'MainHand',
        };
        const driedMeat: Item = {
            id: 'dried_meat',
            name: 'Dried Meat',
            description: 'Food with no special effects.',
            type: 'food_drink',
        };

        const state = {
            ...initialState,
            party: [character],
            inventory: [steelSword, driedMeat],
            dynamicLocationItemIds: { town_square: ['dried_meat'] },
            currentLocationId: 'town_square',
            characterSheetModal: { isOpen: false, character: null },
        } as GameState;

        const equipState = characterReducer(state, {
            type: 'EQUIP_ITEM',
            payload: { itemId: 'steel_sword', characterId: 'equip-drop-char' },
        });

        expect(equipState.party?.[0].equippedItems.MainHand?.id).toBe('steel_sword');
        expect(equipState.inventory.some(item => item.id === 'steel_sword')).toBe(false);

        const dropState = characterReducer({
            ...equipState,
            currentLocationId: 'town_square',
            dynamicLocationItemIds: { town_square: [] },
        } as GameState, {
            type: 'DROP_ITEM',
            payload: { itemId: 'dried_meat', characterId: 'equip-drop-char' },
        });

        expect(dropState.inventory.some(item => item.id === 'dried_meat')).toBe(false);
        expect(dropState.dynamicLocationItemIds.town_square).toContain('dried_meat');
    });

    it('should consume spell material components when materialComponentItemIdToConsume is provided in CAST_SPELL', () => {
        const character = createMockPlayerCharacter({
            id: 'caster-char',
            spellSlots: {
                level_1: { current: 1, max: 1 },
                level_2: { current: 0, max: 0 },
                level_3: { current: 1, max: 1 },
                level_4: { current: 0, max: 0 },
                level_5: { current: 0, max: 0 },
                level_6: { current: 0, max: 0 },
                level_7: { current: 0, max: 0 },
                level_8: { current: 0, max: 0 },
                level_9: { current: 0, max: 0 },
            }
        });

        const diamondItem: Item = {
            id: 'diamond_300gp',
            name: 'Diamond (300 gp)',
            type: 'spell_component',
            costInGp: 300
        };

        const state = {
            ...initialState,
            party: [character],
            inventory: [diamondItem]
        } as GameState;

        // Cast spell and consume the component
        const action: AppAction = {
            type: 'CAST_SPELL',
            payload: {
                characterId: 'caster-char',
                spellId: 'revivify',
                spellLevel: 3,
                materialComponentItemIdToConsume: 'diamond_300gp'
            }
        };

        const newState = characterReducer(state, action);
        expect(newState.inventory?.some(item => item.id === 'diamond_300gp')).toBe(false);
        expect(newState.party?.[0].spellSlots?.level_3.current).toBe(0);
    });

    it('should handle TOGGLE_ITEM_JUNK and SELL_ALL_JUNK actions', () => {
        const character = createMockPlayerCharacter({
            id: 'junk-char',
        });
        const item1: Item = { id: 'rusty_nail', name: 'Rusty Nail', type: 'junk', isJunk: false };
        const item2: Item = { id: 'silver_chalice', name: 'Silver Chalice', type: 'valuable', isJunk: false };
        let state = {
            ...initialState,
            party: [character],
            inventory: [item1, item2],
            gold: 10,
        } as GameState;

        const reduce = (currentState: GameState, action: AppAction): GameState => {
            return { ...currentState, ...characterReducer(currentState, action) } as GameState;
        };

        // Toggle junk on item1
        state = reduce(state, {
            type: 'TOGGLE_ITEM_JUNK',
            payload: { itemId: 'rusty_nail' }
        });
        expect(state.inventory.find(item => item.id === 'rusty_nail')?.isJunk).toBe(true);

        // Sell all junk
        state = reduce(state, {
            type: 'SELL_ALL_JUNK',
            payload: {
                items: [{ itemId: 'rusty_nail', value: 5 }],
                totalGold: 5
            }
        });
        expect(state.inventory.some(item => item.id === 'rusty_nail')).toBe(false);
        expect(state.inventory.some(item => item.id === 'silver_chalice')).toBe(true);
        expect(state.gold).toBe(15);
    });

    it('should handle ATTUNE_ITEM and UNATTUNE_ITEM and enforce a 3-item attunement limit', () => {
        const character = createMockPlayerCharacter({
            id: 'attune-char',
            equippedItems: {},
        });
        const ring1: Item = { id: 'ring_1', name: 'Ring of Protection', type: 'ring', requiresAttunement: true };
        const ring2: Item = { id: 'ring_2', name: 'Ring of Evasion', type: 'ring', requiresAttunement: true };
        const ring3: Item = { id: 'ring_3', name: 'Ring of Regeneration', type: 'ring', requiresAttunement: true };
        const ring4: Item = { id: 'ring_4', name: 'Ring of Power', type: 'ring', requiresAttunement: true };

        let state = {
            ...initialState,
            party: [character],
            inventory: [ring1, ring2, ring3, ring4],
        } as GameState;

        const reduce = (currentState: GameState, action: AppAction): GameState => {
            return { ...currentState, ...characterReducer(currentState, action) } as GameState;
        };

        // Attune 1st ring
        state = reduce(state, { type: 'ATTUNE_ITEM', payload: { itemId: 'ring_1', characterId: 'attune-char' } });
        expect(state.inventory.find(i => i.id === 'ring_1')?.isAttuned).toBe(true);

        // Attune 2nd and 3rd rings
        state = reduce(state, { type: 'ATTUNE_ITEM', payload: { itemId: 'ring_2', characterId: 'attune-char' } });
        state = reduce(state, { type: 'ATTUNE_ITEM', payload: { itemId: 'ring_3', characterId: 'attune-char' } });

        // Attempting to attune a 4th ring should fail/do nothing (due to 3-item limit)
        const stateOverLimit = reduce(state, { type: 'ATTUNE_ITEM', payload: { itemId: 'ring_4', characterId: 'attune-char' } });
        expect(stateOverLimit.inventory.find(i => i.id === 'ring_4')?.isAttuned).toBeFalsy();

        // Unattune 1st ring on the valid state
        const stateUnattuned = reduce(state, { type: 'UNATTUNE_ITEM', payload: { itemId: 'ring_1', characterId: 'attune-char' } });
        expect(stateUnattuned.inventory.find(i => i.id === 'ring_1')?.isAttuned).toBe(false);
    });

    it('should reduce movement speed by 10ft if heavy armor is equipped and Strength is too low', () => {
        const character = createMockPlayerCharacter({
            id: 'strength-char',
            finalAbilityScores: { Strength: 10 } as any,
            equippedItems: {},
            race: { traits: ['Speed: 30 feet'] } as any
        });

        const heavyArmor: Item = {
            id: 'plate_armor',
            name: 'Plate Armor',
            type: 'armor',
            slot: 'Torso',
            armorCategory: 'Heavy',
            strengthRequirement: 15,
            baseArmorClass: 18
        };

        const state = {
            ...initialState,
            party: [character],
            inventory: [heavyArmor],
        } as GameState;

        // Equip the heavy armor
        const equippedState = characterReducer(state, {
            type: 'EQUIP_ITEM',
            payload: { itemId: 'plate_armor', characterId: 'strength-char' }
        });

        const char = equippedState.party?.[0];
        expect(char?.equippedItems.Torso?.id).toBe('plate_armor');
        // Speed should be reduced from 30ft to 20ft
        expect(char?.speed).toBe(20);
    });
});
