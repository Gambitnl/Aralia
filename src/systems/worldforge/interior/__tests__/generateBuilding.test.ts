import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { generateBuilding } from '../generateBuilding';
import { EXTERIOR } from '../blueprintTypes';

const gen = (over = {}) => generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(3), storeys: 3, basement: true, ...over });

describe('generateBuilding', () => {
  it('is byte-identical for the same input', () => {
    expect(JSON.stringify(gen())).toBe(JSON.stringify(gen()));
  });

  it('has a basement, ground, and upper floors ordered by level', () => {
    const plan = gen();
    const levels = plan.floors.map((f) => f.level);
    expect(levels).toContain(-1);
    expect(levels).toContain(0);
    expect(levels).toContain(2);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels); // already ascending
  });

  it('only the ground floor has a street entry (one exterior door)', () => {
    for (const seed of [3, 7, 11]) {
      const plan = generateBuilding({
        buildingId: 1, type: 'manor', seedPath: rootSeedPath(seed), storeys: 3, basement: true,
      });
      for (const floor of plan.floors) {
        const exterior = floor.doors.filter((d) => d.a === EXTERIOR);
        if (floor.level === 0) {
          expect(exterior).toHaveLength(1);
          expect(exterior[0].isEntry).toBe(true);
        } else {
          expect(exterior).toHaveLength(0);
          expect(floor.doors.some((d) => d.isEntry)).toBe(false);
        }
      }
    }
  });

  it('a stair lands inside a room on both floors it joins', () => {
    const plan = gen();
    for (const st of plan.stairs) {
      for (const lvl of [st.fromLevel, st.fromLevel + 1]) {
        const floor = plan.floors.find((f) => f.level === lvl)!;
        const inRoom = floor.rooms.some((r) =>
          r.cells.some((c) => c.cx === Math.floor(st.x / 5) && c.cy === Math.floor(st.y / 5)));
        expect(inRoom).toBe(true);
      }
    }
  });
});
