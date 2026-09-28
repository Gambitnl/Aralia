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
  | 'inn' | 'tavern' | 'shop' | 'smithy' | 'workshop' | 'storehouse' | 'civic'
  // named landmarks — a town holds a CAPPED number of each (see LANDMARK_CAPS)
  | 'library' | 'guildhall' | 'granary' | 'windmill' | 'lumbermill'
  | 'school' | 'shrine' | 'barracks' | 'bakery';

/** Typical household size per residential type (0 = non-residential). */
const CAPACITY: Record<BuildingType, number> = {
  cottage: 4, townhouse: 6, tenement: 14, farmstead: 7,
  inn: 0, tavern: 0, shop: 0, smithy: 0, workshop: 0, storehouse: 0, civic: 0,
  library: 0, guildhall: 0, granary: 0, windmill: 0, lumbermill: 0,
  school: 0, shrine: 0, barracks: 0, bakery: 0,
};

export const RESIDENTIAL_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'cottage', 'townhouse', 'tenement', 'farmstead',
]);
export const isResidential = (t: BuildingType): boolean => RESIDENTIAL_TYPES.has(t);

/** Social class of a ward — wealthy quarter near the keep/market, poor at the rim. */
export type WardWealth = 'wealthy' | 'common' | 'poor';

/** Non-residential building types that employ people (a workplace, not just a store). */
export const WORKPLACE_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'inn', 'tavern', 'shop', 'smithy', 'workshop', 'civic',
  // landmarks that employ people (a granary is a store, not a workplace)
  'library', 'guildhall', 'windmill', 'lumbermill', 'school', 'shrine', 'barracks', 'bakery',
]);
export const isWorkplace = (t: BuildingType): boolean => WORKPLACE_TYPES.has(t);

/**
 * Named landmarks. A town that can hold ONE library, ONE guild hall and two
 * taverns reads as a place; a town of cottages, shops and smithies reads as
 * filler. Every landmark is capped per town, so the vocabulary stays a
 * vocabulary instead of becoming the new generic.
 */
export const LANDMARK_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'library', 'guildhall', 'granary', 'windmill', 'lumbermill',
  'school', 'shrine', 'barracks', 'bakery',
]);
export const isLandmark = (t: BuildingType): boolean => LANDMARK_TYPES.has(t);

/** Settlement size band — the scale signal the cap table keys off. */
type Typology = NonNullable<TownScaleProfile['typology']>;

/**
 * Per-town landmark caps by typology.
 *
 * Modelled on RealmSmith's flat LIMITS table (BuildingGenerator.ts, retired 2026-09-23),
 * but SCALED by settlement size instead of flat: a hamlet gets a shrine, a
 * granary and a mill; a capital gets guild halls, libraries and barracks. A type
 * absent from a tier (cap 0) never appears at that size at all — that is how the
 * vocabulary grows with the town.
 */
const LANDMARK_CAPS: Record<Typology, Partial<Record<BuildingType, number>>> = {
  hamlet: { shrine: 1, granary: 1, windmill: 1 },
  village: { shrine: 1, granary: 1, windmill: 1, lumbermill: 1, bakery: 1 },
  'walled town': {
    shrine: 2, granary: 2, windmill: 2, lumbermill: 1, bakery: 2,
    school: 1, library: 1, guildhall: 1, barracks: 1,
  },
  city: {
    shrine: 3, granary: 2, windmill: 2, lumbermill: 1, bakery: 3,
    school: 1, library: 1, guildhall: 2, barracks: 2,
  },
  capital: {
    shrine: 4, granary: 3, windmill: 2, lumbermill: 2, bakery: 4,
    school: 2, library: 2, guildhall: 3, barracks: 3,
  },
};

/** Tier used when a plan carries no scale profile (same spirit as targetHouseholdFor(null)). */
const UNSCALED_TIER: Typology = 'village';

/** How many of `type` a town of this size may hold (0 = never appears). */
export function landmarkCapFor(typology: Typology | null, type: BuildingType): number {
  return LANDMARK_CAPS[typology ?? UNSCALED_TIER][type] ?? 0;
}

/**
 * The remaining landmark allowance for ONE town. Mutable and order-dependent by
 * design: plots claim landmarks in plot order, which is stable per seed, so the
 * result is deterministic.
 */
export interface LandmarkLedger {
  /** Landmarks still unclaimed this town, by type. */
  remaining: Map<BuildingType, number>;
}

/** Fresh ledger for a town of this size. */
export function createLandmarkLedger(typology: Typology | null): LandmarkLedger {
  const caps = LANDMARK_CAPS[typology ?? UNSCALED_TIER];
  const remaining = new Map<BuildingType, number>();
  for (const key of Object.keys(caps) as BuildingType[]) {
    const n = caps[key] ?? 0;
    if (n > 0) remaining.set(key, n);
  }
  return { remaining };
}

/** Take one allowance of `type`. False when the town's cap is already spent. */
function claimLandmark(ledger: LandmarkLedger, type: BuildingType): boolean {
  const left = ledger.remaining.get(type) ?? 0;
  if (left <= 0) return false;
  ledger.remaining.set(type, left - 1);
  return true;
}

/** Landmarks of the built-up core: learning, trade guilds, the town bakehouse. */
const CORE_LANDMARKS: readonly BuildingType[] = ['library', 'guildhall', 'school', 'bakery', 'shrine'];
/** Landmarks of the middle ring: the garrison, a second bakehouse, a wayside shrine. */
const MID_LANDMARKS: readonly BuildingType[] = ['barracks', 'bakery', 'school', 'shrine'];
/** Landmarks of the rim: everything that needs wind, a mill race or cart room. */
const RIM_LANDMARKS: readonly BuildingType[] = ['windmill', 'lumbermill', 'granary', 'shrine'];

/** One plot in this many even ROLLS for a landmark; the caps thin it much further. */
const LANDMARK_RARITY = 11;

/**
 * Ring-band edge between the middle ring and the rim. `dist` is the plot's
 * distance from the town centre over the CORE SPAN, so it runs ~0.04..0.57 with
 * a median near 0.31 (measured across hamlet/walled-town/capital plans) — NOT
 * 0..1. The core edge (0.22) is the same one `central` uses; 0.36 puts roughly
 * the outer quarter of plots on the rim, which is where the mills and the
 * granary belong.
 */
const RIM_DIST = 0.36;

/**
 * The landmark a plot would like to be, chosen by its ring band. Trades that need
 * wind, water or cart room sit on the rim; learning and guilds sit in the core.
 * Returns null for the large majority of plots.
 */
function wantedLandmark(dist: number, h: number): BuildingType | null {
  if (h % LANDMARK_RARITY !== 0) return null;
  const band = dist < 0.22 ? CORE_LANDMARKS : dist < RIM_DIST ? MID_LANDMARKS : RIM_LANDMARKS;
  return band[(h >>> 8) % band.length];
}

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
 * Assign each ward a social class from its distance to the town's prestige anchors
 * (keep/citadel/temple/market). Wards hugging power are wealthy; the rim is poor;
 * the rest common. A little deterministic jitter keeps districts from being a clean
 * bullseye. Returns wealth per ward index.
 */
export function assignWardWealth(
  wardCentroids: Pt[],
  anchors: Pt[],
  span: number,
  seedPath: SeedPath,
): WardWealth[] {
  const rng = rngFromPath(streamPath(seedPath, 'wealth'));
  const pts = anchors.length > 0 ? anchors : wardCentroids.length > 0 ? [avgPt(wardCentroids)] : [];
  return wardCentroids.map((c) => {
    let d = Infinity;
    for (const a of pts) d = Math.min(d, Math.hypot(c[0] - a[0], c[1] - a[1]));
    if (!isFinite(d)) d = 0;
    const score = d / (span || 1) + (rng.next() - 0.5) * 0.18;
    if (score < 0.2) return 'wealthy';
    if (score > 0.46) return 'poor';
    return 'common';
  });
}

function avgPt(pts: Pt[]): Pt {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

/** Width/height of a polygon's bounding box (for jittering points within a parcel). */
function bounds(pts: Pt[]): { w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { w: maxX - minX, h: maxY - minY };
}

/**
 * Classify a building by position/kind into a concrete type. Central street-fronts
 * read commercial (inn/shop/smithy); other fronts residential; ward interiors as
 * utility outbuildings. Tenements (dense housing) appear only in cities/capitals.
 * Deterministic per building centroid.
 *
 * Named landmarks (library, guild hall, granary, …) need the town-wide `ledger`,
 * because a landmark is defined by being RARE: without a ledger there is nothing
 * to count against, so no landmark is ever emitted. When a plot wants a landmark
 * whose cap is spent, it DOWNGRADES to the class-appropriate home rather than
 * falling back to another trade — the same downgrade RealmSmith applies.
 */
export function classifyBuilding(
  plot: BuildingPlot,
  townCenter: Pt,
  townSpan: number,
  typology: TownScaleProfile['typology'] | null,
  hash: (x: number, y: number) => number,
  district?: WardWealth,
  ledger?: LandmarkLedger,
): BuildingType {
  const c = polygonCentroid(plot.polygon);
  const dist = Math.hypot(c[0] - townCenter[0], c[1] - townCenter[1]) / (townSpan || 1); // 0=centre
  const h = hash(c[0], c[1]);
  const wealthy = district === 'wealthy';
  const poor = district === 'poor';
  if (plot.kind === 'interior') {
    // Ward-interior outbuildings: mostly storehouses/workshops, some cottages.
    // Wealthy quarters keep tidy gardens (more cottages/none); poor yards cram workshops.
    if (wealthy) return (h % 2 === 0) ? 'cottage' : 'storehouse';
    return (h % 3 === 0) ? 'cottage' : (h % 3 === 1) ? 'workshop' : 'storehouse';
  }
  const central = dist < 0.22;
  const dense = typology === 'city' || typology === 'capital';
  // Better wards lean to refined residences + fine shops; poor wards to tenements,
  // workshops and taverns. The home fallback for a front shifts by class too.
  const homeFront: BuildingType = wealthy ? 'townhouse' : poor ? (dense ? 'tenement' : 'cottage') : (dense ? 'townhouse' : 'cottage');
  // Named landmarks outrank the generic trades: a plot that rolls one either
  // claims the town's remaining allowance or downgrades to a home.
  const wanted = wantedLandmark(dist, h);
  if (wanted) return ledger && claimLandmark(ledger, wanted) ? wanted : homeFront;
  if (central) {
    // Commercial heart: tenements crowd the poor centre; the rich centre stays low.
    if (dense && !wealthy && h % (poor ? 4 : 5) === 0) return 'tenement';
    const commercial: BuildingType[] = wealthy
      ? ['shop', 'inn', 'shop', 'inn', 'tavern']           // fine goods + reputable inns
      : poor
        ? ['tavern', 'workshop', 'smithy', 'shop', 'tavern'] // grog + trades
        : ['inn', 'tavern', 'shop', 'smithy', 'shop'];
    if (h % 3 !== 0) return commercial[h % commercial.length];
    return homeFront;
  }
  // Outer ring: homes, class-shaded.
  if (dense && poor && h % 5 === 0) return 'tenement';
  if (dense && !wealthy && h % 7 === 0) return 'tenement';
  if (wealthy && h % 2 === 0) return 'townhouse';
  if ((typology === 'walled town' || dense) && h % 3 === 0) return 'townhouse';
  return poor ? 'cottage' : homeFront === 'tenement' ? 'cottage' : (h % 4 === 0 ? homeFront : 'cottage');
}

/** FNV-1a hash of a rounded point — deterministic building flavour. */
export function hashPoint(x: number, y: number): number {
  let h = 2166136261 >>> 0;
  const s = `${Math.round(x)},${Math.round(y)}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** Employee homes (excluding the proprietor's) a workplace of each type supports. */
const STAFF_CAPACITY: Partial<Record<BuildingType, number>> = {
  smithy: 3, shop: 3, workshop: 4, inn: 6, tavern: 4, civic: 8,
  bakery: 3, windmill: 2, lumbermill: 4, library: 2, school: 3,
  guildhall: 4, barracks: 8, shrine: 2,
};

/**
 * Wire the local economy: link homes to workplaces. Each workplace (inn/shop/smithy/
 * …) is RUN by the nearest home (its proprietor family); remaining homes are staff at
 * the nearest workplace with room, or unskilled labourers (fields, docks, day-work)
 * when the town has more hands than jobs. Mutates plots' `workplaceId`/`workRole`/
 * `proprietorHomeId`/`staffCount`. Pure + deterministic. Returns the workplace count.
 */
export function assignWorkplaces(plots: BuildingPlot[]): number {
  const centroid = (p: BuildingPlot): Pt => polygonCentroid(p.polygon);
  const workplaces = plots.filter((p) => isWorkplace(p.buildingType as BuildingType));
  const homes = plots.filter((p) => p.residential && (p.occupants ?? 0) > 0);
  if (homes.length === 0) return workplaces.length;
  const claimed = new Set<BuildingPlot>();

  // Proprietors: each workplace claims its nearest unclaimed home.
  for (const wp of [...workplaces].sort((a, b) => (a.homeId! < b.homeId! ? -1 : 1))) {
    const wc = centroid(wp);
    let best: BuildingPlot | null = null, bestD = Infinity;
    for (const h of homes) {
      if (claimed.has(h)) continue;
      const c = centroid(h);
      const d = (c[0] - wc[0]) ** 2 + (c[1] - wc[1]) ** 2;
      if (d < bestD) { bestD = d; best = h; }
    }
    if (best) {
      claimed.add(best);
      best.workplaceId = wp.homeId;
      best.workRole = 'proprietor';
      wp.proprietorHomeId = best.homeId;
      wp.staffCount = 0;
    }
  }

  // Staff: every other home works at the nearest workplace that still has room.
  const load = new Map<BuildingPlot, number>();
  for (const h of homes) {
    if (claimed.has(h)) continue;
    const c = centroid(h);
    let best: BuildingPlot | null = null, bestD = Infinity;
    for (const wp of workplaces) {
      const cap = STAFF_CAPACITY[wp.buildingType as BuildingType] ?? 2;
      if ((load.get(wp) ?? 0) >= cap) continue;
      const wc = centroid(wp);
      const d = (c[0] - wc[0]) ** 2 + (c[1] - wc[1]) ** 2;
      if (d < bestD) { bestD = d; best = wp; }
    }
    if (best) {
      load.set(best, (load.get(best) ?? 0) + 1);
      best.staffCount = (best.staffCount ?? 0) + 1;
      h.workplaceId = best.homeId;
      h.workRole = 'staff';
    } else {
      h.workRole = 'labourer'; // more hands than jobs — fields, docks, day-labour
    }
  }
  return workplaces.length;
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

  // 1. Classify every building (class-shaded by its ward district) + tag a home id.
  const byType: Partial<Record<BuildingType, number>> = {};
  // One ledger per town: landmark caps are a TOWN property, and plots claim them
  // in plot order (stable per seed), so the outcome is deterministic.
  const landmarks = createLandmarkLedger(typology);
  plots.forEach((p, i) => {
    const t = classifyBuilding(p, townCenter, townSpan, typology, hashPoint, p.district, landmarks);
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

  // 3. Rural: scatter farmsteads across the farm parcels. We aim for the TRUE rural
  // dwelling count (ruralPop / ~5) — "drawn tracks true" — capped for legibility, and
  // place SEVERAL per parcel (jittered around its centroid) when there are more rural
  // homes than parcels, so the fields read as dotted with cottages, not one-per-field.
  const farmsteads: Farmstead[] = [];
  if (ruralPop > 0 && farmParcels.length > 0) {
    const rng = rngFromPath(streamPath(seedPath, 'rural'));
    const trueRural = Math.max(1, Math.round(ruralPop / 5));
    const nFarms = Math.min(trueRural, Math.max(farmParcels.length, 1) * 4, 64); // legibility cap
    const per = Math.floor(ruralPop / nFarms);
    let rem = ruralPop - per * nFarms;
    for (let i = 0; i < nFarms; i++) {
      const parcel = farmParcels[i % farmParcels.length].polygon;
      const c = polygonCentroid(parcel);
      const b = bounds(parcel);
      const r = Math.min(b.w, b.h) * 0.28;
      // First farmstead per parcel sits at the centroid; extras jitter within it.
      const first = i < farmParcels.length;
      const x = first ? c[0] : c[0] + (rng.next() - 0.5) * r * 2;
      const y = first ? c[1] : c[1] + (rng.next() - 0.5) * r * 2;
      farmsteads.push({ id: `f${i}`, x, y, occupants: Math.max(1, per + (rem-- > 0 ? 1 : 0)) });
    }
    byType.farmstead = (byType.farmstead ?? 0) + farmsteads.length;
  }

  // 4. Local economy: link homes ⇄ workplaces (proprietors, staff, labourers).
  const workplaces = assignWorkplaces(plots);

  // 5. TRUE dwelling count: everyone lives somewhere. Urban dwellings = urbanPop split
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
      workplaces,
      byType,
      avgHousehold: homeCount > 0 ? Math.round((population / homeCount) * 10) / 10 : 0,
    },
    farmsteads,
  };
}
