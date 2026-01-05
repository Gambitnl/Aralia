/**
 * @file src/systems/rituals/RitualManager.ts
 * Core logic for managing ritual casting, progress tracking, and interruption.
 * "Time is part of the magic."
 */

import { CombatCharacter } from '../../types/combat';
import {
  RitualState,
  RitualConfig,
  InterruptResult,
  InterruptCondition,
  RitualRequirement,
  RitualContext,
  RequirementValidationResult
} from '../../types/rituals';
import { Spell } from '../../types/spells';
// TODO(lint-intent): 'TimeOfDay' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { TimeOfDay as _TimeOfDay, getTimeOfDay } from '../../utils/timeUtils';

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
 * Checks if a ritual can be started given the current context.
 * Wraps validateRitualRequirements for easy consumption.
 */
export function canStartRitual(
  spell: Spell,
  context: RitualContext
): RequirementValidationResult {
  // If spell has no specific requirements property (yet), we assume it's valid.
  // In a real implementation, we'd check `spell.ritualRequirements`.
  // Since `Spell` type might not have `ritualRequirements` yet, this is future-proofing.
  // TODO(2026-01-03 pass 4 Codex-CLI): ritualRequirements cast placeholder until spells carry explicit ritual requirement schema.
  const requirements: RitualRequirement[] = ((spell as unknown as { ritualRequirements?: RitualRequirement[] }).ritualRequirements) || [];

  if (requirements.length === 0) {
    return { valid: true };
  }

  return validateRitualRequirements(requirements, context);
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

/**
 * Returns potential backlash effects if a ritual fails catastrophically.
 */
// TODO(lint-intent): 'ritual' is an unused parameter, which suggests a planned input for this flow.
// TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
// TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
export function getBacklashOnFailure(_ritual: RitualState): { description: string }[] {
    // Placeholder logic for wild magic or ritual backlash
    // Could depend on spell level, ritual type, etc.
    // TODO(Ritualist): Implement full RitualBacklash evaluation based on ritual.backlash definitions
    return [];
}

/**
 * Validates environmental and circumstantial requirements for a ritual.
 * @param requirements List of conditions to check
 * @param context Current context (time, location, etc.)
 */
export function validateRitualRequirements(
  requirements: RitualRequirement[],
  context: RitualContext
): RequirementValidationResult {
  for (const req of requirements) {
    switch (req.type) {
      case 'time_of_day': {
        if (!context.currentTime) {
          // If time isn't provided but required, strict validation fails,
          // but loosely we might skip. Let's fail safe.
          return { valid: false, failureReason: 'Current time not known' };
        }

        const currentTOD = getTimeOfDay(context.currentTime);
        const requiredTOD = req.value;

        // Support array of allowed times or single string
        const allowedTimes = Array.isArray(requiredTOD) ? requiredTOD : [requiredTOD];

        // Normalize strings to match Enum values if needed (TimeOfDay keys are strings)
        if (!allowedTimes.includes(currentTOD)) {
          return {
            valid: false,
            failureReason: req.description || `Ritual must be performed during: ${allowedTimes.join(', ')}`
          };
        }
        break;
      }

      case 'location': {
        const currentLocation = context.locationType || 'unknown';
        const allowedLocations = Array.isArray(req.value) ? req.value : [req.value];

        if (!allowedLocations.includes(currentLocation)) {
             return {
            valid: false,
            failureReason: req.description || `Incorrect location type. Requires: ${allowedLocations.join(', ')}`
          };
        }
        break;
      }

      case 'biome': {
         const currentBiome = context.biomeId;
         const requiredBiomes = Array.isArray(req.value) ? req.value : [req.value];

         if (!currentBiome || !requiredBiomes.includes(currentBiome)) {
            return {
              valid: false,
              failureReason: req.description || `Wrong environment. Requires: ${requiredBiomes.join(', ')}`
            };
         }
         break;
      }

      case 'weather': {
        const currentWeather = context.weather;
        const requiredWeather = Array.isArray(req.value) ? req.value : [req.value];

        if (!currentWeather || !requiredWeather.includes(currentWeather)) {
           return {
              valid: false,
              failureReason: req.description || `Weather unsuitable. Requires: ${requiredWeather.join(', ')}`
            };
        }
        break;
      }

      case 'participants_count': {
        const count = context.participantCount || 0;
        const minRequired = Number(req.value);

        if (count < minRequired) {
           return {
              valid: false,
              failureReason: req.description || `Not enough participants. Requires: ${minRequired}`
            };
        }
        break;
      }
    }
  }

  return { valid: true };
}
