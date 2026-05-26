// src/context/GlossaryContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { GlossaryEntry } from '../types';
import { fetchWithTimeout } from '../utils/networkUtils';
import { assetUrl } from '../config/env';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorOverlay } from '../components/ui/ErrorOverlay';

const GlossaryContext = createContext<GlossaryEntry[] | null>(null);

export const GlossaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const allEntries = await fetchWithTimeout<GlossaryEntry[]>(
          assetUrl('data/glossary_bundle.json'),
          { timeoutMs: 15000 }
        );

        if (!allEntries || !Array.isArray(allEntries)) {
           throw new Error("Glossary bundle is invalid or missing");
        }

        // Deduplicate
        const finalUniqueEntries = [...new Map(allEntries.map(item => [item.id, item])).values()];

        setEntries(finalUniqueEntries);
        setError(null);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to load complete glossary bundle:", errorMessage);
        setError(errorMessage);
        setEntries([]); // Degrade gracefully by providing an empty list if loading fails.
      }
    };

    fetchAllData();
  }, []);

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
