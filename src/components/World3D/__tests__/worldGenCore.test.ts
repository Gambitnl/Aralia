// @vitest-environment node
/**
 * Worker core for staged 3D world entry. `runWorldGen` is the pure orchestration
 * the world-gen worker runs: resolve the local + region for a cell, assemble the
 * ground WITHOUT props (Stage A), then compute props (Stage B) — emitting each
 * stage as it completes. Runs under the `node` environment (no DOM), exactly
 * like the worker it backs.
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import { describe, it, expect } from 'vitest';
import { runWorldGen } from '../worldGenCore';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { listSelectableTowns } from '@/systems/worldforge/local/startTowns';
import { findCellAtPoint } from '@/components/Worldforge/atlasSvg';

/** Resolve a real { entryCellId, centerPx } for a seed's lowest-pop port. */
function portRequest(seed: number): { wfSeed: number; entryCellId: number; centerPx: [number, number]; hour: number } {
  const world = getBridgeAtlas(seed);
  const town = listSelectableTowns(world)
    .filter((t) => t.isPort)
    .sort((a, b) => a.population - b.population)[0];
  const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];
  const cell = findCellAtPoint(world as never, burg.x, burg.y);
  return { wfSeed: seed, entryCellId: cell, centerPx: [burg.x, burg.y], hour: 12 };
}

describe('runWorldGen (worker core)', () => {
  it('emits Stage A (ground without props + local + region), then Stage B (props)', async () => {
    const req = portRequest(42);

    let stageA: Parameters<Parameters<typeof runWorldGen>[1]['emitStageA']>[0] | null = null;
    let stageB: Parameters<Parameters<typeof runWorldGen>[1]['emitStageB']>[0] | null = null;
    const order: string[] = [];

    await runWorldGen(req, {
      emitProgress: (stage) => { order.push(`progress:${stage}`); },
      emitStageA: (a) => { stageA = a; order.push('A'); },
      emitStageB: (b) => { stageB = b; order.push('B'); },
    });

    // Progress fires as real work crosses each boundary, then A, then B:
    //  - 'town' after the land/region is resolved and before the town assembles;
    //  - Stage A when terrain + town are ready; Stage B when props are ready.
    expect(order).toEqual(['progress:town', 'A', 'B']);
    expect(stageA).not.toBeNull();
    expect(stageB).not.toBeNull();

    // Stage A carried a real terrain+town world with NO props yet, plus the
    // local + region the main thread needs for tile identity / registration.
    expect(stageA!.ground.props).toEqual([]);
    expect(stageA!.ground.buildings.length).toBeGreaterThan(0);
    expect(stageA!.local).toBeTruthy();
    expect(stageA!.region).toBeTruthy();

    // Stage B props equal a full main-thread build's props (name-fallback
    // invariant: the worker has no registered businesses, yet matches).
    const { local, region } = getWorldforgeLocalForCell(req.wfSeed, req.entryCellId, {
      centerPx: req.centerPx,
    });
    const full = makeGroundWorld(local, req.wfSeed, region, { hour: req.hour });
    expect(stageB!).toEqual(full.props);
    expect(stageB!.length).toBeGreaterThan(0);
  }, 30000);
});
