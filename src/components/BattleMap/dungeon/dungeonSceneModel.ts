// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 01:49:18
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns a pure dungeon plan into lightweight placement data for the 3D preview.
 *
 * The dungeon generator deliberately knows nothing about Three.js. This adapter keeps that
 * boundary intact: it converts five-foot cells, doors, history scars, props, and encounters
 * into plain scene instances that the React renderer can batch into a small set of instanced
 * meshes. The parchment map and the 3D view therefore remain two presentations of the exact
 * same deterministic dungeon history.
 *
 * Called by: Dungeon3DPreview.tsx and its focused model tests.
 * Depends on: the public DungeonPlan contract only; it imports no rendering library.
 */

import {
  CellKind,
  OverlayKind,
  type DoorState,
  type DungeonPlan,
  type DungeonRoom,
  type DungeonTheme,
  type RoomType,
} from '../../../systems/worldforge/dungeon/types';

// ============================================================================
// Public scene vocabulary
// ============================================================================
// These small records describe everything the renderer needs without leaking Three.js
// objects back into world generation. One scene unit represents one five-foot dungeon cell.
// ============================================================================

export interface DungeonSceneInstance {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotation: number;
  color: string;
  /** Minor dressing stays available for close inspection but may be omitted at tactical range. */
  detail?: true;
  /** The semantic visual classification of this prop. */
  visualKind?: DungeonPropVisualKind;
  /** The id of the event that left this scar, if this is historical evidence. */
  eventRef?: number;
}

export interface DungeonSceneDoor extends DungeonSceneInstance {
  state: DoorState;
}

export interface DungeonSceneLine {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  color: string;
  kind: 'graph' | 'loop' | 'critical';
}

export interface DungeonSceneMarker {
  x: number;
  z: number;
  radius: number;
  color: string;
  label: 'Entrance' | 'Objective';
}

export interface DungeonScenePalette {
  background: string;
  fog: string;
  floor: string;
  corridor: string;
  wall: string;
  wallCap: string;
  accent: string;
  flame: string;
  ambient: string;
  sun: string;
}

export interface DungeonSceneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export interface DungeonSceneModel {
  width: number;
  depth: number;
  bounds: DungeonSceneBounds;
  palette: DungeonScenePalette;
  floors: DungeonSceneInstance[];
  walls: DungeonSceneInstance[];
  wallCaps: DungeonSceneInstance[];
  liquids: DungeonSceneInstance[];
  doors: DungeonSceneDoor[];
  lowProps: DungeonSceneInstance[];
  tallProps: DungeonSceneInstance[];
  evidence: DungeonSceneInstance[];
  flames: DungeonSceneInstance[];
  propBoxes: DungeonSceneInstance[];
  propCylinders: DungeonSceneInstance[];
  propCones: DungeonSceneInstance[];
  propSpheres: DungeonSceneInstance[];
  propOctahedrons: DungeonSceneInstance[];
  propFlames: DungeonSceneInstance[];
  spawns: DungeonSceneInstance[];
  spawnHalos: DungeonSceneInstance[];
  lines: DungeonSceneLine[];
  markers: DungeonSceneMarker[];
  lights: Array<{ x: number; y: number; z: number; color: string }>;
}

export interface DungeonSceneOptions {
  showRoomTypes: boolean;
  showDifficulty: boolean;
  showCritical: boolean;
}

// ============================================================================
// Theme art direction
// ============================================================================
// Every theme keeps the same geometry and history, but receives a distinct material and
// atmosphere vocabulary. Warm accents keep important objects readable in the dark scene.
// ============================================================================

export const DUNGEON_3D_PALETTES: Record<DungeonTheme, DungeonScenePalette> = {
  crypt: {
    background: '#09080b', fog: '#17131b', floor: '#6a6261', corridor: '#4e474a',
    wall: '#484043', wallCap: '#776a6d', accent: '#c49b5b', flame: '#ff9c45',
    ambient: '#776f91', sun: '#ffd7a1',
  },
  cavern: {
    background: '#050a0b', fog: '#102126', floor: '#5f6c67', corridor: '#41514d',
    wall: '#374441', wallCap: '#6b8178', accent: '#55d7d0', flame: '#ffad58',
    ambient: '#507b85', sun: '#bbfff4',
  },
  frost: {
    background: '#07101a', fog: '#17304a', floor: '#5c7185', corridor: '#40576d',
    wall: '#344b61', wallCap: '#6f91aa', accent: '#9be8ff', flame: '#ffd38c',
    ambient: '#6a8bb7', sun: '#d8edf5',
  },
  sewer: {
    background: '#070b08', fog: '#18271d', floor: '#60705b', corridor: '#435440',
    wall: '#394536', wallCap: '#748162', accent: '#a7c455', flame: '#ff9d47',
    ambient: '#5e795e', sun: '#d7dda5',
  },
  fungal: {
    background: '#090611', fog: '#231431', floor: '#6e5d78', corridor: '#51435f',
    wall: '#44334f', wallCap: '#806991', accent: '#e56bff', flame: '#80ffe1',
    ambient: '#8b65a2', sun: '#f2c6ff',
  },
};

const ROOM_COLORS: Record<RoomType, string> = {
  entrance: '#5cc7ff',
  combat: '#8a7b70',
  elite: '#e58a4a',
  treasure: '#f1ca62',
  shrine: '#a88cff',
  boss: '#f05d67',
};

const OVERLAY_COLORS: Record<OverlayKind, string> = {
  [OverlayKind.None]: '#000000',
  [OverlayKind.Water]: '#2e7899',
  [OverlayKind.Rubble]: '#766a5e',
  [OverlayKind.Ice]: '#8bcbe8',
  [OverlayKind.Bloom]: '#9b56af',
  [OverlayKind.Scorch]: '#3b2420',
};

// ============================================================================
// Deterministic color and placement helpers
// ============================================================================
// Rendering variation comes from a coordinate hash. It never consumes generator random
// streams, so adding visual polish cannot change a dungeon's topology or history.
// ============================================================================

function coordinateNoise(seed: number, x: number, y: number, salt: number): number {
  // Mix signed integer inputs into an unsigned value, then return the low 24 bits as 0..1.
  let value = (seed ^ Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + salt, 0xc2b2ae35)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return ((value ^ (value >>> 16)) & 0xffffff) / 0xffffff;
}

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function toHex(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
}

function mixColor(a: string, b: string, amount: number): string {
  const left = parseHex(a);
  const right = parseHex(b);
  const t = Math.max(0, Math.min(1, amount));
  return `#${toHex(left[0] + (right[0] - left[0]) * t)}${toHex(left[1] + (right[1] - left[1]) * t)}${toHex(left[2] + (right[2] - left[2]) * t)}`;
}

function cellToScene(plan: DungeonPlan, x: number, y: number): { x: number; z: number } {
  return { x: x - plan.W / 2 + 0.5, z: y - plan.H / 2 + 0.5 };
}

function roomCenter(plan: DungeonPlan, room: DungeonRoom): { x: number; z: number } {
  return {
    x: (room.x + room.w / 2) / plan.cellFt - plan.W / 2,
    z: (room.y + room.h / 2) / plan.cellFt - plan.H / 2,
  };
}

function roomIndexByCell(plan: DungeonPlan): Int16Array {
  const lookup = new Int16Array(plan.W * plan.H);
  lookup.fill(-1);

  // Room bounds are already five-foot aligned. Only stamp true room floors; corridor cells
  // remain unowned so they retain their darker navigation read.
  for (const room of plan.rooms) {
    const x0 = Math.max(0, Math.floor(room.x / plan.cellFt));
    const y0 = Math.max(0, Math.floor(room.y / plan.cellFt));
    const x1 = Math.min(plan.W, Math.ceil((room.x + room.w) / plan.cellFt));
    const y1 = Math.min(plan.H, Math.ceil((room.y + room.h) / plan.cellFt));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const index = y * plan.W + x;
        if (plan.grid[index] === CellKind.Floor && plan.corridor[index] === 0) lookup[index] = room.id;
      }
    }
  }
  return lookup;
}

function floorColor(
  plan: DungeonPlan,
  room: DungeonRoom | undefined,
  index: number,
  x: number,
  y: number,
  options: DungeonSceneOptions,
  palette: DungeonScenePalette,
): string {
  let color = plan.corridor[index] ? palette.corridor : palette.floor;

  // Developer overlays recolor the physical floor while leaving the generated plan alone.
  if (room && options.showRoomTypes) color = mixColor(color, ROOM_COLORS[room.type], 0.62);
  if (room && options.showDifficulty) color = mixColor('#3e7480', '#b74238', room.difficulty);
  if (room && options.showCritical && plan.criticalRoomIds.includes(room.id)) color = mixColor(color, '#f5ba4a', 0.46);

  // A narrow value range breaks up the tiled surface without producing visual static.
  if (options.showRoomTypes || options.showDifficulty || options.showCritical) return color;
  const variation = coordinateNoise(plan.seed, x, y, 71) - 0.5;
  return mixColor(color, variation >= 0 ? '#ffffff' : '#000000', Math.abs(variation) * 0.12);
}

function doorRotation(plan: DungeonPlan, x: number, y: number): number {
  // A door spanning north-south has floor on its east/west sides. If both directions are
  // ambiguous at a junction, choose the stronger horizontal passage read deterministically.
  const floorAt = (cx: number, cy: number): boolean => (
    cx >= 0 && cy >= 0 && cx < plan.W && cy < plan.H
      ? plan.grid[cy * plan.W + cx] === CellKind.Floor
      : false
  );
  const eastWest = Number(floorAt(x - 1, y)) + Number(floorAt(x + 1, y));
  const northSouth = Number(floorAt(x, y - 1)) + Number(floorAt(x, y + 1));
  return eastWest >= northSouth ? Math.PI / 2 : 0;
}

function propShape(kind: string): 'low' | 'tall' | 'evidence' | 'flame' {
  if (/torch|candles|hearth/.test(kind)) return 'flame';
  if (/rack|niche|wheel|pillar/.test(kind)) return 'tall';
  if (/scar|coins|nest|spore|rubble|debris|snapped|tunnel-mouth/.test(kind)) return 'evidence';
  return 'low';
}

function propDimensions(kind: string, scale: number): { sx: number; sy: number; sz: number; y: number } {
  if (/sarcophagus|stone-slab|bunk|long-table/.test(kind)) return { sx: 0.72 * scale, sy: 0.34 * scale, sz: 0.4 * scale, y: 0.2 * scale };
  if (/pew/.test(kind)) return { sx: 0.72 * scale, sy: 0.28 * scale, sz: 0.18 * scale, y: 0.17 * scale };
  if (/rack|niche/.test(kind)) return { sx: 0.16 * scale, sy: 1.05 * scale, sz: 0.7 * scale, y: 0.56 * scale };
  if (/pillar/.test(kind)) return { sx: 0.34 * scale, sy: 1.55 * scale, sz: 0.34 * scale, y: 0.83 * scale };
  if (/torch|candles|hearth/.test(kind)) return { sx: 0.16 * scale, sy: 0.18 * scale, sz: 0.16 * scale, y: 0.86 * scale };
  if (/chest|altar|crates|grain-jar/.test(kind)) return { sx: 0.5 * scale, sy: 0.45 * scale, sz: 0.38 * scale, y: 0.25 * scale };
  return { sx: 0.34 * scale, sy: 0.22 * scale, sz: 0.34 * scale, y: 0.14 * scale };
}

function isTacticalDetail(
  kind: string,
  shape: ReturnType<typeof propShape>,
  dimensions: ReturnType<typeof propDimensions>,
  hasHistoryReference: boolean,
  lodRoll: number,
): boolean {
  // Whole-plan views retain room-defining furniture, light, and historical evidence. Small
  // anonymous dressing remains in the model but waits for a close camera so hundreds of debris
  // marks do not flatten into an unreadable field of dots.
  if (hasHistoryReference) return false;
  if (/altar|chest|hearth|rack|niche|pillar/.test(kind)) return false;

  // Repeated seating, bunks, slabs, and coffins communicate room use through a representative
  // sample at tactical range. The full authored rows return unchanged in close presets.
  if (/sarcophagus|stone-slab|bunk|long-table|pew/.test(kind)) return lodRoll < 0.58;
  if (shape === 'flame') return false;
  return dimensions.sx < 0.48 && dimensions.sy < 0.4;
}

function propColor(
  kind: string,
  shape: ReturnType<typeof propShape>,
  palette: DungeonScenePalette,
  hasHistoryReference: boolean,
): string {
  // Material families matter more than raw prop kind in a distant 3D read: stone furniture
  // belongs to the architecture, wood stays warm and dark, and event evidence borrows the
  // theme accent so generated history remains discoverable.
  if (shape === 'flame') return palette.flame;
  if (/sarcophagus|stone-slab|disturbed-lid|bone-niche|bones|rubble|debris/.test(kind)) {
    return mixColor(palette.wall, palette.wallCap, /bone|disturbed/.test(kind) ? 0.58 : 0.32);
  }
  if (shape === 'evidence') return mixColor('#5d5750', palette.accent, hasHistoryReference ? 0.68 : 0.38);
  if (/pew|bunk|long-table|chest|crates|rack|snapped-bar/.test(kind)) {
    return mixColor('#4d3828', palette.accent, kind === 'chest' ? 0.4 : 0.14);
  }
  return mixColor('#5c5246', palette.accent, /altar/.test(kind) ? 0.52 : 0.22);
}

function selectAccentLights(candidates: DungeonSceneInstance[], color: string): DungeonSceneModel['lights'] {
  if (candidates.length === 0) return [];
  const selected: DungeonSceneInstance[] = [candidates[0]];

  // Farthest-point sampling spreads a strict ten-light budget through the level instead of
  // spending every real light in one busy room. Remaining flames still glow via emissive color.
  while (selected.length < Math.min(10, candidates.length)) {
    let best: DungeonSceneInstance | null = null;
    let bestDistance = -1;
    for (const candidate of candidates) {
      if (selected.includes(candidate)) continue;
      const nearest = Math.min(...selected.map((light) => ((candidate.x - light.x) ** 2) + ((candidate.z - light.z) ** 2)));
      if (nearest > bestDistance) {
        best = candidate;
        bestDistance = nearest;
      }
    }
    if (!best) break;
    selected.push(best);
  }
  return selected.map((light) => ({ x: light.x, y: light.y + 0.18, z: light.z, color }));
}

function sceneBounds(instances: DungeonSceneInstance[]): DungeonSceneBounds {
  // Generated layouts do not have to be centered inside their allocation grid. Measure the
  // actual carved geometry so tactical cameras frame off-center themes and unusual seeds.
  if (instances.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, centerX: 0, centerZ: 0, width: 1, depth: 1 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const instance of instances) {
    minX = Math.min(minX, instance.x);
    maxX = Math.max(maxX, instance.x);
    minZ = Math.min(minZ, instance.z);
    maxZ = Math.max(maxZ, instance.z);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
  };
}

// ============================================================================
// Prop decomposition details (File scope)
// ============================================================================

export type DungeonPropVisualKind =
  | 'sarcophagus' | 'disturbed-lid' | 'pew' | 'bone-niche' | 'bones' | 'altar' | 'spore-shelf'
  | 'stalagmite' | 'mushroom' | 'bunk' | 'tool-rack' | 'nest' | 'hoist-wheel'
  | 'iceshard' | 'long-table' | 'grain-jar' | 'weapon-rack' | 'hearth'
  | 'pool' | 'rubble' | 'torch' | 'candles' | 'chest' | 'crates' | 'pried-vault'
  | 'dropped-coins' | 'snapped-bar' | 'tunnel-mouth' | 'trap' | 'default';

/**
 * Classifies a raw prop kind string into a semantic visual category.
 */
export function classifyPropKind(kind: string): DungeonPropVisualKind {
  const k = kind.toLowerCase();
  if (k === 'sarcophagus') return 'sarcophagus';
  if (k === 'disturbed-lid') return 'disturbed-lid';
  if (k === 'pew') return 'pew';
  if (k === 'bone-niche') return 'bone-niche';
  if (k === 'bones' || k === 'bone-pile') return 'bones';
  if (k === 'altar') return 'altar';
  if (k === 'spore-shelf') return 'spore-shelf';
  if (k === 'stalagmite') return 'stalagmite';
  if (k === 'mushroom') return 'mushroom';
  if (k === 'bunk') return 'bunk';
  if (k === 'tool-rack') return 'tool-rack';
  if (k === 'nest') return 'nest';
  if (k === 'hoist-wheel') return 'hoist-wheel';
  if (k === 'iceshard' || k === 'ice-shard' || k === 'ice shard') return 'iceshard';
  if (k === 'long-table' || k === 'table') return 'long-table';
  if (k === 'grain-jar') return 'grain-jar';
  if (k === 'weapon-rack') return 'weapon-rack';
  if (k === 'hearth') return 'hearth';
  if (k === 'pool') return 'pool';
  if (k === 'rubble' || k === 'debris') return 'rubble';
  if (k === 'torch') return 'torch';
  if (k === 'candles') return 'candles';
  if (k === 'chest') return 'chest';
  if (k === 'crates') return 'crates';
  if (k === 'pried-vault') return 'pried-vault';
  if (k === 'dropped-coins') return 'dropped-coins';
  if (k === 'snapped-bar') return 'snapped-bar';
  if (k === 'tunnel-mouth') return 'tunnel-mouth';
  if (k === 'pit' || k === 'darts' || k === 'snare') return 'trap';
  return 'default';
}

interface DecomposedPart {
  shape: 'box' | 'cylinder' | 'cone' | 'octahedron' | 'sphere' | 'flame';
  lx: number;
  ly: number;
  lz: number;
  sx: number;
  sy: number;
  sz: number;
  rotOffset?: number;
  color: string;
}

/**
 * Transforms a local decomposed part to absolute scene space.
 */
function toGlobalPart(
  part: DecomposedPart,
  px: number,
  pz: number,
  rotRad: number,
  scale: number,
  detail: boolean,
): DungeonSceneInstance {
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const sLx = part.lx * scale;
  const sLy = part.ly * scale;
  const sLz = part.lz * scale;
  const sSx = part.sx * scale;
  const sSy = part.sy * scale;
  const sSz = part.sz * scale;

  const gx = px + (sLx * cos - sLz * sin);
  const gz = pz + (sLx * sin + sLz * cos);
  const gy = sLy;

  return {
    x: gx,
    y: gy,
    z: gz,
    sx: sSx,
    sy: sSy,
    sz: sSz,
    rotation: rotRad + (part.rotOffset ?? 0),
    color: part.color,
    ...(detail ? { detail: true as const } : {}),
  };
}

/**
 * Decomposes a single high-level dungeon prop into its primitive geometric components.
 */
export function decomposeProp(
  kind: string,
  px: number,
  pz: number,
  rotRad: number,
  scale: number,
  hasHistory: boolean,
  palette: DungeonScenePalette,
  detail: boolean,
): Array<{ shape: string; instance: DungeonSceneInstance }> {
  const visualKind = classifyPropKind(kind);
  const parts: DecomposedPart[] = [];

  const stoneColor = mixColor(palette.wall, palette.wallCap, 0.32);
  const boneColor = mixColor(palette.wall, palette.wallCap, 0.58);
  const woodColor = mixColor('#4d3828', palette.accent, 0.14);
  const altarColor = mixColor('#5c5246', palette.accent, 0.52);
  const chestColor = mixColor('#4d3828', palette.accent, 0.4);
  const metalColor = '#4a4e52';
  const goldColor = mixColor('#d8b33a', palette.accent, 0.5);

  const finalScale = scale * (hasHistory ? 1.15 : 1.0);
  const evidenceColor = mixColor('#5d5750', palette.accent, hasHistory ? 0.75 : 0.38);

  switch (visualKind) {
    case 'sarcophagus': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.15, lz: 0,
        sx: 0.72, sy: 0.3, sz: 0.4,
        color: stoneColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.32, lz: 0,
        sx: 0.76, sy: 0.08, sz: 0.44,
        color: stoneColor,
      });
      break;
    }
    case 'disturbed-lid': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.15, lz: 0,
        sx: 0.72, sy: 0.3, sz: 0.4,
        color: stoneColor,
      });
      parts.push({
        shape: 'box',
        lx: 0.08, ly: 0.32, lz: 0.04,
        sx: 0.76, sy: 0.08, sz: 0.44,
        rotOffset: 0.25,
        color: mixColor(stoneColor, palette.accent, 0.4),
      });
      break;
    }
    case 'pew': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.14, lz: 0,
        sx: 0.72, sy: 0.08, sz: 0.18,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.25, lz: 0.07,
        sx: 0.72, sy: 0.22, sz: 0.04,
        color: woodColor,
      });
      break;
    }
    case 'bone-niche': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.55, lz: 0.27,
        sx: 0.5, sy: 1.1, sz: 0.16,
        color: stoneColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.4, lz: 0.1,
        sx: 0.44, sy: 0.06, sz: 0.3,
        color: stoneColor,
      });
      parts.push({
        shape: 'sphere',
        lx: 0.08, ly: 0.46, lz: 0.1,
        sx: 0.1, sy: 0.1, sz: 0.1,
        color: boneColor,
      });
      break;
    }
    case 'bones': {
      parts.push({
        shape: 'sphere',
        lx: -0.05, ly: 0.05, lz: 0,
        sx: 0.15, sy: 0.1, sz: 0.15,
        color: boneColor,
      });
      parts.push({
        shape: 'sphere',
        lx: 0.05, ly: 0.04, lz: 0.05,
        sx: 0.12, sy: 0.08, sz: 0.12,
        color: boneColor,
      });
      parts.push({
        shape: 'octahedron',
        lx: 0, ly: 0.12, lz: -0.03,
        sx: 0.1, sy: 0.1, sz: 0.1,
        color: boneColor,
      });
      break;
    }
    case 'altar': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.175, lz: 0,
        sx: 0.6, sy: 0.35, sz: 0.4,
        color: stoneColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.39, lz: 0,
        sx: 0.66, sy: 0.08, sz: 0.44,
        color: altarColor,
      });
      break;
    }
    case 'spore-shelf': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.4, lz: 0,
        sx: 0.5, sy: 0.05, sz: 0.25,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: -0.18, ly: 0.25, lz: 0.02,
        sx: 0.05, sy: 0.3, sz: 0.2,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0.18, ly: 0.25, lz: 0.02,
        sx: 0.05, sy: 0.3, sz: 0.2,
        color: woodColor,
      });
      parts.push({
        shape: 'cylinder',
        lx: 0, ly: 0.46, lz: 0,
        sx: 0.04, sy: 0.12, sz: 0.04,
        color: boneColor,
      });
      parts.push({
        shape: 'cone',
        lx: 0, ly: 0.53, lz: 0,
        sx: 0.12, sy: 0.06, sz: 0.12,
        color: palette.accent,
      });
      break;
    }
    case 'stalagmite': {
      parts.push({
        shape: 'cone',
        lx: 0, ly: 0.4, lz: 0,
        sx: 0.34, sy: 0.8, sz: 0.34,
        color: stoneColor,
      });
      parts.push({
        shape: 'cone',
        lx: 0.12, ly: 0.225, lz: 0.06,
        sx: 0.18, sy: 0.45, sz: 0.18,
        color: mixColor(stoneColor, palette.floor, 0.4),
      });
      break;
    }
    case 'mushroom': {
      parts.push({
        shape: 'cylinder',
        lx: 0, ly: 0.16, lz: 0,
        sx: 0.08, sy: 0.32, sz: 0.08,
        color: boneColor,
      });
      parts.push({
        shape: 'cone',
        lx: 0, ly: 0.35, lz: 0,
        sx: 0.38, sy: 0.18, sz: 0.38,
        color: palette.accent,
      });
      break;
    }
    case 'bunk': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.17, lz: 0,
        sx: 0.72, sy: 0.34, sz: 0.38,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.24, lz: 0,
        sx: 0.66, sy: 0.1, sz: 0.32,
        color: mixColor('#6f7c85', palette.accent, 0.15),
      });
      parts.push({
        shape: 'box',
        lx: -0.22, ly: 0.3, lz: 0,
        sx: 0.14, sy: 0.06, sz: 0.24,
        color: '#e3dfdb',
      });
      break;
    }
    case 'tool-rack': {
      parts.push({
        shape: 'box',
        lx: -0.32, ly: 0.5, lz: 0,
        sx: 0.06, sy: 1.0, sz: 0.06,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0.32, ly: 0.5, lz: 0,
        sx: 0.06, sy: 1.0, sz: 0.06,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.9, lz: 0,
        sx: 0.7, sy: 0.06, sz: 0.06,
        color: woodColor,
      });
      parts.push({
        shape: 'cylinder',
        lx: -0.1, ly: 0.5, lz: 0.04,
        sx: 0.04, sy: 0.6, sz: 0.04,
        color: metalColor,
      });
      break;
    }
    case 'nest': {
      parts.push({
        shape: 'cylinder',
        lx: 0, ly: 0.06, lz: 0,
        sx: 0.6, sy: 0.12, sz: 0.6,
        color: mixColor('#5c4e3b', palette.accent, 0.1),
      });
      parts.push({
        shape: 'sphere',
        lx: -0.06, ly: 0.14, lz: 0.02,
        sx: 0.12, sy: 0.12, sz: 0.12,
        color: '#f0eae1',
      });
      parts.push({
        shape: 'sphere',
        lx: 0.06, ly: 0.14, lz: -0.04,
        sx: 0.12, sy: 0.12, sz: 0.12,
        color: '#e3ddd5',
      });
      break;
    }
    case 'hoist-wheel': {
      parts.push({
        shape: 'box',
        lx: -0.12, ly: 0.475, lz: 0,
        sx: 0.08, sy: 0.95, sz: 0.16,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0.12, ly: 0.475, lz: 0,
        sx: 0.08, sy: 0.95, sz: 0.16,
        color: woodColor,
      });
      parts.push({
        shape: 'cylinder',
        lx: 0, ly: 0.95, lz: 0,
        sx: 0.34, sy: 0.08, sz: 0.34,
        color: metalColor,
      });
      break;
    }
    case 'iceshard': {
      parts.push({
        shape: 'octahedron',
        lx: 0, ly: 0.4, lz: 0,
        sx: 0.26, sy: 0.8, sz: 0.26,
        color: palette.accent,
      });
      parts.push({
        shape: 'octahedron',
        lx: -0.12, ly: 0.25, lz: 0.08,
        sx: 0.16, sy: 0.5, sz: 0.16,
        rotOffset: 0.4,
        color: mixColor(palette.accent, '#ffffff', 0.3),
      });
      parts.push({
        shape: 'octahedron',
        lx: 0.1, ly: 0.2, lz: -0.1,
        sx: 0.14, sy: 0.4, sz: 0.14,
        rotOffset: -0.5,
        color: mixColor(palette.accent, '#ffffff', 0.5),
      });
      break;
    }
    case 'long-table': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.3, lz: 0,
        sx: 0.72, sy: 0.06, sz: 0.36,
        color: woodColor,
      });
      parts.push({ shape: 'box', lx: -0.3, ly: 0.15, lz: -0.14, sx: 0.05, sy: 0.3, sz: 0.05, color: woodColor });
      parts.push({ shape: 'box', lx: -0.3, ly: 0.15, lz: 0.14, sx: 0.05, sy: 0.3, sz: 0.05, color: woodColor });
      parts.push({ shape: 'box', lx: 0.3, ly: 0.15, lz: -0.14, sx: 0.05, sy: 0.3, sz: 0.05, color: woodColor });
      parts.push({ shape: 'box', lx: 0.3, ly: 0.15, lz: 0.14, sx: 0.05, sy: 0.3, sz: 0.05, color: woodColor });
      break;
    }
    case 'grain-jar': {
      parts.push({
        shape: 'cylinder',
        lx: 0, ly: 0.17, lz: 0,
        sx: 0.34, sy: 0.34, sz: 0.34,
        color: '#c26a4f',
      });
      parts.push({
        shape: 'cylinder',
        lx: 0, ly: 0.38, lz: 0,
        sx: 0.2, sy: 0.08, sz: 0.2,
        color: '#a3553c',
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.42, lz: 0,
        sx: 0.24, sy: 0.04, sz: 0.24,
        color: '#c26a4f',
      });
      break;
    }
    case 'weapon-rack': {
      parts.push({
        shape: 'box',
        lx: -0.32, ly: 0.525, lz: 0,
        sx: 0.06, sy: 1.05, sz: 0.06,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0.32, ly: 0.525, lz: 0,
        sx: 0.06, sy: 1.05, sz: 0.06,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.14, lz: 0,
        sx: 0.7, sy: 0.08, sz: 0.15,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.9, lz: 0,
        sx: 0.7, sy: 0.06, sz: 0.06,
        color: woodColor,
      });
      parts.push({
        shape: 'cylinder',
        lx: 0, ly: 0.5, lz: 0.04,
        sx: 0.03, sy: 0.8, sz: 0.03,
        color: metalColor,
      });
      break;
    }
    case 'hearth': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.1, lz: 0,
        sx: 0.54, sy: 0.2, sz: 0.54,
        color: '#4a4540',
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.22, lz: 0,
        sx: 0.3, sy: 0.08, sz: 0.1,
        color: '#362214',
      });
      parts.push({
        shape: 'flame',
        lx: 0, ly: 0.32, lz: 0,
        sx: 0.24, sy: 0.24, sz: 0.24,
        color: palette.flame,
      });
      break;
    }
    case 'pool': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.03, lz: 0,
        sx: 0.72, sy: 0.06, sz: 0.72,
        color: stoneColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.045, lz: 0,
        sx: 0.62, sy: 0.04, sz: 0.62,
        color: mixColor('#1a5a78', palette.accent, 0.4),
      });
      break;
    }
    case 'rubble': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.09, lz: 0,
        sx: 0.22, sy: 0.18, sz: 0.22,
        color: stoneColor,
      });
      parts.push({
        shape: 'box',
        lx: -0.1, ly: 0.06, lz: 0.08,
        sx: 0.15, sy: 0.12, sz: 0.15,
        rotOffset: 0.3,
        color: stoneColor,
      });
      parts.push({
        shape: 'octahedron',
        lx: 0.08, ly: 0.05, lz: -0.06,
        sx: 0.12, sy: 0.1, sz: 0.12,
        rotOffset: -0.4,
        color: stoneColor,
      });
      break;
    }
    case 'torch': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.6, lz: 0,
        sx: 0.05, sy: 0.28, sz: 0.05,
        color: '#2e2b2a',
      });
      parts.push({
        shape: 'flame',
        lx: 0, ly: 0.74, lz: 0,
        sx: 0.12, sy: 0.12, sz: 0.12,
        color: palette.flame,
      });
      break;
    }
    case 'candles': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.01, lz: 0,
        sx: 0.26, sy: 0.02, sz: 0.26,
        color: '#8a7b68',
      });
      parts.push({
        shape: 'cylinder',
        lx: -0.04, ly: 0.12, lz: 0,
        sx: 0.04, sy: 0.2, sz: 0.04,
        color: '#fcfaf2',
      });
      parts.push({
        shape: 'cylinder',
        lx: 0.04, ly: 0.09, lz: 0.03,
        sx: 0.04, sy: 0.14, sz: 0.04,
        color: '#fcfaf2',
      });
      parts.push({
        shape: 'flame',
        lx: -0.04, ly: 0.24, lz: 0,
        sx: 0.04, sy: 0.04, sz: 0.04,
        color: palette.flame,
      });
      parts.push({
        shape: 'flame',
        lx: 0.04, ly: 0.18, lz: 0.03,
        sx: 0.04, sy: 0.04, sz: 0.04,
        color: palette.flame,
      });
      break;
    }
    case 'chest': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.12, lz: 0,
        sx: 0.46, sy: 0.24, sz: 0.32,
        color: chestColor,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.28, lz: 0,
        sx: 0.46, sy: 0.08, sz: 0.32,
        color: mixColor(chestColor, '#ffffff', 0.08),
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.2, lz: -0.17,
        sx: 0.06, sy: 0.08, sz: 0.02,
        color: goldColor,
      });
      break;
    }
    case 'crates': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.2, lz: 0,
        sx: 0.4, sy: 0.4, sz: 0.4,
        color: woodColor,
      });
      parts.push({
        shape: 'box',
        lx: 0.24, ly: 0.14, lz: 0.1,
        sx: 0.28, sy: 0.28, sz: 0.28,
        rotOffset: 0.2,
        color: mixColor(woodColor, '#000000', 0.15),
      });
      break;
    }
    case 'pried-vault': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.27, lz: 0,
        sx: 0.54, sy: 0.54, sz: 0.54,
        color: '#3e4247',
      });
      parts.push({
        shape: 'box',
        lx: 0.2, ly: 0.27, lz: -0.3,
        sx: 0.5, sy: 0.5, sz: 0.06,
        rotOffset: 0.6,
        color: '#4b5057',
      });
      break;
    }
    case 'dropped-coins': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.01, lz: 0,
        sx: 0.15, sy: 0.02, sz: 0.15,
        color: goldColor,
      });
      parts.push({
        shape: 'box',
        lx: 0.08, ly: 0.01, lz: 0.06,
        sx: 0.12, sy: 0.02, sz: 0.12,
        color: goldColor,
      });
      parts.push({
        shape: 'box',
        lx: -0.06, ly: 0.01, lz: -0.08,
        sx: 0.1, sy: 0.02, sz: 0.1,
        color: goldColor,
      });
      break;
    }
    case 'snapped-bar': {
      parts.push({
        shape: 'cylinder',
        lx: -0.12, ly: 0.4, lz: 0,
        sx: 0.04, sy: 0.8, sz: 0.04,
        color: metalColor,
      });
      parts.push({
        shape: 'cylinder',
        lx: 0.12, ly: 0.4, lz: 0,
        sx: 0.04, sy: 0.8, sz: 0.04,
        color: metalColor,
      });
      parts.push({
        shape: 'cylinder',
        lx: -0.06, ly: 0.6, lz: 0,
        sx: 0.03, sy: 0.2, sz: 0.03,
        rotOffset: 0.4,
        color: metalColor,
      });
      parts.push({
        shape: 'cylinder',
        lx: 0.06, ly: 0.4, lz: 0,
        sx: 0.03, sy: 0.2, sz: 0.03,
        rotOffset: -0.4,
        color: metalColor,
      });
      break;
    }
    case 'tunnel-mouth': {
      parts.push({
        shape: 'box',
        lx: -0.34, ly: 0.4, lz: 0,
        sx: 0.12, sy: 0.8, sz: 0.3,
        color: palette.wall,
      });
      parts.push({
        shape: 'box',
        lx: 0.34, ly: 0.4, lz: 0,
        sx: 0.12, sy: 0.8, sz: 0.3,
        color: palette.wall,
      });
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.86, lz: 0,
        sx: 0.8, sy: 0.12, sz: 0.3,
        color: palette.wall,
      });
      break;
    }
    case 'trap': {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.01, lz: 0,
        sx: 0.46, sy: 0.02, sz: 0.46,
        color: mixColor(stoneColor, palette.accent, 0.3),
      });
      break;
    }
    default: {
      parts.push({
        shape: 'box',
        lx: 0, ly: 0.11, lz: 0,
        sx: 0.34, sy: 0.22, sz: 0.34,
        color: evidenceColor,
      });
      break;
    }
  }

  return parts.map((part) => ({
    shape: part.shape,
    instance: toGlobalPart(part, px, pz, rotRad, finalScale, detail),
  }));
}

// ============================================================================
// Scene construction
// ============================================================================
// The returned arrays are intentionally grouped by visual kind. The renderer turns each array
// into one instanced mesh, preserving the original draw-call budget even for large dungeons.
// ============================================================================

export function buildDungeonSceneModel(plan: DungeonPlan, options: DungeonSceneOptions): DungeonSceneModel {
  const palette = DUNGEON_3D_PALETTES[plan.params.theme];
  const roomLookup = roomIndexByCell(plan);
  const roomById = new Map(plan.rooms.map((room) => [room.id, room]));
  const floors: DungeonSceneInstance[] = [];
  const walls: DungeonSceneInstance[] = [];
  const wallCaps: DungeonSceneInstance[] = [];
  const liquids: DungeonSceneInstance[] = [];

  // Raise every walkable and wall cell from the shared bitmap. History overlays become a
  // separate shallow surface, allowing water, ice, bloom, and scorch to read in perspective.
  for (let y = 0; y < plan.H; y += 1) {
    for (let x = 0; x < plan.W; x += 1) {
      const index = y * plan.W + x;
      const cell = plan.grid[index];
      const position = cellToScene(plan, x, y);
      if (cell === CellKind.Floor) {
        const room = roomById.get(roomLookup[index]);
        floors.push({
          // Slightly overlapping slabs remove black seams at close range while the room/corridor
          // color difference still communicates navigation hierarchy.
          ...position, y: -0.055, sx: 1.005, sy: 0.11, sz: 1.005, rotation: 0,
          color: floorColor(plan, room, index, x, y, options, palette),
        });
        const overlay = plan.overlay[index] as OverlayKind;
        if (overlay !== OverlayKind.None && overlay !== OverlayKind.Rubble) {
          liquids.push({
            ...position, y: 0.018, sx: 0.96, sy: 0.035, sz: 0.96, rotation: 0,
            color: OVERLAY_COLORS[overlay],
          });
        }
      } else if (cell === CellKind.Wall) {
        const noise = coordinateNoise(plan.seed, x, y, 211);
        const height = 1.32 + noise * 0.42;
        walls.push({
          // Neighboring wall blocks overlap by a hair so the boundary reads as one built mass
          // instead of a row of disconnected voxel teeth. Lower walls reveal room interiors.
          ...position, y: height / 2, sx: 1.015, sy: height, sz: 1.015, rotation: 0,
          color: mixColor(palette.wall, palette.wallCap, noise * 0.32),
        });
        wallCaps.push({
          // A thin pale cap strengthens the plan silhouette and exposes theme color without
          // changing collision, door placement, or the generator bitmap beneath it.
          ...position, y: height + 0.035, sx: 1.035, sy: 0.07, sz: 1.035, rotation: 0,
          color: mixColor(palette.wallCap, palette.accent, noise * 0.12),
        });
      }
    }
  }

  const doors: DungeonSceneDoor[] = plan.doors
    .filter((door) => door.state !== 'open')
    .map((door) => {
      const position = cellToScene(plan, door.cell.x, door.cell.y);
      const bricked = door.state === 'bricked';
      return {
        ...position,
        y: bricked ? 0.9 : 0.68,
        sx: bricked ? 0.94 : 0.72,
        sy: bricked ? 1.8 : 1.34,
        sz: bricked ? 0.32 : 0.16,
        rotation: doorRotation(plan, door.cell.x, door.cell.y),
        color: bricked ? '#713e34' : door.state === 'secret' ? palette.wallCap : '#6f4930',
        state: door.state,
      };
    });

  const lowProps: DungeonSceneInstance[] = [];
  const tallProps: DungeonSceneInstance[] = [];
  const evidence: DungeonSceneInstance[] = [];
  const flames: DungeonSceneInstance[] = [];

  const propBoxes: DungeonSceneInstance[] = [];
  const propCylinders: DungeonSceneInstance[] = [];
  const propCones: DungeonSceneInstance[] = [];
  const propSpheres: DungeonSceneInstance[] = [];
  const propOctahedrons: DungeonSceneInstance[] = [];
  const propFlames: DungeonSceneInstance[] = [];

  // Props arrive in feet, so convert them back to scene cells only at this presentation seam.
  for (const prop of plan.props) {
    const position = cellToScene(plan, prop.x / plan.cellFt, prop.y / plan.cellFt);
    const dimensions = propDimensions(prop.kind, Math.max(0.65, prop.scale));
    const shape = propShape(prop.kind);
    const hasHistoryReference = prop.eventRef !== undefined;
    const lodRoll = coordinateNoise(
      plan.seed,
      Math.round(prop.x / plan.cellFt),
      Math.round(prop.y / plan.cellFt),
      911,
    );
    const detail = isTacticalDetail(prop.kind, shape, dimensions, hasHistoryReference, lodRoll);
    const visualKind = classifyPropKind(prop.kind);
    const instance: DungeonSceneInstance = {
      ...position,
      y: dimensions.y,
      sx: dimensions.sx,
      sy: dimensions.sy,
      sz: dimensions.sz,
      rotation: prop.rot * Math.PI / 180,
      ...(detail ? { detail: true as const } : {}),
      color: propColor(prop.kind, shape, palette, hasHistoryReference),
      visualKind,
      eventRef: prop.eventRef,
    };
    if (shape === 'flame') flames.push(instance);
    else if (shape === 'tall') tallProps.push(instance);
    else if (shape === 'evidence') evidence.push(instance);
    else lowProps.push(instance);

    const decomposed = decomposeProp(
      prop.kind,
      position.x,
      position.z,
      prop.rot * Math.PI / 180,
      Math.max(0.65, prop.scale),
      hasHistoryReference,
      palette,
      detail,
    );

    for (const part of decomposed) {
      if (part.shape === 'box') propBoxes.push(part.instance);
      else if (part.shape === 'cylinder') propCylinders.push(part.instance);
      else if (part.shape === 'cone') propCones.push(part.instance);
      else if (part.shape === 'sphere') propSpheres.push(part.instance);
      else if (part.shape === 'octahedron') propOctahedrons.push(part.instance);
      else if (part.shape === 'flame') propFlames.push(part.instance);
    }
  }

  const spawns = plan.spawns.map((spawn) => {
    const position = cellToScene(plan, spawn.x / plan.cellFt, spawn.y / plan.cellFt);
    const room = roomById.get(spawn.roomId);
    return {
      // Encounter cones are an optional inspection overlay, so bias them larger than physical
      // creature scale; they must remain legible from the whole-plan tactical camera.
      ...position, y: 0.66, sx: 0.58, sy: 1.18, sz: 0.58, rotation: 0,
      color: room?.type === 'boss' ? '#ff405c' : room?.type === 'elite' ? '#ff8d45' : '#c94b54',
    };
  });

  // Flat luminous discs anchor every encounter to its floor cell. Cones alone disappeared
  // against wall silhouettes at tactical range; the second instanced layer costs one draw.
  const spawnHalos = spawns.map((spawn) => ({
    ...spawn,
    y: 0.035,
    sx: 1.05,
    sy: 0.045,
    sz: 1.05,
  }));

  const lines = plan.edges.map((edge): DungeonSceneLine => {
    const a = roomCenter(plan, roomById.get(edge.a)!);
    const b = roomCenter(plan, roomById.get(edge.b)!);
    return {
      ax: a.x, az: a.z, bx: b.x, bz: b.z,
      color: edge.isCritical ? '#ff5c5c' : edge.isLoop ? '#2ee5eb' : '#8fb1cf',
      kind: edge.isCritical ? 'critical' : edge.isLoop ? 'loop' : 'graph',
    };
  });

  const entranceRoom = roomById.get(plan.entranceId)!;
  const bossRoom = roomById.get(plan.bossId)!;
  const entrance = roomCenter(plan, entranceRoom);
  const boss = roomCenter(plan, bossRoom);
  const markers: DungeonSceneMarker[] = [
    {
      ...entrance,
      radius: Math.max(3, Math.max(entranceRoom.w, entranceRoom.h) / plan.cellFt / 2),
      color: '#62d7ff',
      label: 'Entrance',
    },
    {
      ...boss,
      radius: Math.max(3, Math.max(bossRoom.w, bossRoom.h) / plan.cellFt / 2),
      color: '#ff526d',
      label: 'Objective',
    },
  ];
  const bounds = sceneBounds([...floors, ...walls]);

  return {
    width: plan.W,
    depth: plan.H,
    bounds,
    palette,
    floors,
    walls,
    wallCaps,
    liquids,
    doors,
    lowProps,
    tallProps,
    evidence,
    flames,
    propBoxes,
    propCylinders,
    propCones,
    propSpheres,
    propOctahedrons,
    propFlames,
    spawns,
    spawnHalos,
    lines,
    markers,
    lights: selectAccentLights(flames, palette.flame),
  };
}
