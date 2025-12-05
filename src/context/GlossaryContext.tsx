// src/context/GlossaryContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { GlossaryEntry } from '../types'; // Use GlossaryEntry from types.ts

const GlossaryContext = createContext<GlossaryEntry[] | null>(null);

export const GlossaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndProcessIndex = async (filePath: string): Promise<GlossaryEntry[]> => {
      const response = await fetch(filePath);
      if (!response.ok) {
        console.error(`Failed to fetch glossary index file: ${filePath}`);
        throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
      }
      const data = await response.json();

      // Check if it's a nested index file (like the new rules_glossary.json)
      if (data.index_files && Array.isArray(data.index_files)) {
        const promises = data.index_files.map((nestedPath: string) => fetchAndProcessIndex(`${import.meta.env.BASE_URL}${nestedPath.replace(/^\//, '')}`));
        const results = await Promise.all(promises);
        return results.flat(); // Flatten the array of arrays of entries
      } 
      // Otherwise, it's a data file containing an array of entries
      else if (Array.isArray(data)) {
        return data as GlossaryEntry[];
      }
      
      console.warn(`Glossary file at ${filePath} has an unknown or unexpected format.`);
      return [];
    };

    const fetchAllData = async () => {
      try {
        const allEntries = await fetchAndProcessIndex(`${import.meta.env.BASE_URL}data/glossary/index/main.json`);
        
        const uniqueEntriesMap = new Map<string, GlossaryEntry>();
        
        // Recursive function to traverse all entries and sub-entries for deduplication
        const addAllEntriesToMap = (entryList: GlossaryEntry[]) => {
            for (const entry of entryList) {
                if (!uniqueEntriesMap.has(entry.id)) {
                    uniqueEntriesMap.set(entry.id, entry);
                } else {
                    // This warning can be noisy if sub-entries are intentionally re-used.
                    // For now, we assume IDs should be globally unique.
                    // console.warn(`Duplicate glossary ID found during context load: ${entry.id}. Keeping first instance.`);
                }
                if (entry.subEntries) {
                    addAllEntriesToMap(entry.subEntries);
                }
            }
        }
        
        // This process of de-duplication is less critical now that files are split,
        // but it's a good safeguard. We operate on the final flat list from all sources.
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

  return (
    <GlossaryContext.Provider value={entries}>
      {children}
    </GlossaryContext.Provider>
  );
};

export default GlossaryContext;