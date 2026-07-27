import { describe, it, expect } from 'vitest';
import {
  resolveVillageIntegrationProfile,
  villageIntegrationProfiles,
} from '../villagePersonalityProfiles';
import type { VillagePersonality } from '../../types/village';

const base: VillagePersonality = {
  wealth: 'comfortable',
  culture: 'festive',
  biomeStyle: 'temperate',
  population: 'medium',
  architecturalStyle: 'medieval',
  governingBody: 'council',
  primaryIndustry: 'trade',
};

describe('resolveVillageIntegrationProfile', () => {
  it('returns the exact culture_wealth_biome profile when one exists', () => {
    const p = { ...base, culture: 'stoic' as const, wealth: 'poor' as const, biomeStyle: 'tundra' as const };
    const profile = resolveVillageIntegrationProfile(p);
    expect(profile.id).toBe('stoic_poor_tundra');
  });

  it('falls back to the biome flavor, not temperate, when the exact tuple is missing', () => {
    // A rich, festive tundra village has no exact profile — it must still read as
    // a tundra place, not snap to the temperate default (codex QA #247).
    const p = { ...base, culture: 'festive' as const, wealth: 'rich' as const, biomeStyle: 'tundra' as const };
    const profile = resolveVillageIntegrationProfile(p);
    expect(profile.id.endsWith('_tundra')).toBe(true);
    expect(profile.id).not.toBe('stoic_poor_temperate');
  });

  it('gives every non-temperate biome a dedicated (non-default) profile', () => {
    const biomes: VillagePersonality['biomeStyle'][] = [
      'arid', 'coastal', 'swampy', 'tundra', 'jungle', 'volcanic', 'blighted', 'highland', 'polar',
    ];
    for (const biomeStyle of biomes) {
      // Use a deliberately unusual tuple so only the biome fallback can match.
      const p = { ...base, culture: 'scholarly' as const, wealth: 'rich' as const, biomeStyle };
      const profile = resolveVillageIntegrationProfile(p);
      expect(profile.id.endsWith(`_${biomeStyle}`), `biome ${biomeStyle} should resolve to its own flavor`).toBe(true);
    }
  });

  it('still falls back to the default for a temperate village with no closer match', () => {
    const p = { ...base, culture: 'martial' as const, wealth: 'rich' as const, biomeStyle: 'temperate' as const };
    const profile = resolveVillageIntegrationProfile(p);
    // martial_rich_temperate does not exist; temperate has no biome-only match beyond
    // the defaults, so it lands on a temperate profile.
    expect(profile.id.endsWith('_temperate')).toBe(true);
    expect(villageIntegrationProfiles[profile.id]).toBeDefined();
  });
});
