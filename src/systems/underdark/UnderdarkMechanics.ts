/**
 * @file src/systems/underdark/UnderdarkMechanics.ts
 * Implements core Underdark mechanics: light source consumption, sanity decay, and madness.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 06:28:41
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {resolveObjectLight} from '../gameplay/objectLightCasting';
import { GameState, GameMessage } from '../../types';
import { UnderdarkState, LightSource } from '../../types/underdark';
import { UNDERDARK_BIOMES } from '../../data/underdark/biomes';

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
            activeLightSources: [...state.underdark.activeLightSources.map(s => resolveObjectLight(state,{ ...s }))]
        };
        const messages: GameMessage[] = [];

        // 1. Process Light Sources
        // Convert seconds to minutes for duration tracking
        const minutesPassed = seconds / 60;

        if (minutesPassed > 0 && nextUnderdark.activeLightSources.length > 0) {
            const remainingSources: LightSource[] = [];

            for (const source of nextUnderdark.activeLightSources) {
                // ADVANCE_TIME supplies the already advanced world clock.
                // Bound Light has an absolute expiry, including while packed;
                // subtracting this tick again ended it early in actual play.
                // Torches and historical unbound spells retain their fuel rule.
                if (source.objectLight && Number.isFinite(source.expiresAtGameTime)) {
                    const now = state.gameTime.getTime();
                    source.durationRemaining = Math.max(0, (source.expiresAtGameTime! - now) / 60000);
                    if (source.durationRemaining <= 0) {
                        // Keep the existing inactive binding as source history.
                        // Expiry is neither a new cast nor a fuel burn event.
                        remainingSources.push(source);
                        continue;
                    }
                    const previous = (source.expiresAtGameTime! - (now - seconds * 1000)) / 60000;
                    if (source.isActive && source.durationRemaining <= 10 && previous > 10) {
                        messages.push({id: Date.now() + Math.random(), sender: 'system', timestamp: new Date(now),
                            text: `Your ${source.name} will fade within ten minutes.`});
                    }
                    remainingSources.push(source);
                    continue;
                }
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
        const isInUnderdark = nextUnderdark.currentDepth > 0;

        if (isInUnderdark) {
            // Check Biome Natural Light
            const currentBiome = UNDERDARK_BIOMES[nextUnderdark.currentBiomeId] || UNDERDARK_BIOMES['cavern_standard'];
            let ambientLight = currentBiome.baseLightLevel;

            // Artificial Light Overrides
            if (nextUnderdark.activeLightSources.some(source=>source.isActive&&source.durationRemaining>0)) {
                if (currentBiome.id === 'shadowfell_rift') {
                    // Shadowfell dampens light
                    ambientLight = 'dim';
                } else {
                    ambientLight = 'bright';
                }
            }

            nextUnderdark.lightLevel = ambientLight;
        }

        // 3. Process Sanity Decay (Affected by Biome & Light)
        if (isInUnderdark) {
            // RALPH: Horror Mechanics.
            // Sanity decays in Darkness (1pt / 30m) but recovers in Light.
            // Multiplier logic:
            // - Scary Biome: Light only STOPS decay (mult 0).
            // - Safe Biome: Light allows RECOVERY (mult -1.0).
            // - Darkness: Base decay, doubled in Magical Darkness.
            const currentBiome = UNDERDARK_BIOMES[nextUnderdark.currentBiomeId] || UNDERDARK_BIOMES['cavern_standard'];

            // Base decay rate: 1 sanity point per 30 minutes in darkness
            // Modified by Biome
            let decayMultiplier = currentBiome.sanityModifier;

            // Darkness accelerates decay, Light halts or reverses it
            if (nextUnderdark.lightLevel === 'darkness' || nextUnderdark.lightLevel === 'magical_darkness') {
                 // Standard decay in darkness
                 if (nextUnderdark.lightLevel === 'magical_darkness') decayMultiplier *= 2;
            } else {
                // In light (dim or bright), decay is halted or reversed
                // If the biome is SCARY (sanityModifier > 1), light only halts decay (multiplier 0)
                // If the biome is SAFE (sanityModifier < 1), light allows recovery (multiplier negative)
                if (decayMultiplier > 1.0) {
                    decayMultiplier = 0; // Light keeps the horror at bay, but doesn't heal
                } else {
                    decayMultiplier = -1.0; // Recovery mode
                }
            }

            // Apply Change
            const baseChange = (minutesPassed / 30);
            const totalChange = baseChange * decayMultiplier;

            if (totalChange > 0) {
                // DECAY
                nextUnderdark.sanity.current = Math.max(0, nextUnderdark.sanity.current - totalChange);

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
                        text: `The darkness of the ${currentBiome.name} presses against your mind. (Madness Level ${newMadnessLevel})`,
                        sender: 'system',
                        timestamp: new Date(state.gameTime.getTime() + seconds * 1000)
                    });
                }
            } else if (totalChange < 0) {
                // RECOVERY (totalChange is negative, so subtracting adds)
                nextUnderdark.sanity.current = Math.min(nextUnderdark.sanity.max, nextUnderdark.sanity.current - totalChange);
            }
        }

        return { underdark: nextUnderdark, messages };
    }
}
