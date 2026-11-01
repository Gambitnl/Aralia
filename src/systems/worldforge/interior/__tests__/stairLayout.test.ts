import { describe, expect, it } from 'vitest';
import { planReturnStair, returnStairCandidates, reserveReturnStair, returnStairPoint, stairDoorAlternatives, stairDoorCells } from '../stairLayout';
import { cellKey } from '../blueprintTypes';
import type { BlueprintPlan, BlueprintRoom } from '../blueprintTypes';

// An unreserved input fixture stays independent of production's now-admitted
// stairs. Real Sypege generation and bed access are checked in stairHousehold.
function townBuildingVisit(_seed: number, _town: number, variant: number): { plan: BlueprintPlan } {
  const cols = variant === 5 ? 8 : 6, rows = 4, split = cols / 2;
  const cells = Array.from({ length: cols * rows }, (_, i) => ({ cx: i % cols, cy: Math.floor(i / cols) }));
  const rooms: BlueprintRoom[] = [0, 1].map(id => ({ id, purpose: id === 0 ? 'hall' : 'bedroom',
    cells: cells.filter(c => (c.cx < split ? 0 : 1) === id), area: split * rows,
    anchor: { cx: id * split + 1, cy: 1 }, bbox: { x: id * split * 5, y: 0, w: split * 5, d: rows * 5 },
    isMain: id === 0, isCorridor: false }));
  return { plan: { buildingId: variant, type: 'cottage', footprintCells: cells, widthFt: cols * 5,
    depthFt: rows * 5, masses: [], stairs: [], floors: [0, 1].map(level => ({ level, rooms,
      doors: [{ a: 1, b: 0, x: split * 5, y: 7.5, axis: 'y', isEntry: false,
        openDir: { nx: -1, ny: 0 }, swingInto: 0 }, ...(level === 0 ? [{ a: -1, b: 0, x: 2.5, y: 0,
        axis: 'x' as const, isEntry: true, openDir: { nx: 0, ny: 1 }, swingInto: 0 }] : [])],
      furnishings: [], windows: [], walls: [], wallRuns: [] })) } };
}

describe('return stair admission', () => {
  for (const plot of [1, 2, 5]) it(`reserves a measured stair inside fixture ${plot}`, () => {
    const { plan } = townBuildingVisit(1793146029630, 10, plot);
    const before = JSON.stringify(plan);
    const layout = planReturnStair(plan.footprintCells, plan.floors)!;
    expect(layout).toBeDefined();
    expect(JSON.stringify(plan)).toBe(before);
    expect(planReturnStair(plan.footprintCells, plan.floors)).toEqual(layout);
    const occupied = new Set(plan.footprintCells.map(c => cellKey(c.cx, c.cy)));
    expect(layout.shaftCells).toHaveLength(4);
    expect(layout.landingCells).toHaveLength(2);
    const reserved = [...layout.shaftCells, ...layout.landingCells].map(c => cellKey(c.cx, c.cy));
    expect(new Set(reserved).size).toBe(6);
    expect(reserved.every(c => occupied.has(c))).toBe(true);
    // A real, moderately pitched stair: 169 mm rises and 267 mm goings.
    const riseM = 10 * 0.3048 / (layout.risesPerFlight * 2);
    const goingM = layout.flightRunFt * 0.3048 / (layout.risesPerFlight - 1);
    expect(riseM).toBeGreaterThan(0.15);
    expect(riseM).toBeLessThan(0.18);
    expect(goingM).toBeGreaterThan(0.26);
    expect(layout.flightWidthFt * 0.3048).toBeGreaterThan(1);
    expect(layout.landingDepthFt * 0.3048).toBeGreaterThan(0.9);
    const blocked = new Set(layout.shaftCells.map(c => cellKey(c.cx, c.cy)));
    for (const floor of plan.floors) for (const door of floor.doors) {
      const alternatives = stairDoorAlternatives(floor, door, blocked);
      expect(alternatives.length).toBeGreaterThan(0);
      if (door.isEntry) expect(alternatives[0]).toBe(door);
    }
    for (const [i, across] of [2.5, 7.5].entries()) {
      const landing = returnStairPoint(layout, -2.5, across);
      expect({ cx: Math.floor(landing.x / 5), cy: Math.floor(landing.y / 5) }).toEqual(layout.landingCells[i]);
    }
  });

  it('refuses a shaft that consumes the only route through a narrow home', () => {
    const { plan } = townBuildingVisit(1793146029630, 10, 1);
    const narrow = plan.footprintCells.filter(c => c.cy === 0);
    expect(planReturnStair(narrow, plan.floors)).toBeUndefined();
    expect(planReturnStair(plan.footprintCells, [plan.floors[0]])).toBeUndefined();
  });

  it('does not move an entry to make a proposed shaft fit', () => {
    const { plan } = townBuildingVisit(1793146029630, 10, 1);
    const door = plan.floors[0].doors.find(d => d.isEntry)!;
    expect(stairDoorAlternatives(plan.floors[0], door, new Set(['0,0']))).toEqual([]);
  });

  for (const plot of [1, 2, 5]) it(`keeps every room connected to the stair without changing fixture ${plot}'s entry identity`, () => {
    const { plan } = townBuildingVisit(1793146029630, 10, plot);
    const before = JSON.stringify(plan);
    const layout = planReturnStair(plan.footprintCells, plan.floors)!;
    const reserved = reserveReturnStair(plan.floors, layout);
    expect(JSON.stringify(plan)).toBe(before);
    const entryIndex = plan.floors.find(f => f.level === 0)!.doors.findIndex(d => d.isEntry);
    expect(reserved.find(f => f.level === 0)!.doors[entryIndex]).toEqual(plan.floors.find(f => f.level === 0)!.doors[entryIndex]);
    for (const floor of reserved) {
      const roomAt = (c: { cx: number; cy: number }) => floor.rooms.find(r => r.cells.some(rc => rc.cx === c.cx && rc.cy === c.cy))?.id ?? -1;
      const ids = floor.rooms.map(r => r.id);
      const reached = new Set([ids[ids.length - 1]]);
      for (let i = 0; i < ids.length; i++) for (const door of floor.doors) {
        if (reached.has(door.a)) reached.add(door.b);
        if (reached.has(door.b)) reached.add(door.a);
        const flanks = stairDoorCells(door).map(roomAt);
        expect(flanks.sort((a, b) => a - b)).toEqual([door.a, door.b].sort((a, b) => a - b));
        expect([door.a, door.b]).toContain(door.swingInto);
        const [negative, positive] = stairDoorCells(door);
        const swingSign = door.axis === 'x' ? door.openDir.ny : door.openDir.nx;
        expect(roomAt(swingSign > 0 ? positive : negative)).toBe(door.swingInto);
      }
      expect(ids.every(id => reached.has(id))).toBe(true);
      expect(floor.rooms.flatMap(r => r.cells)).toHaveLength(plan.footprintCells.length);
      expect(new Set(floor.rooms.flatMap(r => r.cells.map(c => cellKey(c.cx, c.cy)))).size).toBe(plan.footprintCells.length);
      const originalTags = plan.floors.find(f => f.level === floor.level)!.rooms.flatMap(r => r.forSlot?.split(',') ?? []).sort();
      expect(floor.rooms.flatMap(r => r.forSlot?.split(',') ?? []).sort()).toEqual(originalTags);
    }
  });
});


it('reserves the full wider stair and landing for an explicit body envelope',()=>{
 const {plan}=townBuildingVisit(0,0,1),before=JSON.stringify(plan);
 const layout=returnStairCandidates(plan.footprintCells,plan.floors,1.2).next().value!;
 expect(layout).toBeDefined();expect(JSON.stringify(plan)).toBe(before);
 expect(layout.shaftCells).toHaveLength(6);
 expect(layout.flightWidthFt*.3048).toBeGreaterThanOrEqual(1.2);
 expect(layout.landingDepthFt*.3048).toBeGreaterThanOrEqual(1.2);
 expect(layout.flightRunFt+layout.landingDepthFt).toBe(15);
 expect(10*.3048/(layout.risesPerFlight*2)).toBeCloseTo(.1524);
 expect(layout.flightRunFt*.3048/(layout.risesPerFlight-1)).toBeCloseTo(.3386666667);
 expect(returnStairCandidates(plan.footprintCells,plan.floors,1.5).next().value).toBeUndefined();
});
