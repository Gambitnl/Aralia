/**
 * @file src/state/reducers/underdarkReducer.ts
 * A slice reducer that handles Underdark-specific state changes.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { UnderdarkState } from '../../types/underdark';
import { calculateLightLevel, calculateSanityChange } from '../../services/underdarkService';

export const initialUnderdarkState: UnderdarkState = {
    currentDepth: 0,
    lightLevel: 'bright',
    activeLightSources: [],
    sanity: {
        current: 100,
        max: 100,
        madnessLevel: 0
    }
};

export function underdarkReducer(state: GameState, action: AppAction): Partial<GameState> {
    const currentUnderdark = state.underdark || initialUnderdarkState;

    switch (action.type) {
        case 'ADD_LIGHT_SOURCE':
            const newSourcesAdd = [...currentUnderdark.activeLightSources, action.payload];
            return {
                underdark: {
                    ...currentUnderdark,
                    activeLightSources: newSourcesAdd,
                    lightLevel: calculateLightLevel(newSourcesAdd, currentUnderdark.currentDepth)
                }
            };

        case 'REMOVE_LIGHT_SOURCE':
            const newSourcesRemove = currentUnderdark.activeLightSources.filter(s => s.id !== action.payload.id);
            return {
                underdark: {
                    ...currentUnderdark,
                    activeLightSources: newSourcesRemove,
                    lightLevel: calculateLightLevel(newSourcesRemove, currentUnderdark.currentDepth)
                }
            };

        case 'SET_DEPTH':
            const newDepth = action.payload.depth;
            return {
                underdark: {
                    ...currentUnderdark,
                    currentDepth: newDepth,
                    // Re-calculate light level as depth might imply environmental darkness
                    lightLevel: calculateLightLevel(currentUnderdark.activeLightSources, newDepth)
                }
            };

        case 'ADVANCE_TIME':
            // Decay light sources
            const minutesPassed = action.payload.seconds / 60;
            const decayedSources = currentUnderdark.activeLightSources.map(source => ({
                ...source,
                durationRemaining: Math.max(0, source.durationRemaining - minutesPassed),
                isActive: source.durationRemaining - minutesPassed > 0
            })).filter(s => s.isActive);

            const newLightLevel = calculateLightLevel(decayedSources, currentUnderdark.currentDepth);

            // Calculate Sanity impact
            // Passing minutesPassed to scale the impact
            const sanityImpact = calculateSanityChange(newLightLevel, currentUnderdark.sanity, minutesPassed);
            const newSanityCurrent = Math.max(0, Math.min(currentUnderdark.sanity.max, currentUnderdark.sanity.current + sanityImpact));

            // Determine Madness Level
            let newMadnessLevel = 0;
            if (newSanityCurrent < 20) newMadnessLevel = 3;
            else if (newSanityCurrent < 50) newMadnessLevel = 2;
            else if (newSanityCurrent < 80) newMadnessLevel = 1;

            return {
                underdark: {
                    ...currentUnderdark,
                    activeLightSources: decayedSources,
                    lightLevel: newLightLevel,
                    sanity: {
                        ...currentUnderdark.sanity,
                        current: newSanityCurrent,
                        madnessLevel: newMadnessLevel
                    }
                }
            };

        default:
            return {};
    }
}
