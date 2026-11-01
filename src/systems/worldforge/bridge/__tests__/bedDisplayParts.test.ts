/** Bed dressing receives facing without replacing canonical furniture or stock. */
import {describe, expect, it} from 'vitest';
import {buildInteriorParts} from '../interiorParts';
import {blueprintForPlot, type InteriorPlotInput} from '../../interior/generateInterior';
import {rootSeedPath} from '../../seedPath';

describe('bed display source boundary', () => {
  it('carries all four facings while preserving the complete blueprint and every other part', () => {
    const input: InteriorPlotInput = {id: 7, role: 'house', storeys: 2,
      footprint: [[0, 0], [35, 0], [35, 30], [0, 30]], buildingType: 'townhouse'};
    const seed = rootSeedPath(42), plan = structuredClone(blueprintForPlot(input, seed));
    const floor = plan.floors.find(f => f.level === 1)!;
    // Give one existing room an ordinary bed; facing alone varies across trials.
    floor.furnishings = [{kind: 'bed', roomId: floor.rooms[0].id, x: 7.5, y: 7.5, rotation: 0}];
    let first: ReturnType<typeof buildInteriorParts> | undefined;
    for (const rotation of [0, 90, 180, 270] as const) {
      floor.furnishings[0].rotation = rotation;
      const before = structuredClone(plan), parts = buildInteriorParts(input, seed, 6, [], plan);
      const bed = parts.find(p => p.furnishing?.level === 1 && p.furnishing.index === 0)!;
      expect(bed.bedFacing).toBe(rotation);
      expect(bed.furnishing).toEqual({level: 1, index: 0, roomId: floor.rooms[0].id, kind: 'bed'});
      expect([bed.w, bed.h, bed.d]).toEqual(rotation % 180 ? [2, .6, 1] : [1, .6, 2]);
      expect(plan).toEqual(before);
      const otherParts = parts.filter(p => p !== bed);
      if (first) expect(otherParts).toEqual(first);
      else first = otherParts;
    }
  });
});
