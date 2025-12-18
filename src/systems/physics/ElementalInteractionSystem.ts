/**
 * @file src/systems/physics/ElementalInteractionSystem.ts
 * Logic for applying elemental states and resolving interactions.
 */

import { StateTag, StateInteractions } from '@/types/elemental';

/**
 * Result of an attempt to apply a state.
 */
export interface StateApplicationResult {
    applied: boolean;
    finalState?: StateTag;
    removedStates?: StateTag[];
    interaction?: string; // Description of what happened (e.g., "Frozen")
}

/**
 * Applies a new state tag to a list of existing states, resolving interactions.
 *
 * @param currentStates - The entity's current active state tags.
 * @param newState - The new state tag to apply.
 * @returns Object containing the new list of states and details about the interaction.
 */
export function applyStateToTags(currentStates: StateTag[], newState: StateTag): {
    newStates: StateTag[];
    result: StateApplicationResult;
} {
    // Clone to avoid mutating the input immediately
    const nextStates = [...currentStates];
    const removedStates: StateTag[] = [];
    let interactionResult: StateTag | null | undefined = undefined;

    // Check for interactions with existing states
    // We prioritize interactions that remove or transform states.
    for (let i = 0; i < nextStates.length; i++) {
        const existing = nextStates[i];

        // Sort keys to match the registry format "state1+state2" (alphabetical)
        const key = [existing, newState].sort().join('+');

        if (key in StateInteractions) {
            interactionResult = StateInteractions[key];

            // Remove the existing state involved in the interaction
            removedStates.push(existing);
            nextStates.splice(i, 1);
            i--; // Adjust index since we removed an element

            // If interaction produced a new state (e.g., Frozen), we might need to apply IT recursively,
            // but for simplicity in this iteration, we just add it if it's not null.
            // If it's null, it means cancellation (Wet + Fire -> null).

            if (interactionResult) {
                // Check if the resulting state is already present to avoid duplicates
                if (!nextStates.includes(interactionResult)) {
                    nextStates.push(interactionResult);
                }
                return {
                    newStates: nextStates,
                    result: {
                        applied: true,
                        finalState: interactionResult,
                        removedStates,
                        interaction: `Interaction: ${existing} + ${newState} -> ${interactionResult}`
                    }
                };
            } else {
                // Cancellation
                return {
                    newStates: nextStates,
                    result: {
                        applied: true, // It was "applied" in the sense that it reacted
                        finalState: undefined, // No resulting state (neutralized)
                        removedStates,
                        interaction: `Interaction: ${existing} + ${newState} -> Neutralized`
                    }
                };
            }
        }
    }

    // No interaction found, simply add the state if not present
    if (!nextStates.includes(newState)) {
        nextStates.push(newState);
    }

    return {
        newStates: nextStates,
        result: {
            applied: true,
            finalState: newState
        }
    };
}
