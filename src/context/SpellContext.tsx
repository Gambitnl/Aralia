
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Spell } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

export type SpellDataRecord = Record<string, Spell>;

const SpellContext = createContext<SpellDataRecord | null>(null);

export const SpellProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [spellData, setSpellData] = useState<SpellDataRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const fetchAllSpells = async () => {
      try {
        const manifestResponse = await fetch(`${import.meta.env.BASE_URL}data/spells_manifest.json`);
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

        for (let i = 0; i < totalSpells; i += batchSize) {
            const batch = spellEntries.slice(i, i + batchSize);
            const spellPromises = batch.map(async ([id, info]: [string, any]) => {
                try {
                    const res = await fetch(info.path);
                    if (!res.ok) {
                        console.error(`Failed to fetch spell: ${id} at ${info.path}`);
                        return null;
                    }
                    const spellJson = await res.json();
                    return { id, spell: spellJson };
                } catch (e) {
                    console.error(`Error processing spell file for ${id}:`, e);
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

        setSpellData(spells);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error("Failed to load spell data:", errorMessage);
        setError(errorMessage);
        setSpellData({}); // Provide empty object on error
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
    <SpellContext.Provider value={spellData}>
      {children}
    </SpellContext.Provider>
  );
};

export default SpellContext;