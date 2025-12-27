/**
 * @file src/systems/rituals/RitualManager.ts
 * Core logic for managing ritual casting, progress tracking, and interruption.
 * "Time is part of the magic."
 */

import { CombatCharacter, CombatAction } from '../../types/combat';
import { RitualState, RitualConfig, InterruptResult, InterruptCondition } from '../../types/ritual';
import { Spell } from '../../types/spells';

/**
 * Creates a new RitualState for a caster and spell.
 */
export function startRitual(
  caster: CombatCharacter,
  spell: Spell,
  currentRound: number,
  asRitual: boolean = false
): RitualState {
  const canBeRitual = spell.ritual || spell.tags?.includes('RITUAL');
  const castingTime = spell.castingTime;

  // 1. Calculate base casting time in rounds
  let baseRounds = 1; // Default to 1 action = negligible duration (but we track it if needed)

  if (castingTime.unit === 'action' || castingTime.unit === 'bonus_action' || castingTime.unit === 'reaction') {
    baseRounds = 0; // Instant in terms of multi-round tracking, usually
  } else if (castingTime.unit === 'minute') {
    baseRounds = castingTime.value * 10;
  } else if (castingTime.unit === 'hour') {
    baseRounds = castingTime.value * 600;
  }

  // 2. Add Ritual time if applicable (10 minutes = 100 rounds)
  // Rule: A ritual takes 10 minutes longer than the normal casting time.
  let durationRounds = baseRounds;

  if (asRitual && canBeRitual) {
    durationRounds += 100;
  }

  // Fallback: If it's 0 (instant action), but we are here, something is wrong or it's just a placeholder start.
  // If baseRounds is 0 and not ritual, maybe it's a "special" long cast.
  // Ideally, startRitual is only called for >1 round things.
  if (durationRounds === 0) durationRounds = 1;

  const config: RitualConfig = {
    breaksOnDamage: true, // Most long casts require concentration-like focus
    breaksOnMove: false,  // Can usually move slowly, but maybe restricted in future
    requiresConcentration: true,
    allowCooperation: false, // Default false unless specified
    consumptionTiming: 'end'
  };

  const interruptConditions: InterruptCondition[] = [
    { type: 'damage', saveType: 'Constitution', dcCalculation: 'damage_half' },
    { type: 'incapacitated' },
    { type: 'movement' }, // Add movement condition to default list so it can be checked
    { type: 'silence', threshold: 1 } // Silence breaks V component spells
  ];

  return {
    id: `${caster.id}_ritual_${Date.now()}`,
    spellId: spell.id,
    spellName: spell.name,
    casterId: caster.id,
    startTime: currentRound,
    durationTotal: durationRounds,
    durationUnit: 'rounds',
    progress: 0,
    isPaused: false,
    participantIds: [],
    interruptConditions,
    config
  };
}

/**
 * Advances the ritual progress by one round (or specified amount).
 */
export function advanceRitual(
  ritual: RitualState,
  amount: number = 1
): RitualState {
  if (ritual.isPaused) return ritual;

  const newProgress = Math.min(ritual.progress + amount, ritual.durationTotal);

  return {
    ...ritual,
    progress: newProgress
  };
}

/**
 * Checks if a ritual is complete.
 */
export function isRitualComplete(ritual: RitualState): boolean {
  return ritual.progress >= ritual.durationTotal;
}

/**
 * Checks if an event interrupts the ritual.
 */
export function checkRitualInterrupt(
  ritual: RitualState,
  eventType: 'damage' | 'movement' | 'condition',
  value?: number,
  conditionName?: string
): InterruptResult {

  // 1. Check incapacitation (always breaks)
  if (eventType === 'condition' && (conditionName === 'Incapacitated' || conditionName === 'Unconscious')) {
    return { interrupted: true, ritualBroken: true, reason: 'Caster incapacitated' };
  }

  // 2. Check defined conditions
  for (const cond of ritual.interruptConditions) {
    if (cond.type === eventType) {
      if (eventType === 'damage') {
        // Standard concentration check
        const damage = value || 0;
        const dc = Math.max(10, Math.floor(damage / 2));

        if (ritual.config.breaksOnDamage) {
           return {
             interrupted: true,
             ritualBroken: false, // Not broken yet, pending save
             saveRequired: true,
             saveType: cond.saveType || 'Constitution',
             saveDC: dc,
             reason: 'Taking damage'
           };
        }
      }

      if (eventType === 'movement' && ritual.config.breaksOnMove) {
        return { interrupted: true, ritualBroken: true, reason: 'Moved during ritual' };
      }
    }
  }

  return { interrupted: false, ritualBroken: false };
}

export const RitualManager = {
  startRitual,
  advanceRitual,
  isRitualComplete,
  checkInterruption: checkRitualInterrupt,
  getBacklashOnFailure: (ritual: any) => []
};
