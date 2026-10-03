/**
 * @file src/services/__tests__/landmarkServiceLoot.test.ts
 * Covers the landmark loot tables added for agora-8aa4, which replaced the
 * healing_potion / torch coin flip in generateLandmark's 'item' reward branch.
 */
import { describe, it, expect } from 'vitest';
import {
  generateLandmark,
  rollLandmarkLootTable,
  LANDMARK_LOOT_TABLES,
} from '../landmarkService';
import { ALL_ITEMS } from '../../data/items';
import { LANDMARK_ORIGINS } from '../../data/landmarkGenData';

/** A deterministic stand-in for the landmark rng, so a roll can be replayed. */
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

describe('landmark loot tables (agora-8aa4)', () => {
  describe('table data integrity', () => {
    it('every item entry names an item that exists in ALL_ITEMS', () => {
      const missing: string[] = [];
      for (const [tableId, table] of Object.entries(LANDMARK_LOOT_TABLES)) {
        for (const pool of table.pools) {
          for (const entry of pool.entries) {
            if (entry.type === 'item' && !ALL_ITEMS[entry.id]) {
              missing.push(`${tableId} -> ${entry.id}`);
            }
          }
        }
      }
      expect(missing).toEqual([]);
    });

    it('every table_reference entry points at a table that exists', () => {
      const dangling: string[] = [];
      for (const [tableId, table] of Object.entries(LANDMARK_LOOT_TABLES)) {
        for (const pool of table.pools) {
          for (const entry of pool.entries) {
            if (entry.type === 'table_reference' && !LANDMARK_LOOT_TABLES[entry.id]) {
              dangling.push(`${tableId} -> ${entry.id}`);
            }
          }
        }
      }
      expect(dangling).toEqual([]);
    });

    it('every landmark origin has a matching loot table', () => {
      const withoutTable = LANDMARK_ORIGINS.filter(
        (origin) => !LANDMARK_LOOT_TABLES[`landmark_loot_${origin.id}`]
      ).map((origin) => origin.id);
      expect(withoutTable).toEqual([]);
    });

    it('declares positive weights and coherent quantity ranges', () => {
      for (const [tableId, table] of Object.entries(LANDMARK_LOOT_TABLES)) {
        for (const pool of table.pools) {
          expect(pool.rolls.max, tableId).toBeGreaterThanOrEqual(pool.rolls.min);
          expect(pool.entries.length, tableId).toBeGreaterThan(0);
          for (const entry of pool.entries) {
            expect(entry.weight, `${tableId} ${entry.id ?? entry.type}`).toBeGreaterThan(0);
            const min = entry.minQuantity ?? 1;
            const max = entry.maxQuantity ?? min;
            expect(max, `${tableId} ${entry.id ?? entry.type}`).toBeGreaterThanOrEqual(min);
          }
        }
      }
    });

    it('declares no conditions, because generateLandmark cannot evaluate them', () => {
      for (const [tableId, table] of Object.entries(LANDMARK_LOOT_TABLES)) {
        expect(table.conditions, tableId).toBeUndefined();
      }
    });
  });

  describe('rollLandmarkLootTable', () => {
    it('is deterministic for the same rng stream', () => {
      const first = rollLandmarkLootTable('landmark_loot_dwarven', makeRng(4242));
      const second = rollLandmarkLootTable('landmark_loot_dwarven', makeRng(4242));
      expect(first).toEqual(second);
    });

    it('produces rewards the reward pipeline can consume', () => {
      for (let seed = 1; seed <= 200; seed++) {
        const rewards = rollLandmarkLootTable('landmark_loot_elven', makeRng(seed));
        for (const reward of rewards) {
          expect(['item', 'gold']).toContain(reward.type);
          expect(reward.amount).toBeGreaterThan(0);
          expect(reward.description.length).toBeGreaterThan(0);
          if (reward.type === 'item') {
            expect(reward.resourceId).toBeDefined();
            expect(ALL_ITEMS[reward.resourceId!]).toBeDefined();
          }
        }
      }
    });

    it('yields several distinct items across seeds rather than one fixed drop', () => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 400; seed++) {
        for (const reward of rollLandmarkLootTable('landmark_loot_dwarven', makeRng(seed))) {
          if (reward.type === 'item' && reward.resourceId) seen.add(reward.resourceId);
        }
      }
      expect(seen.size).toBeGreaterThan(3);
    });

    it('resolves nested table references into the referenced table\'s items', () => {
      const wayfarerIds = new Set(
        LANDMARK_LOOT_TABLES.landmark_loot_wayfarer.pools[0].entries
          .filter((entry) => entry.type === 'item')
          .map((entry) => entry.id as string)
      );
      let sawNested = false;
      for (let seed = 1; seed <= 400 && !sawNested; seed++) {
        for (const reward of rollLandmarkLootTable('landmark_loot_ancient', makeRng(seed))) {
          if (reward.type === 'item' && reward.resourceId && wayfarerIds.has(reward.resourceId)) {
            sawNested = true;
          }
        }
      }
      expect(sawNested).toBe(true);
    });

    it('throws on an unknown table instead of degrading to a default drop', () => {
      expect(() => rollLandmarkLootTable('landmark_loot_nonexistent', makeRng(1))).toThrow(
        /unknown loot table/
      );
    });

    it('throws when nesting exceeds the depth guard', () => {
      expect(() => rollLandmarkLootTable('landmark_loot_elven', makeRng(1), 99)).toThrow(
        /nests deeper than/
      );
    });
  });

  describe('generateLandmark item rewards', () => {
    it('no longer collapses to healing_potion / torch', () => {
      const itemIds = new Set<string>();
      for (let seed = 0; seed < 4000; seed++) {
        const landmark =
          generateLandmark(seed, { x: 0, y: 0 }, 'forest') ??
          generateLandmark(seed, { x: 3, y: 7 }, 'mountain');
        if (!landmark) continue;
        for (const reward of landmark.rewards) {
          if (reward.type === 'item' && reward.resourceId) itemIds.add(reward.resourceId);
        }
      }

      expect(itemIds.size).toBeGreaterThan(2);
      const legacyOnly = [...itemIds].every((id) => id === 'healing_potion' || id === 'torch');
      expect(legacyOnly).toBe(false);
    });

    it('only ever names items that exist', () => {
      for (let seed = 0; seed < 2000; seed++) {
        const landmark = generateLandmark(seed, { x: 2, y: 2 }, 'mountain');
        if (!landmark) continue;
        for (const reward of landmark.rewards) {
          if (reward.type === 'item') {
            expect(ALL_ITEMS[reward.resourceId!], reward.resourceId).toBeDefined();
          }
        }
      }
    });

    it('stays deterministic for a given seed and coordinate', () => {
      for (let seed = 0; seed < 50; seed++) {
        expect(generateLandmark(seed, { x: 5, y: 5 }, 'forest')).toEqual(
          generateLandmark(seed, { x: 5, y: 5 }, 'forest')
        );
      }
    });
  });
});
