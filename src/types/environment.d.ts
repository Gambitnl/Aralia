/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 09/06/2026, 04:34:01
 * Dependents: hooks/actions/handleNpcInteraction.ts, hooks/useCompanionBanter.ts, hooks/useCompanionCommentary.ts, hooks/useConversation.ts, state/initialState.ts, state/reducers/worldReducer.ts, systems/environment/EnvironmentSystem.ts, systems/environment/TerrainSystem.ts, systems/environment/WeatherSystem.ts, systems/environment/hazards.ts, systems/naval/VoyageManager.ts, types/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/types/environment.ts
 * Defines types and interfaces for the environmental system, including
 * weather, terrain mechanics, and hazards.
 */
import { BattleMapTerrain } from './combat.js';
import { DamageType } from './spells.js';
export type Precipitation = 'none' | 'light_rain' | 'heavy_rain' | 'storm' | 'snow' | 'blizzard';
export type WindSpeed = 'calm' | 'light' | 'moderate' | 'strong' | 'gale';
export type VisibilityLevel = 'clear' | 'lightly_obscured' | 'heavily_obscured';
export type Temperature = 'freezing' | 'cold' | 'temperate' | 'hot' | 'extreme_heat';
export interface WindCondition {
    direction: 'north' | 'south' | 'east' | 'west' | 'variable';
    speed: WindSpeed;
}
/**
 * Represents the current global weather conditions.
 */
export interface WeatherState {
    precipitation: Precipitation;
    temperature: Temperature;
    wind: WindCondition;
    visibility: VisibilityLevel;
    currentWeather?: string;
    baseTemperature?: Temperature;
    baseVisibility?: VisibilityLevel;
}
type WeatherSummaryInput = Partial<Pick<WeatherState, 'currentWeather' | 'precipitation'>> | null | undefined;
/**
 * Converts structured weather into the compact legacy label used by prompts
 * and older narrative hooks. When a save already carries the bridge label, we
 * preserve it instead of trying to synthesize a richer description.
 */
export declare const getWeatherSummary: (weather: WeatherSummaryInput) => string;
/**
 * Re-attaches the legacy bridge field to canonical weather objects so old
 * callers can keep reading a string while the reducer continues to own the
 * structured state.
 */
export declare const withLegacyWeatherBridge: (weather: WeatherState) => WeatherState;
export type CoverType = 'none' | 'half' | 'three_quarters' | 'total';
/**
 * Defines the mechanical rules for a specific terrain type.
 */
export interface TerrainRule {
    id: BattleMapTerrain;
    name: string;
    movementCost: number;
    cover: CoverType;
    stealthAdvantage: boolean;
    hazards?: EnvironmentalHazard[];
}
/**
 * Standard classification for objects placed on the battle map.
 * Replaces ad-hoc string literals.
 */
export declare enum DecorationType {
    Tree = "tree",
    Boulder = "boulder",
    Stalagmite = "stalagmite",
    Pillar = "pillar",
    Cactus = "cactus",
    Mangrove = "mangrove"
}
export interface DecorationTraits {
    name: string;
    description: string;
    cover: CoverType;
    blocksMovement: boolean;
    blocksLineOfSight: boolean;
    isDestructible: boolean;
    hp?: number;
    ac?: number;
}
/**
 * Defines the mechanical properties of map decorations.
 * Source: D&D 5e Cover and Object rules (PHB/DMG).
 */
export declare const DecorationDefinitions: Record<DecorationType, DecorationTraits>;
export interface EnvironmentalHazard {
    id: string;
    name: string;
    description: string;
    trigger: 'enter' | 'start_turn' | 'end_turn';
    effectType: 'damage' | 'status' | 'movement';
    damage?: {
        dice: string;
        type: DamageType;
    };
    saveDC?: number;
}
export interface SpellModifier {
    type: 'damage' | 'attack' | 'range' | 'save_dc';
    value: number;
    reason: string;
}
export {};
