/** Real stairs reserve floor area before furniture is placed. This planner
 * keeps the lot, room identities and existing entry; it refuses a shaft when
 * cutting it would strand a room or leave an adult bedroom too small.
 * Admission is geometry only. Bed fitting and actual climbing remain separate
 * gates, so a candidate cannot silently become a playable-stair claim. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 12:08:24
 * Dependents: systems/world3d/buildingModels.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/interior/guestCirculation.ts, systems/worldforge/interior/householdLivingPlan.ts, systems/worldforge/interior/ruralFamilyLayout.ts, systems/worldforge/interior/stairHousehold.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BlueprintDoor, BlueprintFloor, BlueprintRoom, Cell, ReturnStairLayout } from './blueprintTypes';
import { cellKey } from './blueprintTypes';

const CELL = 5;
const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const key = (c: Cell): string => cellKey(c.cx, c.cy);

function connected(cells: Cell[]): boolean {
  if (!cells.length) return false;
  const remaining = new Set(cells.map(key));
  const queue = [cells[0]];
  remaining.delete(key(cells[0]));
  for (let i = 0; i < queue.length; i++) {
    for (const [dx, dy] of directions) {
      const next = { cx: queue[i].cx + dx, cy: queue[i].cy + dy };
      if (remaining.delete(key(next))) queue.push(next);
    }
  }
  return remaining.size === 0;
}

/** The two cells directly beside a door; the first is on the negative side. */
export function stairDoorCells(door: Pick<BlueprintDoor, 'x' | 'y' | 'axis'>): [Cell, Cell] {
  const cx = Math.floor(door.x / CELL), cy = Math.floor(door.y / CELL);
  return door.axis === 'x'
    ? [{ cx, cy: cy - 1 }, { cx, cy }]
    : [{ cx: cx - 1, cy }, { cx, cy }];
}

/** Shared-edge alternatives retain each existing room pair. Callers preserve
 * array positions when moving a door, because saved front-door IDs include its
 * index. An entry never moves as a side effect of reserving stair space. */
export function stairDoorAlternatives(
  floor: BlueprintFloor, door: BlueprintDoor, blocked: ReadonlySet<string>,
): Array<Pick<BlueprintDoor, 'x' | 'y' | 'axis'>> {
  if (door.isEntry) return stairDoorCells(door).some(c => blocked.has(key(c))) ? [] : [door];
  const a = floor.rooms.find(r => r.id === door.a);
  const b = new Set(floor.rooms.find(r => r.id === door.b)?.cells.map(key));
  const result: Array<Pick<BlueprintDoor, 'x' | 'y' | 'axis'>> = [];
  for (const c of a?.cells ?? []) {
    if (blocked.has(key(c))) continue;
    for (const [dx, dy] of directions) {
      const neighbor = { cx: c.cx + dx, cy: c.cy + dy };
      if (!b.has(key(neighbor)) || blocked.has(key(neighbor))) continue;
      result.push({
        x: (c.cx + 0.5 + dx * 0.5) * CELL,
        y: (c.cy + 0.5 + dy * 0.5) * CELL,
        axis: dx === 0 ? 'x' : 'y',
      });
    }
  }
  return result.sort((a, b) =>
    Math.hypot(a.x - door.x, a.y - door.y) - Math.hypot(b.x - door.x, b.y - door.y)
    || a.y - b.y || a.x - b.x);
}

/** Map a measured point on a flight/landing into the canonical plan. */
export function returnStairPoint(layout: ReturnStairLayout, run: number, across: number): { x: number; y: number } {
  return {
    x: layout.origin.x + layout.runDir.dx * run + layout.acrossDir.dx * across,
    y: layout.origin.y + layout.runDir.dy * run + layout.acrossDir.dy * across,
  };
}

export function roomWithCells(room: BlueprintRoom, cells: Cell[]): BlueprintRoom {
  const x = Math.min(...cells.map(c => c.cx)) * CELL;
  const y = Math.min(...cells.map(c => c.cy)) * CELL;
  const meanX = cells.reduce((sum, c) => sum + c.cx, 0) / cells.length;
  const meanY = cells.reduce((sum, c) => sum + c.cy, 0) / cells.length;
  const anchor = [...cells].sort((a, b) =>
    Math.hypot(a.cx - meanX, a.cy - meanY) - Math.hypot(b.cx - meanX, b.cy - meanY)
    || a.cy - b.cy || a.cx - b.cx)[0];
  return { ...room, cells, area: cells.length, anchor,
    bbox: { x, y, w: (Math.max(...cells.map(c => c.cx)) + 1) * CELL - x,
      d: (Math.max(...cells.map(c => c.cy)) + 1) * CELL - y } };
}

/** Reserve a qualified shaft in cloned rooms and doors. Geometry rebuild and
 * furniture admission happen in the generator; this function never mutates a
 * saved/cached plan. The new room is ordinary unfurnished circulation, keeping
 * household slots on their original rooms until a proven bed relocation. */
export function reserveReturnStair(floors: BlueprintFloor[], layout: ReturnStairLayout): BlueprintFloor[] {
  const blocked = new Set(layout.shaftCells.map(key));
  const bottom = Math.min(...floors.map(f => f.level));
  const top = Math.max(...floors.map(f => f.level));
  return floors.map(floor => {
    const shaftId = Math.max(...floor.rooms.map(r => r.id)) + 1;
    const rooms = floor.rooms.map(room => roomWithCells(room, room.cells.filter(c => !blocked.has(key(c)))));
    rooms.push(roomWithCells({ id: shaftId, purpose: 'corridor', cells: [], area: 0,
      anchor: layout.shaftCells[0], bbox: { x: 0, y: 0, w: 0, d: 0 },
      isMain: false, isCorridor: true }, layout.shaftCells));
    const at = (c: Cell) => rooms.find(room => room.cells.some(rc => key(rc) === key(c)))!.id;
    const doorAt = (site: Pick<BlueprintDoor, 'x' | 'y' | 'axis'>, isEntry: boolean): BlueprintDoor => {
      const sides = stairDoorCells(site);
      const ids = sides.map(c => rooms.find(room => room.cells.some(rc => key(rc) === key(c)))?.id ?? -1);
      const size = (id: number) => rooms.find(r => r.id === id)?.area ?? 0;
      const into = isEntry ? ids.find(id => id !== -1)! :
        size(ids[1]) > size(ids[0]) || (size(ids[1]) === size(ids[0]) && ids[1] < ids[0]) ? ids[1] : ids[0];
      const other = ids.find(id => id !== into)!;
      const sign = ids[1] === into ? 1 : -1;
      return { a: other, b: into, x: site.x, y: site.y, axis: site.axis, isEntry, swingInto: into,
        openDir: { nx: site.axis === 'y' ? sign : 0, ny: site.axis === 'x' ? sign : 0 } };
    };
    const doors = floor.doors.map(door => {
      const site = stairDoorAlternatives(floor, door, blocked)[0];
      if (!site) throw new Error('Cannot reserve an unqualified stair shaft');
      return door.isEntry ? { ...door, openDir: { ...door.openDir } } : doorAt(site, false);
    });
    for (const [i, across] of [2.5, 7.5].entries()) {
      if ((i === 0 && floor.level === top) || (i === 1 && floor.level === bottom)) continue;
      // Both floor portals open onto the outside landing strip; neither opens
      // through the side of a flight or through its half-height landing.
      const point = returnStairPoint(layout, 0, across);
      const site = { ...point, axis: layout.runDir.dx === 0 ? 'x' as const : 'y' as const };
      if (at(layout.landingCells[i]) === shaftId) throw new Error('Stair landing must be outside its shaft');
      doors.push(doorAt(site, false));
    }
    return { ...floor, rooms, doors, furnishings: [], windows: [], walls: [], wallRuns: [] };
  });
}

/** A small home can share a children's sleeping room rather than lose beds to
 * the stair. Only adjacent child-only bedrooms may merge; an adult's privacy,
 * a trade room and the street entry are never sacrificed by this repair. */
export function* stairChildRoomMerges(floors: BlueprintFloor[]): Generator<BlueprintFloor[]> {
  for (const floor of floors.filter(f => f.level > 0)) {
    const eligible = floor.rooms.filter(room => room.purpose === 'bedroom' && room.forSlot
      && room.forSlot.split(',').every(tag => tag.startsWith('child:')));
    for (let i = 0; i < eligible.length; i++) for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i], b = eligible[j];
      if (!floor.doors.some(d => [d.a, d.b].includes(a.id) && [d.a, d.b].includes(b.id))) continue;
      const merged = roomWithCells({ ...a, forSlot: `${a.forSlot},${b.forSlot}` }, [...a.cells, ...b.cells]);
      const rooms = floor.rooms.filter(r => r.id !== b.id).map(r => r.id === a.id ? merged : { ...r });
      const remap = (id: number) => id === b.id ? a.id : id;
      const doors = floor.doors.filter(d => remap(d.a) !== remap(d.b)).map(d => {
        const [negative, positive] = stairDoorCells(d);
        const at = (c: Cell) => rooms.find(r => r.cells.some(rc => key(rc) === key(c)))?.id ?? -1;
        const neg = at(negative), pos = at(positive);
        const size = (id: number) => rooms.find(r => r.id === id)?.area ?? 0;
        const into = size(pos) > size(neg) || size(pos) === size(neg) && pos < neg ? pos : neg;
        const sign = into === pos ? 1 : -1;
        return { ...d, a: into === pos ? neg : pos, b: into, swingInto: into,
          openDir: { nx: d.axis === 'y' ? sign : 0, ny: d.axis === 'x' ? sign : 0 } };
      });
      yield floors.map(f => f === floor ? { ...floor, rooms, doors, furnishings: [] } : {
        ...f, rooms: f.rooms.map(r => ({ ...r })), doors: f.doors.map(d => ({ ...d })), furnishings: [],
      });
    }
  }
}

/** Find one aligned shaft across all connected floors, without consuming the
 * seeded layout stream. Four legacy or six wide-profile cells form the shaft; two more supply
 * its floor landings. A failure leaves the original plan untouched. */
export function* returnStairCandidates(footprint: Cell[], floors: BlueprintFloor[], minimumBodyWidthM?:number): Generator<ReturnStairLayout> {
  if(minimumBodyWidthM!==undefined&&(!Number.isFinite(minimumBodyWidthM)||minimumBodyWidthM<=0))throw new RangeError('Stair body width must be positive and finite');
  // The legacy 10 by 10 ft shaft remains exact. Wider visitors require a real
  // 15 by 10 ft reservation, not wider meshes through the old floor opening.
  // Ten rises per half-storey give 152.4 mm rises and 338.7 mm goings.
  const wide=minimumBodyWidthM!==undefined&&minimumBodyWidthM>3*.3048;
  const flightWidthFt=wide?4.5:3.5,flightRunFt=wide?10:7,landingDepthFt=wide?5:3,risesPerFlight=wide?10:9;
  if(minimumBodyWidthM!==undefined&&(flightWidthFt*.3048<minimumBodyWidthM||landingDepthFt*.3048<minimumBodyWidthM))return;
  if (floors.length < 2 || footprint.length < 10) return;
  const occupied = new Set(footprint.map(key));
  // Row-major and fixed direction order make ties stable across callers.
  const origins = [...footprint].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  for (const corner of origins) for (const [dx, dy] of directions) {
    const tx = -dy, ty = dx;
    const origin = {
      x: (corner.cx + (dx < 0 || tx < 0 ? 1 : 0)) * CELL,
      y: (corner.cy + (dy < 0 || ty < 0 ? 1 : 0)) * CELL,
    };
    const cellAt = (u: number, v: number): Cell => ({
      cx: Math.floor((origin.x + dx * u + tx * v) / CELL),
      cy: Math.floor((origin.y + dy * u + ty * v) / CELL),
    });
    const shaftCells=wide
      ?[cellAt(2.5,2.5),cellAt(7.5,2.5),cellAt(12.5,2.5),cellAt(2.5,7.5),cellAt(7.5,7.5),cellAt(12.5,7.5)]
      :[cellAt(2.5,2.5),cellAt(7.5,2.5),cellAt(2.5,7.5),cellAt(7.5,7.5)];
    const landingCells = [cellAt(-2.5, 2.5), cellAt(-2.5, 7.5)];
    if (![...shaftCells, ...landingCells].every(c => occupied.has(key(c)))) continue;
    const blocked = new Set(shaftCells.map(key));
    if (!connected(footprint.filter(c => !blocked.has(key(c))))) continue;
    const admits = floors.every(floor => {
      const owner = floor.rooms.find(r => r.cells.some(c => key(c) === key(shaftCells[0])));
      if (!owner || shaftCells.some(c => !owner.cells.some(rc => key(rc) === key(c)))) return false;
      const remaining = owner.cells.filter(c => !blocked.has(key(c)));
      const adultCount = owner.forSlot?.split(',').filter(tag => /^(head|spouse|elder:|kin:|lodger:|servant:)/.test(tag)).length ?? 0;
      if (remaining.length < Math.max(2, adultCount * 2) || !connected(remaining)) return false;
      return floor.doors.every(door => stairDoorAlternatives(floor, door, blocked).length > 0);
    });
    if (!admits) continue;
    yield {
      kind: 'return', origin, runDir: { dx, dy }, acrossDir: { dx: tx, dy: ty },
      shaftCells, landingCells, flightWidthFt, flightRunFt, landingDepthFt, risesPerFlight,
    };
  }
}

/** Historical first-fit helper for geometry previews. Gameplay must trial-fit
 * the household across candidates rather than equating this with admission. */
export function planReturnStair(footprint: Cell[], floors: BlueprintFloor[]): ReturnStairLayout | undefined {
  return returnStairCandidates(footprint, floors).next().value;
}
