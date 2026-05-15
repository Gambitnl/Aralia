import { useEffect, useState } from 'react';
import { MONSTERS_DATA } from '../../data/monsters';
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
  const [entries, setEntries] = useState<BestiaryEntry[]>(cachedEntries ?? buildEntriesFromGeneratedRegistry());
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (cachedEntries !== null) return;
    cachedEntries = buildEntriesFromGeneratedRegistry();
    setEntries(cachedEntries);
  }, []);

  return { entries, isLoading, error };
}
