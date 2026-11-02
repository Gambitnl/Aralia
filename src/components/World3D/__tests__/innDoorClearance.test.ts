/** Proves the real booked inn retains floor-relative headroom and source identities.
 * Uses a read-only world fixture; actual entry and recovery still require gameplay. */
import { beforeAll, describe, expect, it } from 'vitest';
import { getWorldforgeLocalForCell } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { siteDoorKey } from '@/systems/worldforge/bridge/sitePartTransform';
import { resolveGroundWalk } from '../groundBuildingMotion';
import { buildTownSimStateForBurg } from '@/systems/worldforge/townsim/townSimRegistration';
import { CELL_AFFINE_TOWN_LAYOUT_REVISION } from '@/systems/worldforge/town/townLayoutRevision';

describe('the paid inn keeps its authored doorway clear above the finished floor', () => {
  let ground: GroundWorld;
  beforeAll(() => {
    const seed = 1793244363464;
    // GG-603 (2026-11-02): the paid inn was booked in a town generated with the
    // cell-affine recipe from before the October 31 road-scale change. The
    // current default lays this burg out as a 1,733-building town: inn door 7
    // is gone and the bake takes about two minutes, past the hook timeout.
    // Read the town with its saved revision (123 buildings), as a load does.
    // The booking also predates terrain revision 2 (ADR 0015): the current
    // recipe sets this inn's floor 6.3 m below the measured body. Read the
    // saved terrain source 1 too, so the pinned pose stands on its own floor.
    const life = buildTownSimStateForBurg(seed, 3, 0, CELL_AFFINE_TOWN_LAYOUT_REVISION);
    const { local, region } = getWorldforgeLocalForCell(seed, 5608, { centerPx: [390.45, 412.86], townLayouts: { 3: life }, terrainRevision: 1 });
    ground = makeGroundWorld(local, seed, region, { skipProps: true, anchorCellId: 5608, townLife: { 3: life } });
  }, 60000);

  const parts = () => ground.buildings.find(building => building.id === 'wf-plot-3-67')!;
  const leaf = () => parts().parts.find(part => part.door?.level === 0 && part.door.index === 7)!;
  // A centered position derived in read-only diagnosis from the accepted body.
  // These fixtures never reposition a live game or change its standing height.
  const from = { xM: 562.6867565440509, zM: 524.442815296606, yM: 8.586510061458167 };
  const destination = { xM: from.xM - 2, zM: from.zM - 2 };
  const opened = () => new Set([siteDoorKey(parts().id, leaf())]);

  it('retains seven feet of leaf and opening above the actual floor slab', () => {
    const floorTop = Math.max(...parts().parts.filter(part => part.walkSurface === 'floor' && Math.abs(part.baseY ?? 0) < .001)
      .map(part => (part.baseY ?? 0) + part.h));
    expect(floorTop).toBeCloseTo(.4 * .3048);
    expect(leaf().h).toBeCloseTo(7 * .3048);
    expect(leaf().baseY ?? 0).toBeCloseTo(floorTop);
    const heads = parts().parts.filter(part => part.colorHex === '#6b4a30'
      && Math.abs(part.x - leaf().x) < .05 && Math.abs(part.z - leaf().z) < .25 && (part.baseY ?? 0) > 1);
    expect(heads.length).toBeGreaterThanOrEqual(2);
    for (const head of heads) expect((head.baseY ?? 0) - floorTop).toBeCloseTo(7 * .3048);
  });

  it('admits the actual standing body through an open doorway without changing source identity or the input pose', () => {
    const before = { ...from };
    const result = resolveGroundWalk(ground, from, destination, opened(), undefined, 2.086547741179154);
    expect(result.blocked).toBe(false);
    expect(result.xM).toBeCloseTo(destination.xM);
    expect(result.zM).toBeCloseTo(destination.zM);
    expect(from).toEqual(before);
    expect(siteDoorKey(parts().id, leaf())).toBe('wf-plot-3-67/0:7:x:9.1440:-7.6200');
    expect(parts().parts.find(part => part.furnishing?.level === 0 && part.furnishing.index === 10)?.furnishing).toEqual({ level: 0, roomId: 4, index: 10, kind: 'bed' });
  });

  it('still refuses a body genuinely taller than the seven-foot opening', () => {
    expect(resolveGroundWalk(ground, from, destination, opened(), undefined, 2.2).blocked).toBe(true);
  });

  it('still refuses passage through the closed saved door', () => {
    expect(resolveGroundWalk(ground, from, destination, new Set(), undefined, 2.086547741179154).blocked).toBe(true);
  });
});
