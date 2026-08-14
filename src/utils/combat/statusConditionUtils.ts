// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/08/2026, 16:15:58
 * Dependents: commands/effects/StatusConditionCommand.ts, components/DesignPreview/steps/raceDomain/leaves/autumnEladrinRaceLeaf.tsx, components/DesignPreview/steps/scenarioControls/conditionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/grappleEscapeScenarioControls.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useTurnManager.ts, systems/combat/fallingGroundImpactResolution.ts, utils/combat/grappleUtils.ts, utils/combat/shoveUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file keeps Aralia's two runtime condition records synchronized.
 *
 * Combat still stores each condition twice: `statusEffects` supplies badges and
 * older readers, while `conditions` supplies the current mechanical rules. The
 * helpers below apply, replace, remove, and expire those records as one change.
 * Ownership is source-aware, so two independent effects with the same condition
 * name can coexist and ending one cannot silently end the other.
 *
 * Called by: combat commands, turn-boundary processing, and deterministic scenario adapters.
 * Depends on: combat character types and canonical movement calculation.
 */
import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../types/combat';
import { calculateMovementTotal } from './actionEconomyUtils';

// ============================================================================
// Ownership Matching
// ============================================================================
// A condition has no standalone id, so its source name/spell and source actor
// form the durable ownership key. Legacy records without ownership retain the
// previous name-only replacement behavior instead of becoming unremovable.
// ============================================================================

function sourceValues(status: StatusEffect): Set<string> {
  return new Set([status.source, status.sourceSpellId].filter((value): value is string => Boolean(value)));
}

function conditionsShareOwner(
  existing: ActiveCondition,
  incoming: ActiveCondition,
): boolean {
  if (existing.name !== incoming.name) return false;

  const existingHasOwner = Boolean(existing.source || existing.sourceCasterId);
  const incomingHasOwner = Boolean(incoming.source || incoming.sourceCasterId);
  if (!existingHasOwner && !incomingHasOwner) return true;

  return existing.source === incoming.source
    && existing.sourceCasterId === incoming.sourceCasterId;
}

function statusesShareOwner(
  existing: StatusEffect,
  incoming: StatusEffect,
): boolean {
  if (existing.name !== incoming.name) return false;
  if (existing.id === incoming.id) return true;

  const existingSources = sourceValues(existing);
  const incomingSources = sourceValues(incoming);
  const existingHasOwner = existingSources.size > 0 || Boolean(existing.sourceCasterId);
  const incomingHasOwner = incomingSources.size > 0 || Boolean(incoming.sourceCasterId);
  if (!existingHasOwner && !incomingHasOwner) return true;

  const sharesSource = [...existingSources].some(source => incomingSources.has(source));
  return sharesSource && existing.sourceCasterId === incoming.sourceCasterId;
}

function conditionBelongsToStatus(
  condition: ActiveCondition,
  status: StatusEffect,
): boolean {
  if (condition.name !== status.name) return false;

  const statusSources = sourceValues(status);
  const conditionHasOwner = Boolean(condition.source || condition.sourceCasterId);
  const statusHasOwner = statusSources.size > 0 || Boolean(status.sourceCasterId);
  if (!conditionHasOwner && !statusHasOwner) return true;

  return Boolean(condition.source && statusSources.has(condition.source))
    && condition.sourceCasterId === status.sourceCasterId;
}

function refreshMovement(character: CombatCharacter): CombatCharacter {
  // Restrained, Grappled, Paralyzed, Petrified, Stunned, and Unconscious can
  // change speed immediately. Keep the visible movement pool synchronized at
  // the same atomic boundary as the paired condition records.
  const total = calculateMovementTotal(character);
  const used = Math.min(character.actionEconomy.movement.used, total);
  if (
    character.actionEconomy.movement.total === total
    && character.actionEconomy.movement.used === used
  ) {
    return character;
  }

  return {
    ...character,
    actionEconomy: {
      ...character.actionEconomy,
      movement: { ...character.actionEconomy.movement, total, used },
    },
  };
}

function recordsMatch(left: unknown, right: unknown): boolean {
  // Runtime condition records are small data-only objects. Structural equality
  // lets a stable replay return the original character instead of publishing a
  // second indistinguishable combat transition.
  return JSON.stringify(left) === JSON.stringify(right);
}

// ============================================================================
// Legacy Name-Only Refresh Helpers
// ============================================================================
// StatusConditionCommand still calls these directly for legacy spell payloads.
// Their established name-only contract remains available while the paired API
// below uses source-aware ownership for new canonical transactions.
// ============================================================================

export function refreshStatusEffectsByName(
  existing: StatusEffect[] | undefined,
  incoming: StatusEffect
): { statusEffects: StatusEffect[]; appliedStatus: StatusEffect } {
  const statusEffects = existing ? [...existing] : [];
  const matchIndex = statusEffects.findIndex(effect => effect.name === incoming.name);
  const appliedStatus = matchIndex >= 0
    ? { ...incoming, id: statusEffects[matchIndex].id }
    : incoming;

  if (matchIndex >= 0) {
    statusEffects[matchIndex] = appliedStatus;
  } else {
    statusEffects.push(appliedStatus);
  }

  return { statusEffects, appliedStatus };
}

export function refreshConditionsByName(
  existing: ActiveCondition[] | undefined,
  incoming: ActiveCondition
): { conditions: ActiveCondition[]; appliedCondition: ActiveCondition } {
  const conditions = existing ? [...existing] : [];
  const matchIndex = conditions.findIndex(condition => condition.name === incoming.name);

  if (matchIndex >= 0) {
    conditions[matchIndex] = incoming;
  } else {
    conditions.push(incoming);
  }

  return { conditions, appliedCondition: incoming };
}

export function applyRuntimeStatusCondition(
  character: CombatCharacter,
  incomingStatus: StatusEffect,
  incomingCondition: ActiveCondition
): {
  character: CombatCharacter;
  appliedStatus: StatusEffect;
  appliedCondition: ActiveCondition;
  outcome: 'applied' | 'replaced' | 'unchanged';
} {
  const statusEffects = [...character.statusEffects];
  const conditions = [...(character.conditions ?? [])];
  const statusIndex = statusEffects.findIndex(status => statusesShareOwner(status, incomingStatus));
  const conditionIndex = conditions.findIndex(condition => conditionsShareOwner(condition, incomingCondition));
  const appliedStatus = statusIndex >= 0
    ? { ...incomingStatus, id: statusEffects[statusIndex].id }
    : incomingStatus;
  const appliedCondition = incomingCondition;
  const existingStatus = statusIndex >= 0 ? statusEffects[statusIndex] : undefined;
  const existingCondition = conditionIndex >= 0 ? conditions[conditionIndex] : undefined;

  // An identical replay is a true no-op. Returning the original character is
  // important to event consumers that use object identity to suppress repeats.
  if (
    existingStatus
    && existingCondition
    && recordsMatch(existingStatus, appliedStatus)
    && recordsMatch(existingCondition, appliedCondition)
  ) {
    return {
      character,
      appliedStatus: existingStatus,
      appliedCondition: existingCondition,
      outcome: 'unchanged',
    };
  }

  if (statusIndex >= 0) statusEffects[statusIndex] = appliedStatus;
  else statusEffects.push(appliedStatus);

  if (conditionIndex >= 0) conditions[conditionIndex] = appliedCondition;
  else conditions.push(appliedCondition);

  const nextCharacter = refreshMovement({ ...character, statusEffects, conditions });

  return {
    character: nextCharacter,
    appliedStatus,
    appliedCondition,
    outcome: statusIndex >= 0 || conditionIndex >= 0 ? 'replaced' : 'applied',
  };
}

// ============================================================================
// Exact Paired Removal
// ============================================================================
// Callers pass the owned status record they intend to end. Both mirrors are
// removed by that ownership key, while same-named records from another source
// and every unrelated condition remain untouched.
// ============================================================================

export interface RuntimeStatusConditionRemovalResult {
  character: CombatCharacter;
  removedStatusEffects: number;
  removedConditions: number;
}

export function removeRuntimeStatusCondition(
  character: CombatCharacter,
  ownedStatus: StatusEffect,
): RuntimeStatusConditionRemovalResult {
  const statusEffects = character.statusEffects.filter(status => !statusesShareOwner(status, ownedStatus));
  const conditions = (character.conditions ?? []).filter(condition => !conditionBelongsToStatus(condition, ownedStatus));
  const removedStatusEffects = character.statusEffects.length - statusEffects.length;
  const removedConditions = (character.conditions ?? []).length - conditions.length;

  if (removedStatusEffects === 0 && removedConditions === 0) {
    return { character, removedStatusEffects, removedConditions };
  }

  return {
    character: refreshMovement({ ...character, statusEffects, conditions }),
    removedStatusEffects,
    removedConditions,
  };
}

export function removeRuntimeStatusConditionsFromSource(
  character: CombatCharacter,
  sourceCasterId: string,
): RuntimeStatusConditionRemovalResult {
  // The caller owns the rule that source loss ends these effects. This helper
  // performs only exact source cleanup; it never assumes every source-linked
  // spell ends when its caster leaves combat.
  const ownedStatuses = character.statusEffects.filter(status => status.sourceCasterId === sourceCasterId);
  let result: RuntimeStatusConditionRemovalResult = {
    character,
    removedStatusEffects: 0,
    removedConditions: 0,
  };

  for (const status of ownedStatuses) {
    const removal = removeRuntimeStatusCondition(result.character, status);
    result = {
      character: removal.character,
      removedStatusEffects: result.removedStatusEffects + removal.removedStatusEffects,
      removedConditions: result.removedConditions + removal.removedConditions,
    };
  }

  return result;
}

// ============================================================================
// Target Turn-End Expiry
// ============================================================================
// Each affected-creature turn end advances a turn-relative condition once. An
// expiring record removes only its owned badge; another source's same-named
// condition survives and continues to supply the mechanic.
// ============================================================================

export interface RuntimeConditionTurnEndResult {
  character: CombatCharacter;
  expiredNames: string[];
}

function isTurnBoundaryCondition(condition: ActiveCondition): boolean {
  return condition.duration.type === 'until_end_of_current_turn'
    || condition.duration.type === 'turn_end';
}

export function advanceRuntimeStatusConditionsAtTurnEnd(
  character: CombatCharacter,
): RuntimeConditionTurnEndResult {
  const expiredConditions: ActiveCondition[] = [];
  let changed = false;
  const conditions = (character.conditions ?? []).flatMap(condition => {
    if (!isTurnBoundaryCondition(condition)) return [condition];

    const remaining = condition.turnEndEventsRemaining ?? 1;
    changed = true;
    if (remaining <= 1) {
      expiredConditions.push(condition);
      return [];
    }

    return [{ ...condition, turnEndEventsRemaining: remaining - 1 }];
  });

  if (!changed) return { character, expiredNames: [] };

  const statusEffects = character.statusEffects.filter(status => (
    !expiredConditions.some(condition => conditionBelongsToStatus(condition, status))
  ));
  const nextCharacter = refreshMovement({ ...character, conditions, statusEffects });

  return {
    character: nextCharacter,
    expiredNames: [...new Set(expiredConditions.map(condition => String(condition.name)))],
  };
}
