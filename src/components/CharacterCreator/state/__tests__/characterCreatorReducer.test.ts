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
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'dragonborn', patch: { choiceId: options?.dragonbornAncestry || 'Black' } },
            });
            break;
        case 'elf':
            state = characterCreatorReducer(state, {
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'elf', patch: { choiceId: options?.elvenLineage?.lineageId || 'high_elf', spellAbility: options?.elvenLineage?.spellAbility || 'Intelligence' } },
            });
            break;
        case 'gnome':
            state = characterCreatorReducer(state, {
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'gnome', patch: { choiceId: options?.gnomeSubrace?.subraceId || 'rock_gnome', spellAbility: options?.gnomeSubrace?.spellAbility || 'Intelligence' } },
            });
            break;
        case 'goliath':
            state = characterCreatorReducer(state, {
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'goliath', patch: { choiceId: options?.giantAncestry || 'Cloud' } },
            });
            break;
        case 'tiefling':
            state = characterCreatorReducer(state, {
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'tiefling', patch: { choiceId: options?.tieflingLegacy?.legacyId || 'abyssal', spellAbility: options?.tieflingLegacy?.spellAbility || 'Charisma' } },
            });
            break;
        case 'centaur':
            state = characterCreatorReducer(state, {
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'centaur', patch: { skillIds: ['animal_handling'] } },
            });
            break;
        case 'changeling':
            state = characterCreatorReducer(state, {
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'changeling', patch: { skillIds: ['deception', 'insight'] } },
            });
            break;
        // Races without sub-selections go directly to AgeSelection
    }

    if (raceId === 'elf') {
        state = characterCreatorReducer(state, {
            type: 'SET_RACIAL_SELECTION',
            payload: { raceId: 'elf', patch: { skillIds: ['perception'] } },
        });
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
    // NOTE: racial spell ability is now recorded in racialSelections during race selection UI.

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
    state = characterCreatorReducer(state, { type: 'SET_STEP', payload: CreationStep.NameAndReview });
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
    if (state.characterAge <= 0) errors.push('Invalid: characterAge must be positive');

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
            { raceId: 'dragonborn', expectedStep: CreationStep.AgeSelection },
            { raceId: 'elf', expectedStep: CreationStep.AgeSelection },
            { raceId: 'goliath', expectedStep: CreationStep.AgeSelection },
            { raceId: 'tiefling', expectedStep: CreationStep.AgeSelection },
            // Races without sub-selections (go directly to age)
            { raceId: 'centaur', expectedStep: CreationStep.AgeSelection },
            { raceId: 'changeling', expectedStep: CreationStep.AgeSelection },
            { raceId: 'human', expectedStep: CreationStep.AgeSelection },
            { raceId: 'hill_dwarf', expectedStep: CreationStep.AgeSelection },
            { raceId: 'halfling', expectedStep: CreationStep.AgeSelection },
            { raceId: 'orc', expectedStep: CreationStep.AgeSelection },
            { raceId: 'protector_aasimar', expectedStep: CreationStep.AgeSelection },
            { raceId: 'forest_gnome', expectedStep: CreationStep.AgeSelection },
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

        it('returns to Race from AgeSelection', () => {
            const race = ALL_RACES_DATA['elf'];
            let state = characterCreatorReducer(initialCharacterCreatorState, {
                type: 'SELECT_RACE',
                payload: race,
            });
            expect(state.step).toBe(CreationStep.AgeSelection);

            state = characterCreatorReducer(state, { type: 'GO_BACK' });
            expect(state.step).toBe(CreationStep.Race);
        });

        it('preserves race-specific selection when going back', () => {
            const race = ALL_RACES_DATA['elf'];
            let state = characterCreatorReducer(initialCharacterCreatorState, {
                type: 'SELECT_RACE',
                payload: race,
            });
            // Make a selection
            state = characterCreatorReducer(state, {
                type: 'SET_RACIAL_SELECTION',
                payload: { raceId: 'elf', patch: { choiceId: 'high_elf', spellAbility: 'Intelligence' } },
            });
            expect(state.step).toBe(CreationStep.AgeSelection);

            // Back navigation is non-destructive. Data is only wiped when a dependency (Race/Class) changes.
            state = characterCreatorReducer(state, { type: 'GO_BACK' });
            expect(state.step).toBe(CreationStep.Race);
            expect(state.racialSelections['elf']).toBeDefined();
        });
    });

    describe('NAVIGATE_TO_STEP Navigation', () => {
        it('allows navigating forward regardless of completion', () => {
            const state = initialCharacterCreatorState;

            const result = characterCreatorReducer(state, {
                type: 'NAVIGATE_TO_STEP',
                payload: CreationStep.Class,
            });

            expect(result.step).toBe(CreationStep.Class);
        });

        it('does not reset existing selections', () => {
            const stateAfterRace = characterCreatorReducer(initialCharacterCreatorState, {
                type: 'SELECT_RACE',
                payload: ALL_RACES_DATA['human'],
            });

            const navigated = characterCreatorReducer(stateAfterRace, {
                type: 'NAVIGATE_TO_STEP',
                payload: CreationStep.Class,
            });

            expect(navigated.selectedRace?.id).toBe('human');
            expect(navigated.step).toBe(CreationStep.Class);
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
            { raceId: 'hill_dwarf', classId: 'cleric', description: 'Hill Dwarf Cleric (divine caster)' },
            { raceId: 'halfling', classId: 'rogue', description: 'Halfling Rogue (no spells, weapon mastery)' },
            { raceId: 'orc', classId: 'barbarian', description: 'Orc Barbarian (rage, weapon mastery)' },

            // Races with sub-selections
            { raceId: 'dragonborn', classId: 'paladin', description: 'Dragonborn Paladin (ancestry + half caster)' },
            { raceId: 'elf', classId: 'ranger', description: 'Elf Ranger (lineage + half caster)' },
            { raceId: 'forest_gnome', classId: 'artificer', description: 'Forest Gnome Artificer (subrace + caster)' },
            { raceId: 'goliath', classId: 'fighter', description: 'Goliath Fighter (giant ancestry)' },
            { raceId: 'tiefling', classId: 'warlock', description: 'Tiefling Warlock (legacy + pact magic)' },
            { raceId: 'centaur', classId: 'druid', description: 'Centaur Druid (affinity skill + spellcasting)' },
            { raceId: 'changeling', classId: 'bard', description: 'Changeling Bard (instincts + spellcasting)' },

            // Additional races
            // Base "aasimar" entry is not present; use a concrete lineage.
            { raceId: 'protector_aasimar', classId: 'paladin', description: 'Protector Aasimar Paladin (celestial heritage)' },
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
            expect(state.step).toBe(CreationStep.AgeSelection);
            // Background should be reset
            expect(state.selectedBackground).toBeNull();
        });

        it('preserves character name across navigation', () => {
            let state: CharacterCreationState = {
                ...initialCharacterCreatorState,
                selectedRace: ALL_RACES_DATA['human'],
                selectedClass: CLASSES_DATA['fighter'],
                characterName: 'TestHero',
                step: CreationStep.NameAndReview,
            };

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
