/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/types.ts
 * Defines types for Locks, Traps, and Puzzles.
 */

import { CharacterStats } from '../../types/combat';
import { Item } from '../../types/items';
import { AbilityScoreName } from '../../types/core';

export type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force'
  | 'lightning' | 'necrotic' | 'piercing' | 'poison'
  | 'psychic' | 'radiant' | 'slashing' | 'thunder';

export interface DiceRoll {
  count: number;
  sides: number;
  bonus: number;
}

export interface StatusCondition {
  name: string;
  duration?: number; // Rounds
}

export interface TrapEffect {
  damage?: DiceRoll;
  damageType?: DamageType;
  condition?: StatusCondition;
  saveDC?: number;
  saveType?: AbilityScoreName;
}

export type TriggerCondition = 'touch' | 'proximity' | 'interaction' | 'timer';

export interface Trap {
  id: string;
  name: string;
  detectionDC: number;  // Perception/Investigation
  disarmDC: number;  // Thieves' tools
  triggerCondition: TriggerCondition;
  effect: TrapEffect;
  resetable: boolean;
  isDisarmed: boolean;
  isTriggered: boolean;
}

export interface Lock {
  id: string;
  dc: number;  // Picking difficulty
  keyId?: string;  // Key that opens it
  breakDC?: number;  // DC to break (Strength)
  breakHP?: number;  // HP to destroy
  currentHP?: number; // Current HP if breakable
  isTrapped?: boolean;
  trap?: Trap; // Embed the trap definition if trapped
  isLocked: boolean;
  isBroken: boolean;
}

export interface LockpickResult {
  success: boolean;
  margin: number;
  triggeredTrap: boolean;
  trapEffect?: TrapEffect; // Only present if triggered
}

export interface BreakResult {
  success: boolean;
  margin: number;
  damageDealt?: number;
  isBroken: boolean;
}

export interface TrapDetectionResult {
  success: boolean;
  margin: number;
  trapDetected: boolean;
}

export interface TrapDisarmResult {
  success: boolean;
  margin: number;
  triggeredTrap: boolean;
  trapEffect?: TrapEffect;
}

// --- PUZZLE SYSTEM ---

export type PuzzleType = 'sequence' | 'combination' | 'riddle' | 'item_placement';

export interface PuzzleResult {
  success: boolean;
  isSolved: boolean;
  isFailed: boolean;
  message: string;
  consequence?: {
    damage?: DiceRoll;
    trapId?: string;
  };
}

export interface Puzzle {
  id: string;
  name: string;
  type: PuzzleType;
  description: string;
  hint?: string;
  hintDC: number; // Intelligence (Investigation) check to get the hint

  // Logic
  maxAttempts?: number; // If defined, puzzle fails permanently after X tries

  // Solutions
  // Sequence: Ordered list of IDs (e.g. ['lever1', 'lever2'])
  solutionSequence?: string[];
  // Riddle: List of accepted text answers (case-insensitive)
  acceptedAnswers?: string[];
  // Item Placement: List of required Item IDs
  requiredItems?: string[];

  // State
  isSolved: boolean;
  isFailed: boolean;
  currentAttempts: number;
  currentInputSequence: string[]; // Tracks user inputs for sequence puzzles

  // Connections
  onSuccess: {
    unlockId?: string; // Unlocks this lock
    triggerEvent?: string;
    message: string;
  };
  onFailure?: {
    trapId?: string; // Trigger this trap
    damage?: DiceRoll; // Or just deal damage
    message: string;
  };
}
