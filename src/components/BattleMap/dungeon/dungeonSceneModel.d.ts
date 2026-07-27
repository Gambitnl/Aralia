/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 13:15:53
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import { type DoorState, type DungeonPlan, type DungeonTheme, type RoomPurpose } from '../../../systems/worldforge/dungeon/types';
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
    /** Source room metadata carried through for deterministic purpose-aware presentation. */
    roomId?: number;
    roomPurpose?: RoomPurpose;
    /** True only for a non-interactive landmark derived from the room's declared purpose. */
    purposeLandmark?: true;
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
    /** Half-ring doorway heads, kept separate because the renderer uses real curved geometry. */
    arches: DungeonSceneInstance[];
    /** Permanent structural pieces; unlike room props, architecture never follows the prop toggle. */
    architectureBoxes: DungeonSceneInstance[];
    architectureCylinders: DungeonSceneInstance[];
    architectureCones: DungeonSceneInstance[];
    architectureSpheres: DungeonSceneInstance[];
    architectureOctahedrons: DungeonSceneInstance[];
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
    lights: Array<{
        x: number;
        y: number;
        z: number;
        color: string;
        roomId?: number;
        roomPurpose?: RoomPurpose;
    }>;
}
export interface DungeonSceneOptions {
    showRoomTypes: boolean;
    showDifficulty: boolean;
    showCritical: boolean;
}
export declare const DUNGEON_3D_PALETTES: Record<DungeonTheme, DungeonScenePalette>;
export type RoomPurposeLandmark = 'threshold-steps' | 'ritual-dais' | 'burial-bays' | 'secure-store' | 'work-gantry' | 'occupied-hall' | 'service-bench' | 'water-basin';
export interface RoomPurposeReadability {
    landmark: RoomPurposeLandmark | null;
    definingProps: readonly DungeonPropVisualKind[];
    lightPriority: 0 | 1 | 2 | 3;
}
export declare const ROOM_PURPOSE_READABILITY: Readonly<Record<RoomPurpose, RoomPurposeReadability>>;
/** Return the renderer-only treatment for one authoritative room purpose. */
export declare function roomPurposeReadability(purpose: RoomPurpose): RoomPurposeReadability;
export type DungeonPropVisualKind = 'sarcophagus' | 'disturbed-lid' | 'pew' | 'bone-niche' | 'bones' | 'altar' | 'spore-shelf' | 'stone-slab' | 'stalagmite' | 'mushroom' | 'bunk' | 'tool-rack' | 'nest' | 'hoist-wheel' | 'iceshard' | 'long-table' | 'grain-jar' | 'weapon-rack' | 'hearth' | 'pool' | 'rubble' | 'torch' | 'candles' | 'chest' | 'crates' | 'pried-vault' | 'dropped-coins' | 'snapped-bar' | 'tunnel-mouth' | 'trap' | 'default';
/**
 * Classifies a raw prop kind string into a semantic visual category.
 */
export declare function classifyPropKind(kind: string): DungeonPropVisualKind;
/**
 * Decomposes a single high-level dungeon prop into its primitive geometric components.
 */
export declare function decomposeProp(kind: string, px: number, pz: number, rotRad: number, scale: number, hasHistory: boolean, palette: DungeonScenePalette, detail: boolean): Array<{
    shape: string;
    instance: DungeonSceneInstance;
}>;
export declare function buildDungeonSceneModel(plan: DungeonPlan, options: DungeonSceneOptions): DungeonSceneModel;
