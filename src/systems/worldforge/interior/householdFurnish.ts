/** Household furniture uses the rendered footprint, after every sleeper is assigned.
 * Rooms and lots remain canonical. A piece that cannot fit is omitted rather than
 * pushed through a wall; door-to-door and stair approaches stay connected. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 07:11:30
 * Dependents: systems/worldforge/interior/activityPositions.ts, systems/worldforge/interior/buildingLayoutRepair.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/interior/guestCirculation.ts, systems/worldforge/interior/householdLivingPlan.ts, systems/worldforge/interior/ruralFamilyLayout.ts, systems/worldforge/interior/stairHousehold.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BlueprintFloor, BlueprintFurnishing, BlueprintRoom } from './blueprintTypes';
import { cellKey } from './blueprintTypes';
import { furnishingSpec } from './furnitureCatalog';
import { furnishingRecipeKinds } from './furnish';
import { stairAscentDir } from '../../world3d/buildingModels';

type Rect = { left: number; top: number; right: number; bottom: number };
type WalkGraph = { nodes: { box: Rect; x: number; y: number; gridIndex: number }[]; neighbors: number[][]; targetIndices: (number | undefined)[] };
const FT_PER_M = 1 / 0.3048;
const AISLE_HALF = 0.4 * FT_PER_M;
const MARGIN = 0.3;

/** Explicit source trials can use the measured visitor width and complete
 * opening reservation. Defaults preserve established household generation;
 * this profile neither adopts a saved layout nor grants access to its goods. */
export interface HouseholdFurnishingOptions {
  compactBeds?: boolean;
  walkingWidthM?: number;
  walkingGridStepFt?: 1 | .5 | .25;
  /** Bounded alternatives for newly appended seats only; default 1, maximum 16. */
  seatingTrials?: number;
  /** Optional shared meal/work table location; provision storage can use either room. */
  sharedTableRoom?: 'hall' | 'kitchen';
  reserveDoorSweeps?: boolean;
  reachAllFurniture?: boolean;
}
type FurnishingPreference = HouseholdFurnishingOptions & { x: number; y: number; seatKind?: 'bench'|'chair' };
const aisleHalfFor = (options: HouseholdFurnishingOptions) => {
  const width=options.walkingWidthM;
  if(width!==undefined&&(!Number.isFinite(width)||width<=0))throw new RangeError('Household walking width must be positive and finite');
  return width===undefined?AISLE_HALF:width/2*FT_PER_M;
};
const intersects = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left
  && a.top < b.bottom && a.bottom > b.top;
const cellRect = (cx: number, cy: number): Rect => ({ left: cx * 5, top: cy * 5, right: cx * 5 + 5, bottom: cy * 5 + 5 });

/** Public for geometric checks and any inspector that needs the actual footprint. */
export function furnishingFootprint(item: BlueprintFurnishing): Rect {
  const spec = furnishingSpec(item.kind);
  const sideways = item.rotation === 90 || item.rotation === 270;
  const w = (sideways ? spec.d : spec.w) * FT_PER_M;
  const d = (sideways ? spec.w : spec.d) * FT_PER_M;
  return { left: item.x - w / 2, right: item.x + w / 2, top: item.y - d / 2, bottom: item.y + d / 2 };
}

function approaches(floor: BlueprintFloor, room: BlueprintRoom, blocked: Set<string>, options: HouseholdFurnishingOptions) {
  const aisleHalf=aisleHalfFor(options);
  const cells = new Map(room.cells.map(c => [cellKey(c.cx, c.cy), c]));
  const targets: { x: number; y: number }[] = [];
  const routes: Rect[] = [];
  for (const door of floor.doors.filter(d => d.a === room.id || d.b === room.id)) {
    const cx = Math.floor(door.x / 5), cy = Math.floor(door.y / 5);
    const flanks = door.axis === 'x'
      ? [{ cx, cy: Math.round(door.y / 5) - 1 }, { cx, cy: Math.round(door.y / 5) }]
      : [{ cx: Math.round(door.x / 5) - 1, cy }, { cx: Math.round(door.x / 5), cy }];
    for (const c of flanks.filter(c => cells.has(cellKey(c.cx, c.cy)))) {
      const centerX = c.cx * 5 + 2.5, centerY = c.cy * 5 + 2.5;
      // Walk nodes start at .5 ft. Integer leaf widths need the next .5 ft
      // approach, otherwise a valid room is rejected by an absent grid node.
      const depth=options.reserveDoorSweeps?Math.ceil((door.clearWidthFt??3)-.5)+.5
        :options.walkingWidthM!==undefined?Math.max(1.5,Math.ceil(aisleHalf-.5)+.5):1.5;
      const half=options.reserveDoorSweeps?Math.max(aisleHalf,(door.clearWidthFt??3)/2):aisleHalf;
      const x = door.x + Math.sign(centerX - door.x) * depth;
      const y = door.y + Math.sign(centerY - door.y) * depth;
      targets.push({ x, y });
      // The walking width extends across the doorway; only its depth reaches
      // into the room. Cell-center end caps wasted space beside small rooms.
      routes.push(door.axis === 'x'
        ? { left: x - half, right: x + half, top: Math.min(y, door.y), bottom: Math.max(y, door.y) }
        : { left: Math.min(x, door.x), right: Math.max(x, door.x), top: y - half, bottom: y + half });
    }
  }
  for (const key of blocked) if (cells.has(key)) {
    const c = cells.get(key)!;
    // A solid ground-floor flight is approached at its low end, never walked
    // through as a flat shortcut. Upper landing traversal remains separate.
    const dir = floor.level === 0 ? stairAscentDir(floor, c.cx, c.cy) : { dx: 0, dy: 0 };
    targets.push({ x: c.cx * 5 + 2.5 - dir.dx * 4, y: c.cy * 5 + 2.5 - dir.dy * 4 });
    routes.push(cellRect(c.cx, c.cy));
  }
  return { routes, targets };
}

function roomContains(box: Rect, cells: Set<string>) {
  for (let cy = Math.floor((box.top + 1e-8) / 5); cy <= Math.floor((box.bottom - 1e-8) / 5); cy++) {
    for (let cx = Math.floor((box.left + 1e-8) / 5); cx <= Math.floor((box.right - 1e-8) / 5); cx++) {
      if (!cells.has(cellKey(cx, cy))) return false;
    }
  }
  return true;
}

/** Check real walking width on the default one-foot or explicit finer grid.
 * A coarse lattice can miss an actual bedside aisle; finer samples retain the
 * entire collision box and the same interaction reach. Paths can bend around beds
 * rather than forcing every room to surrender an arbitrary cell-center tree. */
function furnishWithPreference(floor: BlueprintFloor, blocked: Set<string>, servantCount: number,
  preference: FurnishingPreference, onlyRoom: number | undefined, walks: Map<BlueprintRoom, WalkGraph>,
  existing?: readonly BlueprintFurnishing[]): BlueprintFurnishing[] {
  // An optional second pass fits one seat around the already accepted pieces.
  // Keeping those pieces in order preserves saved container/manifest indices.
  const aisleHalf=aisleHalfFor(preference),step=preference.walkingGridStepFt??1;
  if(step!==1&&step!==.5&&step!==.25)throw new RangeError('Household walking grid must use 1, .5 or .25 feet');
  const out: BlueprintFurnishing[] = [...existing ?? []];
  const footprint = new Set(floor.rooms.flatMap(r => r.cells.map(c => cellKey(c.cx, c.cy))));
  for (const room of floor.rooms) {
    if (onlyRoom !== undefined && room.id !== onlyRoom) continue;
    if (room.purpose === 'corridor') continue;
    const cells = new Set(room.cells.map(c => cellKey(c.cx, c.cy)));
    const { routes: reserved, targets } = approaches(floor, room, blocked, preference);
    const xs = room.cells.map(c => c.cx * 5), ys = room.cells.map(c => c.cy * 5);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 5;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 5;
    let graph = walks.get(room);
    if (!graph) {
    const width = Math.round((maxX - minX)/step), height = Math.round((maxY - minY)/step);
    const indexAt = new Int32Array(width * height).fill(-1);
    const nodes: WalkGraph['nodes'] = [];
    for (let x = minX + 0.5; x < maxX; x+=step) for (let y = minY + 0.5; y < maxY; y+=step) {
      const box = { left: x - aisleHalf, right: x + aisleHalf, top: y - aisleHalf, bottom: y + aisleHalf };
      if (roomContains(box, cells)) {
        const gridIndex = Math.round((x - minX - 0.5)/step) + Math.round((y - minY - 0.5)/step) * width;
        indexAt[gridIndex] = nodes.length;
        nodes.push({ box, x, y, gridIndex });
      }
    }
    const neighbors = nodes.map(node => {
      const column = node.gridIndex % width;
      return [column + 1 < width ? node.gridIndex + 1 : -1, node.gridIndex + width,
        column > 0 ? node.gridIndex - 1 : -1, node.gridIndex - width]
        .filter(index => index >= 0 && index < indexAt.length && indexAt[index] >= 0)
        .map(index => indexAt[index]);
    });
    const targetIndices = targets.map(t => {
      const index = indexAt[(t.x - minX - 0.5)/step + (t.y - minY - 0.5)/step * width];
      return index >= 0 ? index : undefined;
    });
    graph = { nodes, neighbors, targetIndices };
    walks.set(room, graph);
    }
    const { nodes, neighbors, targetIndices } = graph;
    const stairSolids = floor.level === 0 ? room.cells.filter(c => blocked.has(cellKey(c.cx, c.cy))).map(c => cellRect(c.cx, c.cy)) : [];
    const remainsConnected = (pieces: Rect[], beds: Rect[]) => {
      if (!targetIndices.length) return true;
      const free = nodes.map(node => !pieces.some(piece => intersects(piece, node.box)) && !stairSolids.some(stair => intersects(stair, node.box)));
      if (!targetIndices.every(index => index !== undefined && free[index])) return false;
      const queue = [targetIndices[0]!], visited = new Uint8Array(nodes.length);
      visited[queue[0]] = 1;
      for (let i = 0; i < queue.length; i++) {
        for (const next of neighbors[queue[i]]) {
          if (free[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
        }
      }
      return targetIndices.every(index => visited[index!]) && (preference.reachAllFurniture?pieces:beds).every(bed => queue.some(index => {
        const { x, y } = nodes[index];
        return Math.hypot(Math.max(bed.left - x, 0, x - bed.right), Math.max(bed.top - y, 0, y - bed.bottom)) <= (preference.walkingWidthM!==undefined||preference.reachAllFurniture
          ?aisleHalf+0.2*FT_PER_M:0.6*FT_PER_M);
      }));
    };
    const recipe = furnishingRecipeKinds(room.purpose);
    const sleepers = room.forSlot?.split(',').filter(Boolean).length
      ?? (room.purpose === 'servant-room' ? servantCount : 0);
    const kinds = existing ? [preference.seatKind??'bench'] : [...Array<string>(sleepers).fill('bed'),
      ...recipe.core.filter(kind => kind !== 'bed' || sleepers === 0), ...recipe.filler.slice(0, 1)];
    for (const kind of kinds) {
      if(kind==='table'&&preference.sharedTableRoom&&(room.purpose==='hall'||room.purpose==='kitchen')&&room.purpose!==preference.sharedTableRoom)continue;
      const spec = furnishingSpec(kind);
      let best: BlueprintFurnishing | undefined;
      let bestScore = Infinity;
      for (const rotation of [0, 90] as const) {
        const w = (rotation === 0 ? spec.w : spec.d) * FT_PER_M;
        const d = (rotation === 0 ? spec.d : spec.w) * FT_PER_M;
        // Cell-edge offsets allow two real single beds in a shared 10 ft room.
        const xPositions = new Set<number>(); const yPositions = new Set<number>();
        for (const c of room.cells) {
          xPositions.add(c.cx * 5 + MARGIN + w / 2); xPositions.add((c.cx + 1) * 5 - MARGIN - w / 2);
          yPositions.add(c.cy * 5 + MARGIN + d / 2); yPositions.add((c.cy + 1) * 5 - MARGIN - d / 2);
        }
        if (kind === 'bed' && preference.compactBeds) {
          // Five-foot cell edges are not furniture bays. A row of full-size
          // beds can fit between real walls even when cell-snapped choices
          // miss it. Keep the same margin, furniture and walking checks.
          for (let x = minX + MARGIN + w / 2; x + w / 2 + MARGIN <= maxX; x += w + MARGIN) xPositions.add(x);
          for (let x = maxX - MARGIN - w / 2; x - w / 2 - MARGIN >= minX; x -= w + MARGIN) xPositions.add(x);
          for (let y = minY + MARGIN + d / 2; y + d / 2 + MARGIN <= maxY; y += d + MARGIN) yPositions.add(y);
          for (let y = maxY - MARGIN - d / 2; y - d / 2 - MARGIN >= minY; y -= d + MARGIN) yPositions.add(y);
        }
        for (const x of [...xPositions].sort((a, b) => preference.x * (a - b))) for (const y of [...yPositions].sort((a, b) => preference.y * (a - b))) {
          const candidate = { kind, roomId: room.id, x, y, rotation };
          const box = furnishingFootprint(candidate);
          const padded = { left: box.left - MARGIN, right: box.right + MARGIN, top: box.top - MARGIN, bottom: box.bottom + MARGIN };
          if (!roomContains(padded, cells) || reserved.some(r => intersects(box, r))
            || out.some(f => f.roomId === room.id && intersects(padded, furnishingFootprint(f)))) continue;
          const wallDistance = Math.min(box.left - minX, maxX - box.right, box.top - minY, maxY - box.bottom);
          const score = wallDistance + preference.x * x * 0.0001 + preference.y * y * 0.00001;
          if (score >= bestScore) continue;
          if (kind === 'hearth' || kind === 'forge-hearth') {
            const exterior = room.cells.some(c => {
              const edge = cellRect(c.cx, c.cy);
              return (!footprint.has(cellKey(c.cx - 1, c.cy)) && Math.abs(box.left - edge.left) < 0.31
                || !footprint.has(cellKey(c.cx + 1, c.cy)) && Math.abs(box.right - edge.right) < 0.31
                || !footprint.has(cellKey(c.cx, c.cy - 1)) && Math.abs(box.top - edge.top) < 0.31
                || !footprint.has(cellKey(c.cx, c.cy + 1)) && Math.abs(box.bottom - edge.bottom) < 0.31)
                && intersects(box, edge);
            });
            if (!exterior) continue;
          }
          const placed = out.filter(f => f.roomId === room.id);
          if (score < bestScore && remainsConnected([box, ...placed.map(furnishingFootprint)],
            [...(kind === 'bed' ? [box] : []), ...placed.filter(f => f.kind === 'bed').map(furnishingFootprint)])) {
            best = candidate; bestScore = score;
          }
        }
      }
      if (best) out.push(best);
    }
  }
  return out;
}

/** Small rooms get bounded alternative packing attempts before a sleeper is
 * left without a bed. The first successful orientation can otherwise consume
 * the only corner where a second full-size bed fits. */
export function furnishHouseholdFloor(floor: BlueprintFloor, blocked: Set<string>, servantCount: number): BlueprintFurnishing[] {
  const cache: LayoutCache = { layouts: new Map(), walks: new Map() };
  return withCommonRoomSeating(floor, blocked, servantCount, cache.walks,
    furnishFloor(floor, blocked, servantCount, cache));
}

/** A public house needs somewhere to sit even when a second table will not
 * fit. Reuse the real-size, door/stair and walking-clearance checks; omission
 * remains honest when no bench fits. Append only, preserving earlier indices. */
function withCommonRoomSeating(floor: BlueprintFloor, blocked: Set<string>, servantCount: number,
  walks: Map<BlueprintRoom, WalkGraph>, existing: BlueprintFurnishing[], options: HouseholdFurnishingOptions = {}) {
  let out = existing;
  for (const room of floor.rooms) {
    if (room.purpose !== 'common-room' || !room.isMain
      || out.some(piece => piece.roomId === room.id && piece.kind === 'bench')) continue;
    out = furnishWithPreference(floor, blocked, servantCount, { ...options, x: 1, y: 1 }, room.id, walks, out);
  }
  return out;
}

type LayoutCache = { layouts: Map<BlueprintRoom, Map<number, BlueprintFurnishing[]>>; walks: Map<BlueprintRoom, WalkGraph>; options?: HouseholdFurnishingOptions };
function furnishFloor(floor: BlueprintFloor, blocked: Set<string>, servantCount: number, cache: LayoutCache) {
  const initial = furnishWithPreference(floor, blocked, servantCount, { ...cache.options, compactBeds: false, x: 1, y: 1 }, undefined, cache.walks);
  return floor.rooms.flatMap(room => bestRoomLayout(floor, room, blocked, servantCount,
    cache, initial.filter(item => item.roomId === room.id)));
}

function bestRoomLayout(floor: BlueprintFloor, room: BlueprintRoom, blocked: Set<string>, servantCount: number,
  cache: LayoutCache, initial?: BlueprintFurnishing[]) {
    const demand = room.forSlot?.split(',').filter(Boolean).length ?? (room.purpose === 'servant-room' ? servantCount : 0);
    const cached = cache.layouts.get(room)?.get(demand);
    if (cached) return cached;
    let best = initial ?? furnishWithPreference(floor, blocked, servantCount, { ...cache.options, compactBeds: false, x: 1, y: 1 }, room.id, cache.walks);
    const beds = (items: BlueprintFurnishing[]) => items.filter(item => item.kind === 'bed').length;
    for (const preference of [{ x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }]) {
      if (beds(best) >= demand) break;
      const candidate = furnishWithPreference(floor, blocked, servantCount, { ...cache.options, ...preference, compactBeds: false }, room.id, cache.walks);
      if (beds(candidate) > beds(best) || beds(candidate) === beds(best) && candidate.length > best.length) best = candidate;
    }
    // Only an opted-in stair/room planning trial explores denser bed rows.
    // Existing fitted homes keep their positions and generation cost.
    if (beds(best) < demand && cache.options?.compactBeds) {
      for (const corner of [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }]) {
        const candidate = furnishWithPreference(floor, blocked, servantCount,
          { ...cache.options, ...corner, compactBeds: true }, room.id, cache.walks);
        if (beds(candidate) > beds(best) || beds(candidate) === beds(best) && candidate.length > best.length) best = candidate;
        if (beds(best) >= demand) break;
      }
    }
    // Tags name people, but only their count affects this physical layout.
    // Keep this cache local to one building pass so later geometry cannot drift.
    if (!cache.layouts.has(room)) cache.layouts.set(room, new Map());
    cache.layouts.get(room)!.set(demand, best);
    return best;
}

/** Crowded homes may put children in a parent's or sibling's room. Reassign
 * only when a trial layout proves an additional bed fits there; spare beds in
 * unrelated rooms must never masquerade as beds for the assigned sleepers.
 * Rooms, doors, lots and family identities are unchanged. */
export function furnishHouseholdBuilding(floors: BlueprintFloor[], blocked: Set<string>, servantCount: number,
  options?: HouseholdFurnishingOptions): void {
  const cache: LayoutCache = { layouts: new Map(), walks: new Map(),
    options };
  for (const floor of floors) floor.furnishings = furnishFloor(floor, blocked, servantCount, cache);
  const bedrooms = floors.filter(f => f.level >= 0).flatMap(floor => floor.rooms
    // Overflow sleepers can already be assigned to a multipurpose hall. They
    // need the same proven reassignment opportunity when access limits its beds.
    .filter(room => room.forSlot || ['bedroom', 'guest-room', 'private-room', 'solar'].includes(room.purpose))
    .map(room => ({ floor, room })));
  const changedSources = new Set<typeof bedrooms[number]>();
  for (const source of bedrooms) {
    const tags = source.room.forSlot?.split(',').filter(Boolean) ?? [];
    const beds = source.floor.furnishings.filter(f => f.roomId === source.room.id && f.kind === 'bed').length;
    const missing = Math.max(0, tags.length - beds);
    const children = tags.filter(tag => tag.startsWith('child:')).slice(-missing);
    if (!missing) continue;
    for (const child of children) {
      for (const target of bedrooms) {
        if (target.room === source.room) continue;
        const targetTags = target.room.forSlot?.split(',').filter(Boolean) ?? [];
        const original = target.room.forSlot;
        target.room.forSlot = [...targetTags, child].join(',');
        // Only the recipient room changed. Rebuilding every floor for each
        // trial made large households needlessly expensive to generate.
        const trial = bestRoomLayout(target.floor, target.room, blocked, servantCount, cache);
        const targetBeds = trial.filter(f => f.kind === 'bed').length;
        if (targetBeds < targetTags.length + 1) { target.room.forSlot = original; continue; }
        source.room.forSlot = source.room.forSlot!.split(',').filter(tag => tag !== child).join(',') || undefined;
        changedSources.add(source);
        target.floor.furnishings = [...target.floor.furnishings.filter(f => f.roomId !== target.room.id), ...trial];
        break;
      }
    }
  }
  for (const source of changedSources) {
    const revised = bestRoomLayout(source.floor, source.room, blocked, servantCount, cache);
    source.floor.furnishings = [...source.floor.furnishings.filter(f => f.roomId !== source.room.id), ...revised];
  }
  // Stable room order preserves the furnishing-index join used by manifests.
  for (const floor of floors) {
    floor.furnishings.sort((a, b) => a.roomId - b.roomId);
    floor.furnishings = withCommonRoomSeating(floor, blocked, servantCount, cache.walks, floor.furnishings, cache.options);
  }
}

/** New household sources need seats as well as beds. Try shared halls first,
 * then kitchens, using the same catalog hulls, doors, blocked stair cells and
 * connected walking graph. Append only: never move a bed or existing stock.
 * A real bench budgets two people; chairs fill smaller remaining spaces.
 * An omitted seat remains a measurable capacity failure, not a tiny fake mesh. */
export function furnishHouseholdSeating(floors:BlueprintFloor[],blocked:Set<string>,servantCount:number,seats:number,options:HouseholdFurnishingOptions={}):void{
 const rooms=floors.filter(f=>f.level>=0).flatMap(floor=>floor.rooms.filter(r=>r.purpose==='hall'||r.purpose==='kitchen').map(room=>({floor,room})))
   .sort((a,b)=>Number(b.room.purpose==='hall')-Number(a.room.purpose==='hall')||a.floor.level-b.floor.level||a.room.id-b.room.id);
 const count=()=>rooms.reduce((n,{floor,room})=>n+floor.furnishings.filter(p=>p.roomId===room.id).reduce((n,p)=>n+(p.kind==='bench'?2:p.kind==='chair'?1:0),0),0);
 const trials=options.seatingTrials??1;
 if(!Number.isInteger(trials)||trials<1||trials>16)throw new RangeError('Household seating needs one to sixteen trials');
 const initial=floors.map(f=>f.furnishings),walks=new Map<BlueprintRoom,WalkGraph>();
 let best=initial,bestCount=count();
 for(let trial=0;trial<trials&&bestCount<seats;trial++){
  for(let i=0;i<floors.length;i++)floors[i].furnishings=initial[i];
  // Trials change only newly appended seats. Beds, stock, object indices and
  // existing seats keep their original positions and order. Try a kitchen-led
  // meal area or small chairs when the first bench consumes a useful bay.
  const ordered=trial%2===0?rooms:[...rooms].sort((a,b)=>Number(b.room.purpose==='kitchen')-Number(a.room.purpose==='kitchen')||a.floor.level-b.floor.level||a.room.id-b.room.id);
  const kinds:ReadonlyArray<'bench'|'chair'>=Math.floor(trial/2)%2===0?['bench','chair']:['chair','bench'];
  const corner=Math.floor(trial/4),x=corner%2===0?1:-1,y=corner<2?1:-1;
  for(const {floor,room}of ordered)for(let attempt=0;attempt<seats&&count()<seats;attempt++){
   let added=false;
   for(const seatKind of kinds){
    const next=furnishWithPreference(floor,blocked,servantCount,{...options,x,y,seatKind},room.id,walks,floor.furnishings);
    if(next.length>floor.furnishings.length){floor.furnishings=next;added=true;break;}
   }
   if(!added)break;
  }
  const fitted=count();if(fitted>bestCount){best=floors.map(f=>f.furnishings);bestCount=fitted;}
 }
 for(let i=0;i<floors.length;i++)floors[i].furnishings=best[i];
}
