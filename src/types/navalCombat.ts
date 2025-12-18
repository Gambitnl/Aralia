/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/types/navalCombat.ts
 * Types for the naval combat system, including state, maneuvers, and resolution.
 */

import { Ship, CrewRole, ShipStats } from './naval';

export type WindDirection = 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest';
export type RelativeWind = 'Headwind' | 'Tailwind' | 'Crosswind';

export type CombatRange = 'Long' | 'Medium' | 'Short' | 'Boarding';

export interface CombatShipState {
    ship: Ship;
    currentSpeed: number; // Modified by wind/damage
    currentHullPoints: number; // Tracked separately during combat
    currentCrew: number; // Active crew count
    activeEffects: NavalStatusEffect[];
    cooldowns: Record<string, number>; // maneuverId -> rounds remaining
    position: number; // Abstract linear position (0-100) relative to center, or simple tracking
    heading: WindDirection;
    grappledWith?: string[]; // IDs of ships grappled with
}

export interface NavalCombatState {
    ships: Record<string, CombatShipState>; // shipId -> state
    round: number;
    windDirection: WindDirection;
    windSpeed: number; // 0-3 (Calm, Breeze, Gale, Storm)
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
    cooldown: number; // Rounds
    difficulty: number; // Base DC for crew/captain check

    // Outcome description for UI
    successEffect: string;
    failureEffect: string;
}

export interface NavalCombatResult {
    success: boolean;
    roll: number;
    details: string;
    damageDealt?: number;
    stateUpdates: Partial<NavalCombatState>; // Changes to apply
}

export interface NavalStatusEffect {
    id: string;
    name: string;
    duration: number; // Rounds
    effectType: 'Speed' | 'Defense' | 'Attack' | 'Morale';
    value: number;
}

export interface NavalCombatLogEntry {
    round: number;
    message: string;
    type: 'Info' | 'Attack' | 'Maneuver';
}
