/**
 * Gives simultaneous household activities distinct places on the actual floor.
 * Rooms and furniture stay put. A shared table is an activity target, not a
 * place to stand inside. Sleeping keeps its assigned bed and future pose owner.
 * This qualifies stationary positions; walking between them is still separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 20:42:59
 * Dependents: systems/worldforge/bridge/institutionOccupancy.ts, systems/worldforge/interior/occupancy.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { cellKey, doorClearWidthFt, type BlueprintPlan, type BlueprintFloor, type BlueprintRoom, type BlueprintDoor } from './blueprintTypes';
import { furnishingFootprint } from './householdFurnish';
import type { OccupantStation } from './occupancy';

type Point = {xFt: number; yFt: number};
const RADIUS_FT = 1;
// Supper and evening gatherings need adult shoulder/idle-arm space. Using
// smaller allowances at19:00 packed the family back around one fire and into
// the player passage immediately after the supper allocation had spread out.
const SHARED_ACTIVITY_RADIUS_FT = 1.5;
export const ACTIVITY_SEPARATION_FT = 2 * RADIUS_FT;
const candidatesByPlan = new WeakMap<BlueprintPlan, Map<string, Point[]>>();


/** Keep the full entry width and inward leaf sweep available for arrival.
 * A radial gap at the hinge still allows a person to stand across the opening.
 * This is an entry-only standing rule; interior transit keeps its own policy.
 * Old tagged entries without a swing direction reserve both approach sides. */
function blocksEntryApproach(point:Point,door:BlueprintDoor,radius:number):boolean {
  if(!door.isEntry)return false;
  const dx=point.xFt-door.x,dy=point.yFt-door.y;
  // Reserve the recorded opening and leaf sweep. A wider visible door must
  // not leave residents standing in the strip the old three-foot rule missed.
  // The shared helper keeps absent-field established doors exactly three feet.
  const across=door.axis==='x'?dx:dy,clearWidth=doorClearWidthFt(door);
  if(Math.abs(across)>=clearWidth/2+radius)return false;
  const nx=door.openDir?.nx,ny=door.openDir?.ny;
  const directed=door.axis==='x'?nx===0&&Math.abs(ny??0)===1:ny===0&&Math.abs(nx??0)===1;
  const inward=directed?dx*nx!+dy*ny!:Math.abs(door.axis==='x'?dy:dx);
  return (!directed||inward>-radius)&&inward<clearWidth+radius;
}

function roomCandidates(plan: BlueprintPlan, floor: BlueprintFloor, room: BlueprintRoom, radius = RADIUS_FT): Point[] {
  let cache = candidatesByPlan.get(plan);
  if (!cache) {cache = new Map(); candidatesByPlan.set(plan, cache);}
  const key = `${floor.level}:${room.id}:${radius}`, cached = cache.get(key);
  if (cached) return cached;
  const cells = new Set(room.cells.map(c => cellKey(c.cx, c.cy)));
  const furniture = floor.furnishings.map(furnishingFootprint);
  const stairs = new Set((plan.stairs ?? []).filter(s => s.fromLevel === floor.level || s.fromLevel + 1 === floor.level)
    .flatMap(s => s.layout ? [...s.layout.shaftCells, ...s.layout.landingCells] : [{cx: Math.floor(s.x / 5), cy: Math.floor(s.y / 5)}]).map(c => cellKey(c.cx, c.cy)));
  const nodes = new Map<string, Point>();
  for (const cell of room.cells) for (let oy = .5; oy < 5; oy++) for (let ox = .5; ox < 5; ox++) {
    const x = cell.cx * 5 + ox, y = cell.cy * 5 + oy;
    let clear = true;
    for (let cy = Math.floor((y - radius + 1e-8) / 5); cy <= Math.floor((y + radius - 1e-8) / 5); cy++) {
      for (let cx = Math.floor((x - radius + 1e-8) / 5); cx <= Math.floor((x + radius - 1e-8) / 5); cx++) {
        if (!cells.has(cellKey(cx, cy)) || stairs.has(cellKey(cx, cy))) clear = false;
      }
    }
    if (!clear || furniture.some(b => x + radius > b.left && x - radius < b.right && y + radius > b.top && y - radius < b.bottom)) continue;
    nodes.set(`${x}:${y}`, {xFt: x, yFt: y});
  }
  const doors = (floor.doors ?? []).filter(d => d.a === room.id || d.b === room.id);
  const distance2 = (a: Point, x: number, y: number) => (a.xFt - x) ** 2 + (a.yFt - y) ** 2;
  // Flood from actual door approaches. A clear pocket behind a cupboard cannot
  // become a station just because its center is inside the room polygon.
  const all = [...nodes.values()].sort((a, b) => a.yFt - b.yFt || a.xFt - b.xFt);
  const seeds = doors.length ? doors.map(d => [...all].sort((a, b) => distance2(a, d.x, d.y) - distance2(b, d.x, d.y))[0])
    : [[...all].sort((a, b) => distance2(a, (room.anchor.cx + .5) * 5, (room.anchor.cy + .5) * 5) - distance2(b, (room.anchor.cx + .5) * 5, (room.anchor.cy + .5) * 5))[0]];
  const reachable = new Set<string>(), queue: Point[] = [];
  for (const seed of seeds) if (seed && !reachable.has(`${seed.xFt}:${seed.yFt}`)) {reachable.add(`${seed.xFt}:${seed.yFt}`); queue.push(seed);}
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = `${queue[i].xFt + dx}:${queue[i].yFt + dy}`, p = nodes.get(k);
    if (p && !reachable.has(k)) {reachable.add(k); queue.push(p);}
  }
  const result = all.filter(p => reachable.has(`${p.xFt}:${p.yFt}`)
    && !doors.some(d => Math.hypot(p.xFt - d.x, p.yFt - d.y) < Math.max(2, radius + 1)));
  cache.set(key, result);
  return result;
}

/** Shared household gatherings may use only actual same-floor connected
 * common rooms. Corridors carry people; private rooms are not extra capacity. */
function sharedActivityRooms(floor: BlueprintFloor, original: BlueprintRoom): BlueprintRoom[] {
  const common = new Set(['kitchen', 'hall', 'common-room', 'great-hall']);
  const rooms = [original], queue = [original], seen = new Set([original.id]);
  if (!common.has(original.purpose)) return rooms;
  for (let i = 0; i < queue.length; i++) for (const door of floor.doors ?? []) {
    const nextId = door.a === queue[i].id ? door.b : door.b === queue[i].id ? door.a : -1;
    const next = floor.rooms.find(r => r.id === nextId);
    // A real corridor can connect shared rooms, but nobody gathers in its aisle.
    if (next && (common.has(next.purpose) || next.purpose === 'corridor') && !seen.has(next.id)) {
      seen.add(next.id); queue.push(next);
      if (common.has(next.purpose)) rooms.push(next);
    }
  }
  return rooms;
}

/** Adds source-bound standing places without hiding people or moving furniture.
 * Supper uses its table room and evenings their hearth room before connected
 * common space. Existing beds, work and chores keep their owners. This is
 * stationary capacity only: walking routes and seated poses remain separate. */
function allocateActivityStations(plan: BlueprintPlan, stations: OccupantStation[], members?: readonly {ageBand?: string}[]): void {
  const used = new Map<string, Array<Point & {radius: number}>>();
  const isSharedGathering = (station: OccupantStation) => station.activity === 'meal' || station.activity === 'hearthside';
  const radiusFor = (station: OccupantStation) => isSharedGathering(station) && members?.[station.memberIndex]?.ageBand !== 'child' ? SHARED_ACTIVITY_RADIUS_FT : RADIUS_FT;
  // Reserve adult places before filling smaller gaps with children. Sorting a
  // copy preserves the source station table and every person's member index.
  const ordered = [...stations].sort((a, b) => radiusFor(b) - radiusFor(a));
  for (const station of ordered) {
    if (station.where !== 'home' || station.activity === 'sleeping') continue;
    const floor = plan.floors.find(f => f.level === station.level), original = floor?.rooms.find(r => r.id === station.roomId);
    if (!floor || !original) continue;
    // Children already have smaller generated bodies; do not spend an adult
    // gathering envelope on their source-identified child stations.
    const radius = radiusFor(station);
    // Explicit household meal assignments are source facts. If that room
    // cannot hold its people, report the shortage instead of silently moving
    // a service meal into a different family's shared table.
    const rooms = isSharedGathering(station) && !(station.activity === 'meal' && original.mealForSlot) ? sharedActivityRooms(floor, original) : [original];
    let placed = false;
    for (const room of rooms) {
      // Keep the original activity target; overflow seeks the same real
      // furnishing kind in its reached shared room, not a table at a fire gathering.
      const furnishingKind = station.activity === 'hearthside' ? 'hearth' : 'table';
      const furnishingIndex = room === original ? station.furnishingIndex : floor.furnishings.findIndex(f => f.roomId === room.id && f.kind === furnishingKind);
      const furnishing = furnishingIndex === undefined || furnishingIndex < 0 ? undefined : floor.furnishings[furnishingIndex];
      const target = furnishing ? {xFt: furnishing.x, yFt: furnishing.y} : {xFt: (room.anchor.cx + .5) * 5, yFt: (room.anchor.cy + .5) * 5};
      const key = floor.level + ':' + room.id, occupied = used.get(key) ?? [];
      const point = [...roomCandidates(plan, floor, room, radius)].sort((a, b) =>
        Math.hypot(a.xFt - target.xFt, a.yFt - target.yFt) - Math.hypot(b.xFt - target.xFt, b.yFt - target.yFt) || a.yFt - b.yFt || a.xFt - b.xFt)
        .find(p => occupied.every(other => Math.hypot(p.xFt - other.xFt, p.yFt - other.yFt) >= radius + other.radius));
      if (!point) continue;
      station.roomId = room.id;
      if (furnishing) station.furnishingIndex = furnishingIndex;
      else delete station.furnishingIndex;
      station.standingPosition = {...point};
      delete station.standingIssue;
      occupied.push({...point, radius}); used.set(key, occupied);
      placed = true;
      break;
    }
    if (!placed) {delete station.standingPosition; station.standingIssue = 'no-clear-space';}
  }
}

/** Keep a valid household allocation while improving the entry approach.
 * A cramped room must keep its people visible until its layout is repaired.
 * Only a replacement that clears the entry and every retained resident is used. */
export function placeActivityStations(plan:BlueprintPlan,stations:OccupantStation[],members?:readonly {ageBand?:string}[]):void {
 allocateActivityStations(plan,stations,members);
 const radiusFor=(s:OccupantStation)=>(s.activity==='meal'||s.activity==='hearthside')&&members?.[s.memberIndex]?.ageBand!=='child'?SHARED_ACTIVITY_RADIUS_FT:RADIUS_FT;
 for(const station of stations){
  if(station.where!=='home'||station.activity==='sleeping'||!station.standingPosition)continue;
  const floor=plan.floors.find(f=>f.level===station.level),room=floor?.rooms.find(r=>r.id===station.roomId);
  if(!floor||!room)continue;
  const radius=radiusFor(station),entries=floor.doors.filter(d=>d.isEntry);
  if(!entries.some(d=>blocksEntryApproach(station.standingPosition!,d,radius)))continue;
  const origin=station.standingPosition;
  const rooms=(station.activity==='meal'||station.activity==='hearthside')&&!(station.activity==='meal'&&room.mealForSlot)?sharedActivityRooms(floor,room):[room];
  for(const destination of rooms){
   const point=[...roomCandidates(plan,floor,destination,radius)]
    .filter(p=>!entries.some(d=>blocksEntryApproach(p,d,radius)))
    .sort((a,b)=>Math.hypot(a.xFt-origin.xFt,a.yFt-origin.yFt)-Math.hypot(b.xFt-origin.xFt,b.yFt-origin.yFt)||a.yFt-b.yFt||a.xFt-b.xFt)
    .find(p=>stations.every(other=>other===station||other.where!=='home'||other.activity==='sleeping'||!other.standingPosition||other.level!==station.level||other.roomId!==destination.id||Math.hypot(p.xFt-other.standingPosition.xFt,p.yFt-other.standingPosition.yFt)>=radius+radiusFor(other)));
   if(!point)continue;
   if(destination.id!==station.roomId){
    const kind=station.activity==='hearthside'?'hearth':'table';
    const furnishing=floor.furnishings.findIndex(f=>f.roomId===destination.id&&f.kind===kind);
    if(furnishing>=0)station.furnishingIndex=furnishing;else delete station.furnishingIndex;
    station.roomId=destination.id;
   }
   station.standingPosition={...point};break;
  }
 }
}
