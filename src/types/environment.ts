
/**
 * @file src/types/environment.ts
 * Defines types and interfaces for the environmental system, including
 * weather, terrain mechanics, and hazards.
 */

import { BattleMapTerrain } from './combat';
import { Spell, DamageType } from './spells';

// --- Weather System ---

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
}

// --- Terrain System ---

export type CoverType = 'none' | 'half' | 'three_quarters' | 'total';

/**
 * Defines the mechanical rules for a specific terrain type.
 */
export interface TerrainRule {
  id: BattleMapTerrain;
  name: string;
  movementCost: number; // 1 = normal, 2 = difficult
  cover: CoverType;
  stealthAdvantage: boolean; // Provides natural cover for hiding
  hazards?: EnvironmentalHazard[];
}

// --- Decoration System ---

/**
 * Standard classification for objects placed on the battle map.
 * Replaces ad-hoc string literals.
 */
export enum DecorationType {
  Tree = 'tree',
  Boulder = 'boulder',
  Stalagmite = 'stalagmite',
  Pillar = 'pillar',
  Cactus = 'cactus',
  Mangrove = 'mangrove',
  // Future expansions
  // Crate = 'crate',
  // Barrel = 'barrel',
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
export const DecorationDefinitions: Record<DecorationType, DecorationTraits> = {
  [DecorationType.Tree]: {
    name: "Tree",
    description: "A large trunk providing substantial protection.",
    cover: 'half', // A single tree is usually half cover
    blocksMovement: true,
    blocksLineOfSight: true, // The trunk blocks LoS
    isDestructible: true,
    hp: 50, // Generic large tree
    ac: 15
  },
  [DecorationType.Boulder]: {
    name: "Boulder",
    description: "A large rock sitting on the ground.",
    cover: 'three_quarters', // Offers significant protection
    blocksMovement: true,
    blocksLineOfSight: false, // Usually can see over if tall enough, but generally 'true' for a 5ft space blocker
    isDestructible: true,
    hp: 60,
    ac: 17
  },
  [DecorationType.Stalagmite]: {
    name: "Stalagmite",
    description: "A rock formation rising from the cave floor.",
    cover: 'half',
    blocksMovement: true,
    blocksLineOfSight: false,
    isDestructible: true,
    hp: 40,
    ac: 17
  },
  [DecorationType.Pillar]: {
    name: "Stone Pillar",
    description: "A worked stone column supporting a structure.",
    cover: 'three_quarters', // Depends on width, but usually substantial
    blocksMovement: true,
    blocksLineOfSight: true,
    isDestructible: true,
    hp: 80,
    ac: 17
  },
  [DecorationType.Cactus]: {
    name: "Giant Cactus",
    description: "A prickly desert plant.",
    cover: 'half',
    blocksMovement: true,
    blocksLineOfSight: false,
    isDestructible: true,
    hp: 20,
    ac: 11
  },
  [DecorationType.Mangrove]: {
    name: "Mangrove Roots",
    description: "A tangle of roots rising from the water.",
    cover: 'half',
    blocksMovement: true, // Difficult or impassable
    blocksLineOfSight: false,
    isDestructible: true,
    hp: 40,
    ac: 13
  }
};

// --- Hazard System ---

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

// --- Interaction Interfaces ---

export interface SpellModifier {
  type: 'damage' | 'attack' | 'range' | 'save_dc';
  value: number; // Multiplier for damage, flat bonus/penalty for others
  reason: string;
}
