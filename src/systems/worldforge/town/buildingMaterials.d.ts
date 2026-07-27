/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 14:29:40
 * Dependents: systems/worldforge/town/architectureStyle.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file defines and resolves the physical construction kits used by towns.
 *
 * A culture family owns a closed set of related wall, roof, foundation, window,
 * shutter, and ornament combinations. One district chooses a dominant kit and
 * one permitted alternative; individual buildings usually repeat the dominant
 * choice. The resolver returns pure data for architectureStyle, the town map,
 * artifacts, and the 3D bridge, with no renderer-specific decisions here.
 *
 * Called by: architectureStyle.ts and material-focused tests
 * Depends on: blueprint material contracts and frozen seed hashing
 */
import type { ArchitectureIdentity, BriefWealth, BuildingConstruction, ConstructionKitId, FoundationTreatment, GlazingType, OrnamentKit, RoofCovering, ShutterStyle, WallMaterial } from '../interior/blueprintTypes';
export type ArchitectureFamilyId = 'highlandStone' | 'coastalTimber' | 'riverHalfTimber' | 'roughLog' | 'temperateFrame';
type WealthTriplet<T> = readonly [poor: T, common: T, wealthy: T];
/** One family-approved kit before wealth and district choices are resolved. */
export interface ConstructionKitDefinition {
    id: ConstructionKitId;
    wallMaterial: WallMaterial;
    wallCourseFt: number;
    timberWidthFt: number;
    roofCovering: RoofCovering;
    foundation: FoundationTreatment;
    glazingByWealth: WealthTriplet<GlazingType>;
    shutters: readonly ShutterStyle[];
    ornamentByWealth: WealthTriplet<OrnamentKit>;
}
export declare const CONSTRUCTION_KITS: Readonly<Record<ArchitectureFamilyId, readonly ConstructionKitDefinition[]>>;
/** Return a defensive copy of one family's closed kit vocabulary. */
export declare function constructionKitsForFamily(familyId: ArchitectureFamilyId): readonly ConstructionKitDefinition[];
/** Input shared by identified production buildings and standalone previews. */
export interface ResolveBuildingConstructionInput {
    familyId: ArchitectureFamilyId;
    wealth: BriefWealth;
    architecture?: ArchitectureIdentity;
    /** Stable style path used only when no town/district/building identity exists. */
    standaloneKey: string;
}
/**
 * Resolve one building's material kit inside its district's construction rules.
 *
 * The district owns a dominant kit, one related alternative, and a dominant
 * shutter treatment. Buildings independently repeat those answers about 78%
 * of the time. Wealth changes glazing and ornament quality inside the selected
 * kit, but never lets the building leave its culture family's vocabulary.
 */
export declare function resolveBuildingConstruction(input: ResolveBuildingConstructionInput): BuildingConstruction;
export {};
