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
/**
 * Shared status-condition replacement helpers.
 *
 * Spell conditions still live in two runtime mirrors: `statusEffects` for older
 * combat readers and `conditions` for newer rules-facing code. Every status
 * entry point should refresh an existing condition by name instead of appending
 * duplicate copies with different durations or metadata.
 */
import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../types/combat';
export declare function refreshStatusEffectsByName(existing: StatusEffect[] | undefined, incoming: StatusEffect): {
    statusEffects: StatusEffect[];
    appliedStatus: StatusEffect;
};
export declare function refreshConditionsByName(existing: ActiveCondition[] | undefined, incoming: ActiveCondition): {
    conditions: ActiveCondition[];
    appliedCondition: ActiveCondition;
};
export declare function applyRuntimeStatusCondition(character: CombatCharacter, incomingStatus: StatusEffect, incomingCondition: ActiveCondition): {
    character: CombatCharacter;
    appliedStatus: StatusEffect;
    appliedCondition: ActiveCondition;
};
