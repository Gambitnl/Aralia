/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 14:54:48
 * Dependents: components/Worldforge/TownPlanView.tsx, systems/worldforge/town/architectureStyle.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file buildingMotifs.ts
 *
 * Resolves exterior type-recognition motifs without touching blueprint bones.
 * A shop should advertise itself, a smithy should vent heat, a temple should
 * interrupt the skyline, and a keep should read as defensive before a label is
 * visible. Culture adds one familiar accent, while a district chooses the
 * dominant treatment used by buildings of the same type.
 *
 * Every decision is a named hash. Adding a future motif category cannot shift
 * existing choices, and no geometry RNG stream is consumed.
 */
import type { BuildingMotif, BuildingType } from '../interior/blueprintTypes';
import type { StyleFamily } from './architectureStyle';
export interface BuildingMotifProgram {
    /** Required role cues that every building of this type receives. */
    core: readonly BuildingMotif[];
    /** District-selected treatments; most siblings repeat one dominant choice. */
    districtChoices: readonly BuildingMotif[];
}
/**
 * Role grammar for every generated building type.
 *
 * Core cues carry recognition. District choices keep streets from cloning one
 * exact facade while still limiting each type to a small local vocabulary.
 */
export declare const BUILDING_MOTIF_PROGRAMS: Record<BuildingType, BuildingMotifProgram>;
export interface BuildingMotifResolution {
    motifs: BuildingMotif[];
    motifVariant: 0 | 1 | 2;
    /** Shared district/type recipe even when a minority building uses the alternate. */
    motifSignature: string;
}
/**
 * Resolve one building's role motifs inside its culture and district.
 *
 * Roughly 82% of same-type buildings repeat the district's dominant treatment;
 * the remainder use the one related alternative. Core role cues and family
 * accents never disappear, so variation cannot erase recognizability.
 */
export declare function resolveBuildingMotifs(familyId: StyleFamily['id'], buildingType: BuildingType, districtSignature: string, buildingVariant: string): BuildingMotifResolution;
