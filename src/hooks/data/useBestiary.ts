// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/06/2026, 14:53:09
 * Dependents: components/Combat/MonsterPicker.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useState } from 'react';
import { MONSTERS_DATA, loadMonstersData } from '../../data/monsters';
import type { MonsterData } from '../../types/ui';

export interface BestiaryEntry {
  name: string;
  cr: string;
  crLair?: string;
  xpLair?: number;
  type: string;
  source: string;
  raw: MonsterData;
}

// Module-level cache survives re-renders and remounts within a session.
let cachedEntries: BestiaryEntry[] | null = null;

function buildEntriesFromGeneratedRegistry(): BestiaryEntry[] {
  // CI and deployed builds do not include the ignored vendor/5etools-src tree.
  // The generated monster registry is the checked-in, reproducible runtime
  // surface produced by scripts/ingestMonsters.ts.
  return Object.values(MONSTERS_DATA)
    .map((monster) => ({
      name: monster.name,
      cr: monster.baseStats.cr ?? '0',
      type: monster.baseStats.creatureTypes?.join(', ') || 'unknown',
      source: 'generated',
      raw: monster,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useBestiary() {
  const [entries, setEntries] = useState<BestiaryEntry[]>(cachedEntries ?? []);
  const [isLoading, setIsLoading] = useState(cachedEntries === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If bestiary data has already been loaded and cached, we don't need to do
    // anything. The state is already initialized to the cached values.
    if (cachedEntries !== null) {
      return;
    }

    loadMonstersData()
      .then(() => {
        cachedEntries = buildEntriesFromGeneratedRegistry();
        setEntries(cachedEntries);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load bestiary entries:', err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });
  }, []);

  return { entries, isLoading, error };
}
