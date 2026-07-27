/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 19:30:19
 * Dependents: components/World3D/InteriorHourContext.tsx, systems/world3d/buildingSceneModel.ts, systems/world3d/types.ts, systems/worldforge/bridge/buildingHistoryParts.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/sitePartTransform.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file interiorParts.ts — canonical building blueprint → renderable parts.
 *
 * Turns a BlueprintPlan (plot-local FEET, street wall at y=0) into a list of
 * site-local boxes in METERS that the 3D scene renders inside a building's
 * group: thickness-true walls, real door and window openings, every floor and
 * basement, furnishing blocks, and optional occupant figures. The bridge reads
 * the same rich plan as occupancy and building previews, so irregular rooms
 * cannot collapse into bounding boxes on a hidden fallback path.
 * Styled blueprints also carry their resolved regional wall material and an
 * additive facade grammar (courses, bays, half-timbering, or log bands). Those
 * details sit outside the structural wall boxes, so they never close a door,
 * fill a window, or move the permanent plan. Larger role motifs use that same
 * additive path for signs, vents, porches, bell-cotes, and defensive details.
 *
 * Frame: x = centered frontage meters (matching the renderer group's +x
 * along the footprint's 0→1 edge). z = centered DEPTH meters with +z
 * pointing INWARD (away from the street). The renderer flips z by the
 * site's doorZSign so the street wall lands on the correct face of the
 * rotated group — same convention the exterior door mesh already uses.
 */
import { type InteriorPlotInput } from '../interior/generateInterior';
import type { BuildingMotif, BuildingHistoryFeature, BuildingLiveHistoryFeature, BlueprintPlan } from '../interior/blueprintTypes';
import type { SeedPath } from '../seedPath';
import { type MaterialDetailKind } from './buildingMaterialParts';
import { type WeatheringDetailKind } from './buildingWeatheringParts';
import { type EnsembleDetailKind } from './buildingEnsembleParts';
export { MOTIF_PART_TAG } from './buildingMotifParts';
export { HISTORY_PART_TAG } from './buildingHistoryParts';
export { MATERIAL_PART_TAG } from './buildingMaterialParts';
export { WEATHERING_PART_TAG } from './buildingWeatheringParts';
export { ENSEMBLE_PART_TAG } from './buildingEnsembleParts';
/** One renderable box, site-local meters (y sits on the ground). */
export interface SitePart {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    colorHex: string;
    /**
     * Tactical-only parts remain authoritative for combat extraction but are
     * omitted by 3D renderers. Row blocks use this to keep each home enclosed
     * without drawing two structural walls at one shared lot boundary.
     */
    renderRole?: 'tactical-only';
    /** Base elevation in meters (default 0 = on the floor). Lets a part float
     * above the ground — e.g. an occupant's head atop their body. */
    baseY?: number;
    /** When set, the renderer lights this part's material with this emissive hex
     * (a warm glow). Drives the LIVING overlay's lit hearth (BGv2 Task 14): the
     * hearth furnishing glows after dusk when the family is home. */
    emissiveHex?: string;
    /** Optional classification tag. ROOF_PART_TAG marks the solved-roof dressing
     * (chimney flues, dormer masses) so consumers/tests can separate roof parts
     * from the wall/floor structure without a color sniff (BGv2 Task 5). */
    tag?: string;
    /** Exact exterior motif represented by this additive part. */
    motifKind?: BuildingMotif;
    /** Exact permanent-history fact represented by this additive part. */
    historyKind?: BuildingHistoryFeature['kind'] | BuildingLiveHistoryFeature['kind'];
    /** Exact physical construction detail represented by this additive part. */
    materialDetailKind?: MaterialDetailKind;
    /** Exact age/exposure mark represented by this presentation-only part. */
    weatheringDetailKind?: WeatheringDetailKind;
    /** Exact block-level row or arcade cue represented by this additive part. */
    ensembleDetailKind?: EnsembleDetailKind;
    /** When set, this part is a live-lit surface the renderer drives from the
     * building's hourly schedule: 'window' glass or the 'hearth' fire. Set
     * UNCONDITIONALLY at bake (independent of any hour) so the renderer can find
     * and toggle it. Replaces the old bake-time emissiveHex on these parts. */
    lightRole?: 'window' | 'hearth';
}
/** Tag stamped on solved-roof dressing parts (chimney/dormer boxes). */
export declare const ROOF_PART_TAG = "roof";
/** Tag stamped on additive exterior trim generated from a facade grammar. */
export declare const FACADE_PART_TAG = "facade";
/** The triangulated solved roof (planes + tower caps) as ONE geometry group,
 *  site-local METERS, ready for a single BufferGeometry. Separate from the box
 *  `parts` because roof planes are arbitrary triangles, not axis-aligned boxes
 *  (BGv2 Task 5). Absent when the plan carries no solved roof. */
export interface RoofPartGroup {
    positions: Float32Array;
    indices: Uint32Array;
    normals: Float32Array;
    /** Resolved roof tint (plan.styleResolved.roofColor). */
    colorHex: string;
}
/** Interior wall color (lime-washed plaster). */
export declare const INTERIOR_WALL_COLOR = "#cfc7b8";
/** Door leaf tint (stained timber) — dresses the entry gap so it reads as a
 * real door rather than a bare punched-out hole (IN1). */
export declare const DOOR_LEAF_COLOR = "#4a3220";
/** Lintel beam tint above the entry door. */
export declare const DOOR_LINTEL_COLOR = "#6b4a30";
/** Window pane tint (dark glazed glass) set into perimeter walls (IN1). */
export declare const WINDOW_PANE_COLOR = "#2f3a4d";
/** Ceiling slab tint for single-storey interiors so they stay enclosed (IN2).
 * Matches the floor plank so a one-room interior reads as a finished box. */
export declare const CEILING_COLOR = "#8c7d68";
/** Exterior (perimeter) wall tint by plot role — keeps the market/house
 * identity the solid shells used to carry. */
export declare const PERIMETER_WALL_COLORS: Record<string, string>;
export declare const FURNITURE: Record<string, {
    w: number;
    d: number;
    h: number;
    colorHex: string;
}>;
/**
 * Resolve a furnishing kind to its 3D box spec. Throws on an unknown kind
 * rather than silently dropping the piece from the scene (no-fallback). The
 * FURNISHING_RECIPE_KINDS coverage test guarantees every emitted kind resolves,
 * so this throw fires only when a new generator kind lands without a render spec.
 */
export declare function furnishingSpec(kind: string): {
    w: number;
    d: number;
    h: number;
    colorHex: string;
};
/** Stair flight tint (worn timber). */
export declare const STAIR_COLOR = "#7a5a36";
/** Warm emissive tint painted on a LIT hearth's furnishing box. */
export declare const HEARTH_GLOW_HEX = "#ff8a3c";
/** Warm emissive tint painted on window panes when the building is lit from
 * within at dusk/night (interior-lighting slice). Slightly lighter/cooler than
 * the hearth glow so a lit window reads as lamplight spilling through glass
 * rather than an open flame. Emissive-only — the pane itself glows; no light is
 * cast, so this reads town-wide from the street at zero light cost. */
export declare const WINDOW_GLOW_HEX = "#ffb066";
/**
 * Render-ready body for one occupant, in METERS + hex — the projection of the
 * parametric BodyPlan (BODY-1, body/generateBody) the figure renderer needs.
 * Kept structural (no BodyPlan import) so this module stays decoupled from the
 * roster/body data types; the bridge maps BodyPlan → OccupantBody at the call
 * site.
 */
export interface OccupantBody {
    /** Total standing height (heel to crown), meters. */
    heightM: number;
    /** Shoulder width → body box width, meters. */
    shoulderWidthM: number;
    /** Torso depth (front-to-back) → body box depth, meters. */
    depthM: number;
    /** Head height (chin to crown) → head box, meters. */
    headSizeM: number;
    skinToneHex: string;
    clothingHex: string;
}
/** Minimal occupant view (structural — avoids coupling to roster types). */
export interface OccupantFigure {
    id: number;
    ageBand: 'child' | 'adult' | 'elder';
    /** Standing at their work plot (front-of-house) vs at home (back half). */
    atWork?: boolean;
    /** Parametric body (BODY-1): per-person proportions + palette. Required —
     * every roster occupant has an identity, so there is one real path and no
     * fallback to uniform crates. */
    body: OccupantBody;
    /** LIVING overlay station (BGv2 Task 14): the exact PLAN-FEET position + floor
     * this figure stands at for the current game hour, from occupancy.ts (via the
     * bridge's occupancyForPlot). When present it OVERRIDES the room-cycling
     * heuristic below, so a figure lands at its real station — the smith at the
     * forge, a sleeper at their bed. Feet in the blueprint frame (0 = min corner),
     * mapped through the same toX/toZ as every other part. */
    station?: {
        xFt: number;
        yFt: number;
        level: number;
    };
}
/**
 * Wall envelope (in METERS — the footprint the renderer must fit roofs/floors
 * to; the plot footprint is up to 5 ft larger per axis, and sizing roofs to it
 * caused the floating-sombrero look, shots 1–2 of Remy's 2026-06-12 review)
 * AND interior parts, from one canonical blueprint. The 3D bake needs both per
 * plot, so production can supply the blueprint its load packet already resolved
 * and this function threads that exact instance through structure, furnishing,
 * and roof projection. Standalone callers keep the established resolver path.
 */
export declare function buildInterior(plot: InteriorPlotInput, seedPath: SeedPath, shellHeightM: number, occupants?: OccupantFigure[], hearthLit?: boolean, litWindows?: boolean, precomputedBlueprint?: BlueprintPlan): {
    envelope: {
        wallWidthM: number;
        wallDepthM: number;
        siteOriginXFt?: number;
        siteOriginYFt?: number;
    };
    parts: SitePart[];
    roof?: RoofPartGroup;
};
/**
 * Blueprint → structure parts PLUS the solved roof (BGv2 Task 5). When the plan
 * carries `plan.roof` (populated only when a StyleContext was resolved), this
 * raises the solved roof on top of the wall-true structure:
 *   - `roof`: the triangulated roof planes + tower cap fans as ONE geometry
 *     group in site-local meters, colored `plan.styleResolved.roofColor`.
 *   - chimney flues (trim color) and dormer masses (roof color) as tagged
 *     SiteParts appended to `parts`.
 * When `plan.roof` is absent the structure walk is UNCHANGED and `roof` is
 * undefined — a roofless plan is byte-identical to the pre-Task-5 output.
 *
 * Structure parts are byte-stable either way: the roof arrives as a separate
 * group + dressing, never perturbing the wall/floor/stair boxes.
 */
export declare function buildBlueprintParts(bp: BlueprintPlan, storeyHeightM: number, perimeterColor: string, litWindows?: boolean): {
    parts: SitePart[];
    roof?: RoofPartGroup;
};
export declare function buildInteriorParts(plot: InteriorPlotInput, seedPath: SeedPath, shellHeightM: number, occupants?: OccupantFigure[], precomputedBlueprint?: BlueprintPlan, _hearthLit?: boolean, litWindows?: boolean): SitePart[];
