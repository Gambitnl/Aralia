// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 00:55:31
 * Dependents: state/reducers/ritualReducer.ts, systems/rituals/RitualManager.ts, utils/core/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CastingTime, Spell } from '../../types/spells.js';

/**
 * This file translates spell casting-time semantics into runtime-friendly numbers.
 *
 * Aralia keeps spell source data in game-language terms such as "action", "reaction",
 * "minute", and "hour". The ritual system, gate checker, and future combat/world timers
 * still need numeric values for progress math, so this file converts those spell facts
 * into seconds and rounds without erasing the original meaning of the spell.
 *
 * Called by: RitualManager and any future runtime system that needs to move between
 * spell semantics and time math. Depends on: the core Spell/CastingTime type definitions.
 */

// ============================================================================
// Shared Spell Time Constants
// ============================================================================
// These constants define the runtime bridge between D&D time language and the
// numbers Aralia uses to progress combat and world simulation.
// ============================================================================

export const ROUND_DURATION_SECONDS = 6;
export const RITUAL_CASTING_BONUS_SECONDS = 10 * 60;

export type SpellTimeDisplayUnit = 'seconds' | 'rounds' | 'minutes' | 'hours';

export interface SpellTimeTranslation {
  semanticUnit: CastingTime['unit'];
  displayUnit: SpellTimeDisplayUnit;
  displayValue: number;
  seconds: number | null;
  rounds: number | null;
  isTriggered: boolean;
  isSpecial: boolean;
}

// ============================================================================
// Ritual Capability Helpers
// ============================================================================
// These helpers answer the yes/no ritual question without forcing callers to
// remember whether the source truth came from the explicit ritual flag or tags.
// ============================================================================

export function canSpellBeCastAsRitual(spell: Pick<Spell, 'ritual' | 'tags'>): boolean {
  // The spell corpus currently uses both a boolean flag and a tag surface.
  // We respect either so the runtime matches the spell-truth lane's current state.
  return spell.ritual === true || spell.tags?.includes('RITUAL') === true;
}

// ============================================================================
// Base Casting-Time Translation
// ============================================================================
// This section turns the semantic spell header into runtime numbers while
// preserving whether the spell is action-based, triggered, or special-case.
// ============================================================================

export function getCastingTimeTranslation(castingTime: CastingTime): SpellTimeTranslation {
  // Action-economy spell timings all consume about one combat round in real time,
  // but they still remain semantically distinct elsewhere in the game.
  if (castingTime.unit === 'action' || castingTime.unit === 'bonus_action' || castingTime.unit === 'reaction') {
    return {
      semanticUnit: castingTime.unit,
      displayUnit: 'rounds',
      displayValue: 1,
      seconds: ROUND_DURATION_SECONDS,
      rounds: 1,
      isTriggered: castingTime.unit === 'reaction',
      isSpecial: false
    };
  }

  // Narrative-scale casting times map cleanly to both seconds and combat rounds.
  if (castingTime.unit === 'minute') {
    const seconds = castingTime.value * 60;
    return {
      semanticUnit: castingTime.unit,
      displayUnit: 'minutes',
      displayValue: castingTime.value,
      seconds,
      rounds: seconds / ROUND_DURATION_SECONDS,
      isTriggered: false,
      isSpecial: false
    };
  }

  if (castingTime.unit === 'hour') {
    const seconds = castingTime.value * 60 * 60;
    return {
      semanticUnit: castingTime.unit,
      displayUnit: 'hours',
      displayValue: castingTime.value,
      seconds,
      rounds: seconds / ROUND_DURATION_SECONDS,
      isTriggered: false,
      isSpecial: false
    };
  }

  // "Special" casting times are still semantically meaningful even when the runtime
  // cannot reduce them to a clean scalar yet. If the spell already exposes a combat
  // cost, we can still translate the time math conservatively for progress systems.
  if (castingTime.unit === 'special' && castingTime.combatCost?.type) {
    return {
      semanticUnit: castingTime.unit,
      displayUnit: 'rounds',
      displayValue: 1,
      seconds: ROUND_DURATION_SECONDS,
      rounds: 1,
      isTriggered: castingTime.combatCost.type === 'reaction',
      isSpecial: true
    };
  }

  return {
    semanticUnit: castingTime.unit,
    displayUnit: 'seconds',
    displayValue: 0,
    seconds: null,
    rounds: null,
    isTriggered: false,
    isSpecial: true
  };
}

// ============================================================================
// Ritual-Aware Translation
// ============================================================================
// These helpers extend the base casting-time math with the ritual rule:
// ten extra minutes on top of the spell's normal casting time.
// ============================================================================

export function getSpellCastingDurationSeconds(
  spell: Pick<Spell, 'castingTime' | 'ritual' | 'tags'>,
  asRitual: boolean = false
): number | null {
  const base = getCastingTimeTranslation(spell.castingTime);

  if (base.seconds === null) {
    return null;
  }

  if (asRitual && canSpellBeCastAsRitual(spell)) {
    return base.seconds + RITUAL_CASTING_BONUS_SECONDS;
  }

  return base.seconds;
}

export function getSpellCastingDurationRounds(
  spell: Pick<Spell, 'castingTime' | 'ritual' | 'tags'>,
  asRitual: boolean = false
): number | null {
  const seconds = getSpellCastingDurationSeconds(spell, asRitual);
  return seconds === null ? null : seconds / ROUND_DURATION_SECONDS;
}

// ============================================================================
// Display Translation
// ============================================================================
// The ritual runtime now stores canonical progress in seconds. These helpers keep
// the older display fields alive so unfinished UI can continue rendering familiar
// round/minute/hour values without owning the conversion logic itself.
// ============================================================================

export function getDisplayUnitForSeconds(totalSeconds: number, preferredUnit?: CastingTime['unit']): SpellTimeDisplayUnit {
  // If the duration lands cleanly on hours, show hours. Otherwise prefer minutes
  // for longer ritual/narrative casts, and only fall back to rounds/seconds when
  // the duration is too short or too awkward for minute-based display.
  if (totalSeconds % 3600 === 0 && totalSeconds >= 3600) {
    return 'hours';
  }

  if (totalSeconds % 60 === 0 && totalSeconds >= 60) {
    return 'minutes';
  }

  // Once a cast runs longer than a minute but no longer lands cleanly on whole
  // minutes, show raw seconds rather than exploding the value into triple-digit rounds.
  if (totalSeconds >= 60) {
    return 'seconds';
  }

  // Action-economy casting times should keep surfacing as rounds when the total
  // duration is still at combat scale.
  if (preferredUnit === 'action' || preferredUnit === 'bonus_action' || preferredUnit === 'reaction') {
    return 'rounds';
  }

  if (totalSeconds % ROUND_DURATION_SECONDS === 0) {
    return 'rounds';
  }

  return 'seconds';
}

export function convertSecondsToDisplayValue(totalSeconds: number, unit: SpellTimeDisplayUnit): number {
  if (unit === 'hours') {
    return totalSeconds / 3600;
  }

  if (unit === 'minutes') {
    return totalSeconds / 60;
  }

  if (unit === 'rounds') {
    return totalSeconds / ROUND_DURATION_SECONDS;
  }

  return totalSeconds;
}
