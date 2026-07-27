/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 02:11:15
 * Dependents: devtools/buildingIdentityLab/BuildingIdentityLab.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { TownPlan as ArtifactTownPlan } from '@/systems/worldforge/artifacts';
import type { BlueprintPlan } from '@/systems/worldforge/interior/blueprintTypes';
import { STYLE_FAMILIES, type ClimateClass, type StyleFamily } from '@/systems/worldforge/town/architectureStyle';
import { type TownPlan as EngineTownPlan, type TownTypology } from '@/systems/worldforge/town/townEngine';
/**
 * This pure model composes the production town, artifact, and blueprint pipelines
 * for the standalone Building Identity Lab. It also derives compact district statistics so
 * coherence and variation can be tested without React, a browser, or WebGL.
 *
 * Since 2026-07-18 the model also EARNS the lab's pass badge: for a bounded
 * deterministic sample of plots per district it rebuilds the real production
 * blueprint and requires the facts both pipelines stamp (roof form, wall and
 * roof color, district signature, building variant) to agree exactly. The old
 * badge only compared signature strings and stayed green while the lab's two
 * panes contradicted each other (critic finding 5, 2026-07-17).
 */
export interface HarnessTownPreset {
    label: string;
    typology: TownTypology;
    population: number;
}
export declare const HARNESS_TOWNS: HarnessTownPreset[];
export type HarnessStyleId = keyof typeof STYLE_FAMILIES;
export interface HarnessStyleOption {
    id: HarnessStyleId;
    label: string;
    cultureType: string;
}
export declare const HARNESS_STYLES: HarnessStyleOption[];
export declare const HARNESS_CLIMATES: ClimateClass[];
export type HarnessPlot = ArtifactTownPlan['plots'][number];
/** The rendered facts stamped by BOTH the artifact plan and the blueprint. */
export type BuildingFactField = 'roofForm' | 'wallColor' | 'roofColor' | 'districtSignature' | 'buildingVariant';
/** One disagreement between the 2D town-plan receipt and the 3D blueprint. */
export interface DistrictFactMismatch {
    plotId: number;
    field: BuildingFactField;
    /** Value stamped on the artifact town plan (what the map and strip show). */
    townPlanValue: string;
    /** Value resolved by the production blueprint (what the 3D pane shows). */
    blueprintValue: string;
}
export interface DistrictAudit {
    key: string;
    label: string;
    wealth: string;
    buildings: number;
    signatures: string[];
    variants: number;
    ensembleKinds: string[];
    wallColors: string[];
    roofColors: string[];
    /** Signature-string equality only — the pre-2026-07-18 badge claim. */
    coherent: boolean;
    /** Plot ids whose production blueprints were rebuilt for the fact check. */
    sampledPlots: number[];
    /** Every sampled disagreement between town plan and blueprint (empty = agree). */
    factMismatches: DistrictFactMismatch[];
    /** True only when signatures are coherent AND every sampled fact agrees. */
    verified: boolean;
}
export interface HarnessTownModel {
    seed: number;
    climate: ClimateClass;
    style: HarnessStyleOption;
    styleFamily: StyleFamily;
    enginePlan: EngineTownPlan;
    artifactPlan: ArtifactTownPlan;
    districts: DistrictAudit[];
    ensembleCounts: Record<string, number>;
    /** All sampled fact disagreements in district display order (empty = pass). */
    factMismatches: DistrictFactMismatch[];
    /**
     * Measured wall-clock cost of the sampled blueprint cross-check. Timing
     * only — deliberately excluded from determinism comparisons and receipts
     * equality; it exists so regressions in check cost are visible.
     */
    crossCheckMs: number;
}
export interface BuildHarnessTownOptions {
    seed: number;
    population: number;
    styleId: HarnessStyleId;
    climate: ClimateClass;
    withRiver: boolean;
}
/**
 * Compare one plot's artifact receipt against one blueprint's resolved dress.
 * Pure and exported so tests can prove DETECTION with a doctored receipt
 * rather than trusting the badge's own plumbing. A side that carries no value
 * reports the literal string 'missing' — an absent fact is a verification
 * failure, never a silent skip.
 */
export declare function compareBuildingFacts(plot: HarnessPlot, styleResolved: BlueprintPlan['styleResolved']): DistrictFactMismatch[];
/** Build one complete audit town through the same generators used by the game. */
export declare function buildHarnessTown(options: BuildHarnessTownOptions): HarnessTownModel;
/**
 * Rebuild the exact production blueprint input for an adapted town plot.
 * Delegates to the same helper the badge cross-check samples through, so the
 * selected-building pane and the verification badge can never diverge paths.
 */
export declare function blueprintForHarnessPlot(model: HarnessTownModel, plotId: number): BlueprintPlan;
