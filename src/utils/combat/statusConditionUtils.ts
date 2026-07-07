// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/07/2026, 09:33:24
 * Dependents: commands/effects/StatusConditionCommand.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Shared status-condition replacement helpers.
 *
 * Spell conditions still live in two runtime mirrors: `statusEffects` for older
 * combat readers and `conditions` for newer rules-facing code. Every status
 * entry point should refresh an existing condition by name instead of appending
 * duplicate copies with different durations or metadata.
 */
import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../types/combat';

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
} {
  const { statusEffects, appliedStatus } = refreshStatusEffectsByName(
    character.statusEffects,
    incomingStatus
  );
  const { conditions, appliedCondition } = refreshConditionsByName(
    character.conditions,
    incomingCondition
  );

  return {
    character: {
      ...character,
      statusEffects,
      conditions
    },
    appliedStatus,
    appliedCondition
  };
}
