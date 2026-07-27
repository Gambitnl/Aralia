/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/underdark/FaerzressSystem.ts
 * Logic for Faerzress (magical radiation) in the Underdark.
 * Influences magic stability, light levels, and sanity.
 */
export declare class FaerzressSystem {
    /**
     * Calculates the chance of a Wild Magic Surge based on Faerzress intensity.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns Probability of a surge (0.0 - 1.0)
     */
    static calculateWildMagicChance(faerzressLevel: number): number;
    /**
     * Determines if the Faerzress is intense enough to emit dim light.
     * Faerzress typically glows with eerie blue or violet light.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns boolean
     */
    static emitsLight(faerzressLevel: number): boolean;
    /**
     * Calculates the multiplier for sanity drain.
     * Faerzress is alien energy that erodes the mind.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns Multiplier (e.g., 1.5x drain)
     */
    static getSanityDrainMultiplier(faerzressLevel: number): number;
    /**
     * Determines if teleportation is blocked or warped.
     *
     * @param faerzressLevel The current level of Faerzress (0-100)
     * @returns 'safe' | 'risky' | 'blocked'
     */
    static getTeleportationStatus(faerzressLevel: number): 'safe' | 'risky' | 'blocked';
}
