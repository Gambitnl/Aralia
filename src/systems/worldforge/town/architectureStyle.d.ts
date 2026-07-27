/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 17/07/2026, 21:35:30
 * Dependents: components/DesignPreview/steps/PreviewTown3D.tsx, components/DesignPreview/steps/PreviewTowns.tsx, components/MapPane.tsx, components/World3D/World3DScene.tsx, components/Worldforge/TownPlanView.tsx, devtools/buildingIdentityLab/BuildingIdentityLab.tsx, devtools/buildingIdentityLab/buildingIdentityLabModel.ts, systems/world3d/buildingModels.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/town/buildingMotifs.ts, systems/worldforge/town/buildingWeathering.ts, systems/worldforge/town/demoTownPlan.ts, systems/worldforge/town/townPlanAdapter.ts, systems/worldforge/town/voronoiTownAdapter.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/registerBurgMerchants.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file architectureStyle.ts — regional architecture style families.
 *
 * Single source of truth for HOW a culture builds: palettes, roof shapes,
 * facade grammars, gatehouse forms, and dock/bridge detailing. Shared by the
 * 2D town map and the 3D ground renderer, sibling of buildingStyle.ts.
 *
 * Architectural identity is layered. Culture and climate define the town-wide
 * family, a settlement/district key chooses a dominant local dialect, and the
 * building key permits bounded exceptions. A burg's family comes from its FMG
 * culture TYPE — deterministic, and per the no-fallback directive an unknown
 * type is an ERROR, not a default. Climate additionally constrains the
 * physical construction kits (CLIMATE_KIT_FITNESS): a desert town cannot keep
 * reed-thatch, a marsh cannot keep mud walls — banned picks remap
 * deterministically inside the same family's closed kit vocabulary.
 */
import type { Pt } from '../submap/submapEngine';
import type { ArchitectureIdentity, BriefWealth, BuildingConstruction, BuildingEnsemble, BuildingType, FacadePattern, RoofCovering, StyleResolved, WallMaterial } from '../interior/blueprintTypes';
import { type SeedPath } from '../seedPath';
import { type ArchitectureFamilyId } from './buildingMaterials';
export type RoofForm = 'gable' | 'hip' | 'steep' | 'flat';
export type GatehouseForm = 'twinTowers' | 'tunnelBlock' | 'singleTower';
export interface DeckDetail {
    /** Support-post spacing along dock/bridge edges (meters). */
    pilingSpacingM: number;
    railing: boolean;
    /** Parabolic mid-span lift for bridges (meters). 0 = flat span. */
    archRiseM: number;
}
export interface StyleFamily {
    id: ArchitectureFamilyId;
    wallPalette: string[];
    roofPalette: string[];
    roofForms: RoofForm[];
    /** Wall-detail grammars this culture knows how to build. */
    facadePatterns: FacadePattern[];
    gatehouseForms: GatehouseForm[];
    /** Town rampart tint. */
    wallTint: string;
    chimneys: boolean;
    deckDetail: DeckDetail;
}
export declare const STYLE_FAMILIES: Record<StyleFamily['id'], StyleFamily>;
export declare function styleFamilyForCultureType(cultureType: string): StyleFamily;
/**
 * FMG biome id → architectural ClimateClass. The closed vocabulary is the 13
 * biomes of `fmg/biomes.ts` Biomes.getDefault().name (ids 0-12):
 *   0 Marine, 1 Hot desert, 2 Cold desert, 3 Savanna, 4 Grassland,
 *   5 Tropical seasonal forest, 6 Temperate deciduous forest,
 *   7 Tropical rainforest, 8 Temperate rainforest, 9 Taiga, 10 Tundra,
 *   11 Glacier, 12 Wetland.
 * Keyed on the id (not the name) because that is what a burg's cell carries
 * (`atlas.pack.cells.biome[burg.cell]`, a Uint8Array of ids). Cold-frame
 * biomes (Cold desert, Taiga, Tundra, Glacier) drive steep snow-shed roofs;
 * Hot desert is the sole arid; Wetland is marsh; everything else is temperate.
 * The table is TOTAL over 0-12 — an out-of-range id is an ERROR (no-fallback
 * directive, mirroring styleFamilyForCultureType's throw), so an unmapped
 * biome fails honestly rather than defaulting to temperate.
 */
export declare const BIOME_TO_CLIMATE: Record<number, ClimateClass>;
/** Resolve a burg's FMG biome id to a ClimateClass; throws on an id outside the
 *  closed 0-12 vocabulary (no-fallback — an unknown biome must not silently
 *  become temperate). */
export declare function climateForBiomeId(biomeId: number): ClimateClass;
/** Stable 0..1 hash of two ints (same recipe as townPlanAdapter.centroidHash01). */
export declare function hash01(a: number, b: number): number;
/** Bounding box of the plan the plot belongs to — the hashing reference frame. */
export interface StyleFrame {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
/** Bounding box of a polygon (typically the town plan's footprint). */
export declare function styleFrameOf(footprint: Pt[]): StyleFrame;
/**
 * Per-plot style picks, keyed on the plot POLYGON's position NORMALIZED to the
 * plan's footprint bbox (`frame`) — so the 2D map (engine plan, normalized
 * frame) and the 3D bake (artifact plan, region feet) derive identical
 * colors/forms for the same building despite the scale+translate between them.
 */
export declare function styledWallColor(fam: StyleFamily, poly: Pt[], frame: StyleFrame): string;
export declare function styledRoof(fam: StyleFamily, poly: Pt[], frame: StyleFrame): {
    form: RoofForm;
    color: string;
};
export declare function styledGatehouseForm(fam: StyleFamily, gateIndex: number, burgId: number): GatehouseForm;
/** Climate class driving roof steepness, eave depth, and plinth. */
export type ClimateClass = 'temperate' | 'cold' | 'arid' | 'marsh';
export interface ResolveStyleInput {
    /** FMG culture type — mapped to a family (throws on unknown, no fallback). */
    cultureType: string;
    climate: ClimateClass;
    wealth: 'poor' | 'common' | 'wealthy';
    /** Construction age controls visible patina without changing geometry. */
    ageBand?: 'new' | 'aged' | 'old' | 'ancient';
    /** Optional town/district/building identity for coordinated architecture. */
    architecture?: ArchitectureIdentity;
    /** Immediate block contract; dense rows coordinate their roof rhythm here. */
    ensemble?: BuildingEnsemble;
    buildingType: BuildingType;
}
/**
 * Restrict a family palette to the materials one finish tier can afford.
 *
 * The history resolver reuses this exact rule for repairs and later additions,
 * preventing an old poor house from acquiring a wealthy roof merely because a
 * re-roofing event was rolled.
 */
export declare function finishPaletteForTier<T>(palette: readonly T[], wealth: BriefWealth): T[];
/**
 * The construction bans one climate imposes, plus its ranked replacement
 * preference. Pure editable DATA — extend the ban lists or reorder the
 * preference without touching the remap algorithm below.
 */
export interface ClimateKitFitness {
    /** Roof coverings this climate cannot keep functional. */
    bannedCoverings: readonly RoofCovering[];
    /** Wall materials this climate destroys. */
    bannedWallMaterials: readonly WallMaterial[];
    /**
     * Best-fit-first covering order used to choose the replacement kit when a
     * ban fires. A covering missing from the list ranks last; remaining ties are
     * broken by the family's kit declaration order, so the remap is a pure
     * lookup — deterministic, no hash draw consumed.
     */
    coveringPreference: readonly RoofCovering[];
}
/**
 * Per-climate fitness table (closed over the 4 ClimateClass values).
 *
 * - temperate: bans nothing — the guaranteed byte-identical baseline.
 * - arid: reeds and living sod cannot exist in a desert; baked/mineral
 *   coverings (clay tile first) are the near fit.
 * - cold: reed thatch rots under snow-melt soak; the preference lists the
 *   family's HEAVIEST covering first (stone slab, then turf/sod, slate, tile)
 *   per the snow-load rule.
 * - marsh: mud/earth walls (wattle-daub) dissolve in standing water; reed
 *   thatch is the marsh-native covering and ranks first for replacements.
 */
export declare const CLIMATE_KIT_FITNESS: Readonly<Record<ClimateClass, ClimateKitFitness>>;
/**
 * Enforce the climate fitness table on one already-resolved construction kit.
 *
 * When the picked kit survives its climate the INPUT OBJECT is returned
 * untouched (temperate always takes this path — byte-identical by
 * construction). When the kit's covering or wall is banned, the whole kit is
 * remapped to the family's best-fit allowed sibling: swapping the complete kit
 * (not just the covering) keeps kitId/wall/covering/foundation receipts
 * self-consistent and also fixes companion absurdities the operator called out
 * (desert timber piles ride along with desert thatch). The replacement is a
 * pure function of (family, climate) — same inputs always remap to the same
 * kit, never a reroll. Shutters stay as resolved (they are a family-wide
 * district trait, not kit-bound) and constructionSignature keeps naming the
 * district's picked recipe. Vocabulary stays closed: the replacement comes
 * from the SAME family's three kits. A table that bans every kit of a family
 * throws (no-fallback directive) instead of borrowing another family's kit.
 */
export declare function applyClimateKitFitness(familyId: ArchitectureFamilyId, climate: ClimateClass, wealth: BriefWealth, construction: BuildingConstruction): BuildingConstruction;
/** The bounded choices one identified building contributes to its district. */
export interface ArchitectureVariant {
    wallColor: string;
    roofColor: string;
    roofForm: RoofForm;
    facadePattern: FacadePattern;
    /** Shared by every building using the same family, settlement, and spatial district. */
    districtSignature: string;
    /** Different for every stable building key inside that district. */
    buildingVariant: string;
    /** Small silhouette change; deliberately too narrow to leave the family grammar. */
    pitchScale: number;
    /** Small eave change in feet; climate still supplies the dominant value. */
    eaveOffsetFt: number;
    /** Physical material kit coordinated at district scope. */
    construction: BuildingConstruction;
}
/**
 * Resolve one building's bounded variation inside a stable district dialect.
 *
 * Cohesion ratios are intentional game rules rather than incidental hash
 * behavior: roughly 70-80% of buildings repeat each district dominant. The
 * remaining buildings select from the SAME culture family's palette, roof
 * forms, and facade grammar. Wealth narrows the color palettes before either
 * district or building choices happen, so a poor quarter cannot borrow a rich
 * quarter's dressed finish simply because its building key changed.
 */
export declare function resolveArchitectureVariant(family: StyleFamily, climate: ClimateClass, wealth: BriefWealth, identity: ArchitectureIdentity, ensemble?: BuildingEnsemble, buildingType?: BuildingType): ArchitectureVariant;
/**
 * Resolve the full architectural dress for one building.
 *
 * THREE legacy draws remain in a FIXED order regardless of input (roof form,
 * wall, roof), so old calls without an architecture identity keep their exact
 * results. Identified production buildings replace those three visible answers
 * with the district/building variant above, but still consume the legacy draws
 * to keep the stream contract easy to audit. Climate is pure post-processing
 * and consumes no draws. Trim remains the family's shared construction color.
 */
export declare function resolveStyle(input: ResolveStyleInput, path: SeedPath): StyleResolved;
