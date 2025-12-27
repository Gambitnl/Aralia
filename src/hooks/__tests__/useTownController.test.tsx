import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTownController } from '../useTownController';
import { BiomeType } from '../../types/realmsmith';

// Mock the TownGenerator service
vi.mock('../../services/RealmSmithTownGenerator', () => {
    return {
        TownGenerator: class {
            constructor(options: any) {}
            generate() {
                return {
                    width: 10,
                    height: 10,
                    tiles: Array.from({ length: 10 }, (_, x) =>
                        Array.from({ length: 10 }, (_, y) => ({
                            x, y, type: 'GRASS'
                        }))
                    ),
                    buildings: [],
                    seed: 123,
                    biome: 'PLAINS'
                };
            }
        }
    };
});

// Mock walkability utils
vi.mock('../../utils/walkabilityUtils', () => ({
    isPositionWalkable: vi.fn().mockReturnValue(true)
}));

describe('useTownController', () => {

    // NOTE: The test is timing out likely because waitFor logic inside fake timers is tricky in this env.
    // We will verify the hook without using fake timers, assuming the 50ms delay is acceptable for a real timer.
    // TODO: Consider switching to fake timers or a deterministic utility so this 2s wait doesn’t make the hook test brittle or slow.

    it('should initialize and generate map', async () => {
        const { result } = renderHook(() => useTownController({
            townSeed: 123,
            initialBiome: BiomeType.PLAINS
        }));

        expect(result.current.state.seed).toBe(123);

        // Wait for the async generation to complete (real timer)
        await waitFor(() => {
             expect(result.current.state.loading).toBe(false);
        }, { timeout: 2000 });

        expect(result.current.state.mapData).toBeDefined();
        // Check spawn position (default center 5,5 for 10x10 map)
        expect(result.current.state.localPlayerPosition).toEqual({ x: 5, y: 5 });
    });

    it('should update viewport state', () => {
        const { result } = renderHook(() => useTownController({
            townSeed: 123,
            initialBiome: BiomeType.PLAINS
        }));

        act(() => {
            result.current.actions.setZoom(2.5);
        });

        expect(result.current.state.zoom).toBe(2.5);
    });
});
