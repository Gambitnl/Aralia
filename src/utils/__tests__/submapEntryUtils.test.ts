
import { describe, it, expect, vi } from 'vitest';
import { getAdjacentVillageEntry } from '../submapEntryUtils';
import { getSubmapTileInfo } from '../submapUtils';
import { SUBMAP_DIMENSIONS } from '../../config/mapConfig';

// Mock getSubmapTileInfo to control terrain generation
vi.mock('../submapUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../submapUtils')>();
  return {
    ...actual,
    getSubmapTileInfo: vi.fn(),
  };
});

describe('submapEntryUtils', () => {
  describe('getAdjacentVillageEntry', () => {
    const mockWorldSeed = 12345;
    const mockParentCoords = { x: 10, y: 10 };
    const mockBiomeId = 'plains';
    const mockSubmapDims = SUBMAP_DIMENSIONS; // { rows: 20, cols: 30 }

    it('returns null when no village is adjacent', () => {
      // Mock getSubmapTileInfo to always return 'grass'
      vi.mocked(getSubmapTileInfo).mockReturnValue({
        effectiveTerrainType: 'grass',
        isImpassable: false,
      });

      const result = getAdjacentVillageEntry(
        mockWorldSeed,
        { x: 10, y: 10 },
        mockParentCoords,
        mockBiomeId,
        mockSubmapDims
      );

      expect(result).toEqual({ adjacentToVillage: false, entryDirection: null });
    });

    it('detects village to the North (entering from South)', () => {
        // Player at 10,10. North is 10,9.
        vi.mocked(getSubmapTileInfo).mockImplementation((_seed, _parent, _biome, _dims, coords) => {
          if (coords.x === 10 && coords.y === 9) {
            return { effectiveTerrainType: 'village_area', isImpassable: true };
          }
          return { effectiveTerrainType: 'grass', isImpassable: false };
        });

        const result = getAdjacentVillageEntry(
          mockWorldSeed,
          { x: 10, y: 10 },
          mockParentCoords,
          mockBiomeId,
          mockSubmapDims
        );

        expect(result).toEqual({ adjacentToVillage: true, entryDirection: 'south' });
      });

    it('detects village to the South (entering from North)', () => {
      // Player at 10,10. South is 10,11.
      vi.mocked(getSubmapTileInfo).mockImplementation((_seed, _parent, _biome, _dims, coords) => {
        if (coords.x === 10 && coords.y === 11) {
          return { effectiveTerrainType: 'village_area', isImpassable: true };
        }
        return { effectiveTerrainType: 'grass', isImpassable: false };
      });

      const result = getAdjacentVillageEntry(
        mockWorldSeed,
        { x: 10, y: 10 },
        mockParentCoords,
        mockBiomeId,
        mockSubmapDims
      );

      expect(result).toEqual({ adjacentToVillage: true, entryDirection: 'north' });
    });

    it('detects village to the East (entering from West)', () => {
      // Player at 10,10. East is 11,10.
      vi.mocked(getSubmapTileInfo).mockImplementation((_seed, _parent, _biome, _dims, coords) => {
        if (coords.x === 11 && coords.y === 10) {
          return { effectiveTerrainType: 'village_area', isImpassable: true };
        }
        return { effectiveTerrainType: 'grass', isImpassable: false };
      });

      const result = getAdjacentVillageEntry(
        mockWorldSeed,
        { x: 10, y: 10 },
        mockParentCoords,
        mockBiomeId,
        mockSubmapDims
      );

      expect(result).toEqual({ adjacentToVillage: true, entryDirection: 'west' });
    });

    it('detects village to the West (entering from East)', () => {
      // Player at 10,10. West is 9,10.
      vi.mocked(getSubmapTileInfo).mockImplementation((_seed, _parent, _biome, _dims, coords) => {
        if (coords.x === 9 && coords.y === 10) {
          return { effectiveTerrainType: 'village_area', isImpassable: true };
        }
        return { effectiveTerrainType: 'grass', isImpassable: false };
      });

      const result = getAdjacentVillageEntry(
        mockWorldSeed,
        { x: 10, y: 10 },
        mockParentCoords,
        mockBiomeId,
        mockSubmapDims
      );

      expect(result).toEqual({ adjacentToVillage: true, entryDirection: 'east' });
    });

    it('respects map boundaries', () => {
      // Player at 0,0 (Top Left). North (0,-1) and West (-1,0) should be skipped.
      // We only test valid bounds.

      const calls: any[] = [];
      vi.mocked(getSubmapTileInfo).mockImplementation((_seed, _parent, _biome, _dims, coords) => {
        calls.push(coords);
        return { effectiveTerrainType: 'grass', isImpassable: false };
      });

      getAdjacentVillageEntry(
        mockWorldSeed,
        { x: 0, y: 0 },
        mockParentCoords,
        mockBiomeId,
        mockSubmapDims
      );

      // Should only check South (0,1) and East (1,0)
      expect(calls.length).toBe(2);
      expect(calls).toContainEqual({ x: 0, y: 1 });
      expect(calls).toContainEqual({ x: 1, y: 0 });
    });
  });
});
