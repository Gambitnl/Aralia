/**
 * Curated flavor data that bridges the deterministic village generator with
 * downstream narrative systems (NPC chat, quest seeds, etc). The goal is to
 * keep AI prompts and UI strings centralized so future adjustments do not
 * require touching rendering code.
 */
import type { VillagePersonality } from '../services/villageGenerator';

export interface VillageIntegrationProfile {
  id: string;
  tagline: string;
  aiPrompt: string;
  culturalSignature: string;
  encounterHooks: string[];
}

const buildPrompt = (personality: VillagePersonality, summary: string) =>
  `You are describing a village that feels ${summary}. Wealth: ${personality.wealth}. Culture: ${personality.culture}. Biome style: ${personality.biomeStyle}. Population: ${personality.population}. Keep responses warm and concise.`;

const DEFAULT_VILLAGE_PROFILE_ID = 'stoic_poor_temperate';

export const villageIntegrationProfiles: Record<string, VillageIntegrationProfile> = {
  [DEFAULT_VILLAGE_PROFILE_ID]: {
    id: DEFAULT_VILLAGE_PROFILE_ID,
    tagline: 'Humble homesteads cling to tradition.',
    aiPrompt: buildPrompt({ wealth: 'poor', culture: 'stoic', biomeStyle: 'temperate', population: 'small' }, 'resilient but short on luxuries'),
    culturalSignature: 'Work songs and worn tools show a community that survives through grit.',
    encounterHooks: ['A farmer seeks help repairing a broken plow.', 'A quiet shrine-keeper thanks visitors with blessings of fortitude.']
  },
  festive_comfortable_coastal: {
    id: 'festive_comfortable_coastal',
    tagline: 'Sea breezes carry music and the smell of salt.',
    aiPrompt: buildPrompt({ wealth: 'comfortable', culture: 'festive', biomeStyle: 'coastal', population: 'medium' }, 'welcoming and proud of its harbour'),
    culturalSignature: 'Colorful bunting hangs between sturdy homes, hinting at regular celebrations.',
    encounterHooks: ['Fisherfolk boast about today\'s catch, inviting playful wagers.', 'A troupe rehearses for the next tide festival and needs an audience.']
  },
  scholarly_rich_temperate: {
    id: 'scholarly_rich_temperate',
    tagline: 'Orderly streets circle archives and lecture halls.',
    aiPrompt: buildPrompt({ wealth: 'rich', culture: 'scholarly', biomeStyle: 'temperate', population: 'large' }, 'bookish, well-funded, and curious'),
    culturalSignature: 'Etched plaques and tidy hedges reveal a love of learning.',
    encounterHooks: ['A historian requests help authenticating an old map.', 'An apprentice mage offers to trade scrolls for stories of the road.']
  },
  martial_comfortable_arid: {
    id: 'martial_comfortable_arid',
    tagline: 'Stone walls shade disciplined courtyards.',
    aiPrompt: buildPrompt({ wealth: 'comfortable', culture: 'martial', biomeStyle: 'arid', population: 'medium' }, 'alert, self-reliant, and protective'),
    culturalSignature: 'Training dummies and watchful sentries imply readiness for trouble.',
    encounterHooks: ['A patrol asks for help scouting a nearby canyon.', 'A weaponsmith seeks rare metals to improve the guard\'s arsenal.']
  }
};

/**
 * Chooses the closest personality profile for integration layers. The selector
 * favors an exact culture/wealth/biome trio before falling back to culture-only
 * defaults. Keeping this logic in one place prevents subtle mismatches between
 * UI descriptions and AI prompts when new personality combos are added.
 */
export const resolveVillageIntegrationProfile = (personality: VillagePersonality): VillageIntegrationProfile => {
  const exactKey = `${personality.culture}_${personality.wealth}_${personality.biomeStyle}`;
  if (villageIntegrationProfiles[exactKey]) return villageIntegrationProfiles[exactKey];

  const cultureKey = `${personality.culture}_comfortable_temperate`;
  if (villageIntegrationProfiles[cultureKey]) return villageIntegrationProfiles[cultureKey];

  // Safe fallback keeps the integration layer predictable even for new biomes
  // or wealth levels. The STOIC baseline is intentionally humble so it does not
  // overpromise when data is sparse.
  return villageIntegrationProfiles[DEFAULT_VILLAGE_PROFILE_ID];
};
