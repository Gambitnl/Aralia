// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * DEPRECATED BRIDGE / MIDDLEMAN: Redirects to a new location. (Clean me up!)
 *
 * Last Sync: 27/02/2026, 09:32:43
 * Dependents: AISpellArbitrator.ts, AbyssalMechanics.ts, AstralMechanics.ts, BattleMapDemo.tsx, CombatReligionAdapter.ts, CombatView.tsx, CommandExecutor.ts, FeywildMechanics.ts, InfernalMechanics.ts, PlanarHazardSystem.ts, PlanarService.ts, ReactiveEffectCommand.ts, ShadowfellMechanics.ts, SpellService.ts, TempleSystem.ts, TradeRouteSystem.ts, appState.ts, combatAI.ts, core.ts, encounters.ts, geminiServiceFallback.ts, items.ts, lootService.ts, rest.ts, saveLoadService.ts, travelService.ts, useActionGeneration.ts, useSpellGateChecks.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/core' or '@/utils/core/logger' instead.
 * This file will be removed in a future version.
 *
 * Example migration:
 *   Old: import { logger } from '@/utils/logger'
 *   New: import { logger } from '@/utils/core'
 */
export * from './core/logger';
