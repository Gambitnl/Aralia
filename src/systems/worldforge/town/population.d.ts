/**
 * @file population.ts — SP-T town population accounting.
 *
 * A town plan says WHERE buildings are; this turns the abstract population
 * number into WHO LIVES WHERE: every building gets a TYPE (residential homes vs
 * non-residential workplaces), the population is distributed across homes with
 * occupancy that rises with urban density, and a share lives RURALLY in outskirts
 * farmsteads. Named households are generated lazily (a 120k capital must not eagerly
 * spawn 120k people). Pure + deterministic from the town seed-path.
 *
 * Design decisions (user, 2026-06-26): population drives BOTH dwelling count and
 * per-building occupancy; most live in the core + rural farmsteads in the outskirts;
 * full named roster (lazy); typed dwellings, with commercial/civic excluded from
 * the housing math.
 */
import { type SeedPath } from '../seedPath';
import type { BuildingPlot, TownOutskirt, TownScaleProfile } from './townEngine';
import type { Pt } from '../submap/submapEngine';
export type BuildingType = 'cottage' | 'townhouse' | 'tenement' | 'farmstead' | 'inn' | 'tavern' | 'shop' | 'smithy' | 'workshop' | 'storehouse' | 'civic';
export declare const RESIDENTIAL_TYPES: ReadonlySet<BuildingType>;
export declare const isResidential: (t: BuildingType) => boolean;
/** Social class of a ward — wealthy quarter near the keep/market, poor at the rim. */
export type WardWealth = 'wealthy' | 'common' | 'poor';
/** Non-residential building types that employ people (a workplace, not just a store). */
export declare const WORKPLACE_TYPES: ReadonlySet<BuildingType>;
export declare const isWorkplace: (t: BuildingType) => boolean;
/** A rural dwelling in the outskirts (carries rural population). */
export interface Farmstead {
    id: string;
    x: number;
    y: number;
    occupants: number;
}
export interface TownDemographics {
    /** Target population (the input number). */
    population: number;
    /** Souls housed = population (everyone is placed in a dwelling). */
    accounted: number;
    urban: number;
    rural: number;
    /**
     * TRUE total dwellings the population implies (urban + rural), derived from
     * population and a density-dependent target household size. For a village this
     * equals the rendered building count; for a capital it far exceeds what the map
     * can legibly draw — the map shows a representative `renderedHomes` subset.
     */
    homes: number;
    /** Residential buildings actually drawn on the map (homes + farmsteads). */
    renderedHomes: number;
    /** Workplaces drawn on the map (inn/tavern/shop/smithy/workshop/civic). */
    workplaces: number;
    /** Building counts by type (residential + non-residential) — the rendered sample. */
    byType: Partial<Record<BuildingType, number>>;
    /** Mean household size across the true dwelling count (population / homes). */
    avgHousehold: number;
}
export interface TownPopulation {
    demographics: TownDemographics;
    farmsteads: Farmstead[];
}
/**
 * Assign each ward a social class from its distance to the town's prestige anchors
 * (keep/citadel/temple/market). Wards hugging power are wealthy; the rim is poor;
 * the rest common. A little deterministic jitter keeps districts from being a clean
 * bullseye. Returns wealth per ward index.
 */
export declare function assignWardWealth(wardCentroids: Pt[], anchors: Pt[], span: number, seedPath: SeedPath): WardWealth[];
/**
 * Classify a building by position/kind into a concrete type. Central street-fronts
 * read commercial (inn/shop/smithy); other fronts residential; ward interiors as
 * utility outbuildings. Tenements (dense housing) appear only in cities/capitals.
 * Deterministic per building centroid.
 */
export declare function classifyBuilding(plot: BuildingPlot, townCenter: Pt, townSpan: number, typology: TownScaleProfile['typology'] | null, hash: (x: number, y: number) => number, district?: WardWealth): BuildingType;
/** FNV-1a hash of a rounded point — deterministic building flavour. */
export declare function hashPoint(x: number, y: number): number;
/**
 * Wire the local economy: link homes to workplaces. Each workplace (inn/shop/smithy/
 * …) is RUN by the nearest home (its proprietor family); remaining homes are staff at
 * the nearest workplace with room, or unskilled labourers (fields, docks, day-work)
 * when the town has more hands than jobs. Mutates plots' `workplaceId`/`workRole`/
 * `proprietorHomeId`/`staffCount`. Pure + deterministic. Returns the workplace count.
 */
export declare function assignWorkplaces(plots: BuildingPlot[]): number;
export interface AssignPopulationInput {
    /** All building plots, already finalized (carry .buildingType/.occupants after this). */
    plots: BuildingPlot[];
    /** Farm outskirt parcels — seat rural farmsteads. */
    farmParcels: TownOutskirt[];
    population: number;
    profile: TownScaleProfile | null;
    townCenter: Pt;
    townSpan: number;
    seedPath: SeedPath;
}
/**
 * Account for `population` across the town: classify every building, give each
 * RENDERED home a realistic household (≈ its type capacity), seat rural farmsteads,
 * and derive the TRUE dwelling count (population / target household size) so the
 * demographics state where everyone lives even when the map can only draw a sample
 * of a city's homes. Mutates each plot's `buildingType`/`occupants`/`residential`/
 * `homeId`. Returns the demographics + farmsteads.
 */
export declare function assignTownPopulation(input: AssignPopulationInput): TownPopulation;
