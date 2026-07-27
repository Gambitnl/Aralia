/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/06/2026, 14:49:00
 * Dependents: App.tsx, commands/effects/SummoningCommand.ts, data/adapters/runtimeMonsterRegistry.ts, hooks/data/useBestiary.ts, services/geminiServiceFallback.ts, utils/world/bestiaryEncounterGenerator.ts, utils/world/encounterUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { MonsterData } from '../types/ui';
export declare const MONSTERS_DATA: Record<string, MonsterData>;
/**
 * Dynamically loads the generated monster dataset.
 * Populates MONSTERS_DATA in-place to ensure references remain correct once loaded.
 *
 * DESIGN DECISION: Mutating MONSTERS_DATA in-place allows synchronous lookups
 * in gameplay code to proceed unchanged once background loading completes.
 */
export declare function loadMonstersData(): Promise<Record<string, MonsterData>>;
