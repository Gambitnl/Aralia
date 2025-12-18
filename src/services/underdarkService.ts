
import { UnderdarkState, LightSource, LightSourceType } from '../types/underdark';
import { GameState } from '../types';

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

    if (activeSources.length === 0) {
        // Deep underground with no light is total darkness
        return state.currentDepth > 50 ? 'darkness' : 'dim';
    }

    // If we have active sources, we are at least in dim light.
    // To be 'bright', we need a source close enough or powerful enough.
    // For this service, we just check if there is *any* active source for now.
    // Future iteration: Check distance/radius.

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
        // Being in light restores a tiny bit or halts drain
        sanityDrain = -0.5 * (minutesPassed / 60); // Recover 0.5 per hour
    }

    let newSanity = Math.max(0, Math.min(state.sanity.max, state.sanity.current - sanityDrain));

    // Calculate Madness Level
    // 0: Fine (100-80)
    // 1: Shaken (79-50)
    // 2: Stressed (49-20)
    // 3: Mad (19-0)

    let madnessLevel = 0;
    if (newSanity < 20) madnessLevel = 3;
    else if (newSanity < 50) madnessLevel = 2;
    else if (newSanity < 80) madnessLevel = 1;

    return {
        ...state,
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
