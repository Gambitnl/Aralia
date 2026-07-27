/**
 * @file src/systems/rituals/RitualManager.ts
 * Core logic for managing ritual casting, progress tracking, and interruption.
 * "Time is part of the magic."
 */
import { CombatCharacter } from '../../types/combat';
import { RitualState, InterruptResult, RitualRequirement, RitualContext, RequirementValidationResult } from '../../types/rituals';
import { Spell } from '../../types/spells';
/**
 * Creates a new RitualState for a caster and spell.
 */
export declare function startRitual(caster: CombatCharacter, spell: Spell, currentRound: number, asRitual?: boolean): RitualState;
/**
 * Checks if a ritual can be started given the current context.
 * Wraps validateRitualRequirements for easy consumption.
 */
export declare function canStartRitual(spell: Spell, context: RitualContext): RequirementValidationResult;
/**
 * Advances the ritual progress by one round (or specified amount).
 */
export declare function advanceRitual(ritual: RitualState, amountSeconds?: number): RitualState;
/**
 * Checks if a ritual is complete.
 */
export declare function isRitualComplete(ritual: RitualState): boolean;
/**
 * Checks if an event interrupts the ritual.
 */
export declare function checkRitualInterrupt(ritual: RitualState, eventType: 'damage' | 'movement' | 'condition', value?: number, conditionName?: string): InterruptResult;
/**
 * Returns potential backlash effects if a ritual fails catastrophically.
 */
export declare function getBacklashOnFailure(_ritual: RitualState): {
    description: string;
}[];
/**
 * Validates environmental and circumstantial requirements for a ritual.
 * @param requirements List of conditions to check
 * @param context Current context (time, location, etc.)
 */
export declare function validateRitualRequirements(requirements: RitualRequirement[], context: RitualContext): RequirementValidationResult;
