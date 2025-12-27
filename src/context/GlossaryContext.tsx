// src/context/GlossaryContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { GlossaryEntry } from '../types';
import { fetchWithTimeout } from '../utils/networkUtils';
import { assetUrl } from '../config/env';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorOverlay } from '../components/ui/ErrorOverlay';

const GlossaryContext = createContext<GlossaryEntry[] | null>(null);

interface GlossaryIndexFile {
  index_files: string[];
}

// Type guard to check if the response is a nested index
function isGlossaryIndexFile(data: unknown): data is GlossaryIndexFile {
  return (
    typeof data === 'object' &&
    data !== null &&
    'index_files' in data &&
    Array.isArray((data as GlossaryIndexFile).index_files)
  );
}

export const GlossaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Add specific check for empty/malformed JSON content to provide clearer error messages than generic fetch failures.
    const fetchAndProcessIndex = async (filePath: string): Promise<GlossaryEntry[]> => {
      try {
        // Use fetchWithTimeout for resilience
        const data = await fetchWithTimeout<GlossaryIndexFile | GlossaryEntry[]>(filePath);

        // Check if it's a nested index file (like the new rules_glossary.json)
        if (isGlossaryIndexFile(data)) {
          const promises = data.index_files.map((nestedPath: string) =>
            fetchAndProcessIndex(assetUrl(nestedPath))
          );
          // TODO: Switch to Promise.allSettled to allow partial glossary loading if one index file fails.
          const results = await Promise.all(promises);
          return results.flat(); // Flatten the array of arrays of entries
        }
        // Otherwise, it's a data file containing an array of entries
        else if (Array.isArray(data)) {
          return data as GlossaryEntry[];
        }

        console.warn(`Glossary file at ${filePath} has an unknown or unexpected format.`);
        return [];
      } catch (err) {
        // Rethrow with context or handle gracefully.
        // fetchWithTimeout throws NetworkError which has status info.
        console.error(`Error processing glossary file ${filePath}:`, err);
        throw err;
      }
    };

    // TODO: Implement lazy loading or pagination for glossary entries to prevent startup performance impact.
    const fetchAllData = async () => {
      try {
        const allEntries = await fetchAndProcessIndex(assetUrl('data/glossary/index/main.json'));

        // We operate on the final flat list from all sources.
        const finalUniqueEntries = [...new Map(allEntries.map(item => [item.id, item])).values()];

        setEntries(finalUniqueEntries);
        setError(null);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to load complete glossary index:", errorMessage);
        setError(errorMessage);
        setEntries([]); // Degrade gracefully by providing an empty list if loading fails.
      }
    };

    fetchAllData();
  }, []);

  if (entries === null && !error) {
    return <LoadingSpinner message="Loading archives..." />;
  }

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
