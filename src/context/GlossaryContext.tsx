// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 31/05/2026, 23:09:13
 * Dependents: components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/DesignPreview/steps/GlossaryRedirectSurfacesPanel.tsx, components/DesignPreview/steps/PreviewGlossaryRedirectSurfaces.tsx, components/DesignPreview/steps/PreviewSpellGlossary.tsx, components/Glossary/Glossary.tsx, components/Glossary/GlossaryContentRenderer.tsx, components/Glossary/GlossaryTooltip.tsx, components/Glossary/SingleGlossaryEntryModal.tsx, components/WorldPane.tsx, components/providers/AppProviders.tsx, components/providers/DataLoaderGate.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// src/context/GlossaryContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { GlossaryEntry } from '../types';
import { fetchWithTimeout } from '../utils/networkUtils';
import { assetUrl } from '../config/env';
import { ErrorOverlay } from '../components/ui/ErrorOverlay';

const GlossaryContext = createContext<GlossaryEntry[] | null>(null);

interface GlossaryProviderProps {
  children: ReactNode;
  /** Defers the glossary search bundle until the glossary or game shell needs it. */
  enabled?: boolean;
}

export const GlossaryProvider: React.FC<GlossaryProviderProps> = ({ children, enabled = true }) => {
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || entries !== null) return;
    let didCancel = false;

    const fetchAllData = async () => {
      try {
        const allEntries = await fetchWithTimeout<GlossaryEntry[]>(
          assetUrl('data/glossary_bundle.json'),
          { timeoutMs: 15000 }
        );

        if (didCancel) return;

        if (!allEntries || !Array.isArray(allEntries)) {
           throw new Error("Glossary bundle is invalid or missing");
        }

        // Deduplicate
        const finalUniqueEntries = [...new Map(allEntries.map(item => [item.id, item])).values()];

        setEntries(finalUniqueEntries);
        setError(null);

      } catch (err) {
        if (didCancel) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to load complete glossary bundle:", errorMessage);
        setError(errorMessage);
        setEntries([]); // Degrade gracefully by providing an empty list if loading fails.
      }
    };

    fetchAllData();

    return () => {
      didCancel = true;
    };
  }, [enabled, entries]);

  if (error) {
    return <ErrorOverlay message={error} />;
  }

  return (
    <GlossaryContext.Provider value={entries}>
      {children}
    </GlossaryContext.Provider>
  );
};

export default GlossaryContext;
