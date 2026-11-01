import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { townBuildingVisit } from '../../Worldforge/townBuildingVisit';
import { buildBlueprintParts } from '@/systems/worldforge/bridge/interiorParts';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { groundWalkHeight, resolveGroundWalk } from '../groundBuildingMotion';

function fixture(yaw = 0, sign = -1) {
  const { plan } = townBuildingVisit(1793146029630, 10, 1);
  const { parts } = buildBlueprintParts(plan, 3.048, '#aaa');
  const project = (xFt: number, yFt: number) => {
    const p = new THREE.Vector3((xFt - 15) * .3048, 0, (yFt - 7.5) * .3048 * -sign)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return { xM: p.x + 100, zM: p.z + 100 };
  };
  const cornersM = [[0, 0], [30, 0], [30, 15], [0, 15]].map(([x, y]) => { const p = project(x, y); return { x: p.xM, z: p.zM }; });
  const ground = { cols: 1, rows: 1, heights: [0], buildings: [{ id: 'home', xM: 100, zM: 100, cornersM, parts }] } as unknown as GroundWorld;
  return { ground, project, parts };
}

describe('supported stair movement', () => {
  for (const yaw of [0, .73]) for (const sign of [-1, 1]) it(`climbs and descends actual Hartdown treads at yaw ${yaw}, sign ${sign}`, () => {
    const { ground, project } = fixture(yaw, sign);
    const start = project(18, 2.5);
    let pose = { ...start, yM: groundWalkHeight(ground, start) };
    const path = [[26.5, 2.5], [28.5, 2.5], [28.5, 7.5], [21, 7.5], [18, 7.5]];
    for (const [x, y] of path) {
      const target = project(x, y);
      const motion = resolveGroundWalk(ground, pose, target);
      expect(motion.blocked, JSON.stringify({ pose, target, motion })).toBe(false);
      expect(Math.hypot(motion.xM - target.xM, motion.zM - target.zM)).toBeLessThan(1e-6);
      pose = motion;
    }
    expect(pose.yM).toBeCloseTo(3.16992);
    expect(groundWalkHeight(ground, JSON.parse(JSON.stringify(pose)))).toBeCloseTo(pose.yM);
    for (const [x, y] of [...path.slice(0, -1).reverse(), [18, 2.5]]) {
      const motion = resolveGroundWalk(ground, pose, project(x, y));
      expect(motion.blocked, JSON.stringify({ pose, motion })).toBe(false);
      pose = motion;
    }
    expect(pose.yM).toBeCloseTo(.12192);
  });

  it('stops at a floor hole instead of snapping to terrain below', () => {
    const { ground, project } = fixture();
    const result = resolveGroundWalk(ground, { ...project(18, 2.5), yM: 3.16992 }, project(24, 2.5));
    expect(result.blocked).toBe(true);
    expect(result.yM).toBeCloseTo(3.16992);
  });

  it('climbs beside Blackford without colliding with its hidden duplicate party wall', () => {
    const { ground, project } = fixture();
    const neighbor = townBuildingVisit(1793146029630, 10, 2).plan;
    const { parts } = buildBlueprintParts(neighbor, 3.048, '#aaa');
    ground.buildings.push({ ...ground.buildings[0], id: 'neighbor', xM: 100 + 30 * .3048,
      cornersM: [[30, 0], [60, 0], [60, 15], [30, 15]].map(([x, y]) => { const p = project(x, y); return { x: p.xM, z: p.zM }; }), parts });
    expect(parts.some(p => p.renderRole === 'tactical-only')).toBe(true);
    const landed = resolveGroundWalk(ground, { ...project(27.5, 2.5), yM: 1.64592 }, project(28.5, 2.5));
    expect(landed.blocked).toBe(false);
    const boundary = resolveGroundWalk(ground, landed, project(31, 2.5));
    expect(boundary.blocked).toBe(true);
  });

  it('rejects a low overhead slab and keeps the current supported height', () => {
    const { ground, project, parts } = fixture();
    parts.push({ x: 3, z: -1.524, w: 1, d: 2, h: .1, baseY: 1.8, colorHex: '#aaa' });
    const result = resolveGroundWalk(ground, { ...project(18, 2.5), yM: .12192 }, project(26, 2.5));
    expect(result.blocked).toBe(true);
    expect(result.yM).toBeLessThan(1);
  });

  it('does not climb an excessive rise merely because its top is tagged walkable', () => {
    const { ground, project } = fixture();
    ground.buildings[0].parts = [
      { x: 0, z: 0, w: 10, d: 4, h: .12, colorHex: '#aaa', walkSurface: 'floor' },
      { x: .8, z: 0, w: .5, d: 4, baseY: .12, h: .28, colorHex: '#aaa', walkSurface: 'tread', stairSolid: true },
    ];
    const result = resolveGroundWalk(ground, { ...project(15, 7.5), yM: .12 }, project(20, 7.5));
    expect(result.blocked).toBe(true);
    expect(result.yM).toBeCloseTo(.12);
    expect(result.xM).toBeLessThan(100.55);
  });

  it('keeps the visible inside guard solid without moving the body onto the rail', () => {
    const { ground, project } = fixture();
    const from = { ...project(20.4375, 2.5), yM: .12192 + 3.048 / 18 };
    const result = resolveGroundWalk(ground, from, project(20.4375, 5));
    expect(result.blocked).toBe(true);
    expect(result.zM).toBeLessThan(project(20.4375, 4.25).zM);
    expect(result.yM).toBeCloseTo(from.yM);
  });
});
