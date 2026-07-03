// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 31/05/2026, 23:09:13
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/FeatSelection.tsx, components/CharacterCreator/FeatSpellPicker.tsx, components/CharacterCreator/NameAndReview.tsx, components/CharacterCreator/Race/GnomeSubraceSelection.tsx, components/CharacterCreator/Race/TieflingLegacySelection.tsx, components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/CharacterSheet/Spellbook/SpellbookTab.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/providers/AppProviders.tsx, components/providers/DataLoaderGate.tsx, utils/character/spellFilterUtils.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Spell } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorOverlay } from '../components/ui/ErrorOverlay';
import { fetchWithTimeout } from '../utils/networkUtils';
import { assetUrl } from '../config/env';

export type SpellDataRecord = Record<string, Spell>;

const SpellContext = createContext<SpellDataRecord | null>(null);

interface SpellProviderProps {
  children: ReactNode;
  /** Defers the 4 MB spell bundle until a spell-aware screen is actually open. */
  enabled?: boolean;
}

export const SpellProvider: React.FC<SpellProviderProps> = ({ children, enabled = true }) => {
  const [spellData, setSpellData] = useState<SpellDataRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled || spellData !== null) return;
    let didCancel = false;

    const fetchAllSpells = async () => {
      try {
        const bundledSpells = await fetchWithTimeout<SpellDataRecord>(
          assetUrl('data/spells_bundle.json'),
          { timeoutMs: 15000 }
        );

        if (didCancel) return;

        const collectedIssues: string[] = [];

        if (Object.keys(bundledSpells).length === 0) {
          const msg = 'SpellContext: no spells loaded; spell selections will be empty. Check manifest paths and network.';
          console.warn(msg);
          collectedIssues.push(msg);
        }

        setIssues(collectedIssues);
        setSpellData(bundledSpells);
      } catch (err) {
        if (didCancel) return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error("Failed to load spell data:", errorMessage);
        setError(errorMessage);
        // Provide empty object on error so downstream UIs can operate (or block gracefully) rather than crashing on null.
        setSpellData({});
        setIssues([`SpellContext fatal error: ${errorMessage}`]);
      }
    };

    fetchAllSpells();

    return () => {
      didCancel = true;
    };
  }, [enabled, spellData]);

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
