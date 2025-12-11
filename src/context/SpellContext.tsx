
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Spell } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { env } from '@/config/env';

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
        const manifestResponse = await fetch(`${env.APP.BASE_URL}data/spells_manifest.json`);
        if (!manifestResponse.ok) {
          throw new Error(`Failed to load spell manifest: ${manifestResponse.statusText}`);
        }
        const manifest = await manifestResponse.json();

        // Why: The Vite dev server can be overwhelmed by hundreds of concurrent fetch requests.
        // Batching these requests into smaller chunks (e.g., 50 at a time) prevents the
        // server from hanging during development and ensures a smoother loading experience.
        const batchSize = 50;
        const spellEntries = Object.entries(manifest);
        let allSpellResults = [];
        const totalSpells = spellEntries.length;
        const collectedIssues: string[] = [];

        for (let i = 0; i < totalSpells; i += batchSize) {
          const batch = spellEntries.slice(i, i + batchSize);
          const spellPromises = batch.map(async ([id, info]: [string, any]) => {
            try {
              // Ensure spell asset requests respect the configured base path (useful when the app is served from a subdirectory).
              const normalizedPath = `${env.APP.BASE_URL}${String(info.path || '').replace(/^\//, '')}`;
              // Explicitly request JSON to prevent Vite from returning the index.html fallback for SPAs
              const res = await fetch(normalizedPath, { headers: { 'Accept': 'application/json' } });
              if (!res.ok) {
                const msg = `Spell fetch failed: ${id} at ${normalizedPath} (${res.status} ${res.statusText})`;
                console.error(msg);
                collectedIssues.push(msg);
                return null;
              }
              const spellJson = await res.json();
              return { id, spell: spellJson };
            } catch (e) {
              const msg = `Error processing spell file for ${id}: ${String(e)}`;
              console.error(msg);
              collectedIssues.push(msg);
              return null;
            }
          });
          const batchResults = await Promise.all(spellPromises);
          allSpellResults.push(...batchResults);
          setLoadingProgress(((i + batch.length) / totalSpells) * 100);
        }

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
