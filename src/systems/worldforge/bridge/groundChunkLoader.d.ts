/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 18/07/2026, 21:55:11
 * Dependents: components/Combat/InPlaceCombatScene.tsx, components/World3D/DungeonEntrances.tsx, components/World3D/GroundAgents.tsx, components/World3D/GroundMovePlane.tsx, components/World3D/GroundProps.tsx, components/World3D/PlayerAvatar.tsx, components/World3D/WebGPUProbe.tsx, components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/canopyInterior.ts, components/World3D/combat/InPlaceCombatLayer.tsx, components/World3D/createGroundWorkerChunkLoader.ts, components/World3D/createWorldGenClient.ts, components/World3D/groundChunkWorker.ts, components/World3D/worldGenCore.ts, components/Worldforge/AgentSim3DPreview.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx, systems/combat/worldScenario/liveSettlementEncounter.ts, systems/combat/worldScenario/statePatrolWorldEvent.ts, systems/combat/worldScenario/travelAmbushBattlefield.ts, systems/combat/worldScenario/worldBattleScenario.ts, systems/worldforge/bridge/dungeonEntrances.ts, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/groundChunkWorkerCore.ts, systems/worldforge/bridge/groundHostiles.ts, systems/worldforge/bridge/groundProps.ts, systems/worldforge/provenance/groundProvenance.ts
 * Imports: 49 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file groundChunkLoader.ts â€” walking-scale ChunkData producer + loader for
 * Worldforge ground mode (slice 3b of Azgaar â†’ submap â†’ 3D world mode).
 *
 * KEY INSIGHT (replaces the planned coords.ts refactor): the world3d
 * geometry/bundle/streamer layers are SCALE-FREE â€” chunkGeometry spaces
 * vertices by CHUNK_WORLD_SIZE and maps height 0..100 â†’ meters via
 * heightToMeters; only chunkSampler's grid math bakes in the continent
 * METERS_PER_CELL (1024). So ground mode needs no core surgery: this module
 * samples chunks at GROUND scale (one LocalArtifact cell = 5 ft = 1.524 m)
 * and hands them to the SAME buildChunkBundle. The streamer, LOD and scene
 * consume the result unchanged.
 *
 * Coverage: a LocalArtifact spans 600 Ã— 1.524 m = 914.4 m â‰ˆ 7.14 chunks per
 * axis (CHUNK_WORLD_SIZE = 128 m). Vertices beyond the artifact clamp to its
 * edge values (flat continuation), mirroring chunkSampler's clamping.
 */
import type { ChunkData, ChunkMeshBundle, VegetationScatter, LodTier, BuildingOccupantRender } from "../../world3d/types";
import type { LocalArtifact, RegionArtifact, RegionCrossing, RegionTownSite, RegionRoad } from "../artifacts";
import type { AdaptedTownPlan } from "../town/townPlanAdapter";
import type { TownPlan } from "../artifacts";
import { type SitePart } from "./interiorParts";
import { type ActivityKind } from "../roster/occupantSchedule";
import type { TownRoster } from "../roster/types";
import { type HiddenPlaceKind } from "../discovery/hiddenPlaces";
import type { WorldDelta } from "../delta/types";
import { type StyleFamily, type GatehouseForm } from "../town/architectureStyle";
import type { BuildingEnsemble, BuildingEventLogsByBurg } from "../interior/blueprintTypes";
import type { WorldBusiness } from "../../../types/business";
import type { RichNPC } from "../../../types/world";
import type { BattleMapBiome, BattleMapData } from "@/types/combat";
import type { PropInstance } from "../props/propSchema";
import type { EntranceKind } from "../dungeon/world/dungeonSites";
import type { ForestKind } from "../forests/forestClusters";
import { type TerrainTerraceReceipt } from "./terrainTerraces";
import { type GroundSettlementDefense } from "./settlementDefense";
import { type FarShells } from "./farShells";
/** A polyline in ground world-meters with a uniform width (meters). */
export interface GroundPolyline {
    points: Array<{
        x: number;
        z: number;
    }>;
    widthM: number;
    /** Source role retained so tactical crops can distinguish routes from streets. */
    sourceKind?: "region-road" | "town-street" | "river";
    /** Stable Region route/river id when this run descends from one. */
    sourceId?: number;
    /** Optional tint (e.g. town-wall runs carry the style family's wallTint). */
    colorHex?: string;
    /**
     * River-only surface height at every centerline point, in world meters.
     * This is computed once from the carved bed and shared by rendering and
     * crossing placement; roads and walls intentionally leave it absent.
     */
    waterlineY?: number[];
}
export declare const GROUND_RIVER_CHANNEL_DEPTH_M = 0.5;
/** A filled town water body (river channel / harbour apron), ground meters. */
export interface GroundWaterBody {
    pointsM: Array<{
        x: number;
        z: number;
    }>;
    /** Flat water-surface Y in world meters (set by the terrain-carve pass). */
    surfaceY: number;
}
/** A dock pier / bridge span deck (convex quad), ground meters. */
export interface GroundDeck {
    cornersM: Array<{
        x: number;
        z: number;
    }>;
    /** Deck-top Y in world meters, just above the adjacent water (carve pass). */
    topY: number;
    /**
     * Civic role of the deck (TG5). Carried from the canonical plan's civic kind so
     * the 3D renderer can tint a weathered-timber quay distinctly from a lighter
     * bridge span — they must not share one identical slab material. Ford
     * crossings ride the same seam: `ford` is the wet gravel bar of the crossing
     * and `fordStone` its individual stepping stones (matching the 2D painter's
     * submerged-causeway-plus-stones language).
     */
    kind: "dock" | "bridge" | "ford" | "fordStone";
    /**
     * Style-family deck detailing (piling spacing / railing / bridge-arch rise),
     * stamped from the burg's architecture family so a coastal-timber quay and a
     * highland-stone bridge read differently in 3D.
     */
    detail?: {
        pilingSpacingM: number;
        railing: boolean;
        archRiseM: number;
    };
    /** Links regional bridge geometry back to the crossing receipt. */
    sourceCrossingId?: string;
    /**
     * Optional per-deck tint override (0..1 RGB). Ford causeway strips use it to
     * darken as they submerge (wet→dry gradient) and stones to break the
     * rivet-line uniformity; absent decks fall back to their kind color.
     */
    color?: [number, number, number];
}
/** Ground-meter projection of one Region crossing receipt. */
export interface GroundCrossing {
    id: string;
    kind: "bridge" | "ford";
    xM: number;
    zM: number;
    roadDirection: {
        x: number;
        z: number;
    };
    /** Unit river-flow heading in the same x/z frame as roadDirection. */
    riverDirection: {
        x: number;
        z: number;
    };
    spanM: number;
    widthM: number;
    roadRouteId: number;
    riverId: number;
    roadSourceIndex?: number;
    riverSourceIndex?: number;
}
/** A roster person resolved to the plot center where their figure is rendered. */
export interface GroundOccupantSite {
    burgId: number;
    occupantId: number;
    name: string;
    xM: number;
    zM: number;
    /** Schedule activity at the bake hour (drives the close-range nameplate). */
    activity?: ActivityKind;
}
/**
 * Current resident position supplied to tactical extraction. Live callers may
 * add movement state from `allGroundAgentsAt`; legacy callers can continue to
 * use the static schedule-derived sites already carried by GroundWorld.
 */
export interface GroundOccupantProjectionInput extends GroundOccupantSite {
    moving?: boolean;
}
/** An artifact feature in ground meters (world space, origin = artifact NW). */
export interface GroundFeature {
    id: number;
    kind: string;
    xM: number;
    zM: number;
}
export interface GroundHostile {
    id: string;
    name: string;
    xM: number;
    zM: number;
    monsterId: string;
}
/** Pre-extracted, chunk-samplable view of a LocalArtifact. */
/** SP4 hidden place placed in the 3D ground world (meters). */
export interface GroundHiddenSite {
    id: string;
    kind: HiddenPlaceKind;
    name: string;
    xM: number;
    zM: number;
    /** Proximity radius (meters) within which the player reveals it. */
    discoveryRadiusM: number;
}
/**
 * A world-grown dungeon ENTRANCE surfaced in the 3D ground world (Pillar 2,
 * Task 6). Each is a sealed door / mouth / stair the player can walk up to and
 * DISCOVER — the interior itself is Pillar 3 (no fake interiors here). The
 * entrance is anchored to a real {@link DungeonSite} (marker/temple/sewer/civ
 * origin) whose `sitePath` names the dungeon deterministically; the derived
 * name ("The Wrenfield Crypt") is resolved lazily at discovery time via
 * `generateDungeonForSite` (cached per sitePath) so world assembly stays cheap.
 */
export interface GroundDungeonEntrance {
    /** Stable per-window id (sitePath-derived) — the REVEAL_HIDDEN_SITE key. */
    id: string;
    /** The frozen site seed path (serialized) — names the dungeon on discovery. */
    sitePath: string;
    /** Atlas cell the site anchors to (for the map-pane pin, not the player's cell). */
    cellId: number;
    entranceKind: EntranceKind;
    /** Window-local ground meters (origin = artifact NW), like every ground piece. */
    xM: number;
    zM: number;
    /** Proximity radius (meters) within which the player discovers it. */
    discoveryRadiusM: number;
}
/**
 * Canopy atmosphere of the window's atlas cell (forests Task 11): what the 3D
 * scene needs to close the woods overhead — dimmer ambient light, pulled-in
 * fog. Resolved ONCE per window from the legacy biome def + named-forest kind;
 * the render-side modulation (fey dims less, haunted fog one step heavier)
 * lives in the scene, not here.
 */
export interface GroundCanopy {
    /** True by construction — a canopy only exists where the def says shade. */
    shade: boolean;
    /** Fog grade from the biome def ('light' when the def shades without fog). */
    fog: "light" | "medium" | "heavy";
    /** Named-forest kind of the cell; null inside anonymous/unnamed woods. */
    forestKind: ForestKind | null;
}
export interface GroundWorld {
    cols: number;
    rows: number;
    /** 0..100 heights (groundWorldAdapter domain), row-major. */
    heights: number[];
    biomeIds: string[];
    /** Total ground extent, world meters. */
    extentMetersX: number;
    extentMetersZ: number;
    /** The artifact's OWN placed features (trees/bushes/boulders…), meters. */
    features: GroundFeature[];
    /**
     * WAVE-1 beautification props (crates/stalls/barrels/boulders…), a SEPARATE
     * layer from `features` — each carries FULL combat-referee data via its catalog
     * def. Positions in ground meters (xM/zM). Deterministic per world+window.
     */
    props: PropInstance[];
    /** Hostile monsters placed deterministically on the ground map. */
    hostiles: GroundHostile[];
    /** SP4 hidden places (off-map, revealed by 3D proximity), ground meters. */
    hiddenSites: GroundHiddenSite[];
    /**
     * World-grown dungeon entrances inside this window (Pillar 2): sealed doors /
     * cave mouths / temple stairs / sewer grates the player discovers by 3D
     * proximity. Empty when no dungeon site falls in the window.
     */
    dungeonEntrances: GroundDungeonEntrance[];
    /** River/road centerlines crossing the artifact, ground meters. */
    rivers: GroundPolyline[];
    roads: GroundPolyline[];
    /** Optional for old fixtures/saves; current Region builds always provide it. */
    crossings?: GroundCrossing[];
    /** Town defensive wall rings (closed polylines), ground meters. */
    walls: GroundPolyline[];
    /** Town water bodies (rivers/harbour), filled flat surfaces, ground meters. */
    waterBodies: GroundWaterBody[];
    /** Town dock/bridge deck slabs, ground meters. */
    decks: GroundDeck[];
    /** Town road-gate placements (ground meters) for gatehouse meshes (styled-architecture slice). */
    gatehouses: Array<{
        xM: number;
        zM: number;
        angleRad: number;
        gapHalfM: number;
        form: GatehouseForm;
        colorHex: string;
        burgId: number;
    }>;
    /** Town sites overlapping the artifact, center in ground meters. */
    towns: Array<{
        burgId: number;
        name: string;
        xM: number;
        zM: number;
        halfM: number;
    }>;
    /** State and regiment facts stationed in each visible generated settlement. */
    settlementDefenses?: GroundSettlementDefense[];
    /** Town-plan building plots (C3 generateTownPlan), centers in meters. */
    buildings: Array<{
        id: string;
        xM: number;
        zM: number;
        /** Plot footprint corners, ground meters (quad order from the plan). */
        cornersM: Array<{
            x: number;
            z: number;
        }>;
        /** Town-authored group identity used for terrain terrace negotiation. */
        ensemble?: BuildingEnsemble;
        /** Actual production pad datum after a viable attached row negotiates. */
        terrainTerrace?: TerrainTerraceReceipt;
        /** Building height, meters (storeys × 3). */
        heightM: number;
        role: string;
        /** Architecture-style stamps (Task 7): absent on legacy/unstyled plans. */
        wallColorHex?: string;
        roofColorHex?: string;
        roofForm?: "gable" | "hip" | "steep" | "flat";
        /** The burg's style family builds chimneys. */
        chimney?: boolean;
        /** Interior wall envelope, meters (≤ plot; roofs/floors fit THIS). */
        wallWidthM: number;
        wallDepthM: number;
        /** L4 interior: walls + furnishings as site-local boxes (seamless). */
        parts: SitePart[];
        /** Solved roof group, site-local meters (BGv2 Task 5); undefined until a
         *  style resolves. When set, the renderer skips the legacy roof prism. */
        solvedRoof?: {
            positions: Float32Array;
            indices: Uint32Array;
            normals: Float32Array;
            colorHex: string;
        };
        /** Living-interiors live clock: length-24 window-lit / hearth-lit schedules,
         *  baked once; the renderer re-resolves them against the live game hour.
         *  Present only for populated plots. */
        litHours?: boolean[];
        hearthHours?: boolean[];
        /** Baked occupant render packets — the family, resolved live per hour.
         *  Present only for populated plots (replaces the old baked occupant boxes). */
        occupants?: BuildingOccupantRender[];
        /** Interior envelope in PLAN FEET (blueprint frame) — the frame occupant
         *  stations resolve in. Present only when `occupants` is. */
        interiorWidthFt?: number;
        interiorDepthFt?: number;
        /** Stable plan origin for occupants in asymmetrically extended buildings. */
        interiorOriginXFt?: number;
        interiorOriginYFt?: number;
        /** Canonical router door relative to the plot center, ground meters. */
        frontDoorOffsetX?: number;
        frontDoorOffsetZ?: number;
        name?: string;
        unlabeled?: boolean;
        labelRangeM?: number;
    }>;
    /** Occupant rosters per town (L4 — future UI/schedules consume these). */
    rosters: TownRoster[];
    /**
     * Roster occupants resolved to their current plot center. The figure boxes
     * already live inside building parts; these entries are marker-only labels.
     */
    occupants: GroundOccupantSite[];
    /**
     * Per-town plans (feet frame), paired with `rosters` by burgId. Together with
     * `boundsFeet` these are the inputs `groundTownAgentsAt` needs to animate
     * townsfolk walking the streets per-frame against the live clock.
     */
    townPlans?: Array<{
        burgId: number;
        plan: TownPlan;
    }>;
    /** Artifact window origin in town/plan FEET (`local.bounds`) for feet→meters. */
    boundsFeet?: {
        x: number;
        y: number;
    };
    /**
     * Canopy atmosphere of the window's atlas cell (forests Task 11). Null when
     * the cell's biome def has no canopyShade — or when no anchor cell was given
     * (tests/legacy callers) — and the 3D scene then renders exactly the
     * pre-canopy lighting.
     */
    canopy?: GroundCanopy | null;
    /**
     * Encoded-height snow line for this window (Task 10 MOUNTAINS), resolved ONCE
     * from the anchor cell's latitude band (spec §5). Ground vertices at/above it
     * blend toward snow in `sampleGroundChunk`. Absent (tests/legacy/anchor-less
     * builds) → the sampler uses the temperate baseline SNOW_LINE_H.
     */
    snowLineH?: number;
    /**
     * Far-distance terrain shells (2026-07-21): coarse static region + atlas
     * horizon ring meshes replacing the visible world edge. Present whenever the
     * window was built with a region; when absent the sampler keeps the legacy
     * edge-falloff drop + haze so old fixtures render unchanged.
     */
    farShells?: FarShells;
}
/** Region polylines (feet, world space) → ground meters, kept if any point
 * lands inside the artifact window (fine clipping happens per chunk). Route
 * polylines carry `kind`, which sets the tier tint (ROAD_3D_TIERS) and breaks
 * faint paths into a keep/skip patch cycle so they read as broken wear-lines.
 * A supplied wet-crossing context removes only water-biome overlap inside an
 * authoritative crossing span, leaving the ford/bridge deck to carry the wet
 * gap. Rivers pass no `kind` and behave exactly as before. */
export declare function regionPolylinesToGround(lines: Array<{
    centerline: Array<[number, number]>;
    widthFt: number;
    kind?: RegionRoad["kind"];
    routeId?: number;
    riverId?: number;
}>, local: LocalArtifact, sourceKind?: GroundPolyline["sourceKind"], wetClip?: Readonly<{
    crossings: RegionCrossing[];
    biomeIds: string[];
    cols: number;
    rows: number;
}>): GroundPolyline[];
/**
 * Stamp each regional river with a surface sample for every centerline point.
 * Adjacent uphill violations are pooled to their shared average (isotonic
 * smoothing), giving the smallest deterministic correction that guarantees the
 * resulting sequence never climbs while travelling downstream.
 */
export declare function computeGroundRiverWaterlines(rivers: GroundPolyline[], heights: number[], cols: number, rows: number, applyEdgeFalloff?: boolean): GroundPolyline[];
/**
 * Query the exact surface rendered for a ground river at a world-meter point.
 * Returning undefined outside every wet corridor lets land callers keep their
 * terrain anchor and makes legacy GroundWorld fixtures degrade honestly.
 */
export declare function riverWaterlineAt(ground: Pick<GroundWorld, "rivers">, x: number, z: number): number | undefined;
/** Project Region crossing receipts into the same ground-meter frame as runs. */
export declare function regionCrossingsToGround(crossings: RegionCrossing[], local: LocalArtifact, roads: GroundPolyline[], rivers: GroundPolyline[]): GroundCrossing[];
/**
 * Pure canopy resolution (forests Task 11): the window's legacy biome def +
 * named-forest kind → the `GroundWorld.canopy` payload, or null when the def
 * carries no canopyShade (open land, grassland, water). A def that shades
 * without naming a fog grade defaults to 'light'. Kept pure (defs passed in)
 * so it tests without the bridge atlas; production passes `BIOMES`.
 */
export declare function resolveCanopy(legacyBiomeId: string | undefined, forestKind: ForestKind | null, biomes: Record<string, {
    visibilityModifiers?: {
        fog?: "light" | "medium" | "heavy";
        canopyShade?: boolean;
    };
}>): GroundCanopy | null;
export interface MakeGroundWorldOptions {
    /** In-game hour 0–23: working adults stand at their work plot during
     * business hours (8–18), at home otherwise. Default noon. */
    hour?: number;
    /** Saved world deltas (B6/B7 plot edits) — replayed onto each town plan
     * before buildings/interiors/rosters derive from it, so the 3D village
     * reflects player edits. */
    deltas?: WorldDelta[];
    worldBusinesses?: Record<string, WorldBusiness>;
    generatedNpcs?: Record<string, RichNPC>;
    /** Sparse save-side building events, grouped by burg and canonical plot id. */
    buildingEventLogs?: BuildingEventLogsByBurg;
    /**
     * Staged 3D world entry (Stage A): skip the WAVE-1 props pass so terrain +
     * town assemble as fast as possible. A world built this way has `props: []`
     * and is otherwise identical to a full build; the props are added afterward by
     * a separate `computeGroundProps` call (Stage B). Default false = full build.
     */
    skipProps?: boolean;
    /**
     * Atlas cell the window anchors on (worldGenCore's entry cell). Enables the
     * per-window canopy resolution (forests Task 11); omitted (tests, legacy
     * callers) → `canopy: null`, behavior unchanged.
     */
    anchorCellId?: number;
}
/**
 * The WAVE-1 props pass, factored out so it can run on its own (staged 3D entry
 * Stage B) OR inside `makeGroundWorld` (full build). Both routes call THIS, so
 * the staged props are byte-identical to the full-build props. Pure and
 * deterministic per world + window.
 */
export declare function computeGroundProps(world: GroundWorld, seed: number, region?: RegionArtifact, opts?: MakeGroundWorldOptions): PropInstance[];
export declare function makeGroundWorld(local: LocalArtifact, seed: number, region?: RegionArtifact, opts?: MakeGroundWorldOptions): GroundWorld;
/**
 * The canonical artifact town (plots + streets + walls) for a burg's
 * RegionTownSite — the SINGLE place the live pipeline derives a town's plot IDs.
 *
 * Generated once in the normalized frame (`getCanonicalTownPlan`, shared with
 * the 2D map drill), then scaled by population and placed at the burg's region
 * envelope. `groundTowns` (geometry + roster) AND `World3DWrapper`
 * (business/NPC pre-registration) both call THIS, so the plot IDs they key off
 * (`biz_burg_<id>_plot_<plotId>`) always refer to the same buildings — the
 * earlier divergence (registration ran the retired rect generator while the
 * renderer ran the canonical one) produced mismatched IDs and unbound shops.
 */
export declare function canonicalArtifactTownForSite(worldSeed: number, site: RegionTownSite): AdaptedTownPlan & {
    family: StyleFamily;
};
/**
 * Town water bodies (filled surfaces) + dock/bridge deck quads for a site, in
 * ground meters. Derived from the SAME canonical plan + inherited water that
 * seated the 2D docks/bridges, transformed with the SAME placement as the town —
 * so the rendered water sits exactly under the piers. Surface/top Y are filled
 * later by the terrain-carve pass (heights aren't known here).
 */
export declare function canonicalTownWaterAndDecks(worldSeed: number, site: RegionTownSite, bounds: {
    x: number;
    y: number;
}): {
    waterBodies: GroundWaterBody[];
    decks: GroundDeck[];
};
/** Encoded-height bilinear sample at world meters → true meters via heightToMeters. */
export declare function groundSurfaceY(ground: GroundWorld, wxM: number, wzM: number): number;
/**
 * Per-occupant work hours (schedules v2): start 7–9, end 16–19, seeded by
 * occupant id — shops open and close staggered instead of the whole town
 * teleporting between home and work at 8:00 sharp.
 */
export declare function isAtWork(occupantId: number, hour: number): boolean;
/**
 * Ground-mode vegetation = the artifact's OWN tree/bush features inside the
 * chunk (chunk-local positions), replacing the generic per-vertex scatter —
 * which both honors the deterministic feature placement (delta-layer ids!)
 * and removes the lattice-row banding the scatter produced.
 */
export declare function buildGroundVegetation(ground: GroundWorld, cx: number, cy: number): {
    trees: VegetationScatter;
    bushes: VegetationScatter;
};
/**
 * Per-vertex steepness in [0,1] from the chunk's own encoded-height grid
 * (Task 10 MOUNTAINS — re-enables the written-but-bypassed slope→rock blend in
 * ground mode). Central finite difference of neighbor heights, converted to a
 * world-space rise/run so it is resolution-independent, then scaled to the
 * mesh's `1 − ny` convention (SLOPE01_SCALE). Edge vertices lack a neighbor on
 * one side; the index clamp degrades those to a (halved) one-sided difference —
 * a slight under-read of slope exactly where chunk skirts already hide the seam.
 */
export declare function groundSlope01(heights: Float32Array, i: number, j: number, resolution: number): number;
/**
 * Sample one chunk of ground terrain: vertex (i, j) sits at world meters
 * (cxÂ·S + i/(resâˆ’1)Â·S), mapped to fractional artifact cells at 1.524 m per
 * cell, with bilinear height interpolation and nearest-cell biomes.
 */
export declare function sampleGroundChunk(ground: GroundWorld, cx: number, cy: number, resolution: number): ChunkData;
/**
 * Inline (main-thread) chunk loader for ground mode â€” same shape as the
 * demo's WorldData loader: (cx, cy) â†’ ChunkMeshBundle promise.
 */
export declare function createGroundChunkLoader(local: LocalArtifact, seed: number, region?: RegionArtifact, opts?: MakeGroundWorldOptions): {
    ground: GroundWorld;
    loader: (cx: number, cy: number, lod?: LodTier) => Promise<ChunkMeshBundle>;
};
/**
 * Build the per-chunk mesh loader for an ALREADY-assembled GroundWorld.
 *
 * Split out of `createGroundChunkLoader` for staged 3D entry: a worker assembles
 * the `ground` data (which crosses the worker boundary as plain structured-clone
 * data) and the main thread rebuilds this cheap closure from it. The closure
 * captures only `ground`; both `sampleGroundChunk` and `buildGroundVegetation`
 * are pure functions of it, so a rebuilt loader is identical to the one
 * `createGroundChunkLoader` returns.
 */
export declare function buildGroundLoaderFromWorld(ground: GroundWorld): (cx: number, cy: number, lod?: LodTier) => Promise<ChunkMeshBundle>;
/** Optional extraction facts beyond the referee patch dimensions. */
export interface ExtractLocalTerrainPatchOptions {
    width?: number;
    height?: number;
    /** Current live-clock residents; static GroundWorld sites remain the fallback. */
    occupants?: readonly GroundOccupantProjectionInput[];
}
export declare function extractLocalTerrainPatch(ground: GroundWorld, playerX: number, playerZ: number, biome: BattleMapBiome, seed: number, options?: ExtractLocalTerrainPatchOptions): BattleMapData;
