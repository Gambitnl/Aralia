/** Explicit compatibility proposals for inspected inn circulation families.
 * The parcel and original source stay intact. Depending on the inspected
 * family, a wider rear landing or direct common-room passages serve guests.
 * This is a bounded migration recipe, not a replacement for every inn. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 08:18:36
 * Dependents: components/World3D/World3DWrapper.tsx, state/reducers/townReducer.ts, systems/worldforge/interior/buildingSource.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {BlueprintPlan, BlueprintFloor, BlueprintDoor, BlueprintRoom, Cell, RoofPlane} from './blueprintTypes';
import {blueprintSiteOrigin, cellKey} from './blueprintTypes';
import {childSeedPath, type SeedPath} from '../seedPath';
import {roomWithCells, stairDoorCells} from './stairLayout';
import {buildWalls, mergeWallRuns} from './walls';
import {solveRoof, planeZAt} from './roofPlan';
import {roomFurnishingsReachable} from './buildingLayoutRepair';
import {furnishingFootprint} from './householdFurnish';
import {siteDoorId} from '../bridge/sitePartTransform';

export const GUEST_CIRCULATION_RECIPE = 'left-return-guest-circulation-v1' as const;
export const PUBLIC_GUEST_DOORS_RECIPE = 'rectangular-public-guest-doors-v1' as const;
type GuestCirculationRecipe = typeof GUEST_CIRCULATION_RECIPE | typeof PUBLIC_GUEST_DOORS_RECIPE;
export interface GuestCirculationRepair {
  version: 1; recipe: GuestCirculationRecipe;
  sourceSignature: string; planSignature: string; plan: BlueprintPlan;
  admittedAt: string;
  position: {tileX: number; tileY: number; xM: number; zM: number; yM: number};
  doorMoves: Array<{from: string; to: string}>;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cells = (x: number, y: number, w: number, h: number): Cell[] =>
  Array.from({length: w * h}, (_, i) => ({cx: x + i % w, cy: y + Math.floor(i / w)}));
const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const PUBLIC_GUEST_ROOM_SHAPES: Array<[number, BlueprintRoom['purpose'], number, number, number, number]> = [
  [0, 'common-room', 0, 0, 20, 20], [1, 'guest-room', 20, 0, 10, 10],
  [2, 'guest-room', 20, 10, 10, 10], [3, 'kitchen', 0, 20, 15, 10], [4, 'kitchen', 15, 20, 15, 10]];

/** Cheap admission prefilter. The planner below still checks the actual room
 * cells, wall edges and furniture routes before offering a retained revision. */
export function guestCirculationRecipeFor(plan: BlueprintPlan): GuestCirculationRecipe | undefined {
  if (plan.type !== 'inn') return;
  if (plan.ensemble?.lotProfile === 'left-return') return GUEST_CIRCULATION_RECIPE;
  const ground = plan.floors.find(f => f.level === 0);
  if (plan.widthFt === 30 && plan.depthFt === 30 && ground?.rooms.length === 5
    && ground.doors.length === 6 && !plan.doorLeafProfile && !plan.liveHistory?.eventsApplied
    && PUBLIC_GUEST_ROOM_SHAPES.every(([id, purpose, x, y, w, d]) => ground.rooms.some(r =>
      r.id === id && r.purpose === purpose && same(r.bbox, {x, y, w, d})))) return PUBLIC_GUEST_DOORS_RECIPE;
}

/** This old rectangular family put two guestrooms behind one another and a
 * kitchen. Add public common-room passages without moving a paid bed, changing
 * a room, or replacing any existing opening. Legacy passages remain leafless;
 * this does not enroll an old inn in the separate private-leaf profile. */
function publicGuestDoorProposal(before: BlueprintPlan): BlueprintPlan | undefined {
  if (guestCirculationRecipeFor(before) !== PUBLIC_GUEST_DOORS_RECIPE || before.liveHistory?.eventsApplied) return;
  const ground = before.floors.find(f => f.level === 0)!;
  if (before.footprintCells.length !== 36 || cells(0, 0, 6, 6).some(c =>
    !before.footprintCells.some(p => p.cx === c.cx && p.cy === c.cy))
    || PUBLIC_GUEST_ROOM_SHAPES.some(([id, purpose, x, y, w, d]) => {
      const room = ground.rooms.find(r => r.id === id);
      return !room || room.purpose !== purpose || !same(room.bbox, {x, y, w, d})
        || room.cells.length !== Number(w) * Number(d) / 25
        || cells(Number(x) / 5, Number(y) / 5, Number(w) / 5, Number(d) / 5).some(c =>
          !room.cells.some(p => p.cx === c.cx && p.cy === c.cy));
    })) return;
  const after = structuredClone(before), floor = after.floors.find(f => f.level === 0)!;
  const added = [doorFor(floor, 20, 7.5, 'y'), doorFor(floor, 20, 12.5, 'y')];
  // Remove only the two actual separating wall cells. Keep the other wall
  // bytes and all existing windows, including history-bearing exterior walls.
  if (added.some(d => floor.doors.some(old => old.axis === d.axis && old.x === d.x && old.y === d.y)
    || floor.walls.filter(w => w.kind === 'inner' && w.axis === d.axis && w.x === d.x && w.y === d.y).length !== 1)) return;
  floor.doors.push(...added);
  floor.walls = floor.walls.filter(w => !added.some(d => d.axis === w.axis && d.x === w.x && d.y === w.y));
  floor.wallRuns = mergeWallRuns(floor.walls);
  if (![1, 2].every(id => roomFurnishingsReachable(floor, id, .5)) || !retainBackstory(before, after)) return;
  return after;
}

/** Validate the new recipe's narrow structural delta on load. No source or
 * furniture generator runs here, and every unrelated field must remain exact. */
export function guestCirculationRevisionAgrees(before: BlueprintPlan, after: BlueprintPlan, recipe: string): boolean {
  if (!guestCirculationReferencesAgree(before, after)) return false;
  if (recipe === GUEST_CIRCULATION_RECIPE) return guestCirculationRecipeFor(before) === GUEST_CIRCULATION_RECIPE;
  if (recipe !== PUBLIC_GUEST_DOORS_RECIPE) return false;
  const expected = publicGuestDoorProposal(before);
  return !!expected && same(expected, after);
}

function doorFor(floor: BlueprintFloor, x: number, y: number, axis: 'x' | 'y'): BlueprintDoor {
  const sides = stairDoorCells({x, y, axis});
  const rooms = sides.map(c => floor.rooms.find(r => r.cells.some(p => p.cx === c.cx && p.cy === c.cy))!);
  if (rooms.some(r => !r) || rooms[0].id === rooms[1].id) throw new Error('Guest circulation door needs two rooms.');
  // Swing into the guest room so the shared landing remains a clear route.
  const into = rooms.find(r => r.purpose === 'guest-room') ?? rooms[1];
  const sign = into === rooms[1] ? 1 : -1;
  return {a: rooms.find(r => r !== into)!.id, b: into.id, x, y, axis, isEntry: false,
    swingInto: into.id, openDir: {nx: axis === 'y' ? sign : 0, ny: axis === 'x' ? sign : 0}};
}

/** Preserve the coordinate-qualified state of each existing door, even when a
 * non-entry opening moves. Unknown legacy keys remain present, never erased. */
export function guestCirculationDoorMoves(before: BlueprintPlan, after: BlueprintPlan) {
  const a = blueprintSiteOrigin(before), b = blueprintSiteOrigin(after);
  return before.floors.flatMap(f => f.doors.map((d, i) => {
    const next = after.floors.find(n => n.level === f.level)!.doors[i];
    return {from: siteDoorId(f.level, i, d.axis, (d.x - a.x) * .3048, (d.y - a.y) * .3048),
      to: siteDoorId(f.level, i, next.axis, (next.x - b.x) * .3048, (next.y - b.y) * .3048)};
  }));
}

function containsXY(poly: RoofPlane, x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.pts.length; i++) {
    const a = poly.pts[i], b = poly.pts[(i + 1) % poly.pts.length];
    const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(cross) < 1e-5) continue;
    if (sign && sign !== Math.sign(cross)) return false;
    sign = Math.sign(cross);
  }
  return true;
}

function furnishingsFit(floor: BlueprintFloor): boolean {
  return floor.furnishings.every((piece, i) => {
    const box = furnishingFootprint(piece), room = floor.rooms.find(r => r.id === piece.roomId);
    if (!room) return false;
    const occupied = new Set(room.cells.map(c => cellKey(c.cx, c.cy)));
    for (let y = Math.floor(box.top / 5); y <= Math.floor((box.bottom - 1e-8) / 5); y++)
      for (let x = Math.floor(box.left / 5); x <= Math.floor((box.right - 1e-8) / 5); x++)
        if (!occupied.has(cellKey(x, y))) return false;
    return floor.furnishings.every((other, j) => {
      if (i === j) return true;
      const b = furnishingFootprint(other);
      return box.left >= b.right || box.right <= b.left || box.top >= b.bottom || box.bottom <= b.top;
    });
  });
}

/** Move saved finish targets by geometry, never by whichever array index a
 * new wall or roof solver happens to use. Unsupported targets reject a trial. */
function retainBackstory(before: BlueprintPlan, after: BlueprintPlan): boolean {
  if (!before.backstory) return true;
  const features = structuredClone(before.backstory.features);
  for (const feature of features) {
    if ('wallRunIndex' in feature) {
      const old = before.floors.find(f => f.level === feature.floorLevel)?.wallRuns[feature.wallRunIndex];
      const floor = after.floors.find(f => f.level === feature.floorLevel);
      const index = old && floor?.wallRuns.findIndex(n => ['x1', 'y1', 'x2', 'y2', 'nx', 'ny'].every(k =>
        eq(n[k as keyof typeof n] as number, old[k as keyof typeof old] as number)));
      if (index === undefined || index < 0) return false;
      feature.wallRunIndex = index;
    } else if (feature.kind === 're-roofed') {
      const old = before.roof?.planes[feature.planeIndex];
      const index = old && after.roof?.planes.findIndex(n => old.pts.every(([x, y, z]) =>
        containsXY(n, x, y) && eq(planeZAt(n, x, y), z)));
      if (index === undefined || index < 0) return false;
      feature.planeIndex = index;
    } else if (feature.kind !== 'later-phase') return false;
  }
  after.backstory = {...structuredClone(before.backstory), features};
  return true;
}

/** All original room and furnishing references remain available. A booked bed
 * never becomes another bed, and a chest never inherits another owner's stock.
 * Runtime readers validate the frozen admitted plan without regenerating it. */
export function guestCirculationReferencesAgree(before: BlueprintPlan, after: BlueprintPlan): boolean {
  if (before.buildingId !== after.buildingId || before.type !== after.type
    || before.widthFt !== after.widthFt || before.depthFt !== after.depthFt
    || !same(blueprintSiteOrigin(before), blueprintSiteOrigin(after))
    || !same(before.household, after.household) || !same(before.ensemble, after.ensemble)
    || !same(before.styleResolved, after.styleResolved) || !same(before.stairs, after.stairs)
    || !same(before.frontage, after.frontage) || before.floors.length !== after.floors.length) return false;
  return before.floors.every(f => {
    const next = after.floors.find(n => n.level === f.level);
    return next && next.furnishings.length === f.furnishings.length && next.doors.length >= f.doors.length
      && f.rooms.every(r => next.rooms.some(n => n.id === r.id && n.purpose === r.purpose && n.forSlot === r.forSlot))
      && f.furnishings.every((p, i) => {
        const n = next.furnishings[i];
        return p.kind === n.kind && p.roomId === n.roomId;
      }) && f.doors.every((d, i) => d.isEntry ? same(d, next.doors[i]) : !next.doors[i].isEntry);
  });
}

/** Only the inspected geometry families are supported. Other plans,
 * live damaged/extended foundations and unresolved histories keep their source.
 * Filling two rear cells retains the left-return and open courtyard, with no
 * change to the old envelope, site origin, entry or aligned return stair. */
export function planGuestCirculation(before: BlueprintPlan, townSeed: SeedPath, onRefusal?: (reason: string) => void): BlueprintPlan | undefined {
  if (guestCirculationRecipeFor(before) === PUBLIC_GUEST_DOORS_RECIPE) return publicGuestDoorProposal(before);
  const refuse = (reason: string) => {onRefusal?.(reason); return undefined;};
  if (before.type !== 'inn' || before.widthFt !== 30 || before.depthFt !== 25
    || before.ensemble?.lotProfile !== 'left-return' || before.liveHistory?.eventsApplied
    || before.ensemble.partyWallLeft || before.ensemble.partyWallRight
    || !before.stairs.some(s => s.fromLevel === 0) || before.floors.some(f => f.level < -1 || f.level > 1)
    || before.stairs.some(s => !s.layout || !same(s.layout.origin, {x: 20, y: 5})
      || !same(s.layout.runDir, {dx: 1, dy: 0}))) return;
  const upper = before.floors.find(f => f.level === 1);
  if (!upper || upper.rooms.length !== 5 || upper.doors.length !== 4
    || !same(upper.rooms.map(r => r.purpose), ['guest-room', 'guest-room', 'guest-room', 'guest-room', 'corridor'])
    || !same(upper.furnishings.map(p => [p.kind, p.roomId]), [['bed', 0], ['chest', 0], ['bed', 1], ['chest', 1], ['bed', 2], ['bed', 3], ['chest', 3], ['bed', 3]])) return;
  const occupied = new Set(before.footprintCells.map(c => cellKey(c.cx, c.cy)));
  if (occupied.size !== 24 || cells(0, 0, 6, 3).some(c => !occupied.has(cellKey(c.cx, c.cy)))
    || cells(0, 3, 3, 2).some(c => !occupied.has(cellKey(c.cx, c.cy)))) return;
  const after = structuredClone(before), added = [{cx: 3, cy: 3}, {cx: 3, cy: 4}];
  after.footprintCells.push(...added);
  const wing = after.masses.find(m => m.kind === 'wing' && m.x === 0 && m.y === 2 && m.w === 3 && m.h === 3);
  if (!wing) return;
  wing.w = 4;
  for (const floor of after.floors) {
    if (floor.level === 1) {
      floor.rooms = floor.rooms.map(r => roomWithCells(r, r.id === 0 ? cells(0, 0, 2, 2)
        : r.id === 1 ? cells(2, 3, 2, 2) : r.id === 2 ? cells(4, 0, 2, 1)
          : r.id === 3 ? cells(0, 3, 2, 2) : cells(4, 1, 2, 2)));
      const hall: BlueprintRoom = {id: 5, purpose: 'corridor', cells: [], area: 0, anchor: {cx: 3, cy: 2},
        bbox: {x: 0, y: 0, w: 0, d: 0}, isMain: false, isCorridor: true};
      floor.rooms.push(roomWithCells(hall, [...cells(2, 0, 2, 2), ...cells(0, 2, 4, 1)]));
      floor.doors = [doorFor(floor, 2.5, 15, 'x'), doorFor(floor, 10, 7.5, 'y'),
        doorFor(floor, 20, 2.5, 'y'), doorFor(floor, 20, 12.5, 'y'), doorFor(floor, 17.5, 15, 'x')];
      Object.assign(floor.furnishings[2], {x: 11.940419947506562, y: 21.419160104986876, rotation: 0});
      Object.assign(floor.furnishings[3], {x: 18.715748031496062, y: 23.059580052493438});
      Object.assign(floor.furnishings[5], {x: 1.9404199475065615, y: 21.419160104986876});
      Object.assign(floor.furnishings[6], {x: 5, y: 23.059580052493438});
      Object.assign(floor.furnishings[7], {x: 8.059580052493438, y: 21.419160104986876});
      if (!furnishingsFit(floor)) return refuse('furniture does not fit the proposed rooms');
      for (const room of floor.rooms.filter(r => r.id !== 4))
        if (!roomFurnishingsReachable(floor, room.id, .5)) return refuse(`room ${room.id} has no body-width furnishing route`);
    } else {
      const id = Math.max(...floor.rooms.map(r => r.id)) + 1;
      floor.rooms.push(roomWithCells({id, purpose: 'storage', cells: [], area: 0, anchor: added[0],
        bbox: {x: 0, y: 0, w: 0, d: 0}, isMain: false, isCorridor: false}, added));
      floor.doors.push(doorFor(floor, 17.5, 15, 'x'));
    }
    const grid = Array.from({length: 5}, () => Array<number>(6).fill(-1));
    for (const room of floor.rooms) for (const c of room.cells) grid[c.cy][c.cx] = room.id;
    const rebuilt = buildWalls(childSeedPath(childSeedPath(townSeed, `building:${before.buildingId}`), `floor:${floor.level}`),
      grid, floor.doors, floor.rooms, {partyWallLeft: false, partyWallRight: false});
    // The old ground/cellar wing wall is retained as an internal structural
    // wall. Its existing patch remains in exactly the same physical place.
    if (floor.level < 1) for (const edge of rebuilt.walls) {
      const old = before.floors.find(f => f.level === floor.level)!.walls.find(w => w.axis === edge.axis && eq(w.x, edge.x) && eq(w.y, edge.y));
      if (old?.kind === 'outer' && edge.kind === 'inner') edge.thicknessFt = old.thicknessFt;
    }
    floor.walls = rebuilt.walls; floor.wallRuns = mergeWallRuns(floor.walls);
    floor.windows = floor.level < 0 ? [] : [...before.floors.find(f => f.level === floor.level)!.windows,
      ...rebuilt.windows.filter(w => !before.floors.find(f => f.level === floor.level)!.windows.some(o => same(w, o)))];
  }
  if (!after.styleResolved || !before.roof) return;
  const windowless = after.floors.filter(f => f.level > 0).flatMap(f => f.rooms
    .filter(r => r.purpose === 'guest-room' && !f.windows.some(w => stairDoorCells(w)
      .some(c => r.cells.some(p => p.cx === c.cx && p.cy === c.cy)))).map(r => r.anchor));
  after.roof = solveRoof({masses: after.masses, footprintCells: after.footprintCells,
    style: after.styleResolved, hearths: after.floors.filter(f => f.level >= 0).flatMap(f => f.furnishings)
      .filter(p => p.kind === 'hearth' || p.kind === 'forge-hearth').map(p => ({x: p.x, y: p.y})),
    windowlessUpperRooms: windowless, partyWallLeft: false, partyWallRight: false,
    wallTopFt: 20});
  // Keep the original, still-valid front dormer instead of inventing a new
  // source of light or dropping the recorded windowless guest room's opening.
  after.roof.dormers = [...structuredClone(before.roof.dormers), ...after.roof.dormers.filter(d =>
    !before.roof!.dormers.some(old => same(old, d)))];
  if (!retainBackstory(before, after)) return refuse('saved history target cannot follow this proposal');
  if (!guestCirculationReferencesAgree(before, after)) return refuse('original references do not agree');
  return after;
}
