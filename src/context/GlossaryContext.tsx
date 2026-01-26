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
    // This function fetches and processes glossary index files recursively
    // It handles both nested index files (which reference other files) and data files (which contain actual glossary entries)
    const fetchAndProcessIndex = async (filePath: string): Promise<GlossaryEntry[]> => {
      try {
        // Use fetchWithTimeout for resilience - this handles network timeouts and connection issues
        const data = await fetchWithTimeout<GlossaryIndexFile | GlossaryEntry[]>(filePath);

        // Validate that we actually received data (not null, undefined, or empty string)
        if (data === null || data === undefined) {
          throw new Error(`Glossary file at ${filePath} is empty or contains no valid JSON data`);
        }

        // Validate that the data is an object or array (valid JSON structure)
        if (typeof data !== 'object') {
          throw new Error(`Glossary file at ${filePath} contains invalid JSON: expected object or array, got ${typeof data}`);
        }

        // Check if it's a nested index file (like the new rules_glossary.json)
        // These files contain an "index_files" property that lists other files to load
        if (isGlossaryIndexFile(data)) {
          // Validate that the index_files array is not empty
          if (data.index_files.length === 0) {
            throw new Error(`Glossary index file at ${filePath} has an empty "index_files" array - no glossary data to load`);
          }

          // Load all the nested index files recursively
          const promises = data.index_files.map((nestedPath: string) =>
            fetchAndProcessIndex(assetUrl(nestedPath))
          );
          // TODO: Switch to Promise.allSettled to allow partial glossary loading if one index file fails.
          const results = await Promise.all(promises);
          return results.flat(); // Flatten the array of arrays of entries
        }
        // Otherwise, it's a data file containing an array of glossary entries
        else if (Array.isArray(data)) {
          // Validate that the array is not empty
          if (data.length === 0) {
            console.warn(`Glossary file at ${filePath} contains an empty array - no entries to load`);
            return [];
          }

          // Validate that array elements have the expected structure (basic check for "id" property)
          const invalidEntries = data.filter(entry => !entry || typeof entry !== 'object' || !('id' in entry));
          if (invalidEntries.length > 0) {
            throw new Error(`Glossary file at ${filePath} contains ${invalidEntries.length} malformed entries (missing required "id" property)`);
          }

          return data as GlossaryEntry[];
        }

        // If we reach here, the JSON structure doesn't match either expected format
        throw new Error(`Glossary file at ${filePath} has an unknown format: expected either an index file with "index_files" property or an array of entries`);
      } catch (err) {
        // Enhance error messages to be more helpful for debugging
        // fetchWithTimeout throws NetworkError which has status info
        if (err instanceof Error) {
          // If this is already our custom error message, just rethrow it
          if (err.message.includes('Glossary file at')) {
            throw err;
          }
          // Otherwise, wrap the error with context about which file failed
          throw new Error(`Error processing glossary file ${filePath}: ${err.message}`);
        }
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
