/**
 * @file buildingStyle.ts — single source of truth for how each building TYPE looks.
 *
 * Shared by the 2D town map (`TownPlanView`) and the 3D town (`townMesh`/
 * `Town3DScene`) so the two renderers agree on colour, label and massing — the
 * building-type level of "the 3D town adheres to the 2D town map". The population
 * pass (`population.ts`) tags each `BuildingPlot` with a `buildingType`; both
 * renderers key off these tables.
 */
import type { BuildingType } from './population';
/** Human label per type (inspector + legends). */
export declare const BUILDING_LABEL: Record<BuildingType, string>;
/** Wall/footprint fill per type. Residential warm brown (darker the denser:
 *  cottage→townhouse→tenement); commercial warmer/oranger; workshops greyer; civic blue. */
export declare const BUILDING_FILL: Record<BuildingType, string>;
/** Storeys per type — drives 3D massing (and could inform 2D shadows later).
 *  Tenements are the tall dense housing; civic halls and inns rise above cottages. */
export declare const BUILDING_STOREYS: Record<BuildingType, number>;
/** Roof tone per type: terracotta tiles for homes/commerce, slate for civic, thatch-brown
 *  for rural/utility. A touch of variety so a 3D town doesn't read as one flat colour. */
export declare const BUILDING_ROOF: Record<BuildingType, string>;
/** Fallback fill when a plan carries no population data (positional kind only). */
export declare const BUILDING_FILL_FALLBACK: {
    readonly frontage: "#9c7b54";
    readonly interior: "#b89a72";
};
export declare const BUILDING_ROOF_FALLBACK = "#7a4a32";
