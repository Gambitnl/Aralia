import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { generateBuilding } from '../generateBuilding';
import { roomCapFor } from '../partition';

describe('generateBuilding golden', () => {
  for (const type of ['cottage','shop','tavern','workshop','manor'] as const) {
    it(`${type} seed 12345 is stable`, () => {
      const plan = generateBuilding({ buildingId: 1, type, seedPath: rootSeedPath(12345), storeys: type === 'manor' ? 3 : 2, basement: true });
      // summary snapshot: dims, room count + purposes per floor, door/window/stair counts
      const summary = {
        dims: [plan.widthFt, plan.depthFt],
        floors: plan.floors.map((f) => ({
          level: f.level,
          rooms: f.rooms.map((r) => r.purpose).sort(),
          doors: f.doors.length, windows: f.windows.length, walls: f.walls.length,
        })),
        stairs: plan.stairs.length,
      };
      expect(summary).toMatchSnapshot();
      // Wiring guard: generateBuilding must actually pass maxRooms through to partition.
      expect(plan.floors.every((f) => f.rooms.length <= roomCapFor(type) && f.rooms.length >= 3)).toBe(true);
    });
  }
});
