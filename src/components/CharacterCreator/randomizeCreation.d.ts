/**
 * This file builds a legal random walk through the Character Creator wizard.
 *
 * It exists so the "Auto-Fill (Random)" button can use the same reducer actions
 * that normal player clicks use, instead of constructing a finished character
 * behind the wizard's back. The component supplies the loaded spell registry and
 * dispatches the returned actions in order.
 *
 * Called by: CharacterCreator.tsx and randomizeCreation.test.ts.
 * Depends on: Character Creator reducer action types, race/class/background/
 * feat data, skill-selection helpers, spell data from SpellContext, and weapon
 * data from constants.ts.
 */
import type { Class as CharClass, Spell } from '../../types';
import { CharacterCreatorAction, type CharacterCreationState } from './state/characterCreatorState';
export type RandomNumberGenerator = () => number;
export interface RandomizeCreationInput {
    allSpells: Record<string, Spell>;
    rng?: RandomNumberGenerator;
}
export interface RandomizedCreationPlan {
    actions: CharacterCreatorAction[];
    state: CharacterCreationState;
}
export declare function seededRng(seed: number): RandomNumberGenerator;
export declare function getLegalWeaponMasteryOptions(charClass: CharClass): string[];
export declare function randomizeCreation(input: RandomizeCreationInput): RandomizedCreationPlan;
