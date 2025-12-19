/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/worldEvents.ts
 * Defines types for the dynamic world event system, including Faction Goals.
 */

export type FactionGoalType =
  | 'EXPANSION'      // Trying to take territory
  | 'WEALTH'         // Trying to amass gold/resources
  | 'INFLUENCE'      // Trying to gain political favor
  | 'DESTRUCTION'    // Trying to destroy an enemy
  | 'KNOWLEDGE'      // Trying to find artifacts/secrets
  | 'DEFENSE';       // Trying to fortify/recover

export type FactionGoalStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface FactionGoal {
  id: string;
  type: FactionGoalType;
  description: string;
  target?: string; // ID of target faction, location, or item
  progress: number; // 0 to 100
  difficulty: number; // 1 to 100 (affects roll success chance)
  status: FactionGoalStatus;
  rewards?: {
    power?: number;
    gold?: number;
    asset?: string;
  };
}

export interface WorldEvent {
  id: string;
  type: string;
  description: string;
  date: number;
  involvedFactions: string[];
}
