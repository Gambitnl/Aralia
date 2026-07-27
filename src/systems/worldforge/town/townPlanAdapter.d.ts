/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 03:52:38
 * Dependents: components/DesignPreview/steps/townMesh.ts, components/Worldforge/TownPlanView.tsx, devtools/buildingIdentityLab/buildingIdentityLabModel.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/town/canonicalTown.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/registerBurgMerchants.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file townPlanAdapter.ts — fold a rich `townEngine` TownPlan (organic wards,
 * walls, civic) into the flat `artifacts.ts` TownPlan that the 3D ground bake
 * consumes (streets + plots with role + storeys), plus the wall ring (which the
 * artifact shape has no slot for — the 3D loader renders it separately).
 *
 * Roles map into the buckets the 3D loader keys off
 * (`groundChunkLoader.ts`: `isBiz = role === 'market' || 'workshop'`) and mirror
 * `TownPlanView.describeBuilding` so 2D labels and 3D roles agree.
 *
 * Styling is layered through the canonical architecture resolver: culture is
 * town-wide, spatial districts repeat a dominant construction dialect, wealth
 * narrows finish quality, and each stable engine plot key receives a bounded
 * individual variant. Artifact ids and footprints remain unchanged because
 * businesses and interiors key on them.
 */
import type { TownPlan as EngineTownPlan, BuildingPlot, CivicKind } from './townEngine';
import type { TownPlan as ArtifactTownPlan } from '../artifacts';
import { type Pt } from '../submap/submapEngine';
import type { BuildingEnsemble } from '../interior/blueprintTypes';
import { type StyleFamily, type ClimateClass } from './architectureStyle';
export interface AdaptedTownPlan {
    plan: ArtifactTownPlan;
    /** Wall ring + gatehouses, plus the river water-gate breaks (TG7). */
    walls: {
        ring: Pt[];
        gatehouses: Pt[];
        waterGates: Pt[];
    };
}
/**
 * Street hierarchy — the town's walkable network reads as FOUR tiers so a burg
 * looks like a place people move through, not a uniform grid. Each tier sets a
 * ribbon width (feet) and a tint the 3D bake paints:
 *
 *  • plaza  — the market square ward's own frontage: the paved civic heart
 *    ringing the plaza. Widest, bright flagstone with stone edging.
 *  • avenue — the inherited regional roads that enter through the gates: the
 *    grand thoroughfares. Wide, pale paving with the same edging.
 *  • street — the frontage of the OTHER civic wards (temple/keep/citadel/dock
 *    quarters): the paved mid tier. Warm cobble.
 *  • lane   — every other ward (Voronoi) edge: the packed-dirt web threading the
 *    house blocks. Narrowest, dirt with a worn wheel-rut stripe.
 *
 * WHAT CHANGED (streets-unify slice, 2026-07-18): previously three near-identical
 * tan tiers (a plaza frontage read like a back lane, per operator review); the
 * plaza tier was added, plaza frontage promoted into it, and the other civic
 * wards now seat the mid 'street' tier so all four tiers stay populated. Tier
 * widths/tints/layer recipes are now OWNED by the shared street-geometry module
 * `streetRibbons.ts` — the single source both 3D renderers (game ground bake and
 * design-preview schematic) consume — and this table is re-exported from it as
 * the adapter-facing plan-facts view (widthFt + colorHex only).
 *
 * The 2D map already draws this grid as the NEGATIVE SPACE between inset ward
 * blocks; the ward edges are the centerlines of those gaps, so a ribbon on each
 * edge lands exactly down the middle of the 2D street — the two views agree.
 */
export declare const STREET_TIERS: {
    readonly plaza: {
        readonly widthFt: number;
        readonly colorHex: string;
    };
    readonly avenue: {
        readonly widthFt: number;
        readonly colorHex: string;
    };
    readonly street: {
        readonly widthFt: number;
        readonly colorHex: string;
    };
    readonly lane: {
        readonly widthFt: number;
        readonly colorHex: string;
    };
};
/** BuildingType / ward-civic → the role buckets the 3D loader understands. */
/**
 * This role decision is shared with the 2D town inspector so an unpopulated
 * plot advertises the same motif recipe it will receive after artifact baking.
 */
export declare function roleForPlot(plot: BuildingPlot, wardCivic?: CivicKind): string;
/** Storeys by role (taller civic/commercial), with deterministic ±1 for homes. */
export declare function storeysForRole(role: string, poly: Pt[], ensemble?: BuildingEnsemble): number;
/**
 * Convert an engine TownPlan (any coord frame) into the artifact plan + walls.
 * Coordinates pass through unchanged — convert the frame BEFORE calling this
 * (see `transformTownPlanToFeet`).
 *
 * When `family` is given, each plot is stamped with deterministic architecture
 * style fields. Styling NEVER changes plot ids/filters/footprints — the plot-ID
 * identity between the 3D renderer and business registration is load-bearing.
 */
export declare function toArtifactPlan(plan: EngineTownPlan, burgId: number, family?: StyleFamily, climate?: ClimateClass): AdaptedTownPlan;
