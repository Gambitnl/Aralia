// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:47:08
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, components/World3D/DungeonParchmentMap.tsx, systems/worldforge/dungeon/world/dungeonLevels.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

import { CellKind, type Cell, type DungeonPlan, type DungeonRoom } from '../types';

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
// The occupied square and adjacent visible floor are inked. This keeps the first sheet mostly
// blank, makes every legal step reveal more plan, and does not look through distant rooms.
// ============================================================================

export function revealedDungeonCellKeys(plan: DungeonPlan, playerCell: Cell): string[] {
  const candidates: Cell[] = [
    playerCell,
    { x: playerCell.x, y: playerCell.y - 1 },
    { x: playerCell.x + 1, y: playerCell.y },
    { x: playerCell.x, y: playerCell.y + 1 },
    { x: playerCell.x - 1, y: playerCell.y },
  ];

  // Preserve this fixed order so reducer receipts and proof counts stay deterministic.
  return candidates.filter((cell) => isFloorCell(plan, cell)).map(dungeonCellKey);
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
