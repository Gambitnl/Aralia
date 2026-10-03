// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: services/travelEventService.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { createSeededRandom } from '../utils/spatial/submapUtils';
import { DiscoveryReward, DiscoveryConsequence } from '../types/exploration';
import {
  LANDMARK_ORIGINS,
  LANDMARK_TYPES,
  LANDMARK_STATES,
  LandmarkOrigin,
  LandmarkState,
} from '../data/landmarkGenData';
import { LootTable, LootEntry } from '../types/loot';
import { ALL_ITEMS } from '../data/items';

// -----------------------------------------------------------------------------
// Landmark loot tables
// -----------------------------------------------------------------------------
//
// WHAT CHANGED (agora-8aa4): the 'item' reward branch used to coin-flip between
// 'healing_potion' and 'torch'. It now rolls a real loot table, so what a ruin
// yields reads as the work of whoever built it.
//
// WHY HERE: `src/types/loot.ts` already defined the LootTable / LootPool /
// LootEntry schema (weights, quantity ranges, per-entry chance, unique pools,
// nested table references) but nothing in the repo rolled against it. This is
// that schema's first consumer rather than a new parallel system.
//
// WHAT IS PRESERVED: generation stays deterministic on the landmark rng, the
// reward still arrives as a single DiscoveryReward[] entry list, and every
// origin that data may later mark as item-bearing has a table, not just the two
// that carry 'item' in LANDMARK_ORIGINS today.
//
// WHAT IS DEFERRED: LootTable.conditions (minLevel / playerClass) is NOT
// evaluated here, because generateLandmark is given no character. Landmark
// tables therefore declare no conditions; a table that grows one must also grow
// a caller that can answer it.

/** Guards a cycle in `table_reference` entries. */
const MAX_LOOT_TABLE_DEPTH = 3;

/**
 * Loot shared by every ruin regardless of who raised it: the leavings of the
 * scavengers and wayfarers who sheltered there after it fell.
 */
const WAYFARER_CACHE: LootTable = {
  id: 'landmark_loot_wayfarer',
  name: 'Wayfarer Cache',
  description: 'Supplies left behind by whoever last sheltered in the ruin.',
  pools: [
    {
      rolls: { min: 1, max: 1 },
      entries: [
        { type: 'item', id: 'torch', weight: 5, minQuantity: 1, maxQuantity: 3 },
        { type: 'item', id: 'rations', weight: 4, minQuantity: 1, maxQuantity: 2 },
        { type: 'item', id: 'oil_flask', weight: 3 },
        { type: 'item', id: 'healing_potion', weight: 2 },
        { type: 'item', id: 'old_map_fragment', weight: 1 },
      ],
    },
  ],
};

/**
 * The high-risk table. Rolled in place of the origin table when the landmark's
 * state is dangerous (riskLevel >= HIGH_RISK_LOOT_THRESHOLD): the places that
 * can kill you are the places nobody stripped.
 */
const DEEP_VAULT: LootTable = {
  id: 'landmark_loot_deep',
  name: 'Undisturbed Vault',
  description: 'What survives where the danger kept looters out.',
  pools: [
    {
      rolls: { min: 1, max: 1 },
      entries: [
        { type: 'item', id: 'amulet_of_health', weight: 1 },
        { type: 'item', id: 'cloak_of_protection', weight: 1 },
        { type: 'item', id: 'ring_of_protection', weight: 1 },
        { type: 'item', id: 'shield_plus_one', weight: 1 },
        { type: 'item', id: 'breastplate', weight: 2 },
        { type: 'item', id: 'diamond_300gp', weight: 2 },
        { type: 'item', id: 'healing_potion', weight: 4, minQuantity: 1, maxQuantity: 2 },
        { type: 'table_reference', id: 'landmark_loot_wayfarer', weight: 3 },
      ],
    },
    {
      // A hoard usually carries coin alongside the prize.
      rolls: { min: 1, max: 1 },
      entries: [
        { type: 'currency', id: 'gold', weight: 3, minQuantity: 40, maxQuantity: 120 },
        { type: 'nothing', weight: 2 },
      ],
    },
  ],
};

/**
 * One table per landmark origin, keyed by LandmarkOrigin.id. Every origin gets a
 * table even where LANDMARK_ORIGINS does not currently list 'item' among its
 * rewardTypes, so that adding 'item' to an origin is a pure data edit.
 */
export const LANDMARK_LOOT_TABLES: Record<string, LootTable> = {
  [WAYFARER_CACHE.id]: WAYFARER_CACHE,
  [DEEP_VAULT.id]: DEEP_VAULT,

  landmark_loot_elven: {
    id: 'landmark_loot_elven',
    name: 'Elven Landmark Cache',
    pools: [
      {
        rolls: { min: 1, max: 1 },
        entries: [
          { type: 'item', id: 'silver_necklace', weight: 3 },
          { type: 'item', id: 'silver_ring', weight: 3 },
          { type: 'item', id: 'travelers_cloak', weight: 2 },
          { type: 'item', id: 'leather_bracers', weight: 2 },
          { type: 'item', id: 'shortbow', weight: 2 },
          { type: 'item', id: 'rapier', weight: 1 },
          { type: 'item', id: 'healing_potion', weight: 3 },
          { type: 'table_reference', id: 'landmark_loot_wayfarer', weight: 4 },
        ],
      },
    ],
  },

  landmark_loot_dwarven: {
    id: 'landmark_loot_dwarven',
    name: 'Dwarven Landmark Cache',
    pools: [
      {
        rolls: { min: 1, max: 1 },
        entries: [
          { type: 'item', id: 'warhammer', weight: 3 },
          { type: 'item', id: 'handaxe', weight: 3 },
          { type: 'item', id: 'war_pick', weight: 2 },
          { type: 'item', id: 'battleaxe', weight: 2 },
          { type: 'item', id: 'steel_helmet', weight: 2 },
          { type: 'item', id: 'chain_shirt', weight: 1 },
          { type: 'item', id: 'thieves-tools', weight: 1 },
          { type: 'table_reference', id: 'landmark_loot_wayfarer', weight: 4 },
        ],
      },
    ],
  },

  landmark_loot_ancient: {
    id: 'landmark_loot_ancient',
    name: 'Ancient Landmark Cache',
    pools: [
      {
        rolls: { min: 1, max: 1 },
        entries: [
          { type: 'item', id: 'rusty_sword', weight: 4 },
          { type: 'item', id: 'ring_mail', weight: 2 },
          { type: 'item', id: 'leather_armor', weight: 2 },
          { type: 'item', id: 'old_map_fragment', weight: 3 },
          { type: 'item', id: 'lodestone_pair', weight: 1 },
          { type: 'table_reference', id: 'landmark_loot_wayfarer', weight: 4 },
        ],
      },
    ],
  },

  landmark_loot_draconic: {
    id: 'landmark_loot_draconic',
    name: 'Draconic Landmark Hoard',
    pools: [
      {
        rolls: { min: 1, max: 1 },
        entries: [
          { type: 'item', id: 'gold_ring', weight: 3 },
          { type: 'item', id: 'platinum_piece', weight: 3, minQuantity: 1, maxQuantity: 4 },
          { type: 'item', id: 'scale_mail', weight: 2 },
          { type: 'item', id: 'diamond_300gp', weight: 1 },
          { type: 'item', id: 'shiny_coin', weight: 2, minQuantity: 2, maxQuantity: 6 },
          { type: 'table_reference', id: 'landmark_loot_wayfarer', weight: 2 },
        ],
      },
    ],
  },

  landmark_loot_fey: {
    id: 'landmark_loot_fey',
    name: 'Fey Landmark Cache',
    pools: [
      {
        rolls: { min: 1, max: 1 },
        entries: [
          { type: 'item', id: 'healing_potion', weight: 4 },
          { type: 'item', id: 'silver_ring', weight: 3 },
          { type: 'item', id: 'travelers_cloak', weight: 2 },
          { type: 'item', id: 'lodestone_pair', weight: 2 },
          { type: 'item', id: 'shiny_coin', weight: 2, minQuantity: 1, maxQuantity: 3 },
          { type: 'table_reference', id: 'landmark_loot_wayfarer', weight: 3 },
        ],
      },
    ],
  },
};

/** A landmark state this dangerous rolls the undisturbed-vault table instead. */
const HIGH_RISK_LOOT_THRESHOLD = 5;

/** Picks an index into `entries` in proportion to each entry's weight. */
function pickWeightedIndex(entries: LootEntry[], rng: () => number): number {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    throw new Error('landmarkService: loot pool has no positive weight');
  }
  let roll = rng() * totalWeight;
  for (let i = 0; i < entries.length; i++) {
    roll -= entries[i].weight;
    if (roll <= 0) return i;
  }
  return entries.length - 1;
}

/** Rolls a quantity inside an entry's declared range (defaults to exactly 1). */
function rollQuantity(entry: LootEntry, rng: () => number): number {
  const min = entry.minQuantity ?? 1;
  const max = entry.maxQuantity ?? min;
  if (max < min) {
    throw new Error(`landmarkService: loot entry "${entry.id ?? entry.type}" has maxQuantity < minQuantity`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Rolls one loot table into DiscoveryReward entries.
 *
 * Unknown table ids, unknown item ids, and unsupported currencies throw instead
 * of silently degrading: a landmark that cannot name its own prize is a data
 * bug, and hiding it behind a default potion is what this task removed.
 */
export function rollLandmarkLootTable(
  tableId: string,
  rng: () => number,
  depth: number = 0
): DiscoveryReward[] {
  if (depth > MAX_LOOT_TABLE_DEPTH) {
    throw new Error(`landmarkService: loot table "${tableId}" nests deeper than ${MAX_LOOT_TABLE_DEPTH}`);
  }
  const table = LANDMARK_LOOT_TABLES[tableId];
  if (!table) {
    throw new Error(`landmarkService: unknown loot table "${tableId}"`);
  }

  const rewards: DiscoveryReward[] = [];

  for (const pool of table.pools) {
    if (pool.rolls.max < pool.rolls.min) {
      throw new Error(`landmarkService: loot pool in "${tableId}" has max rolls below min`);
    }
    const rolls = pool.rolls.min + Math.floor(rng() * (pool.rolls.max - pool.rolls.min + 1));
    const usedIndices = new Set<number>();

    for (let roll = 0; roll < rolls; roll++) {
      const candidates = pool.unique
        ? pool.entries.filter((_, index) => !usedIndices.has(index))
        : pool.entries;
      if (candidates.length === 0) break;

      const candidateIndex = pickWeightedIndex(candidates, rng);
      const entry = candidates[candidateIndex];
      if (pool.unique) {
        usedIndices.add(pool.entries.indexOf(entry));
      }

      // Per-entry chance is checked AFTER selection, as src/types/loot.ts states.
      if (entry.chance !== undefined && rng() > entry.chance) continue;
      if (entry.type === 'nothing') continue;

      if (entry.type === 'table_reference') {
        rewards.push(...rollLandmarkLootTable(entry.id, rng, depth + 1));
        continue;
      }

      const quantity = rollQuantity(entry, rng);

      if (entry.type === 'currency') {
        if (entry.id !== 'gold') {
          throw new Error(`landmarkService: landmark rewards carry only 'gold', got "${entry.id}"`);
        }
        rewards.push({
          type: 'gold',
          amount: quantity,
          description: `A cache of ${quantity} gold coins lies among the stones.`,
        });
        continue;
      }

      const item = ALL_ITEMS[entry.id];
      if (!item) {
        throw new Error(`landmarkService: loot table "${tableId}" names unknown item "${entry.id}"`);
      }
      rewards.push({
        type: 'item',
        resourceId: entry.id,
        amount: quantity,
        description:
          quantity > 1
            ? `You discover ${quantity} ${item.name}.`
            : `You discover a ${item.name}.`,
      });
    }
  }

  return rewards;
}

/**
 * Chooses which table an item reward rolls on. Dangerous sites keep their best
 * things, because the danger is what kept the looters out.
 */
function rollLandmarkItemReward(
  origin: LandmarkOrigin,
  state: LandmarkState,
  rng: () => number
): DiscoveryReward[] {
  const tableId =
    state.riskLevel >= HIGH_RISK_LOOT_THRESHOLD ? DEEP_VAULT.id : `landmark_loot_${origin.id}`;
  return rollLandmarkLootTable(tableId, rng);
}

export interface GeneratedLandmark {
  id: string;
  name: string;
  description: string;
  type: string;
  rewards: DiscoveryReward[];
  consequences: DiscoveryConsequence[];
}

/**
 * Generates a landmark for a given world location if one exists.
 * This is deterministic based on world seed and coordinates.
 *
 * Uses a combinatorial approach (Origin + Type + State) to generate varied content.
 */
export function generateLandmark(
  worldSeed: number,
  coordinates: { x: number; y: number },
  biomeId: string
): GeneratedLandmark | null {
  // Use a specific seed suffix for landmarks to ensure separation from other generation
  const rng = createSeededRandom(worldSeed, coordinates, biomeId, 'landmark_gen_v2');

  // 15% chance to have a landmark in any wilderness tile (increased from 10% because they are cooler now)
  if (rng() > 0.15) {
    return null;
  }

  // 1. Select Origin based on Biome and Rarity
  const validOrigins = LANDMARK_ORIGINS.filter(o => o.commonBiomes.includes('all') || o.commonBiomes.includes(biomeId));
  if (validOrigins.length === 0) return null; // Should not happen given 'Ancient' exists
  const origin = validOrigins[Math.floor(rng() * validOrigins.length)];

  // 2. Select Type
  // Use baseWeight for weighted selection
  const totalWeight = LANDMARK_TYPES.reduce((sum, t) => sum + t.baseWeight, 0);
  let randomVal = rng() * totalWeight;
  let type = LANDMARK_TYPES[LANDMARK_TYPES.length - 1];

  for (const t of LANDMARK_TYPES) {
    randomVal -= t.baseWeight;
    if (randomVal <= 0) {
      type = t;
      break;
    }
  }

  // 3. Select State
  const state = LANDMARK_STATES[Math.floor(rng() * LANDMARK_STATES.length)];

  // 4. Construct Name
  // e.g. "Overgrown Elven Shrine", "Haunted Ancient Tower"
  // Format: "{State.Suffix} {Origin.Name} {Type.Name}" or "{Origin.Name} {Type.Name}"
  // Let's make it natural.
  let name = `${origin.name} ${type.name}`;
  if (rng() > 0.5 && state.id !== 'pristine') {
     // Use adjective form roughly
     name = `${state.nameSuffix} ${name}`;
  }

  // 5. Construct Description
  const descTemplate = type.descriptionTemplates[Math.floor(rng() * type.descriptionTemplates.length)];
  let description = descTemplate.replace('{origin}', origin.name.toLowerCase());
  description += ` ${state.descriptionModifier}`;

  // Add flavor adjective
  const flavorAdj = origin.descriptionPrefix[Math.floor(rng() * origin.descriptionPrefix.length)];
  description = description.replace(origin.name.toLowerCase(), `${flavorAdj.toLowerCase()} ${origin.name.toLowerCase()}`);


  // 6. Generate Rewards (Based on Origin & State)
  const rewards: DiscoveryReward[] = [];

  // If state is 'looted', reduce rewards significantly
  const isLooted = state.id === 'looted';
  const rewardChance = isLooted ? 0.2 : 0.8;

  if (rng() < rewardChance) {
      // Pick a reward type appropriate for the origin
      const rewardType = origin.rewardTypes[Math.floor(rng() * origin.rewardTypes.length)];

      switch (rewardType) {
          case 'gold': {
              const goldAmount = Math.floor(rng() * 50) + 10 + (state.riskLevel * 10);
              rewards.push({
                  type: 'gold',
                  amount: goldAmount,
                  description: `You find ${goldAmount} gold coins hidden in the structure.`
              });
              break;
          }
          case 'xp': {
              const xpAmount = 25 + (state.riskLevel * 25);
              rewards.push({
                  type: 'xp',
                  amount: xpAmount,
                  description: `Investigating the site grants ${xpAmount} XP.`
              });
              break;
          }
          case 'health': {
              const healAmount = 10 + Math.floor(rng() * 10);
              rewards.push({
                  type: 'health',
                  amount: healAmount,
                  description: `A lingering aura of restoration heals you for ${healAmount} HP.`
              });
              break;
          }
          case 'item': {
              // agora-8aa4: rolls the origin's loot table (or the undisturbed-vault
              // table at high risk) instead of the old healing_potion/torch coin flip.
              // A high-risk table roll can yield coin alongside the item, so this
              // branch may now push more than one reward.
              rewards.push(...rollLandmarkItemReward(origin, state, rng));
              break;
          }
      }
  }

  // 7. Generate Consequences (Based on State)
  const consequences: DiscoveryConsequence[] = [];

  state.consequenceTypes.forEach(cType => {
      // For risky states (riskLevel >= 5), increase chance of consequence
      const chance = state.riskLevel >= 5 ? 0.8 : 0.6;

      if (rng() < chance) {
          if (cType === 'map_reveal') {
              const radius = 1 + Math.floor(rng() * 2);
              consequences.push({
                  type: 'map_reveal',
                  value: radius,
                  description: 'The high vantage point allows you to chart the surrounding area.'
              });
          } else if (cType === 'reputation') {
              // Pick a random faction or guild?
              // For now, let's say 'explorers_guild' or similar
              consequences.push({
                  type: 'reputation',
                  targetId: 'explorers_guild',
                  value: 5,
                  description: 'Mapping this location impresses the Explorers Guild.'
              });
          } else if (cType === 'damage') {
              const damageAmount = 2 + Math.floor(rng() * state.riskLevel);
              consequences.push({
                  type: 'damage',
                  value: damageAmount,
                  description: `A trap triggers or the structure collapses! You take ${damageAmount} damage.`
              });
          } else if (cType === 'debuff') {
              const duration = 2 + Math.floor(rng() * 4);
              consequences.push({
                  type: 'debuff',
                  targetId: 'haunted_chill',
                  duration: duration,
                  description: `A supernatural chill clings to you for ${duration} hours.`
              });
          }
      }
  });

  return {
    id: `landmark_${origin.id}_${type.id}_${coordinates.x}_${coordinates.y}`,
    name: name,
    description: description,
    type: 'procedural_landmark',
    rewards,
    consequences
  };
}
