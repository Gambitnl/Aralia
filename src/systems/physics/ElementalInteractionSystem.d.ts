/**
 * @file src/systems/physics/ElementalInteractionSystem.ts
 * Logic for applying elemental states and resolving interactions.
 */
import { StateTag } from '@/types/elemental';
/**
 * Result of an attempt to apply a state.
 */
export interface StateApplicationResult {
    applied: boolean;
    finalState?: StateTag;
    removedStates?: StateTag[];
    interaction?: string;
}
/**
 * Applies a new state tag to a list of existing states, resolving interactions.
 *
 * @param currentStates - The entity's current active state tags.
 * @param newState - The new state tag to apply.
 * @returns Object containing the new list of states and details about the interaction.
 */
export declare function applyStateToTags(currentStates: StateTag[], newState: StateTag): {
    newStates: StateTag[];
    result: StateApplicationResult;
};
