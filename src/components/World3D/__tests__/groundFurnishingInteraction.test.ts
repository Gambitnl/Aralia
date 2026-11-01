/** Physical furniture cannot be examined through a wall, from another floor,
 * or merely because its position was selected as a walking destination. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { furnishingReachError, type FurnishingPick } from '../groundFurnishingInteraction';
import type { BlueprintPlan } from '../../../systems/worldforge/interior/blueprintTypes';
import { buildInteriorParts } from '../../../systems/worldforge/bridge/interiorParts';
import { generateBuilding } from '../../../systems/worldforge/interior/generateBuilding';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';

const FT = 0.3048;
const cells = Array.from({ length: 9 }, (_, i) => ({ cx: i % 3, cy: Math.floor(i / 3) }));
const plan = { widthFt: 30, depthFt: 15, floors: [0, 1].map(level => ({
  level, rooms: [{ id: 0, cells }], furnishings: [{ kind: 'bed', roomId: 0, x: 12, y: 7.5, rotation: 0 }],
})) } as unknown as BlueprintPlan;

function receipt(level = 0, rotationY = 0, doorZSign = -1): FurnishingPick {
  return { siteId: 'wf-plot-10-1', part: {
    x: -3 * FT, z: 0, w: 1, d: 2, h: 0.6, colorHex: '#7da0c4', baseY: level * 10 * FT,
    furnishing: { level, roomId: 0, index: 0, kind: 'bed' },
  }, transform: { groupX: 20, groupZ: 30, surfaceY: 4, rotationY, doorZSign } };
}

function footfall(pick: FurnishingPick, xFt = 9, yFt = 7.5, level = 0) {
  const t = pick.transform;
  const point = new THREE.Vector3((xFt - 15) * FT, level * 10 * FT, (yFt - 7.5) * FT * -t.doorZSign)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), t.rotationY).add(new THREE.Vector3(t.groupX, t.surfaceY, t.groupZ));
  return { xM: point.x, yM: point.y, zM: point.z };
}

describe('physical furnishing reach', () => {
  for (const yaw of [0, 0.7, -2.2]) for (const sign of [-1, 1]) {
    it(`admits a nearby real footfall under yaw ${yaw} and door sign ${sign}`, () => {
      const pick = receipt(0, yaw, sign);
      expect(furnishingReachError(plan, pick, footfall(pick))).toBeNull();
    });
  }

  it('rejects a nearby piece through the room wall', () => {
    const pick = receipt();
    expect(furnishingReachError(plan, pick, footfall(pick, 15.1))).toContain('Enter this room');
  });

  it('rejects an upper floor under the same planar position', () => {
    const pick = receipt(1);
    expect(furnishingReachError(plan, pick, footfall(pick))).toContain('same floor');
    expect(furnishingReachError(plan, pick, footfall(pick, 9, 7.5, 1))).toBeNull();
  });

  it('uses actual arrival rather than the near destination', () => {
    const pick = receipt();
    expect(furnishingReachError(plan, pick, footfall(pick, 1, 1))).toContain('Move closer');
    expect(furnishingReachError(plan, pick, null)).toContain('arrives');
    expect(furnishingReachError(plan, pick, { xM: NaN, yM: 0, zM: 0 })).toContain('arrives');
  });

  it('rejects stale identity and geometry receipts', () => {
    const pick = receipt();
    expect(furnishingReachError(plan, { ...pick, part: { ...pick.part, furnishing: { ...pick.part.furnishing!, index: 999 } } }, footfall(pick))).toContain('no longer available');
    expect(furnishingReachError(plan, { ...pick, part: { ...pick.part, x: pick.part.x + FT } }, footfall(pick))).toContain('changed');
  });

  it('preserves every real furnishing identity through the production part bridge', () => {
    const building = generateBuilding({ buildingId: 3, type: 'townhouse', seedPath: rootSeedPath(19), storeys: 2, basement: true });
    const parts = buildInteriorParts({ id: 3, role: 'house', storeys: 2,
      footprint: [[0, 0], [building.widthFt, 0], [building.widthFt, building.depthFt], [0, building.depthFt]],
    }, rootSeedPath(19), 20 * FT, [], building);
    const pieces = parts.filter(part => part.furnishing);
    expect(pieces.length).toBe(building.floors.reduce((count, floor) => count + floor.furnishings.length, 0));
    for (const piece of pieces) {
      const identity = piece.furnishing!;
      expect(building.floors.find(floor => floor.level === identity.level)!.furnishings[identity.index])
        .toMatchObject({ kind: identity.kind, roomId: identity.roomId });
    }
  });
});
