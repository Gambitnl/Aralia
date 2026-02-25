/**
 * @file src/types/rituals.ts
 * Defines the state and mechanics for long-duration ritual casting.
 * "Time is part of the magic."
 */
import { SavingThrowAbility } from './spells';
/**
 * Represents the current state of a ritual being cast.
 * Attached to a character (e.g., character.currentRitual).
 */
export interface RitualState {
    id: string;
    spellId: string;
    spellName: string;
    casterId: string;
    /** When the ritual started (game time or round number) */
    startTime: number;
    /** Total duration required in rounds (for combat) or minutes (for narrative) */
    durationTotal: number;
    durationUnit: 'rounds' | 'minutes' | 'hours';
    /** Current progress (same unit as durationTotal) */
    progress: number;
    /** If true, the ritual is paused but not broken */
    isPaused: boolean;
    /** Participants helping with the ritual (for group casting) */
    participantIds: string[];
    /** Conditions that will break the ritual */
    interruptConditions: InterruptCondition[];
    /** Config for the ritual */
    config: RitualConfig;
    /** If true, the ritual was interrupted and failed */
    interrupted?: boolean;
    /** The reason for the interruption */
    interruptionReason?: string;
    /** Have materials been consumed yet? */
    materialsConsumed?: boolean;
    /** Consequences for failure */
    backlash?: RitualBacklash[];
}
/**
 * Static configuration for a ritual, derived from the Spell definition.
 */
export interface RitualConfig {
    /** Does taking damage trigger a concentration check? */
    breaksOnDamage: boolean;
    /** Does moving break the ritual? */
    breaksOnMove: boolean;
    /** Can the caster take other actions (e.g., bonus actions) without breaking? */
    requiresConcentration: boolean;
    /** Can others join to speed it up? */
    allowCooperation: boolean;
    /** Materials consumed per turn/minute vs at end */
    consumptionTiming: 'start' | 'end' | 'continuous';
    /** Progress point (0.0 - 1.0) where materials are consumed. Default 1.0 (end) or 0.0 (start) */
    consumptionThreshold?: number;
}
/**
 * Condition that can interrupt a ritual.
 */
export interface InterruptCondition {
    type: 'damage' | 'movement' | 'silence' | 'incapacitated' | 'action' | 'noise' | 'distraction';
    /** Minimum damage/movement to trigger check */
    threshold?: number;
    /** If set, caster can save to maintain ritual */
    saveType?: SavingThrowAbility;
    /** Fixed DC or calculated? */
    dcCalculation?: 'damage_half' | 'fixed_10' | 'custom' | 'damage_taken';
    /** Fixed DC value if calculation is fixed */
    fixedDC?: number;
}
/**
 * Result of checking a ritual interrupt event.
 */
export interface InterruptResult {
    interrupted: boolean;
    ritualBroken: boolean;
    reason?: string;
    saveRequired?: boolean;
    saveType?: string;
    saveDC?: number;
}
/**
 * Valid environmental or temporal conditions for starting a ritual.
 */
export interface RitualRequirement {
    type: 'time_of_day' | 'location' | 'biome' | 'weather' | 'participants_count' | 'custom';
    value: string | number | string[];
    description?: string;
}
/**
 * Context provided to validate ritual requirements.
 */
export interface RitualContext {
    currentTime?: Date;
    locationId?: string;
    locationType?: 'indoors' | 'outdoors' | 'underground';
    biomeId?: string;
    weather?: string;
    participantCount?: number;
}
/**
 * Result of a requirement validation.
 */
export interface RequirementValidationResult {
    valid: boolean;
    failureReason?: string;
}
/**
 * Defines the consequences if a ritual is interrupted or fails.
 */
export interface RitualBacklash {
    type: 'damage' | 'status' | 'summon' | 'area_damage' | 'drain_slot';
    value: string;
    damageType?: string;
    radius?: number;
    saveDC?: number;
    minProgress?: number;
    description: string;
}
