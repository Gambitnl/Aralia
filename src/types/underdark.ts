/**
 * @file src/types/underdark.ts
 * Type definitions for Underdark-specific mechanics, primarily focusing on Light as a Resource
 * and Alien Faction Civilizations.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 03/11/2026, 06:28:41
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, data/underdark/biomes.ts, data/underdarkFactions.ts, hooks/useUnderdarkLighting.ts, services/underdarkService.ts, systems/gameplay/objectLightCasting.ts, systems/underdark/UnderdarkFactionSystem.ts, systems/underdark/UnderdarkMechanics.ts, systems/underdark/carriedItemLight.ts, types/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {Item} from './items';

export type LightSourceType = 'torch' | 'lantern' | 'spell' | 'bioluminescence';

export interface LightSource {
    id: string;
    type: LightSourceType;
    name: string;
    radius: number; // In feet
    durationRemaining: number; // In minutes
    isActive: boolean;
    /** Explicit carried fuel; a packed torch alone produces no light. */
    bearerId?: string;
    sourceItem?: Item;
    brightRadius?: number;
    dimRadius?: number;
    expiresAtGameTime?: number;
    /** Spell provenance; bearer follows the marked object through ordinary equipment changes. */
    objectLight?: {spellId: 'light'; casterId:string;slot:'MainHand'|'OffHand';color:string};
}

export type DepthLayer = 'upper' | 'middle' | 'lower' | 'abyss';

export type UnderdarkMechanicType =
    | 'psionic_static'      // Drains sanity, requires INT saves
    | 'spore_infestation'   // Risk of disease, telepathy enabled
    | 'lolth_surveillance'  // Stealth disadvantage, divine intervention chance
    | 'antimagic_zones'     // Magic fails or surges
    | 'radiation'           // Faerzress or other harmful radiation
    | 'paranoid_watchers'   // Beholders: high perception, ambushes
    | 'silence'             // Magical silence (stealth adv, no verbal spells)
    | 'echoes'              // Sound amplified (stealth disadv)
    | 'hallucinations';     // Visual tricks, difficult terrain perception

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

export type UnderdarkBiomeId =
    | 'cavern_standard'
    | 'fungal_forest'
    | 'darklake'
    | 'crystal_cavern'
    | 'bone_orchard'
    | 'faerzress_pocket'
    | 'shadowfell_rift'
    | 'magma_tube';

export interface UnderdarkBiome {
    id: UnderdarkBiomeId;
    name: string;
    description: string;
    nativeDepthLayers: DepthLayer[]; // Where this biome appears
    baseLightLevel: 'darkness' | 'dim' | 'bright' | 'magical_darkness'; // Natural ambient light; 'magical_darkness' is planar/magical gloom that doubles sanity decay
    sanityModifier: number; // Multiplier for sanity decay (e.g. 0.5 for safe, 2.0 for scary)
    hazards: string[];
    resources: string[];
    soundscape: 'silent' | 'quiet' | 'echoing' | 'loud' | 'deafening';
}

export interface UnderdarkState {
    currentDepth: number; // Depth in feet below surface
    currentBiomeId: UnderdarkBiomeId; // The active biome/region
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
