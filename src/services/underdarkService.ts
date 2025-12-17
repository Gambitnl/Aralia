/**
 * @file src/services/underdarkService.ts
 * Service for handling Underdark-specific logic like light levels and sanity.
 */
import { LightSource, UnderdarkState } from '../types/underdark';

/**
 * Calculates the current light level based on active light sources and depth.
 * @param sources List of active light sources
 * @param depth Current depth in feet
 * @returns The calculated light level
 */
export function calculateLightLevel(sources: LightSource[], depth: number): UnderdarkState['lightLevel'] {
    // If on surface (depth 0), assume bright (simplified, ignores day/night for now or assumes day)
    // In a real implementation, we'd check global time of day.
    // For now, let's assume depth > 0 is the trigger for "darkness by default".
    if (depth <= 0) {
        return 'bright';
    }

    if (sources.length === 0) {
        return 'darkness';
    }

    // Logic:
    // - Any magical light source might overcome normal darkness.
    // - Torches/Lanterns provide 'bright' or 'dim' light.
    // For MVP: If any source is active, it's 'dim'. If multiple or strong, 'bright'.

    // Check for magical darkness (not implemented yet, but placeholder)
    // if (sources.some(s => s.type === 'magical_darkness_source')) return 'magical_darkness';

    // Calculate max radius
    const maxRadius = Math.max(...sources.map(s => s.radius));

    if (maxRadius >= 20) {
        return 'bright'; // Torch gives 20ft bright
    } else if (maxRadius > 0) {
        return 'dim';
    }

    return 'darkness';
}

/**
 * Calculates the change in sanity based on current conditions.
 * @param lightLevel Current light level
 * @param currentSanity Current sanity state
 * @param minutesPassed Time elapsed in minutes
 * @returns The change in sanity (negative for loss, positive for recovery)
 */
export function calculateSanityChange(
    lightLevel: UnderdarkState['lightLevel'],
    currentSanity: UnderdarkState['sanity'],
    minutesPassed: number = 1
): number {
    let rate = 0;

    if (lightLevel === 'darkness' || lightLevel === 'magical_darkness') {
        // Lose sanity in darkness: 0.5 points per minute
        rate = -0.5;
    } else if (lightLevel === 'bright' && currentSanity.current < currentSanity.max) {
        // Recover slowly in bright light: 0.1 points per minute
        rate = 0.1;
    }

    return rate * minutesPassed;
}
