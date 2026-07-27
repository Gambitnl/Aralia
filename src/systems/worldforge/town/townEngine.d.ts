/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 14/07/2026, 22:15:38
 * Dependents: components/DesignPreview/steps/PreviewTown3D.tsx, components/DesignPreview/steps/PreviewTowns.tsx, components/DesignPreview/steps/Town3DScene.tsx, components/DesignPreview/steps/townMesh.ts, components/MapPane.tsx, components/Worldforge/TownPlanView.tsx, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/town/architectureDistricts.ts, systems/worldforge/town/buildingEnsembles.ts, systems/worldforge/town/buildingPlotInput.ts, systems/worldforge/town/canonicalTown.ts, systems/worldforge/town/demoTownPlan.ts, systems/worldforge/town/householdBrief.ts, systems/worldforge/town/population.ts, systems/worldforge/town/townDiagnostics.ts, systems/worldforge/town/townPlanAdapter.ts, systems/worldforge/town/voronoiTownAdapter.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file townEngine.ts — SP-T clean-room Voronoi-ward town generator, iteration #1.
 *
 * The deepest tier of the recursive cartographic stack: a burg FOOTPRINT polygon
 * is subdivided into WARDS (Voronoi cells, reusing SP1's clip-to-parent +
 * re-tessellate machinery), and each ward's street frontage is packed with
 * PARTY-WALL building plots — rectangles tiled edge-to-edge along the ward
 * boundary (the street), set back inward. This satisfies SP-T acceptance
 * criteria #1 (blocks-first, no beads-on-a-string) and #2 (party-wall frontage)
 * for one slice; civic anatomy / terrain / typology-by-scale are later passes.
 *
 * CLEAN-ROOM: no Watabou data/algorithms are used or cloned (see DECISIONS).
 * Pure: no React/DOM. Determinism flows from the hierarchical seed-path.
 *
 * Spec: docs/projects/worldforge/SPEC.md §11 item 8 (town benchmark + criteria).
 * North star: docs/projects/worldforge/subprojects/sp-t-town-generator/NORTH_STAR.md
 */
import { type SeedPath } from '../seedPath';
import { polygonBounds, type Pt } from '../submap/submapEngine';
import { type TownArchitectureDistrict } from './architectureDistricts';
import { type TownCourtyardSpace } from './courtyardSpaces';
export interface BuildingPlot {
    /** Plot footprint polygon (graph coords, the town's frame). */
    polygon: Pt[];
    /** Index of the ward edge (frontage) this plot faces; -1 for interior infill. */
    frontageEdge: number;
    /** Where the plot sits: street frontage vs ward-interior infill (#6). */
    kind?: 'frontage' | 'interior';
    /** Footprint shape: rectangle, stepped/L, or a block-clipped corner wedge. */
    shape?: 'rect' | 'L' | 'wedge';
    /** Which shared court this ward-interior plot faces; absent on legacy plots. */
    courtyardIndex?: number;
    /** Concrete building type (set by the population pass when a population is given). */
    buildingType?: import('./population').BuildingType;
    /** Whether this building is a home that carries population (cottage/townhouse/tenement). */
    residential?: boolean;
    /** Permanent residents living here (0 for non-residential workplaces/civic). */
    occupants?: number;
    /** Stable per-town building id (`b<index>`) — keys the lazy named household. */
    homeId?: string;
    /** Stable architecture identity assigned before population or adapter filtering. */
    architectureKey?: string;
    /** Block-level row/courtyard/arcade instruction authored after plot filtering. */
    ensemble?: import('../interior/blueprintTypes').BuildingEnsemble;
    /** Social class of the ward this plot sits in (set before classification). */
    district?: import('./population').WardWealth;
    /** For a HOME: the `homeId` of the workplace its breadwinners work at (undefined = unskilled labour). */
    workplaceId?: string;
    /** For a HOME: how its workers relate to their workplace. */
    workRole?: 'proprietor' | 'staff' | 'labourer';
    /** For a WORKPLACE: the `homeId` of the home whose family runs it. */
    proprietorHomeId?: string;
    /** For a WORKPLACE: number of employee homes assigned to it (excludes the proprietor). */
    staffCount?: number;
}
/**
 * The population-pass fields of a {@link BuildingPlot} that survive into the flat
 * artifact plan, carried so the 3D bake can rebuild the founding household brief
 * ({@link import('./householdBrief').briefForPlot}) for each rendered building.
 * Exactly the fields briefForPlot reads (no geometry) — briefForPlot resolves
 * cross-references (workplaceId / proprietorHomeId) against the full set by homeId.
 */
export type TownPlotPopulation = Pick<BuildingPlot, 'buildingType' | 'residential' | 'occupants' | 'homeId' | 'district' | 'workplaceId' | 'workRole' | 'proprietorHomeId'>;
export type CivicKind = 'plaza' | 'temple' | 'keep' | 'citadel' | 'dock' | 'bridge';
export type TownTypology = 'hamlet' | 'village' | 'walled town' | 'city' | 'capital';
export interface TownScaleProfile {
    typology: TownTypology;
    population: number;
    /** Voronoi ward count — grows sublinearly with population, UNCAPPED. */
    wardCount: number;
    hasWalls: boolean;
    hasPlaza: boolean;
    hasTemple: boolean;
    hasKeep: boolean;
    /** Capital-only second stronghold. */
    hasCitadel: boolean;
}
export interface CivicStructure {
    kind: CivicKind;
    /** Footprint polygon of the civic space/building (graph coords). */
    polygon: Pt[];
    /** Index of the ward this civic structure occupies. */
    wardIndex: number;
}
export interface TownWalls {
    /** Defensive wall ring (inset from the footprint). */
    ring: Pt[];
    /** Gatehouse points on the ring where main roads enter. */
    gatehouses: Pt[];
    /**
     * Water-gate points (TG7): where an inherited river crosses the wall ring. A
     * river must pass UNDER/THROUGH an arch, not clip a solid rampart — these mark
     * the ring spans the wall mesh should break for an arch/portcullis gap. Empty
     * when no river crosses the ring (or the town is unwalled). Optional so existing
     * `TownWalls` constructors (e.g. the canonicalTown transform) stay valid until
     * they propagate it.
     */
    waterGates?: Pt[];
}
export interface TownWard {
    /** Ward (Voronoi cell) polygon clipped to the town footprint. */
    polygon: Pt[];
    /** The buildable block: the ward inset by a street margin. Buildings pack on
     *  THIS, so the gap between neighbouring blocks reads as the street network. */
    block: Pt[];
    /** Party-wall building plots packed along this ward's street frontage. */
    plots: BuildingPlot[];
    /** Civic role of this ward, if any (plaza wards carry no plots). */
    civic?: CivicKind;
    /** Social class of this ward (wealthy near the keep/market, poor at the rim). */
    wealth?: import('./population').WardWealth;
    /** Spatial district whose buildings repeat one roof/facade dialect. */
    architectureDistrict?: TownArchitectureDistrict;
}
/** Land use of the ring between the built town core and the cell boundary. */
export type OutskirtKind = 'farm' | 'pasture' | 'scrub';
export interface TownOutskirt {
    /** Parcel polygon (cell coords). */
    polygon: Pt[];
    /** farm (tilled fields near the core) → pasture (grassland) → scrub (barren edge). */
    kind: OutskirtKind;
}
export interface TownPlan {
    /** The burg footprint = the whole parent cell (a leaf submap cell). */
    footprint: Pt[];
    /**
     * The ORGANIC built-up boundary INSIDE the cell. The town lives here; it does
     * not adhere to the cell's exact shape. Wards/buildings/walls all sit within it.
     */
    core: Pt[];
    /** Voronoi wards subdividing the CORE (not the whole cell). */
    wards: TownWard[];
    /** Every building plot across all wards, flattened — the canonical building list
     *  (stable `homeId`s, population-tagged). Same object refs as `wards[].plots`. */
    plots: BuildingPlot[];
    /** Farmland/grassland/scrub parcels filling the ring between the core and cell edge. */
    outskirts: TownOutskirt[];
    /** Defensive wall ring + gatehouses (criterion #3). */
    walls: TownWalls;
    /** Civic anatomy: market plaza, temple(s), castle/keep (criterion #3). */
    civic: CivicStructure[];
    /** Main streets continued from inherited regional roads, clipped to town (#6). */
    streets: Pt[][];
    /** Real shared courts enclosed by interior-block buildings, including amenity use. */
    courtyards: TownCourtyardSpace[];
    /** Rural homes seated on farm outskirts (carry the rural population). Empty if no population given. */
    farmsteads: import('./population').Farmstead[];
    /** Population accounting (who lives where) — present only when a population was given. */
    demographics?: import('./population').TownDemographics;
}
export interface GenerateTownOptions {
    /** Population — derives typology, ward count, and which civic structures appear. */
    population?: number;
    /** Target ward count (Voronoi cells). Overrides the population-derived count. */
    wardCount?: number;
    /** Building frontage width (world units) before jitter. */
    plotWidth?: number;
    /** Building depth set back from the street (world units). */
    plotDepth?: number;
    /** Gap between adjacent plots and at corners (world units). */
    gap?: number;
    /** Inherited rivers/coast as polylines (footprint coords) — drives docks + bridges (#4). */
    water?: Pt[][];
    /** Max water distance for a ward edge to count as waterfront (world units). */
    waterMargin?: number;
    /** Optional terrain height sampler (footprint coords) for slope-aware streets (#4). */
    heightAt?: (p: Pt) => number;
    /** Max street grade (Δheight / length); steeper ward edges seat no frontage. */
    maxGrade?: number;
    /** Inherited regional roads (footprint coords) → continued main streets (#6). */
    roads?: Pt[][];
    /** Building-footprint variety: depth jitter + stepped/L shapes. Default true (#6). */
    variety?: boolean;
    /** Pack freestanding buildings into ward interiors (courtyards). Default true (#6). */
    interiorInfill?: boolean;
    /** Tile dense frontage lots edge-to-edge so shared party walls are real. */
    partyWallRows?: boolean;
}
/** Area-weighted polygon centroid (falls back to vertex mean for degenerate polys). */
export declare function polygonCentroid(poly: Pt[]): Pt;
/**
 * Half-width of the inherited main-road carve corridor, as a fraction of the
 * footprint span. Matches the 3D avenue ribbon (22 ft at the 1000 ft canonical
 * span ≈ 0.011) plus a small shoulder so buildings don't kiss the roadside.
 */
export declare const MAIN_ROAD_CARVE_HALF_FRAC = 0.014;
/**
 * Half-width of the river-channel carve, as a fraction of the footprint span.
 * Matches the 3D water channel (`channelHalfWidth = spanFt * 0.03`) plus a
 * shoulder so waterfront buildings hug the bank without standing in the water.
 */
export declare const WATER_CARVE_HALF_FRAC = 0.035;
/**
 * TRUE inset of a convex polygon: every edge slides inward by exactly `margin`
 * along its own normal, and adjacent offset edges are re-intersected. Unlike
 * centroid-scaling (the old block inset), the margin is uniform — an off-center
 * or elongated ward no longer leaves one block edge sitting in the street.
 * Returns null when the margin swallows the polygon (caller decides fallback).
 */
export declare function insetConvexPolygon(poly: Pt[], margin: number): Pt[] | null;
/**
 * Pack a single ward's street frontage with party-wall building plots. Each ward
 * edge is treated as a street; rectangular plots are tiled flush along it
 * (sharing side walls = party walls) and set back inward by `plotDepth`. Corners
 * and tiny edges are skipped so plots don't overlap. Deterministic per seed-path.
 */
export declare function packWardFrontage(ward: Pt[], seedPath: SeedPath, opts?: GenerateTownOptions): BuildingPlot[];
/**
 * Pack ward-interior buildings around an intentionally empty shared center.
 * The old random-square scatter could label buildings as a courtyard while
 * placing one directly through its center. These tangent rectangles face the
 * court and preserve their first edge as the adapter's frontage reference.
 */
export declare function packWardInterior(ward: Pt[], seedPath: SeedPath, opts?: GenerateTownOptions): BuildingPlot[];
/**
 * If a ward is waterfront, return the index of its edge nearest the water (where
 * a dock seats); otherwise null. "Waterfront" = an edge midpoint within `margin`
 * of any inherited water polyline. Criterion #4.
 */
export declare function wardWaterEdge(ward: Pt[], water: Pt[][], margin: number): number | null;
/**
 * Find bridge points: where an inherited water polyline crosses from one ward
 * into another (a street/ward crossing), step-sampled for determinism. Criterion
 * #4. `step` is the sampling spacing in world units.
 */
export declare function findBridges(water: Pt[][], wardPolys: Pt[][], step: number): Pt[];
/**
 * Build the defensive wall ring (footprint inset toward its centroid) and seat
 * gatehouses where main roads enter — the midpoints of the longest footprint
 * edges, projected onto the ring. Criterion #3 (walls + gatehouses).
 */
export declare function buildWalls(footprint: Pt[], gateCount?: number): TownWalls;
/**
 * Find where inherited water polylines cross the wall ring — the points a
 * water-gate/arch must break the rampart so a river doesn't clip solid stone
 * (TG7). Returns the crossing points on the ring edges.
 */
export declare function findWaterGates(ring: Pt[], water: Pt[][]): Pt[];
/** Which civic structures a town of a given scale should seat. */
export interface CivicRoleRequest {
    plaza?: boolean;
    temple?: boolean;
    keep?: boolean;
    citadel?: boolean;
}
/**
 * Assign civic roles to wards by position: the plaza is the most central ward,
 * the keep/citadel the most peripheral (defensible), the temple the next-most
 * central distinct ward. Only the requested roles are placed (scale-gated).
 * Returns a role per ward index. Criterion #3 + #5.
 */
export declare function assignCivicRoles(wardCentroids: Pt[], townCenter: Pt, req?: CivicRoleRequest): Map<number, CivicKind>;
/** Population bands → settlement typology (uncapped: above the top band = capital). */
export declare function typologyForPopulation(pop: number): TownTypology;
/**
 * Derive the full scale profile from population: typology, ward count (sublinear,
 * UNCAPPED — no fixed size cap), and which civic structures appear. Criterion #5.
 */
export declare function scaleProfile(population: number): TownScaleProfile;
/**
 * Build the ORGANIC built-up core inside the parent cell. Rather than adopting
 * the cell's exact polygon, the core is a smooth blob centred in the cell whose
 * radius is a fraction of the cell radius modulated by a few seeded harmonics —
 * so the town has its own shape and leaves an outskirts ring out to the cell edge.
 */
export declare function buildTownCore(footprint: Pt[], center: Pt, coreFrac: number, seedPath: SeedPath, segments?: number): Pt[];
/**
 * Subdivide the ring between the core and the cell edge into land-use parcels:
 * farmland hugs the core, pasture beyond, scrub/barren at the rim. A coarse
 * Voronoi over the whole cell; cells whose centroid is inside the core are the
 * town and are dropped (the town renders on top). Distance from the core edge to
 * the cell edge classifies the rest.
 */
export declare function buildOutskirts(footprint: Pt[], core: Pt[], center: Pt, seedPath: SeedPath, count?: number): TownOutskirt[];
/**
 * SP-T: parent cell → organic town CORE inside it → Voronoi wards (via the SP1
 * engine) → party-wall frontage plots + civic anatomy + walls; the ring between
 * the core and the cell edge becomes farmland/pasture/scrub outskirts. The town
 * lives inside the cell but does not adhere to its exact shape.
 */
export declare function generateTownPlan(footprint: Pt[], seedPath: SeedPath, opts?: GenerateTownOptions): TownPlan;
/** Convenience: total building plots across all wards. */
export declare function countPlots(plan: TownPlan): number;
export { polygonBounds };
