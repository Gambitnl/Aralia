import { useState, useEffect } from 'react';

export interface BestiaryEntry {
  name: string;
  cr: string;
  crLair?: string;
  xpLair?: number;
  type: string;
  source: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

// Module-level cache — survives re-renders and remounts within a session
let cachedEntries: BestiaryEntry[] | null = null;

function parseCr(cr: unknown): string {
  if (typeof cr === 'string') return cr;
  if (cr && typeof cr === 'object' && 'cr' in cr) return String((cr as { cr: unknown }).cr);
  return '0';
}

function parseCrLair(cr: unknown): string | undefined {
  if (cr && typeof cr === 'object' && 'lair' in cr) return String((cr as { lair: unknown }).lair);
  return undefined;
}

function parseXpLair(cr: unknown): number | undefined {
  if (cr && typeof cr === 'object' && 'xpLair' in cr) return Number((cr as { xpLair: unknown }).xpLair);
  return undefined;
}

function parseType(type: unknown): string {
  if (typeof type === 'string') return type;
  if (type && typeof type === 'object' && 'type' in type) return String((type as { type: unknown }).type);
  return 'unknown';
}

export function useBestiary() {
  const [entries, setEntries] = useState<BestiaryEntry[]>(cachedEntries ?? []);
  const [isLoading, setIsLoading] = useState(cachedEntries === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedEntries !== null) return;

    // Dynamic import — Vite creates a lazy chunk (~1.2 MB, cached after first load)
    import('../../../vendor/5etools-src/data/bestiary/bestiary-xmm.json')
      .then(({ default: data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monsters = (data as any).monster as any[];
        cachedEntries = monsters.map(m => ({
          name: m.name as string,
          cr: parseCr(m.cr),
          crLair: parseCrLair(m.cr),
          xpLair: parseXpLair(m.cr),
          type: parseType(m.type),
          source: (m.source as string) ?? 'XMM',
          raw: m,
        }));
        setEntries(cachedEntries);
        setIsLoading(false);
      })
      .catch(err => {
        setError((err as Error).message);
        setIsLoading(false);
      });
  }, []);

  return { entries, isLoading, error };
}
