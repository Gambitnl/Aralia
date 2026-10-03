// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 26/08/2026, 16:57:23
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/classes/classesScenarioAdapter.tsx, components/DesignPreview/steps/spells/spellsFrameworkAdapter.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/BattleMap/CombatLog.tsx
 *
 * Re-exports the canonical CombatLog component from `src/components/Combat/CombatLog.tsx`.
 *
 * This provides backward compatibility for all battle map and view components while ensuring
 * that channel filtering (All, Damage, Healing, Conditions, Spells, System) and structured
 * resistance/vulnerability/immunity badge rendering are available across the entire application.
 *
 * Called by: CombatView.tsx, BattleMapDemo.tsx, and related scenario preview tools.
 * Depends on: src/components/Combat/CombatLog.tsx
 */

export { default, CombatLog } from '../Combat/CombatLog';
export type { CombatLogProps } from '../Combat/CombatLog';
