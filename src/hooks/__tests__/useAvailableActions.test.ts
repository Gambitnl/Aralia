
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAvailableActions } from '../useAvailableActions';
import { Location, NPC, Item } from '../../types';

// Properly hoist the mock function
const { mockGetSubmapTileInfo } = vi.hoisted(() => {
  return { mockGetSubmapTileInfo: vi.fn() };
});

// Mock dependencies with correct relative path
vi.mock('../../utils/submapUtils', () => ({
  getSubmapTileInfo: mockGetSubmapTileInfo,
}));

vi.mock('../utils/permissions', () => ({
  canUseDevTools: vi.fn(() => false),
}));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn() },
}));

vi.mock('../config/mapConfig', () => ({
    SUBMAP_DIMENSIONS: { rows: 20, cols: 30 }
}));

describe('useAvailableActions', () => {
  const mockLocation: Location = {
    id: 'loc_1',
    name: 'Test Location',
    baseDescription: 'A test location.',
    exits: {
      North: 'loc_n',
      CustomExit: { targetId: 'loc_custom', direction: 'CustomExit' }
    },
    mapCoordinates: { x: 0, y: 0 },
    biomeId: 'plains',
  };

  const mockNPCs: NPC[] = [
    { id: 'npc_1', name: 'Bob', baseDescription: 'A guy', initialPersonalityPrompt: '', role: 'civilian' }
  ];

  const mockItems: Item[] = [
    { id: 'item_1', name: 'Sword', description: 'Sharp', type: 'weapon', weight: 1, value: '10 gp', rarity: 'common' }
  ];

  it('should return talk actions for NPCs', () => {
    const { result } = renderHook(() => useAvailableActions({
      currentLocation: mockLocation,
      npcsInLocation: mockNPCs,
      itemsInLocation: [],
    }));

    expect(result.current).toContainEqual(expect.objectContaining({
      type: 'talk',
      label: 'Talk to Bob',
      targetId: 'npc_1'
    }));
  });

  it('should return take actions for items', () => {
    const { result } = renderHook(() => useAvailableActions({
      currentLocation: mockLocation,
      npcsInLocation: [],
      itemsInLocation: mockItems,
    }));

    expect(result.current).toContainEqual(expect.objectContaining({
      type: 'take_item',
      label: 'Take Sword',
      targetId: 'item_1'
    }));
  });

  it('should return move actions for custom exits', () => {
    const { result } = renderHook(() => useAvailableActions({
      currentLocation: mockLocation,
      npcsInLocation: [],
      itemsInLocation: [],
    }));

    expect(result.current).toContainEqual(expect.objectContaining({
      type: 'move',
      label: 'Go CustomExit',
      targetId: 'loc_custom'
    }));
  });

  it('should detect village entry when adjacent on submap', () => {
    // We need to return village_area for the adjacent tile check
    mockGetSubmapTileInfo.mockReturnValue({ effectiveTerrainType: 'village_area' });

    const { result } = renderHook(() => useAvailableActions({
      currentLocation: { ...mockLocation, id: 'coord_1_1' }, // Coordinate location
      npcsInLocation: [],
      itemsInLocation: [],
      subMapCoordinates: { x: 10, y: 10 },
      worldSeed: 12345,
    }));

    expect(result.current).toContainEqual(expect.objectContaining({
      type: 'ENTER_VILLAGE',
      label: 'Enter Village'
    }));
    expect(result.current).toContainEqual(expect.objectContaining({
      type: 'OBSERVE_VILLAGE',
      label: 'Scout Village'
    }));
  });

  it('should detect town entry for named town locations', () => {
    const townLocation = { ...mockLocation, name: 'Smallville Town' };
    const { result } = renderHook(() => useAvailableActions({
      currentLocation: townLocation,
      npcsInLocation: [],
      itemsInLocation: [],
    }));

    expect(result.current).toContainEqual(expect.objectContaining({
      type: 'ENTER_VILLAGE',
      label: 'Enter Town'
    }));
  });

  it('should return empty array if no actions available', () => {
      const emptyLocation = { ...mockLocation, exits: {} };
      const { result } = renderHook(() => useAvailableActions({
          currentLocation: emptyLocation,
          npcsInLocation: [],
          itemsInLocation: [],
      }));

      expect(result.current).toEqual([]);
  });
});
