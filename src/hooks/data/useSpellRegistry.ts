import { useState, useEffect } from 'react';
import { Spell } from '../../types/spells';

export function useSpellRegistry() {
  const [manifest, setManifest] = useState<Record<string, any> | null>(null);
  const [registry, setRegistry] = useState<Map<string, Spell>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/spells_manifest.json`)
      .then(res => res.json())
      .then(data => {
        setManifest(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load spell manifest', err);
        setIsLoading(false);
      });
  }, []);

  const lookup = async (name: string): Promise<Spell | undefined> => {
    if (!manifest) return undefined;
    const lowerName = name.toLowerCase();
    
    // Exact match in registry cache
    if (registry.has(lowerName)) return registry.get(lowerName);

    // Find in manifest
    const entry = Object.values(manifest).find((e: any) => 
      e.name.toLowerCase() === lowerName || 
      (e.aliases && e.aliases.some((a: string) => a.toLowerCase() === lowerName))
    );

    if (entry && entry.path) {
      try {
        const basePath = entry.path.startsWith('/') ? `${import.meta.env.BASE_URL}${entry.path.slice(1)}` : entry.path;
      const res = await fetch(basePath);
        const spell = await res.json() as Spell;
        setRegistry(prev => {
          const next = new Map(prev);
          next.set(lowerName, spell);
          return next;
        });
        return spell;
      } catch (err) {
        console.error(`Failed to load spell data for ${name}`, err);
      }
    }
    return undefined;
  };

  return { lookup, isLoading };
}
