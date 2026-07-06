import type { Feet } from '../units';

export type BuildingType = 'cottage' | 'shop' | 'tavern' | 'workshop' | 'manor';

export type RoomPurpose =
  | 'hall' | 'common-room' | 'great-hall' | 'nave'
  | 'kitchen' | 'bedroom' | 'guest-room' | 'private-room' | 'solar'
  | 'shopfront' | 'workshop' | 'storage' | 'pantry' | 'cellar' | 'armory'
  | 'sanctuary' | 'vestry' | 'study' | 'guard-room' | 'corridor';

export const EXTERIOR = -1;

/** A 5 ft grid cell (cell coords, not feet). Feet = cell * 5. */
export interface Cell { cx: number; cy: number; }

export interface BlueprintRoom {
  id: number;
  purpose: RoomPurpose;
  cells: Cell[];
  /** Convenience bbox in feet. */
  bbox: { x: Feet; y: Feet; w: Feet; d: Feet };
  isMain: boolean;
  isCorridor: boolean;
}

/** A door on a wall line. axis 'x' = horizontal wall (crosses a y boundary),
 *  'y' = vertical wall (crosses an x boundary). Matches InteriorDoorway. */
export interface BlueprintDoor {
  a: number; b: number; // room ids; a === EXTERIOR for the street entry
  x: Feet; y: Feet;
  axis: 'x' | 'y';
  isEntry: boolean;
}

export interface BlueprintWindow { x: Feet; y: Feet; axis: 'x' | 'y'; }

export interface BlueprintFurnishing {
  kind: string; roomId: number; x: Feet; y: Feet; rotation: 0 | 90 | 180 | 270;
}

/** A wall segment on one cell edge. thicknessFt grows outward from the line. */
export interface WallEdge {
  x: Feet; y: Feet; axis: 'x' | 'y';
  kind: 'outer' | 'inner';
  thicknessFt: Feet;
}

export interface BlueprintFloor {
  level: number; // -1 = basement, 0 = ground, 1+ = upper
  rooms: BlueprintRoom[];
  doors: BlueprintDoor[];
  windows: BlueprintWindow[];
  furnishings: BlueprintFurnishing[];
  walls: WallEdge[];
}

export interface BlueprintStair { fromLevel: number; x: Feet; y: Feet; }

export interface BlueprintPlan {
  buildingId: number;
  type: BuildingType;
  footprintCells: Cell[];
  widthFt: Feet; depthFt: Feet;
  floors: BlueprintFloor[]; // ordered basement..ground..upper; ground has level 0
  stairs: BlueprintStair[];
}

export const cellKey = (cx: number, cy: number): string => `${cx},${cy}`;
