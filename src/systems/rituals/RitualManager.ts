/**
 * @file src/systems/rituals/RitualManager.ts
 * Logic for managing ritual casting, progress tracking, and interruptions.
 */

import { RitualState, RitualEvent, InterruptResult, InterruptCondition } from '../../types/rituals';
import { Spell, CastingTime } from '../../types/spells';
import { CombatCharacter } from '../../types/combat';

/**
 * Configuration options for starting a ritual.
 */
export interface RitualConfig {
  materialConsumptionProgress?: number; // 0.0 to 1.0 (default 1.0)
}

export class RitualManager {
  /**
   * Initializes a new ritual casting.
   * Calculates total duration (Casting Time + 10 minutes for Ritual tag).
   */
  static startRitual(
    spell: Spell,
    caster: CombatCharacter,
    participants: CombatCharacter[] = [],
    currentTime: number,
    config: RitualConfig = {}
  ): RitualState {
    if (!spell.ritual) {
      throw new Error(`Spell ${spell.name} is not a ritual.`);
    }

    const baseCastTime = this.calculateCastingTimeInMinutes(spell.castingTime);
    const totalDuration = baseCastTime + 10; // Rituals add 10 minutes

    // Calculate participant bonus: +1 DC to interruption saves per participant, max +5
    const participationBonus = Math.min(participants.length, 5);

    // Default interrupt conditions for standard D&D 5e rituals
    const defaultInterrupts: InterruptCondition[] = [
      {
        type: 'damage',
        saveToResist: {
          ability: 'Constitution',
          dcCalculation: 'damage_taken' // DC 10 or half damage
        }
      },
      {
        type: 'incapacitated' // Sleep, paralyzed, etc. immediately breaks it
      },
      {
        type: 'movement',
        threshold: 0 // Generally, you must stay in the area/maintain concentration
      },
      {
        type: 'distraction', // Any action casting another spell
      }
    ];

    // Determine when materials are consumed. Default to end (1.0).
    const consumptionThreshold = config.materialConsumptionProgress ?? 1.0;

    return {
      id: crypto.randomUUID(),
      spell,
      casterId: caster.id,
      startTime: currentTime,
      durationMinutes: totalDuration,
      progressMinutes: 0,
      participantIds: participants.map(p => p.id),
      participationBonus,
      isComplete: false,
      interrupted: false,
      interruptConditions: defaultInterrupts,
      materialsConsumed: false,
      consumptionThreshold
    };
  }

  /**
   * Advances the ritual progress by a time delta.
   * Handles material consumption if applicable.
   */
  static advanceRitual(ritual: RitualState, minutesPassed: number): RitualState {
    if (ritual.interrupted || ritual.isComplete) return ritual;

    const newProgress = ritual.progressMinutes + minutesPassed;
    const isComplete = newProgress >= ritual.durationMinutes;
    const progressPercent = newProgress / ritual.durationMinutes;

    // Check if we crossed the consumption threshold
    // We only consume if not already consumed
    let materialsConsumed = ritual.materialsConsumed;
    if (!materialsConsumed && progressPercent >= ritual.consumptionThreshold) {
      materialsConsumed = true;
    }

    return {
      ...ritual,
      progressMinutes: newProgress,
      isComplete,
      materialsConsumed
    };
  }

  /**
   * Checks if an event interrupts the ritual.
   */
  static checkInterruption(ritual: RitualState, event: RitualEvent): InterruptResult {
    // Only care if the event happened to the caster (or maybe key participants?)
    if (event.targetId !== ritual.casterId) {
      return { interrupted: false, canSave: false };
    }

    for (const condition of ritual.interruptConditions) {
      if (this.eventTriggersCondition(event, condition)) {

        // Handle Save Logic
        if (condition.saveToResist) {
          let dc = condition.saveToResist.fixedDC || 10;
          if (condition.saveToResist.dcCalculation === 'damage_taken' && event.value) {
            dc = Math.max(10, Math.floor(event.value / 2));
          }

          // Apply participation bonus by lowering the effective DC.
          // Participants help the caster maintain focus, making the save easier.
          const effectiveDC = Math.max(0, dc - ritual.participationBonus);

          return {
            interrupted: true, // It *will* interrupt unless saved
            reason: `Triggered ${condition.type}`,
            canSave: true,
            saveDC: effectiveDC,
            saveAbility: condition.saveToResist.ability
          };
        }

        return {
          interrupted: true,
          reason: `Triggered ${condition.type}`,
          canSave: false
        };
      }
    }

    return { interrupted: false, canSave: false };
  }

  /**
   * Helper to evaluate condition matching.
   */
  private static eventTriggersCondition(event: RitualEvent, condition: InterruptCondition): boolean {
    // Direct match
    if (event.type === condition.type) {
      if (condition.type === 'damage') {
        // Damage always triggers the check (for concentration-style logic)
        return true;
      }

      if (condition.type === 'movement') {
        return (event.value || 0) > (condition.threshold || 0);
      }

      if (condition.type === 'incapacitated') {
        return true;
      }

      // Generic match for other types if they are equal
      return true;
    }

    // Mapping: 'action' event -> 'distraction' condition (casting another spell is a distraction)
    if (event.type === 'action' && condition.type === 'distraction') {
      return true;
    }

    // Mapping: 'status_change' event -> 'incapacitated' condition
    // In a real system we'd check if the status IS 'Unconscious', 'Paralyzed', etc.
    if (event.type === 'status_change' && condition.type === 'incapacitated') {
       return false;
    }

    return false;
  }

  private static calculateCastingTimeInMinutes(castingTime: CastingTime): number {
    switch (castingTime.unit) {
      case 'action':
      case 'bonus_action':
      case 'reaction':
        return 0; // Negligible base time compared to 10m
      case 'minute':
        return castingTime.value;
      case 'hour':
        return castingTime.value * 60;
      default:
        return 0;
    }
  }
}
