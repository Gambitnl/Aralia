// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/08/2026, 00:55:38
 * Dependents: components/DesignPreview/steps/PreviewTown3D.tsx, components/MapPane.tsx, components/Worldforge/AtlasDemo.tsx, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/registerBurgMerchants.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file canonicalTown.ts — the SINGLE source of truth for a burg's town plan.
 *
 * Both the 2D map drill (`MapPane`/`TownPlanView`) and the 3D ground bake
 * (`bridge/groundChunkLoader.ts`) generate a burg's town from THIS module, so
 * the same burg is the exact same place in both views (Worldforge Option B —
 * "truly identical towns"). The plan is produced once in the atlas-pixel frame
 * by `town/townEngine.ts`; the 3D side affine-transforms the RESULT to feet
 * rather than re-running the generator at feet scale.
 *
 * Why transform the result instead of re-generating: the submap Voronoi site
 * sampler quantizes coordinates (`submapEngine.ts` `toFixed(3)`) in ABSOLUTE
 * space and uses rejection sampling, so the generator is NOT scale-invariant —
 * running it on the same shape at two scales yields different towns. Generating
 * once (atlas px) and scaling the geometry sidesteps that entirely: identity is
 * guaranteed because there is one generator call per (atlas, burgId).
 *
 * IDENTITY PRECONDITION: 2D and 3D must pass the SAME atlas. A burgId only means
 * the same burg within one FMG world. See the call sites for how the atlas is
 * sourced.
 */
import { generateTownPlan, typologyForPopulation, type TownPlan, type TownWard, type TownTypology } from './townEngine';
import { townSpanFtForPeople, POPULATION_RATE, CANON_TOWN_SPAN } from './townScale';
import { polygonBounds, type Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';
import { rootSeedPath, childSeedPath, streamPath } from '../seedPath';
import { burgCellPolygon, cellWaterFeatures, cellRoadPolylines } from './cellFeatures';
import { townRiverCourseCanon } from './townRiverCourse';
import type { RegionTownSite } from '../artifacts';
import { toArtifactPlan, type AdaptedTownPlan } from './townPlanAdapter';
import {
  climateForBiomeId,
  styleFamilyForCultureType,
  type StyleFamily,
} from './architectureStyle';
import type { VillagePersonality } from '../../../types/village';
import {
  resolveVillageIntegrationProfile,
  type VillageIntegrationProfile,
} from '../../../data/villagePersonalityProfiles';

export { burgCellPolygon } from './cellFeatures';

/** Minimal atlas surface this module reads (satisfied by FmgWorldResult). */
type TownAtlas = Pick<FmgWorldResult, 'pack'>;

/**
 * Canonical generation span. The town is generated in a normalized frame (the
 * burg's cell SHAPE, centered at the origin, longest side scaled to this span),
 * so the 2D view (fit-to-view) and the 3D view (scaled to feet) share one plan.
 * A raw FMG cell is geographic (~50k ft at canonical FEET_PER_FMG_PIXEL) — far
 * too big for a town — so size is decided per-view, only the shape is shared.
 * Canonical value lives in townScale.ts (so `townRiverCourse.ts` can map the
 * world river into this frame without importing this module); re-exported here
 * so existing importers keep working.
 */
export { CANON_TOWN_SPAN };

/**
 * People per FMG population point (FMG `populationRate`, default 1000 — see
 * generateWorld.ts). FMG stores burg `population` in POINTS (~0.01–60); the
 * town generator's typology bands (`townEngine.typologyForPopulation`) and ward
 * count expect real PEOPLE, so we scale here. (Urbanization is 1 in the bridge
 * atlas, so it drops out.) Canonical value lives in townScale.ts; re-exported
 * here so existing importers keep working.
 */
export { POPULATION_RATE };

/** Real urban population (people) for a burg. */
export function peopleForBurg(atlas: TownAtlas, burgId: number): number {
  return (atlas.pack.burgs?.[burgId]?.population ?? 0) * POPULATION_RATE;
}

/**
 * Physical town span (feet) by population — drives the 3D footprint size so a
 * city reads bigger than a hamlet and wards aren't crammed. The formula lives
 * in townScale.ts (2026-07-22 town-scale lift: the old `sqrt(people) × 6`,
 * floor 800 ft packed ~330 people/ha — every town under ~18k people rendered
 * as the same 244 m doll-house square) and is shared with the region pass's
 * envelope so the flattening pad and gates always contain the town.
 */
export function townSpanFtForBurg(atlas: TownAtlas, burgId: number): number {
  return townSpanFtForPeople(peopleForBurg(atlas, burgId));
}

/**
 * The shared seed path for a burg's town: `wf:<worldSeed>/burg:<id>/s:town`.
 * BOTH views derive this identically from (worldSeed, burgId) — it does NOT
 * depend on the drill path, so the same burg always seeds the same town.
 */
export function canonicalTownSeedPath(worldSeed: number, burgId: number): string {
  return streamPath(childSeedPath(rootSeedPath(worldSeed), `burg:${burgId}`), 'town');
}

/**
 * The cell-normalisation affine: cell shape centered at the origin, longest bbox
 * side scaled to CANON_TOWN_SPAN. Returned as a mapper so the footprint AND the
 * inherited water/road polylines all land in the same normalized frame.
 */
function canonAffine(cellPoly: Pt[]): (p: Pt) => Pt {
  const b = polygonBounds(cellPoly);
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  const k = CANON_TOWN_SPAN / span;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return ([x, y]) => [(x - cx) * k, (y - cy) * k];
}

// Memoize per atlas (object identity) → per burg. Same world + same burg never
// regenerates; a different atlas (different world) gets its own table.
const planCache = new WeakMap<object, Map<number, TownPlan>>();

/**
 * The canonical town plan for a burg, in the NORMALIZED frame (cell shape,
 * centered at the origin, ~CANON_TOWN_SPAN across). The 2D renderer fits this to
 * view directly; the 3D bake scales+translates it via {@link transformTownPlan}
 * using {@link townPlacementForBurg}. Identity: same atlas + burgId ⇒ same plan.
 */
export function getCanonicalTownPlan(
  atlas: TownAtlas,
  worldSeed: number,
  burgId: number,
): TownPlan {
  let perBurg = planCache.get(atlas as object);
  if (!perBurg) { perBurg = new Map(); planCache.set(atlas as object, perBurg); }
  const hit = perBurg.get(burgId);
  if (hit) return hit;

  const cellPoly = burgCellPolygon(atlas, burgId);
  const toCanon = canonAffine(cellPoly);
  const toCanonLine = (line: Pt[]): Pt[] => line.map(toCanon);
  const footprint = cellPoly.map(toCanon);
  const population = peopleForBurg(atlas, burgId);
  // Inherited water (rivers/coast) + regional roads, derived from the burg cell
  // and mapped into the SAME normalized frame as the footprint. These drive
  // riverside/harbour docks, bridges between wards, and main streets continued
  // from real roads. Identity holds because the plan is generated ONCE here and
  // the 3D bake only affine-transforms this result.
  // River at TRUE scale (2026-07-29): the cell affine shrank inherited water by
  // ~30x, dragging a river that runs 4,045 ft away through the middle of town.
  // The river now comes from the same course the region tier generates and
  // carves; only the coast still rides the cell affine, since a harbor apron is
  // defined by the cell's own shoreline.
  const coast = cellWaterFeatures(atlas, burgId).coast.map(toCanonLine);
  const course = townRiverCourseCanon(atlas, worldSeed, burgId);
  // Docks belong on BOTH: a harbour dock sits on the coast, a wharf on the river.
  const water = [...course.lines, ...coast];
  const roads = cellRoadPolylines(atlas, burgId).map(toCanonLine);
  const plan = generateTownPlan(footprint, canonicalTownSeedPath(worldSeed, burgId), {
    population,
    water,
    // Bridges belong on RIVERS ONLY. A coast edge is a shoreline — the boundary
    // between land and open sea — and bridging it means building a bridge to
    // nowhere. Kalg (burg 2) had four bridges, some seated on its single coast
    // segment, because the generator saw one undifferentiated `water` list.
    bridgeWater: course.lines,
    // The river's own width, so the deck spans the channel it actually crosses
    // rather than a fixed 11% of the town.
    waterWidth: course.widthCanon,
    roads,
  });
  perBurg.set(burgId, plan);
  return plan;
}

/**
 * The burg's inherited water in the NORMALIZED canonical frame, split by kind —
 * the SAME polylines that {@link getCanonicalTownPlan} fed to the generator to
 * seat docks/bridges: the river from the region's own course at true scale, the
 * coast from the cell affine. The 3D bake transforms these to feet and fills
 * them into water bodies, so the rendered water sits exactly under the docks.
 * Pure + deterministic from (atlas, worldSeed, burgId).
 */
export function getCanonicalTownWaterFeatures(
  atlas: TownAtlas,
  burgId: number,
  worldSeed: number,
): { rivers: Pt[][]; coast: Pt[][]; riverWidthCanon: number } {
  const toCanon = canonAffine(burgCellPolygon(atlas, burgId));
  const { coast } = cellWaterFeatures(atlas, burgId);
  const course = townRiverCourseCanon(atlas, worldSeed, burgId);
  return {
    rivers: course.lines,
    coast: coast.map((l) => l.map(toCanon)),
    riverWidthCanon: course.widthCanon,
  };
}

/* ------------------------------------------------------------------ *
 * Settlement PERSONALITY — what a burg feels like, beside what it is.
 *
 * `townEngine` answers geometry, population and wealth. It does not answer
 * tagline, cultural signature or encounter hook. `villagePersonalityProfiles`
 * holds exactly those, keyed by `culture_wealth_biomeStyle`, and until now its
 * only caller was the retired 2D village generator, so no player could reach a
 * single authored line (deepdive `village-generator-vs-worldforge-town.md`
 * finding 7, Decision 2 option A).
 *
 * The derivation below is PURE over (atlas, worldSeed, burgId): the burg's FMG
 * biome id, its culture type, its port flag, its population band and the ward
 * wealth the canonical plan already assigned. No rolls, so the same burg always
 * reads the same way in the 2D map, the 3D town and the rumor mill.
 *
 * All three lookup tables are TOTAL over their closed FMG vocabulary and THROW
 * on an unknown key, mirroring `climateForBiomeId` and `styleFamilyForCultureType`
 * (no-fallback directive) — an unmapped biome must not quietly become temperate.
 * ------------------------------------------------------------------ */

/**
 * FMG biome id (0-12, the vocabulary documented on `BIOME_TO_CLIMATE`) → the
 * `VillagePersonality.biomeStyle` the profile table is keyed on.
 *
 * `volcanic` and `blighted` have authored profiles but no FMG biome produces
 * them, so no burg resolves to those two. That is honest: the atlas has no
 * volcano and no blight layer to read.
 */
export const FMG_BIOME_TO_VILLAGE_STYLE: Record<number, VillagePersonality['biomeStyle']> = {
  0: 'coastal',    // Marine
  1: 'arid',       // Hot desert
  2: 'arid',       // Cold desert
  3: 'temperate',  // Savanna
  4: 'temperate',  // Grassland
  5: 'jungle',     // Tropical seasonal forest
  6: 'temperate',  // Temperate deciduous forest
  7: 'jungle',     // Tropical rainforest
  8: 'temperate',  // Temperate rainforest
  9: 'tundra',     // Taiga
  10: 'tundra',    // Tundra
  11: 'polar',     // Glacier
  12: 'swampy',    // Wetland
};

/** The personality facets an FMG culture type decides. */
interface CultureFlavor {
  culture: VillagePersonality['culture'];
  architecturalStyle: VillagePersonality['architecturalStyle'];
  primaryIndustry: VillagePersonality['primaryIndustry'];
  /** Highland culture overrides the biome table: the burg reads as upland. */
  upland: boolean;
}

/**
 * FMG culture types (Azgaar) → personality facets. Same closed vocabulary as
 * `CULTURE_TYPE_TO_FAMILY` in `architectureStyle.ts`, so the two tables cannot
 * drift apart: a culture type that gets an architecture family also gets a
 * personality here.
 */
const CULTURE_TYPE_TO_FLAVOR: Record<string, CultureFlavor> = {
  Highland: { culture: 'martial', architecturalStyle: 'industrial', primaryIndustry: 'mining', upland: true },
  Naval: { culture: 'festive', architecturalStyle: 'aquatic', primaryIndustry: 'fishing', upland: false },
  Lake: { culture: 'scholarly', architecturalStyle: 'aquatic', primaryIndustry: 'fishing', upland: false },
  River: { culture: 'festive', architecturalStyle: 'medieval', primaryIndustry: 'trade', upland: false },
  Hunting: { culture: 'stoic', architecturalStyle: 'tribal', primaryIndustry: 'agriculture', upland: false },
  Nomadic: { culture: 'stoic', architecturalStyle: 'nomadic', primaryIndustry: 'trade', upland: false },
  Generic: { culture: 'stoic', architecturalStyle: 'medieval', primaryIndustry: 'agriculture', upland: false },
};

/** Who runs the place, by settlement size class. */
const TYPOLOGY_TO_GOVERNMENT: Record<TownTypology, VillagePersonality['governingBody']> = {
  hamlet: 'elder',
  village: 'mayor',
  'walled town': 'council',
  city: 'guild',
  capital: 'monarch',
};

/** Size class → the three-band population the profile table is keyed on. */
const TYPOLOGY_TO_POPULATION_BAND: Record<TownTypology, VillagePersonality['population']> = {
  hamlet: 'small',
  village: 'small',
  'walled town': 'medium',
  city: 'large',
  capital: 'large',
};

/**
 * Collapse the per-ward social classes the plan already carries into one town
 * wealth band. `assignWardWealth` scores every ward by its distance to the
 * prestige anchors, so the wealthy-minus-poor share is a real measure of how
 * much of the town hugs power. Threshold 0.15 keeps the middle band wide: most
 * towns are `comfortable`, and `rich`/`poor` mean something when they appear.
 */
function townWealthBand(wards: TownWard[]): VillagePersonality['wealth'] {
  let wealthy = 0;
  let poor = 0;
  let counted = 0;
  for (const w of wards) {
    if (!w.wealth) continue;
    counted += 1;
    if (w.wealth === 'wealthy') wealthy += 1;
    else if (w.wealth === 'poor') poor += 1;
  }
  if (counted === 0) {
    throw new Error('Cannot derive town wealth: no ward on the canonical plan carries a social class');
  }
  const score = (wealthy - poor) / counted;
  if (score > 0.15) return 'rich';
  if (score < -0.15) return 'poor';
  return 'comfortable';
}

/** The personality of a burg plus the flavor profile it resolves to. */
export interface CanonicalTownPersonality {
  /** The derived settlement personality (the resolver's input). */
  personality: VillagePersonality;
  /** The authored flavor: tagline, cultural signature, encounter hooks, AI prompt. */
  profile: VillageIntegrationProfile;
}

// Memoize per atlas (object identity) → per burg, exactly like `planCache`.
const personalityCache = new WeakMap<object, Map<number, CanonicalTownPersonality>>();

/**
 * The canonical settlement personality for a burg, and the authored
 * {@link VillageIntegrationProfile} it resolves to.
 *
 * This is the ONE production caller of `resolveVillageIntegrationProfile` under
 * `src/systems/worldforge/`. Every surface that wants a town's flavor — the 2D
 * plan caption, the crier, the rumor mill — reads it from here, so they cannot
 * describe the same burg two different ways.
 *
 * Pure and deterministic: same (atlas, worldSeed, burgId) ⇒ same profile.
 * Throws when the atlas cannot answer the burg's culture or biome, matching
 * {@link canonicalArtifactTownForSiteFromAtlas}.
 */
export function getCanonicalTownPersonality(
  atlas: TownAtlas,
  worldSeed: number,
  burgId: number,
): CanonicalTownPersonality {
  let perBurg = personalityCache.get(atlas as object);
  if (!perBurg) { perBurg = new Map(); personalityCache.set(atlas as object, perBurg); }
  const hit = perBurg.get(burgId);
  if (hit) return hit;

  const burg = atlas.pack.burgs?.[burgId];
  if (!burg || burg.removed) {
    throw new Error(`Cannot resolve canonical burg ${burgId} in world ${worldSeed}`);
  }

  const cultureId = burg.culture ?? 0;
  const cultureType = (atlas.pack.cultures?.[cultureId] as { type?: string } | undefined)?.type;
  if (!cultureType) {
    throw new Error(`Cannot resolve culture ${cultureId} for burg ${burgId} in world ${worldSeed}`);
  }
  const flavor = CULTURE_TYPE_TO_FLAVOR[cultureType];
  if (!flavor) {
    throw new Error(
      `No settlement personality for culture type "${cultureType}" ` +
      `(known types: ${Object.keys(CULTURE_TYPE_TO_FLAVOR).join(', ')})`,
    );
  }

  const biomeId = (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[burg.cell];
  if (biomeId === undefined) {
    throw new Error(`Cannot resolve biome for burg ${burgId} in world ${worldSeed}`);
  }
  const biomeStyle = FMG_BIOME_TO_VILLAGE_STYLE[Number(biomeId)];
  if (!biomeStyle) {
    throw new Error(
      `No settlement biome style for FMG biome id ${biomeId} ` +
      `(known ids: ${Object.keys(FMG_BIOME_TO_VILLAGE_STYLE).join(', ')})`,
    );
  }

  // A harbour reads as coastal whatever grows inland of it; an upland culture
  // reads as highland whatever the cell's biome band says. Port wins, because a
  // working waterfront is the loudest fact about a settlement.
  const resolvedStyle: VillagePersonality['biomeStyle'] =
    burg.port ? 'coastal' : flavor.upland ? 'highland' : biomeStyle;

  const typology = typologyForPopulation(peopleForBurg(atlas, burgId));
  const plan = getCanonicalTownPlan(atlas, worldSeed, burgId);

  const personality: VillagePersonality = {
    wealth: townWealthBand(plan.wards),
    culture: flavor.culture,
    biomeStyle: resolvedStyle,
    population: TYPOLOGY_TO_POPULATION_BAND[typology],
    architecturalStyle: flavor.architecturalStyle,
    governingBody: TYPOLOGY_TO_GOVERNMENT[typology],
    primaryIndustry: flavor.primaryIndustry,
  };

  const resolved: CanonicalTownPersonality = {
    personality,
    profile: resolveVillageIntegrationProfile(personality),
  };
  perBurg.set(burgId, resolved);
  return resolved;
}

const mapPt = (p: Pt, k: number, dx: number, dy: number): Pt => [p[0] * k + dx, p[1] * k + dy];
const mapPoly = (poly: Pt[], k: number, dx: number, dy: number): Pt[] =>
  poly.map((p) => mapPt(p, k, dx, dy));

/**
 * Affine map (scale then translate) every coordinate of a town plan. Pure;
 * returns a new plan and leaves the cached normalized plan untouched. Because
 * the geometry was computed once and only transformed here, the 3D town is the
 * same relative town as the 2D one.
 */
export function transformTownPlan(plan: TownPlan, k: number, dx = 0, dy = 0): TownPlan {
  const wards = plan.wards.map((w) => ({
    // Preserve non-geometric ward facts such as wealth, civic role, and the
    // architecture district. The previous field-by-field copy silently dropped
    // wealth before 3D adaptation, so transformed towns lost their social finish.
    ...w,
    polygon: mapPoly(w.polygon, k, dx, dy),
    block: mapPoly(w.block, k, dx, dy),
    plots: w.plots.map((pl) => ({ ...pl, polygon: mapPoly(pl.polygon, k, dx, dy) })),
  }));
  return {
    footprint: mapPoly(plan.footprint, k, dx, dy),
    core: mapPoly(plan.core, k, dx, dy),
    wards,
    // Top-level plots share refs with wards[].plots (townEngine contract).
    plots: wards.flatMap((w) => w.plots),
    outskirts: plan.outskirts.map((o) => ({ ...o, polygon: mapPoly(o.polygon, k, dx, dy) })),
    // Intramural open land rides the same affine, so the gardens/paddocks the 2D
    // map shows inside the walls are the same parcels the 3D town stands on.
    openLand: plan.openLand.map((o) => ({ ...o, polygon: mapPoly(o.polygon, k, dx, dy) })),
    walls: {
      ring: mapPoly(plan.walls.ring, k, dx, dy),
      gatehouses: mapPoly(plan.walls.gatehouses, k, dx, dy),
      // TG7: carry the river↔wall crossing points through the transform so the 3D
      // bake can break the wall ring for a water-gate where a river passes through
      // (previously dropped here, so the river clipped solid stone).
      waterGates: plan.walls.waterGates ? mapPoly(plan.walls.waterGates, k, dx, dy) : [],
    },
    civic: plan.civic.map((c) => ({ ...c, polygon: mapPoly(c.polygon, k, dx, dy) })),
    streets: plan.streets.map((s) => mapPoly(s, k, dx, dy)),
    // The street network rides the same affine — INCLUDING its widths, which
    // are lengths in plan units. Scaling the centerlines but not the widths is
    // exactly how a town ends up with 3D ribbons that do not fit the gaps its
    // own generator left between the blocks.
    streetNetwork: plan.streetNetwork.map((st) => ({
      ...st,
      centerline: mapPoly(st.centerline, k, dx, dy),
      width: st.width * Math.abs(k),
    })),
    // Court identity and amenity remain unchanged; only the spatial receipt is
    // transformed into the destination frame used by the artifact adapter.
    courtyards: plan.courtyards.map((court) => ({
      ...court,
      center: mapPt(court.center, k, dx, dy),
      radius: court.radius * Math.abs(k),
    })),
    farmsteads: plan.farmsteads.map((f) => ({ ...f, x: f.x * k + dx, y: f.y * k + dy })),
    demographics: plan.demographics,
  };
}

/**
 * Adapt one Atlas burg into the exact feet-space artifact consumed by both the
 * Local map and Ground 3D.
 *
 * Callers provide the Atlas they already own. This keeps standalone Atlas
 * inspection, native PLAYING descent, save reconstruction, and the 3D bake on
 * one plan source without forcing them through a second cell-addressed world.
 */
export function canonicalArtifactTownForSiteFromAtlas(
  atlas: TownAtlas,
  worldSeed: number,
  site: RegionTownSite,
): AdaptedTownPlan & { family: StyleFamily } {
  const burg = atlas.pack.burgs?.[site.burgId];
  if (!burg || burg.removed || !burg.i) {
    throw new Error(`Cannot resolve canonical Atlas burg ${site.burgId} in world ${worldSeed}`);
  }

  // Resolve culture and biome from this same Atlas object. These are visual
  // identity inputs, so silently consulting another cached world would make
  // the Local plan and 3D architecture disagree even if their burg ids match.
  const cultureId = burg.culture ?? 0;
  const culture = atlas.pack.cultures?.[cultureId] as { type?: string } | undefined;
  if (!culture?.type) {
    throw new Error(
      `Cannot resolve culture ${cultureId} for canonical burg ${site.burgId} in world ${worldSeed}`,
    );
  }
  const biomeId = (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[burg.cell];
  if (biomeId === undefined) {
    throw new Error(
      `Cannot resolve biome for canonical burg ${site.burgId} in world ${worldSeed}`,
    );
  }

  // Generate in the normalized burg frame once, then place that exact result
  // into the Region envelope used by the retained Local and Ground window.
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, site.burgId);
  const spanFt = townSpanFtForBurg(atlas, site.burgId);
  const placeScale = spanFt / CANON_TOWN_SPAN;
  const placeDx = site.envelope.x + site.envelope.width / 2;
  const placeDy = site.envelope.y + site.envelope.height / 2;
  const feetPlan = transformTownPlan(enginePlan, placeScale, placeDx, placeDy);
  const family = styleFamilyForCultureType(culture.type);
  const adapted = toArtifactPlan(
    feetPlan,
    site.burgId,
    family,
    climateForBiomeId(Number(biomeId)),
  );

  // Current Regions already carry this exact receipt. The legacy construction
  // branch is deliberately centralized here so old fixtures gain one stable
  // name instead of making each renderer fall back independently.
  const isCoastal = Boolean(burg.port);
  const identity = site.identity ?? {
    kind: 'town' as const,
    sourceKind: 'atlas-burg' as const,
    sourceId: site.burgId,
    name: burg.name ?? `Burg ${site.burgId}`,
    settlementType: burg.capital ? 'capital' as const : isCoastal ? 'port' as const : 'town' as const,
    biomeId: Number(biomeId),
    hasRoadAccess: site.gates.length > 0,
    hasRiverAccess: Boolean(
      (atlas.pack.cells as unknown as { r?: ArrayLike<number> }).r?.[burg.cell],
    ),
    isCoastal,
  };

  return {
    ...adapted,
    plan: {
      ...adapted.plan,
      identity,
    },
    family,
  };
}
