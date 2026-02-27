// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * DEPRECATED BRIDGE / MIDDLEMAN: Redirects to a new location. (Clean me up!)
 *
 * Last Sync: 27/02/2026, 09:33:42
 * Dependents: AbyssalMechanics.ts, ConcentrationTracker.ts, DamageCommand.ts, FeywildMechanics.ts, PlanarHazardSystem.ts, SavePenaltySystem.ts, ShadowfellMechanics.ts, StatusConditionCommand.ts, rest.ts, useActionExecutor.ts, useCombatEngine.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/character' instead.
 */
export * from './character/savingThrowUtils';
