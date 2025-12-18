/**
 * @file src/types/rituals.ts
 * Defines the state and mechanics for long-duration ritual casting.
 */

import { Spell, Components, SavingThrowAbility } from './spells';
import { CombatCharacter } from './combat';

/**
 * Tracks an ongoing ritual being cast.
 * Rituals generally take the spell's casting time + 10 minutes.
 */
export interface RitualState {
  id: string; // Unique ID for this specific ritual instance
  spell: Spell;
  casterId: string;

  // Timing
  startTime: number; // Gametime timestamp
  durationMinutes: number; // Total duration required (Casting Time + 10m)
  progressMinutes: number; // Current progress in minutes

  // Participation
  participantIds: string[]; // IDs of characters helping
  participationBonus: number; // Bonus to interruption saves from participants

  // State
  isComplete: boolean;
  interrupted: boolean;
  interruptionReason?: string;

  // Conditions that can break the ritual
  interruptConditions: InterruptCondition[];

  // Material Tracking
  materialsConsumed: boolean;
  consumptionThreshold: number; // 0.0 to 1.0, progress point where materials are consumed
}

/**
 * Defines a condition that might interrupt a ritual.
 */
export interface InterruptCondition {
  type: 'damage' | 'movement' | 'noise' | 'distraction' | 'incapacitated';
  threshold?: number; // e.g., damage amount > 0, moved > 5 feet
  saveToResist?: {
    ability: SavingThrowAbility;
    dcCalculation: 'damage_taken' | 'fixed';
    fixedDC?: number;
  };
}

/**
 * The result of checking for an interruption.
 */
export interface InterruptResult {
  interrupted: boolean;
  reason?: string;
  canSave: boolean;
  saveDC?: number;
  saveAbility?: SavingThrowAbility;
}

/**
 * Event that might trigger an interruption.
 */
export interface RitualEvent {
  // Added 'incapacitated', 'noise', 'distraction' to match InterruptCondition types
  type: 'damage' | 'movement' | 'action' | 'status_change' | 'incapacitated' | 'noise' | 'distraction';
  targetId: string; // Who did this happen to?
  value?: number; // Amount of damage, distance moved, etc.
  tags?: string[]; // e.g., ["loud", "shove"]
}

// -----------------------------------------------------------------------------
// Ritual Constraints (Ceremony Requirements)
// -----------------------------------------------------------------------------

/**
 * Valid environmental or temporal conditions for starting a ritual.
 */
export interface RitualRequirement {
  type: 'time_of_day' | 'location' | 'biome' | 'weather' | 'participants_count' | 'custom';
  value: string | number | string[];
  description?: string; // Failure message e.g. "Must be cast at night"
}

/**
 * Context provided to validate ritual requirements.
 */
export interface RitualContext {
  currentTime?: number; // Gametime
  isDaytime?: boolean;
  locationId?: string;
  locationType?: 'indoors' | 'outdoors' | 'underground';
  biomeId?: string;
  weather?: string; // 'clear', 'rain', 'storm'
}
