/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 00:20:47
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, components/DesignPreview/steps/PreviewBuilding3D.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file buildingSceneModel.ts
 * @description Pure blueprint → render-ready 3D scene model for the design
 * preview's blueprint viewer (PreviewBuilding3D).
 *
 * Takes the SAME BlueprintPlan the 2D drawer renders and resolves everything
 * the R3F component needs into plain data: the MeshBox list from
 * `buildBuildingMeshData` filtered by FLOOR PEEL (show basement..selected,
 * open-topped), colors + emissive resolved per box kind and hour, plus one
 * occupant dot per at-home household member at the given hour (furnishing
 * position when the station stands at a piece, else the room's anchor cell).
 *
 * Two DELIBERATELY DISTINCT lighting schedules meet here (see the block near
 * `windowsLit`/`hearthLit` for the full rationale):
 *   - Window panes glow on the canonical `windowsLitAt` dusk-read band (17–23h)
 *     — "does the interior read as lit from OUTSIDE against a dim exterior."
 *   - Hearth furnishings glow on `occupancy.flags.hearthLitHours[hour]`
 *     (06–08 ∪ 17–22) — "is the fire physically BURNING" (morning cook-fire +
 *     evening warmth).
 * They intentionally disagree at the day's edges (lit morning hearth behind
 * daylit windows at 06–08; interior still reads lit at 23 after the fire is
 * banked). That is modeled, not a bug — confirmed by blindspot #7.
 *
 * Pure + deterministic — no three.js, unit-tested in
 * __tests__/buildingSceneModel.test.ts. The R3F consumer maps plan feet
 * (x, y, z0/h) onto three space as (x, z, y) and renders in feet.
 */
/**
 * ARCHITECTURAL COMMENTARY:
 * WHAT CHANGED: Added support for rendering resolved architectural identity dressing
 * (materials, facade trim, motifs, weathering, and permanent history) in the lab's 3D pane.
 * Overrode outer wall box colors with styleResolved.wallColor.
 * WHY: The Building Identity Lab must render the actual production 3D parts to honestly
 * prove the procedural generation layer instead of rendering a flat tan box mockup.
 * WHAT WAS PRESERVED: Legacy plans without styleResolved remain a strict no-op, preserving
 * the original v1 colors and layout. Structural geometry remains completely untouched, as pinned
 * by invariants tests. Floor peel, window lighting, and hearth glowing schedules remain fully intact.
 * WHAT REMAINS DEFERRED: The 2D vs 3D climate parity roof seam, town-map selection behavior,
 * and streamed production ground pipeline details remain deferred to separate repair/feature lanes.
 */
import type { BlueprintPlan } from '../worldforge/interior/blueprintTypes';
import type { BuildingOccupancy, OccupantStation } from '../worldforge/interior/occupancy';
import type { WeatheringDetailKind } from '../worldforge/bridge/buildingWeatheringParts';
import { type MeshBoxKind } from './buildingModels';
/** 'all' = every floor closed; a level = show basement..level, open-topped. */
export type PeelLevel = number | 'all';
export type SceneBoxKind = MeshBoxKind | 'hearth' | 'history-scorch' | 'history-board' | 'history-phase' | 'history-roof-hole' | 'history-ruin-sag' | 'construction-material' | 'facade-trim' | 'motif' | 'weathering' | 'permanent-history';
/** The solved roof as a triangle group, PLAN FEET (x/y footprint, Y up = z0).
 *  Present only when plan.roof exists and the model is NOT peeled (roof shows in
 *  the viewer's "All" mode; floor-peel hides it). BGv2 Task 5. The R3F consumer
 *  maps positions [x, Y, z] straight into three space (Y already includes the
 *  wall top). */
export interface SceneRoof {
    positions: Float32Array;
    indices: Uint32Array;
    normals: Float32Array;
    /** Planar footprint coordinates used to repeat resolved covering textures. */
    uvs: Float32Array;
    color: string;
}
/** One renderable box, PLAN FEET (x/y footprint center, z0/h vertical). */
export interface SceneBox {
    kind: SceneBoxKind;
    /** Plan level the box belongs to (-1 basement, 0 ground, 1+ upper). */
    level: number;
    x: number;
    y: number;
    w: number;
    d: number;
    z0: number;
    h: number;
    color: string;
    /** Set only when the box should glow (lit window pane / lit hearth). */
    emissive?: string;
    emissiveIntensity?: number;
    /** Exact weathering effect carried from the production bridge. */
    weatheringDetailKind?: WeatheringDetailKind;
}
/** One at-home household member at the model's hour. */
export interface OccupantDot {
    memberIndex: number;
    level: number;
    activity: OccupantStation['activity'];
    /** Plan feet. */
    x: number;
    y: number;
    /** Dot CENTER elevation, feet ( = level * storey + 2.5). */
    zFt: number;
    color: string;
}
export interface BuildingSceneModel {
    widthFt: number;
    depthFt: number;
    storeyHeightFt: number;
    /** True when window panes glow at this hour ( = occupied ∧ hour ∈ 17–23). */
    windowsLit: boolean;
    boxes: SceneBox[];
    dots: OccupantDot[];
    /** One shared semantic key per exterior surface, resolved from the generator's
     *  final construction kit. Kept at model level so renderers never allocate a
     *  separate texture for every wall box. */
    materialTextures?: {
        wall: string;
        roof: string;
    };
    /** Solved roof (planes + tower caps), shown in "All" mode; hidden when peeled
     *  so the interior is visible. Undefined when the plan carries no roof. */
    roof?: SceneRoof;
}
export interface BuildingSceneOptions {
    upToLevel: PeelLevel;
    /** 0–23. */
    hour: number;
    /** The page's matched occupancy for the plan; omit for a bare building. */
    occupancy?: BuildingOccupancy;
}
/** Occupant dot radius, feet (shared with the R3F consumer). */
export declare const DOT_RADIUS_FT = 0.9;
/** Dot CENTER height above the floor slab, feet — above furniture masses
 *  (hearth boxes are 3 ft tall) so a dot at a furnishing stays visible. */
export declare const DOT_LIFT_FT = 3.6;
/** One material tile spans one blueprint cell, keeping courses readable without moire. */
export declare const ROOF_TEXTURE_TILE_FT = 5;
/** Project each solved roof vertex onto the plan footprint for stable tiled UVs. */
export declare function planarRoofUvs(positions: Float32Array, tileSizeFt?: number): Float32Array;
/** Build the render-ready scene model. Pure + deterministic. */
export declare function buildingSceneModel(plan: BlueprintPlan, opts: BuildingSceneOptions): BuildingSceneModel;
