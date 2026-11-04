// A small authored geometry fixture keeps migration tests independent of
// future town generation. Native Tankard play supplies the separate arrival proof.
import {describe, expect, it, vi} from 'vitest';
import type {BlueprintPlan, BlueprintRoom} from '../blueprintTypes';
import {roomWithCells} from '../stairLayout';
import {buildWalls, mergeWallRuns} from '../walls';
import {canonicalTownSeedPath} from '../../town/canonicalTown';
import {guestCirculationRecipeFor, guestCirculationDoorMoves, guestCirculationRevisionAgrees,
  planGuestCirculation, PUBLIC_GUEST_DOORS_RECIPE, GUEST_CIRCULATION_RECIPE} from '../guestCirculation';
import {buildingPlanSignature, captureObservedBuildingSource, readObservedBuildingSource} from '../buildingSource';
import {townReducer} from '@/state/reducers/townReducer';
import {createMockGameState} from '@/utils/core';
import * as generator from '../generateBuilding';

const seed = canonicalTownSeedPath(123, 740);
function fixture(): BlueprintPlan {
  const cells = (x: number, y: number, w: number, h: number) => Array.from({length: w * h}, (_, i) => ({cx: x + i % w, cy: y + Math.floor(i / w)}));
  const room = (id: number, purpose: BlueprintRoom['purpose'], x: number, y: number, w: number, h: number) =>
    roomWithCells({id, purpose, cells: [], bbox: {x: 0, y: 0, w: 0, d: 0}, anchor: {cx: x, cy: y},
      area: 0, isMain: id === 0, isCorridor: false}, cells(x, y, w, h));
  const rooms = [room(0, 'common-room', 0, 0, 4, 4), room(1, 'guest-room', 4, 0, 2, 2),
    room(2, 'guest-room', 4, 2, 2, 2), room(3, 'kitchen', 0, 4, 3, 2), room(4, 'kitchen', 3, 4, 3, 2)];
  const doors = [
    {a: 3, b: 0, x: 7.5, y: 20, axis: 'x' as const, isEntry: false, swingInto: 0, openDir: {nx: 0, ny: -1}},
    {a: 4, b: 0, x: 17.5, y: 20, axis: 'x' as const, isEntry: false, swingInto: 0, openDir: {nx: 0, ny: -1}},
    {a: 2, b: 4, x: 27.5, y: 20, axis: 'x' as const, isEntry: false, swingInto: 4, openDir: {nx: 0, ny: 1}},
    {a: 2, b: 1, x: 22.5, y: 10, axis: 'x' as const, isEntry: false, swingInto: 1, openDir: {nx: 0, ny: -1}},
    {a: 4, b: 3, x: 15, y: 22.5, axis: 'y' as const, isEntry: false, swingInto: 3, openDir: {nx: -1, ny: 0}},
    {a: -1, b: 0, x: 12.5, y: 0, axis: 'x' as const, isEntry: true, swingInto: 0, openDir: {nx: 0, ny: 1}}];
  const grid = Array.from({length: 6}, () => Array<number>(6).fill(-1));
  for (const r of rooms) for (const c of r.cells) grid[c.cy][c.cx] = r.id;
  const built = buildWalls(seed, grid, doors, rooms);
  return {buildingId: 68, type: 'inn', widthFt: 30, depthFt: 30, footprintCells: cells(0, 0, 6, 6),
    stairs: [], masses: [{kind: 'main', x: 0, y: 0, w: 6, h: 6}], floors: [{level: 0, rooms, doors,
      windows: built.windows, walls: built.walls, wallRuns: mergeWallRuns(built.walls),
      furnishings: [{kind: 'bed', roomId: 1, x: 27, y: 3, rotation: 0}, {kind: 'bed', roomId: 2, x: 27, y: 13.5, rotation: 0}]}]};
}

describe('retained rectangular inn public passages', () => {
  it('opens each guest room directly to the common room, preserving all old references and unrelated bytes', () => {
    const before = fixture(), original = structuredClone(before), after = planGuestCirculation(before, seed)!;
    expect(after).toBeDefined(); expect(before).toEqual(original);
    expect(guestCirculationRecipeFor(before)).toBe(PUBLIC_GUEST_DOORS_RECIPE);
    expect(after.floors[0].doors.slice(-2).map(d => [d.a, d.b, d.x, d.y])).toEqual([[0, 1, 20, 7.5], [0, 2, 20, 12.5]]);
    expect(after.floors[0].doors.slice(0, 6)).toEqual(before.floors[0].doors);
    expect(after.floors[0].furnishings).toEqual(before.floors[0].furnishings);
    expect(after.floors[0].rooms).toEqual(before.floors[0].rooms);
    expect(after.floors[0].windows).toEqual(before.floors[0].windows);
    expect(after.floors[0].walls).toHaveLength(before.floors[0].walls.length - 2);
    expect(guestCirculationDoorMoves(before, after).every(d => d.from === d.to)).toBe(true);
    expect(guestCirculationRevisionAgrees(before, after, PUBLIC_GUEST_DOORS_RECIPE)).toBe(true);
    expect(guestCirculationRevisionAgrees(before, after, GUEST_CIRCULATION_RECIPE)).toBe(false);
    for (const change of [(p: BlueprintPlan) => {p.floors[0].furnishings[0].x += 1;},
      (p: BlueprintPlan) => {p.floors[0].windows.pop();}, (p: BlueprintPlan) => {p.floors[0].walls.pop();}]) {
      const bad = structuredClone(after); change(bad);
      expect(guestCirculationRevisionAgrees(before, bad, PUBLIC_GUEST_DOORS_RECIPE)).toBe(false);
    }
  });
  it('refuses missing actual walls, different rooms and private-leaf sources', () => {
    for (const change of [(p: BlueprintPlan) => {p.floors[0].rooms[1].purpose = 'bedroom';},
      (p: BlueprintPlan) => {p.floors[0].walls = p.floors[0].walls.filter(w => w.x !== 20 || w.y !== 7.5);},
      (p: BlueprintPlan) => {p.doorLeafProfile = 'private-room-leaves-v1';}]) {
      const plan = fixture(); change(plan); expect(planGuestCirculation(plan, seed)).toBeUndefined();
    }
  });
  it('admits only outside, retains bookings and accepted feet, and reads the frozen revision without generation', () => {
    const plan = fixture(), signature = buildingPlanSignature(plan);
    const position = {tileX: 2015, tileY: 0, xM: 0, zM: 0, yM: .122};
    const source = captureObservedBuildingSource({worldSeed: 123, burgId: 740, plotId: 68, cellId: 2015,
      observedAt: '0351-01-06T15:25:00Z', position, historySignature: 'null', plan, workplaceOnly: true, manifests: [],
      site: {xM: 0, zM: 0, surfaceY: 0, rotationY: 0, doorZSign: -1}}, signature);
    const state = createMockGameState({worldSeed: 123, playerCell: {cellId: 2015, localeCoords: null},
      party: [createMockGameState().party[0]], playerGroundPos: position,
      townSim: {740: {burgId: 740, villagers: {}, lastSimDay: 1, nextVillagerId: 1,
        chronicle: {burgId: 740, events: [], nextEventId: 1}, buildingSources: {68: source}}}});
    const action = {type: 'ADMIT_GUEST_CIRCULATION_REPAIR' as const, payload: {burgId: 740, plotId: 68, sourceSignature: signature, mountedSignature: signature}};
    expect(townReducer(state, action)).toEqual({});
    const outside = {...state, playerGroundPos: {...position, zM: -12}};
    const result = townReducer(outside, action); expect(Object.keys(result)).toEqual(['townSim']);
    const recorded = result.townSim![740].buildingSources![68];
    const {circulationRepair, ...untouched} = recorded; expect(untouched).toEqual(source);
    expect(circulationRepair!.recipe).toBe(PUBLIC_GUEST_DOORS_RECIPE);
    const generate = vi.spyOn(generator, 'generateBuilding').mockImplementation(() => {throw Error('Do not generate');});
    try {
      expect(readObservedBuildingSource({worldSeed: 123, burgId: 740, source: JSON.parse(JSON.stringify(recorded))}, 68).plan).toEqual(circulationRepair!.plan);
      expect(generate).not.toHaveBeenCalled();
    } finally {generate.mockRestore();}
    expect(outside.playerGroundPos).toEqual({...position, zM: -12});
    const bad = structuredClone(recorded); bad.circulationRepair!.plan.floors[0].furnishings[0].x += 1;
    bad.circulationRepair!.planSignature = buildingPlanSignature(bad.circulationRepair!.plan);
    expect(() => readObservedBuildingSource({worldSeed: 123, burgId: 740, source: bad}, 68)).toThrow('original references');
  });
});
