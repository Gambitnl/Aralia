// TODO(lint-intent): 'vi' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi as _vi } from 'vitest';
import { characterReducer } from '../characterReducer';
// TODO(lint-intent): 'PlayerCharacter' is unused in this test; use it in the assertion path or remove it.
import { GameState, PlayerCharacter as _PlayerCharacter, AbilityScoreName, Class } from '../../../types';
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
});
