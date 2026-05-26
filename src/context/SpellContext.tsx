
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Spell } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorOverlay } from '../components/ui/ErrorOverlay';
import { fetchWithTimeout } from '../utils/networkUtils';
// TODO(lint-intent): 'ENV' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { ENV as _ENV, assetUrl } from '../config/env';

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
        const bundledSpells = await fetchWithTimeout<SpellDataRecord>(
          assetUrl('data/spells_bundle.json'),
          { timeoutMs: 15000 }
        );

        const collectedIssues: string[] = [];

        if (Object.keys(bundledSpells).length === 0) {
          const msg = 'SpellContext: no spells loaded; spell selections will be empty. Check manifest paths and network.';
          console.warn(msg);
          collectedIssues.push(msg);
        }

        setIssues(collectedIssues);
        setSpellData(bundledSpells);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error("Failed to load spell data:", errorMessage);
        setError(errorMessage);
        // Provide empty object on error so downstream UIs can operate (or block gracefully) rather than crashing on null.
        setSpellData({});
        setIssues([`SpellContext fatal error: ${errorMessage}`]);
      }
    };

    fetchAllSpells();
  }, []);

  if (error) {
    return <ErrorOverlay message={error} />;
  }

  return (
    <>
      {issues.length > 0 && (
        <div className="fixed top-4 right-4 z-[var(--z-index-modal-background)] max-w-md bg-amber-900/95 text-amber-50 border border-amber-500 rounded shadow-lg p-3 text-sm space-y-2">
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
