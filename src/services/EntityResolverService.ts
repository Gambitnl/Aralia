/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file EntityResolverService.ts
 * Provides validation and resolution for entities referenced in text (e.g., AI output).
 * Ensures that locations, factions, and NPCs mentioned in narrative text actually exist
 * in the game state, or flags them for potential creation (stubs).
 *
 * STUB GENERATION (board tasks agora-02c9 and agora-6e72)
 * The three `create*` helpers below used to emit flat stubs: every faction was a
 * GUILD with two empty-perk ranks, every location was `plains`, every NPC was a
 * `civilian`. They now infer from the entity NAME and from the optional narrative
 * CONTEXT the resolver already has in hand, and they roll the remaining variation
 * through `SeededRandom` keyed on the name, so the same name always produces the
 * same entity across sessions and saves.
 *
 * PRESERVED
 * - Every inference falls through to the historical default when nothing matches
 *   (`GUILD`, `plains`, `civilian`), so an unrecognized name behaves as before.
 * - `context` is optional on all three helpers and on `ensureEntityExists`, so no
 *   existing call site changes.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: utils/context/entityIntegrationUtils.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, Location, Faction, FactionRank, FactionType, FactionEconomicPolicy, NPC } from '../types';
import { FACTIONS } from '../data/factions';
import { BIOMES } from '../data/biomes';
import { LOCATIONS } from '../data/world/locations';
import { LANDMARK_TEMPLATES } from '../data/landmarks';
import { NPCS } from '../data/world/npcs';
import { SeededRandom } from '../utils/random/seededRandom.js';
import { generatePersonality, type Archetype } from '../systems/npcPersonality/index.js';

export type EntityType = 'location' | 'faction' | 'npc' | 'item';

export interface EntityReference {
  originalText: string;
  normalizedName: string;
  type: EntityType;
  exists: boolean;
  entityId?: string;
  confidence: number;
}

export interface ResolverResult {
  text: string; // The original text (potentially modified if we correct names)
  references: EntityReference[];
  validationErrors: string[]; // List of issues found (e.g., "Mentioned 'Silverdale' but it does not exist")
}

export interface EntityCreationResult {
  entity: Location | Faction | NPC | null;
  created: boolean;
  type: EntityType;
}

// ---------------------------------------------------------------------------
// Faction generation tables (agora-02c9)
// ---------------------------------------------------------------------------

/**
 * Name/context keywords that identify a faction's kind.
 *
 * Read top-to-bottom: the first row with a matching keyword wins, so the more
 * specific kinds are listed before the catch-all GUILD hints. Keywords are
 * matched as whole words against the lowercased name plus context, which keeps
 * "Order of the Crimson Hand" out of the NOBLE_HOUSE row on the word "house".
 */
const FACTION_TYPE_KEYWORDS: readonly (readonly [FactionType, readonly string[]])[] = [
  ['CRIMINAL_SYNDICATE', ['syndicate', 'thieves', 'cartel', 'smugglers', 'cutthroats', 'underworld', 'crew', 'gang', 'racket']],
  ['RELIGIOUS_ORDER', ['order', 'temple', 'church', 'cathedral', 'abbey', 'faith', 'cult', 'clergy', 'monastery', 'priesthood', 'flame']],
  ['SECRET_SOCIETY', ['society', 'cabal', 'circle', 'lodge', 'conclave', 'veil', 'hidden', 'unseen', 'shadow', 'whisper', 'whispers']],
  ['MILITARY', ['legion', 'company', 'brigade', 'regiment', 'swords', 'blades', 'spears', 'watch', 'guard', 'army', 'host', 'wardens']],
  ['GOVERNMENT', ['crown', 'council', 'senate', 'magistrate', 'ministry', 'court', 'parliament', 'assembly', 'chancellery']],
  ['NOBLE_HOUSE', ['house', 'clan', 'dynasty', 'lineage', 'bloodline', 'scions']],
  ['GUILD', ['guild', 'consortium', 'league', 'union', 'ledger', 'merchants', 'traders', 'compact', 'cooperative']],
];

/** Historical default when a name says nothing about the faction's kind. */
const DEFAULT_FACTION_TYPE: FactionType = 'GUILD';

/**
 * One rung of a generated rank ladder. `level` is not stored here: it is the
 * rung's position in its ladder, so a ladder can be reordered or extended
 * without renumbering it by hand.
 */
interface RankTemplate {
  id: string;
  name: string;
  description: string;
  perks: string[];
}

/**
 * Five-rung progression per faction kind.
 *
 * Perk strings use the same free-form id vocabulary the authored ladders in
 * `data/factions.ts` and `utils/world/nobleHouseGenerator.ts` already use
 * (`access_guild_hall`, `command_soldiers`, ...). Nothing consumes perk ids yet,
 * so this table is intentionally the place where that vocabulary grows: adding a
 * consumer later means reading these strings, not re-deriving them.
 *
 * Level is the array index + 1, so a ladder can be extended or trimmed here
 * without touching the generator.
 */
const FACTION_RANK_LADDERS: Readonly<Record<FactionType, readonly RankTemplate[]>> = {
  GUILD: [
    { id: 'associate', name: 'Associate', description: 'A known associate, welcome at the hall but trusted with nothing.', perks: ['access_guild_hall'] },
    { id: 'member', name: 'Member', description: 'A dues-paying member of the guild.', perks: ['access_guild_store', 'take_contracts'] },
    { id: 'journeyman', name: 'Journeyman', description: 'A proven hand who may sign for the guild in small matters.', perks: ['guild_credit', 'commission_work'] },
    { id: 'master', name: 'Master', description: 'A master of the trade with apprentices of their own.', perks: ['command_subordinates', 'access_vault'] },
    { id: 'guildmaster', name: 'Guildmaster', description: 'Sits on the board that sets the guild\'s prices and policy.', perks: ['set_guild_policy', 'guild_treasury_draw'] },
  ],
  NOBLE_HOUSE: [
    { id: 'retainer', name: 'Retainer', description: 'A servant or soldier sworn to the house.', perks: ['protection', 'lodging'] },
    { id: 'sworn_sword', name: 'Sworn Sword', description: 'A sworn blade of the house, fed at its table.', perks: ['command_soldiers', 'better_lodging'] },
    { id: 'bannerman', name: 'Bannerman', description: 'Holds land or office in the house\'s name.', perks: ['landed_income', 'summon_levy'] },
    { id: 'scion', name: 'Scion', description: 'A blood relative of the ruling family.', perks: ['political_immunity', 'family_funds'] },
    { id: 'heir', name: 'Heir', description: 'Named successor to the seat of the house.', perks: ['speak_for_house', 'house_treasury_draw'] },
  ],
  RELIGIOUS_ORDER: [
    { id: 'supplicant', name: 'Supplicant', description: 'A seeker permitted to pray in the outer sanctuary.', perks: ['sanctuary_rest'] },
    { id: 'acolyte', name: 'Acolyte', description: 'Has taken the first vows and serves the rites.', perks: ['temple_healing', 'ritual_supplies'] },
    { id: 'ordained', name: 'Ordained', description: 'Ordained to lead the rites and hear confession.', perks: ['consecrate_ground', 'temple_stipend'] },
    { id: 'high_priest', name: 'High Priest', description: 'Speaks doctrine for the order in this region.', perks: ['command_subordinates', 'access_reliquary'] },
    { id: 'hierarch', name: 'Hierarch', description: 'Sets doctrine for the whole order.', perks: ['declare_doctrine', 'order_treasury_draw'] },
  ],
  CRIMINAL_SYNDICATE: [
    { id: 'mark', name: 'Mark', description: 'Useful to the crew, and disposable.', perks: ['fence_small_goods'] },
    { id: 'runner', name: 'Runner', description: 'Carries goods and messages and asks nothing.', perks: ['safehouse_access', 'take_jobs'] },
    { id: 'made', name: 'Made', description: 'Made: owed a cut and owed protection.', perks: ['fence', 'forgery', 'crew_backup'] },
    { id: 'lieutenant', name: 'Lieutenant', description: 'Runs a crew of their own and answers for it.', perks: ['command_subordinates', 'territory_cut'] },
    { id: 'boss', name: 'Boss', description: 'Decides who earns and who disappears.', perks: ['set_territory', 'syndicate_treasury_draw'] },
  ],
  GOVERNMENT: [
    { id: 'petitioner', name: 'Petitioner', description: 'May be heard, eventually, by a clerk.', perks: ['petition_court'] },
    { id: 'clerk', name: 'Clerk', description: 'Holds a seal and a ledger on the body\'s behalf.', perks: ['archive_access', 'issue_writ'] },
    { id: 'officer', name: 'Officer', description: 'Enforces the body\'s decisions in its name.', perks: ['lawful_authority', 'requisition_supplies'] },
    { id: 'councilor', name: 'Councilor', description: 'Holds a seat and a vote.', perks: ['vote_on_policy', 'access_treasury_records'] },
    { id: 'chancellor', name: 'Chancellor', description: 'Sets the agenda the rest of the body votes on.', perks: ['set_policy', 'state_treasury_draw'] },
  ],
  MILITARY: [
    { id: 'recruit', name: 'Recruit', description: 'Sworn in, armed, and not yet trusted.', perks: ['barracks_rest'] },
    { id: 'soldier', name: 'Soldier', description: 'A soldier of the line, drawing pay.', perks: ['armory_access', 'soldier_pay'] },
    { id: 'sergeant', name: 'Sergeant', description: 'Holds a squad together in the field.', perks: ['command_soldiers', 'requisition_supplies'] },
    { id: 'captain', name: 'Captain', description: 'Commands a company and answers for its losses.', perks: ['command_subordinates', 'field_authority'] },
    { id: 'commander', name: 'Commander', description: 'Chooses where the banner goes.', perks: ['set_campaign', 'war_chest_draw'] },
  ],
  SECRET_SOCIETY: [
    { id: 'seeker', name: 'Seeker', description: 'Has noticed the society exists, which is already dangerous.', perks: ['recognize_sign'] },
    { id: 'initiate', name: 'Initiate', description: 'Initiated, and told the first of the lies.', perks: ['safehouse_access', 'cipher_key'] },
    { id: 'adept', name: 'Adept', description: 'Trusted with work the society will deny.', perks: ['dead_drop_network', 'society_favors'] },
    { id: 'magister', name: 'Magister', description: 'Knows the names behind the masks in this cell.', perks: ['command_subordinates', 'access_inner_archive'] },
    { id: 'hidden_hand', name: 'Hidden Hand', description: 'One of the few who decide what the society is for.', perks: ['set_agenda', 'society_treasury_draw'] },
  ],
};

/**
 * What each kind of faction rewards and punishes, and how it trades.
 *
 * These mirror the shape of the authored factions in `data/factions.ts` so a
 * generated faction can be dropped into the same reputation and economy code
 * paths without a special case.
 */
interface FactionDisposition {
  values: string[];
  hates: string[];
  economicPolicy: FactionEconomicPolicy;
  colors: { primary: string; secondary: string };
  /** Inclusive band the seeded power roll draws from. */
  powerBand: [number, number];
}

const FACTION_DISPOSITIONS: Readonly<Record<FactionType, FactionDisposition>> = {
  GUILD: {
    values: ['wealth', 'honesty_in_contracts', 'craftsmanship'],
    hates: ['theft', 'undercutting', 'bad_debts'],
    economicPolicy: 'mercantile',
    colors: { primary: '#B45309', secondary: '#FCD34D' },
    powerBand: [35, 70],
  },
  NOBLE_HOUSE: {
    values: ['honor', 'tradition', 'lineage'],
    hates: ['cowardice', 'treachery', 'disrespect'],
    economicPolicy: 'protectionist',
    colors: { primary: '#B91C1C', secondary: '#FCD34D' },
    powerBand: [45, 85],
  },
  RELIGIOUS_ORDER: {
    values: ['piety', 'charity', 'doctrine'],
    hates: ['heresy', 'desecration', 'oathbreaking'],
    economicPolicy: 'free_trade',
    colors: { primary: '#F3F4F6', secondary: '#CA8A04' },
    powerBand: [30, 70],
  },
  CRIMINAL_SYNDICATE: {
    values: ['secrecy', 'loyalty', 'cunning'],
    hates: ['snitches', 'law_enforcement', 'exposure'],
    economicPolicy: 'exploitative',
    colors: { primary: '#1F2937', secondary: '#9CA3AF' },
    powerBand: [25, 60],
  },
  GOVERNMENT: {
    values: ['order', 'law', 'stability'],
    hates: ['sedition', 'corruption', 'banditry'],
    economicPolicy: 'protectionist',
    colors: { primary: '#1D4ED8', secondary: '#E5E7EB' },
    powerBand: [50, 90],
  },
  MILITARY: {
    values: ['discipline', 'strength', 'duty'],
    hates: ['desertion', 'insubordination', 'banditry'],
    economicPolicy: 'protectionist',
    colors: { primary: '#374151', secondary: '#DC2626' },
    powerBand: [45, 85],
  },
  SECRET_SOCIETY: {
    values: ['secrecy', 'knowledge', 'patience'],
    hates: ['exposure', 'zealotry', 'loose_tongues'],
    economicPolicy: 'free_trade',
    colors: { primary: '#4C1D95', secondary: '#111827' },
    powerBand: [20, 55],
  },
};

/** Trade priorities per faction kind, reusing the good ids `data/factions.ts` uses. */
const FACTION_TRADE_PRIORITIES: Readonly<Record<FactionType, string[]>> = {
  GUILD: ['luxury', 'gem', 'cloth', 'tools'],
  NOBLE_HOUSE: ['luxury', 'wine', 'horses', 'armor'],
  RELIGIOUS_ORDER: ['incense', 'herbs', 'books', 'food'],
  CRIMINAL_SYNDICATE: ['narcotics', 'stolen_goods', 'weapon', 'poison'],
  GOVERNMENT: ['food', 'iron', 'timber', 'salt'],
  MILITARY: ['weapon', 'armor', 'iron', 'food'],
  SECRET_SOCIETY: ['books', 'magic_reagents', 'gem', 'dark_magic'],
};

// ---------------------------------------------------------------------------
// Location generation tables (agora-6e72)
// ---------------------------------------------------------------------------

/**
 * Whole-word cues that identify a biome, mapped onto ids that exist in `BIOMES`.
 *
 * Generic cues deliberately resolve to the legacy family aliases (`forest`,
 * `mountain`, `desert`, `plains`) because every authored location in
 * `data/world/locations.ts` uses those, and a specific cue resolves to the
 * matching variant id ("glacier" is a real, distinct `mountain_glacier`).
 * `ENTITY_RESOLVER_TABLES` is exported at the bottom of this file so the unit
 * test can assert every id here is a real `BIOMES` key: a typo fails a test
 * instead of silently shipping a location whose biome does not exist.
 */
const BIOME_WORD_CUES: readonly (readonly [string, readonly string[]])[] = [
  ['dungeon', ['dungeon', 'crypt', 'tomb', 'catacomb', 'catacombs', 'vault', 'labyrinth', 'oubliette']],
  ['cave', ['cave', 'cavern', 'caverns', 'grotto', 'mine', 'mines', 'undercity', 'tunnels']],
  ['ocean', ['ocean', 'sea', 'strait', 'gulf', 'deeps']],
  ['coastal_reef', ['reef', 'shoals', 'atoll']],
  ['coastal_delta', ['delta', 'estuary']],
  ['coastal_beach', ['coast', 'shore', 'beach', 'harbor', 'harbour', 'port', 'bay', 'cliffs', 'isle', 'island']],
  ['wetland_swamp', ['swamp', 'mire', 'quagmire']],
  ['wetland_bog', ['bog', 'moor', 'moors', 'peat']],
  ['wetland_marsh', ['marsh', 'marshes', 'fen', 'fens', 'wetland', 'wetlands']],
  ['volcanic_lava_fields', ['volcano', 'volcanic', 'caldera', 'lava', 'magma']],
  ['volcanic_ashlands', ['ashlands', 'cinder', 'cinders', 'emberfields']],
  ['tundra_icefield', ['glacier', 'icefield', 'ice', 'floe']],
  ['tundra_permafrost', ['tundra', 'permafrost', 'arctic', 'taiga', 'frostlands']],
  ['mountain_crag', ['crag', 'crags', 'spire', 'spires', 'pinnacle']],
  ['mountain', ['mountain', 'mountains', 'peak', 'peaks', 'summit', 'alps', 'pass']],
  ['hills', ['hill', 'hills', 'highlands', 'downs', 'tor', 'vale']],
  ['desert_oasis', ['oasis']],
  ['desert_badlands', ['badlands', 'wasteland', 'wastes']],
  ['desert', ['desert', 'dunes', 'sands', 'sandsea']],
  ['jungle_ruins', ['overgrown']],
  ['jungle_tropical', ['jungle', 'rainforest', 'canopy']],
  ['forest_ancient', ['ancient wood', 'elderwood', 'old growth']],
  ['forest_haunted', ['haunted', 'blighted wood', 'gallows']],
  ['forest_fey', ['fey', 'feywild', 'enchanted grove']],
  ['forest', ['forest', 'forests', 'wood', 'woods', 'woodland', 'grove', 'thicket', 'copse', 'glade']],
  ['blight_cursed_land', ['blight', 'blightland', 'cursed', 'desolation']],
  ['plains_meadow', ['meadow', 'meadows']],
  ['plains_savanna', ['savanna', 'savannah', 'veldt']],
  ['plains', ['plain', 'plains', 'grassland', 'grasslands', 'steppe', 'prairie', 'fields', 'farmland', 'heath']],
];

/**
 * Compound-name stems, matched as substrings against the NAME ONLY.
 *
 * Fantasy place names fuse their terrain cue into one word ("Mirkwood",
 * "Frostmere"), which the whole-word pass above cannot see. This list is
 * deliberately short and made of stems that are rare inside unrelated words, and
 * it never runs against the narrative context, where a loose substring would
 * misfire constantly.
 */
const BIOME_NAME_STEMS: readonly (readonly [string, readonly string[]])[] = [
  ['forest', ['wood', 'shaw', 'holt']],
  ['mountain', ['peak', 'fell', 'horn']],
  ['hills', ['dale', 'down', 'combe']],
  ['wetland_marsh', ['mere', 'mire', 'fen']],
  ['coastal_beach', ['haven', 'port', 'strand']],
  ['tundra_permafrost', ['frost', 'snow', 'winter']],
  ['desert', ['sand', 'dune']],
];

/** Historical default when a name and its context say nothing about terrain. */
const DEFAULT_BIOME_ID = 'plains';

// ---------------------------------------------------------------------------
// NPC generation tables (agora-6e72)
// ---------------------------------------------------------------------------

/**
 * Whole-word cues that identify an NPC's functional role.
 *
 * `unique` is tested first: a title of rank ("Lord", "Archmage") says more about
 * an NPC than the trade word that may sit beside it. `civilian` has no row on
 * purpose — it is the fall-through, which is exactly the old behavior.
 */
const NPC_ROLE_CUES: readonly (readonly [NPC['role'], readonly string[]])[] = [
  ['unique', ['king', 'queen', 'emperor', 'empress', 'prince', 'princess', 'lord', 'lady', 'baron', 'baroness', 'duke', 'duchess', 'archmage', 'archdruid', 'chieftain', 'warlord', 'oracle']],
  ['merchant', ['merchant', 'trader', 'shopkeeper', 'vendor', 'peddler', 'broker', 'banker', 'smith', 'blacksmith', 'apothecary', 'alchemist', 'innkeeper', 'barkeep', 'tavernkeeper', 'fletcher', 'tanner']],
  ['guard', ['guard', 'guardsman', 'sentry', 'watchman', 'warden', 'constable', 'soldier', 'knight', 'sergeant', 'captain', 'militia', 'bailiff']],
  ['quest_giver', ['elder', 'mayor', 'steward', 'magistrate', 'priest', 'priestess', 'abbot', 'cleric', 'sage', 'scholar', 'archivist', 'librarian', 'foreman', 'guildmaster', 'hermit']],
];

/** Historical default when a name says nothing about what the NPC does. */
const DEFAULT_NPC_ROLE: NPC['role'] = 'civilian';

/**
 * Relationship words in the narrative context, and the archetype each implies.
 *
 * This is the "relationship cue" half of agora-6e72: when the text that produced
 * the name already frames the person as kin, an ally or an enemy, that framing is
 * better evidence about their disposition than the role table, so it overrides
 * the archetype the personality system would otherwise resolve. Anything not
 * listed leaves the archetype to `generatePersonality`.
 */
const RELATIONSHIP_ARCHETYPE_CUES: readonly (readonly [Archetype, readonly string[]])[] = [
  ['friendly', ['friend', 'ally', 'companion', 'mother', 'father', 'brother', 'sister', 'daughter', 'son', 'kin', 'mentor']],
  ['suspicious', ['rival', 'enemy', 'betrayer', 'traitor', 'foe', 'nemesis', 'assassin', 'thief']],
  ['melancholy', ['widow', 'widower', 'mourner', 'orphan', 'exile', 'outcast']],
];

export class EntityResolverService {
  /**
   * Scans text for potential entity references and validates them against the Game State.
   * @param text The narrative text to scan.
   * @param state The current GameState.
   */
  static resolveEntities(text: string, state: GameState): ResolverResult {
    const references: EntityReference[] = [];
    const validationErrors: string[] = [];

    // 1. Extract potential Proper Nouns / Entities
    const potentialEntities = this.extractProperNouns(text);

    for (const name of potentialEntities) {
      let type = this.guessEntityType(name, text);
      const resolution = this.checkExistence(name, type, state);

      // If we found it, force the type to match the existing entity type
      if (resolution.exists) {
         if (resolution.entityType) {
             type = resolution.entityType;
         }

        references.push({
          originalText: name,
          normalizedName: resolution.normalizedName,
          type: type,
          exists: true,
          entityId: resolution.id,
          confidence: 1.0
        });
      } else {
        // High confidence checks (e.g., "The Iron Ledger") should flag errors if missing.
        // Lower confidence checks (e.g., "John") might just be flavor.

        if (this.isMajorEntityCandidate(name)) {
            references.push({
                originalText: name,
                normalizedName: name, // Keep original as normalized since we didn't find it
                type: type,
                exists: false,
                confidence: 0.8
            });
            validationErrors.push(`Potential coherence gap: Text mentions '${name}' which was not found in world state.`);
        }
      }
    }

    return {
      text,
      references,
      validationErrors
    };
  }

  /**
   * Wraps resolveEntities for simple use cases, returning just the entities that need creation.
   * @param text Narrative text.
   * @param state GameState.
   * @returns Array of entity references that were NOT found.
   */
  static resolveEntitiesInText(text: string, state: GameState): EntityReference[] {
      const result = this.resolveEntities(text, state);
      return result.references.filter(ref => !ref.exists);
  }

  /**
   * Ensures an entity referenced by name exists in the game world.
   * If it exists, returns it.
   * If not, generates a new entity structure for it.
   *
   * @param type The type of entity (location, faction, npc)
   * @param name The name of the entity
   * @param state The current game state (to check for dynamic entities)
   * @param context Optional narrative text the name came from. When supplied it
   *   sharpens biome, role and relationship inference; when omitted the
   *   generators infer from the name alone, which is the historical behavior.
   * @returns An object containing the entity and a boolean indicating if it was newly created.
   */
  static async ensureEntityExists(type: EntityType, name: string, state: GameState, context?: string): Promise<EntityCreationResult> {
    const resolution = this.checkExistence(name, type, state);

    if (resolution.exists && resolution.id) {
      // Fetch existing entity
      if (resolution.entityType === 'faction') {
        const faction = state.factions[resolution.id] || FACTIONS[resolution.id];
        return { entity: faction, created: false, type: 'faction' };
      }
      if (resolution.entityType === 'location') {
        const location = state.dynamicLocations[resolution.id] || LOCATIONS[resolution.id];
        // We might also match a landmark, which isn't a full location, but for now treat it as found.
        // If it was a template landmark, we might need to instantiate it, but let's assume existence for now.
        return { entity: location || null, created: false, type: 'location' };
      }
      if (resolution.entityType === 'npc') {
          // Attempt to fetch from static list first
          const npc = NPCS[resolution.id];
          // If not static, it might be in npcMemory (though npcMemory doesn't store full NPC objects, just state)
          // For now, if we found an ID, we assume it's valid.
          // If we had a dynamic NPC registry, we'd fetch it there.
          if (npc) {
              return { entity: npc, created: false, type: 'npc' };
          }
          // If it was found via metNpcIds but not in NPCS, we might need to construct a partial or fetch from a different source.
          // Fallback to creating a fresh one if we can't fully resolve the object?
          // For safety, let's treat "found ID but no object" as needing re-generation or a deep search.
          // But checkExistence only returns true if we found a match.
      }
    }

    // Entity does not exist - Create it
    if (type === 'faction') {
      const newFaction = this.createFaction(name, context);
      return { entity: newFaction, created: true, type: 'faction' };
    } else if (type === 'location') {
      const newLocation = this.createLocation(name, context);
      return { entity: newLocation, created: true, type: 'location' };
    } else if (type === 'npc') {
      const newNPC = this.createNPC(name, context);
      return { entity: newNPC, created: true, type: 'npc' };
    }

    return { entity: null, created: false, type };
  }


  /**
   * Checks if an entity exists in the static data or dynamic state.
   */
  private static checkExistence(name: string, assumedType: EntityType, state: GameState): { exists: boolean, id?: string, normalizedName: string, entityType?: EntityType } {
    const normalized = name.toLowerCase();

    // 1. Check Factions
    // Check static factions
    const staticFaction = Object.values(FACTIONS).find(f => f.name.toLowerCase() === normalized);
    if (staticFaction) return { exists: true, id: staticFaction.id, normalizedName: staticFaction.name, entityType: 'faction' };

    // Check dynamic factions in state
    if (state.factions) {
        const dynamicFaction = Object.values(state.factions).find(f => f.name.toLowerCase() === normalized);
        if (dynamicFaction) return { exists: true, id: dynamicFaction.id, normalizedName: dynamicFaction.name, entityType: 'faction' };
    }

    // 2. Check Locations / Landmarks
    // Check static locations
    const staticLocation = Object.values(LOCATIONS).find(l => l.name.toLowerCase() === normalized);
    if (staticLocation) return { exists: true, id: staticLocation.id, normalizedName: staticLocation.name, entityType: 'location' };

    // Check dynamic locations in state
    if (state.dynamicLocations) {
      const dynamicLocation = Object.values(state.dynamicLocations).find(l => l.name.toLowerCase() === normalized);
      if (dynamicLocation) return { exists: true, id: dynamicLocation.id, normalizedName: dynamicLocation.name, entityType: 'location' };
    }

    // Static landmarks (Templates)
    const landmark = LANDMARK_TEMPLATES.find(l => l.nameTemplate.some(t => t.toLowerCase() === normalized));
    if (landmark) return { exists: true, id: landmark.id, normalizedName: name, entityType: 'location' };

    // 3. Check NPCs
    // Check static NPCs
    const staticNPC = Object.values(NPCS).find(n => n.name.toLowerCase() === normalized);
    if (staticNPC) return { exists: true, id: staticNPC.id, normalizedName: staticNPC.name, entityType: 'npc' };

    // Check met NPCs (State) - we only have IDs, so we can't easily search by name unless we have a lookup
    // But we can check if the normalized name matches any ID if IDs are name-based (often true: 'old_hermit')
    // This is a weak check but better than nothing.
    // Ideally, GameState would cache names of met NPCs.
    // For now, let's assume if it's not in NPCS, we don't know its name unless we scan `npcMemory` or similar?
    // npcMemory is keyed by ID.
    // If we can't find it by name in a registry, we assume it doesn't exist.

    return { exists: false, normalizedName: name };
  }

  // -------------------------------------------------------------------------
  // Inference helpers
  // -------------------------------------------------------------------------

  /**
   * Turns a name into a stable 31-bit seed.
   *
   * The same name must always roll the same faction, because `ensureEntityExists`
   * can be called again for the same narrative name before the entity has been
   * committed to state; a wall-clock seed would hand back a different faction each
   * time and make the world contradict itself.
   */
  private static seedFromName(name: string): number {
    let hash = 0;
    const normalized = name.toLowerCase();
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 1;
  }

  /** Lowercased whole-word token set for `name` plus optional `context`. */
  private static cueTokens(name: string, context?: string): Set<string> {
    const haystack = context ? `${name} ${context}` : name;
    return new Set(haystack.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  }

  /**
   * Infers a faction kind from its name and the text it appeared in.
   * Returns the historical `GUILD` default when nothing matches.
   */
  private static inferFactionType(name: string, context?: string): FactionType {
    const tokens = this.cueTokens(name, context);
    for (const [factionType, keywords] of FACTION_TYPE_KEYWORDS) {
      if (keywords.some(keyword => tokens.has(keyword))) return factionType;
    }
    return DEFAULT_FACTION_TYPE;
  }

  /**
   * Infers a `BIOMES` id from a location name and the text it appeared in.
   *
   * Two passes: whole words over name+context first (precise), then compound
   * stems over the name only (catches "Mirkwood"). Returns `plains` when neither
   * pass matches, which is the historical default.
   */
  private static inferBiomeId(name: string, context?: string): string {
    const tokens = this.cueTokens(name, context);
    const lowerName = name.toLowerCase();

    for (const [biomeId, cues] of BIOME_WORD_CUES) {
      if (cues.some(cue => (cue.includes(' ') ? lowerName.includes(cue) : tokens.has(cue)))) {
        return biomeId;
      }
    }

    for (const [biomeId, stems] of BIOME_NAME_STEMS) {
      if (stems.some(stem => lowerName.includes(stem))) return biomeId;
    }

    return DEFAULT_BIOME_ID;
  }

  /**
   * Infers an NPC role from the name and the text it appeared in.
   * Returns the historical `civilian` default when nothing matches.
   */
  private static inferNpcRole(name: string, context?: string): NPC['role'] {
    const tokens = this.cueTokens(name, context);
    for (const [role, cues] of NPC_ROLE_CUES) {
      if (cues.some(cue => tokens.has(cue))) return role;
    }
    return DEFAULT_NPC_ROLE;
  }

  /**
   * Finds a relationship framing for this NPC in the surrounding narrative.
   * Returns `undefined` when the text carries no relationship word, which leaves
   * the archetype to the personality system's own role x biome table.
   */
  private static inferRelationshipArchetype(context?: string): Archetype | undefined {
    if (!context) return undefined;
    const tokens = this.cueTokens('', context);
    for (const [archetype, cues] of RELATIONSHIP_ARCHETYPE_CUES) {
      if (cues.some(cue => tokens.has(cue))) return archetype;
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Stub generators
  // -------------------------------------------------------------------------

  /**
   * Generates a new Faction from its name (agora-02c9).
   *
   * WHAT CHANGED: the two empty-perk stub ranks became a five-rung ladder chosen
   * by inferred faction kind, with perk ids in the same vocabulary the authored
   * factions use, plus kind-appropriate values/hates/colors/economic policy and a
   * seeded power, treasury and tax rate.
   *
   * WHAT WAS PRESERVED: an unrecognizable name still produces a GUILD, and every
   * field the old stub set still exists with a sensible value, so nothing that
   * consumed a generated faction has to change.
   */
  private static createFaction(name: string, context?: string): Faction {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const factionType = this.inferFactionType(name, context);
    const disposition = FACTION_DISPOSITIONS[factionType];
    const rng = new SeededRandom(this.seedFromName(name));

    const ranks: FactionRank[] = FACTION_RANK_LADDERS[factionType].map((rung, index) => ({
      id: rung.id,
      name: rung.name,
      level: index + 1,
      description: rung.description,
      perks: [...rung.perks],
    }));

    // nextInt is MAX-EXCLUSIVE, so the band's upper bound is passed + 1 to keep it inclusive.
    const [powerMin, powerMax] = disposition.powerBand;
    const power = rng.nextInt(powerMin, powerMax + 1);

    // A faction's purse and its tax bite both track its influence: a 90-power
    // government is rich and taxes hard, a 20-power cabal has neither reach.
    const treasury = power * rng.nextInt(80, 220);
    const taxRate = disposition.economicPolicy === 'free_trade' ? 0 : Math.round(power / 8);

    return {
      id,
      name,
      description: `${name} is ${this.describeFactionType(factionType)}.`,
      type: factionType,
      colors: { ...disposition.colors },
      ranks,
      allies: [],
      enemies: [],
      rivals: [],
      relationships: {},
      values: [...disposition.values],
      hates: [...disposition.hates],
      power,
      assets: [],
      treasury,
      taxRate,
      controlledRegionIds: [],
      controlledRouteIds: [],
      economicPolicy: disposition.economicPolicy,
      tradeGoodPriorities: [...FACTION_TRADE_PRIORITIES[factionType]],
    };
  }

  /** One-clause description of a faction kind, used in generated descriptions. */
  private static describeFactionType(factionType: FactionType): string {
    switch (factionType) {
      case 'NOBLE_HOUSE': return 'a noble house whose name carries weight and old debts';
      case 'RELIGIOUS_ORDER': return 'a religious order bound by vows and doctrine';
      case 'CRIMINAL_SYNDICATE': return 'a criminal syndicate that works through fear and favors';
      case 'GOVERNMENT': return 'a governing body that writes the law it enforces';
      case 'MILITARY': return 'a fighting company that answers to a chain of command';
      case 'SECRET_SOCIETY': return 'a secret society few can name and fewer can find';
      case 'GUILD':
      default: return 'a chartered guild of tradesfolk and their coin';
    }
  }

  /**
   * Generates a new Location from its name (agora-6e72).
   *
   * WHAT CHANGED: `biomeId` is inferred from terrain words in the name and in the
   * narrative context instead of always being `plains`, and the description names
   * the terrain so the AI's next paragraph stays consistent with it.
   *
   * WHAT WAS PRESERVED: `plains` remains the answer when no terrain word is
   * present, `exits` stays empty (the caller wires connectivity), and the Location
   * still carries no grid coordinates after the 2026-07-01 grid retirement.
   */
  private static createLocation(name: string, context?: string): Location {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const biomeId = this.inferBiomeId(name, context);
    const biomeName = BIOMES[biomeId]?.name;

    return {
      id,
      name,
      baseDescription: biomeName
        ? `You have arrived at ${name}. The land here is ${biomeName.toLowerCase()}.`
        : `You have arrived at ${name}.`,
      exits: {},
      biomeId
    };
  }

  /**
   * Generates a new NPC from its name (agora-6e72).
   *
   * WHAT CHANGED: the role is inferred from titles and trade words instead of
   * always being `civilian`, and the NPC now carries a real `personality` built by
   * the shared `systems/npcPersonality` generator rather than a bare prompt line.
   * A relationship word in the surrounding narrative ("your brother", "the
   * traitor") overrides the archetype that role x biome would resolve, because the
   * text that named this person is the better evidence about them.
   *
   * WHAT WAS PRESERVED: `civilian` is still the answer for a plain name,
   * `initialPersonalityPrompt` and `dialoguePromptSeed` are still populated in the
   * same shape dialogue already reads, and `personality` is optional on `NPC`, so
   * every consumer that ignores it behaves exactly as before.
   */
  private static createNPC(name: string, context?: string): NPC {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const role = this.inferNpcRole(name, context);
    const relationshipArchetype = this.inferRelationshipArchetype(context);

    const personality = generatePersonality({
      role,
      // The name doubles as the occupation hint: the archetype table reads
      // "Bramwell the Blacksmith" better than the functional role `merchant`.
      occupation: name,
      biomeId: context ? this.inferBiomeId(name, context) : undefined,
      worldSeed: this.seedFromName(name),
      identity: id,
      archetype: relationshipArchetype,
    });

    const quirkLine = personality.quirks.length > 0 ? ` ${personality.quirks.join(' ')}` : '';

    return {
      id,
      name,
      baseDescription: `You see ${name}, ${this.describeNpcRole(role)}.`,
      initialPersonalityPrompt: `You are ${name}, ${this.describeNpcRole(role)}. Your disposition is ${personality.archetype}.${quirkLine} You are a stranger to the player.`,
      role,
      dialoguePromptSeed: `${name} looks at you curiously.`,
      personality
    };
  }

  /** One-clause description of an NPC role, used in generated prose and prompts. */
  private static describeNpcRole(role: NPC['role']): string {
    switch (role) {
      case 'merchant': return 'someone who makes a living selling to strangers';
      case 'guard': return 'someone paid to keep order here';
      case 'quest_giver': return 'someone people here bring their problems to';
      case 'unique': return 'someone used to being obeyed';
      case 'civilian':
      default: return 'an ordinary person going about their day';
    }
  }

  /**
   * Extracts capitalized phrases from text.
   * e.g., "I went to Silverdale and saw King Arthur." -> ["Silverdale", "King Arthur"]
   */
  private static extractProperNouns(text: string): string[] {
    const ignoredWords = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'To', 'From', 'By', 'With', 'And', 'But', 'Or', 'Nor', 'For', 'Yet', 'So', 'I', 'My', 'We', 'They', 'It', 'He', 'She']);
    const found = new Set<string>();

    // Regex to match Capitalized Words (one or more)
    // Avoid matching start of sentences if they are common words (handled by ignoredWords check mostly)
    const regex = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const word = match[0];

        // Filter out single ignored words (e.g., "The" at start of sentence)
        // Check if the word is in the ignored list AND it's a single word (no spaces)
        if (!word.includes(' ') && ignoredWords.has(word)) continue;

        // Filter out common false positives
        if (word.length < 3) continue;

        found.add(word);
    }

    return Array.from(found);
  }

  /**
   * Guesses the type of entity based on context keywords.
   */
  private static guessEntityType(name: string, context: string): EntityType {
    const lowerContext = context.toLowerCase();
    const lowerName = name.toLowerCase();

    if (lowerContext.includes(`visit ${lowerName}`) || lowerContext.includes(`travel to ${lowerName}`) || lowerContext.includes(`in ${lowerName}`)) return 'location';
    if (lowerContext.includes(`join ${lowerName}`) || lowerContext.includes(`fight ${lowerName}`) || lowerContext.includes(`guild`)) return 'faction';

    // Default to NPC for names
    return 'npc';
  }

  private static isMajorEntityCandidate(name: string): boolean {
    // Heuristic: Multi-word names or names with titles are more likely to be specific entities we should know about.
    // e.g. "Silverdale" vs "Barn" (if capitalized by mistake)
    // "The Iron Ledger" vs "The"
    if (name.split(' ').length > 1) return true;
    // Single names like "Gandalf" are also major, but hard to distinguish from "Chair" if capitalized at start.
    // We rely on extractProperNouns to filter common words.
    return false;
  }
}

/**
 * Generation tables exported for the unit test that asserts every biome id this
 * service can emit is a real `BIOMES` key, and that every faction kind has a
 * rank ladder. Exported deliberately rather than duplicated in the test: a
 * duplicated table cannot catch a typo in the real one.
 */
export const ENTITY_RESOLVER_TABLES = {
  FACTION_TYPE_KEYWORDS,
  FACTION_RANK_LADDERS,
  FACTION_DISPOSITIONS,
  FACTION_TRADE_PRIORITIES,
  BIOME_WORD_CUES,
  BIOME_NAME_STEMS,
  NPC_ROLE_CUES,
  RELATIONSHIP_ARCHETYPE_CUES,
  DEFAULT_FACTION_TYPE,
  DEFAULT_BIOME_ID,
  DEFAULT_NPC_ROLE,
} as const;
