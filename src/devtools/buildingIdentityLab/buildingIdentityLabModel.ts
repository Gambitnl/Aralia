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
  coherent: boolean;
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
}

export interface BuildHarnessTownOptions {
  seed: number;
  population: number;
  styleId: HarnessStyleId;
  climate: ClimateClass;
  withRiver: boolean;
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
  const artifactPlan = toArtifactPlan(enginePlan, options.seed, styleFamily).plan;
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
  const districts = Array.from(districtBuckets.entries()).map(([key, plots]) => {
    const signatures = Array.from(new Set(
      plots.map((plot) => plot.architecture?.districtSignature).filter((value): value is string => Boolean(value)),
    ));
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
  };
}

/** Rebuild the exact production blueprint input for an adapted town plot. */
export function blueprintForHarnessPlot(model: HarnessTownModel, plotId: number): BlueprintPlan {
  const plot = model.artifactPlan.plots.find((candidate) => candidate.id === plotId);
  if (!plot) throw new Error(`Building Identity Lab has no plot ${plotId}`);
  const townSeed = rootSeedPath(model.seed);
  const input = buildingPlotInput(model.artifactPlan, plot, townSeed, {
    cultureType: model.style.cultureType,
    climate: model.climate,
  });
  return blueprintForPlot(input, townSeed);
}
