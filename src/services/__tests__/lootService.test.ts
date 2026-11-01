
import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateLoot } from '../lootService';
import { Monster } from '../../types';

// Mock dependencies
vi.mock('../../constants', () => ({
  ITEMS: {
    'healing_potion': { id: 'potion', name: 'Healing Potion' }
  },
  WEAPONS_DATA: {
    'sword': { id: 'sword', name: 'Iron Sword' }
  }
}));

describe('generateLoot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 gold safely instead of NaN for invalid CR', () => {
    const badMonster = {
      id: 'bad-mon',
      name: 'Glitch',
      cr: 'Unknown',
      description: 'A glitches monster',
      quantity: 1,
    } as Monster;

    const result = generateLoot([badMonster]);
    expect(result.gold).toBe(0);
    expect(Number.isNaN(result.gold)).toBe(false);
  });

  it('does not crash when description is missing even if item drop triggers', () => {
    // Force item drop check to pass
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const badMonster = {
      id: 'no-desc',
      name: 'Silent One',
      cr: '1',
      quantity: 1,
      // description missing
    } as unknown as Monster;

    // Should not throw
    const result = generateLoot([badMonster]);

    // Should return valid structure
    expect(result).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    // Since tags are empty string, it falls through to fallback (healing potion)
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].id).toBe('potion');
  });

  it('does not crash when description is undefined', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const badMonster = {
        id: 'undefined-desc',
        name: 'Void',
        cr: '1',
        quantity: 1,
        description: undefined
      } as unknown as Monster;

      const result = generateLoot([badMonster]);
      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
  });

  it('handles empty input array safely', () => {
    const result = generateLoot([]);
    expect(result.gold).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('handles null/undefined in array safely', () => {
    const result = generateLoot([null as unknown as Monster, undefined as unknown as Monster]);
    expect(result.gold).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  describe('CR gold generation', () => {
    it('drops 0 gold for CR 0 enemies (e.g. rat)', () => {
      for (let i = 0; i < 20; i++) {
        const rat = { id: 'rat', name: 'Rat', cr: '0', quantity: 1 } as Monster;
        const result = generateLoot([rat]);
        expect(result.gold).toBe(0);
      }
    });

    it('drops at least 1 gold for CR 1/4 and decimal 0.25 enemies (e.g. goblin)', () => {
      for (let i = 0; i < 20; i++) {
        const goblinFraction = { id: 'goblin', name: 'Goblin', cr: '1/4', quantity: 1 } as Monster;
        const goblinDecimal = { id: 'goblin', name: 'Goblin', cr: '0.25', quantity: 1 } as Monster;
        expect(generateLoot([goblinFraction]).gold).toBeGreaterThan(0);
        expect(generateLoot([goblinDecimal]).gold).toBeGreaterThan(0);
      }
    });

    it('drops at least 1 gold for CR 1/8 and decimal 0.125 enemies (e.g. kobold)', () => {
      const koboldFraction = { id: 'kobold', name: 'Kobold', cr: '1/8', quantity: 1 } as Monster;
      const koboldDecimal = { id: 'kobold', name: 'Kobold', cr: '0.125', quantity: 1 } as Monster;
      expect(generateLoot([koboldFraction]).gold).toBeGreaterThan(0);
      expect(generateLoot([koboldDecimal]).gold).toBeGreaterThan(0);
    });

    it('drops between 2 and 7 gold for CR 1/2 and decimal 0.5 enemies', () => {
      const orcFraction = { id: 'orc', name: 'Orc', cr: '1/2', quantity: 1 } as Monster;
      const orcDecimal = { id: 'orc', name: 'Orc', cr: '0.5', quantity: 1 } as Monster;
      const resultFraction = generateLoot([orcFraction]);
      const resultDecimal = generateLoot([orcDecimal]);
      expect(resultFraction.gold).toBeGreaterThanOrEqual(2);
      expect(resultFraction.gold).toBeLessThanOrEqual(7);
      expect(resultDecimal.gold).toBeGreaterThanOrEqual(2);
      expect(resultDecimal.gold).toBeLessThanOrEqual(7);
    });

    it('drops between 5 and 14 gold for CR 1 enemies', () => {
      const bugbear = { id: 'bugbear', name: 'Bugbear', cr: '1', quantity: 1 } as Monster;
      const result = generateLoot([bugbear]);
      expect(result.gold).toBeGreaterThanOrEqual(5);
      expect(result.gold).toBeLessThanOrEqual(14);
    });
  });
});

