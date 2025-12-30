/**
 * @file src/types/rituals.ts
 * Type definitions for the Ritual system.
 */

import { AbilityScoreName, DamageType } from './index'; // Correct import from core types
import { CombatCharacter } from './combat';

export type RitualInterruptType = 'damage' | 'movement' | 'condition' | 'silence' | 'distraction' | 'incapacitated';

export interface InterruptCondition {
  type: RitualInterruptType;
  threshold?: number;
  saveType?: AbilityScoreName; // e.g., 'Constitution'
  saveDC?: number;
  dcCalculation?: 'fixed' | 'damage_half' | 'damage_full'; // How DC is calculated if dynamic
}

export interface RitualConfig {
  breaksOnDamage: boolean;
  breaksOnMove: boolean;
  requiresConcentration: boolean;
  allowCooperation: boolean;
  consumptionTiming: 'start' | 'end' | 'continuous';
}

export interface RitualBacklash {
  type: 'damage' | 'condition' | 'summon' | 'environment';
  description: string;
  severity: 'minor' | 'major' | 'catastrophic';
  damageDice?: string;
}

export interface RitualState {
  id: string;
  spellId: string;
  spellName: string;
  casterId: string;
  startTime: number; // Round or GameTime
  durationTotal: number;
  durationUnit: 'rounds' | 'minutes' | 'hours';
  progress: number; // Current accumulated time/rounds
  isPaused: boolean;
  participantIds: string[];
  interruptConditions: InterruptCondition[];
  config: RitualConfig;
  backlash?: RitualBacklash[]; // Potential consequences
}

export interface InterruptResult {
  interrupted: boolean;
  ritualBroken: boolean; // True if it fails immediately, false if save is allowed
  saveRequired?: boolean;
  saveType?: AbilityScoreName;
  saveDC?: number;
  reason?: string;
}

export type RequirementType = 'time_of_day' | 'location' | 'biome' | 'weather' | 'participants_count' | 'item';

export interface RitualRequirement {
  type: RequirementType;
  value: any; // Flexible value based on type (string, number, array)
  description?: string;
}

export interface RequirementValidationResult {
  valid: boolean;
  failureReason?: string;
}

export interface RitualContext {
  currentTime?: Date | string | number; // Flexible to support Date or timestamp
  locationType?: string; // e.g., 'forest', 'temple'
  biomeId?: string;
  weather?: string;
  participantCount?: number;
}

export interface RitualEvent {
    type: RitualInterruptType;
    value?: number;
    conditionName?: string;
}
