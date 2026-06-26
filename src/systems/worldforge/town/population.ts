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
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { BuildingPlot, TownOutskirt, TownScaleProfile } from './townEngine';
import type { Pt } from '../submap/submapEngine';

/**
 * Area-weighted polygon centroid (local copy to keep this module's import of
 * townEngine type-only — townEngine imports assignTownPopulation at runtime).
 */
function polygonCentroid(poly: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

export type BuildingType =
  // residential (homes — carry the population)
  | 'cottage' | 'townhouse' | 'tenement' | 'farmstead'
  // non-residential (workplaces/civic — house no permanent residents in the housing math)
  | 'inn' | 'tavern' | 'shop' | 'smithy' | 'workshop' | 'storehouse' | 'civic';

/** Typical household size per residential type (0 = non-residential). */
const CAPACITY: Record<BuildingType, number> = {
  cottage: 4, townhouse: 6, tenement: 14, farmstead: 7,
  inn: 0, tavern: 0, shop: 0, smithy: 0, workshop: 0, storehouse: 0, civic: 0,
};

export const RESIDENTIAL_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'cottage', 'townhouse', 'tenement', 'farmstead',
]);
export const isResidential = (t: BuildingType): boolean => RESIDENTIAL_TYPES.has(t);

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
 * Target mean household size by typology — the density signal. Sparse rural-ish
 * hamlets average a small family per home; dense capitals pack tenement blocks, so
 * the average household (across the whole dwelling stock) climbs. Drives the TRUE
 * implied dwelling count: dwellings ≈ population / targetHousehold.
 */
function targetHouseholdFor(profile: TownScaleProfile | null): number {
  if (!profile) return 5;
  switch (profile.typology) {
    case 'hamlet': return 4.2;
    case 'village': return 4.8;
    case 'walled town': return 5.4;
    case 'city': return 6.5;
    default: return 8.5; // capital — tenement-dense
  }
}

/** Rural fraction of the population by typology (denser settlements are more urban). */
function ruralFracFor(profile: TownScaleProfile | null): number {
  if (!profile) return 0.15;
  switch (profile.typology) {
    case 'hamlet': return 0.0;   // a hamlet IS rural; its homes are the farmsteads-as-cottages
    case 'village': return 0.18;
    case 'walled town': return 0.2;
    case 'city': return 0.14;
    default: return 0.08;        // capital — overwhelmingly urban
  }
}

/**
 * Classify a building by position/kind into a concrete type. Central street-fronts
 * read commercial (inn/shop/smithy); other fronts residential; ward interiors as
 * utility outbuildings. Tenements (dense housing) appear only in cities/capitals.
 * Deterministic per building centroid.
 */
export function classifyBuilding(
  plot: BuildingPlot,
  townCenter: Pt,
  townSpan: number,
  typology: TownScaleProfile['typology'] | null,
  hash: (x: number, y: number) => number,
): BuildingType {
  const c = polygonCentroid(plot.polygon);
  const dist = Math.hypot(c[0] - townCenter[0], c[1] - townCenter[1]) / (townSpan || 1); // 0=centre
  const h = hash(c[0], c[1]);
  if (plot.kind === 'interior') {
    // Ward-interior outbuildings: mostly storehouses/workshops, some cottages.
    return (h % 3 === 0) ? 'cottage' : (h % 3 === 1) ? 'workshop' : 'storehouse';
  }
  const central = dist < 0.22;
  const dense = typology === 'city' || typology === 'capital';
  if (central) {
    // Commercial heart: inns/taverns/shops/smithies, with some dense tenements in cities.
    if (dense && h % 5 === 0) return 'tenement';
    const commercial: BuildingType[] = ['inn', 'tavern', 'shop', 'smithy', 'shop'];
    if (h % 3 !== 0) return commercial[h % commercial.length];
    return dense ? 'townhouse' : 'cottage';
  }
  // Outer ring: homes. Cities mix in townhouses + occasional tenements.
  if (dense && h % 7 === 0) return 'tenement';
  if ((typology === 'walled town' || dense) && h % 3 === 0) return 'townhouse';
  return 'cottage';
}

/** FNV-1a hash of a rounded point — deterministic building flavour. */
export function hashPoint(x: number, y: number): number {
  let h = 2166136261 >>> 0;
  const s = `${Math.round(x)},${Math.round(y)}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

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
export function assignTownPopulation(input: AssignPopulationInput): TownPopulation {
  const { plots, farmParcels, population, profile, townCenter, townSpan, seedPath } = input;
  const typology = profile?.typology ?? null;

  // 1. Classify every building + tag a stable home id.
  const byType: Partial<Record<BuildingType, number>> = {};
  plots.forEach((p, i) => {
    const t = classifyBuilding(p, townCenter, townSpan, typology, hashPoint);
    p.buildingType = t;
    p.residential = isResidential(t);
    p.homeId = `b${i}`;
    p.occupants = 0;
    byType[t] = (byType[t] ?? 0) + 1;
  });

  // Rural population only exists if there's farmland to host it; otherwise everyone
  // is urban (a walled keep on bare rock has no farmsteads).
  const ruralPop = farmParcels.length > 0 ? Math.round(population * ruralFracFor(profile)) : 0;
  const urbanPop = Math.max(0, population - ruralPop);
  const occRng = rngFromPath(streamPath(seedPath, 'occupancy'));

  // 2. Per-RENDERED-home occupancy is REALISTIC, not pop-summing: a cottage holds a
  // believable family (~its capacity, jittered), a tenement a packed ~14. The map can
  // never legibly draw all of a capital's dwellings, so the rendered buildings are a
  // representative sample — the TRUE dwelling count (where everyone actually lives) is
  // derived below from population / target-household-size. This keeps each inspected
  // building plausible while still accounting for the whole population.
  const homes = plots.filter((p) => p.residential);
  for (const p of homes) {
    const cap = CAPACITY[p.buildingType as BuildingType] || 4;
    p.occupants = Math.max(1, Math.round(cap * (0.7 + occRng.next() * 0.55)));
  }

  // 3. Rural: farmsteads on farm parcels, each a believable rural household (~7). They
  // are a sample too — the true rural dwelling count is derived from ruralPop below.
  const farmsteads: Farmstead[] = [];
  if (ruralPop > 0 && farmParcels.length > 0) {
    const rng = rngFromPath(streamPath(seedPath, 'rural'));
    const nFarms = Math.max(1, Math.min(farmParcels.length, Math.ceil(ruralPop / 8)));
    for (let i = 0; i < nFarms; i++) {
      const c = polygonCentroid(farmParcels[i].polygon);
      farmsteads.push({ id: `f${i}`, x: c[0], y: c[1], occupants: Math.max(1, Math.round(CAPACITY.farmstead * (0.7 + rng.next() * 0.6))) });
    }
    byType.farmstead = (byType.farmstead ?? 0) + farmsteads.length;
  }

  // 4. TRUE dwelling count: everyone lives somewhere. Urban dwellings = urbanPop split
  // into target-sized households; rural dwellings likewise. Never fewer than what the
  // map actually renders (a small town renders ALL its homes → the two counts agree).
  const targetHH = targetHouseholdFor(profile);
  const urbanDwellings = urbanPop > 0 ? Math.max(homes.length, Math.round(urbanPop / targetHH)) : 0;
  const ruralDwellings = ruralPop > 0 ? Math.max(farmsteads.length, Math.round(ruralPop / 5)) : 0;
  const homeCount = urbanDwellings + ruralDwellings;
  const renderedHomes = homes.length + farmsteads.length;

  return {
    demographics: {
      population,
      accounted: population, // every soul is housed across the true dwelling count
      urban: urbanPop,
      rural: ruralPop,
      homes: homeCount,
      renderedHomes,
      byType,
      avgHousehold: homeCount > 0 ? Math.round((population / homeCount) * 10) / 10 : 0,
    },
    farmsteads,
  };
}
