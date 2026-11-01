/**
 * This file proves PLAYING ground consumes Atlas's exact retained artifacts.
 *
 * The test exercises World3DWrapper's receipt boundary with a tiny ground
 * factory, checking object identity and focus-derived spawn coordinates without
 * mounting WebGL or the large procedural generation worker.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ChunkLoader } from '../../../systems/world3d/types';
import type { LocalArtifact, RegionArtifact } from '../../../systems/worldforge/artifacts';
import {groundSurfaceY, type GroundWorld} from '../../../systems/worldforge/bridge/groundChunkLoader';
import {heightToMeters} from '../../../systems/world3d/config';
import { buildAtlasGroundDrilldown } from '../../../systems/worldforge/leaf3d/atlasGroundDrilldown';
import {
  createAtlasReceiptGroundSession,
  retainedTownNpcIdsForGround,
  type GroundLoaderFactory,
} from '../World3DWrapper';

// ============================================================================
// Exact-artifact PLAYING projection
// ============================================================================
// A deliberately tiny GroundWorld keeps the proof about handoff authority, not
// terrain-generation detail already covered by groundChunkLoader tests.
describe('World3DWrapper Atlas receipt projection', () => {
  it('passes the selected Local and Region by identity and spawns at its focus', () => {
    const region = { seedPath: '91/region:23' } as RegionArtifact;
    const local = {
      seedPath: '91/region:23/local:100,200',
      bounds: { x: 100, y: 200, width: 3000, height: 3000 },
      features: [{ id: 8, kind: 'poi', x: 201, y: 300, data: { name: 'Stone Gate' } }],
    } as unknown as LocalArtifact;
    const receipt = buildAtlasGroundDrilldown({
      worldSeed: 91,
      atlasCellId: 23,
      region,
      local,
      focus: { kind: 'site', id: 8, label: 'Stone Gate', xFt: 201, yFt: 300 },
    });
    const ground = {
      cols: 64,
      rows: 64,
      // A fractional focus on sloped terrain catches the old rounded-cell step.
      heights: Float32Array.from({length:64*64},(_,i)=>20+(i%64)*.1+Math.floor(i/64)*.1),
      extentMetersX: 914.4,
      extentMetersZ: 914.4,
    } as unknown as GroundWorld;
    const loader: ChunkLoader = async (cx, cy) => ({
      cx,
      cy,
      terrain: {
        positions: new Float32Array(0),
        indices: new Uint32Array(0),
        normals: new Float32Array(0),
        colors: new Float32Array(0),
      },
      sites: [],
    });
    const factoryMock = vi.fn(
      (_sourceLocal: LocalArtifact, _seed: number, _sourceRegion?: RegionArtifact) => ({
        ground,
        loader,
      }),
    );
    const factory = factoryMock as unknown as GroundLoaderFactory;

    const session = createAtlasReceiptGroundSession(receipt, factory);

    expect(factoryMock).toHaveBeenCalledTimes(1);
    expect(factoryMock.mock.calls[0]?.[0]).toBe(local);
    expect(factoryMock.mock.calls[0]?.[2]).toBe(region);
    expect(session.ground).toBe(ground);
    expect(session.start).toEqual([30.7848, 0, 30.48]);
    expect(session.surfaceY).toBe(groundSurfaceY(ground,30.7848,30.48));
    expect(session.surfaceY).not.toBe(heightToMeters(ground.heights[20*64+20]));
  });

  it('exposes retained-Local business owners through the existing talk/dialogue ids', () => {
    const ground = {
      townPlans: [{
        burgId: 14,
        plan: {
          plots: [
            { id: 3, role: 'market' },
            { id: 7, role: 'workshop' },
            { id: 9, role: 'residential' },
          ],
        },
      }],
    } as unknown as GroundWorld;

    // registerTownContent creates generated NPCs and businesses with these same
    // burg/plot ids; World3DScene forwards a click to App's ordinary talk action.
    expect(retainedTownNpcIdsForGround(ground)).toEqual([
      'npc_burg_14_plot_3',
      'npc_burg_14_plot_7',
    ]);
  });
});
