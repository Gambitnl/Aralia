
import { describe, it, expect, vi } from 'vitest';
import { FenceSystem } from '../FenceSystem';
import { Fence, StolenItem, CrimeType } from '../../../../types/crime';
import { PlayerCharacter } from '../../../../types/character';
import { GameState } from '../../../../types';
import { createMockPlayerCharacter, createMockGameState } from '../../../../utils/factories';

describe('FenceSystem', () => {
  const mockPlayer = createMockPlayerCharacter({
    gold: 100,
    stats: {
      strength: 10,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 16 // +3 Mod -> +6% bonus
    }
  });

  const mockFence: Fence = {
    id: 'fence-1',
    npcId: 'npc-fence-1',
    locationId: 'loc-1',
    gold: 1000,
    acceptedCategories: ['gem', 'art'],
    cut: 0.3 // 30% cut
  };

  const mockItem: StolenItem = {
    id: 'item-1',
    name: 'Golden Chalice',
    type: 'gear',
    rarity: 'common',
    weight: 1,
    value: 100,
    tags: ['art'],
    originalOwnerId: 'noble-1',
    stolenAt: Date.now() - (1000 * 60 * 60 * 48), // 48 hours ago (cold)
    effects: [],
    quantity: 1,
    description: 'A shiny cup',
    isEquipped: false
  };

  const mockGameState = createMockGameState();

  it('generates a valid fence', () => {
    const fence = FenceSystem.generateFence('loc-1', 'Test Location');
    expect(fence.locationId).toBe('loc-1');
    expect(fence.cut).toBeGreaterThanOrEqual(0.2);
    expect(fence.cut).toBeLessThanOrEqual(0.5);
    expect(fence.acceptedCategories.length).toBeGreaterThanOrEqual(2);
  });

  it('evaluates item value correctly', () => {
    // Base: 100
    // Cut: 30% -> 70 remaining
    // Cha Bonus: +6% of 70 -> +4.2 -> 74.2
    // Cold item: No penalty
    const offer = FenceSystem.evaluateItem(mockItem, mockFence, mockPlayer);

    // 74 is expected floor(74.2)
    expect(offer).toBe(74);
  });

  it('rejects items with wrong categories', () => {
    const weaponItem = { ...mockItem, tags: ['weapon'] };
    const offer = FenceSystem.evaluateItem(weaponItem, mockFence, mockPlayer);
    expect(offer).toBeNull();
  });

  it('applies hot item penalty', () => {
    const hotItem = {
      ...mockItem,
      stolenAt: Date.now() // Just stolen
    };

    // Base: 70
    // Cha Bonus: +4.2 -> 74.2
    // Hot Penalty: * 0.8 -> 59.36
    const offer = FenceSystem.evaluateItem(hotItem, mockFence, mockPlayer);
    expect(offer).toBe(59);
  });

  it('executes a sale successfully', () => {
    const result = FenceSystem.sellItem(mockItem, mockFence, mockPlayer);

    expect(result.success).toBe(true);
    expect(result.goldEarned).toBe(74);
    expect(result.heatGenerated).toBe(1); // 100 / 100 = 1
  });

  it('fails if fence lacks gold', () => {
    const poorFence = { ...mockFence, gold: 10 };
    const result = FenceSystem.sellItem(mockItem, poorFence, mockPlayer);

    expect(result.success).toBe(false);
    expect(result.message).toContain("doesn't have enough coin");
  });

  it('processTransaction updates player gold, inventory, and fence gold', () => {
    // Ensure player has the item
    const playerWithItem = { ...mockPlayer, inventory: [mockItem] };
    const { updatedPlayer, updatedFence, result } = FenceSystem.processTransaction(mockItem, mockFence, playerWithItem);

    expect(result.success).toBe(true);
    expect(updatedPlayer.gold).toBe(100 + 74); // 100 start + 74 earned
    expect(updatedFence.gold).toBe(1000 - 74); // 1000 start - 74 paid

    // Inventory check
    expect(updatedPlayer.inventory).toHaveLength(0);

    expect(updatedPlayer).not.toBe(playerWithItem); // Immutable check
    expect(updatedFence).not.toBe(mockFence); // Immutable check
  });
});
