// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 03:23:13
 * Dependents: components/DesignPreview/steps/scenarioControls/repeatSavesConditionExpiryScenarioControls.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useTurnManager.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the state cleanup shared by repeated saves and condition expiry.
 *
 * The combat engine decides when a repeated save happens and whether it succeeds.
 * This helper removes every runtime record owned by the saved-against effect, while
 * the turn manager uses the duration helper to tick mirrored status and condition
 * records together. Tactical Sandbox calls these same helpers so its teaching
 * controls cannot drift away from ordinary combat cleanup.
 *
 * Called by: useCombatEngine.ts, useTurnManager.ts, and the Repeat Saves sandbox.
 * Depends on: combat character types and the canonical movement calculation.
 */

import type {
  ActiveCondition,
  CombatCharacter,
  StatusEffect,
} from '../../types/combat';
import { calculateMovementTotal } from './actionEconomyUtils';

// ============================================================================
// Source-Linked Repeat-Save Cleanup
// ============================================================================
// A successful save begins with one exact status-effect id. Its spell and caster
// links identify the structured condition and active effect that belong to the
// same application, without touching another spell carried by the same target.
// ============================================================================

export interface RepeatSaveCleanupResult {
  character: CombatCharacter;
  removedStatusEffects: number;
  removedConditions: number;
  removedActiveEffects: number;
}

function conditionBelongsToStatus(
  condition: ActiveCondition,
  status: StatusEffect,
): boolean {
  // The condition name is the common key written by StatusConditionCommand.
  // When caster or spell ownership is present, it must agree as well; this
  // prevents one caster's successful save from clearing another application.
  if (String(condition.name) !== String(status.name)) {
    return false;
  }

  if (
    status.sourceCasterId
    && condition.sourceCasterId
    && condition.sourceCasterId !== status.sourceCasterId
  ) {
    return false;
  }

  if (!status.sourceSpellId || !condition.source) {
    return true;
  }

  return condition.source === status.sourceSpellId || condition.source === status.source;
}

function refreshMovementAfterCleanup(character: CombatCharacter): CombatCharacter {
  // Conditions such as Paralyzed set speed to zero. Recalculate the live pool
  // immediately after removal so the target can move again before its next turn.
  const total = calculateMovementTotal(character);
  return {
    ...character,
    actionEconomy: {
      ...character.actionEconomy,
      movement: {
        ...character.actionEconomy.movement,
        total,
        used: Math.min(character.actionEconomy.movement.used, total),
      },
    },
  };
}

export function removeRepeatSaveLinkedEffects(
  character: CombatCharacter,
  savedStatusEffectIds: readonly string[],
): RepeatSaveCleanupResult {
  const savedIdSet = new Set(savedStatusEffectIds);
  const savedStatuses = character.statusEffects.filter(status => savedIdSet.has(status.id));

  // Unknown ids are a safe no-op. This protects callers that resolve several
  // effects in one pass while another rule has already removed one of them.
  if (savedStatuses.length === 0) {
    return {
      character,
      removedStatusEffects: 0,
      removedConditions: 0,
      removedActiveEffects: 0,
    };
  }

  const statusEffects = character.statusEffects.filter(status => !savedIdSet.has(status.id));
  const conditions = (character.conditions ?? []).filter(condition => (
    !savedStatuses.some(status => conditionBelongsToStatus(condition, status))
  ));
  const activeEffects = (character.activeEffects ?? []).filter(activeEffect => (
    !savedStatuses.some(status => (
      Boolean(status.sourceSpellId)
      && activeEffect.spellId === status.sourceSpellId
      && (!status.sourceCasterId || activeEffect.casterId === status.sourceCasterId)
    ))
  ));
  const cleanedCharacter = refreshMovementAfterCleanup({
    ...character,
    statusEffects,
    conditions,
    activeEffects,
  });

  return {
    character: cleanedCharacter,
    removedStatusEffects: character.statusEffects.length - statusEffects.length,
    removedConditions: (character.conditions ?? []).length - conditions.length,
    removedActiveEffects: (character.activeEffects ?? []).length - activeEffects.length,
  };
}

// ============================================================================
// Turn-Start Duration Ticking
// ============================================================================
// Status effects use numeric remaining rounds, while structured conditions use
// EffectDuration. Explicit until-removed effects and their permanent condition
// mirrors survive the clock; timed pairs advance together and disappear when
// either mirror reaches the expiry boundary.
// ============================================================================

export interface StatusConditionDurationAdvanceResult {
  character: CombatCharacter;
  expiredNames: string[];
}

function isTurnEndCondition(condition: ActiveCondition): boolean {
  // Target-relative turn-end conditions are advanced by the turn manager's
  // separate end-turn helper and must not also lose time at turn start.
  return condition.duration.type === 'until_end_of_current_turn'
    || condition.duration.type === 'turn_end';
}

function isPersistentCondition(condition: ActiveCondition): boolean {
  // Permanent conditions are ended by a named rule action rather than elapsed
  // turns. Prone uses this path and Stand Up removes both mirrors explicitly.
  return condition.duration.type === 'permanent';
}

export function advanceStatusConditionDurationsAtTurnStart(
  character: CombatCharacter,
): StatusConditionDurationAdvanceResult {
  const turnEndConditionNames = new Set(
    (character.conditions ?? [])
      .filter(isTurnEndCondition)
      .map(condition => String(condition.name)),
  );
  const persistentConditionNames = new Set(
    (character.conditions ?? [])
      .filter(isPersistentCondition)
      .map(condition => String(condition.name)),
  );
  const expiredStatusNames = new Set<string>();
  const tickedStatusEffects = character.statusEffects
    .map(status => (
      status.persistsUntilRemoved
        || turnEndConditionNames.has(String(status.name))
        || persistentConditionNames.has(String(status.name))
        ? status
        : { ...status, duration: status.duration - 1 }
    ))
    .filter(status => {
      const keep = status.persistsUntilRemoved
        || turnEndConditionNames.has(String(status.name))
        || persistentConditionNames.has(String(status.name))
        || status.duration > 0;
      if (!keep) {
        expiredStatusNames.add(String(status.name));
      }
      return keep;
    });

  const expiredConditionNames = new Set<string>();
  const tickedConditions = (character.conditions ?? [])
    .map(condition => (
      condition.duration.type === 'rounds' && typeof condition.duration.value === 'number'
        ? {
          ...condition,
          duration: {
            ...condition.duration,
            value: condition.duration.value - 1,
          },
        }
        : condition
    ))
    .filter(condition => {
      const keep = condition.duration.type !== 'rounds'
        || (typeof condition.duration.value === 'number' && condition.duration.value > 0);
      if (!keep) {
        expiredConditionNames.add(String(condition.name));
      }
      return keep;
    });

  const expiredNames = [...new Set([
    ...expiredStatusNames,
    ...expiredConditionNames,
  ])];
  const expiredNameSet = new Set(expiredNames);
  const synchronizedCharacter = refreshMovementAfterCleanup({
    ...character,
    statusEffects: expiredNameSet.size > 0
      ? tickedStatusEffects.filter(status => !expiredNameSet.has(String(status.name)))
      : tickedStatusEffects,
    conditions: expiredNameSet.size > 0
      ? tickedConditions.filter(condition => !expiredNameSet.has(String(condition.name)))
      : tickedConditions,
  });

  return {
    character: synchronizedCharacter,
    expiredNames,
  };
}
