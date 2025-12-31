
import { UnderdarkState, LightSource, LightSourceType } from '../types/underdark';
// TODO(lint-intent): 'GameState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState as _GameState } from '../types';
import { FaerzressSystem } from '../systems/underdark/FaerzressSystem';

/**
 * Calculates the current light level based on depth and active light sources.
 *
 * @param state The current Underdark state
 * @returns The calculated light level
 */
export const calculateLightLevel = (state: UnderdarkState): 'bright' | 'dim' | 'darkness' | 'magical_darkness' => {
    // Surface level or shallow caves might be bright/dim based on time of day,
    // but here we assume depth dictates ambient light.
    // 0 = Surface
    // > 0 = Underground

    if (state.currentDepth <= 0) {
        return 'bright'; // Assume surface is bright for now (ignoring day/night cycle integration here to keep it focused)
    }

    // Check for magical darkness first (it suppresses non-magical light)
    const magicalDarkness = state.activeLightSources.find(ls => ls.type === 'spell' && ls.name === 'Darkness' && ls.isActive);
    if (magicalDarkness) {
        // In 5e, magical darkness blocks non-magical light.
        // We'd need to check levels of spells, but for simplicity:
        return 'magical_darkness';
    }

    // Check if we have any active light sources
    const activeSources = state.activeLightSources.filter(ls => ls.isActive && ls.durationRemaining > 0);

    // Check for Faerzress glow (Alien physics!)
    // Faerzress provides dim light if intense enough
    const faerzressGlow = FaerzressSystem.emitsLight(state.faerzressLevel);

    if (activeSources.length === 0 && !faerzressGlow) {
        // Deep underground with no light is total darkness
        return state.currentDepth > 50 ? 'darkness' : 'dim';
    }

    // If we have active sources or Faerzress glow, we are at least in dim light.
    // To be 'bright', we need a source close enough or powerful enough.
    // Faerzress never provides bright light, only dim.

    // Check for "bright" light sources
    const hasBrightLight = activeSources.some(ls => ls.radius >= 20); // Standard torch is 20ft bright + 20ft dim

    return hasBrightLight ? 'bright' : 'dim';
};

/**
 * Updates the state of light sources, reducing duration.
 *
 * @param state The current Underdark state
 * @param minutesPassed Number of minutes to advance
 * @returns Updated UnderdarkState
 */
export const tickLightSources = (state: UnderdarkState, minutesPassed: number): UnderdarkState => {
    const updatedSources = state.activeLightSources.map(ls => {
        if (!ls.isActive) return ls;

        // Infinite sources (like bioluminescence) don't decay
        if (ls.type === 'bioluminescence') return ls;

        const newDuration = Math.max(0, ls.durationRemaining - minutesPassed);
        return {
            ...ls,
            durationRemaining: newDuration,
            isActive: newDuration > 0
        };
    });

    return {
        ...state,
        activeLightSources: updatedSources
    };
};

/**
 * Updates sanity based on light level and depth.
 *
 * @param state The current Underdark state
 * @param minutesPassed Number of minutes spent
 * @returns Updated UnderdarkState
 */
export const updateSanity = (state: UnderdarkState, minutesPassed: number): UnderdarkState => {
    // Only affect sanity if we are deep underground
    if (state.currentDepth < 100) return state;

    const lightLevel = calculateLightLevel(state);
    let sanityDrain = 0;

    // Drain sanity faster in darkness
    if (lightLevel === 'magical_darkness') {
        sanityDrain = 5 * (minutesPassed / 60); // 5 sanity per hour
    } else if (lightLevel === 'darkness') {
        sanityDrain = 2 * (minutesPassed / 60); // 2 sanity per hour
    } else {
        // Normally, being in light restores a tiny bit or halts drain (-0.5).
        // HOWEVER, if the light is purely from Faerzress (or dominates), it's alien.

        // If Faerzress is glowing (>=20) and we are in dim/bright light...
        // We assume the Faerzress is contributing to the environment.
        if (state.faerzressLevel >= 20) {
            // Alien Light: It lets you see, but it feels wrong.
            // Instead of recovering -0.5, we drain slightly +0.5
            sanityDrain = 0.5 * (minutesPassed / 60);
        } else {
            // Normal light (torch, sun, spell)
            sanityDrain = -0.5 * (minutesPassed / 60); // Recover 0.5 per hour
        }
    }

    // Apply Faerzress Multiplier
    // If we are draining, Faerzress makes it worse.
    const drainMultiplier = FaerzressSystem.getSanityDrainMultiplier(state.faerzressLevel);

    if (sanityDrain > 0) {
        // If draining (Darkness OR Alien Light), amplify it
        sanityDrain *= drainMultiplier;
    }
    // If recovering (Normal Light), we don't multiply the recovery.
    // (Or we could reduce it, but keeping it simple for now)

    const newSanity = Math.max(0, Math.min(state.sanity.max, state.sanity.current - sanityDrain));

    // Calculate Madness Level
    // 0: Fine (100-80)
    // 1: Shaken (79-50)
    // 2: Stressed (49-20)
    // 3: Mad (19-0)

    let madnessLevel = 0;
    if (newSanity < 20) madnessLevel = 3;
    else if (newSanity < 50) madnessLevel = 2;
    else if (newSanity < 80) madnessLevel = 1;

    // Also update dynamic probabilities based on Faerzress
    const wildMagicChance = FaerzressSystem.calculateWildMagicChance(state.faerzressLevel);

    return {
        ...state,
        wildMagicChance,
        sanity: {
            ...state.sanity,
            current: newSanity,
            madnessLevel
        }
    };
};

export const createLightSource = (
    name: string,
    type: LightSourceType,
    radius: number,
    durationMinutes: number
): LightSource => {
    return {
        id: crypto.randomUUID(),
        name,
        type,
        radius,
        durationRemaining: durationMinutes,
        isActive: true
    };
};
