/**
 * This file turns explored cells from the canonical DungeonPlan into remembered map ink.
 *
 * Movement supplies the player's real grid cell. This model reveals only nearby floor cells and
 * then filters the same plan used by the 3D renderer, so the parchment cannot expose a second
 * generated layout. Key authored rooms become landmarks only after one of their floor cells has
 * been explored. Deterministic level descriptors can now add stairs, truthful vertical sightlines,
 * and the deepest boss objective as annotations. They still pass through this same discovery gate,
 * so a page never leaks a transition or objective before its floor cell has been explored.
 *
 * Called by: Dungeon3DPreview movement, DungeonParchmentMap, and focused map tests.
 * Depends on: the pure-data dungeon plan contract.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 16:21:14
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, components/World3D/DungeonParchmentMap.tsx, components/World3D/dungeonKnowledge.ts, systems/worldforge/dungeon/world/dungeonLevels.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CellKind, type Cell, type DungeonPlan, type DungeonRoom } from '../types';
import { bresenhamLine } from '../../../../utils/spatial/lineOfSight';

// ============================================================================
// Persisted Cell Addressing
// ============================================================================
// One opaque level key and one stable coordinate grammar are enough for the current surface level.
// Future descent can add new level keys while retaining the same canonical dungeon ledger.
// ============================================================================

export const DUNGEON_SURFACE_LEVEL_ID = 'level:0';

export function dungeonCellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function isFloorCell(plan: DungeonPlan, cell: Cell): boolean {
  return cell.x >= 0
    && cell.y >= 0
    && cell.x < plan.W
    && cell.y < plan.H
    && plan.grid[cell.y * plan.W + cell.x] === CellKind.Floor;
}

// ============================================================================
// Movement-Driven Discovery
// ============================================================================
// Near footing remains available in darkness. Fixed source torches let the party
// remember visible floor within20ft, without granting sight through walls or doors.
// ============================================================================

export function revealedDungeonCellKeys(plan: DungeonPlan, playerCell: Cell, carriedBrightRadiusFt = 0): string[] {
  const candidates: Cell[] = [
    playerCell,
    { x: playerCell.x, y: playerCell.y - 1 },
    { x: playerCell.x + 1, y: playerCell.y },
    { x: playerCell.x, y: playerCell.y + 1 },
    { x: playerCell.x - 1, y: playerCell.y },
  ];

  // Preserve this fixed order so reducer receipts and proof counts stay deterministic.
  const keys=candidates.filter((cell) => isFloorCell(plan, cell)).map(dungeonCellKey);
  if(!isFloorCell(plan,playerCell))return keys;
  const closed=new Set(plan.doors.filter(door=>door.state!=='open').map(door=>dungeonCellKey(door.cell)));
  const opaque=(cell:Cell)=>!isFloorCell(plan,cell)||closed.has(dungeonCellKey(cell));
  const clear=(from:Cell,to:Cell)=>{
    const line=bresenhamLine(from.x,from.y,to.x,to.y);
    return line.every((cell,index)=>{
      if(index===0)return true;
      if(opaque(cell))return false;
      const previous=line[index-1];
      return previous.x===cell.x||previous.y===cell.y||
        !(opaque({x:cell.x,y:previous.y})&&opaque({x:previous.x,y:cell.y}));
    });
  };
  // Fixed flames and explicitly burning owned torches provide light. A packed torch does not.
  // Twenty feet is a conservative bright-light limit; dim-light and character
  // vision capabilities remain outside this bounded discovery repair.
  const radius=Math.floor(20/plan.cellFt);
  const torches=plan.props.filter(prop=>prop.kind==='torch').map(prop=>({
    x:Math.floor(prop.x/plan.cellFt),y:Math.floor(prop.y/plan.cellFt),
  })).filter(cell=>isFloorCell(plan,cell));
  const known=new Set(keys);
  for(let y=Math.max(0,playerCell.y-radius);y<=Math.min(plan.H-1,playerCell.y+radius);y++)
    for(let x=Math.max(0,playerCell.x-radius);x<=Math.min(plan.W-1,playerCell.x+radius);x++){
      const cell={x,y},key=dungeonCellKey(cell);
      if(known.has(key)||Math.hypot(x-playerCell.x,y-playerCell.y)>radius||opaque(cell)||!clear(playerCell,cell))continue;
      if(!(Number.isFinite(carriedBrightRadiusFt)&&carriedBrightRadiusFt>0&&Math.hypot(x-playerCell.x,y-playerCell.y)*plan.cellFt<=carriedBrightRadiusFt)
        &&!torches.some(torch=>Math.hypot(x-torch.x,y-torch.y)<=radius&&clear(torch,cell)))continue;
      keys.push(key);known.add(key);
    }
  return keys;
}

// ============================================================================
// Remembered Landmark Selection
// ============================================================================
// Room roles come from DungeonPlan. Vertical annotations come from the canonical level stack and
// must name real plan cells; encounters, traps, and unsupported interaction semantics stay absent.
// ============================================================================

export type DungeonMapLandmarkKind =
  | 'entrance'
  | 'treasure'
  | 'shrine'
  | 'stairs-up'
  | 'stairs-down'
  | 'boss'
  | 'overlook';

export interface DungeonMapAnnotation {
  id: string;
  kind: Extract<DungeonMapLandmarkKind, 'stairs-up' | 'stairs-down' | 'boss' | 'overlook'>;
  label: string;
  cell: Cell;
  roomId: number;
}

export interface DungeonMapLandmark {
  id: string;
  kind: DungeonMapLandmarkKind;
  label: string;
  purpose: DungeonRoom['purpose'];
  roomId: number;
  cell: Cell;
}

function landmarkKindForRoom(room: DungeonRoom): DungeonMapLandmarkKind | null {
  if (room.type === 'entrance') return 'entrance';
  if (room.type === 'treasure') return 'treasure';
  if (room.type === 'shrine') return 'shrine';
  return null;
}

function landmarkLabel(kind: DungeonMapLandmarkKind): string {
  if (kind === 'entrance') return 'World entrance';
  if (kind === 'treasure') return 'Treasure chamber';
  return 'Shrine';
}

function roomFloorCells(plan: DungeonPlan, room: DungeonRoom): Cell[] {
  const minX = Math.floor(room.x / plan.cellFt);
  const minY = Math.floor(room.y / plan.cellFt);
  const maxX = Math.ceil((room.x + room.w) / plan.cellFt);
  const maxY = Math.ceil((room.y + room.h) / plan.cellFt);
  const cells: Cell[] = [];

  // Irregular rooms may leave void inside their bounding box, so only actual plan floor counts.
  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const cell = { x, y };
      if (isFloorCell(plan, cell)) cells.push(cell);
    }
  }

  return cells;
}

function landmarkForRoom(plan: DungeonPlan, room: DungeonRoom): DungeonMapLandmark | null {
  const kind = landmarkKindForRoom(room);
  if (!kind) return null;
  const centerX = (room.x + room.w / 2) / plan.cellFt - 0.5;
  const centerY = (room.y + room.h / 2) / plan.cellFt - 0.5;
  const cells = roomFloorCells(plan, room).sort((left, right) => (
    ((left.x - centerX) ** 2 + (left.y - centerY) ** 2)
    - ((right.x - centerX) ** 2 + (right.y - centerY) ** 2)
    || left.y - right.y
    || left.x - right.x
  ));
  const cell = cells[0];
  if (!cell) return null;

  return {
    id: `landmark.v1:room:${room.id}:${kind}`,
    kind,
    label: landmarkLabel(kind),
    purpose: room.purpose,
    roomId: room.id,
    cell,
  };
}

// ============================================================================
// Parchment Sheet Model
// ============================================================================
// The model contains explored topology only. Hidden counts support honest player feedback and
// verification, but hidden coordinates and labels never enter the rendered landmark collection.
// ============================================================================

export interface DungeonParchmentSheetModel {
  exploredBounds: { minX: number; minY: number; width: number; height: number };
  exploredCells: Cell[];
  exploredDoors: Array<{ cell: Cell; state: string }>;
  visibleLandmarks: DungeonMapLandmark[];
  discoveredCellCount: number;
  hiddenFloorCellCount: number;
  hiddenLandmarkCount: number;
}

export function buildDungeonParchmentSheet(
  plan: DungeonPlan,
  discoveredCellKeys: readonly string[],
  annotations: readonly DungeonMapAnnotation[] = [],
): DungeonParchmentSheetModel {
  const discovered = new Set(discoveredCellKeys);
  const exploredCells: Cell[] = [];
  let totalFloorCellCount = 0;

  // Scan the canonical bitmap in row-major order. Unseen floor never becomes a drawable cell.
  for (let y = 0; y < plan.H; y += 1) {
    for (let x = 0; x < plan.W; x += 1) {
      const cell = { x, y };
      if (!isFloorCell(plan, cell)) continue;
      totalFloorCellCount += 1;
      if (discovered.has(dungeonCellKey(cell))) exploredCells.push(cell);
    }
  }

  const landmarks = plan.rooms
    .map((room) => landmarkForRoom(plan, room))
    .filter((landmark): landmark is DungeonMapLandmark => landmark !== null);
  const verticalLandmarks = annotations
    .filter((annotation) => isFloorCell(plan, annotation.cell))
    .map((annotation): DungeonMapLandmark => ({
      ...annotation,
      cell: { ...annotation.cell },
      purpose: plan.rooms.find((room) => room.id === annotation.roomId)?.purpose ?? 'passage-room',
    }));
  const allLandmarks = [...landmarks, ...verticalLandmarks];
  const verticalKinds = new Set<DungeonMapLandmarkKind>(['stairs-up', 'stairs-down', 'boss', 'overlook']);
  const visibleLandmarks = allLandmarks.filter((landmark) => (
    verticalKinds.has(landmark.kind)
      ? discovered.has(dungeonCellKey(landmark.cell))
      : roomFloorCells(plan, plan.rooms.find((room) => room.id === landmark.roomId)!)
        .some((cell) => discovered.has(dungeonCellKey(cell)))
  ));

  // Secret doors remain off the sheet even if another system later reveals their raw cell. This
  // lane does not implement searching, and displaying the door would invent that discovery.
  const exploredDoors = plan.doors
    .filter((door) => door.state !== 'secret' && discovered.has(dungeonCellKey(door.cell)))
    .map((door) => ({ cell: { ...door.cell }, state: door.state }));

  // Frame only remembered ink. Showing the complete plan dimensions would make early routes tiny
  // and would leak the eventual dungeon extent even though its topology remained blank.
  const exploredXs = exploredCells.map((cell) => cell.x);
  const exploredYs = exploredCells.map((cell) => cell.y);
  const minExploredX = exploredXs.length > 0 ? Math.min(...exploredXs) : 0;
  const maxExploredX = exploredXs.length > 0 ? Math.max(...exploredXs) : 0;
  const minExploredY = exploredYs.length > 0 ? Math.min(...exploredYs) : 0;
  const maxExploredY = exploredYs.length > 0 ? Math.max(...exploredYs) : 0;
  const padding = 2;

  return {
    exploredBounds: {
      minX: minExploredX - padding,
      minY: minExploredY - padding,
      width: Math.max(5, maxExploredX - minExploredX + 1 + padding * 2),
      height: Math.max(5, maxExploredY - minExploredY + 1 + padding * 2),
    },
    exploredCells,
    exploredDoors,
    visibleLandmarks,
    discoveredCellCount: exploredCells.length,
    hiddenFloorCellCount: Math.max(0, totalFloorCellCount - exploredCells.length),
    hiddenLandmarkCount: Math.max(0, allLandmarks.length - visibleLandmarks.length),
  };
}
