// @vitest-environment node
/**
 * FEASIBILITY SPIKE for staged, off-thread 3D world entry
 * (docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md).
 *
 * Two go/no-go checks the spec requires BEFORE building the world-gen worker:
 *
 *  1. Worker-safe import tree — `makeGroundWorld` pulls a deep worldforge module
 *     graph. This file runs under the `node` environment (see the pragma above),
 *     so there is NO `window` and NO `document`, exactly like a real Web Worker.
 *     If assembly runs to completion here, the import tree is worker-safe.
 *
 *  2. Structured-clone round trip — a Web Worker returns data via structured
 *     clone. If a fully built `GroundWorld` (props included) survives
 *     `structuredClone` deep-equal, it can cross the worker boundary intact.
 *
 * If either check fails, STOP and rethink the approach before writing worker code.
 */
import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../legacySubmapBridge';
import { makeGroundWorld } from '../groundChunkLoader';
import { listSelectableTowns } from '../../local/startTowns';
import { findCellAtPoint } from '../../../../components/Worldforge/atlasSvg';
import type { GroundWorld } from '../groundChunkLoader';

/** Build the ground world for the lowest-pop PORT of a seed (docks + market +
 * props — the richest content, so the spike exercises the most data shapes). */
function portGround(seed: number): GroundWorld {
  const world = getBridgeAtlas(seed);
  const town = listSelectableTowns(world)
    .filter((t) => t.isPort)
    .sort((a, b) => a.population - b.population)[0];
  const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];
  const cell = findCellAtPoint(world as never, burg.x, burg.y);
  const { local, region } = getWorldforgeLocalForCell(seed, cell, {
    centerPx: [burg.x, burg.y],
  });
  return makeGroundWorld(local, seed, region);
}

describe('SPIKE: world-gen worker feasibility', () => {
  it('runs makeGroundWorld with no DOM present (worker-safe import tree)', () => {
    // Prove we really are in a worker-like context: no browser globals.
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');

    const ground = portGround(42);

    // Assembly completed and produced real content.
    expect(ground.cols).toBeGreaterThan(0);
    expect(ground.rows).toBeGreaterThan(0);
    expect(ground.heights.length).toBe(ground.cols * ground.rows);
    expect(ground.props.length).toBeGreaterThan(0);
    expect(ground.buildings.length).toBeGreaterThan(0);
  }, 20000);

  it('GroundWorld survives a structured-clone round trip deep-equal', () => {
    const ground = portGround(42);

    // structuredClone is the exact algorithm postMessage uses to move data out
    // of a worker. A class instance, function, or other non-cloneable value
    // would either throw here or drop fields, failing the deep-equal below.
    const cloned = structuredClone(ground);

    expect(cloned).toEqual(ground);
    // Spot-check the richest nested shapes explicitly, so a silently-dropped
    // nested field can't hide inside a passing top-level toEqual.
    expect(cloned.props).toEqual(ground.props);
    expect(cloned.buildings).toEqual(ground.buildings);
    expect(cloned.rosters).toEqual(ground.rosters);
    expect(cloned.buildings[0]?.parts).toEqual(ground.buildings[0]?.parts);
  }, 20000);
});
