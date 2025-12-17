import { Spell } from '../types';
import { fetchWithTimeout } from '../utils/networkUtils';
import { logger } from '../utils/logger';
import { ENV, assetUrl } from '../config/env';

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

  private constructor() {
    logger.info('[SpellService] initialized', { BASE_URL: ENV.BASE_URL });
  }

  public static getInstance(): SpellService {
    if (!SpellService.instance) {
      SpellService.instance = new SpellService();
    }
    return SpellService.instance;
  }

  public async getAllSpellInfo(): Promise<SpellManifest | null> {
    if (!this.manifest) {
      this.manifest = fetchWithTimeout<SpellManifest>(assetUrl('data/spells_manifest.json'), {
        timeoutMs: 15000,
      }).catch(err => {
        logger.error('Failed to fetch spell manifest', { error: err });
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
      logger.error(`Spell with id "${spellId}" not found in manifest.`);
      return null;
    }

    const spellPath = manifest[spellId].path;
    const fullUrl = assetUrl(spellPath);
    logger.debug('[SpellService] Fetching spell:', { spellId, BASE_URL: ENV.BASE_URL, fullUrl });

    const spellPromise = fetchWithTimeout<Spell>(fullUrl, { timeoutMs: 10000 })
      .catch(err => {
        logger.error('Failed to fetch spell details', { spellId, fullUrl, error: err });
        this.spellCache.delete(spellId); // Remove from cache on error
        return null;
      });

    this.spellCache.set(spellId, spellPromise);
    return spellPromise;
  }
}

export const spellService = SpellService.getInstance();
