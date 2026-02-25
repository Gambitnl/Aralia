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
}
/**
 * Condition that can interrupt a ritual.
 */
export interface InterruptCondition {
    type: 'damage' | 'movement' | 'silence' | 'incapacitated' | 'action';
    /** Minimum damage/movement to trigger check */
    threshold?: number;
    /** If set, caster can save to maintain ritual */
    saveType?: 'Constitution' | 'Intelligence' | 'Wisdom';
    /** Fixed DC or calculated? */
    dcCalculation?: 'damage_half' | 'fixed_10' | 'custom';
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
