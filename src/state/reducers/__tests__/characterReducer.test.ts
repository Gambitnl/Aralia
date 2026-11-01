import { describe, it, expect } from 'vitest';
import { ItemType } from '../../../types';
import { characterReducer } from '../characterReducer';
import { GameState, AbilityScoreName, Class, Item } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockPlayerCharacter } from '../../../utils/core';
import { DEEP_GNOME_DATA } from '../../../data/races/deep_gnome';
import {
  applyRacialSpellGrantsByLevel,
  resolveRacialSpellLimitedUseId,
} from '../../../utils/character/characterUtils';
import { canEquipItem } from '../../../utils/character';

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
            skills: [{ name: 'Athletics', proficiencyLevel: 'proficient' } as any],
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

        const stateAfter16h = {
            ...state,
            ...newState,
            gameTime: new Date(new Date((newState as any).lastLongRestAt || state.gameTime).getTime() + 16 * 3600 * 1000),
        };
        const finalState = characterReducer(stateAfter16h as GameState, secondAction);
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

    describe('LONG_REST Hit Dice and Temporary HP (GG-450, GG-451 / agora-9234)', () => {
        it('clears temporary HP on LONG_REST', () => {
            const char = createMockPlayerCharacter({
                id: 'temp-hp-char',
                hp: 10,
                maxHp: 20,
                tempHP: 15,
            });
            const state = { ...initialState, party: [char], rulesEdition: '2024' } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].tempHP).toBe(0);
        });

        it('restores all spent Hit Dice in 2024 rules edition', () => {
            const fighter = createMockPlayerCharacter({
                id: 'fighter-2024',
                level: 6,
                class: { id: 'fighter', name: 'Fighter', hitDie: 10 } as any,
                hitPointDice: [{ die: 10, current: 0, max: 6 }],
            });
            const state = { ...initialState, party: [fighter], rulesEdition: '2024' } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].hitPointDice).toEqual([
                { die: 10, current: 6, max: 6 },
            ]);
        });

        it('restores half of total Hit Dice (minimum 1) in 2014 rules edition for even total dice', () => {
            // Level 6 fighter: 6 total dice -> floor(6/2) = 3 regained
            const fighter = createMockPlayerCharacter({
                id: 'fighter-2014',
                level: 6,
                class: { id: 'fighter', name: 'Fighter', hitDie: 10 } as any,
                hitPointDice: [{ die: 10, current: 0, max: 6 }],
            });
            const state = { ...initialState, party: [fighter], rulesEdition: '2014' } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].hitPointDice).toEqual([
                { die: 10, current: 3, max: 6 },
            ]);
        });

        it('restores half of total Hit Dice (rounded down) in 2014 rules edition for odd total dice', () => {
            // Level 5 character: 5 total dice -> floor(5/2) = 2 regained
            const ranger = createMockPlayerCharacter({
                id: 'ranger-2014',
                level: 5,
                class: { id: 'ranger', name: 'Ranger', hitDie: 10 } as any,
                hitPointDice: [{ die: 10, current: 0, max: 5 }],
            });
            const state = { ...initialState, party: [ranger], rulesEdition: '2014' } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].hitPointDice).toEqual([
                { die: 10, current: 2, max: 5 },
            ]);
        });

        it('restores at least 1 Hit Die for a level 1 character in 2014 rules edition', () => {
            // Level 1 character: 1 total die -> max(1, floor(1/2)) = 1 regained
            const wizard = createMockPlayerCharacter({
                id: 'wizard-2014',
                level: 1,
                class: { id: 'wizard', name: 'Wizard', hitDie: 6 } as any,
                classLevels: { wizard: 1 },
                hitPointDice: [{ die: 6, current: 0, max: 1 }],
            });
            const state = { ...initialState, party: [wizard], rulesEdition: '2014' } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].hitPointDice).toEqual([
                { die: 6, current: 1, max: 1 },
            ]);
        });

        it('does not restore more Hit Dice than were actually spent in 2014 rules edition', () => {
            // Level 6 fighter who only spent 1 die (5/6 remaining) -> regains at most 1 to reach 6/6
            const fighter = createMockPlayerCharacter({
                id: 'fighter-2014-slight',
                level: 6,
                class: { id: 'fighter', name: 'Fighter', hitDie: 10 } as any,
                hitPointDice: [{ die: 10, current: 5, max: 6 }],
            });
            const state = { ...initialState, party: [fighter], rulesEdition: '2014' } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].hitPointDice).toEqual([
                { die: 10, current: 6, max: 6 },
            ]);
        });

        it('restores largest Hit Dice first for multiclass characters in 2014 rules edition', () => {
            // Multiclass Fighter 3 / Wizard 3: total 6 dice (3d10 and 3d6).
            // Regains floor(6/2) = 3 dice total.
            // When all dice are spent (0/3 d10, 0/3 d6), the 3 regained dice should go to d10 first.
            const multiclass = createMockPlayerCharacter({
                id: 'multiclass-2014',
                level: 6,
                class: { id: 'fighter', name: 'Fighter', hitDie: 10 } as any,
                classLevels: { fighter: 3, wizard: 3 },
                hitPointDice: [
                    { die: 10, current: 0, max: 3 },
                    { die: 6, current: 0, max: 3 },
                ],
            });
            const state = { ...initialState, party: [multiclass], rulesEdition: '2014' } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].hitPointDice).toEqual([
                { die: 6, current: 0, max: 3 },
                { die: 10, current: 3, max: 3 },
            ]);
        });

        it('leaves denied party members unchanged during LONG_REST', () => {
            const allowed = createMockPlayerCharacter({
                id: 'allowed-char',
                level: 4,
                class: { id: 'fighter', name: 'Fighter', hitDie: 10 } as any,
                hitPointDice: [{ die: 10, current: 0, max: 4 }],
                tempHP: 10,
            });
            const denied = createMockPlayerCharacter({
                id: 'denied-char',
                level: 4,
                class: { id: 'fighter', name: 'Fighter', hitDie: 10 } as any,
                hitPointDice: [{ die: 10, current: 0, max: 4 }],
                tempHP: 10,
            });
            const state = { ...initialState, party: [allowed, denied], rulesEdition: '2024' } as GameState;
            const nextState = characterReducer(state, {
                type: 'LONG_REST',
                payload: { deniedCharacterIds: ['denied-char'] },
            });

            const nextAllowed = nextState.party?.find(c => c.id === 'allowed-char');
            const nextDenied = nextState.party?.find(c => c.id === 'denied-char');

            expect(nextAllowed?.tempHP).toBe(0);
            expect(nextAllowed?.hitPointDice).toEqual([{ die: 10, current: 4, max: 4 }]);

            // Denied member stays exactly as they were
            expect(nextDenied?.tempHP).toBe(10);
            expect(nextDenied?.hitPointDice).toEqual([{ die: 10, current: 0, max: 4 }]);
        });

        it('restores Warlock Pact Magic slots on SHORT_REST for single-class warlock', () => {
            // Level 3 Warlock has two 2nd-level pact magic slots
            const warlock = createMockPlayerCharacter({
                id: 'warlock-char',
                level: 3,
                class: { id: 'warlock', name: 'Warlock', hitDie: 8 } as any,
                classLevels: { warlock: 3 },
                spellSlots: {
                    level_1: { current: 0, max: 0 },
                    level_2: { current: 0, max: 2 },
                    level_3: { current: 0, max: 0 },
                    level_4: { current: 0, max: 0 },
                    level_5: { current: 0, max: 0 },
                    level_6: { current: 0, max: 0 },
                    level_7: { current: 0, max: 0 },
                    level_8: { current: 0, max: 0 },
                    level_9: { current: 0, max: 0 },
                },
            });
            const state = { ...initialState, party: [warlock] } as GameState;
            const nextState = characterReducer(state, { type: 'SHORT_REST', payload: {} });

            expect(nextState.party?.[0].spellSlots?.level_2.current).toBe(2);
        });

        it('does not restore non-warlock spell slots on SHORT_REST', () => {
            // Level 3 Wizard has four 1st-level and two 2nd-level slots
            const wizard = createMockPlayerCharacter({
                id: 'wizard-char',
                level: 3,
                class: { id: 'wizard', name: 'Wizard', hitDie: 6 } as any,
                classLevels: { wizard: 3 },
                spellSlots: {
                    level_1: { current: 1, max: 4 },
                    level_2: { current: 0, max: 2 },
                    level_3: { current: 0, max: 0 },
                    level_4: { current: 0, max: 0 },
                    level_5: { current: 0, max: 0 },
                    level_6: { current: 0, max: 0 },
                    level_7: { current: 0, max: 0 },
                    level_8: { current: 0, max: 0 },
                    level_9: { current: 0, max: 0 },
                },
            });
            const state = { ...initialState, party: [wizard] } as GameState;
            const nextState = characterReducer(state, { type: 'SHORT_REST', payload: {} });

            expect(nextState.party?.[0].spellSlots?.level_1.current).toBe(1);
            expect(nextState.party?.[0].spellSlots?.level_2.current).toBe(0);
        });

        it('restores only Warlock Pact Magic slots for multiclass Warlock/Wizard on SHORT_REST', () => {
            // Multiclass Wizard 3 / Warlock 2 (Warlock level 2 has two 1st-level pact slots)
            // Wizard 3 has four 1st-level slots. In multiclass, 1st level slots has total max 4.
            // If 1st level slots are depleted (0/4), on short rest the 2 pact slots recharge (up to 2/4),
            // while 2nd level wizard slots (0/2) remain at 0/2.
            const multiclass = createMockPlayerCharacter({
                id: 'multi-warlock-wizard',
                level: 5,
                class: { id: 'wizard', name: 'Wizard', hitDie: 6 } as any,
                classLevels: { wizard: 3, warlock: 2 },
                spellSlots: {
                    level_1: { current: 0, max: 4 },
                    level_2: { current: 0, max: 2 },
                    level_3: { current: 0, max: 0 },
                    level_4: { current: 0, max: 0 },
                    level_5: { current: 0, max: 0 },
                    level_6: { current: 0, max: 0 },
                    level_7: { current: 0, max: 0 },
                    level_8: { current: 0, max: 0 },
                    level_9: { current: 0, max: 0 },
                },
            });
            const state = { ...initialState, party: [multiclass] } as GameState;
            const nextState = characterReducer(state, { type: 'SHORT_REST', payload: {} });

            expect(nextState.party?.[0].spellSlots?.level_1.current).toBe(2);
            expect(nextState.party?.[0].spellSlots?.level_2.current).toBe(0);
        });

        it('fully restores all spell slots on LONG_REST for both Warlocks and other casters', () => {
            const warlock = createMockPlayerCharacter({
                id: 'warlock-lr',
                level: 3,
                class: { id: 'warlock', name: 'Warlock', hitDie: 8 } as any,
                classLevels: { warlock: 3 },
                spellSlots: {
                    level_1: { current: 0, max: 0 },
                    level_2: { current: 0, max: 2 },
                    level_3: { current: 0, max: 0 },
                    level_4: { current: 0, max: 0 },
                    level_5: { current: 0, max: 0 },
                    level_6: { current: 0, max: 0 },
                    level_7: { current: 0, max: 0 },
                    level_8: { current: 0, max: 0 },
                    level_9: { current: 0, max: 0 },
                },
            });
            const state = { ...initialState, party: [warlock] } as GameState;
            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            expect(nextState.party?.[0].spellSlots?.level_2.current).toBe(2);
        });
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
            type: ItemType.Consumable,
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
            type: ItemType.Weapon,
            slot: 'MainHand',
        };
        const driedMeat: Item = {
            id: 'dried_meat',
            name: 'Dried Meat',
            description: 'Food with no special effects.',
            type: ItemType.FoodDrink,
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
        expect(equipState.inventory?.some(item => item.id === 'steel_sword')).toBe(false);

        const dropState = characterReducer({
            ...equipState,
            currentLocationId: 'town_square',
            dynamicLocationItemIds: { town_square: [] },
        } as GameState, {
            type: 'DROP_ITEM',
            payload: { itemId: 'dried_meat', characterId: 'equip-drop-char' },
        });

        expect(dropState.inventory?.some(item => item.id === 'dried_meat')).toBe(false);
        expect(dropState.dynamicLocationItemIds?.town_square).toContain('dried_meat');
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
            description: 'A brilliant gem.',
            type: ItemType.SpellComponent,
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
        const item1: Item = { id: 'rusty_nail', name: 'Rusty Nail', description: '', type: 'accessory' as any, isJunk: false };
        const item2: Item = { id: 'silver_chalice', name: 'Silver Chalice', description: '', type: 'accessory' as any, isJunk: false };
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
                items: [{ itemId: 'rusty_nail', value: 5 }]
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
        const ring1: Item = { id: 'ring_1', name: 'Ring of Protection', description: 'Magic Ring', type: ItemType.Accessory, requiresAttunement: true };
        const ring2: Item = { id: 'ring_2', name: 'Ring of Evasion', description: 'Magic Ring', type: ItemType.Accessory, requiresAttunement: true };
        const ring3: Item = { id: 'ring_3', name: 'Ring of Regeneration', description: 'Magic Ring', type: ItemType.Accessory, requiresAttunement: true };
        const ring4: Item = { id: 'ring_4', name: 'Ring of Power', description: 'Magic Ring', type: ItemType.Accessory, requiresAttunement: true };

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
            description: '',
            type: ItemType.Armor,
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
    describe('LONG_REST 0 HP revival and 16-hour cooldown guard (GG-449 / agora-c665)', () => {
        it('keeps characters at 0 HP at 0 HP with no resource recovery on LONG_REST', () => {
            const downedChar = createMockPlayerCharacter({
                id: 'downed-hero',
                name: 'Downed Hero',
                level: 2,
                class: { id: 'cleric', name: 'Cleric', hitDie: 8 } as any,
                hp: 0,
                maxHp: 20,
                hitPointDice: [{ die: 8, current: 0, max: 2 }],
                spellSlots: {
                    level_1: { current: 0, max: 2 },
                } as any,
            });
            const healthyChar = createMockPlayerCharacter({
                id: 'healthy-hero',
                name: 'Healthy Hero',
                level: 2,
                class: { id: 'cleric', name: 'Cleric', hitDie: 8 } as any,
                hp: 5,
                maxHp: 20,
                hitPointDice: [{ die: 8, current: 0, max: 2 }],
                spellSlots: {
                    level_1: { current: 0, max: 2 },
                } as any,
            });

            const state = {
                ...initialState,
                party: [downedChar, healthyChar],
                rulesEdition: '2024',
            } as GameState;

            const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} });

            const updatedDowned = nextState.party?.find(p => p.id === 'downed-hero');
            const updatedHealthy = nextState.party?.find(p => p.id === 'healthy-hero');

            // Downed character must stay at 0 HP and regain no slots or hit dice
            expect(updatedDowned?.hp).toBe(0);
            expect(updatedDowned?.hitPointDice?.[0].current).toBe(0);
            expect(updatedDowned?.spellSlots?.level_1.current).toBe(0);

            // Healthy character recovers fully
            expect(updatedHealthy?.hp).toBe(20);
            expect(updatedHealthy?.hitPointDice?.[0].current).toBe(2);
            expect(updatedHealthy?.spellSlots?.level_1.current).toBe(2);
        });

        it('refuses a second LONG_REST within 16 game hours', () => {
            const injuredChar = createMockPlayerCharacter({
                id: 'injured-hero',
                name: 'Injured Hero',
                hp: 5,
                maxHp: 20,
            });
            const t0 = new Date('2026-06-01T08:00:00Z');
            const state = {
                ...initialState,
                gameTime: t0,
                party: [injuredChar],
                rulesEdition: '2024',
            } as GameState;

            // The first rest starts at T0 and records completion eight hours later.
            const firstRestEnd = new Date(t0.getTime() + 8 * 3600 * 1000);
            const afterFirstRest = characterReducer(state, { type: 'LONG_REST', payload: {} });
            expect(afterFirstRest.party?.[0].hp).toBe(20);
            expect(afterFirstRest.lastLongRestAt).toBe(firstRestEnd.toISOString());

            // Injure character again
            const injuredAgain = {
                ...afterFirstRest,
                party: [{ ...afterFirstRest.party![0], hp: 3 }],
                // Eight hours after completion is still within the cooldown.
                gameTime: new Date(firstRestEnd.getTime() + 8 * 3600 * 1000),
            } as GameState;

            // Attempt second rest within 8 hours -> refused (returns unchanged state, hp stays 3)
            const refusedRest = characterReducer(injuredAgain, { type: 'LONG_REST', payload: {} });
            expect(refusedRest.party?.[0].hp).toBe(3);

            // Sixteen hours after completion permits another rest to begin.
            const readyForRest = {
                ...injuredAgain,
                gameTime: new Date(firstRestEnd.getTime() + 16 * 3600 * 1000),
            } as GameState;

            // Attempt rest after 16 hours -> succeeds (hp restored to 20)
            const allowedRest = characterReducer(readyForRest, { type: 'LONG_REST', payload: {} });
            expect(allowedRest.party?.[0].hp).toBe(20);
            expect(allowedRest.lastLongRestAt).toBe(new Date(readyForRest.gameTime.getTime() + 8 * 3600 * 1000).toISOString());
        });
    });

    describe('GG-502: Two-handed weapon and shield mutual exclusivity', () => {
        const greatsword: Item = {
            id: 'greatsword_test',
            name: 'Greatsword',
            description: 'A large, two-handed sword.',
            type: ItemType.Weapon,
            slot: 'MainHand',
            damageDice: '2d6',
            properties: ['Heavy', 'Two-Handed'],
        };

        const longsword: Item = {
            id: 'longsword_test',
            name: 'Longsword',
            description: 'A versatile blade.',
            type: ItemType.Weapon,
            slot: 'MainHand',
            damageDice: '1d8',
            properties: ['Versatile'],
        };

        const dagger: Item = {
            id: 'dagger_test',
            name: 'Dagger',
            description: 'A light dagger.',
            type: ItemType.Weapon,
            slot: 'MainHand',
            damageDice: '1d4',
            properties: ['Light'],
        };

        const shield: Item = {
            id: 'shield_test',
            name: 'Shield',
            description: 'A wooden shield.',
            type: ItemType.Armor,
            slot: 'OffHand',
            armorCategory: 'Shield',
            baseArmorClass: 2,
        };

        it('equipping a greatsword unequips the shield and moves it back to inventory', () => {
            const char = createMockPlayerCharacter({
                id: 'fighter-1',
                equippedItems: {
                    MainHand: longsword,
                    OffHand: shield,
                },
            });

            const state = {
                ...initialState,
                party: [char],
                inventory: [greatsword],
                characterSheetModal: { isOpen: false, character: null },
            } as GameState;

            const nextState = characterReducer(state, {
                type: 'EQUIP_ITEM',
                payload: { itemId: 'greatsword_test', characterId: 'fighter-1' },
            });

            const updatedChar = nextState.party?.[0];
            // MainHand has greatsword
            expect(updatedChar?.equippedItems.MainHand?.id).toBe('greatsword_test');
            // OffHand shield was unequipped
            expect(updatedChar?.equippedItems.OffHand).toBeUndefined();
            // Both the old longsword and the unequipped shield are now in inventory
            expect(nextState.inventory?.some(i => i.id === 'longsword_test')).toBe(true);
            expect(nextState.inventory?.some(i => i.id === 'shield_test')).toBe(true);
            expect(nextState.inventory?.some(i => i.id === 'greatsword_test')).toBe(false);
        });

        it('equipping a shield while wielding a greatsword is refused', () => {
            const char = createMockPlayerCharacter({
                id: 'fighter-1',
                equippedItems: {
                    MainHand: greatsword,
                },
            });

            const state = {
                ...initialState,
                party: [char],
                inventory: [shield],
                characterSheetModal: { isOpen: false, character: null },
            } as GameState;

            const nextState = characterReducer(state, {
                type: 'EQUIP_ITEM',
                payload: { itemId: 'shield_test', characterId: 'fighter-1' },
            });

            // State returned is empty object (reducer refused action)
            expect(nextState.party).toBeUndefined();
        });

        it('equipping a one-handed weapon while wielding a greatsword replaces the greatsword in MainHand', () => {
            const char = createMockPlayerCharacter({
                id: 'fighter-1',
                equippedItems: {
                    MainHand: greatsword,
                },
            });

            const state = {
                ...initialState,
                party: [char],
                inventory: [dagger],
                characterSheetModal: { isOpen: false, character: null },
            } as GameState;

            const nextState = characterReducer(state, {
                type: 'EQUIP_ITEM',
                payload: { itemId: 'dagger_test', characterId: 'fighter-1' },
            });

            const updatedChar = nextState.party?.[0];
            expect(updatedChar?.equippedItems.MainHand?.id).toBe('dagger_test');
            expect(updatedChar?.equippedItems.OffHand).toBeUndefined();
            expect(nextState.inventory?.some(i => i.id === 'greatsword_test')).toBe(true);
        });

        it('canEquipItem reports failure when attempting to equip a shield while wielding a two-handed weapon', () => {
            const char = createMockPlayerCharacter({
                id: 'fighter-1',
                equippedItems: {
                    MainHand: greatsword,
                },
            });

            const check = canEquipItem(char, shield);
            expect(check.can).toBe(false);
            expect(check.reason).toContain('wielding a two-handed weapon');
        });

        it('AUTO_EQUIP with a two-handed weapon does not equip a shield in OffHand', () => {
            const char = createMockPlayerCharacter({
                id: 'fighter-1',
                class: {
                    id: 'fighter',
                    name: 'Fighter',
                    armorProficiencies: ['shields', 'heavy', 'medium', 'light'],
                    weaponProficiencies: ['simple', 'martial'],
                } as unknown as Class,
                equippedItems: {},
            });

            const state = {
                ...initialState,
                party: [char],
                inventory: [greatsword, shield],
                characterSheetModal: { isOpen: false, character: null },
            } as GameState;

            const nextState = characterReducer(state, {
                type: 'AUTO_EQUIP',
                payload: { characterId: 'fighter-1' },
            });

            const updatedChar = nextState.party?.[0];
            expect(updatedChar?.equippedItems.MainHand?.id).toBe('greatsword_test');
            expect(updatedChar?.equippedItems.OffHand).toBeUndefined();
            expect(nextState.inventory?.some(i => i.id === 'shield_test')).toBe(true);
        });
    });

    describe('GG-501: Attunement scoping and limit enforcement across party/inventory', () => {
        const cloakOfProtection: Item = {
            id: 'cloak_of_protection_1',
            name: 'Cloak of Protection',
            description: 'A magical cloak.',
            type: ItemType.Accessory,
            slot: 'Cloak',
            armorClassBonus: 1,
            requiresAttunement: true,
        };

        const ring1: Item = {
            id: 'attuned_ring_1',
            name: 'Ring of Warmth',
            description: 'A magical ring.',
            type: ItemType.Accessory,
            slot: 'Ring1',
            requiresAttunement: true,
        };

        const ring2: Item = {
            id: 'attuned_ring_2',
            name: 'Ring of Swimming',
            description: 'A magical ring.',
            type: ItemType.Accessory,
            slot: 'Ring2',
            requiresAttunement: true,
        };

        const extraRing: Item = {
            id: 'attuned_ring_3',
            name: 'Ring of Jumping',
            description: 'A magical ring.',
            type: ItemType.Accessory,
            slot: 'Ring1',
            requiresAttunement: true,
        };

        it('denies AC bonus to character B wearing cloak attuned to character A, and enforces 3-item limit across party', () => {
            const charA = createMockPlayerCharacter({
                id: 'char-a',
                name: 'Hero A',
                abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
                finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
                armorClass: 10,
                equippedItems: {},
            });

            const charB = createMockPlayerCharacter({
                id: 'char-b',
                name: 'Hero B',
                abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
                finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
                armorClass: 10,
                equippedItems: {},
            });

            // 1. Initial state: charA attunes cloakOfProtection in inventory
            let state: GameState = {
                party: [charA, charB],
                inventory: [cloakOfProtection, ring1, ring2, extraRing],
                characterSheetModal: { isOpen: false, character: null },
            } as unknown as GameState;

            // Character A attunes cloak
            state = { ...state, ...characterReducer(state, {
                type: 'ATTUNE_ITEM',
                payload: { characterId: 'char-a', itemId: 'cloak_of_protection_1' },
            }) } as GameState;

            expect(state.inventory.find(i => i.id === 'cloak_of_protection_1')?.isAttuned).toBe(true);
            expect(state.inventory.find(i => i.id === 'cloak_of_protection_1')?.attunedCharacterId).toBe('char-a');

            // 2. Character B equips the cloak attuned to Character A
            state = { ...state, ...characterReducer(state, {
                type: 'EQUIP_ITEM',
                payload: { characterId: 'char-b', itemId: 'cloak_of_protection_1' },
            }) } as GameState;

            const updatedB = state.party.find(p => p.id === 'char-b')!;
            expect(updatedB.equippedItems.Cloak?.id).toBe('cloak_of_protection_1');
            expect(updatedB.equippedItems.Cloak?.attunedCharacterId).toBe('char-a');
            // GG-501 acceptance: Character B gets NO AC bonus from A's attuned cloak (AC stays 10, not 11)
            expect(updatedB.armorClass).toBe(10);

            // 3. Character A attunes 2 more rings (now holds 3 attuned items: cloak on B, ring1, ring2)
            state = { ...state, ...characterReducer(state, {
                type: 'ATTUNE_ITEM',
                payload: { characterId: 'char-a', itemId: 'attuned_ring_1' },
            }) } as GameState;
            state = { ...state, ...characterReducer(state, {
                type: 'ATTUNE_ITEM',
                payload: { characterId: 'char-a', itemId: 'attuned_ring_2' },
            }) } as GameState;

            // Character A attempts to attune a 4th item (extraRing) -> must be refused!
            const overLimitState = characterReducer(state, {
                type: 'ATTUNE_ITEM',
                payload: { characterId: 'char-a', itemId: 'attuned_ring_3' },
            });
            // Refused: returns {}
            expect(overLimitState.party).toBeUndefined();

            // 4. Character B re-attunes the cloak (transferring attunement to B)
            state = { ...state, ...characterReducer(state, {
                type: 'ATTUNE_ITEM',
                payload: { characterId: 'char-b', itemId: 'cloak_of_protection_1' },
            }) } as GameState;

            const reattunedB = state.party.find(p => p.id === 'char-b')!;
            expect(reattunedB.equippedItems.Cloak?.attunedCharacterId).toBe('char-b');
            // Character B is now attuned to the cloak -> gains +1 AC (AC 11)
            expect(reattunedB.armorClass).toBe(11);

            // 5. Character A now has only 2 attuned items, so Character A can now attune extraRing!
            const allowedAState = characterReducer(state, {
                type: 'ATTUNE_ITEM',
                payload: { characterId: 'char-a', itemId: 'attuned_ring_3' },
            });
            expect(allowedAState.party).toBeDefined();
            expect(allowedAState.inventory?.find(i => i.id === 'attuned_ring_3')?.isAttuned).toBe(true);
            expect(allowedAState.inventory?.find(i => i.id === 'attuned_ring_3')?.attunedCharacterId).toBe('char-a');
        });
    });

});

describe('currency is not junk or fenced merchandise', () => {
  it('retains a legacy junk coin and sells unrelated junk normally', () => {
    const coin={id:'gold_piece',quantity:8,isJunk:true,sourceId:'cache9'} as Item;
    const junk={id:'broken_cup',isJunk:true} as Item;
    const state={gold:0.77,inventory:[coin,junk]} as GameState;
    const after=characterReducer(state,{type:'SELL_ALL_JUNK',payload:{items:[{itemId:coin.id,value:0.1},{itemId:junk.id,value:0.2}]}});
    expect(after.gold).toBe(0.97);
    expect(after.inventory).toEqual([coin]);
    expect(after.inventory![0]).toBe(coin);
  });
  it('rejects a stale currency fence request without changing its source or money', () => {
    const state={gold:0.77,inventory:[{id:'electrum_piece',quantity:8,sourceId:'cache9'}]} as GameState;
    expect(characterReducer(state,{type:'SELL_FENCED_ITEM',payload:{itemId:'electrum_piece',value:0.1,locationId:'town',heatGenerated:1}})).toEqual({});
  });
});
