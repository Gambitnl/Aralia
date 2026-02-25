/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/types/navalCombat.ts
 * Types for the naval combat system, including state, maneuvers, and resolution.
 */
import { Ship, CrewRole } from './naval';
export type WindDirection = 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest';
export type RelativeWind = 'Headwind' | 'Tailwind' | 'Crosswind';
export type CombatRange = 'Long' | 'Medium' | 'Short' | 'Boarding';
export interface CombatShipState {
    ship: Ship;
    currentSpeed: number;
    currentHullPoints: number;
    currentCrew: number;
    activeEffects: NavalStatusEffect[];
    cooldowns: Record<string, number>;
    position: number;
    heading: WindDirection;
    grappledWith?: string[];
}
export interface NavalCombatState {
    ships: Record<string, CombatShipState>;
    round: number;
    windDirection: WindDirection;
    windSpeed: number;
    log: NavalCombatLogEntry[];
}
export type NavalManeuverType = 'Offensive' | 'Defensive' | 'Movement' | 'Special';
export interface ManeuverRequirement {
    minCrew?: number;
    requiredRole?: CrewRole;
    range?: CombatRange[];
    ammoType?: 'Cannonball' | 'Bolt' | 'Grapple';
    ammoCost?: number;
}
export interface NavalManeuver {
    id: string;
    name: string;
    type: NavalManeuverType;
    description: string;
    requirements: ManeuverRequirement;
    cooldown: number;
    difficulty: number;
    successEffect: string;
    failureEffect: string;
}
export interface NavalCombatResult {
    success: boolean;
    roll: number;
    details: string;
    damageDealt?: number;
    stateUpdates: Partial<NavalCombatState>;
}
export interface NavalStatusEffect {
    id: string;
    name: string;
    duration: number;
    effectType: 'Speed' | 'Defense' | 'Attack' | 'Morale';
    value: number;
}
export interface NavalCombatLogEntry {
    round: number;
    message: string;
    type: 'Info' | 'Attack' | 'Maneuver';
}
