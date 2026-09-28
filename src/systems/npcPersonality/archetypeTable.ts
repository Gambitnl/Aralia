/**
 * @file src/systems/npcPersonality/archetypeTable.ts
 * Role x biome -> archetype lookup (board task agora-d9e1).
 *
 * WHAT: turns the two context tags every NPC already carries — a functional role
 * or occupation, and a home biome/settlement tag — into one of the ten
 * {@link Archetype} labels.
 *
 * WHY A TABLE AND NOT A RULE ENGINE: designers need to be able to read "a city
 * merchant is greedy" off a page and change it. The resolution order is the only
 * logic: exact (role, biome) beats (role, 'any') beats a biome default beats the
 * global fallback.
 *
 * REUSE NOTE: role and biome tags arrive free-form (`NPCGenerationConfig.biomeId`
 * is a biome id, a biome family or a settlement tag, and `occupation` is prose
 * like "Blacksmith"). Rather than adding strictly-typed config fields — which
 * `speechProfile.ts` and `backgroundBrief.ts` both deliberately avoided — this
 * file normalizes with the same substring approach they use.
 */

import type { Archetype } from './types.js';

/**
 * Biome buckets this table distinguishes.
 *
 * Intentionally NOT the same vocabulary as `backgroundBrief`'s
 * `NpcBackgroundBiome` (temperate/arid/coastal/...): that list has no settlement
 * bucket, and "a city guard" versus "a forest guard" is exactly the distinction
 * this table exists to make. `city` and `underdark` are therefore first-class
 * here, and `forest`/`plains` stay separate rather than collapsing to `temperate`.
 */
export type PersonalityBiome =
  | 'forest'
  | 'plains'
  | 'city'
  | 'mountain'
  | 'coastal'
  | 'desert'
  | 'swamp'
  | 'tundra'
  | 'underdark'
  | 'any';

/** One row of the table. `biome: 'any'` matches when no exact row does. */
export interface ArchetypeRule {
  /** Normalized role or occupation key (see {@link normalizePersonalityRole}). */
  role: string;
  biome: PersonalityBiome;
  archetype: Archetype;
  /** Short designer-facing reason. Kept in data so the table reads as a document. */
  note: string;
}

// ---------------------------------------------------------------------------
// Tag normalization
// ---------------------------------------------------------------------------

/**
 * Substring hints per biome bucket. Order matters: the first bucket whose hint
 * appears in the tag wins, so `city` is tested before the wilderness buckets
 * (a "city marsh district" is a city).
 */
const BIOME_HINTS: readonly (readonly [PersonalityBiome, readonly string[]])[] = [
  ['city', ['city', 'urban', 'town', 'settlement', 'metropolis', 'district', 'burg', 'capital']],
  // `coastal` is tested before `underdark` and the underdark hints avoid a bare
  // "deep": world data uses "deep ocean" for open water, which is not a cave.
  ['coastal', ['coast', 'ocean', 'sea', 'beach', 'harbor', 'harbour', 'island', 'reef', 'aquatic', 'marine', 'port']],
  ['underdark', ['underdark', 'cave', 'cavern', 'subterranean', 'mine', 'tunnel', 'depths']],
  ['swamp', ['swamp', 'marsh', 'bog', 'fen', 'wetland', 'mire']],
  ['mountain', ['mountain', 'hill', 'peak', 'alpine', 'highland', 'crag', 'volcanic']],
  ['tundra', ['tundra', 'polar', 'glacier', 'arctic', 'taiga', 'frost', 'snow', 'ice']],
  ['desert', ['desert', 'arid', 'dune', 'wasteland', 'badland', 'scrub']],
  ['forest', ['forest', 'wood', 'jungle', 'rainforest', 'grove', 'taigawood']],
  ['plains', ['plain', 'grassland', 'savanna', 'steppe', 'meadow', 'field', 'farmland', 'temperate']],
];

/**
 * Maps a free-form biome/settlement tag onto a bucket.
 * Returns `'any'` when the tag says nothing recognizable, which is a real answer
 * rather than a failure: the table has `'any'` rows for exactly that case.
 */
export function normalizePersonalityBiome(tag?: string): PersonalityBiome {
  if (!tag) return 'any';
  const text = tag.toLowerCase();
  for (const [biome, hints] of BIOME_HINTS) {
    if (hints.some((hint) => text.includes(hint))) return biome;
  }
  return 'any';
}

/**
 * Occupation/role hints per table key. The generator's five functional roles
 * (`merchant`, `quest_giver`, `guard`, `civilian`, `unique`) are keys in their own
 * right; the rest exist so a free-form `occupation` ("Temple Acolyte", "Dockhand")
 * resolves to something more specific than its functional role.
 */
const ROLE_HINTS: readonly (readonly [string, readonly string[]])[] = [
  ['priest', ['priest', 'cleric', 'acolyte', 'monk', 'temple', 'shrine', 'preacher', 'friar']],
  ['scholar', ['scholar', 'sage', 'scribe', 'librarian', 'wizard', 'archivist', 'astrologer', 'alchemist']],
  ['thief', ['thief', 'cutpurse', 'smuggler', 'fence', 'criminal', 'bandit', 'burglar']],
  ['noble', ['noble', 'lord', 'lady', 'baron', 'count', 'magistrate', 'courtier']],
  ['innkeeper', ['innkeep', 'tavern', 'barkeep', 'publican', 'host']],
  ['blacksmith', ['smith', 'forge', 'armorer', 'armourer', 'weaponsmith']],
  ['hunter', ['hunter', 'trapper', 'ranger', 'poacher', 'forester']],
  ['sailor', ['sailor', 'deckhand', 'dockhand', 'shipwright', 'navigator', 'pirate']],
  ['fisher', ['fisher', 'fishmonger', 'angler', 'whaler']],
  ['miner', ['miner', 'prospector', 'quarrier', 'digger']],
  ['farmer', ['farmer', 'farmhand', 'herder', 'shepherd', 'rancher', 'grower', 'miller']],
  ['beggar', ['beggar', 'urchin', 'vagrant', 'pauper']],
  ['healer', ['healer', 'physician', 'apothecary', 'midwife', 'herbalist']],
  ['soldier', ['soldier', 'sergeant', 'watchman', 'sentry', 'militia', 'mercenary']],
  ['child', ['child', 'youth', 'apprentice', 'novice', 'page', 'stable boy', 'stableboy']],
  ['merchant', ['merchant', 'trader', 'shopkeep', 'vendor', 'peddler', 'broker']],
  ['guard', ['guard']],
  ['quest_giver', ['quest_giver', 'quest giver', 'petitioner']],
  ['unique', ['unique']],
  ['civilian', ['civilian', 'commoner', 'peasant', 'townsfolk', 'laborer', 'labourer']],
];

/**
 * Maps a role and/or occupation onto a table key.
 *
 * `occupation` is checked FIRST and wins, because a "Temple Acolyte" registered
 * with the functional role `civilian` should read as pious, not as generic
 * townsfolk. Falls back to `'civilian'`, the table's most generic populated row.
 */
export function normalizePersonalityRole(role?: string, occupation?: string): string {
  const candidates = [occupation, role].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const text = candidate.toLowerCase();
    for (const [key, hints] of ROLE_HINTS) {
      if (hints.some((hint) => text.includes(hint))) return key;
    }
  }
  return 'civilian';
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/**
 * Role x biome coverage. Rows are grouped by role and read top-to-bottom; the
 * resolver does the precedence, not the ordering, so rows may be reordered freely.
 *
 * Twenty-eight rows rather than the twenty the task asks for: the extra eight are
 * the `'any'` rows that stop an unrecognized biome from falling all the way
 * through to the global default, which would have made every wilderness NPC
 * identically friendly.
 */
export const ARCHETYPE_TABLE: readonly ArchetypeRule[] = [
  // --- Guards & soldiers: hard everywhere, paranoid where crowds hide knives ---
  { role: 'guard', biome: 'forest', archetype: 'gruff', note: 'Border watch, long shifts, no small talk.' },
  { role: 'guard', biome: 'city', archetype: 'suspicious', note: 'A crowd is where trouble hides.' },
  { role: 'guard', biome: 'mountain', archetype: 'gruff', note: 'Pass wardens are weathered and short.' },
  { role: 'guard', biome: 'any', archetype: 'gruff', note: 'Default posture for anyone who stands a post.' },
  { role: 'soldier', biome: 'any', archetype: 'gruff', note: 'Barracks discipline reads as bluntness.' },

  // --- Merchants: the money archetypes, split by how the money is made ---
  { role: 'merchant', biome: 'city', archetype: 'greedy', note: 'Competition and margins in every street.' },
  { role: 'merchant', biome: 'coastal', archetype: 'cunning', note: 'Port trade rewards the angle over the price.' },
  { role: 'merchant', biome: 'desert', archetype: 'greedy', note: 'Water and caravan routes price themselves.' },
  { role: 'merchant', biome: 'any', archetype: 'greedy', note: 'Selling is the job; the job shapes the person.' },

  // --- Faith and letters ---
  { role: 'priest', biome: 'any', archetype: 'pious', note: 'Doctrine outranks geography.' },
  { role: 'scholar', biome: 'city', archetype: 'scholarly', note: 'Academies cluster where the libraries are.' },
  { role: 'scholar', biome: 'any', archetype: 'scholarly', note: 'Curiosity travels.' },
  { role: 'healer', biome: 'any', archetype: 'friendly', note: 'Bedside manner is most of the trade.' },

  // --- Land work ---
  { role: 'farmer', biome: 'plains', archetype: 'friendly', note: 'Open country, neighbors you need.' },
  { role: 'farmer', biome: 'forest', archetype: 'friendly', note: 'Smallholders trade favors to survive.' },
  { role: 'farmer', biome: 'tundra', archetype: 'melancholy', note: 'Short seasons and long dark.' },
  { role: 'hunter', biome: 'forest', archetype: 'suspicious', note: 'Solitary work; strangers mean poachers.' },
  { role: 'hunter', biome: 'any', archetype: 'suspicious', note: 'Watchfulness is the professional skill.' },
  { role: 'miner', biome: 'underdark', archetype: 'gruff', note: 'Deep shifts, thin patience.' },
  { role: 'miner', biome: 'mountain', archetype: 'gruff', note: 'Same trade, thinner air.' },

  // --- Water work ---
  { role: 'sailor', biome: 'coastal', archetype: 'cheerful', note: 'Shore leave is loud on purpose.' },
  { role: 'fisher', biome: 'coastal', archetype: 'melancholy', note: 'The sea takes people; everyone has lost one.' },
  { role: 'fisher', biome: 'swamp', archetype: 'suspicious', note: 'Fen folk keep their own counsel.' },

  // --- City underside and overside ---
  { role: 'thief', biome: 'city', archetype: 'cunning', note: 'The trade IS the archetype.' },
  { role: 'thief', biome: 'any', archetype: 'cunning', note: 'Roads and docks work the same way.' },
  { role: 'noble', biome: 'city', archetype: 'cunning', note: 'Court is a game with knives under it.' },
  { role: 'beggar', biome: 'city', archetype: 'melancholy', note: 'Visible to nobody, all day.' },
  { role: 'innkeeper', biome: 'any', archetype: 'cheerful', note: 'Warmth is the product being sold.' },
  { role: 'blacksmith', biome: 'mountain', archetype: 'gruff', note: 'Heat, noise, and no time for chatter.' },
  { role: 'blacksmith', biome: 'any', archetype: 'gruff', note: 'Same forge, anywhere.' },

  // --- Generic townsfolk, split by how hard the land is ---
  { role: 'civilian', biome: 'swamp', archetype: 'suspicious', note: 'Isolated hamlets distrust arrivals.' },
  { role: 'civilian', biome: 'tundra', archetype: 'melancholy', note: 'Scarcity wears people down.' },
  { role: 'civilian', biome: 'city', archetype: 'suspicious', note: 'City neighbors are strangers.' },
  { role: 'civilian', biome: 'any', archetype: 'friendly', note: 'Village default: incurious but warm.' },

  // --- Narrative roles ---
  { role: 'quest_giver', biome: 'any', archetype: 'friendly', note: 'Asking a favor requires being likeable.' },
  { role: 'unique', biome: 'any', archetype: 'cunning', note: 'Story NPCs are written as withholding by default.' },
  { role: 'child', biome: 'any', archetype: 'naive', note: 'The only row that reaches `naive` by role.' },
];

/**
 * Distinct (role, biome) pairs in the table. Exported so a coverage test can
 * assert the acceptance criterion (20+ combinations) rather than eyeballing it.
 */
export const ARCHETYPE_TABLE_COMBINATIONS: readonly string[] = ARCHETYPE_TABLE.map(
  (rule) => `${rule.role}:${rule.biome}`
);

/**
 * Fallback when a biome is recognized but the role is not covered at all.
 * Deliberately not `friendly` for every biome — a harsh place should still colour
 * an unmapped occupation.
 */
const BIOME_DEFAULTS: Readonly<Record<PersonalityBiome, Archetype>> = {
  forest: 'gruff',
  plains: 'friendly',
  city: 'suspicious',
  mountain: 'gruff',
  coastal: 'cheerful',
  desert: 'suspicious',
  swamp: 'suspicious',
  tundra: 'melancholy',
  underdark: 'suspicious',
  any: 'friendly',
};

/** Archetype used when neither role nor biome matches anything. */
export const DEFAULT_ARCHETYPE: Archetype = 'friendly';

/** Inputs to {@link resolveArchetype}. All optional — the resolver always answers. */
export interface ArchetypeLookup {
  /** Functional role, e.g. `NPC['role']`. */
  role?: string;
  /** Specific occupation, e.g. "Blacksmith". Outranks `role` when it is recognized. */
  occupation?: string;
  /** Free-form biome id, biome family or settlement tag. */
  biomeId?: string;
}

/**
 * Resolves an archetype for a role/biome pair.
 *
 * Precedence, most specific first:
 *   1. exact (role, biome)
 *   2. (role, 'any')
 *   3. the biome's default
 *   4. {@link DEFAULT_ARCHETYPE}
 */
export function resolveArchetype(lookup: ArchetypeLookup): Archetype {
  const role = normalizePersonalityRole(lookup.role, lookup.occupation);
  const biome = normalizePersonalityBiome(lookup.biomeId);

  const exact = ARCHETYPE_TABLE.find((rule) => rule.role === role && rule.biome === biome);
  if (exact) return exact.archetype;

  const anyBiome = ARCHETYPE_TABLE.find((rule) => rule.role === role && rule.biome === 'any');
  if (anyBiome) return anyBiome.archetype;

  return BIOME_DEFAULTS[biome] ?? DEFAULT_ARCHETYPE;
}
