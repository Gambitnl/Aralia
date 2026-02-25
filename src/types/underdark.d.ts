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
    radius: number;
    durationRemaining: number;
    isActive: boolean;
}
export type DepthLayer = 'upper' | 'middle' | 'lower' | 'abyss';
export type UnderdarkMechanicType = 'psionic_static' | 'spore_infestation' | 'lolth_surveillance' | 'antimagic_zones' | 'radiation' | 'paranoid_watchers' | 'silence' | 'echoes' | 'hallucinations';
export interface UnderdarkMechanic {
    type: UnderdarkMechanicType;
    description: string;
    intensity: number;
}
export interface UnderdarkFaction {
    id: string;
    name: string;
    description: string;
    territoryDepth: DepthLayer;
    baseHostility: number;
    tradePossible: boolean;
    specialMechanics: UnderdarkMechanic[];
    languages: string[];
}
export type UnderdarkBiomeId = 'cavern_standard' | 'fungal_forest' | 'darklake' | 'crystal_cavern' | 'bone_orchard' | 'faerzress_pocket' | 'shadowfell_rift' | 'magma_tube';
export interface UnderdarkBiome {
    id: UnderdarkBiomeId;
    name: string;
    description: string;
    nativeDepthLayers: DepthLayer[];
    baseLightLevel: 'darkness' | 'dim' | 'bright';
    sanityModifier: number;
    hazards: string[];
    resources: string[];
    soundscape: 'silent' | 'quiet' | 'echoing' | 'loud' | 'deafening';
}
export interface UnderdarkState {
    currentDepth: number;
    currentBiomeId: UnderdarkBiomeId;
    lightLevel: 'bright' | 'dim' | 'darkness' | 'magical_darkness';
    activeLightSources: LightSource[];
    faerzressLevel: number;
    wildMagicChance: number;
    sanity: {
        current: number;
        max: number;
        madnessLevel: number;
    };
    currentTerritoryFactionId?: string;
}
