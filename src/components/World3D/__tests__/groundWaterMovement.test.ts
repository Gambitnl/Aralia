import { describe, expect, it } from 'vitest';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { ANY_DIFFICULT_TERRAIN_POLICY, EARTH_WALK_TERRAIN_POLICY, TIMBERWALK_TERRAIN_POLICY } from '@/utils/combat/movementUtils';
import { groundWaterMovementAt, resolveGroundWaterWalk } from '../groundWaterMovement';

// Authored flat-bank fixtures exercise real published water and support queries;
// none of these positions or water levels are installed in a gameplay save.
function ground(water = 1.3): GroundWorld {
  return { cols: 32, rows: 32, heights: Array(1024).fill(0), biomeIds: Array(1024).fill('plains'), extentMetersX: 48, extentMetersZ: 48,
    features: [], props: [], hostiles: [], hiddenSites: [], dungeonEntrances: [], roads: [], walls: [], waterBodies: [], decks: [], gatehouses: [], towns: [], buildings: [], rosters: [], occupants: [],
    rivers: [{ sourceKind: 'river', points: [{ x: 5, z: 10 }, { x: 40, z: 10 }], widthM: 8, waterlineY: [water, water] }] };
}
const body = { xM: 20, zM: 10, yM: 0 };
const profile = { mouthHeightM: 1.55 };

describe('grounded source-water movement', () => {
  for(const water of [-1,.4])it(`carries standing clearance through the single movement budget at water ${water}`,()=>{
    const g=ground(water),from={xM:19,zM:10,yM:0},target={xM:21,zM:10};
    g.buildings=[{id:'beam',xM:20,zM:10,cornersM:[{x:18,z:8},{x:22,z:8},{x:22,z:12},{x:18,z:12}],
      parts:[{x:0,z:0,w:.2,d:4,h:1,baseY:1.8,colorHex:'#654321'}]}] as GroundWorld['buildings'];
    const before=JSON.stringify(g),budget=water>0?4:2;
    const short=resolveGroundWaterWalk(g,from,target,budget,{...profile,standingHeightM:1.7});
    expect(short.blocked).toBe(false);expect(short.xM).toBeCloseTo(21);
    expect(short.spentMovementM).toBeCloseTo(budget);
    const tall=resolveGroundWaterWalk(g,from,target,budget,{...profile,standingHeightM:2.3});
    expect(tall).toMatchObject({blocked:true,blockedReason:'low-clearance'});expect(tall.xM).toBeLessThan(20);
    expect(JSON.stringify(g)).toBe(before);
  });
  it('retains dry walking pace and preserves source geometry', () => {
    const g = ground(), before = JSON.stringify(g), from = { ...body, zM: 1 };
    const result = resolveGroundWaterWalk(g, from, { xM: 21, zM: 1 }, 1, profile);
    expect(result.xM).toBeCloseTo(21); expect(result.water.mode).toBe('dry');
    expect(result.spentMovementM).toBeCloseTo(1); expect(JSON.stringify(g)).toBe(before);
  });
  it('spends two movement units per grounded wading unit and preserves the actual support height', () => {
    const result = resolveGroundWaterWalk(ground(), body, { xM: 21, zM: 10 }, 1, profile);
    expect(result.xM).toBeCloseTo(20.5); expect(result.yM).toBe(0);
    expect(result.water.mode).toBe('wading'); expect(result.spentMovementM).toBeCloseTo(1);
    expect(result.blocked).toBe(false);
  });
  it('keeps ground and plant terrain waivers from granting free water passage', () => {
    for (const terrainPolicy of [EARTH_WALK_TERRAIN_POLICY, TIMBERWALK_TERRAIN_POLICY]) {
      expect(resolveGroundWaterWalk(ground(), body, { xM: 21, zM: 10 }, 1, { ...profile, terrainPolicy }).xM).toBeCloseTo(20.5);
    }
    expect(resolveGroundWaterWalk(ground(), body, { xM: 21, zM: 10 }, 1, { ...profile, terrainPolicy: ANY_DIFFICULT_TERRAIN_POLICY }).xM).toBeCloseTo(21);
  });
  it('stops a long request before an intermediate deep ribbon even when its destination is dry', () => {
    const from = { xM: 1, zM: 10, yM: 0 };
    const result = resolveGroundWaterWalk(ground(2), from, { xM: 45, zM: 10 }, 50, profile);
    expect(result.blocked).toBe(true); expect(result.water.reason).toBe('deep-water');
    expect(result.xM).toBeLessThanOrEqual(5); expect(result.xM).toBeGreaterThan(1);
    expect(result.yM).toBe(0);
  });
  it('does not invent body clearance or migrate an already accepted wet position', () => {
    const g = ground(2), result = resolveGroundWaterWalk(g, body, { xM: 21, zM: 10 }, 1, profile);
    expect(result).toMatchObject({ ...body, blocked: true, spentMovementM: 0 });
    expect(groundWaterMovementAt(ground(), body, {}).reason).toBe('unknown-body');
    expect(resolveGroundWaterWalk(g, body, body, 0, profile)).toMatchObject({ ...body, blocked: false, spentMovementM: 0 });
  });
  it('preserves unavailable footing rather than lowering feet into the riverbed', () => {
    const from = { ...body, yM: 3 };
    expect(resolveGroundWaterWalk(ground(), from, { xM: 21, zM: 10 }, 1, profile)).toMatchObject({ ...from, blocked: true, spentMovementM: 0 });
  });
  it('keeps a supported deck above water at dry pace', () => {
    const surfaces = { surfaceHeightsAt: () => [3], intersectsBody: () => false };
    const result = resolveGroundWaterWalk(ground(), { ...body, yM: 3 }, { xM: 21, zM: 10 }, 1, profile, undefined, surfaces);
    expect(result.xM).toBeCloseTo(21); expect(result.yM).toBe(3); expect(result.water.mode).toBe('dry');
  });
  it('does not turn unresolved legacy water into a dry shortcut', () => {
    const g = ground(); delete g.rivers[0].waterlineY;
    expect(resolveGroundWaterWalk(g, body, { xM: 21, zM: 10 }, 1, profile)).toMatchObject({ ...body, blocked: true, water: { reason: 'unknown-water' } });
    expect(groundWaterMovementAt(g, { ...body, zM: 1 }, profile).mode).toBe('dry');
  });
  it('charges the wet shore before a dry frame can cross it at full pace', () => {
    const result = resolveGroundWaterWalk(ground(), { ...body, zM: 3 }, { xM: 20, zM: 7 }, 2, profile);
    expect(result.zM).toBeGreaterThan(4.4); expect(result.zM).toBeLessThan(4.8);
    expect(result.spentMovementM).toBeCloseTo(2); expect(result.water.mode).toBe('wading');
  });
});
