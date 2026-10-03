/**
 * Curated flavor data that bridges the deterministic village generator with
 * downstream narrative systems (NPC chat, quest seeds, etc). The goal is to
 * keep AI prompts and UI strings centralized so future adjustments do not
 * require touching rendering code.
 */
import type { VillagePersonality } from '../types';

export interface VillageIntegrationProfile {
  id: string;
  name?: string;
  description?: string;
  tagline: string;
  aiPrompt: string;
  culturalSignature: string;
  encounterHooks: string[];
}

const personalityDefaults: Pick<VillagePersonality, 'architecturalStyle' | 'governingBody' | 'primaryIndustry'> = {
  architecturalStyle: 'medieval',
  governingBody: 'council',
  primaryIndustry: 'trade'
};

const normalizePersonality = (
  personality: Pick<VillagePersonality, 'wealth' | 'culture' | 'biomeStyle' | 'population'> &
    Partial<Pick<VillagePersonality, 'architecturalStyle' | 'governingBody' | 'primaryIndustry' | 'dominantRace'>>
): VillagePersonality => ({
  ...personalityDefaults,
  ...personality
});

const buildPrompt = (personality: VillagePersonality, summary: string) =>
  `You are describing a village that feels ${summary}. Wealth: ${personality.wealth}. Culture: ${personality.culture}. Biome style: ${personality.biomeStyle}. Population: ${personality.population}. Keep responses warm and concise.`;

const DEFAULT_VILLAGE_PROFILE_ID = 'stoic_poor_temperate';

export const villageIntegrationProfiles: Record<string, VillageIntegrationProfile> = {
  [DEFAULT_VILLAGE_PROFILE_ID]: {
    id: DEFAULT_VILLAGE_PROFILE_ID,
    tagline: 'Humble homesteads cling to tradition.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'poor', culture: 'stoic', biomeStyle: 'temperate', population: 'small' }), 'resilient but short on luxuries'),
    culturalSignature: 'Work songs and worn tools show a community that survives through grit.',
    encounterHooks: ['A farmer seeks help repairing a broken plow.', 'A quiet shrine-keeper thanks visitors with blessings of fortitude.']
  },
  festive_comfortable_coastal: {
    id: 'festive_comfortable_coastal',
    tagline: 'Sea breezes carry music and the smell of salt.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'festive', biomeStyle: 'coastal', population: 'medium' }), 'welcoming and proud of its harbour'),
    culturalSignature: 'Colorful bunting hangs between sturdy homes, hinting at regular celebrations.',
    encounterHooks: ['Fisherfolk boast about today\'s catch, inviting playful wagers.', 'A troupe rehearses for the next tide festival and needs an audience.']
  },
  scholarly_rich_temperate: {
    id: 'scholarly_rich_temperate',
    tagline: 'Orderly streets circle archives and lecture halls.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'rich', culture: 'scholarly', biomeStyle: 'temperate', population: 'large' }), 'bookish, well-funded, and curious'),
    culturalSignature: 'Etched plaques and tidy hedges reveal a love of learning.',
    encounterHooks: ['A historian requests help authenticating an old map.', 'An apprentice mage offers to trade scrolls for stories of the road.']
  },
  martial_comfortable_arid: {
    id: 'martial_comfortable_arid',
    tagline: 'Stone walls shade disciplined courtyards.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'martial', biomeStyle: 'arid', population: 'medium' }), 'alert, self-reliant, and protective'),
    culturalSignature: 'Training dummies and watchful sentries imply readiness for trouble.',
    encounterHooks: ['A patrol asks for help scouting a nearby canyon.', 'A weaponsmith seeks rare metals to improve the guard\'s arsenal.']
  },
  // --- Biome-specific variants ---
  stoic_poor_arid: {
    id: 'stoic_poor_arid',
    tagline: 'Sun-bleached bones mark the edge of the well.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'poor', culture: 'stoic', biomeStyle: 'arid', population: 'small' }), 'fatalistic but enduring'),
    culturalSignature: 'Cracked earth and patched cisterns show a life defined by scarcity.',
    encounterHooks: ['An elder offers a sip of water in exchange for a story from afar.', 'A child has lost a precious family heirloom in the shifting sands.']
  },
  festive_comfortable_temperate: {
    id: 'festive_comfortable_temperate',
    tagline: 'Laughter spills from taverns onto cobbled streets.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'festive', biomeStyle: 'temperate', population: 'medium' }), 'gregarious and fond of local traditions'),
    culturalSignature: 'Carved maypoles and community feast tables suggest a tight-knit social fabric.',
    encounterHooks: ['A bard needs help composing a song for an upcoming festival.', 'A brewer is experimenting with a new ale and seeks a taster.']
  },
  martial_poor_swampy: {
    id: 'martial_poor_swampy',
    tagline: 'Thatched huts stand on stilts above the murky water.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'poor', culture: 'martial', biomeStyle: 'swampy', population: 'small' }), 'wary of outsiders and fiercely territorial'),
    culturalSignature: 'Sharpened stakes and hidden nets serve as unsubtle warnings.',
    encounterHooks: ['A hunter offers to guide you through the bog, for a price.', 'A trapper has captured a strange beast and doesn\'t know what to do with it.']
  },
  scholarly_comfortable_coastal: {
    id: 'scholarly_comfortable_coastal',
    tagline: 'Tide charts and celestial maps adorn the library walls.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'scholarly', biomeStyle: 'coastal', population: 'medium' }), 'curious about the wider world and the secrets of the deep'),
    culturalSignature: 'Scrimshaw art and collections of exotic shells reveal a fascination with the sea.',
    encounterHooks: ['A cartographer believes a treasure fleet sank nearby and wants to hire a diver.', 'A scholar is studying tidal patterns and needs help placing research instruments.']
  },
  stoic_poor_tundra: {
    id: 'stoic_poor_tundra',
    tagline: 'Smoke rises from low sod houses banked against the wind.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'poor', culture: 'stoic', biomeStyle: 'tundra', population: 'small' }), 'quiet, frostbitten, and unbreakably patient'),
    culturalSignature: 'Racks of drying fish and carefully rationed peat stacks speak of winters survived by counting everything.',
    encounterHooks: ['A herder asks for help finding reindeer scattered by last night\'s storm.', 'The village\'s only fire-keeper has fallen ill, and the coals must not go out.']
  },
  festive_comfortable_jungle: {
    id: 'festive_comfortable_jungle',
    tagline: 'Drums and birdsong tangle above stilt-walk verandas.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'festive', biomeStyle: 'jungle', population: 'medium' }), 'loud, generous, and at ease with the wild green around it'),
    culturalSignature: 'Garlands of dyed feathers and communal cook-fires show a village that celebrates surviving the canopy together.',
    encounterHooks: ['A fruit-wine maker wants an escort to a grove deep in the canopy.', 'Tonight\'s masked dance needs one more drummer, and outsiders bring luck.']
  },
  martial_comfortable_volcanic: {
    id: 'martial_comfortable_volcanic',
    tagline: 'Forge-glow and vent-steam blur the line between smithy and mountain.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'martial', biomeStyle: 'volcanic', population: 'medium' }), 'hardened, industrious, and respectful of the fire beneath its feet'),
    culturalSignature: 'Obsidian-edged tools and ash-swept watch platforms show a people who arm themselves against both raiders and eruptions.',
    encounterHooks: ['A smith seeks volunteers to recover a bloom of star-iron from a cooling lava field.', 'The tremor-warden swears the mountain\'s rhythm has changed and wants proof for the council.']
  },
  stoic_poor_blighted: {
    id: 'stoic_poor_blighted',
    tagline: 'Grey fields end at a fence of charms that no one discusses.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'poor', culture: 'stoic', biomeStyle: 'blighted', population: 'small' }), 'haunted, tight-lipped, and stubbornly rooted to cursed ground'),
    culturalSignature: 'Salt lines on doorsteps and crops grown in raised, blessed soil betray a long negotiation with something wrong in the land.',
    encounterHooks: ['A farmer pays in heirlooms to have the withered orchard\'s heart examined.', 'The charm-fence failed on the north side, and nobody who repairs it comes back unchanged.']
  },
  martial_comfortable_highland: {
    id: 'martial_comfortable_highland',
    tagline: 'Stone crofts crown the ridgeline like a row of watchful teeth.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'martial', biomeStyle: 'highland', population: 'medium' }), 'clannish, weather-bitten, and proud of holding the high ground'),
    culturalSignature: 'Signal cairns and generations of feud-ballads mark a people who defend their passes and remember every slight.',
    encounterHooks: ['A shepherd wants dangerous company on the high path where travelers keep vanishing.', 'Two clans ask an outsider to judge a boundary dispute older than either chief.']
  },
  scholarly_comfortable_polar: {
    id: 'scholarly_comfortable_polar',
    tagline: 'Lens-domes glitter over the ice, aimed at the aurora.',
    aiPrompt: buildPrompt(normalizePersonality({ wealth: 'comfortable', culture: 'scholarly', biomeStyle: 'polar', population: 'small' }), 'insular, meticulous, and fascinated by the long dark'),
    culturalSignature: 'Star charts etched into whalebone and heated archive vaults show a settlement that studies the night it lives inside.',
    encounterHooks: ['An astronomer needs help hauling a brass lens to a ridge before the aurora peaks.', 'Something answered the survey team\'s echo-soundings from beneath the ice shelf.']
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

  // Biome-aware fallback: any profile authored for this biome (keys are
  // `${culture}_${wealth}_${biomeStyle}`). This runs BEFORE the culture fallback
  // so a non-temperate village (tundra, jungle, volcanic, blighted, highland,
  // polar, arid, coastal, swampy) reads with its own biome flavor instead of
  // snapping to the temperate default — every biomeStyle has a dedicated profile.
  const biomeSuffix = `_${personality.biomeStyle}`;
  const biomeKey = Object.keys(villageIntegrationProfiles).find((k) => k.endsWith(biomeSuffix));
  if (biomeKey) return villageIntegrationProfiles[biomeKey];

  const cultureKey = `${personality.culture}_comfortable_temperate`;
  if (villageIntegrationProfiles[cultureKey]) return villageIntegrationProfiles[cultureKey];

  // Safe fallback keeps the integration layer predictable even for new biomes
  // or wealth levels. The STOIC baseline is intentionally humble so it does not
  // overpromise when data is sparse.
  return villageIntegrationProfiles[DEFAULT_VILLAGE_PROFILE_ID];
};
