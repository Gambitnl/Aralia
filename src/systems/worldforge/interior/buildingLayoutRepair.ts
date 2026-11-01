/** A bounded layout correction, not a new household or a renovation event.
 * Move an existing chest toward its room wall only when this opens a genuine
 * bedside aisle. Rooms, beds, doors, furnishing indexes and possessions stay
 * with their original owners. Saved plans adopt a recorded move separately. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 20:18:17
 * Dependents: components/World3D/World3DWrapper.tsx, state/reducers/townReducer.ts, systems/worldforge/interior/buildingSource.ts, systems/worldforge/interior/guestCirculation.ts, systems/worldforge/interior/householdLivingPlan.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {BlueprintFloor, BlueprintFurnishing, BlueprintPlan} from './blueprintTypes';
import {blueprintSiteOrigin, cellKey} from './blueprintTypes';
import {furnishingFootprint} from './householdFurnish';

const FT = 0.3048, AISLE = .8 / FT, MARGIN = .3;
export const FURNITURE_REPAIR_RECIPE = 'bedside-storage-clearance-v1' as const;
export interface FurnitureLayoutMove {
  level: number; index: number; roomId: number; kind: 'chest';
  from: {x: number; y: number}; to: {x: number; y: number};
}
export interface FurnitureLayoutRepair {
  version: 1; recipe: typeof FURNITURE_REPAIR_RECIPE; moves: FurnitureLayoutMove[];
  admittedAt: string;
  position: {tileX: number; tileY: number; xM: number; zM: number; yM: number};
}
const overlaps = (a: ReturnType<typeof furnishingFootprint>, b: ReturnType<typeof furnishingFootprint>) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Connect every doorway and keep each piece approachable with an 0.8 m
 * body envelope by default (or the caller's explicit measured width). A free rectangle beside the bed is insufficient if a chest
 * seals the route around another piece elsewhere in the same room. */
export function roomFurnishingsReachable(floor: BlueprintFloor, roomId: number, step: 1 | .5 | .25 = 1, widthM = .8, onIssue?: (reason: string) => void): boolean {
  const refuse = (reason: string) => {onIssue?.(reason); return false;};
  if (!Number.isFinite(widthM) || widthM <= 0) return false;
  const room = floor.rooms.find(r => r.id === roomId)!, radius = widthM / FT / 2;
  const cells = new Set(room.cells.map(c => cellKey(c.cx, c.cy)));
  const pieces = floor.furnishings.filter(p => p.roomId === roomId).map(furnishingFootprint);
  const nodes = new Map<string, {x: number; y: number}>();
  for (let y = room.bbox.y + .5; y < room.bbox.y + room.bbox.d; y += step)
    for (let x = room.bbox.x + .5; x < room.bbox.x + room.bbox.w; x += step) {
      const box = {left: x - radius, right: x + radius, top: y - radius, bottom: y + radius};
      let inside = true;
      for (let cy = Math.floor(box.top / 5); cy <= Math.floor((box.bottom - 1e-8) / 5); cy++)
        for (let cx = Math.floor(box.left / 5); cx <= Math.floor((box.right - 1e-8) / 5); cx++)
          if (!cells.has(cellKey(cx, cy))) inside = false;
      if (inside && !pieces.some(p => overlaps(box, p))) nodes.set(`${x}:${y}`, {x, y});
    }
  const all = [...nodes.values()];
  if (!all.length) return refuse('no body-width standing nodes');
  const doors = floor.doors.filter(d => d.a === roomId || d.b === roomId);
  const nearest = (x: number, y: number) => [...all].sort((a, b) =>
    Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  const targets = doors.map(d => nearest(d.x, d.y));
  if (targets.some((p, i) => Math.hypot(p.x - doors[i].x, p.y - doors[i].y) > 3)) return refuse('a doorway has no body-width approach');
  const first = targets[0] ?? all[0], queue = [first], visited = new Set([`${first.x}:${first.y}`]);
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
    const k = `${queue[i].x + dx}:${queue[i].y + dy}`, p = nodes.get(k);
    if (p && !visited.has(k)) {visited.add(k); queue.push(p);}
  }
  if (!targets.every(p => visited.has(`${p.x}:${p.y}`))) return refuse('doorway approaches are disconnected');
  const missed = pieces.findIndex(box => !queue.some(p =>
    Math.hypot(Math.max(box.left - p.x, p.x - box.right, 0), Math.max(box.top - p.y, p.y - box.bottom, 0)) <= Math.max(2, radius + .2 / FT)));
  return missed < 0 || refuse('furnishing '+floor.furnishings.filter(p=>p.roomId===roomId)[missed].kind+' is unreachable');
}

/** Full catalog rectangles must fit the actual room, including concave rooms.
 * A bounding box alone could put a moved chest through an L-shaped wall. */
function fits(plan: BlueprintPlan, floor: BlueprintFloor, piece: BlueprintFurnishing, index: number): boolean {
  const room = floor.rooms.find(r => r.id === piece.roomId);
  if (!room) return false;
  const cells = new Set(room.cells.map(c => cellKey(c.cx, c.cy))), box = furnishingFootprint(piece);
  for (let y = Math.floor((box.top - MARGIN) / 5); y <= Math.floor((box.bottom + MARGIN - 1e-8) / 5); y++)
    for (let x = Math.floor((box.left - MARGIN) / 5); x <= Math.floor((box.right + MARGIN - 1e-8) / 5); x++)
      if (!cells.has(cellKey(x, y))) return false;
  if (floor.furnishings.some((other, i) => i !== index && overlaps(box, furnishingFootprint(other)))) return false;
  if (plan.stairs.filter(s => s.fromLevel === floor.level || s.fromLevel + 1 === floor.level)
    .flatMap(s => s.layout ? [...s.layout.shaftCells, ...s.layout.landingCells]
      : [{cx: Math.floor(s.x / 5), cy: Math.floor(s.y / 5)}])
    .some(c => overlaps(box, {left: c.cx * 5, right: (c.cx + 1) * 5, top: c.cy * 5, bottom: (c.cy + 1) * 5}))) return false;
  // Keep an adult-width approach on both sides and the complete inward leaf
  // depth. This correction cannot trade a bedside gap for a blocked doorway.
  return floor.doors.filter(d => d.a === room.id || d.b === room.id).every(d => !overlaps(box,
    d.axis === 'x' ? {left: d.x - AISLE / 2, right: d.x + AISLE / 2, top: d.y - 3, bottom: d.y + 3}
      : {left: d.x - 3, right: d.x + 3, top: d.y - AISLE / 2, bottom: d.y + AISLE / 2}));
}

/** No new random draws or inventory rolls. A room without a safe opposite
 * wall keeps its old layout and remains a genuine unresolved cramped case. */
export function bedsideStorageMoves(plan: BlueprintPlan): FurnitureLayoutMove[] {
  const moves: FurnitureLayoutMove[] = [];
  for (const floor of plan.floors) {
    const working = {...floor, furnishings: floor.furnishings.map(p => ({...p}))};
    for (const [index, chest] of working.furnishings.entries()) {
      if (chest.kind !== 'chest') continue;
      const room = floor.rooms.find(r => r.id === chest.roomId)!;
      for (const bed of working.furnishings.filter(p => p.kind === 'bed' && p.roomId === chest.roomId)) {
        const a = furnishingFootprint(bed), b = furnishingFootprint(chest);
        const alongX = a.top < b.bottom && a.bottom > b.top;
        const alongY = a.left < b.right && a.right > b.left;
        const gapX = Math.max(b.left - a.right, a.left - b.right);
        const gapY = Math.max(b.top - a.bottom, a.top - b.bottom);
        const axis = alongX && gapX >= 0 && gapX < AISLE ? 'x'
          : alongY && gapY >= 0 && gapY < AISLE ? 'y' : undefined;
        if (!axis) continue;
        const candidate = {...chest};
        if (axis === 'x') candidate.x = chest.x > bed.x
          ? room.bbox.x + room.bbox.w - (b.right - b.left) / 2 - MARGIN
          : room.bbox.x + (b.right - b.left) / 2 + MARGIN;
        else candidate.y = chest.y > bed.y
          ? room.bbox.y + room.bbox.d - (b.bottom - b.top) / 2 - MARGIN
          : room.bbox.y + (b.bottom - b.top) / 2 + MARGIN;
        const c = furnishingFootprint(candidate);
        const gap = axis === 'x' ? Math.max(c.left - a.right, a.left - c.right)
          : Math.max(c.top - a.bottom, a.top - c.bottom);
        if (gap < AISLE || !fits(plan, working, candidate, index)) continue;
        const trial = {...working, furnishings: working.furnishings.map((p, i) => i === index ? candidate : p)};
        if (!roomFurnishingsReachable(trial, chest.roomId)) continue;
        moves.push({level: floor.level, index, roomId: chest.roomId, kind: 'chest',
          from: {x: chest.x, y: chest.y}, to: {x: candidate.x, y: candidate.y}});
        working.furnishings[index] = candidate;
        break;
      }
    }
  }
  return moves;
}

/** Recompute and compare the exact recipe before replaying saved moves. A
 * corrupt index cannot move a different container or turn into free goods. */
export function applyFurnitureLayoutMoves(plan: BlueprintPlan, moves: FurnitureLayoutMove[]): BlueprintPlan {
  if (JSON.stringify(moves) !== JSON.stringify(bedsideStorageMoves(plan))) throw new Error('The furniture layout repair no longer matches its source.');
  const copy = JSON.parse(JSON.stringify(plan)) as BlueprintPlan;
  for (const move of moves) {
    const piece = copy.floors.find(f => f.level === move.level)!.furnishings[move.index];
    piece.x = move.to.x; piece.y = move.to.y;
  }
  return copy;
}

/** A saved layout correction waits until the party has left the building.
 * Three meters outside the whole envelope covers the body and camera near an
 * entrance. The reducer never guesses a replacement position, even on stairs. */
export function outsideLayoutRepairEnvelope(plan: BlueprintPlan,
  site: {xM: number; zM: number; rotationY: number; doorZSign: number},
  position: {xM: number; zM: number; yM?: number} | null | undefined): boolean {
  if (!position || ![position.xM, position.zM, position.yM].every(Number.isFinite)) return false;
  const dx = position.xM - site.xM, dz = position.zM - site.zM, origin = blueprintSiteOrigin(plan);
  const x = (dx * Math.cos(site.rotationY) - dz * Math.sin(site.rotationY)) / FT + origin.x;
  const y = (dx * Math.sin(site.rotationY) + dz * Math.cos(site.rotationY)) * -site.doorZSign / FT + origin.y;
  const margin = 3 / FT;
  return x < -margin || x > plan.widthFt + margin || y < -margin || y > plan.depthFt + margin;
}
