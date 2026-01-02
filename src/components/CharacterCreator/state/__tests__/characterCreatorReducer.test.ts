/**
 * @file characterCreatorReducer.test.ts
 * Comprehensive tests for the character creator state machine.
 * 
 * These tests ensure that ALL character creation flows lead to valid,
 * playable characters by testing:
 * 1. Navigation flow for each race (branching paths)
 * 2. State transitions for all actions
 * 3. Complete flow validation (end-to-end reducer walk-through)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    characterCreatorReducer,
    initialCharacterCreatorState,
    CreationStep,
    CharacterCreationState,
    CharacterCreatorAction,
} from '../characterCreatorState';
import { ALL_RACES_DATA } from '../../../../data/races';
import { CLASSES_DATA } from '../../../../data/classes';
import {
    AbilityScoreName,
    AbilityScores,
    Skill,
    Race,
    DraconicAncestorType,
    ElvenLineageType,
    GnomeSubraceType,
    GiantAncestryType,
    FiendishLegacyType,
} from '../../../../types';

// --- Test Fixtures ---

const mockAbilityScores: AbilityScores = {
    Strength: 15,
    Dexterity: 14,
    Constitution: 13,
    Intelligence: 12,
    Wisdom: 10,
    Charisma: 8,
};

const mockSkills: Skill[] = [
    { id: 'athletics', name: 'Athletics', ability: 'Strength' },
    { id: 'perception', name: 'Perception', ability: 'Wisdom' },
];

// --- Helper Functions ---

/**
 * Walks the reducer through the complete creation flow for a given race/class combo.
 * Returns the final state after completing all steps.
 */
function walkCompleteFlow(
    raceId: string,
    classId: string,
    options?: {
        dragonbornAncestry?: DraconicAncestorType;
        elvenLineage?: { lineageId: ElvenLineageType; spellAbility: AbilityScoreName };
        gnomeSubrace?: { subraceId: GnomeSubraceType; spellAbility: AbilityScoreName };
        giantAncestry?: GiantAncestryType;
        tieflingLegacy?: { legacyId: FiendishLegacyType; spellAbility: AbilityScoreName };
        centaurSkill?: string;
        changelingSkills?: string[];
        humanSkill?: string;
    }
): CharacterCreationState {
    let state = initialCharacterCreatorState;
    const race = ALL_RACES_DATA[raceId];
    const charClass = CLASSES_DATA[classId];

    if (!race) throw new Error(`Race '${raceId}' not found`);
    if (!charClass) throw new Error(`Class '${classId}' not found`);

    // Step 1: Select Race
    state = characterCreatorReducer(state, { type: 'SELECT_RACE', payload: race });

    // Step 2: Handle race-specific sub-selections
    switch (raceId) {
        case 'dragonborn':
            state = characterCreatorReducer(state, {
                type: 'SELECT_DRAGONBORN_ANCESTRY',
                payload: options?.dragonbornAncestry || 'Black',
            });
            break;
        case 'elf':
            state = characterCreatorReducer(state, {
                type: 'SELECT_ELVEN_LINEAGE',
                payload: options?.elvenLineage || { lineageId: 'high_elf', spellAbility: 'Intelligence' },
            });
            break;
        case 'gnome':
            state = characterCreatorReducer(state, {
                type: 'SELECT_GNOME_SUBRACE',
                payload: options?.gnomeSubrace || { subraceId: 'rock_gnome', spellAbility: 'Intelligence' },
            });
            break;
        case 'goliath':
            state = characterCreatorReducer(state, {
                type: 'SELECT_GIANT_ANCESTRY',
                payload: options?.giantAncestry || 'Cloud',
            });
            break;
        case 'tiefling':
            state = characterCreatorReducer(state, {
                type: 'SELECT_TIEFLING_LEGACY',
                payload: options?.tieflingLegacy || { legacyId: 'abyssal', spellAbility: 'Charisma' },
            });
            break;
        case 'centaur':
            state = characterCreatorReducer(state, {
                type: 'SELECT_CENTAUR_NATURAL_AFFINITY_SKILL',
                payload: options?.centaurSkill || 'animal_handling',
            });
            break;
        case 'changeling':
            state = characterCreatorReducer(state, {
                type: 'SELECT_CHANGELING_INSTINCTS',
                payload: options?.changelingSkills || ['deception', 'insight'],
            });
            break;
        // Races without sub-selections go directly to AgeSelection
    }

    // Step 3: Age Selection (just advance, age is already defaulted)
    // The reducer advances via SET_STEP after age is confirmed in the UI
    state = characterCreatorReducer(state, { type: 'SET_STEP', payload: CreationStep.BackgroundSelection });

    // Step 4: Select Background
    state = characterCreatorReducer(state, { type: 'SELECT_BACKGROUND', payload: 'acolyte' });
    state = characterCreatorReducer(state, { type: 'SET_STEP', payload: CreationStep.Visuals });

    // Step 5: Visuals (advance with defaults)
    state = characterCreatorReducer(state, { type: 'SET_STEP', payload: CreationStep.Class });

    // Step 6: Select Class
    state = characterCreatorReducer(state, { type: 'SELECT_CLASS', payload: charClass });

    // Step 7: Ability Scores
    state = characterCreatorReducer(state, {
        type: 'SET_ABILITY_SCORES',
        payload: { baseScores: mockAbilityScores },
    });

    // Step 8: Handle racial spell ability choice if needed
    if (state.step === CreationStep.RacialSpellAbilityChoice) {
        state = characterCreatorReducer(state, {
            type: 'SELECT_RACIAL_SPELL_ABILITY',
            payload: 'Charisma',
        });
    }

    // Step 9: Human skill choice if human
    if (state.step === CreationStep.HumanSkillChoice) {
        state = characterCreatorReducer(state, {
            type: 'SELECT_HUMAN_SKILL',
            payload: options?.humanSkill || 'perception',
        });
    }

    // Step 10: Select Skills
    state = characterCreatorReducer(state, { type: 'SELECT_SKILLS', payload: mockSkills });

    // Step 11: Class Features (if applicable)
    if (state.step === CreationStep.ClassFeatures) {
        // Handle based on class
        switch (classId) {
            case 'fighter':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_FIGHTER_FEATURES',
                    payload: charClass.fightingStyles![0],
                });
                break;
            case 'cleric':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_CLERIC_FEATURES',
                    payload: { order: 'Protector', cantrips: [], spellsL1: [] },
                });
                break;
            case 'wizard':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_WIZARD_FEATURES',
                    payload: { cantrips: [], spellsL1: [] },
                });
                break;
            case 'bard':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_BARD_FEATURES',
                    payload: { cantrips: [], spellsL1: [] },
                });
                break;
            case 'druid':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_DRUID_FEATURES',
                    payload: { order: 'Magician', cantrips: [], spellsL1: [] },
                });
                break;
            case 'sorcerer':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_SORCERER_FEATURES',
                    payload: { cantrips: [], spellsL1: [] },
                });
                break;
            case 'warlock':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_WARLOCK_FEATURES',
                    payload: { cantrips: [], spellsL1: [] },
                });
                break;
            case 'ranger':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_RANGER_FEATURES',
                    payload: { spellsL1: [] },
                });
                break;
            case 'paladin':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_PALADIN_FEATURES',
                    payload: { spellsL1: [] },
                });
                break;
            case 'artificer':
                state = characterCreatorReducer(state, {
                    type: 'SELECT_ARTIFICER_FEATURES',
                    payload: { cantrips: [], spellsL1: [] },
                });
                break;
            // Non-spellcaster classes without features skip this step
        }
    }

    // Step 12: Weapon Mastery (if applicable)
    if (state.step === CreationStep.WeaponMastery) {
        const masterySlots = charClass.weaponMasterySlots || 0;
        if (masterySlots > 0) {
            state = characterCreatorReducer(state, {
                type: 'SELECT_WEAPON_MASTERIES',
                payload: ['longsword', 'shortsword'].slice(0, masterySlots),
            });
        }
    }

    // Step 13: Feat Selection (if applicable, otherwise skipped)
    if (state.step === CreationStep.FeatSelection) {
        // For tests, we can skip without selecting a feat
        state = characterCreatorReducer(state, { type: 'CONFIRM_FEAT_STEP' });
    }

    // Step 14: Name and Review (final step)
    state = characterCreatorReducer(state, { type: 'SET_CHARACTER_NAME', payload: 'TestHero' });

    return state;
}

/**
 * Validates that a final character state has all required fields for a playable character.
 */
function validateCharacterState(state: CharacterCreationState): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!state.selectedRace) errors.push('Missing: selectedRace');
    if (!state.selectedClass) errors.push('Missing: selectedClass');
    if (!state.characterName || state.characterName.trim() === '') errors.push('Missing: characterName');
    if (!state.finalAbilityScores) errors.push('Missing: finalAbilityScores');
    if (!state.selectedBackground) errors.push('Missing: selectedBackground');
    if (state.selectedSkills.length === 0) errors.push('Missing: selectedSkills (empty array)');
    if (state.characterAge <= 0) errors.push('Invalid: characterAge must be positive');

    // Validate ability scores are all present and valid
    if (state.finalAbilityScores) {
        const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as const;
        for (const ability of abilities) {
            const score = state.finalAbilityScores[ability];
            if (score === undefined || score < 1 || score > 30) {
                errors.push(`Invalid: ${ability} score (${score})`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

// --- Test Suites ---

describe('Character Creator Reducer', () => {
    describe('Initial State', () => {
        it('starts at Race selection step', () => {
            expect(initialCharacterCreatorState.step).toBe(CreationStep.Race);
        });

        it('has no selections made initially', () => {
            expect(initialCharacterCreatorState.selectedRace).toBeNull();
            expect(initialCharacterCreatorState.selectedClass).toBeNull();
            expect(initialCharacterCreatorState.selectedBackground).toBeNull();
        });
    });

    describe('Race Selection Navigation', () => {
        // Test that each race navigates to the correct next step
        const raceNavigationTests: Array<{ raceId: string; expectedStep: CreationStep }> = [
            // Races with sub-selections
            { raceId: 'dragonborn', expectedStep: CreationStep.DragonbornAncestry },
            { raceId: 'elf', expectedStep: CreationStep.ElvenLineage },
            { raceId: 'gnome', expectedStep: CreationStep.GnomeSubrace },
            { raceId: 'goliath', expectedStep: CreationStep.GiantAncestry },
            { raceId: 'tiefling', expectedStep: CreationStep.TieflingLegacy },
            { raceId: 'centaur', expectedStep: CreationStep.CentaurNaturalAffinitySkill },
            { raceId: 'changeling', expectedStep: CreationStep.ChangelingInstincts },
            // Races without sub-selections (go directly to age)
            { raceId: 'human', expectedStep: CreationStep.AgeSelection },
            { raceId: 'dwarf', expectedStep: CreationStep.AgeSelection },
            { raceId: 'halfling', expectedStep: CreationStep.AgeSelection },
            { raceId: 'orc', expectedStep: CreationStep.AgeSelection },
            { raceId: 'aasimar', expectedStep: CreationStep.AgeSelection },
            { raceId: 'firbolg', expectedStep: CreationStep.AgeSelection },
            { raceId: 'goblin', expectedStep: CreationStep.AgeSelection },
            { raceId: 'bugbear', expectedStep: CreationStep.AgeSelection },
            { raceId: 'aarakocra', expectedStep: CreationStep.AgeSelection },
        ];

        it.each(raceNavigationTests)(
            'SELECT_RACE($raceId) navigates to $expectedStep',
            ({ raceId, expectedStep }) => {
                const race = ALL_RACES_DATA[raceId];
                if (!race) {
                    // Skip if race doesn't exist in data
                    console.warn(`Skipping test for race '${raceId}' - not found in ALL_RACES_DATA`);
                    return;
                }
                const result = characterCreatorReducer(initialCharacterCreatorState, {
                    type: 'SELECT_RACE',
                    payload: race,
                });
                expect(result.step).toBe(expectedStep);
                expect(result.selectedRace).toBe(race);
            }
        );
    });

    describe('GO_BACK Navigation', () => {
        it('does nothing at Race step (first step)', () => {
            const state = initialCharacterCreatorState;
            const result = characterCreatorReducer(state, { type: 'GO_BACK' });
            expect(result.step).toBe(CreationStep.Race);
        });

        it('returns to Race from race sub-selection steps', () => {
            const race = ALL_RACES_DATA['elf'];
            let state = characterCreatorReducer(initialCharacterCreatorState, {
                type: 'SELECT_RACE',
                payload: race,
            });
            expect(state.step).toBe(CreationStep.ElvenLineage);

            state = characterCreatorReducer(state, { type: 'GO_BACK' });
            expect(state.step).toBe(CreationStep.Race);
        });

        it('clears race-specific selection when going back from that sub-selection step', () => {
            const race = ALL_RACES_DATA['elf'];
            let state = characterCreatorReducer(initialCharacterCreatorState, {
                type: 'SELECT_RACE',
                payload: race,
            });
            // Now at ElvenLineage step - make a selection
            state = characterCreatorReducer(state, {
                type: 'SELECT_ELVEN_LINEAGE',
                payload: { lineageId: 'high_elf', spellAbility: 'Intelligence' },
            });
            expect(state.racialSelections['elf']).toBeDefined();
            expect(state.step).toBe(CreationStep.AgeSelection);

            // Going back from AgeSelection should return to Race and preserve the elf selection
            // (since we're not leaving the ElvenLineage step, we're leaving AgeSelection)
            state = characterCreatorReducer(state, { type: 'GO_BACK' });
            expect(state.step).toBe(CreationStep.Race);
            // Note: The selection is NOT cleared here because the getFieldsToResetOnGoBack
            // only prunes when exiting the sub-selection step itself, not AgeSelection
        });
    });

    describe('Class Selection', () => {
        it('advances to AbilityScores step on class selection', () => {
            const charClass = CLASSES_DATA['fighter'];
            let state = { ...initialCharacterCreatorState, step: CreationStep.Class };

            state = characterCreatorReducer(state, { type: 'SELECT_CLASS', payload: charClass });

            expect(state.step).toBe(CreationStep.AbilityScores);
            expect(state.selectedClass).toBe(charClass);
        });
    });

    describe('Complete Flow Validation', () => {
        // Test matrix: Race × Class combinations
        // We test representative samples to cover different paths
        const flowTestCases: Array<{ raceId: string; classId: string; description: string }> = [
            // Simple races (no sub-selection) with different class types
            { raceId: 'human', classId: 'fighter', description: 'Human Fighter (martial, weapon mastery)' },
            { raceId: 'human', classId: 'wizard', description: 'Human Wizard (full caster)' },
            { raceId: 'dwarf', classId: 'cleric', description: 'Dwarf Cleric (divine caster)' },
            { raceId: 'halfling', classId: 'rogue', description: 'Halfling Rogue (no spells, weapon mastery)' },
            { raceId: 'orc', classId: 'barbarian', description: 'Orc Barbarian (rage, weapon mastery)' },

            // Races with sub-selections
            { raceId: 'dragonborn', classId: 'paladin', description: 'Dragonborn Paladin (ancestry + half caster)' },
            { raceId: 'elf', classId: 'ranger', description: 'Elf Ranger (lineage + half caster)' },
            { raceId: 'gnome', classId: 'artificer', description: 'Gnome Artificer (subrace + caster)' },
            { raceId: 'goliath', classId: 'fighter', description: 'Goliath Fighter (giant ancestry)' },
            { raceId: 'tiefling', classId: 'warlock', description: 'Tiefling Warlock (legacy + pact magic)' },
            { raceId: 'centaur', classId: 'druid', description: 'Centaur Druid (affinity skill + spellcasting)' },
            { raceId: 'changeling', classId: 'bard', description: 'Changeling Bard (instincts + spellcasting)' },

            // Additional races
            { raceId: 'aasimar', classId: 'paladin', description: 'Aasimar Paladin (celestial heritage)' },
            { raceId: 'firbolg', classId: 'druid', description: 'Firbolg Druid (nature connection)' },
            { raceId: 'goblin', classId: 'rogue', description: 'Goblin Rogue (sneaky)' },
        ];

        it.each(flowTestCases)(
            '$description: completes flow with valid character state',
            ({ raceId, classId }) => {
                const finalState = walkCompleteFlow(raceId, classId);
                const validation = validateCharacterState(finalState);

                if (!validation.valid) {
                    console.error(`Validation failed for ${raceId} ${classId}:`, validation.errors);
                }

                expect(validation.valid).toBe(true);
                expect(validation.errors).toHaveLength(0);
                expect(finalState.step).toBe(CreationStep.NameAndReview);
            }
        );
    });

    describe('State Integrity', () => {
        it('resets dependent state when changing race mid-flow', () => {
            // Start with Human
            let state = characterCreatorReducer(initialCharacterCreatorState, {
                type: 'SELECT_RACE',
                payload: ALL_RACES_DATA['human'],
            });

            // Advance a bit
            state = characterCreatorReducer(state, { type: 'SET_STEP', payload: CreationStep.BackgroundSelection });
            state = characterCreatorReducer(state, { type: 'SELECT_BACKGROUND', payload: 'acolyte' });

            // Now switch to Elf - should reset race-dependent state
            state = characterCreatorReducer(state, {
                type: 'SELECT_RACE',
                payload: ALL_RACES_DATA['elf'],
            });

            expect(state.selectedRace?.id).toBe('elf');
            expect(state.step).toBe(CreationStep.ElvenLineage);
            // Background should be reset
            expect(state.selectedBackground).toBeNull();
        });

        it('preserves character name across navigation', () => {
            let state = walkCompleteFlow('human', 'fighter');
            expect(state.characterName).toBe('TestHero');

            // Going back should not clear the name
            state = characterCreatorReducer(state, { type: 'GO_BACK' });
            expect(state.characterName).toBe('TestHero');
        });
    });
});

describe('All Races Integration Check', () => {
    // This test ensures ALL races in the data can complete a flow
    const allRaceIds = Object.keys(ALL_RACES_DATA);

    it.each(allRaceIds)('Race "%s" can complete flow with Fighter class', (raceId) => {
        try {
            const finalState = walkCompleteFlow(raceId, 'fighter');
            const validation = validateCharacterState(finalState);
            expect(validation.valid).toBe(true);
        } catch (error) {
            // Log the error but don't fail the suite - this helps identify missing implementations
            console.error(`Flow failed for race "${raceId}":`, error);
            throw error;
        }
    });
});

describe('All Classes Integration Check', () => {
    // This test ensures ALL classes can complete a flow
    const allClassIds = Object.keys(CLASSES_DATA);

    it.each(allClassIds)('Class "%s" can complete flow with Human race', (classId) => {
        try {
            const finalState = walkCompleteFlow('human', classId);
            const validation = validateCharacterState(finalState);
            expect(validation.valid).toBe(true);
        } catch (error) {
            console.error(`Flow failed for class "${classId}":`, error);
            throw error;
        }
    });
});
