/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 20:28:55
 * Dependents: systems/worldforge/bridge/groundProps.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file placementEngine.ts — seeded, deterministic prop placement (DATA layer).
 *
 * Pure functions: a `PropPlacementContext` (a slim, GroundWorld-shaped view of
 * towns / building plots / roads / biome cells) + a seed path → `PropInstance[]`.
 * NO rendering, NO GroundWorld mutation — the module boundary is exported pure
 * functions. Wiring into GroundWorld / chunk rendering is the NEXT packet.
 *
 * Determinism contract (spec decision 9): same world + same context + same seed
 * path → byte-identical props, forever. All randomness flows from
 * `rngFromPath` / `streamPath` (frozen FNV-1a → Park-Miller). Every cluster
 * draws from a path that includes a stable anchor id, so adding an anchor never
 * perturbs another anchor's props.
 *
 * Placement rules (from the strawman + BG3 reference pack density cheat sheet):
 *  • Market plaza  → market stalls in a row (~1 per 4 m of plaza edge), each
 *    owning a small understock cluster of crates/barrels/sacks.
 *  • Docks / warehouse doors → crate + crate-stack + barrel clusters of 2–5,
 *    pooled at each loading point (BG3: 4–8 pooled per crane).
 *  • Smithy / house walls → firewood (woodpile) 1–2 piles.
 *  • Farmstead → fence runs on boundaries, haystacks, well, water trough.
 *  • Wilderness biome cells → cover-scatter with clustering, tuned SPARSE
 *    (2026-07-04 density fix): mostly clear ground, occasional readable bush
 *    clusters, fallen logs RARE (~1 per 10 bushes), boulders biome-weighted.
 *    Nothing scatters within a cleared margin of buildings, plazas, or roads —
 *    the fiction is that villagers keep their lanes and yards tidy.
 *  • Temple plots (`role: 'temple'`) → graveyard dressing: gravestone rows
 *    (seeded grid + jitter), a tomb or two, brazier pair at the door.
 *  • Poor-quarter plots (`role: 'poor'`) → rubbish heap + chicken coop clutter
 *    (on top of the existing woodpile rule).
 *  • Roads → sparse trailside markers: milestone at intervals, rare shrine /
 *    fingerpost. Deliberately SPARSE point props only.
 *
 * ── PLACEMENT GAPS (catalog entries with tags but NO rule yet) ───────────────
 * `PropPlacementContext` cannot yet express these strawman anchors; the defs
 * exist in catalog.ts with placement tags only:
 *  • 'tavern'          — buildings carry a role, not a business type; no way to
 *                        find a tavern plot.
 *  • 'wealthy-quarter' — no wealth/quarter signal on plots.
 *  • 'gate'            — context has no walls polylines / gatehouses array.
 *  • 'ruin'            — no hiddenSites in the context.
 *  • 'riverbank'       — no rivers polylines in the context.
 *  • 'defile'          — no slope/heightfield signal to detect a choke.
 *  • 'warehouse','cellar','mill','pasture','village','roadside' — tag-only
 *    aliases from the strawman rows; folded into existing anchors later.
 * Also: the GroundWorld bridge still imprints/renders from WAVE1_PROPS_BY_ID,
 * so expanded defs emitted here are data-only until the wiring packet switches
 * the bridge to PROPS_BY_ID (rendering of new forms is out of this slice).
 */
import type { SeedPath } from '../seedPath';
import { type PropInstance } from './propSchema';
/** A town building plot — subset of GroundWorld.buildings the engine reads. */
export interface CtxBuilding {
    id: string;
    xM: number;
    zM: number;
    /** Town-plan role: 'market' | 'smithy' | 'house' | 'farm' | 'temple' | 'workshop' | … */
    role: string;
    /**
     * Economy business type at this plot when known (SLICE B — tavern context):
     * a 'tavern' business dresses its frontage with tavern props even though the
     * plot role is only 'market'/'workshop'. Absent = no business signal.
     */
    businessType?: string;
    /**
     * Wealth signal (SLICE B — wealthy-quarter context): true when the plot sits
     * in a high-status ward. Drives ornamental dressing (planters/statue/hedge).
     */
    wealthy?: boolean;
}
/** A polyline (road / wall) in ground meters — subset of GroundPolyline. */
export interface CtxPolyline {
    points: Array<{
        x: number;
        z: number;
    }>;
}
/** A dock / bridge deck slab — subset of GroundDeck. */
export interface CtxDeck {
    xM: number;
    zM: number;
    /** 'dock' | 'bridge' | … */
    kind: string;
}
/** A market/plaza anchor: center + rough radius in meters. */
export interface CtxPlaza {
    id: string;
    xM: number;
    zM: number;
    radiusM: number;
}
/** A canonical residential-block court projected into ground meters. */
export interface CtxCourtyard {
    id: string;
    xM: number;
    zM: number;
    radiusM: number;
    districtKey: string;
    wealth: 'poor' | 'common' | 'wealthy';
    amenity: 'well' | 'wash-yard' | 'work-yard' | 'garden';
    courtyardSignature: string;
}
/** A hidden/discovery site (SP4) — a `ruin` kind seeds ruin dressing. */
export interface CtxHiddenSite {
    id: string;
    /** 'ruin' | 'cave' | 'shrine' | 'camp' | 'grove' | 'wreck' — only 'ruin' dresses. */
    kind: string;
    xM: number;
    zM: number;
}
/** A town gatehouse placement (road gate through the wall ring). */
export interface CtxGatehouse {
    xM: number;
    zM: number;
    angleRad: number;
}
/**
 * The placement input. Deliberately GroundWorld-SHAPED but decoupled: an adapter
 * (next packet) will project a real GroundWorld onto this. Any field may be
 * empty; the engine only emits props for anchors that are present.
 */
export interface PropPlacementContext {
    /** Ground extent, meters (used to sanity-bound scatter). */
    extentMetersX: number;
    extentMetersZ: number;
    /** Grid of biome ids for wilderness scatter (row-major, cols×rows). */
    cols: number;
    rows: number;
    biomeIds: string[];
    buildings: CtxBuilding[];
    roads: CtxPolyline[];
    decks: CtxDeck[];
    /** Explicit market plazas (open square between market plots). */
    plazas: CtxPlaza[];
    /** Explicit residential courts authored by the canonical town engine. */
    courtyards?: CtxCourtyard[];
    /**
     * Optional per-cell heights (0..100 encoded, row-major cols×rows) — the slope
     * signal for the `defile` context (a steep choke gets ambush cover). Absent =
     * no defile detection.
     */
    heights?: number[];
    /** Town defensive wall rings (closed polylines) — the `gate`/`walls` context. */
    walls?: CtxPolyline[];
    /** Road gatehouses (the ring's road openings) — anchors gate dressing. */
    gatehouses?: CtxGatehouse[];
    /** River centerlines crossing the window — the `riverbank` context. */
    rivers?: CtxPolyline[];
    /** Hidden/discovery sites — a 'ruin' kind seeds the `ruin` context. */
    hiddenSites?: CtxHiddenSite[];
}
/**
 * The set of catalog defIds that `GroundProps.tsx` can draw. Placement NEVER
 * emits a defId outside this set, so no prop becomes an invisible combat
 * referee-blocker (Remy's no-silent-fallback rule). Every id here maps to a
 * deliberate render form in `GroundProps.tsx` (its own instanced/composed mesh,
 * or a reused rock/log/bush/box/cylinder variant chosen per family).
 *
 * Kept in sync with `RENDER_VARIANT` in `src/components/World3D/GroundProps.tsx`
 * — a catalog def with no render form must be added THERE before it may be
 * emitted here. `placeProps` guards on this set as a final safety net.
 */
export declare const RENDERABLE_DEF_IDS: ReadonlySet<string>;
/** No wilderness scatter within this margin of a building plot center. */
export declare const BUILDING_CLEAR_MARGIN_M = 10;
/** No wilderness scatter within this margin of a road centerline. */
export declare const ROAD_CLEAR_MARGIN_M = 6;
/**
 * Wall clearance for plaza/wealthy ORNAMENT props (statue, planter, bench,
 * topiary…): ornaments read as courtyard dressing, not façade clutter, so they
 * keep a modest gap from building walls (eyeball fix 2026-07-04: statues sat
 * flush against wealthy-quarter house walls).
 */
export declare const ORNAMENT_WALL_CLEAR_M = 3;
/** Ornaments never sit within this distance of ANY building plot center. */
export declare const ORNAMENT_BUILDING_CLEAR_M: number;
/** Fraction of interval samples that place nothing (patchiness). */
export declare const RIVERBANK_SKIP_CHANCE = 0.5;
/**
 * Defile (ambush choke) dressing — boulders, crags, snags, deadfall in the
 * STEEPEST cells (a rocky pinch the party must funnel through). The slope
 * signal is the encoded height gradient; only cells above a slope threshold
 * seed cover, at a sparse per-cell chance so the choke reads without carpeting.
 */
export declare const DEFILE_SLOPE_THRESHOLD_ENC = 6;
export declare const DEFILE_SEED_CHANCE = 0.05;
/**
 * Chance an eligible biome cell seeds a cover cluster. The grid is 5-ft cells,
 * so a full ground window has ~10^5 eligible cells — the previous 0.18 rate
 * produced ~130k instances/window (log-jammed lanes, buried settlements). At
 * 0.006 a window carries a few THOUSAND instances: mostly clear ground with
 * occasional readable clusters.
 */
export declare const SCATTER_SEED_CHANCE = 0.006;
/**
 * Produce every WAVE-1 prop instance for a context, deterministically from
 * `seedPath`. Pure — same inputs → deep-equal output, forever.
 */
export declare function placeProps(seedPath: SeedPath, ctx: PropPlacementContext): PropInstance[];
