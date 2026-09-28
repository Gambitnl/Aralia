/**
 * @file src/components/Compendium/__tests__/searchIndex.test.ts
 *
 * Unit tests for the PHB 2024 rule tables search index and query helpers.
 *
 * Tests:
 * - Building the full search index.
 * - Search query relevance ranking and multi-token matching.
 * - Category-scoped searches.
 * - Direct ID lookups with findRuleEntryById.
 */

import { describe, it, expect } from 'vitest';
import {
  buildAllRuleSearchResults,
  searchRuleTables,
  findRuleEntryById,
} from '../../../data/glossary/searchIndex';

describe('PHB 2024 Rule Search Index', () => {
  it('builds a unified search index containing entries from all 4 datasets', () => {
    const allItems = buildAllRuleSearchResults();

    expect(allItems.length).toBeGreaterThanOrEqual(30);

    const categories = new Set(allItems.map((i) => i.category));
    expect(categories.has('conditions')).toBe(true);
    expect(categories.has('cover_obscurement')).toBe(true);
    expect(categories.has('combat_actions')).toBe(true);
    expect(categories.has('weapon_mastery')).toBe(true);
  });

  it('searches by keyword across all categories with multi-token support', () => {
    const results = searchRuleTables('advantage attack');

    expect(results.length).toBeGreaterThan(0);
    // Should match conditions (e.g. Blinded, Paralyzed, Invisible) or masteries (e.g. Vex)
    const titles = results.map((r) => r.title);
    expect(titles.some((t) => t.includes('Invisible') || t.includes('Blinded') || t.includes('Vex'))).toBe(true);
  });

  it('filters searches by specific category when requested', () => {
    const masteryOnlyResults = searchRuleTables('attack', 'weapon_mastery');

    expect(masteryOnlyResults.length).toBeGreaterThan(0);
    masteryOnlyResults.forEach((res) => {
      expect(res.category).toBe('weapon_mastery');
    });
  });

  it('finds specific rule entries by unique ID using findRuleEntryById', () => {
    const blinded = findRuleEntryById('blinded');
    expect(blinded).not.toBeNull();
    expect(blinded?.category).toBe('conditions');
    expect(blinded?.entry.name).toBe('Blinded');

    const halfCover = findRuleEntryById('half_cover');
    expect(halfCover).not.toBeNull();
    expect(halfCover?.category).toBe('cover_obscurement');
    expect(halfCover?.entry.name).toBe('Half Cover');

    const topple = findRuleEntryById('topple');
    expect(topple).not.toBeNull();
    expect(topple?.category).toBe('weapon_mastery');
    expect(topple?.entry.name).toBe('Topple');

    const nonExistent = findRuleEntryById('non_existent_rule_123');
    expect(nonExistent).toBeNull();
  });
});
