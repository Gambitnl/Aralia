/**
 * @file src/systems/rituals/RitualManager.ts
 * Core logic for managing ritual casting, progress tracking, and interruption.
 * "Time is part of the magic."
 */

import { CombatCharacter } from '../../types/combat';
import { RitualState, RitualConfig, InterruptResult, InterruptCondition } from '../../types/ritual';
import { Spell } from '../../types/spells';

/**
 * Creates a new RitualState for a caster and spell.
 * @param isRitualCast - If true, adds 10 minutes (100 rounds) to the casting time per 5e rules.
 * @param configOverride - Optional configuration overrides.
 */
export function startRitual(
  caster: CombatCharacter,
  spell: Spell,
  currentRound: number,
  isRitualCast: boolean = false,
  configOverride?: Partial<RitualConfig>
): RitualState {
  const castingTime = spell.castingTime;

  // 1. Calculate Base Duration in Rounds (assuming 1 minute = 10 rounds)
  let baseDurationRounds = 0;

  if (castingTime.unit === 'action' || castingTime.unit === 'bonus_action' || castingTime.unit === 'reaction') {
    baseDurationRounds = 0; // Instant in combat terms, but for ritual logic we might treat as 0 base
  } else if (castingTime.unit === 'minute') {
    baseDurationRounds = castingTime.value * 10;
  } else if (castingTime.unit === 'hour') {
    baseDurationRounds = castingTime.value * 600; // 60 min * 10 rounds
  } else {
    // Special or unknown
    baseDurationRounds = 10; // Fallback 1 minute
  }

  // 2. Apply Ritual Extension if applicable
  // D&D 5e: Ritual casting adds 10 minutes (100 rounds) to the base time.
  // Standard casting uses base time.
  let totalDurationRounds = baseDurationRounds;
  if (isRitualCast) {
      totalDurationRounds += 100; // +10 minutes
  } else if (baseDurationRounds === 0) {
      // Instant spells shouldn't be here unless they are being cast as rituals or have long cast times.
      // If an instant spell is passed here without isRitualCast, it implies a mistake or a forced long cast.
      // We'll keep it as 0 (instant completion).
  }

  const defaultConfig: RitualConfig = {
    breaksOnDamage: true, // Most long casts require concentration-like focus
    breaksOnMove: false,  // Can usually move slowly
    requiresConcentration: true,
    allowCooperation: false,
    consumptionTiming: 'end'
  };

  const config: RitualConfig = { ...defaultConfig, ...configOverride };

  const interruptConditions: InterruptCondition[] = [
    { type: 'damage', saveType: 'Constitution', dcCalculation: 'damage_half' },
    { type: 'incapacitated' },
    { type: 'silence', threshold: 1 } // Silence breaks V component spells
  ];

  return {
    id: `${caster.id}_ritual_${Date.now()}`,
    spellId: spell.id,
    spellName: spell.name,
    casterId: caster.id,
    startTime: currentRound,
    durationTotal: totalDurationRounds,
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
  eventType: 'damage' | 'move' | 'condition',
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
    }
  }

  // Check config flags even if not in conditions list (fallback)
  if (eventType === 'move' && ritual.config.breaksOnMove) {
    return { interrupted: true, ritualBroken: true, reason: 'Moved during ritual' };
  }

  return { interrupted: false, ritualBroken: false };
}
