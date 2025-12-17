
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Spell } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { fetchWithTimeout } from '../utils/networkUtils';
import { ENV, assetUrl } from '../config/env';

export type SpellDataRecord = Record<string, Spell>;

const SpellContext = createContext<SpellDataRecord | null>(null);

export const SpellProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [spellData, setSpellData] = useState<SpellDataRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    const fetchAllSpells = async () => {
      try {
        const manifest = await fetchWithTimeout<Record<string, any>>(
          assetUrl('data/spells_manifest.json'),
          { timeoutMs: 15000 }
        );

        // Why: The Vite dev server can be overwhelmed by hundreds of concurrent fetch requests.
        // We use a concurrency limit (e.g., 50) to prevent this.
        // Previously we used strict batching, but that caused head-of-line blocking.
        // Now we use a sliding window (pool) for faster total load times.
        const concurrencyLimit = 50;
        const spellEntries = Object.entries(manifest);
        const collectedIssues: string[] = [];

        const fetchSpell = async ([id, info]: [string, any]) => {
          try {
            // Ensure spell asset requests respect the configured base path
            const normalizedPath = assetUrl(String(info.path || ''));
            // Explicitly request JSON to prevent Vite from returning the index.html fallback for SPAs
            const spellJson = await fetchWithTimeout<Spell>(normalizedPath, {
              headers: { 'Accept': 'application/json' },
              timeoutMs: 10000
            });

            return { id, spell: spellJson };
          } catch (e) {
            const msg = `Error processing spell file for ${id}: ${String(e)}`;
            console.error(msg);
            collectedIssues.push(msg);
            return null;
          }
        };

        const allSpellResults = await fetchWithConcurrency(
          spellEntries,
          concurrencyLimit,
          fetchSpell,
          (completed, total) => setLoadingProgress((completed / total) * 100)
        );

        const spellResults = allSpellResults.filter(Boolean);

        const spells: SpellDataRecord = {};
        spellResults.forEach(result => {
          if (result) {
            spells[result.id] = result.spell;
          }
        });

        if (collectedIssues.length > 0) {
          console.warn(`SpellContext loaded with ${collectedIssues.length} issues. First issue: ${collectedIssues[0]}`);
          setIssues(collectedIssues);
        } else {
          setIssues([]);
        }
        if (Object.keys(spells).length === 0) {
          const msg = 'SpellContext: no spells loaded; spell selections will be empty. Check manifest paths and network.';
          console.warn(msg);
          setIssues(prev => prev.length ? prev : [msg]);
        }

        setSpellData(spells);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error("Failed to load spell data:", errorMessage);
        setError(errorMessage);
        // TODO: Fail closed on spell load errors (leave spellData null) so downstream UIs can block rather than operating on an empty map.
        setSpellData({}); // Provide empty object on error
        setIssues(prev => prev.length ? prev : [`SpellContext fatal error: ${errorMessage}`]);
      }
    };

    fetchAllSpells();
  }, []);

  if (spellData === null) {
    return <LoadingSpinner message={`Loading ancient spellbooks... ${Math.round(loadingProgress)}%`} />;
  }

  if (error) {
    return <div className="fixed inset-0 bg-red-900 text-white flex items-center justify-center p-4">Error loading spell data: {error}</div>;
  }

  return (
    <>
      {issues.length > 0 && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-amber-900/95 text-amber-50 border border-amber-500 rounded shadow-lg p-3 text-sm space-y-2">
          <div className="font-semibold">Spell load issues</div>
          <ul className="list-disc list-inside space-y-1 max-h-32 overflow-auto">
            {issues.slice(0, 3).map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
          {issues.length > 3 && (
            <div className="text-xs text-amber-100">+{issues.length - 3} more. See console for full details.</div>
          )}
        </div>
      )}
      <SpellContext.Provider value={spellData}>
        {children}
      </SpellContext.Provider>
    </>
  );
};

export default SpellContext;

/**
 * Helper function to run async tasks with a concurrency limit.
 * Efficiently processes a list of items using a pool of workers.
 */
async function fetchWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;
  let completed = 0;

  const iterator = items.entries();

  const worker = async () => {
    for (const [_, item] of iterator) {
      // No try-catch here; we expect fn to handle errors or bubble them up
      // if the caller wants to fail fast. In SpellContext, we handle errors inside fetchSpell.
      const res = await fn(item);
      results.push(res);
      completed++;
      if (onProgress) onProgress(completed, total);
    }
  };

  // Start up to 'concurrency' workers
  const workerCount = Math.min(concurrency, total);
  const workers = Array.from({ length: workerCount }, () => worker());

  await Promise.all(workers);
  return results;
}
