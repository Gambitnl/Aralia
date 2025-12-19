/**
 * @file src/types/underdark.ts
 * Type definitions for Underdark-specific mechanics, primarily focusing on Light as a Resource
 * and Alien Faction Civilizations.
 */

export type LightSourceType = 'torch' | 'lantern' | 'spell' | 'bioluminescence';

export interface LightSource {
    id: string;
    type: LightSourceType;
    name: string;
    radius: number; // In feet
    durationRemaining: number; // In minutes
    isActive: boolean;
}

export type DepthLayer = 'upper' | 'middle' | 'lower' | 'abyss';

export type UnderdarkMechanicType =
    | 'psionic_static'      // Drains sanity, requires INT saves
    | 'spore_infestation'   // Risk of disease, telepathy enabled
    | 'lolth_surveillance'  // Stealth disadvantage, divine intervention chance
    | 'antimagic_zones'     // Magic fails or surges
    | 'radiation'           // Faerzress or other harmful radiation
    | 'paranoid_watchers';  // Beholders: high perception, ambushes

export interface UnderdarkMechanic {
    type: UnderdarkMechanicType;
    description: string;
    intensity: number; // 1-10 scale of effect
}

export interface UnderdarkFaction {
    id: string;
    name: string; // Drow, Duergar, Mind Flayers, etc.
    description: string;
    territoryDepth: DepthLayer; // The depth layer they primarily inhabit
    baseHostility: number; // 0-100 (0 = peaceful, 100 = kill on sight)
    tradePossible: boolean; // Can you trade with them if not hostile?
    specialMechanics: UnderdarkMechanic[]; // Environmental or psychic effects in their territory
    languages: string[];
}

export interface UnderdarkState {
    currentDepth: number; // Depth in feet below surface
    lightLevel: 'bright' | 'dim' | 'darkness' | 'magical_darkness';
    activeLightSources: LightSource[];

    // Magical radiation unique to the Underdark
    faerzressLevel: number; // 0-100, impacts magic and sanity
    wildMagicChance: number; // 0-1, probability of a surge

    sanity: {
        current: number;
        max: number;
        madnessLevel: number; // 0-3
    };

    // Tracking current territory for faction mechanics
    currentTerritoryFactionId?: string;
}
