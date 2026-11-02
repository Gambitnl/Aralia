/**
 * GG-580 (2026-11-02): a door change rebuilds the solids of its own building only.
 *
 * `buildingsFor` caches by the open-door set. Every resident at a door makes a
 * new set, and the old code then rebuilt every building in the town (about
 * 150 ms for 666 buildings) and dropped each building's query index. Now each
 * building keeps one `Building` per state of its own doors.
 */
import { describe, expect, it } from 'vitest';
import { buildingsFor, resolveGroundWalk } from '../groundBuildingMotion';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { SitePart } from '@/systems/worldforge/bridge/interiorParts';
import { siteDoorKey } from '@/systems/worldforge/bridge/sitePartTransform';

const door = { x: 0, z: -2, w: 1, d: 0.1, h: 2, colorHex: '#6b4a2e', door: { id: 'front', axis: 'x', swingX: 0, swingZ: 1 } } as unknown as SitePart;
const wall = { x: 0, z: 0, w: 0.12, d: 4, h: 3, colorHex: '#cfc7b8' } as unknown as SitePart;
function house(id: string, xM: number) {
  return { id, xM, zM: 0, parts: [wall, door],
    cornersM: [{ x: xM - 3, z: -3 }, { x: xM + 3, z: -3 }, { x: xM + 3, z: 3 }, { x: xM - 3, z: 3 }] };
}

describe('buildingsFor door reuse (GG-580)', () => {
  const ground = { cols: 1, rows: 1, heights: [0], buildings: [house('a', 0), house('b', 20), house('c', 40)] } as unknown as GroundWorld;
  const keyB = siteDoorKey('b', door);

  it('keeps every other building object when one door opens and closes', () => {
    const closed = buildingsFor(ground, new Set());
    const opened = buildingsFor(ground, new Set([keyB]));
    expect(opened[0]).toBe(closed[0]);
    expect(opened[2]).toBe(closed[2]);
    expect(opened[1]).not.toBe(closed[1]);
    // The open leaf is a different solid: the door swings off its closed line.
    expect(opened[1].solids).not.toEqual(closed[1].solids);
    // A new set with the same content, and the door closed again, reuse the
    // states built before.
    expect(buildingsFor(ground, new Set([keyB]))[1]).toBe(opened[1]);
    expect(buildingsFor(ground, new Set(['other/door']))[1]).toBe(closed[1]);
  });

  it('keeps the movement answer the same as a fresh build', () => {
    const from = { xM: 20, zM: -2.6, yM: 0 }, to = { xM: 20, zM: -1.4 };
    const shut = resolveGroundWalk(ground, from, to, new Set());
    const open = resolveGroundWalk(ground, from, to, new Set([keyB]));
    const fresh = { ...ground, buildings: [house('a', 0), house('b', 20), house('c', 40)] } as unknown as GroundWorld;
    expect(resolveGroundWalk(fresh, from, to, new Set())).toEqual(shut);
    expect(resolveGroundWalk(fresh, from, to, new Set([keyB]))).toEqual(open);
  });
});
