
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
    // TODO(lint-intent): Confirm the ts-expect-error is still needed or fix the type at the source.
    // @ts-expect-error - nullish entries coverage
    const result = generateLoot([null, undefined]);
    expect(result.gold).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});
