/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/underdark/FaerzressSystem.ts
 * Logic for Faerzress (magical radiation) in the Underdark.
 * Influences magic stability, light levels, and sanity.
 */

import { UnderdarkState } from '../../types/underdark';

export class FaerzressSystem {
    /**
     * Calculates the chance of a Wild Magic Surge based on Faerzress intensity.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns Probability of a surge (0.0 - 1.0)
     */
    static calculateWildMagicChance(faerzressLevel: number): number {
        if (faerzressLevel <= 0) return 0;

        // Base 5% chance in any Faerzress
        // Increases linearly up to 50% at max intensity
        const baseChance = 0.05;
        const scalingChance = (faerzressLevel / 100) * 0.45;

        return Number((baseChance + scalingChance).toFixed(2));
    }

    /**
     * Determines if the Faerzress is intense enough to emit dim light.
     * Faerzress typically glows with eerie blue or violet light.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns boolean
     */
    static emitsLight(faerzressLevel: number): boolean {
        return faerzressLevel >= 20; // At 20+, the radiation is visible
    }

    /**
     * Calculates the multiplier for sanity drain.
     * Faerzress is alien energy that erodes the mind.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns Multiplier (e.g., 1.5x drain)
     */
    static getSanityDrainMultiplier(faerzressLevel: number): number {
        if (faerzressLevel <= 0) return 1;

        // 1.0 at 0
        // 1.5 at 50
        // 2.0 at 100
        return 1 + (faerzressLevel / 100);
    }

    /**
     * Determines if teleportation is blocked or warped.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns 'safe' | 'risky' | 'blocked'
     */
    static getTeleportationStatus(faerzressLevel: number): 'safe' | 'risky' | 'blocked' {
        if (faerzressLevel < 10) return 'safe';
        if (faerzressLevel < 80) return 'risky'; // Might end up elsewhere
        return 'blocked'; // Too much interference
    }
}
