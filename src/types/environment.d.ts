/**
 * @file src/types/environment.ts
 * Defines types and interfaces for the environmental system, including
 * weather, terrain mechanics, and hazards.
 */
import { BattleMapTerrain } from './combat';
import { DamageType } from './spells';
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
