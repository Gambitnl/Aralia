/**
 * @file src/systems/underdark/UnderdarkMechanics.ts
 * Implements core Underdark mechanics: light source consumption, sanity decay, and madness.
 */

import { GameState, UnderdarkState, LightSource, GameMessage } from '../../types';

export class UnderdarkMechanics {

    /**
     * Processes time advancement for Underdark systems.
     * @param state The current GameState.
     * @param seconds The number of seconds to advance.
     * @returns An object containing the updated UnderdarkState and any generated GameMessages.
     */
    static processTime(state: GameState, seconds: number): { underdark: UnderdarkState, messages: GameMessage[] } {
        // Shallow copy logic to avoid full JSON parse/stringify overhead
        // We only copy what we modify.
        const nextUnderdark: UnderdarkState = {
            ...state.underdark,
            sanity: { ...state.underdark.sanity },
            activeLightSources: [...state.underdark.activeLightSources.map(s => ({ ...s }))]
        };
        const messages: GameMessage[] = [];

        // 1. Process Light Sources
        // Convert seconds to minutes for duration tracking
        const minutesPassed = seconds / 60;

        if (minutesPassed > 0 && nextUnderdark.activeLightSources.length > 0) {
            const remainingSources: LightSource[] = [];

            for (const source of nextUnderdark.activeLightSources) {
                if (source.isActive) {
                    source.durationRemaining -= minutesPassed;

                    if (source.durationRemaining <= 0) {
                        messages.push({
                            id: Date.now() + Math.random(),
                            text: `Your ${source.name} flickers and dies, plunging you into deeper shadow.`,
                            sender: 'system',
                            timestamp: new Date(state.gameTime.getTime() + seconds * 1000)
                        });
                    } else if (source.durationRemaining <= 10 && source.durationRemaining + minutesPassed > 10) {
                         messages.push({
                            id: Date.now() + Math.random(),
                            text: `Your ${source.name} is running low on fuel.`,
                            sender: 'system',
                            timestamp: new Date(state.gameTime.getTime() + seconds * 1000)
                        });
                        remainingSources.push(source);
                    } else {
                        remainingSources.push(source);
                    }
                } else {
                    remainingSources.push(source);
                }
            }
            nextUnderdark.activeLightSources = remainingSources;
        }

        // 2. Recalculate Light Level
        // Logic: If there are active light sources, it's 'dim' or 'bright' depending on the source.
        // For simplicity, any light source makes it 'bright' locally for the player, unless suppressed.
        // If no sources, it's 'darkness'.
        // Note: This logic might need to be more complex (e.g., checking if we are actually IN the underdark).
        // For now, we assume this runs always but only affects state if we are tracking underdark state.

        // TODO: specific check if player is in Underdark biome/region
        const isInUnderdark = nextUnderdark.currentDepth > 0;

        if (isInUnderdark) {
            if (nextUnderdark.activeLightSources.length > 0) {
                nextUnderdark.lightLevel = 'bright'; // Simplified
            } else {
                nextUnderdark.lightLevel = 'darkness';
            }
        }

        // 3. Process Sanity Decay (only if in Darkness)
        if (isInUnderdark && (nextUnderdark.lightLevel === 'darkness' || nextUnderdark.lightLevel === 'magical_darkness')) {
            // Decay rate: 1 sanity point per hour of darkness?
            // Let's say 1 point every 30 minutes.
            const sanityLoss = (minutesPassed / 30);

            if (sanityLoss > 0) {
                nextUnderdark.sanity.current = Math.max(0, nextUnderdark.sanity.current - sanityLoss);

                // Check for Madness Thresholds
                const sanityPercent = nextUnderdark.sanity.current / nextUnderdark.sanity.max;
                let newMadnessLevel = 0;

                if (sanityPercent <= 0.25) newMadnessLevel = 3;
                else if (sanityPercent <= 0.50) newMadnessLevel = 2;
                else if (sanityPercent <= 0.75) newMadnessLevel = 1;

                if (newMadnessLevel > nextUnderdark.sanity.madnessLevel) {
                     nextUnderdark.sanity.madnessLevel = newMadnessLevel;
                     messages.push({
                        id: Date.now() + Math.random(),
                        text: `The darkness presses against your mind. You feel your grip on reality slipping. (Madness Level ${newMadnessLevel})`,
                        sender: 'system',
                        timestamp: new Date(state.gameTime.getTime() + seconds * 1000)
                    });
                }
            }
        }

        // 4. Recovery (Slow recovery in light?)
        if (isInUnderdark && (nextUnderdark.lightLevel === 'bright') && nextUnderdark.sanity.current < nextUnderdark.sanity.max) {
             // Recover 1 point per hour of light
             const sanityGain = (minutesPassed / 60);
             nextUnderdark.sanity.current = Math.min(nextUnderdark.sanity.max, nextUnderdark.sanity.current + sanityGain);
        }

        return { underdark: nextUnderdark, messages };
    }
}
