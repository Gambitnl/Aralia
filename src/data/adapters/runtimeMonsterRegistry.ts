// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 16:27:40
 * Dependents: components/Combat/MonsterPicker.tsx, systems/combat/startBattleMapEncounter.ts, systems/worldforge/dungeon/world/dungeonCombat.ts, utils/combat/createEnemyFromMonster.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { MonsterData } from '../../types/ui';
import { MONSTERS_DATA, loadMonstersData } from '../monsters';

// Runtime registrations are tab-local overrides. The existing MONSTERS_DATA
// object remains the catalog owner and expands in place when its lazy loader
// finishes. Reading it directly avoids freezing a partial authored catalog
// into a second snapshot before ingested creatures have arrived.
const registry = new Map<string, MonsterData>();

function toKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

export function getMonster(name: string): MonsterData | undefined {
  const key = toKey(name);
  return registry.get(key) ?? (Object.hasOwn(MONSTERS_DATA, key) ? MONSTERS_DATA[key] : undefined);
}

export function registerMonster(data: MonsterData): void {
  registry.set(data.id, data);
}

/**
 * Wait for the existing lazy catalog loader, even after a partial cold read.
 * Its shared promise owns readiness; an authored or registered creature does
 * not mean every creature is loaded. Runtime overrides keep precedence.
 */
export async function ensureMonsterRegistryLoaded(): Promise<void> {
  await loadMonstersData();
}
