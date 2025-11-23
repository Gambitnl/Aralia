import { Spell } from '../types';

// Define a type for the manifest entry
export interface SpellManifestInfo {
  name: string;
  level: number;
  school: string;
  path: string;
}

export type SpellManifest = Record<string, SpellManifestInfo>;

class SpellService {
  private static instance: SpellService;
  private manifest: Promise<SpellManifest | null> | null = null;
  private spellCache: Map<string, Promise<Spell | null>> = new Map();

  private constructor() {}

  public static getInstance(): SpellService {
    if (!SpellService.instance) {
      SpellService.instance = new SpellService();
    }
    return SpellService.instance;
  }

  public async getAllSpellInfo(): Promise<SpellManifest | null> {
    if (!this.manifest) {
      this.manifest = fetch('/data/spells_manifest.json')
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to load spell manifest: ${res.statusText}`);
          }
          return res.json();
        })
        .catch(err => {
          console.error(err);
          return null;
        });
    }
    return this.manifest;
  }

  public async getSpellDetails(spellId: string): Promise<Spell | null> {
    if (this.spellCache.has(spellId)) {
      return this.spellCache.get(spellId)!;
    }

    const manifest = await this.getAllSpellInfo();
    if (!manifest || !manifest[spellId]) {
      console.error(`Spell with id "${spellId}" not found in manifest.`);
      return null;
    }

    const spellPath = manifest[spellId].path;
    const spellPromise = fetch(spellPath)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch spell details for ${spellId} at ${spellPath}`);
        }
        return res.json() as Promise<Spell>;
      })
      .catch(err => {
        console.error(err);
        this.spellCache.delete(spellId); // Remove from cache on error
        return null;
      });

    this.spellCache.set(spellId, spellPromise);
    return spellPromise;
  }
}

export const spellService = SpellService.getInstance();
