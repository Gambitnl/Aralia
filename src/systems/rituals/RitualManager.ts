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
  RequirementValidationResult,
  RitualBacklash
} from '../../types/rituals';
import { Spell } from '../../types/spells';
import {
  ROUND_DURATION_SECONDS,
  convertSecondsToDisplayValue,
  getDisplayUnitForSeconds,
  getSpellCastingDurationSeconds
} from '../../utils/core/spellTimeUtils';
import { getTimeOfDay } from '../../utils/core';

// ============================================================================
// Ritual Runtime Display Translation
// ============================================================================
// The ritual runtime now stores canonical duration/progress in seconds. These
// helpers preserve the older display fields so unfinished UI and logs can keep
// showing rounds/minutes/hours without owning conversion rules themselves.
// ============================================================================

function buildDisplayTiming(totalSeconds: number, progressSeconds: number, preferredUnit?: Spell['castingTime']['unit']) {
  // Keep action-based spells readable in rounds and longer narrative spells readable
  // in minutes or hours while the canonical runtime math stays in seconds.
  const durationUnit = getDisplayUnitForSeconds(totalSeconds, preferredUnit);

  return {
    durationUnit,
    durationTotal: convertSecondsToDisplayValue(totalSeconds, durationUnit),
    progress: convertSecondsToDisplayValue(progressSeconds, durationUnit)
  };
}

/**
 * Reads a prose casting time such as "1 hour" or "10 minutes" into seconds.
 *
 * Spells whose header reads "Special" keep their real timing in prose. Rather
 * than let such a spell fall through to a wrong single-round ritual, the ritual
 * runtime reads the prose the spell states and returns null when it states none.
 */
export function parseSpecialCastingTimeSeconds(castingTimeSpecial?: string): number | null {
  if (!castingTimeSpecial) return null;

  const match = /(\d+(?:\.\d+)?)\s*(second|minute|hour|day|round)s?/i.exec(castingTimeSpecial);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unitSeconds: Record<string, number> = {
    second: 1,
    round: ROUND_DURATION_SECONDS,
    minute: 60,
    hour: 3600,
    day: 86400
  };

  return amount * unitSeconds[match[2].toLowerCase()];
}

/**
 * Creates a new RitualState for a caster and spell.
 */
export function startRitual(
  caster: CombatCharacter,
  spell: Spell,
  currentRound: number,
  asRitual: boolean = false
): RitualState {
  // Translate the spell header into one canonical scalar. This lets world-time
  // systems think in seconds while combat-facing UI can still derive rounds.
  let durationTotalSeconds = getSpellCastingDurationSeconds(spell, asRitual);

  // "Special" casting times carry their timing in prose rather than in the
  // structured header, so the spell now states it in `ritualData.castingTimeSpecial`
  // and the ritual runtime parses that string instead of guessing.
  if (durationTotalSeconds === null || durationTotalSeconds <= 0) {
    durationTotalSeconds = parseSpecialCastingTimeSeconds(spell.ritualData?.castingTimeSpecial);
  }

  if (durationTotalSeconds === null || durationTotalSeconds <= 0) {
    throw new Error(
      `Cannot start a ritual for "${spell.name}": its casting time is not modeled. ` +
      `Give the spell a ritualData.castingTimeSpecial value such as "1 hour".`
    );
  }

  const displayTiming = buildDisplayTiming(durationTotalSeconds, 0, spell.castingTime.unit);

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
    durationTotalSeconds,
    progressSeconds: 0,
    durationTotal: displayTiming.durationTotal,
    durationUnit: displayTiming.durationUnit,
    progress: displayTiming.progress,
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
  // Spells state their ceremony conditions in `ritualData.requirements`. A spell
  // with no block states no conditions, which is a valid start.
  const requirements: RitualRequirement[] = spell.ritualData?.requirements ?? [];

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
  amountSeconds: number = ROUND_DURATION_SECONDS
): RitualState {
  if (ritual.isPaused) return ritual;

  // Clamp against the canonical seconds-based duration, then rebuild the legacy
  // display fields so older ritual UI keeps showing the same style of values.
  const newProgressSeconds = Math.min(ritual.progressSeconds + amountSeconds, ritual.durationTotalSeconds);
  const displayTiming = {
    durationUnit: ritual.durationUnit,
    durationTotal: ritual.durationTotal,
    progress: convertSecondsToDisplayValue(newProgressSeconds, ritual.durationUnit)
  };

  return {
    ...ritual,
    progressSeconds: newProgressSeconds,
    progress: displayTiming.progress
  };
}

/**
 * Checks if a ritual is complete.
 */
export function isRitualComplete(ritual: RitualState): boolean {
  return ritual.progressSeconds >= ritual.durationTotalSeconds;
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
export function getBacklashOnFailure(
  ritual: RitualState,
  spell?: Spell
): RitualBacklash[] {
  // A backlash already recorded on the ritual state wins: it is the effect the
  // runtime committed to when the ceremony started.
  if (ritual.backlash && ritual.backlash.length > 0) {
    return ritual.backlash;
  }

  const backlash = spell?.ritualData?.backlash;
  if (!backlash) {
    return [];
  }

  // `minProgress` is the share of the ceremony that must be finished before the
  // consequence can fire, so a ritual broken in its first seconds stays harmless.
  const minProgress = backlash.minProgress ?? 0;
  const completedShare = ritual.durationTotalSeconds > 0
    ? ritual.progressSeconds / ritual.durationTotalSeconds
    : 0;

  if (completedShare < minProgress) {
    return [];
  }

  return [backlash];
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
