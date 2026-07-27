/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 18:16:44
 * Dependents: components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DScene.tsx, systems/world3d/buildingSceneModel.ts, systems/worldforge/bridge/interiorParts.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file buildingModels.ts
 * Procedural roof-form geometry for styled town buildings (2026-07-01).
 * Origin at the roof BASE center; walls place it at wall-top Y. Plain arrays
 * so the React layer wraps them in BufferGeometry (memoized per form+dims).
 */
import type { ChunkGeometryArrays } from './types';
import type { RoofForm } from '../worldforge/town/architectureStyle';
import type { BlueprintPlan, Cell, RoofPlan } from '../worldforge/interior/blueprintTypes';
export declare function buildRoofGeometry(form: RoofForm, width: number, depth: number, rise: number): ChunkGeometryArrays;
/** Default storey height, feet (callers may override to fit a shell). */
export declare const BLUEPRINT_STOREY_FT = 10;
export type MeshBoxKind = 'wall' | 'jamb' | 'door-lintel' | 'sill' | 'window-head' | 'window-pane' | 'floor' | 'ceiling' | 'stair' | 'chimney' | 'dormer';
/** One axis-aligned box in PLAN FEET: x/y = footprint center (blueprint
 *  frame, origin at the footprint's 0,0 corner), w/d = extents, z0/h =
 *  vertical base + height (z0 < 0 for basement geometry). */
export interface MeshBox {
    kind: MeshBoxKind;
    /** For wall-derived boxes: which wall family the box belongs to. */
    wallKind?: 'outer' | 'inner';
    /** For wall-derived boxes: the run's outward normal (see WallRun.nx/ny). */
    nx?: number;
    ny?: number;
    x: number;
    y: number;
    w: number;
    d: number;
    z0: number;
    h: number;
}
export interface BuildingFloorMeshData {
    level: number;
    /** Slab base elevation, feet ( = level * storeyHeightFt). */
    baseZFt: number;
    /** Number of merged outer wall RUNS on this floor (NOT 5 ft fragments). */
    outerWallSegments: number;
    /** Number of merged inner wall RUNS on this floor. */
    innerWallSegments: number;
    /** Door openings cut into this floor's walls ( = plan doors). */
    doorOpenings: number;
    /** Window voids cut into this floor's walls ( = plan windows). */
    windowOpenings: number;
    /** Footprint cells SKIPPED in this level's floor slab so the stair from
     *  the level below rises through. Empty when nothing joins from below. */
    stairHoleCells: Cell[];
    boxes: MeshBox[];
}
export interface BuildingMeshData {
    storeyHeightFt: number;
    floors: BuildingFloorMeshData[];
}
/** Build the render-ready box list for one BlueprintPlan. Pure + deterministic. */
export declare function buildBuildingMeshData(plan: BlueprintPlan, opts?: {
    storeyHeightFt?: number;
}): BuildingMeshData;
export interface RoofMeshData {
    /** Triangulated roof planes + tower cap fans, Y = wallTopFt + plane z. */
    tris: ChunkGeometryArrays;
    /** Masonry flues, PLAN FEET, z0 < top = wallTopFt + chimney.topFt. */
    chimneyBoxes: MeshBox[];
    /** Gablet masses seated on the slope, carrying the piercing plane's normal. */
    dormerBoxes: MeshBox[];
}
/** Exact replay targets that physically alter the solved roof triangle mesh. */
export interface RoofMeshDeformation {
    holes: Array<{
        planeIndex: number;
        x: number;
        y: number;
        radiusFt: number;
    }>;
    sags: Array<{
        ridgeIndex: number;
        deflectionFt: number;
    }>;
}
/**
 * Translate permanent and chronological history into one mesh contract shared
 * by the preview and production bridge. Repeated sag targets retain the deepest
 * deflection, so an old dip and later ruin cannot double-count displacement.
 */
export declare function roofDeformationForPlan(plan: BlueprintPlan): RoofMeshDeformation;
/**
 * Roof plan → pure render data (triangles + chimney/dormer boxes), PLAN FEET,
 * z lifted by wallTopFt. Deterministic.
 */
export declare function buildRoofMeshData(roof: RoofPlan, wallTopFt: number, deformation?: RoofMeshDeformation): RoofMeshData;
