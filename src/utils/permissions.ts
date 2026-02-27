// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * DEPRECATED BRIDGE / MIDDLEMAN: Redirects to a new location. (Clean me up!)
 *
 * Last Sync: 27/02/2026, 09:33:09
 * Dependents: App.tsx, BattleMapDemo.tsx, CombatView.tsx, GameModals.tsx, MainMenu.tsx, SystemMenu.tsx, appState.ts, handleSystemAndUi.ts, initialState.ts, useActionGeneration.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/core' or '@/utils/core/permissions' instead.
 * This file will be removed in a future version.
 */
export * from './core/permissions';
