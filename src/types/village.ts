/**
 * @file village.ts
 * Defines the types for village generation and personality.
 */

export interface VillagePersonality {
  wealth: 'poor' | 'comfortable' | 'rich';
  culture: 'stoic' | 'festive' | 'scholarly' | 'martial';
  biomeStyle: 'temperate' | 'arid' | 'coastal' | 'swampy';
  population: 'small' | 'medium' | 'large';
  dominantRace?: 'human' | 'elf' | 'dwarf' | 'orc' | 'halfling' | 'gnome' | 'dragonborn' | 'tiefling' | 'other';
  architecturalStyle: 'colonial' | 'medieval' | 'tribal' | 'magical' | 'industrial' | 'nomadic' | 'aquatic' | 'martial';
  governingBody: 'mayor' | 'council' | 'elder' | 'warlord' | 'guild' | 'temple' | 'monarch' | 'anarchy';
  primaryIndustry: 'agriculture' | 'mining' | 'fishing' | 'trade' | 'crafting' | 'magic' | 'military' | 'scholarship';
}

export interface VillageIntegrationProfile {
  id: string;
  name?: string;
  description?: string;
  tagline: string;
  culturalSignature: string;
  encounterHooks: string[];
  // TODO(2026-01-03 Codex-CLI): AI-driven village flows reference richer prompts; surface optional fields until data schema is finalized.
  aiPrompt?: string;
  integrationPrompt?: string;
}
