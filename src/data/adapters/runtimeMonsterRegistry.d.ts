/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/06/2026, 14:42:02
 * Dependents: components/Combat/MonsterPicker.tsx, utils/combat/createEnemyFromMonster.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { MonsterData } from '../../types/ui';
export declare function getMonster(name: string): MonsterData | undefined;
export declare function registerMonster(data: MonsterData): void;
/**
 * Force-loads the monster data asynchronously and seeds the registry.
 * Primarily useful for test environments or specific flows requiring guaranteed data.
 */
export declare function ensureMonsterRegistryLoaded(): Promise<void>;
