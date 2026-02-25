/**
 * Consolidated type exports for Aralia RPG.
 * Core primitives live in ./core, item definitions in ./items, and character-focused
 * types in ./character. Domain-specific modules (combat, spells, deity, factions, etc.)
 * remain in sibling files and are re-exported here for convenience.
 */
import type { CombatCharacter, CharacterStats, Position, CombatState } from './combat';
export * from './world';
export * from './actions';
export * from './state';
export * from './ui';
export * from './core';
export * from './items';
export * from './character';
export * from './spells';
export * from './conditions';
export * from './creatures';
export * from './religion';
export * from './factions';
export * from './companions';
export * from './memory';
export * from './planes';
export * from './crime';
export * from './dialogue';
export * from './underdark';
export * from './history';
export * from './economy';
export * from './languages';
export * from './effects';
export * from './rituals';
export * from './village';
export * from './elemental';
export * from './stronghold';
export * from './loot';
export * from './identity';
export * from './quests';
export * from './prophecy';
export * from './naval';
export * from './navalCombat';
export * from './crafting';
export * from './conversation';
export * from './environment';
export * from './journal';
export type { CombatCharacter, CharacterStats, Position, CombatState };
export type { AppAction } from '../state/actionTypes';
