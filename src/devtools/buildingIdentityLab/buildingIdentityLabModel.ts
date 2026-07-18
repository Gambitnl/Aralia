// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 01:32:09
 * Dependents: devtools/buildingIdentityLab/BuildingIdentityLab.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan as ArtifactTownPlan } from '@/systems/worldforge/artifacts';
import type { BlueprintPlan } from '@/systems/worldforge/interior/blueprintTypes';
import { blueprintForPlot } from '@/systems/worldforge/interior/generateInterior';
import { rootSeedPath } from '@/systems/worldforge/seedPath';
import type { Pt } from '@/systems/worldforge/submap/submapEngine';
import {
  STYLE_FAMILIES,
  type ClimateClass,
  type StyleFamily,
} from '@/systems/worldforge/town/architectureStyle';
import { buildingPlotInput } from '@/systems/worldforge/town/buildingPlotInput';
import {
  generateTownPlan,
  type TownPlan as EngineTownPlan,
  type TownTypology,
} from '@/systems/worldforge/town/townEngine';
import { toArtifactPlan } from '@/systems/worldforge/town/townPlanAdapter';

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

// ============================================================================
// Stable Harness Presets
// ============================================================================
// These presets vary settlement density without inventing a second town recipe.
// The population values are the same representative bands used by PreviewTowns.
// ============================================================================

export interface HarnessTownPreset {
  label: string;
  typology: TownTypology;
  population: number;
}

export const HARNESS_TOWNS: HarnessTownPreset[] = [
  { label: 'Hamlet', typology: 'hamlet', population: 60 },
  { label: 'Village', typology: 'village', population: 450 },
  { label: 'Walled town', typology: 'walled town', population: 3200 },
  { label: 'City', typology: 'city', population: 14000 },
];

export type HarnessStyleId = keyof typeof STYLE_FAMILIES;

export interface HarnessStyleOption {
  id: HarnessStyleId;
  label: string;
  cultureType: string;
}

// Each family is paired with the production culture name that resolves back to it.
// This keeps the artifact stamp and selected-building blueprint on the same path.
export const HARNESS_STYLES: HarnessStyleOption[] = [
  { id: 'temperateFrame', label: 'Temperate frame', cultureType: 'Generic' },
  { id: 'riverHalfTimber', label: 'River half-timber', cultureType: 'River' },
  { id: 'highlandStone', label: 'Highland stone', cultureType: 'Highland' },
  { id: 'coastalTimber', label: 'Coastal timber', cultureType: 'Naval' },
  { id: 'roughLog', label: 'Rough log', cultureType: 'Hunting' },
];

export const HARNESS_CLIMATES: ClimateClass[] = ['temperate', 'cold', 'arid', 'marsh'];

// A fixed irregular footprint ensures every reroll changes authored decisions,
// not the outer test geometry. Water and road lines exercise waterfront districts.
const CX = 360;
const CY = 360;
const RADIUS = 300;
const FOOTPRINT: Pt[] = [
  [CX - RADIUS * 0.95, CY - RADIUS * 0.35],
  [CX - RADIUS * 0.2, CY - RADIUS * 0.95],
  [CX + RADIUS * 0.7, CY - RADIUS * 0.7],
  [CX + RADIUS * 0.95, CY + RADIUS * 0.15],
  [CX + RADIUS * 0.45, CY + RADIUS * 0.9],
  [CX - RADIUS * 0.5, CY + RADIUS * 0.85],
  [CX - RADIUS * 0.95, CY + RADIUS * 0.25],
];
const RIVER: Pt[] = [
  [CX - RADIUS, CY - 40],
  [CX - 120, CY + 10],
  [CX + 10, CY - 30],
  [CX + 130, CY + 60],
  [CX + RADIUS, CY + 120],
];
const ROAD: Pt[] = [
  [CX - RADIUS - 60, CY + 120],
  [CX - 40, CY + 80],
  [CX + 60, CY - 40],
  [CX + RADIUS + 60, CY - 90],
];

// ============================================================================
// Audit Model
// ============================================================================
// District rows expose the two promises under test: one repeated architectural
// signature inside a district and multiple bounded building variants beneath it.
// ============================================================================

export type HarnessPlot = ArtifactTownPlan['plots'][number];

// ============================================================================
// Rendered-Fact Cross-Check
// ============================================================================
// What changed (2026-07-18): the district audit now cross-checks the artifact
// town plan against the production blueprint resolver instead of trusting
// signature-string equality alone.
// Why: the town-plan stamps come from townPlanAdapter -> resolveArchitectureVariant
// while the selected-building pane comes from blueprintForPlot -> resolveStyle.
// Those are two independent resolution paths; when they diverged (the cold/arid
// roof-form contradiction, critic finding 3) the old badge stayed green because
// it never compared their answers. The badge must claim only what was verified.
// What was preserved: `coherent` (signature equality) remains computed and
// reported — it is one input to `verified`, not the whole claim.
// Uncertain/deferred: only facts BOTH sides stamp are comparable here; deeper
// dress facts (construction kit, motifs, weathering) exist only on the
// blueprint side and stay outside this check until the artifact carries them.
// ============================================================================

/** The rendered facts stamped by BOTH the artifact plan and the blueprint. */
export type BuildingFactField =
  | 'roofForm'
  | 'wallColor'
  | 'roofColor'
  | 'districtSignature'
  | 'buildingVariant';

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

/** The five facts as stamped on an artifact plot receipt (the 2D side). */
function townPlanFacts(plot: HarnessPlot): Record<BuildingFactField, string | undefined> {
  return {
    roofForm: plot.roofForm,
    wallColor: plot.wallColorHex,
    roofColor: plot.roofColorHex,
    districtSignature: plot.architecture?.districtSignature,
    buildingVariant: plot.architecture?.buildingVariant,
  };
}

/** The same five facts as resolved by the production blueprint (the 3D side). */
function blueprintFacts(
  style: BlueprintPlan['styleResolved'],
): Record<BuildingFactField, string | undefined> {
  return {
    roofForm: style?.roofForm,
    wallColor: style?.wallColor,
    roofColor: style?.roofColor,
    districtSignature: style?.districtSignature,
    buildingVariant: style?.buildingVariant,
  };
}

/** Stable comparison order so mismatch lists are deterministic and testable. */
const FACT_FIELDS: BuildingFactField[] = [
  'roofForm',
  'wallColor',
  'roofColor',
  'districtSignature',
  'buildingVariant',
];

/**
 * Compare one plot's artifact receipt against one blueprint's resolved dress.
 * Pure and exported so tests can prove DETECTION with a doctored receipt
 * rather than trusting the badge's own plumbing. A side that carries no value
 * reports the literal string 'missing' — an absent fact is a verification
 * failure, never a silent skip.
 */
export function compareBuildingFacts(
  plot: HarnessPlot,
  styleResolved: BlueprintPlan['styleResolved'],
): DistrictFactMismatch[] {
  const plan = townPlanFacts(plot);
  const blueprint = blueprintFacts(styleResolved);
  const mismatches: DistrictFactMismatch[] = [];
  for (const field of FACT_FIELDS) {
    const townPlanValue = plan[field] ?? 'missing';
    const blueprintValue = blueprint[field] ?? 'missing';
    if (townPlanValue !== blueprintValue) {
      mismatches.push({ plotId: plot.id, field, townPlanValue, blueprintValue });
    }
  }
  return mismatches;
}

/**
 * Bounded deterministic sample: first, middle, and last plot BY PLOT ID —
 * no RNG, so the same town always cross-checks the same buildings and a red
 * badge reproduces from a shared URL exactly like every other lab receipt.
 * Duplicate indices in tiny districts (1-2 plots) collapse via the id map.
 */
function sampleDistrictPlots(plots: HarnessPlot[]): HarnessPlot[] {
  const byId = [...plots].sort((left, right) => left.id - right.id);
  const picks = new Map<number, HarnessPlot>();
  for (const index of [0, Math.floor(byId.length / 2), byId.length - 1]) {
    const plot = byId[index];
    if (plot) picks.set(plot.id, plot);
  }
  return Array.from(picks.values());
}

/**
 * One shared production-blueprint path for BOTH the selected-building pane and
 * the badge cross-check, so the badge can never verify against a different
 * pipeline than the one the 3D pane renders.
 */
function buildProductionBlueprint(
  artifactPlan: ArtifactTownPlan,
  seed: number,
  style: HarnessStyleOption,
  climate: ClimateClass,
  plot: HarnessPlot,
): BlueprintPlan {
  const townSeed = rootSeedPath(seed);
  const input = buildingPlotInput(artifactPlan, plot, townSeed, {
    cultureType: style.cultureType,
    climate,
  });
  return blueprintForPlot(input, townSeed);
}

/** Build one complete audit town through the same generators used by the game. */
export function buildHarnessTown(options: BuildHarnessTownOptions): HarnessTownModel {
  const style = HARNESS_STYLES.find((candidate) => candidate.id === options.styleId)
    ?? HARNESS_STYLES[0];
  const styleFamily = STYLE_FAMILIES[style.id];
  const townSeed = rootSeedPath(options.seed);
  const enginePlan = generateTownPlan(FOOTPRINT, townSeed, {
    population: options.population,
    water: options.withRiver ? [RIVER] : [],
    roads: options.withRiver ? [ROAD] : [],
  });
  // What changed: Passed options.climate to toArtifactPlan.
  // Why: So the Building Lab's artifact plan matches the climate option chosen in the UI.
  // What was preserved: Options and seed logic.
  const artifactPlan = toArtifactPlan(enginePlan, options.seed, styleFamily, options.climate).plan;
  const districtBuckets = new Map<string, HarnessPlot[]>();
  const ensembleCounts: Record<string, number> = {};

  // Group the durable artifact receipts, because these are exactly what the 3D
  // and simulation bridges receive after the richer engine plan is adapted.
  for (const plot of artifactPlan.plots) {
    const key = plot.architecture?.districtKey ?? 'legacy';
    const bucket = districtBuckets.get(key) ?? [];
    bucket.push(plot);
    districtBuckets.set(key, bucket);
    const ensembleKind = plot.ensemble?.kind ?? 'standalone';
    ensembleCounts[ensembleKind] = (ensembleCounts[ensembleKind] ?? 0) + 1;
  }

  // Convert each district bucket into a compact invariant and variation receipt.
  // The blueprint cross-check runs HERE, inside the one model build the page
  // memoizes per generation — never per render. Its cost is metered separately
  // so a check-time regression is visible in the receipt hook.
  let crossCheckMs = 0;
  const districts = Array.from(districtBuckets.entries()).map(([key, plots]) => {
    const signatures = Array.from(new Set(
      plots.map((plot) => plot.architecture?.districtSignature).filter((value): value is string => Boolean(value)),
    ));
    // Rebuild the REAL production blueprint for a bounded sample and demand
    // the facts both pipelines stamp agree. `verified` is the badge's claim;
    // `coherent` (signature equality) survives as one necessary input.
    const sampled = sampleDistrictPlots(plots);
    const checkStartMs = performance.now();
    const factMismatches = sampled.flatMap((plot) => compareBuildingFacts(
      plot,
      buildProductionBlueprint(artifactPlan, options.seed, style, options.climate, plot).styleResolved,
    ));
    crossCheckMs += performance.now() - checkStartMs;
    return {
      key,
      label: plots[0]?.architecture?.districtLabel ?? key,
      wealth: plots[0]?.architecture?.wealth ?? 'unknown',
      buildings: plots.length,
      signatures,
      variants: new Set(plots.map((plot) => plot.architecture?.buildingVariant).filter(Boolean)).size,
      ensembleKinds: Array.from(new Set(plots.map((plot) => plot.ensemble?.kind ?? 'standalone'))),
      wallColors: Array.from(new Set(plots.map((plot) => plot.wallColorHex).filter((value): value is string => Boolean(value)))),
      roofColors: Array.from(new Set(plots.map((plot) => plot.roofColorHex).filter((value): value is string => Boolean(value)))),
      coherent: signatures.length === 1,
      sampledPlots: sampled.map((plot) => plot.id),
      factMismatches,
      verified: signatures.length === 1 && factMismatches.length === 0,
    };
  }).sort((left, right) => right.buildings - left.buildings || left.label.localeCompare(right.label));

  return {
    seed: options.seed,
    climate: options.climate,
    style,
    styleFamily,
    enginePlan,
    artifactPlan,
    districts,
    ensembleCounts,
    // Aggregate in district display order so "first mismatch" is stable for
    // the badge line, tests, and automation reading the receipt hook.
    factMismatches: districts.flatMap((district) => district.factMismatches),
    crossCheckMs,
  };
}

/**
 * Rebuild the exact production blueprint input for an adapted town plot.
 * Delegates to the same helper the badge cross-check samples through, so the
 * selected-building pane and the verification badge can never diverge paths.
 */
export function blueprintForHarnessPlot(model: HarnessTownModel, plotId: number): BlueprintPlan {
  const plot = model.artifactPlan.plots.find((candidate) => candidate.id === plotId);
  if (!plot) throw new Error(`Building Identity Lab has no plot ${plotId}`);
  return buildProductionBlueprint(model.artifactPlan, model.seed, model.style, 