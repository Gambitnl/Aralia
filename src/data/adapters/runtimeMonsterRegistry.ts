// @dependencies-start
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
// @dependencies-end

import { MonsterData } from '../../types/ui';
import { MONSTERS_DATA, loadMonstersData } from '../monsters';

// Module-level cache, persists for the tab's lifetime.
// Pre-seeded from build-time ingested data; expanded at runtime by MonsterPicker.
const registry = new Map<string, MonsterData>();
let isSeeded = false;

/**
 * Seeding helper. Populates the registry Map using the current contents
 * of MONSTERS_DATA if it is loaded.
 * 
 * DESIGN DECISION: Set isSeeded = true only if MONSTERS_DATA is populated,
 * allowing tests or gameplay features to register custom monsters even
 * if the full dataset hasn't finished loading yet.
 */
function ensureSeeded() {
  if (isSeeded) return;
  if (Object.keys(MONSTERS_DATA).length > 0) {
    Object.entries(MONSTERS_DATA).forEach(([key, val]) => {
      registry.set(key, val);
    });
    isSeeded = true;
  }
}

function toKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

export function getMonster(name: string): MonsterData | undefined {
  ensureSeeded();
  return registry.get(toKey(name));
}

export function registerMonster(data: MonsterData): void {
  ensureSeeded();
  registry.set(data.id, data);
}

/**
 * Force-loads the monster data asynchronously and seeds the registry.
 * Primarily useful for test environments or specific flows requiring guaranteed data.
 */
export async function ensureMonsterRegistryLoaded(): Promise<void> {
  if (isSeeded) return;
  await loadMonstersData();
  ensureSeeded();
}
