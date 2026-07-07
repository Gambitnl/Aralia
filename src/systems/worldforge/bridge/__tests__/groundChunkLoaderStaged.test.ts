/**
 * Staged 3D world entry — the groundChunkLoader split that lets a worker build
 * the `GroundWorld` data while the main thread rebuilds the (cheap) loader
 * closure from it. See
 * docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 *
 * Three behaviors under test:
 *  1. makeGroundWorld({ skipProps: true }) returns a world with no props but
 *     otherwise identical to the full build — the fast Stage A output.
 *  2. computeGroundProps(world, …) produces exactly the props the full build
 *     bakes — the separable Stage B pass.
 *  3. buildGroundLoaderFromWorld(ground) yields a loader whose chunk output is
 *     identical to the loader createGroundChunkLoader returns — proving the
 *     closure can be rebuilt on the main thread from worker-returned data.
 */
import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../legacySubmapBridge';
import {
  makeGroundWorld,
  createGroundChunkLoader,
  computeGroundProps,
  buildGroundLoaderFromWorld,
} from '../groundChunkLoader';
import { listSelectableTowns } from '../../local/startTowns';
import { findCellAtPoint } from '../../../../components/Worldforge/atlasSvg';
import type { LocalArtifact, RegionArtifact } from '../../artifacts';

/** Resolve the local + region inputs for a seed's lowest-pop port. */
function portInputs(seed: number): { local: LocalArtifact; region: RegionArtifact } {
  const world = getBridgeAtlas(seed);
  const town = listSelectableTowns(world)
    .filter((t) => t.isPort)
    .sort((a, b) => a.population - b.population)[0];
  const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];
  const cell = findCellAtPoint(world as never, burg.x, burg.y);
  const { local, region } = getWorldforgeLocalForCell(seed, cell, {
    centerPx: [burg.x, burg.y],
  });
  return { local, region: region as RegionArtifact };
}

describe('groundChunkLoader staged split', () => {
  it('skipProps yields an empty props layer but an otherwise identical world', () => {
    const { local, region } = portInputs(42);
    const full = makeGroundWorld(local, 42, region);
    const staged = makeGroundWorld(local, 42, region, { skipProps: true });

    // Stage A has no dressing yet.
    expect(staged.props).toEqual([]);
    // The full build DID place props (guards against a vacuous test).
    expect(full.props.length).toBeGreaterThan(0);

    // Everything else is identical: compare both worlds with props removed.
    expect({ ...staged, props: [] }).toEqual({ ...full, props: [] });
  }, 20000);

  it('computeGroundProps reproduces exactly the props the full build bakes', () => {
    const { local, region } = portInputs(42);
    const full = makeGroundWorld(local, 42, region);
    const staged = makeGroundWorld(local, 42, region, { skipProps: true });

    const props = computeGroundProps(staged, 42, region);
    expect(props).toEqual(full.props);
  }, 20000);

  it('buildGroundLoaderFromWorld matches createGroundChunkLoader chunk output', async () => {
    const { local, region } = portInputs(42);
    const { ground, loader } = createGroundChunkLoader(local, 42, region);
    const rebuilt = buildGroundLoaderFromWorld(ground);

    // Same chunk, both loaders → deep-equal mesh bundles.
    const a = await loader(0, 0);
    const b = await rebuilt(0, 0);
    expect(b).toEqual(a);
  }, 20000);
});
