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
export declare const villageIntegrationProfiles: Record<string, VillageIntegrationProfile>;
/**
 * Chooses the closest personality profile for integration layers. The selector
 * favors an exact culture/wealth/biome trio before falling back to culture-only
 * defaults. Keeping this logic in one place prevents subtle mismatches between
 * UI descriptions and AI prompts when new personality combos are added.
 */
export declare const resolveVillageIntegrationProfile: (personality: VillagePersonality) => VillageIntegrationProfile;
