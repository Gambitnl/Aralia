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
export const BUILDING_LABEL: Record<BuildingType, string> = {
  cottage: 'Cottage', townhouse: 'Townhouse', tenement: 'Tenement', farmstead: 'Farmstead',
  inn: 'Inn', tavern: 'Tavern', shop: 'Shop', smithy: 'Smithy', workshop: 'Workshop', storehouse: 'Storehouse', civic: 'Civic Hall',
};

/** Wall/footprint fill per type. Residential warm brown (darker the denser:
 *  cottage→townhouse→tenement); commercial warmer/oranger; workshops greyer; civic blue. */
export const BUILDING_FILL: Record<BuildingType, string> = {
  cottage: '#9c7b54', townhouse: '#8a6643', tenement: '#6f4f37', farmstead: '#a98a5f',
  inn: '#b07338', tavern: '#9c5f37', shop: '#bb8a44', smithy: '#6c5c54', workshop: '#8a7350', storehouse: '#b89a72', civic: '#8a9bc4',
};

/** Storeys per type — drives 3D massing (and could inform 2D shadows later).
 *  Tenements are the tall dense housing; civic halls and inns rise above cottages. */
export const BUILDING_STOREYS: Record<BuildingType, number> = {
  cottage: 1, farmstead: 1, townhouse: 2, tenement: 3, storehouse: 1, smithy: 1, workshop: 1,
  shop: 2, tavern: 2, inn: 2, civic: 2,
};

/** Roof tone per type: terracotta tiles for homes/commerce, slate for civic, thatch-brown
 *  for rural/utility. A touch of variety so a 3D town doesn't read as one flat colour. */
export const BUILDING_ROOF: Record<BuildingType, string> = {
  cottage: '#7a4a32', townhouse: '#7a4430', tenement: '#5e3a2c', farmstead: '#7d6a3e',
  inn: '#8a4a2a', tavern: '#7a3f28', shop: '#8a5230', smithy: '#4f4a45', workshop: '#6a5a3e', storehouse: '#6f6048', civic: '#46546a',
};

/** Fallback fill when a plan carries no population data (positional kind only). */
export const BUILDING_FILL_FALLBACK = { frontage: '#9c7b54', interior: '#b89a72' } as const;
export const BUILDING_ROOF_FALLBACK = '#7a4a32';
