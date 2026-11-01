import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { doorInteractionError } from '../groundDoorInteraction';
import type { FurnishingPick } from '../groundFurnishingInteraction';
import { doorPartForState, siteDoorId, siteDoorLocalPose, sitePartLocalOffset } from '@/systems/worldforge/bridge/sitePartTransform';
import { type BlueprintPlan, EXTERIOR } from '@/systems/worldforge/interior/blueprintTypes';
import { generateBuilding } from '@/systems/worldforge/interior/generateBuilding';
import { buildInteriorParts } from '@/systems/worldforge/bridge/interiorParts';
import { rootSeedPath } from '@/systems/worldforge/seedPath';

const FT = 0.3048;
function fixture(axis: 'x' | 'y' = 'x', swing = 1, yaw = 0, sign = -1) {
  const door = { a: EXTERIOR, b: 0, x: axis === 'x' ? 5 : swing > 0 ? 0 : 10,
    y: axis === 'y' ? 5 : swing > 0 ? 0 : 10, axis, isEntry: true,
    openDir: { nx: axis === 'y' ? swing : 0, ny: axis === 'x' ? swing : 0 }, swingInto: 0 };
  const plan = { widthFt: 10, depthFt: 10, floors: [{ level: 0, doors: [door], rooms: [
    { id: 0, cells: [{ cx: 0, cy: 0 }, { cx: 1, cy: 0 }, { cx: 0, cy: 1 }, { cx: 1, cy: 1 }] },
  ] }] } as unknown as BlueprintPlan;
  const x = (door.x - 5) * FT, z = (door.y - 5) * FT;
  const pick: FurnishingPick = { siteId: 'wf-plot-10-1', part: { x, z, w: axis === 'x' ? .9144 : .21,
    d: axis === 'x' ? .21 : .9144, h: 2.1, colorHex: '#4a3220',
    door: { id: siteDoorId(0, 0, axis, x, z), level: 0, index: 0, axis, swingX: door.openDir.nx, swingZ: door.openDir.ny } },
    transform: { groupX: 100, groupZ: 200, surfaceY: 4, rotationY: yaw, doorZSign: sign } };
  const foot = (along = 0, inward = -.8, height = 4) => {
    const pos = new THREE.Vector3(x + (axis === 'x' ? along : swing * inward), height,
      (z + (axis === 'y' ? along : swing * inward)) * -sign).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return { xM: 100 + pos.x, zM: 200 + pos.z, yM: height };
  };
  return { plan, pick, foot };
}

describe('physical entry door', () => {
  for (const axis of ['x', 'y'] as const) for (const swing of [-1, 1]) for (const sign of [-1, 1]) {
    it(`matches real leaf bounds and admits street/entry reach: ${axis}, swing ${swing}, sign ${sign}`, () => {
      const { plan, pick, foot } = fixture(axis, swing, .73, sign);
      expect(doorInteractionError(plan, pick, foot(), false)).toBeNull();
      expect(doorInteractionError(plan, pick, foot(0, .8), false)).toBeNull();
      const pose = siteDoorLocalPose(pick.part, sign, true);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pick.part.w, pick.part.h, pick.part.d));
      mesh.position.set(pose.offset.x, pose.offset.y, pose.offset.z); mesh.rotation.y = pose.rotationY;
      mesh.updateMatrixWorld();
      const actual = new THREE.Box3().setFromObject(mesh);
      const solid = doorPartForState(pick.part, true), offset = sitePartLocalOffset(solid, sign);
      // Three derives bounds from float vertices; compare below a picometer
      // at the center rather than requiring identical arithmetic rounding.
      expect(actual.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(offset.x, offset.y, offset.z))).toBeLessThan(1e-12);
      const size = actual.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(solid.w, 6); expect(size.z).toBeCloseTo(solid.d, 6);
      mesh.geometry.dispose();
    });
  }

  it('rejects a destination, stale geometry, another floor, and distant reach', () => {
    const { plan, pick, foot } = fixture();
    expect(doorInteractionError(plan, pick, null, false)).toContain('arrives');
    expect(doorInteractionError(plan, pick, foot(0, -.8, 7), false)).toContain('same floor');
    expect(doorInteractionError(plan, pick, foot(0, -3), false)).toContain('closer');
    expect(doorInteractionError(plan, { ...pick, part: { ...pick.part, x: 1 } }, foot(), false)).toContain('changed');
    expect(doorInteractionError(plan, pick, foot(1.5, -.3), false)).toContain('doorway');
  });

  it('will not close on the player or swing into their footprint', () => {
    const { plan, pick, foot } = fixture();
    expect(doorInteractionError(plan, pick, foot(0, 0), true)).toContain('before closing');
    expect(doorInteractionError(plan, pick, foot(-.45, .4), false)).toContain('before opening');
  });

  it('stamps the production entry with its actual plan identity and inward swing', () => {
    const plan = generateBuilding({ buildingId: 3, type: 'townhouse', seedPath: rootSeedPath(19), storeys: 2, basement: true });
    const parts = buildInteriorParts({ id: 3, role: 'house', storeys: 2,
      footprint: [[0, 0], [plan.widthFt, 0], [plan.widthFt, plan.depthFt], [0, plan.depthFt]],
    }, rootSeedPath(19), 20 * FT, [], plan);
    const leaves = parts.filter(p => p.door);
    expect(leaves).toHaveLength(1);
    const part = leaves[0], source = plan.floors.find(f => f.level === 0)!.doors[part.door!.index];
    expect(part.door).toMatchObject({ level: 0, axis: source.axis, swingX: source.openDir.nx, swingZ: source.openDir.ny });
    expect(part.door!.id).toBe(siteDoorId(0, part.door!.index, source.axis, part.x, part.z));
    expect(source.axis === 'x' ? part.w : part.d).toBeCloseTo(3 * FT);
    expect(source.axis === 'x' ? part.d : part.w).toBe(.06);
  });
});
