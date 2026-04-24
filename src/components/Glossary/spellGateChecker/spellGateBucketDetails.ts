// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/04/2026, 00:24:19
 * Dependents: components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns spell audit mismatches into the detailed buckets shown in the glossary gate checker.
 *
 * The gate checker compares three layers at once: the canonical spell snapshot, the structured markdown,
 * and the runtime JSON that the glossary actually renders. This module owns the field-by-field review
 * logic so the React hook can stay focused on loading data and updating glossary state.
 *
 * Called by: useSpellGateChecks.ts
 * Depends on: SpellValidator and shared spell gate data types
 */

// ============================================================================
// Imports
// ============================================================================
// The bucket builder validates live spell JSON before it reads optional fields.
// The shared data types keep this module aligned with the hook and display panels.
// ============================================================================

import { SpellValidator } from "../../../systems/spells/validation/spellValidator";
import type {
  FidelityData,
  GateChecklist,
  GateResult,
  GateStatus,
  SpellGateArtifactEntry,
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "./spellGateDataTypes";

// ============================================================================
// Bucket detail aliases
// ============================================================================
// These aliases keep the classifier return types tied to the public GateResult
// shape. If the UI gains a new bucket field later, this module should add the
// matching alias and classifier here instead of widening the hook again.
// ============================================================================

type CastingTimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["castingTime"]>;
type ComponentsBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["components"]>;
type ComponentsRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["componentsRuntime"]>;
type MaterialComponentBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["materialComponent"]>;
type MaterialComponentRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["materialComponentRuntime"]>;
type DurationBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["duration"]>;
type DurationRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["durationRuntime"]>;
type RangeAreaRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["rangeAreaRuntime"]>;
type DescriptionBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["description"]>;
type DescriptionRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["descriptionRuntime"]>;
type ClassesBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["classes"]>;
type HigherLevelsBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["higherLevels"]>;
type HigherLevelsRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["higherLevelsRuntime"]>;
type SubClassesBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["subClasses"]>;
type SubClassesRuntimeBucketDetail = NonNullable<NonNullable<GateResult["bucketDetails"]>["subClassesRuntime"]>;

// Known gap extraction moved into spellGateBootstrap.ts so the legacy markdown
// gap docs are only imported when the reviewer actually enables spell checks.

function getOverrideMismatch(
  spellId: string,
  field: string,
  overrideRows?: StructuredCanonicalMismatchRecord[],
): StructuredCanonicalMismatchRecord | undefined {
  return overrideRows?.find((row) => row.spellId === spellId && row.field === field);
}

function getOverrideStructuredJsonMismatch(
  spellId: string,
  field: string,
  overrideRows?: StructuredJsonMismatchRecord[],
): StructuredJsonMismatchRecord | undefined {
  return overrideRows?.find((row) => row.spellId === spellId && row.field === field);
}

export function buildBucketDetailsForSpell(
  spellId: string,
  fetchedSpell: unknown,
  overrideRows?: StructuredCanonicalMismatchRecord[],
  overrideJsonRows?: StructuredJsonMismatchRecord[],
): GateResult["bucketDetails"] {
  const rangeAreaMismatch = getOverrideMismatch(spellId, "Range/Area", overrideRows) ?? rangeAreaMismatchIndex[spellId];
  const rangeAreaRuntimeMismatch = getOverrideStructuredJsonMismatch(spellId, "Range/Area", overrideJsonRows) ?? rangeAreaRuntimeMismatchIndex[spellId];
  const materialComponentMismatch = getOverrideMismatch(spellId, "Material Component", overrideRows) ?? materialComponentMismatchIndex[spellId];
  // Material Component now follows the same two-lane pattern as the other
  // strengthened buckets: canonical -> structured and structured -> runtime JSON.
  // The runtime mismatch index is separate because the glossary spell card renders
  // from JSON, not from the structured markdown line.
  const materialComponentRuntimeMismatch = getOverrideStructuredJsonMismatch(spellId, "Material Component", overrideJsonRows) ?? materialComponentRuntimeMismatchIndex[spellId];
  const componentsMismatch = getOverrideMismatch(spellId, "Components", overrideRows) ?? componentsMismatchIndex[spellId];
  const componentsRuntimeMismatch = getOverrideStructuredJsonMismatch(spellId, "Components", overrideJsonRows) ?? componentsRuntimeMismatchIndex[spellId];
  const durationMismatch = getOverrideMismatch(spellId, "Duration", overrideRows) ?? durationMismatchIndex[spellId];
  const durationRuntimeMismatch = getOverrideStructuredJsonMismatch(spellId, "Duration", overrideJsonRows) ?? durationRuntimeMismatchIndex[spellId];
  const castingTimeMismatch = getOverrideMismatch(spellId, "Casting Time", overrideRows) ?? castingTimeMismatchIndex[spellId];
  const descriptionMismatch = getOverrideMismatch(spellId, "Description", overrideRows) ?? descriptionMismatchIndex[spellId];
  const descriptionRuntimeMismatch = descriptionRuntimeMismatchIndex[spellId];
  const classesMismatch = getOverrideMismatch(spellId, "Classes", overrideRows) ?? classesMismatchIndex[spellId];
  const higherLevelsMismatch = getOverrideMismatch(spellId, "Higher Levels", overrideRows) ?? higherLevelsMismatchIndex[spellId];
  const higherLevelsRuntimeMismatch = getOverrideStructuredJsonMismatch(spellId, "Higher Levels", overrideJsonRows) ?? higherLevelsRuntimeMismatchIndex[spellId];
  const subClassesMismatch = getOverrideMismatch(spellId, "Sub-Classes", overrideRows) ?? subClassesMismatchIndex[spellId];
  const subClassesRuntimeMismatch = getOverrideStructuredJsonMismatch(spellId, "Sub-Classes", overrideJsonRows) ?? subClassesRuntimeMismatchIndex[spellId];

  if (!rangeAreaMismatch && !rangeAreaRuntimeMismatch && !materialComponentMismatch && !materialComponentRuntimeMismatch && !componentsMismatch && !componentsRuntimeMismatch && !durationMismatch && !durationRuntimeMismatch && !castingTimeMismatch && !descriptionMismatch && !descriptionRuntimeMismatch && !classesMismatch && !higherLevelsMismatch && !higherLevelsRuntimeMismatch && !subClassesMismatch && !subClassesRuntimeMismatch) {
    return undefined;
  }

  const descriptionBucket = descriptionMismatch
    ? classifyDescriptionMismatch(descriptionMismatch)
    : undefined;
  const durationBucket = durationMismatch
    ? classifyDurationMismatch(fetchedSpell, durationMismatch)
    : undefined;
  const componentsBucket = componentsMismatch
    ? classifyComponentsMismatch(fetchedSpell, componentsMismatch)
    : undefined;
  const materialComponentBucket = materialComponentMismatch
    ? classifyMaterialComponentMismatch(fetchedSpell, materialComponentMismatch)
    : undefined;
  const higherLevelsBucket = higherLevelsMismatch
    ? classifyHigherLevelsMismatch(fetchedSpell, higherLevelsMismatch)
    : undefined;
  const subClassesBucket = subClassesMismatch
    ? classifySubClassesMismatch(fetchedSpell, subClassesMismatch)
    : undefined;

  return {
    rangeArea: rangeAreaMismatch
      ? classifyRangeAreaMismatch(fetchedSpell, rangeAreaMismatch)
      : undefined,
    rangeAreaRuntime: classifyRangeAreaRuntimeMismatch(
      fetchedSpell,
      rangeAreaRuntimeMismatch,
      rangeAreaMismatch,
    ),
    materialComponent: materialComponentBucket,
    materialComponentRuntime: classifyMaterialComponentRuntimeMismatch(
      fetchedSpell,
      materialComponentRuntimeMismatch,
      materialComponentBucket,
    ),
    components: componentsBucket,
    componentsRuntime: classifyComponentsRuntimeMismatch(
      fetchedSpell,
      componentsRuntimeMismatch,
      componentsBucket,
    ),
    duration: durationBucket,
    durationRuntime: classifyDurationRuntimeMismatch(
      fetchedSpell,
      durationRuntimeMismatch,
      durationBucket,
    ),
    castingTime: castingTimeMismatch
      ? classifyCastingTimeMismatch(fetchedSpell, castingTimeMismatch)
      : undefined,
    description: descriptionBucket,
    descriptionRuntime: classifyDescriptionRuntimeMismatch(
      fetchedSpell,
      descriptionRuntimeMismatch,
      descriptionBucket,
    ),
    classes: classesMismatch
      ? classifyClassesMismatch(fetchedSpell, classesMismatch)
      : undefined,
    higherLevels: higherLevelsBucket,
    // Higher Levels needs its own runtime lane because the glossary spell card
    // renders from spell JSON, not from the structured markdown header. Keeping
    // this separate prevents a canonical-only review from masking stale runtime
    // JSON scaling text.
    higherLevelsRuntime: classifyHigherLevelsRuntimeMismatch(
      fetchedSpell,
      higherLevelsRuntimeMismatch,
      higherLevelsBucket,
    ),
    subClasses: subClassesBucket,
    subClassesRuntime: classifySubClassesRuntimeMismatch(
      fetchedSpell,
      subClassesRuntimeMismatch,
      subClassesBucket,
    ),
  };
}

interface BuildGateResultParams {
  spellId: string;
  level: number;
  jsonPath: string;
  knownGaps: Set<string>;
  spellFidelity?: FidelityData["spells"][string];
  artifactEntry?: SpellGateArtifactEntry;
  fetchedSpell: unknown;
  schemaIssues?: string[];
  overrideRows?: StructuredCanonicalMismatchRecord[];
  overrideJsonRows?: StructuredJsonMismatchRecord[];
  isLegacySpell?: boolean;
}

export function buildGateResultForSpell({
  spellId,
  level,
  jsonPath,
  knownGaps,
  spellFidelity,
  artifactEntry,
  fetchedSpell,
  schemaIssues = [],
  overrideRows,
  overrideJsonRows,
  isLegacySpell = false,
}: BuildGateResultParams): GateResult {
  const checklist: GateChecklist = {
    manifestPathOk: jsonPath.includes(`/level-${level}/`),
    spellJsonExists: true,
    spellJsonValid: schemaIssues.length === 0,
    noKnownGaps: !knownGaps.has(spellId),
  };
  const reasons: string[] = [];
  let status: GateStatus = "pass";

  if (!checklist.manifestPathOk) {
    status = "fail";
    reasons.push("Manifest path not in expected level folder");
  }

  if (spellFidelity) {
    if (spellFidelity.state === "analyzed_with_gaps") {
      checklist.noKnownGaps = false;
      reasons.push(`Gaps: ${spellFidelity.gaps.join(", ")}`);
    } else if (spellFidelity.state === "analyzed_clean") {
      checklist.noKnownGaps = true;
    } else if (spellFidelity.state === "not_started" && knownGaps.has(spellId)) {
      checklist.noKnownGaps = false;
      reasons.push("Marked as gap in legacy docs");
    }
  }

  if (isLegacySpell) {
    checklist.noKnownGaps = false;
    reasons.push("Marked as legacy spell");
  }

  if (!checklist.spellJsonValid) {
    status = "fail";
    reasons.push("Spell JSON failed schema validation");
  }

  if (artifactEntry) {
    checklist.classAccessVerified = artifactEntry.localData.subClassesVerification === "verified";
    checklist.canonicalTopLevelAligned = artifactEntry.canonicalReview.state === "clean";
    checklist.structuredJsonAligned = artifactEntry.structuredJsonReview.state === "clean";

    for (const flag of artifactEntry.localData.flags) {
      reasons.push(describeLocalGateFlag(flag));
    }

    const canonicalReason = describeCanonicalReview(artifactEntry);
    if (canonicalReason) {
      reasons.push(canonicalReason);
    }

    const structuredJsonReason = describeStructuredJsonReview(artifactEntry);
    if (structuredJsonReason) {
      reasons.push(structuredJsonReason);
    }
  }

  if (!checklist.noKnownGaps && status === "pass") {
    status = "gap";
  }

  if (status === "pass" && artifactEntry) {
    const hasArtifactGap = artifactEntry.localData.flags.length > 0
      || artifactEntry.canonicalReview.state === "mismatch"
      || artifactEntry.structuredJsonReview.state === "mismatch";
    if (hasArtifactGap) {
      status = "gap";
    }
  }

  const spellTruth = artifactEntry
    ? {
        localFlags: artifactEntry.localData.flags,
        canonicalReviewState: artifactEntry.canonicalReview.state,
        canonicalMismatchFields: artifactEntry.canonicalReview.mismatchFields,
        canonicalMismatchSummaries: artifactEntry.canonicalReview.mismatchSummaries,
        listingUrl: artifactEntry.canonicalReview.listingUrl,
        structuredJsonReviewState: artifactEntry.structuredJsonReview.state,
        structuredJsonMismatchFields: artifactEntry.structuredJsonReview.mismatchFields,
        structuredJsonMismatchSummaries: artifactEntry.structuredJsonReview.mismatchSummaries,
        structuredJsonGeneratedAt: artifactEntry.structuredJsonReview.generatedAt,
        generatedAt: artifactEntry.canonicalReview.generatedAt,
      }
    : undefined;

  const bucketDetails = buildBucketDetailsForSpell(spellId, fetchedSpell, overrideRows, overrideJsonRows);

  return {
    status,
    reasons,
    issueSummaries: buildIssueSummaries({
      status,
      checklist,
      schemaIssues,
      reasons,
      spellTruth,
      bucketDetails,
      gapAnalysis: spellFidelity,
    }),
    level,
    checklist,
    schemaIssues,
    spellTruth,
    bucketDetails,
    gapAnalysis: spellFidelity,
  };
}

// ============================================================================
// Artifact helpers
// ============================================================================
// This section translates the generated spell gate report into the smaller signals
// the glossary needs. The live hook still validates the JSON in-browser so the UI
// reflects the exact runtime file, but the artifact fills in richer spell-truth
// findings like canonical drift and class-access verification status.
// ============================================================================

function describeLocalGateFlag(flag: string): string {
  if (flag === "classes-empty") return "Classes list is empty";
  return `Local data flag: ${flag}`;
}

function describeCanonicalReview(entry: SpellGateArtifactEntry): string | null {
  if (entry.canonicalReview.state === "mismatch" && entry.canonicalReview.mismatchFields.length > 0) {
    return `Canonical review mismatches: ${entry.canonicalReview.mismatchFields.join(", ")}`;
  }

  return null;
}

function describeStructuredJsonReview(entry: SpellGateArtifactEntry): string | null {
  if (entry.structuredJsonReview.state === "mismatch" && entry.structuredJsonReview.mismatchFields.length > 0) {
    return `Structured -> JSON mismatches: ${entry.structuredJsonReview.mismatchFields.join(", ")}`;
  }

  return null;
}

function humanizeLocalFlag(flag: string): string {
  // Keep local data problems phrased as direct diagnoses rather than internal
  // artifact labels. These sentences feed both the sidebar tooltip and the main
  // gate panel, so they should answer "what is wrong?" without requiring the
  // user to already know the internal flag vocabulary.
  if (flag === "classes-empty") {
    return "The spell JSON has an empty base class list.";
  }

  return `Local data issue: ${flag}`;
}

function humanizeEngineGap(gap: string): string {
  // Fidelity gaps are still real spell problems, but the raw gap codes are too
  // cryptic to serve as the first-line explanation in the gate checker.
  if (gap === "ENG_REACTION_TRIGGER") {
    return "The engine is still missing the movement/reaction trigger this spell depends on.";
  }

  if (gap === "ENG_BEHAVIOR_RESTRICTION") {
    return "The engine does not fully enforce this spell's target behavior restriction yet.";
  }

  if (gap === "ENG_AREA_TICK_ENTER") {
    return "The engine does not yet process this spell's enter-the-area damage or effect tick correctly.";
  }

  return `Known behavior gap: ${gap}.`;
}

// ============================================================================
// Issue summary helpers
// ============================================================================
// The original gate checker exposed a mix of checklist rows, raw reasons, and
// bucket detail panels. That was useful once you already knew the spell-truth
// system, but it still forced the user to mentally combine those sections to
// answer the plain question: "what is wrong with this spell right now?"
//
// This section turns the richer gate result into a small explicit issue list.
// The list is reused by the glossary sidebar tooltip and the main gate panel so
// each spell has a direct diagnosis surface instead of only an aggregate state.
// ============================================================================

function describeBucketIssueLabels(bucketDetails: GateResult["bucketDetails"] | undefined): string[] {
  if (!bucketDetails) return [];

  const issues: string[] = [];

  if (bucketDetails.rangeArea) {
    issues.push(`Range/Area: ${bucketDetails.rangeArea.summary}`);
  }

  if (bucketDetails.rangeAreaRuntime) {
    issues.push(`Range/Area Runtime: ${bucketDetails.rangeAreaRuntime.problemStatement}`);
  }

  if (bucketDetails.materialComponent) {
    issues.push(`Material Component: ${bucketDetails.materialComponent.summary}`);
  }

  if (bucketDetails.materialComponentRuntime) {
    issues.push(`Material Component Runtime: ${bucketDetails.materialComponentRuntime.problemStatement}`);
  }

  if (bucketDetails.components) {
    issues.push(`Components: ${bucketDetails.components.summary}`);
  }

  if (bucketDetails.componentsRuntime) {
    issues.push(`Components Runtime: ${bucketDetails.componentsRuntime.problemStatement}`);
  }

  if (bucketDetails.duration) {
    issues.push(`Duration: ${bucketDetails.duration.problemStatement}`);
  }

  if (bucketDetails.durationRuntime) {
    issues.push(`Duration Runtime: ${bucketDetails.durationRuntime.problemStatement}`);
  }

  if (bucketDetails.castingTime) {
    issues.push(`Casting Time: ${bucketDetails.castingTime.problemStatement}`);
  }

  if (bucketDetails.description) {
    issues.push(`Description: ${bucketDetails.description.summary}`);
  }

  if (bucketDetails.descriptionRuntime) {
    issues.push(`Description Runtime: ${bucketDetails.descriptionRuntime.problemStatement}`);
  }

  if (bucketDetails.classes) {
    issues.push(`Classes: ${bucketDetails.classes.problemStatement}`);
  }

  if (bucketDetails.higherLevels) {
    issues.push(`Higher Levels: ${bucketDetails.higherLevels.summary}`);
  }

  if (bucketDetails.higherLevelsRuntime) {
    issues.push(`Higher Levels Runtime: ${bucketDetails.higherLevelsRuntime.problemStatement}`);
  }

  if (bucketDetails.subClasses) {
    issues.push(`Sub-Classes: ${bucketDetails.subClasses.summary}`);
  }

  if (bucketDetails.subClassesRuntime) {
    issues.push(`Sub-Classes Runtime: ${bucketDetails.subClassesRuntime.problemStatement}`);
  }

  return issues;
}

function buildIssueSummaries(params: {
  status: GateStatus;
  checklist: GateChecklist;
  schemaIssues: string[];
  reasons: string[];
  spellTruth?: GateResult["spellTruth"];
  bucketDetails?: GateResult["bucketDetails"];
  gapAnalysis?: GateResult["gapAnalysis"];
}): string[] {
  const issues: string[] = [];

  if (!params.checklist.manifestPathOk) {
    issues.push("Manifest path does not point at the expected level folder.");
  }

  if (!params.checklist.spellJsonExists) {
    issues.push("Spell JSON could not be loaded for this glossary entry.");
  }

  if (!params.checklist.spellJsonValid && params.schemaIssues.length === 0) {
    issues.push("Spell JSON failed schema validation.");
  }

  for (const issue of params.schemaIssues) {
    issues.push(`Schema: ${issue}`);
  }

  for (const flag of params.spellTruth?.localFlags ?? []) {
    issues.push(humanizeLocalFlag(flag));
  }

  // Put the bucket-specific diagnoses first. Those are the most useful answers
  // to the user-facing question "what is wrong with this spell right now?",
  // while the broader canonical mismatch summaries still remain as supporting
  // detail further down the list.
  issues.push(...describeBucketIssueLabels(params.bucketDetails));

  // The glossary renders spell JSON, so this second parity phase needs to stay
  // visible near the top of the issue list. Otherwise a spell can look current
  // in the gate checker even when the runtime JSON is still lagging behind the
  // already-updated structured markdown layer.
  for (const summary of params.spellTruth?.structuredJsonMismatchSummaries ?? []) {
    issues.push(summary);
  }

  // Keep the exact canonical mismatch summaries as supporting context, but no
  // longer let them displace the spell-specific bucket diagnosis at the top.
  for (const summary of params.spellTruth?.canonicalMismatchSummaries ?? []) {
    issues.push(summary);
  }

  for (const reason of params.reasons) {
    // Skip messages that the dedicated issue builders already make more explicit.
    if (reason.startsWith("Canonical review mismatches:")) continue;
    if (reason === "classes-empty") continue;
    if (reason === "subclasses-unverified") continue;
    if (reason === "Spell JSON failed schema validation") continue;
    if (reason === "Spell JSON not found") continue;
    if (reason === "Manifest path not in expected level folder") continue;
    if (reason.startsWith("Gaps: ")) continue;
    issues.push(reason);
  }

  if (params.spellTruth?.canonicalReviewState === "mismatch" && params.spellTruth.canonicalMismatchFields.length > 0) {
    // Keep a fallback field list only when the richer summaries above did not
    // already explain the exact mismatch sentences for this spell.
    if ((params.spellTruth.canonicalMismatchSummaries ?? []).length === 0) {
      issues.push(`Canonical drift is still recorded in: ${params.spellTruth.canonicalMismatchFields.join(", ")}.`);
    }
  }

  if (params.spellTruth?.structuredJsonReviewState === "mismatch" && params.spellTruth.structuredJsonMismatchFields.length > 0) {
    if ((params.spellTruth.structuredJsonMismatchSummaries ?? []).length === 0) {
      issues.push(`Structured markdown still differs from runtime spell JSON in: ${params.spellTruth.structuredJsonMismatchFields.join(", ")}.`);
    }
  }

  if (params.gapAnalysis?.state === "analyzed_with_gaps" && params.gapAnalysis.gaps.length > 0) {
    for (const gap of params.gapAnalysis.gaps) {
      issues.push(humanizeEngineGap(gap));
    }
  }

  if (params.gapAnalysis?.notes) {
    issues.push(`Engine audit note: ${params.gapAnalysis.notes}`);
  }

  // Preserve ordering but avoid repeating the same explanation under several
  // routes when a spell has both raw artifact flags and a bucket panel.
  return [...new Set(issues)];
}

// ============================================================================
// Range/Area bucket helpers
// ============================================================================
// The gate checker already knew a spell had canonical drift, but not what the
// actual Range/Area disagreement looked like. This section wires in the
// machine-readable structured-vs-canonical audit so the glossary can show the
// structured header display and the canonical snapshot display side by side.
//
// We deliberately keep this bucket-specific instead of building a full generic
// mismatch browser. The current goal is to make the Range/Area normalization
// lane legible while preserving room for future bucket-specific panels.
// ============================================================================

function buildRangeAreaMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep only the one mismatch row the glossary needs for this bucket. If the
  // report format grows later, the UI still stays focused on Range/Area.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Range/Area") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let rangeAreaMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

// ============================================================================
// Material Component bucket helpers
// ============================================================================
// This bucket is narrower than the general Components line. It specifically
// exists for the raw footnoted material note that the structured markdown and
// canonical snapshot compare differently.
//
// The important distinction here is:
// - the canonical snapshot often keeps one literal source line
// - the runtime spell JSON stores decomposed material facts like cost and
//   consumed state
//
// The gate checker therefore needs to show both the raw compared lines and the
// live JSON material facts so the user can tell source-shape residue apart from
// a real material-component drift.
// ============================================================================

function buildMaterialComponentMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep one Material Component mismatch row per spell. The glossary panel is a
  // diagnosis surface, not a raw report browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Material Component") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let materialComponentMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

function stripMaterialFootnotePrefix(value: string): string {
  return value.replace(/^\*+\s*-\s*/, "").trim();
}

function normalizeMaterialNoteText(value: string): string {
  return stripMaterialFootnotePrefix(value)
    .replace(/^\(+|\)+$/g, "")
    .replace(/,\s*which the spell consumes/gi, "")
    .replace(/\bworth at least\b/gi, "worth")
    .replace(/\bgp\b/gi, "GP")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCanonicalMaterialCostGp(value: string): number | undefined {
  const stripped = stripMaterialFootnotePrefix(value);
  const match = stripped.match(/(\d[\d,]*)\s*\+?\s*gp\b/i);
  if (!match) return undefined;

  const numeric = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseCanonicalConsumedState(value: string): boolean | undefined {
  const lowered = value.toLowerCase();
  if (lowered.includes("which the spell consumes")) return true;
  if (lowered.trim().length === 0) return undefined;
  return false;
}

function getCurrentMaterialComponentFacts(spell: unknown): Pick<MaterialComponentBucketDetail, "currentJsonValue" | "materialRequired" | "materialDescription" | "materialCostGp" | "consumed"> {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) {
    return {};
  }

  const detailParts: string[] = [];
  detailParts.push(`material=${parsed.data.components.material ? "true" : "false"}`);

  if (parsed.data.components.material) {
    detailParts.push(`description=${parsed.data.components.materialDescription || "(no description)"}`);
    detailParts.push(`cost=${parsed.data.components.materialCost} gp`);
    detailParts.push(`consumed=${parsed.data.components.isConsumed ? "true" : "false"}`);
  }

  return {
    currentJsonValue: detailParts.join(" | "),
    materialRequired: parsed.data.components.material,
    materialDescription: parsed.data.components.materialDescription,
    materialCostGp: parsed.data.components.materialCost,
    consumed: parsed.data.components.isConsumed,
  };
}

function classifyMaterialComponentMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): MaterialComponentBucketDetail {
  const structuredValue = mismatch.structuredValue ?? "";
  const canonicalValue = mismatch.canonicalValue ?? "";
  const currentFacts = getCurrentMaterialComponentFacts(spell);
  const strippedStructured = stripMaterialFootnotePrefix(structuredValue);
  const strippedCanonical = stripMaterialFootnotePrefix(canonicalValue);
  const normalizedStructuredNote = normalizeMaterialNoteText(structuredValue);
  const normalizedCanonicalNote = normalizeMaterialNoteText(canonicalValue);
  const canonicalCostGp = parseCanonicalMaterialCostGp(canonicalValue);
  const canonicalConsumed = parseCanonicalConsumedState(canonicalValue);
  const canonicalComparableField = canonicalValue.trim().length > 0;
  const descriptionAligned = canonicalComparableField
    ? normalizedStructuredNote.length > 0 && normalizedStructuredNote === normalizedCanonicalNote
    : undefined;
  const costAligned = typeof canonicalCostGp === "number" && typeof currentFacts.materialCostGp === "number"
    ? canonicalCostGp === currentFacts.materialCostGp
    : undefined;
  const consumedAligned = typeof canonicalConsumed === "boolean" && typeof currentFacts.consumed === "boolean"
    ? canonicalConsumed === currentFacts.consumed
    : undefined;

  if (mismatch.mismatchKind === "missing-canonical-field" || canonicalValue.trim().length === 0) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The structured spell block already has a material note, but the copied canonical snapshot does not currently expose a separately comparable Material Component line.",
      classification: "missing_canonical_comparable_field",
      interpretation: "The structured markdown already stores a material note for this spell, but the canonical snapshot did not expose a separately comparable Material Component line. This is an audit/source-shape residue case, not automatically a bad material fact.",
      canonicalComparableField,
      normalizedStructuredNote,
      normalizedCanonicalNote,
      canonicalCostGp,
      canonicalConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
      ...currentFacts,
    };
  }

  if (mismatch.mismatchKind === "missing-structured-field" || structuredValue.trim().length === 0) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The canonical snapshot exposes a material note, but the structured spell block is still missing the matching Material Component line.",
      classification: "missing_structured_material",
      interpretation: "The canonical snapshot exposes a material component line that the structured spell block is still missing. The live JSON facts are shown below so the reviewer can tell whether this is only a markdown gap or a deeper data miss.",
      canonicalComparableField,
      normalizedStructuredNote,
      normalizedCanonicalNote,
      canonicalCostGp,
      canonicalConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
      ...currentFacts,
    };
  }

  if (
    structuredValue.trim().startsWith("*")
    && canonicalValue.trim().startsWith("**")
    && strippedStructured === strippedCanonical
  ) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The structured and canonical material notes use different footnote markers, but the actual note text appears to match.",
      classification: "footnote_marker_residue",
      interpretation: "The structured block and canonical snapshot are storing the same material note text, but they use different footnote markers. This is source-display residue rather than a disagreement about the actual material component.",
      canonicalComparableField,
      normalizedStructuredNote,
      normalizedCanonicalNote,
      canonicalCostGp,
      canonicalConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
      ...currentFacts,
    };
  }

  if (
    canonicalValue.toLowerCase().includes("which the spell consumes")
    && !structuredValue.toLowerCase().includes("which the spell consumes")
  ) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The canonical material note adds an explicit consumed-state clause that is missing from the structured material note text.",
      classification: "consumed_state_drift",
      interpretation: "The canonical material note explicitly says the spell consumes the component, while the structured material line does not carry that clause. The live JSON consumed flag below shows whether the runtime spell data already captured that fact.",
      canonicalComparableField,
      normalizedStructuredNote,
      normalizedCanonicalNote,
      canonicalCostGp,
      canonicalConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
      ...currentFacts,
    };
  }

  if (!canonicalValue.includes("*") && canonicalValue.includes("(") === false) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The canonical material note is coming from an alternate source format, so it does not round-trip to the usual structured footnote shape.",
      classification: "alternate_source_shape",
      interpretation: "This material component line comes from an alternate source shape rather than the usual footnoted D&D Beyond format, so the canonical line is not expected to look like the normalized structured markdown field.",
      canonicalComparableField,
      normalizedStructuredNote,
      normalizedCanonicalNote,
      canonicalCostGp,
      canonicalConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
      ...currentFacts,
    };
  }

  return {
    structuredValue,
    canonicalValue,
    summary: mismatch.summary,
    problemStatement: "The structured material note and canonical material note are still materially different after accounting for known footnote and source-shape cases.",
    classification: "true_material_component_drift",
    interpretation: "The structured material note and the canonical material note are still materially different in a way this gate checker cannot reduce to a known display or source-shape residue.",
    canonicalComparableField,
    normalizedStructuredNote,
    normalizedCanonicalNote,
    canonicalCostGp,
    canonicalConsumed,
    descriptionAligned,
    costAligned,
    consumedAligned,
    ...currentFacts,
  };
}

// ============================================================================
// Material Component runtime review
// ============================================================================
// The canonical Material Component bucket above only explains whether the
// interpreted structured note still matches the copied source note.
//
// The glossary spell card does not render from either of those notes directly.
// It renders from runtime spell JSON, so this second lane asks the missing app
// question directly: does the structured material note still agree with what
// the live spell JSON would currently show to the player?
// ============================================================================

function buildMaterialComponentRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Material Component") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let materialComponentRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

function parseStructuredMaterialComponentFacts(value: string): Pick<MaterialComponentRuntimeBucketDetail, "structuredMaterialRequired" | "structuredDescription" | "structuredCostGp" | "structuredConsumed"> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  return {
    structuredMaterialRequired: true,
    structuredDescription: normalizeMaterialNoteText(value),
    structuredCostGp: parseCanonicalMaterialCostGp(value),
    structuredConsumed: parseCanonicalConsumedState(value),
  };
}

function getCurrentJsonMaterialComponentFacts(spell: unknown): Pick<MaterialComponentRuntimeBucketDetail, "currentJsonValue" | "jsonMaterialRequired" | "jsonDescription" | "jsonCostGp" | "jsonConsumed"> {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) {
    return {
      currentJsonValue: "",
    };
  }

  const jsonMaterialRequired = parsed.data.components.material;
  const jsonDescription = parsed.data.components.materialDescription;
  const jsonCostGp = parsed.data.components.materialCost;
  const jsonConsumed = parsed.data.components.isConsumed;
  const currentJsonValue = jsonMaterialRequired && jsonDescription
    ? `* - (${jsonDescription})`
    : "";

  return {
    currentJsonValue,
    jsonMaterialRequired,
    jsonDescription,
    jsonCostGp,
    jsonConsumed,
  };
}

function classifyMaterialComponentRuntimeMismatch(
  spell: unknown,
  mismatch: StructuredJsonMismatchRecord | undefined,
  structuredMaterialBucket: MaterialComponentBucketDetail | undefined,
): MaterialComponentRuntimeBucketDetail | undefined {
  const structuredValue = mismatch?.structuredValue ?? structuredMaterialBucket?.structuredValue ?? "";
  const {
    currentJsonValue,
    jsonMaterialRequired,
    jsonDescription,
    jsonCostGp,
    jsonConsumed,
  } = getCurrentJsonMaterialComponentFacts(spell);
  const {
    structuredMaterialRequired,
    structuredDescription,
    structuredCostGp,
    structuredConsumed,
  } = parseStructuredMaterialComponentFacts(structuredValue);
  const summary = mismatch?.summary
    ?? (structuredMaterialBucket
      ? "The canonical Material Component review is already active for this spell, so this runtime lane checks whether the structured material note still matches the live spell JSON."
      : "");
  const normalizedStructured = structuredDescription ?? "";
  const normalizedJson = jsonDescription ? normalizeMaterialNoteText(jsonDescription) : "";
  const descriptionAligned = normalizedStructured.length > 0 && normalizedStructured === normalizedJson;
  const costAligned = typeof structuredCostGp === "number" && typeof jsonCostGp === "number"
    ? structuredCostGp === jsonCostGp
    : undefined;
  const consumedAligned = typeof structuredConsumed === "boolean" && typeof jsonConsumed === "boolean"
    ? structuredConsumed === jsonConsumed
    : undefined;
  const structuredMatchesJson = structuredValue === currentJsonValue;

  if (structuredValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime Material Component value cannot be reviewed because the structured spell block does not currently expose a comparable material note.",
      problemStatement: "The structured spell block does not currently expose a Material Component line, so the runtime spell JSON cannot be reviewed for this bucket yet.",
      classification: "missing_structured_material_component",
      reviewVerdict: "Fix the structured Material Component line first, then re-check whether the runtime spell JSON is still behind it.",
      explanation: "Material Component runtime review is blocked because the interpreted structured layer has no comparable material note.",
      structuredMatchesJson,
      structuredMaterialRequired,
      jsonMaterialRequired,
      structuredDescription,
      jsonDescription,
      structuredCostGp,
      jsonCostGp,
      structuredConsumed,
      jsonConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
    };
  }

  if (!mismatch && !structuredMaterialBucket && descriptionAligned && costAligned !== false && consumedAligned !== false) {
    return undefined;
  }

  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-json-field" || currentJsonValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured spell block has a Material Component line, but the runtime spell JSON does not currently expose a comparable material note.",
      problemStatement: "The structured Material Component line still exists, but the runtime spell JSON is missing the comparable material note for this spell.",
      classification: "missing_runtime_material_component",
      reviewVerdict: "Copy the structured material note into the runtime spell JSON so the glossary spell card is no longer missing this component detail.",
      explanation: "This is real implementation drift because the glossary renders from runtime spell JSON, not from the structured markdown block.",
      structuredMatchesJson,
      structuredMaterialRequired,
      jsonMaterialRequired,
      structuredDescription,
      jsonDescription,
      structuredCostGp,
      jsonCostGp,
      structuredConsumed,
      jsonConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
    };
  }

  if (structuredMatchesJson) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Material Component line and the runtime spell JSON are aligned.",
      problemStatement: "The structured Material Component line and the runtime spell JSON currently agree.",
      classification: "aligned",
      reviewVerdict: "No runtime Material Component drift is currently indicated for this spell.",
      explanation: "The glossary is already rendering the same material note the interpreted structured layer expresses.",
      structuredMatchesJson,
      structuredMaterialRequired,
      jsonMaterialRequired,
      structuredDescription,
      jsonDescription,
      structuredCostGp,
      jsonCostGp,
      structuredConsumed,
      jsonConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
    };
  }

  if (consumedAligned === false && costAligned !== false && descriptionAligned) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured and runtime material notes still differ on whether the component is consumed.",
      problemStatement: "The structured Material Component line and the runtime spell JSON disagree about whether the component is consumed by the spell.",
      classification: "consumed_state_runtime_drift",
      reviewVerdict: "Update the runtime JSON consumed flag or material note so the glossary spell card reflects the same consumed-state the structured layer now carries.",
      explanation: "This is real implementation drift because consumed-state changes the practical meaning of the material requirement.",
      structuredMatchesJson,
      structuredMaterialRequired,
      jsonMaterialRequired,
      structuredDescription,
      jsonDescription,
      structuredCostGp,
      jsonCostGp,
      structuredConsumed,
      jsonConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
    };
  }

  if (costAligned === false && consumedAligned !== false) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured and runtime material notes still differ on the component cost.",
      problemStatement: "The structured Material Component line and the runtime spell JSON disagree about the material cost for this spell.",
      classification: "cost_runtime_drift",
      reviewVerdict: "Update the runtime JSON material cost or description so the glossary spell card reflects the same cost the structured layer now carries.",
      explanation: "This is real implementation drift because cost is a gameplay-relevant fact, not just wording.",
      structuredMatchesJson,
      structuredMaterialRequired,
      jsonMaterialRequired,
      structuredDescription,
      jsonDescription,
      structuredCostGp,
      jsonCostGp,
      structuredConsumed,
      jsonConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
    };
  }

  if (descriptionAligned && structuredMaterialRequired === jsonMaterialRequired && costAligned !== false && consumedAligned !== false) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Material Component line and the runtime spell JSON appear to preserve the same material facts, even though the wording still differs.",
      problemStatement: "The structured Material Component line and the runtime spell JSON appear to carry the same material facts. The remaining difference looks like wording or storage-shape residue.",
      classification: "model_display_boundary",
      reviewVerdict: "Treat this as a runtime model/display boundary unless the project decides the material note must round-trip the exact same prose.",
      explanation: "The structured layer stores one normalized material note, while the runtime JSON may keep a richer or differently worded description. That wording difference does not necessarily mean the app is using the wrong material facts.",
      structuredMatchesJson,
      structuredMaterialRequired,
      jsonMaterialRequired,
      structuredDescription,
      jsonDescription,
      structuredCostGp,
      jsonCostGp,
      structuredConsumed,
      jsonConsumed,
      descriptionAligned,
      costAligned,
      consumedAligned,
    };
  }

  return {
    structuredValue,
    currentJsonValue,
    summary: summary || "The structured Material Component line and the runtime spell JSON still disagree about the spell's material note.",
    problemStatement: "The structured Material Component line still differs from the runtime spell JSON for this spell.",
    classification: "real_runtime_drift",
    reviewVerdict: "Review the structured material note against the runtime spell JSON and update the JSON if the structured layer now carries the intended material facts.",
    explanation: "This is real implementation drift until the glossary-facing runtime JSON carries the same material facts as the interpreted structured layer.",
    structuredMatchesJson,
    structuredMaterialRequired,
    jsonMaterialRequired,
    structuredDescription,
    jsonDescription,
    structuredCostGp,
    jsonCostGp,
    structuredConsumed,
    jsonConsumed,
    descriptionAligned,
    costAligned,
    consumedAligned,
  };
}

// ============================================================================
// Components bucket helpers
// ============================================================================
// Components drift is a narrow but useful bucket for the gate checker because
// the remaining residue is not random. The current spell corpus mostly shows
// two shapes:
// - footnote-marker differences between the normalized structured header and the
//   copied canonical display string
// - alternate-source component strings that keep the material text inline
//
// Surfacing those explicitly in the glossary lets the owner review whether the
// mismatch is only source-display residue or a real problem with the stored
// component facts.
// ============================================================================

function buildComponentsMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep one component mismatch row per spell. The gate panel is meant to
  // explain the active bucket, not expose the full raw audit table.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Components") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let componentsMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

function getCurrentComponentsDisplay(spell: unknown): ComponentsBucketDetail["currentJsonValue"] {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return undefined;

  const parts: string[] = [];
  if (parsed.data.components.verbal) parts.push("V");
  if (parsed.data.components.somatic) parts.push("S");
  if (parsed.data.components.material) parts.push("M");

  const detailParts: string[] = [];
  if (parsed.data.components.material) {
    detailParts.push(`material=${parsed.data.components.materialDescription || "(no description)"}`);
    detailParts.push(`cost=${parsed.data.components.materialCost} gp`);
    detailParts.push(`consumed=${parsed.data.components.isConsumed ? "true" : "false"}`);
  }

  return detailParts.length > 0
    ? `${parts.join(", ")} | ${detailParts.join(" | ")}`
    : parts.join(", ");
}

function getCurrentComponentsFacts(spell: unknown): {
  currentJsonValue: string;
  jsonLetters: string;
  materialRequired?: boolean;
  materialDescription?: string;
} {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) {
    return {
      currentJsonValue: "",
      jsonLetters: "",
    };
  }

  // The runtime JSON stores components as decomposed booleans plus material
  // detail fields. The gate checker turns those back into a readable line so
  // the reviewer can compare the interpreted structured header against the
  // actual glossary-facing spell data rather than reverse-engineering JSON.
  const parts: string[] = [];
  if (parsed.data.components.verbal) parts.push("V");
  if (parsed.data.components.somatic) parts.push("S");
  if (parsed.data.components.material) parts.push("M");

  const detailParts: string[] = [];
  if (parsed.data.components.material) {
    detailParts.push(`material=${parsed.data.components.materialDescription || "(no description)"}`);
    detailParts.push(`cost=${parsed.data.components.materialCost} gp`);
    detailParts.push(`consumed=${parsed.data.components.isConsumed ? "true" : "false"}`);
  }

  return {
    currentJsonValue: detailParts.length > 0
      ? `${parts.join(", ")} | ${detailParts.join(" | ")}`
      : parts.join(", "),
    jsonLetters: parts.join(", "),
    materialRequired: parsed.data.components.material,
    materialDescription: parsed.data.components.materialDescription,
  };
}

function extractComponentLetters(value: string): string {
  const upper = value.toUpperCase();
  const letters: string[] = [];

  // The goal here is not to fully parse the source string. It is only to answer
  // the human-facing question "which V/S/M flags does this line claim?" so the
  // gate checker can distinguish a real component mismatch from a footnote or
  // inline-material formatting difference.
  if (/\bV\b/.test(upper)) letters.push("V");
  if (/\bS\b/.test(upper)) letters.push("S");
  if (/\bM\b/.test(upper)) letters.push("M");

  return letters.join(", ");
}

function classifyComponentsMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): ComponentsBucketDetail {
  const structuredValue = mismatch.structuredValue ?? "";
  const canonicalValue = mismatch.canonicalValue ?? "";
  const parsed = SpellValidator.safeParse(spell);
  const currentJsonValue = getCurrentComponentsDisplay(spell);
  const structuredLetters = extractComponentLetters(structuredValue);
  const canonicalLetters = extractComponentLetters(canonicalValue);
  const lettersMatch = structuredLetters === canonicalLetters;

  if (structuredValue.includes("*") && canonicalValue.includes("**")) {
    return {
      structuredValue,
      canonicalValue,
      summary: lettersMatch
        ? `The V/S/M letters still match (${structuredLetters || "none"}), but the canonical page uses a different component footnote marker than the structured header.`
        : `The structured header shows ${structuredLetters || "no component letters"}, while the canonical line shows ${canonicalLetters || "no component letters"} and also uses a different footnote marker.`,
      classification: "footnote_marker_residue",
      interpretation: "The structured header is storing the same component facts, but the canonical display uses a different footnote marker because the source page also assigns '*' to another note lane. This is source-display residue, not a disagreement about which components the spell requires.",
      reviewVerdict: lettersMatch
        ? "The actual V/S/M requirement still matches. The mismatch is only in how the source labels the material footnote."
        : "The footnote marker changed and the visible V/S/M letters do not fully align, so this spell still needs a closer component review.",
      structuredLetters,
      canonicalLetters,
      lettersMatch,
      currentJsonValue,
      materialRequired: parsed.success ? parsed.data.components.material : undefined,
      materialDescription: parsed.success ? parsed.data.components.materialDescription : undefined,
    };
  }

  if (canonicalValue.includes("(") && !canonicalValue.includes("*")) {
    return {
      structuredValue,
      canonicalValue,
      summary: lettersMatch
        ? `The V/S/M letters still match (${structuredLetters || "none"}), but the canonical source keeps the material note inline instead of using the structured Aralia component format.`
        : `The structured header shows ${structuredLetters || "no component letters"}, while the alternate source line shows ${canonicalLetters || "no component letters"} with inline material text.`,
      classification: "alternate_source_shape",
      interpretation: "The canonical snapshot keeps the material description inline inside the raw component string instead of splitting it into a footnote marker plus a separate material note. The structured data is still storing the component facts in the normalized Aralia format.",
      reviewVerdict: lettersMatch
        ? "The actual V/S/M requirement still matches. The difference is that the alternate source keeps the material note inline."
        : "The alternate source line is shaped differently and the visible V/S/M letters do not fully align, so this spell still needs a closer component review.",
      structuredLetters,
      canonicalLetters,
      lettersMatch,
      currentJsonValue,
      materialRequired: parsed.success ? parsed.data.components.material : undefined,
      materialDescription: parsed.success ? parsed.data.components.materialDescription : undefined,
    };
  }

  return {
    structuredValue,
    canonicalValue,
    summary: `The structured header shows ${structuredLetters || "no component letters"}, while the canonical line shows ${canonicalLetters || "no component letters"}, and the current gate checker cannot reduce that difference to a known source-formatting pattern.`,
    classification: "true_components_drift",
    interpretation: "The structured component header and the copied canonical component string are still materially different in a way the current gate checker cannot explain as a known display-shape residue.",
    reviewVerdict: "This still looks like a real unresolved component mismatch.",
    structuredLetters,
    canonicalLetters,
    lettersMatch,
    currentJsonValue,
    materialRequired: parsed.success ? parsed.data.components.material : undefined,
    materialDescription: parsed.success ? parsed.data.components.materialDescription : undefined,
  };
}

// ============================================================================
// Components runtime review
// ============================================================================
// The canonical Components bucket above only answers whether the interpreted
// structured header still resembles the copied source line. The glossary spell
// card does not render from that source line; it renders from runtime JSON.
// This second lane therefore asks the missing implementation question directly:
// does the structured component header still match what the live spell JSON
// would show to the player?
// ============================================================================

function buildComponentsRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep one Components runtime row per spell so the gate checker can explain
  // the selected spell concisely without exposing the whole raw report table.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Components") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let componentsRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

function classifyComponentsRuntimeMismatch(
  spell: unknown,
  mismatch: StructuredJsonMismatchRecord | undefined,
  structuredComponentsBucket: ComponentsBucketDetail | undefined,
): ComponentsRuntimeBucketDetail | undefined {
  const { currentJsonValue, jsonLetters, materialRequired, materialDescription } = getCurrentComponentsFacts(spell);
  const structuredValue = mismatch?.structuredValue ?? structuredComponentsBucket?.structuredValue ?? "";
  const summary = mismatch?.summary
    ?? (structuredComponentsBucket
      ? "The canonical Components review is already active for this spell, so this runtime lane checks whether the structured V/S/M header still matches the live spell JSON."
      : "");
  const structuredLetters = extractComponentLetters(structuredValue);
  const lettersMatch = structuredLetters === jsonLetters;
  const structuredMatchesJson = structuredValue === currentJsonValue;

  // If there is no structured Components header yet, the runtime layer cannot
  // be judged meaningfully. That is a structured-layer gap first, not proof
  // that the JSON implementation is wrong.
  if (structuredValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime Components value cannot be reviewed because the structured spell block does not currently expose a comparable Components line.",
      problemStatement: "The structured spell block does not currently expose a Components line, so the runtime spell JSON cannot be reviewed for this bucket yet.",
      classification: "missing_structured_components",
      reviewVerdict: "Fix the structured Components line first, then re-check whether the runtime spell JSON is still behind it.",
      explanation: "Components runtime review is blocked because the interpreted structured layer has no comparable V/S/M header.",
      structuredMatchesJson,
      structuredLetters,
      jsonLetters,
      lettersMatch,
      materialRequired,
      materialDescription,
    };
  }

  // If no canonical or runtime bucket brought us here and the letters already
  // align, there is nothing useful to render. When the canonical bucket exists,
  // however, we still surface the runtime lane so the user can see that the app
  // layer is current even if the source-display lane is still noisy.
  if (!mismatch && !structuredComponentsBucket && lettersMatch) {
    return undefined;
  }

  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-json-field" || currentJsonValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured spell block has a Components line, but the runtime spell JSON does not currently expose comparable component facts.",
      problemStatement: "The structured Components line still exists, but the runtime spell JSON is missing comparable component data for this spell.",
      classification: "missing_runtime_components",
      reviewVerdict: "Copy the structured component facts into the runtime spell JSON so the glossary spell card is no longer missing component requirements.",
      explanation: "This is real implementation drift because the glossary renders from runtime spell JSON, not from the structured markdown block.",
      structuredMatchesJson,
      structuredLetters,
      jsonLetters,
      lettersMatch,
      materialRequired,
      materialDescription,
    };
  }

  if (structuredMatchesJson) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Components line and the runtime spell JSON are aligned.",
      problemStatement: "The structured Components line and the runtime spell JSON currently agree.",
      classification: "aligned",
      reviewVerdict: "No runtime Components drift is currently indicated for this spell.",
      explanation: "The glossary is already rendering the same component line the interpreted structured layer expresses.",
      structuredMatchesJson,
      structuredLetters,
      jsonLetters,
      lettersMatch,
      materialRequired,
      materialDescription,
    };
  }

  if (lettersMatch) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Components line and the runtime spell JSON preserve the same V/S/M requirement, even though they store it in different shapes.",
      problemStatement: "The structured Components line and the runtime spell JSON are carrying the same V/S/M facts. The remaining difference is only how the runtime layer decomposes those facts.",
      classification: "model_display_boundary",
      reviewVerdict: "Treat this as a runtime display/model boundary unless the project later decides the structured header must round-trip the decomposed JSON format exactly.",
      explanation: "The structured layer stores one compact V/S/M header, while the runtime spell JSON stores separate booleans plus material metadata. That storage-shape difference does not mean the app is using the wrong component facts.",
      structuredMatchesJson,
      structuredLetters,
      jsonLetters,
      lettersMatch,
      materialRequired,
      materialDescription,
    };
  }

  return {
    structuredValue,
    currentJsonValue,
    summary: summary || "The structured Components line and the runtime spell JSON still disagree about the spell's component requirements.",
    problemStatement: "The structured Components line still differs from the runtime spell JSON for this spell.",
    classification: "real_runtime_drift",
    reviewVerdict: "Review the structured component header against the runtime spell JSON and update the JSON if the structured layer now carries the intended V/S/M requirement.",
    explanation: "This is real implementation drift until the glossary-facing runtime JSON carries the same component facts as the interpreted structured layer.",
    structuredMatchesJson,
    structuredLetters,
    jsonLetters,
    lettersMatch,
    materialRequired,
    materialDescription,
  };
}

// ============================================================================
// Duration bucket helpers
// ============================================================================
// Duration drift needs its own bucket because the copied canonical snapshot is
// still storing a flattened source display string. That means some mismatches
// are not "the spell is wrong" but "the source string is collapsing separate
// ideas like concentration and duration into one line".
//
// The gate checker therefore needs to show both:
// - the structured/canonical strings being compared by the audit
// - the actual duration breakdown from live spell JSON
//
// That keeps the user from mistaking source-display residue for engine-truth
// drift, while still leaving genuinely hard cases like "Until Dispelled or
// Triggered" visible as model-boundary problems.
// ============================================================================

function buildDurationMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep a single duration row per spell. The glossary only needs one concise
  // explanation for this bucket rather than the full raw audit payload.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Duration") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let durationMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

function buildDurationRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep a single runtime Duration row per spell. The gate checker is a
  // spell-specific diagnosis surface, not a raw mismatch browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Duration") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let durationRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

function humanizeDurationUnit(unit: string, value: number): string {
  if (unit === "round") return value === 1 ? "round" : "rounds";
  if (unit === "minute") return value === 1 ? "minute" : "minutes";
  if (unit === "hour") return value === 1 ? "hour" : "hours";
  if (unit === "day") return value === 1 ? "day" : "days";
  if (unit === "days") return value === 1 ? "day" : "days";
  if (unit === "week") return value === 1 ? "week" : "weeks";
  if (unit === "month") return value === 1 ? "month" : "months";
  if (unit === "year") return value === 1 ? "year" : "years";
  return unit.replace(/_/g, " ");
}

function normalizeDurationDisplay(value: string): string {
  return value
    .toLowerCase()
    .replace(/,+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveCanonicalDurationBreakdown(canonicalValue: string): DurationBucketDetail["canonicalBreakdown"] {
  const normalized = canonicalValue.trim();

  // Canonical captures sometimes flatten concentration into the duration line.
  // We split that back out here so the gate checker can show the user the
  // source's real semantic shape instead of only the raw copied string.
  if (/^concentration\b/i.test(normalized)) {
    const durationText = normalized.replace(/^concentration\b[\s,]*/i, "").trim();
    return {
      concentration: true,
      durationText: durationText.length > 0 ? durationText : "(not captured)",
    };
  }

  return {
    concentration: false,
    durationText: normalized,
  };
}

function parseStructuredDurationDisplay(value: string): DurationRuntimeBucketDetail["structuredBreakdown"] | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;

  const lowered = normalizeDurationDisplay(normalized);
  const breakdown: DurationRuntimeBucketDetail["structuredBreakdown"] = {};

  if (lowered.startsWith("concentration ")) {
    breakdown.concentration = true;
    const withoutPrefix = normalized.replace(/^concentration\b[\s,]*/i, "").trim();
    const timedMatch = withoutPrefix.match(/^(?<value>\d+)\s+(?<unit>[a-z_]+)$/i);

    if (timedMatch?.groups?.value && timedMatch.groups.unit) {
      breakdown.type = "timed";
      breakdown.value = Number(timedMatch.groups.value);
      breakdown.unit = timedMatch.groups.unit.toLowerCase().replace(/s$/, "");
      return breakdown;
    }
  }

  if (lowered === "instantaneous") {
    breakdown.type = "instantaneous";
    breakdown.concentration = false;
    return breakdown;
  }

  if (lowered === "special" || lowered === "permanent") {
    breakdown.type = "special";
    breakdown.concentration = false;
    return breakdown;
  }

  if (lowered === "until dispelled") {
    breakdown.type = "until_dispelled";
    breakdown.concentration = false;
    return breakdown;
  }

  if (lowered === "until dispelled or triggered") {
    breakdown.type = "until_dispelled_or_triggered";
    breakdown.concentration = false;
    return breakdown;
  }

  const timedMatch = normalized.match(/^(?<value>\d+)\s+(?<unit>[a-z_]+)$/i);
  if (timedMatch?.groups?.value && timedMatch.groups.unit) {
    breakdown.type = "timed";
    breakdown.value = Number(timedMatch.groups.value);
    breakdown.unit = timedMatch.groups.unit.toLowerCase().replace(/s$/, "");
    breakdown.concentration = false;
    return breakdown;
  }

  return breakdown;
}

function getCurrentJsonDurationFacts(spell: unknown): Pick<DurationRuntimeBucketDetail, "currentJsonValue" | "currentJsonBreakdown"> {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) {
    return { currentJsonValue: "" };
  }

  const { duration } = parsed.data;
  const currentJsonBreakdown: DurationRuntimeBucketDetail["currentJsonBreakdown"] = {
    type: duration.type,
    value: duration.value,
    unit: duration.unit,
    concentration: duration.concentration,
  };

  if (duration.type === "instantaneous") {
    return {
      currentJsonValue: "Instantaneous",
      currentJsonBreakdown,
    };
  }

  if (duration.type === "until_dispelled") {
    return {
      currentJsonValue: "Until Dispelled",
      currentJsonBreakdown,
    };
  }

  if (duration.type === "special") {
    return {
      currentJsonValue: "Special",
      currentJsonBreakdown,
    };
  }

  if (typeof duration.value === "number" && duration.unit) {
    const timedText = `${duration.value} ${humanizeDurationUnit(duration.unit, duration.value)}`;
    return {
      currentJsonValue: duration.concentration ? `Concentration ${timedText}` : timedText,
      currentJsonBreakdown,
    };
  }

  return {
    currentJsonValue: duration.type.replace(/_/g, " "),
    currentJsonBreakdown,
  };
}

function getDurationBreakdown(spell: unknown): DurationBucketDetail["structuredBreakdown"] | undefined {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return undefined;

  return {
    type: parsed.data.duration.type,
    value: parsed.data.duration.value,
    unit: parsed.data.duration.unit,
    concentration: parsed.data.duration.concentration,
  };
}

function classifyDurationMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): DurationBucketDetail {
  const structuredValue = mismatch.structuredValue ?? "";
  const canonicalValue = mismatch.canonicalValue ?? "";
  const structuredBreakdown = getDurationBreakdown(spell);
  const canonicalLower = normalizeDurationDisplay(canonicalValue);
  const structuredLower = normalizeDurationDisplay(structuredValue);

  if (!structuredBreakdown) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The spell's structured duration "${structuredValue}" does not currently reconcile with the canonical duration "${canonicalValue}", and the live spell JSON could not be parsed cleanly enough to explain why.`,
      classification: "true_duration_drift",
      severity: "high",
      semanticStatus: "mismatch",
      interpretation: "Duration drift exists, but the live spell JSON did not parse cleanly enough to tell display residue apart from a real duration mismatch.",
      recommendedAction: "Inspect the spell JSON and canonical snapshot together. This case is not specific enough to auto-classify and should be treated as a real duration review.",
      canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
    };
  }

  // This is the main duration bucket case the user is interested in right now:
  // the canonical snapshot flattens concentration into the duration string,
  // while the structured model stores concentration as its own fact plus a
  // separate timed duration.
  if (
    structuredBreakdown.concentration
    && canonicalLower.startsWith("concentration ")
    && typeof structuredBreakdown.value === "number"
    && structuredBreakdown.unit
  ) {
    const normalizedTimedDisplay = normalizeDurationDisplay(
      `${structuredBreakdown.value} ${humanizeDurationUnit(structuredBreakdown.unit, structuredBreakdown.value)}`,
    );

    if (canonicalLower.includes(normalizedTimedDisplay)) {
      return {
        structuredValue,
        canonicalValue,
        summary: mismatch.summary,
        problemStatement: `The canonical snapshot flattens concentration into "${canonicalValue}", while the structured spell data already stores concentration separately from the ${structuredBreakdown.value} ${humanizeDurationUnit(structuredBreakdown.unit, structuredBreakdown.value)} duration.`,
        classification: "flattened_concentration_display",
        severity: "low",
        semanticStatus: "equivalent",
        interpretation: "The canonical snapshot is flattening concentration and timed duration into one display string. The structured model already stores those as separate facts, so this is source-display residue rather than a bad spell duration.",
        recommendedAction: "Do not change the spell JSON for this alone. Treat it as a canonical snapshot formatting issue or teach the audit to compare concentration separately from timed duration.",
        canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
        structuredBreakdown,
      };
    }
  }

  // Some remaining cases are only pluralization residue introduced by the
  // structured display layer, such as '1 Minutes' versus '1 Minute'.
  if (
    typeof structuredBreakdown.value === "number"
    && structuredBreakdown.value === 1
    && structuredLower.replace(/\b(minutes|hours|days)\b/g, (match) => match.slice(0, -1)) === canonicalLower
  ) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The structured duration display uses the wrong singular/plural form: "${structuredValue}" should read like the canonical "${canonicalValue}".`,
      classification: "duration_unit_pluralization",
      severity: "low",
      semanticStatus: "equivalent",
      interpretation: "The underlying duration appears equivalent, but the structured display still has a singular/plural wording artifact.",
      recommendedAction: "Correct the structured duration display wording. The underlying spell data already appears semantically aligned.",
      canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
      structuredBreakdown,
    };
  }

  // These cases expose genuine model-boundary pressure. The source is saying
  // more than the current normalized duration type communicates.
  if (canonicalLower === "until dispelled or triggered") {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The canonical source says "${canonicalValue}", but the structured duration only says "${structuredValue}" and does not represent the extra trigger-ending clause.`,
      classification: "until_dispelled_or_triggered_boundary",
      severity: "high",
      semanticStatus: "boundary",
      interpretation: "The canonical source includes a trigger-ending clause that the current structured duration model does not represent explicitly.",
      recommendedAction: "Flag this as a duration model-boundary case unless the duration schema is expanded to represent trigger-ended persistence.",
      canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
      structuredBreakdown,
    };
  }

  if (canonicalLower === "until dispelled") {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The canonical source uses the explicit duration "${canonicalValue}", but the structured spell data is still presenting it as "${structuredValue}".`,
      classification: "until_dispelled_boundary",
      severity: "medium",
      semanticStatus: "boundary",
      interpretation: "The canonical source is using an explicit 'Until Dispelled' duration while the current structured model is normalizing that spell into a broader special/permanent-style duration concept.",
      recommendedAction: "Decide whether the current model should keep normalizing this as a special/permanent duration or grow an explicit until-dispelled duration type.",
      canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
      structuredBreakdown,
    };
  }

  // Arcane Sword is the one alternate-source capture in this bucket. Its source
  // formatting is slightly different from the D&D Beyond captures, so keep that
  // explanation visible rather than pretending it is the same class of drift.
  if (mismatch.spellId === "arcane-sword") {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `This spell is using an alternate-source duration string "${canonicalValue}", so the structured value "${structuredValue}" does not line up with the usual D&D Beyond snapshot shape.`,
      classification: "alternate_source_shape",
      severity: "medium",
      semanticStatus: "boundary",
      interpretation: "This spell uses the approved alternate-source snapshot shape, so the duration string follows that source's formatting instead of the standard D&D Beyond capture style.",
      recommendedAction: "Review this against the approved alternate-source format rather than treating it as ordinary D&D Beyond duration drift.",
      canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
      structuredBreakdown,
    };
  }

  // Special durations that are neither flat timing nor clean until-dispelled
  // labels should stay visible as bucket residue instead of being hidden under
  // a generic mismatch label.
  if (structuredBreakdown.type === "special") {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The structured spell data is using the generic duration label "${structuredValue}", but the canonical source is more specific: "${canonicalValue}".`,
      classification: "special_duration_boundary",
      severity: "medium",
      semanticStatus: "boundary",
      interpretation: "The spell is using the structured model's special-duration bucket, while the canonical source uses a more specific prose duration label. This is a model-boundary case, not simple formatting noise.",
      recommendedAction: "Keep this flagged unless the duration model is widened. The canonical source is carrying more specific semantics than the current structured bucket.",
      canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
      structuredBreakdown,
    };
  }

  return {
    structuredValue,
    canonicalValue,
    summary: mismatch.summary,
    problemStatement: `The structured duration "${structuredValue}" does not cleanly match the canonical duration "${canonicalValue}".`,
    classification: "true_duration_drift",
    severity: "high",
    semanticStatus: "mismatch",
    interpretation: "The canonical duration string does not reduce cleanly to the current structured duration fields and should be reviewed as a possible real duration mismatch.",
    recommendedAction: "Treat this as a real duration mismatch until proven otherwise. Compare the spell JSON, structured markdown, and canonical snapshot directly.",
    canonicalBreakdown: deriveCanonicalDurationBreakdown(canonicalValue),
    structuredBreakdown,
  };
}

function classifyDurationRuntimeMismatch(
  spell: unknown,
  mismatch: StructuredJsonMismatchRecord | undefined,
  structuredDurationBucket: DurationBucketDetail | undefined,
): DurationRuntimeBucketDetail | undefined {
  const structuredValue = mismatch?.structuredValue ?? structuredDurationBucket?.structuredValue ?? "";
  const { currentJsonValue, currentJsonBreakdown } = getCurrentJsonDurationFacts(spell);
  const summary = mismatch?.summary ?? structuredDurationBucket?.summary ?? "";
  const structuredBreakdown = parseStructuredDurationDisplay(structuredValue);
  const normalizedStructured = normalizeDurationDisplay(structuredValue);
  const normalizedJson = normalizeDurationDisplay(currentJsonValue);
  const structuredMatchesJson = normalizedStructured.length > 0 && normalizedStructured === normalizedJson;

  // If there is no structured duration line to compare against, runtime review
  // is blocked by the interpreted layer first.
  if (structuredValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime Duration value cannot be reviewed because the structured spell block does not currently expose a comparable Duration value.",
      problemStatement: "The structured spell block does not currently expose a Duration value, so the runtime spell JSON cannot be reviewed for this bucket yet.",
      classification: "missing_structured_duration",
      reviewVerdict: "Fix the structured Duration field first, then re-check whether the runtime spell JSON is still behind it.",
      explanation: "Structured -> JSON duration review is blocked because the interpreted structured layer has no comparable duration value.",
      structuredMatchesJson: false,
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  // If the structured value and runtime JSON already line up after normalization,
  // keep the panel quiet unless a report row still exists and needs explaining.
  if (!mismatch && structuredMatchesJson) {
    return undefined;
  }

  // A blank runtime duration is a real app-layer problem because the glossary
  // spell card renders from JSON rather than the structured markdown block.
  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-json-field" || currentJsonValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured spell block has Duration data, but the runtime spell JSON does not currently expose it.",
      problemStatement: "The structured spell block has Duration data, but the runtime spell JSON is still missing the comparable Duration value.",
      classification: "missing_runtime_duration",
      reviewVerdict: "Update the runtime spell JSON so the glossary spell card is no longer missing this duration fact.",
      explanation: "This is real implementation drift because the glossary renders from runtime spell JSON, not from the structured markdown block.",
      structuredMatchesJson: false,
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  // Low-severity wording cases are still worth surfacing, but they should not
  // be mistaken for runtime mechanics drift.
  if (
    structuredBreakdown?.type === currentJsonBreakdown?.type
    && structuredBreakdown?.concentration === currentJsonBreakdown?.concentration
    && structuredBreakdown?.value === currentJsonBreakdown?.value
    && structuredBreakdown?.unit === currentJsonBreakdown?.unit
  ) {
    if (
      structuredBreakdown?.concentration
      && currentJsonBreakdown?.concentration
      && structuredBreakdown?.type === "timed"
      && currentJsonBreakdown?.type === "timed"
      && normalizedStructured.startsWith("concentration ")
      && !normalizedJson.startsWith("concentration ")
    ) {
      return {
        structuredValue,
        currentJsonValue,
        summary: summary || "The structured Duration still flattens concentration into one display string while the runtime spell JSON stores concentration separately from the timed duration facts.",
        problemStatement: `The structured Duration says "${structuredValue}", but the runtime spell JSON already splits that into concentration=true plus the timed duration "${currentJsonValue}".`,
        classification: "flattened_concentration_runtime_residue",
        reviewVerdict: "Low-severity display residue. The runtime spell JSON already carries the same concentration and timed duration facts.",
        explanation: "This is the runtime mirror of the canonical flattened-concentration issue: the spell card JSON is semantically correct, but the structured display still compresses concentration and duration into one string.",
        structuredMatchesJson,
        structuredBreakdown,
        currentJsonBreakdown,
      };
    }

    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Duration and runtime spell JSON appear semantically aligned, but the rendered wording still differs.",
      problemStatement: `The structured Duration says "${structuredValue}" while the runtime spell JSON says "${currentJsonValue}", but they reduce to the same duration facts.`,
      classification: "duration_wording_runtime_residue",
      reviewVerdict: "Low-severity display residue. The runtime spell JSON does not appear to be behind on the actual duration facts.",
      explanation: "This is usually singular/plural or capitalization residue in the rendered duration text, not a real gameplay drift.",
      structuredMatchesJson,
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  // The structured layer may carry a more specific "until dispelled" style
  // label while the runtime JSON still stores a normalized special bucket.
  if (
    currentJsonBreakdown?.type === "special"
    && (
      structuredBreakdown?.type === "special"
      || structuredBreakdown?.type === "until_dispelled"
      || structuredBreakdown?.type === "until_dispelled_or_triggered"
    )
  ) {
    const isTriggeredBoundary = structuredBreakdown?.type === "until_dispelled_or_triggered";
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Duration is more specific than the runtime spell JSON, which still stores a generic special-duration bucket.",
      problemStatement: isTriggeredBoundary
        ? `The structured Duration says "${structuredValue}", but the runtime spell JSON still stores the generic "${currentJsonValue}" duration bucket and does not expose the trigger-ending clause.`
        : `The structured Duration says "${structuredValue}", but the runtime spell JSON still stores the generic "${currentJsonValue}" duration bucket.`,
      classification: isTriggeredBoundary
        ? "until_dispelled_or_triggered_boundary"
        : structuredBreakdown?.type === "until_dispelled"
          ? "until_dispelled_boundary"
          : "special_bucket_normalization",
      reviewVerdict: "Accepted model/display boundary unless the runtime duration model is widened beyond the generic special bucket.",
      explanation: "The runtime spell JSON is carrying a coarser normalized duration concept than the structured layer, so this is a model-boundary case rather than a simple missing value.",
      structuredMatchesJson: false,
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  return {
    structuredValue,
    currentJsonValue,
    summary: summary || "The structured Duration and runtime spell JSON still disagree for this spell.",
    problemStatement: `The structured Duration says "${structuredValue}", but the runtime spell JSON says "${currentJsonValue}".`,
    classification: "true_runtime_duration_drift",
    reviewVerdict: "Review and update the runtime spell JSON if the glossary spell card is still lagging behind the structured Duration interpretation.",
    explanation: "This still looks like real implementation drift because the runtime/app layer does not reduce cleanly to the structured Duration value.",
    structuredMatchesJson,
    structuredBreakdown,
    currentJsonBreakdown,
  };
}

// ============================================================================
// Casting Time bucket helpers
// ============================================================================
// The Casting Time residue bucket is mostly about presentation shape, not wrong
// spell facts. Canonical pages often fold "Ritual" or a trigger footnote marker
// directly into the casting-time string, while the spell JSON stores those ideas
// in separate fields. This section makes that distinction explicit so the gate
// panel can tell the user whether a spell is actually wrong or just rendered
// differently between the two systems.
// ============================================================================

function buildCastingTimeMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep only the single Casting Time row per spell that the glossary needs in
  // order to explain the residue bucket. If the audit grows additional casting
  // time rows later, the latest one wins and the panel stays compact.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Casting Time") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let castingTimeMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

function humanizeCastingTimeUnit(unit: string, value: number): string {
  if (unit === "action") return value === 1 ? "action" : "actions";
  if (unit === "bonus_action") return value === 1 ? "bonus action" : "bonus actions";
  if (unit === "reaction") return value === 1 ? "reaction" : "reactions";
  if (unit === "minute") return value === 1 ? "minute" : "minutes";
  if (unit === "hour") return value === 1 ? "hour" : "hours";
  if (unit === "round") return value === 1 ? "round" : "rounds";
  return unit.replace(/_/g, " ");
}

function formatBaseCastingTime(spell: unknown): string | undefined {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return undefined;

  const { value, unit } = parsed.data.castingTime;
  return `${value} ${humanizeCastingTimeUnit(unit, value)}`;
}

function deriveRitualCastingTime(spell: unknown): string | undefined {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success || !parsed.data.ritual) return undefined;

  const { value, unit } = parsed.data.castingTime;

  // Ritual casting always adds ten minutes to the base cast. For minute/hour
  // spells we can collapse that into one readable number. For action-style
  // spells we keep the "plus normal cast" wording visible because it is more
  // truthful than pretending the result is only a flat minute count.
  if (unit === "minute") {
    const ritualMinutes = value + 10;
    return `${ritualMinutes} ${humanizeCastingTimeUnit("minute", ritualMinutes)}`;
  }

  if (unit === "hour") {
    const totalMinutes = (value * 60) + 10;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
      return `${hours} ${humanizeCastingTimeUnit("hour", hours)}`;
    }

    return `${hours} ${humanizeCastingTimeUnit("hour", hours)} ${minutes} ${humanizeCastingTimeUnit("minute", minutes)}`;
  }

  return `10 minutes + ${value} ${humanizeCastingTimeUnit(unit, value)}`;
}

function classifyCastingTimeStructuredVsJson(
  spell: unknown,
  structuredValue: string,
): NonNullable<CastingTimeBucketDetail["structuredVsJson"]> {
  const parsed = SpellValidator.safeParse(spell);

  if (!parsed.success) {
    return {
      structuredValue,
      currentJsonBaseCastingTime: undefined,
      currentJsonRitual: undefined,
      currentJsonRitualCastingTime: undefined,
      problemStatement: "The runtime spell JSON could not be parsed cleanly enough to verify whether it still matches the structured casting-time data.",
      classification: "real_implementation_drift",
      reviewVerdict: "Runtime comparison blocked. Treat this as unresolved until the live spell JSON parses cleanly again.",
      structuredMatchesJson: false,
    };
  }

  const currentJsonBaseCastingTime = formatBaseCastingTime(spell);
  const currentJsonRitual = parsed.data.ritual;
  const currentJsonRitualCastingTime = deriveRitualCastingTime(spell);
  const structuredLower = structuredValue.toLowerCase().trim();
  const baseLower = (currentJsonBaseCastingTime ?? "").toLowerCase();
  const structuredContainsBaseTiming = baseLower.length > 0 && structuredLower.includes(baseLower);
  const structuredMentionsRitual = structuredLower.includes("ritual");
  const structuredHasFootnoteOrTriggerProse = structuredLower.includes("*") || structuredLower.includes(", when ");

  // If the structured display string is the same normalized base timing the
  // runtime JSON already exposes, then this lane is fully aligned.
  if (structuredLower === baseLower) {
    return {
      structuredValue,
      currentJsonBaseCastingTime,
      currentJsonRitual,
      currentJsonRitualCastingTime,
      problemStatement: "The structured casting-time value and the runtime spell JSON are aligned.",
      classification: "aligned",
      reviewVerdict: "No runtime drift. The glossary is already rendering the same base timing fact the structured spell data expresses.",
      structuredMatchesJson: true,
    };
  }

  // Structured strings that still contain the same base timing but also carry
  // ritual text or trigger prose are not wrong. They are a richer presentation
  // layer than the normalized runtime JSON currently stores.
  if (
    structuredContainsBaseTiming
    && (
      (structuredMentionsRitual && currentJsonRitual)
      || structuredHasFootnoteOrTriggerProse
      || structuredLower !== baseLower
    )
  ) {
    return {
      structuredValue,
      currentJsonBaseCastingTime,
      currentJsonRitual,
      currentJsonRitualCastingTime,
      problemStatement: "The structured spell data still contains the same base timing fact as the runtime JSON, but it also carries extra ritual or trigger wording that the runtime model stores elsewhere or derives separately.",
      classification: "model_display_boundary",
      reviewVerdict: "Accepted model/display boundary. The runtime JSON is not behind on the base timing fact; it is simply more normalized than the structured spell header.",
      structuredMatchesJson: false,
    };
  }

  return {
    structuredValue,
    currentJsonBaseCastingTime,
    currentJsonRitual,
    currentJsonRitualCastingTime,
    problemStatement: "The structured casting-time value does not reduce cleanly to the current runtime spell JSON, so the runtime layer may still be behind the interpreted structured spell data.",
    classification: "real_implementation_drift",
    reviewVerdict: "Possible real implementation drift. The structured spell header is not being explained away by the current normalized runtime casting-time fields.",
    structuredMatchesJson: false,
  };
}

function classifyCastingTimeMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): CastingTimeBucketDetail {
  const parsed = SpellValidator.safeParse(spell);
  const canonicalValue = mismatch.canonicalValue ?? "";
  const structuredValue = mismatch.structuredValue ?? "";

  if (!parsed.success) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The live spell JSON could not be parsed cleanly enough to verify whether the casting-time mismatch is only display residue or a real timing problem.",
      classification: "true_casting_time_drift",
      interpretation: "Casting Time drift exists, but the live spell JSON did not parse cleanly enough to distinguish display residue from a true timing mismatch.",
      reviewVerdict: "Possible real timing drift, but the live JSON could not be read cleanly enough to prove it.",
      structuredVsJson: classifyCastingTimeStructuredVsJson(spell, structuredValue),
    };
  }

  const baseCastingTime = formatBaseCastingTime(spell);
  const ritualCastingTime = deriveRitualCastingTime(spell);
  const ritual = parsed.data.ritual;
  const canonicalLower = canonicalValue.toLowerCase();
  const structuredLower = structuredValue.toLowerCase();
  const baseLower = (baseCastingTime ?? "").toLowerCase();
  const structuredContainsBaseTiming = baseLower.length > 0 && structuredLower.includes(baseLower);
  const canonicalContainsBaseTiming = baseLower.length > 0 && canonicalLower.includes(baseLower);

  // Canonical pages often append "Ritual" to the base cast string. That does
  // not mean the base timing is wrong; it means the source page is collapsing
  // timing and ritual capability into one display label.
  if (ritual && canonicalContainsBaseTiming && canonicalLower.includes("ritual")) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The canonical page is appending "Ritual" to the casting-time label, but the underlying base casting time still appears to be ${baseCastingTime ?? "the current structured value"}.`,
      classification: "ritual_inline_display",
      interpretation: "The base casting time matches. The canonical page is folding ritual capability into the casting-time label instead of keeping it as a separate field.",
      reviewVerdict: "Display residue only. The source is collapsing ritual capability into the label rather than disagreeing about the base cast time.",
      baseCastingTime,
      ritual,
      ritualCastingTime,
      structuredContainsBaseTiming,
      canonicalContainsBaseTiming,
      structuredVsJson: classifyCastingTimeStructuredVsJson(spell, structuredValue),
    };
  }

  // Many reaction and bonus-action spells use a raw footnote marker on the
  // canonical page while the structured data stores the trigger context in
  // separate fields or prose. That is a display mismatch, not a timing failure.
  if (canonicalValue.includes("*")) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The canonical page is using a raw footnote marker for trigger context, while the structured spell stores the trigger details directly instead of preserving the source marker.",
      classification: "trigger_footnote_display",
      interpretation: "The canonical page adds a footnote marker to signal trigger context, while the structured data stores that context separately instead of keeping the raw source marker.",
      reviewVerdict: "Display residue only. The mismatch is about how trigger context is presented, not the base timing fact.",
      baseCastingTime,
      ritual,
      ritualCastingTime,
      structuredContainsBaseTiming,
      canonicalContainsBaseTiming,
      structuredVsJson: classifyCastingTimeStructuredVsJson(spell, structuredValue),
    };
  }

  // Some canonical strings add a suffix beyond the base action value without
  // using the ritual word or a star marker. Keep that distinct so the panel can
  // still explain it as source-display residue.
  if (canonicalContainsBaseTiming && canonicalLower !== baseLower) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: "The canonical page is adding extra display text after the base casting-time value, even though the underlying timing still appears to match the spell JSON.",
      classification: "canonical_suffix_display",
      interpretation: "The canonical page adds extra casting-time display text beyond the normalized base timing, but the underlying action/minute value still appears to match.",
      reviewVerdict: "Likely display residue. The source string contains more prose than the normalized structured timing field.",
      baseCastingTime,
      ritual,
      ritualCastingTime,
      structuredContainsBaseTiming,
      canonicalContainsBaseTiming,
      structuredVsJson: classifyCastingTimeStructuredVsJson(spell, structuredValue),
    };
  }

  return {
    structuredValue,
    canonicalValue,
    summary: mismatch.summary,
    problemStatement: "The canonical casting-time string does not reduce cleanly to the current structured and JSON timing fields, so this spell still looks like a real casting-time drift case.",
    classification: "true_casting_time_drift",
    interpretation: "The canonical casting-time string does not reduce cleanly to the current structured timing fields and should be reviewed as a possible real drift case.",
    reviewVerdict: "Possible real timing drift. The source string is not being explained away by ritual-inline or trigger-footnote display rules.",
    baseCastingTime,
    ritual,
    ritualCastingTime,
    structuredContainsBaseTiming,
    canonicalContainsBaseTiming,
    structuredVsJson: classifyCastingTimeStructuredVsJson(spell, structuredValue),
  };
}

// ============================================================================
// Description bucket helpers
// ============================================================================
// The description lane needs more nuance than a raw mismatch label. Some spells
// still disagree because the canonical snapshot keeps prose under "Rules Text"
// instead of a dedicated "Description" field, while others still have real
// structured text drift. This section classifies those cases so the glossary can
// show whether a spell needs content work or whether the audit is hitting a
// source-shape boundary.
// ============================================================================

function buildDescriptionMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep one description row per spell. If the report ever starts emitting more
  // than one description mismatch for a single spell, the latest row wins and the
  // glossary still stays compact instead of turning into a raw report dump.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Description") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let descriptionMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

// ============================================================================
// Description runtime bucket helpers
// ============================================================================
// The glossary spell card renders from runtime spell JSON, not from the
// structured markdown block. That means Description is only fully reviewed when
// the gate checker also compares the structured Description against the live
// runtime JSON description for the selected spell.
//
// We keep this as a separate bucket from canonical -> structured because those
// two comparisons answer different questions:
// - did the interpreted structured layer capture the canonical prose?
// - is the actual runtime JSON still behind the structured layer?
// ============================================================================

function buildDescriptionRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Description") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let descriptionRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

function getCurrentJsonDescription(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success || typeof parsed.data.description !== "string") return "";
  return parsed.data.description;
}

function classifyDescriptionRuntimeMismatch(
  spell: unknown,
  mismatch: StructuredJsonMismatchRecord | undefined,
  structuredDescriptionBucket: DescriptionBucketDetail | undefined,
): DescriptionRuntimeBucketDetail | undefined {
  const currentJsonValue = getCurrentJsonDescription(spell);
  const structuredValue = mismatch?.structuredValue ?? structuredDescriptionBucket?.structuredValue ?? "";
  const summary = mismatch?.summary ?? "";

  // If the structured layer itself is missing description text, the runtime
  // comparison is blocked. Showing that explicitly prevents the glossary from
  // pretending the runtime JSON is the only problem in this lane.
  if (structuredDescriptionBucket?.classification === "missing_structured_description" || structuredValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime JSON description cannot be reviewed because the structured spell block does not currently provide a Description value to compare against.",
      problemStatement: "The structured spell block does not currently provide a Description value, so the runtime JSON description cannot be meaningfully reviewed yet.",
      classification: "blocked_missing_structured_description",
      reviewVerdict: "Fix the structured Description first, then review whether the runtime spell JSON is still behind it.",
      explanation: "Description runtime review is blocked because the interpreted structured layer has no comparable Description value.",
    };
  }

  if (!mismatch && normalizeDescriptionForComparison(structuredValue) === normalizeDescriptionForComparison(currentJsonValue)) {
    return undefined;
  }

  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-json-field" || currentJsonValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime spell JSON does not currently store a comparable Description value.",
      problemStatement: "The structured spell block has Description text, but the runtime spell JSON is still missing its Description value.",
      classification: "missing_runtime_description",
      reviewVerdict: "Copy the structured Description into the runtime spell JSON so the glossary spell card is no longer missing spell prose.",
      explanation: "This is real implementation drift because the glossary renders from the runtime spell JSON, not from the structured markdown block.",
    };
  }

  if (normalizeDescriptionForComparison(structuredValue) === normalizeDescriptionForComparison(currentJsonValue)) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured markdown Description and the runtime spell JSON differ only by formatting or encoding residue.",
      problemStatement: "The structured Description and runtime spell JSON description appear to say the same thing, but formatting differences are still preventing exact equality.",
      classification: "formatting_runtime_residue",
      reviewVerdict: "This is low-severity runtime residue. Clean it only if you need exact text parity between the structured and runtime layers.",
      explanation: "The glossary spell card is not obviously missing meaning here; the remaining difference is formatting or encoding noise.",
    };
  }

  return {
    structuredValue,
    currentJsonValue,
    summary: summary || "The structured markdown Description and the runtime spell JSON still say materially different things.",
    problemStatement: "The structured Description and the runtime spell JSON description are materially different for this spell.",
    classification: "real_runtime_drift",
    reviewVerdict: "Review the runtime spell JSON description against the structured Description and update the JSON if the spell card is still lagging behind the interpreted layer.",
    explanation: "This is real implementation drift because the runtime/app layer no longer matches the structured spell data the gate checker is comparing against.",
  };
}

// ============================================================================
// Higher Levels bucket helpers
// ============================================================================
// This bucket exists for the exact review lane the user is working through now:
// many spells have a structured Higher Levels field that agrees with the live
// JSON, but the copied canonical snapshot stores the same scaling text inside
// raw Rules Text instead of exposing a separate comparable field.
//
// The glossary gate checker therefore needs to answer two different questions:
// - does the structured markdown still agree with the live spell JSON?
// - is the canonical mismatch only a source-shape issue, or a real content drift?
//
// We keep this logic bucket-specific, just like Range/Area and Casting Time,
// because the explanation rules are unique to this one residue family.
// ============================================================================

function buildHigherLevelsMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep the latest Higher Levels mismatch row per spell. The gate checker only
  // needs one focused explanation, not the full raw audit payload.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Higher Levels") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let higherLevelsMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

// ============================================================================
// Sub-Classes bucket helpers
// ============================================================================
// This bucket exists to separate "the source listed more subclass lines" from
// "the actual normalized spell payload is wrong." Canonical Available For lists
// often preserve subclass/domain access that simply repeats a base class already
// present in `classes`, while the current validator intentionally normalizes those
// repeated-base entries away from JSON.
//
// The glossary therefore needs to answer a more human question than the audit
// report does on its own: is this spell missing subclass truth, or is the source
// just showing evidence that the current storage policy refuses to duplicate?
// ============================================================================

function buildSubClassesMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep one focused Sub-Classes row per spell so the glossary can explain the
  // residue without becoming a raw report browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Sub-Classes") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let subClassesMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

function parseDelimitedField(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function baseClassFromSubClassEntry(entry: string): string | null {
  const separatorIndex = entry.indexOf(" - ");
  if (separatorIndex <= 0) return null;
  return entry.slice(0, separatorIndex).trim();
}

function classifySubClassesMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): SubClassesBucketDetail {
  const parsed = SpellValidator.safeParse(spell);
  const structuredEntries = parseDelimitedField(mismatch.structuredValue ?? "");
  const canonicalEntries = parseDelimitedField(mismatch.canonicalValue ?? "");

  // If the spell JSON failed to parse, keep the bucket honest and only use the
  // raw audit strings. We still surface the mismatch, but we do not pretend to
  // know which entries are policy-normalized and which are true drift.
  if (!parsed.success) {
    const malformedEntries = [...structuredEntries, ...canonicalEntries].filter((entry) => entry.toLowerCase() === "none" || !entry.includes(" - "));

    return {
      structuredValue: mismatch.structuredValue ?? "",
      canonicalValue: mismatch.canonicalValue ?? "",
      summary: mismatch.summary,
      classification: malformedEntries.length > 0 ? "markdown_malformed_value" : "real_subclass_drift",
      interpretation: malformedEntries.length > 0
        ? "Subclass review found malformed entries like bare placeholders, and the live spell JSON was not available to determine whether the remaining differences are policy normalization or real access drift."
        : "Subclass review found differences, but the live spell JSON did not parse cleanly enough to tell policy normalization apart from real access drift.",
      currentClasses: [],
      currentSubClasses: [],
      verificationState: undefined,
      repeatedBaseEntries: [],
      canonicalOnlyEntries: canonicalEntries,
      structuredOnlyEntries: structuredEntries,
      malformedEntries,
    };
  }

  const currentClasses = parsed.data.classes;
  const currentSubClasses = parsed.data.subClasses;
  const verificationState = parsed.data.subClassesVerification;
  const canonicalOnlyEntries = canonicalEntries.filter((entry) => !structuredEntries.includes(entry));
  const structuredOnlyEntries = structuredEntries.filter((entry) => !canonicalEntries.includes(entry));
  const malformedEntries = [...new Set([...structuredEntries, ...canonicalEntries].filter((entry) => entry.toLowerCase() === "none" || !entry.includes(" - ")))];
  const repeatedBaseEntries = canonicalOnlyEntries.filter((entry) => {
    const baseClass = baseClassFromSubClassEntry(entry);
    return Boolean(baseClass && currentClasses.includes(baseClass));
  });
  const canonicalEntriesThatNeedStorage = canonicalOnlyEntries.filter((entry) => !repeatedBaseEntries.includes(entry));

  // Malformed placeholder-style entries deserve their own classification because
  // they are neither valid canonical evidence nor intentional normalization.
  if (malformedEntries.length > 0) {
    return {
      structuredValue: mismatch.structuredValue ?? "",
      canonicalValue: mismatch.canonicalValue ?? "",
      summary: mismatch.summary,
      classification: "markdown_malformed_value",
      interpretation: "The subclass lane contains malformed placeholder-style values, so this mismatch is not only about normalization policy. Clean the malformed entry first, then reassess whether the remaining difference is canonical-only evidence or real drift.",
      currentClasses,
      currentSubClasses,
      verificationState,
      repeatedBaseEntries,
      canonicalOnlyEntries,
      structuredOnlyEntries,
      malformedEntries,
    };
  }

  // If the only missing canonical entries repeat a base class that is already
  // present, the structured/JSON side is behaving exactly like the current
  // validator policy intends.
  if (structuredOnlyEntries.length === 0 && canonicalEntriesThatNeedStorage.length === 0 && repeatedBaseEntries.length > 0) {
    return {
      structuredValue: mismatch.structuredValue ?? "",
      canonicalValue: mismatch.canonicalValue ?? "",
      summary: mismatch.summary,
      classification: "repeated_base_normalization",
      interpretation: "The canonical snapshot preserves subclass/domain lines whose base classes are already present in the spell's base class list. The normalized structured data intentionally omits those repeated-base entries to satisfy the current validator policy.",
      currentClasses,
      currentSubClasses,
      verificationState,
      repeatedBaseEntries,
      canonicalOnlyEntries,
      structuredOnlyEntries,
      malformedEntries,
    };
  }

  return {
    structuredValue: mismatch.structuredValue ?? "",
    canonicalValue: mismatch.canonicalValue ?? "",
    summary: mismatch.summary,
    classification: "real_subclass_drift",
    interpretation: "At least one canonical subclass line is not explained away by the repeated-base normalization rule, so this spell still needs a real access-data review instead of a policy-only explanation.",
    currentClasses,
    currentSubClasses,
    verificationState,
    repeatedBaseEntries,
    canonicalOnlyEntries,
    structuredOnlyEntries,
    malformedEntries,
  };
}

// ============================================================================
// Sub-Classes runtime review
// ============================================================================
// The canonical Sub-Classes bucket explains how the interpreted structured layer
// differs from the copied canonical Available For surface.
//
// The glossary spell card does not render from that structured layer. It renders
// from runtime spell JSON. This second bucket answers the missing implementation
// question directly for the selected spell: does the runtime JSON still carry the
// subclass access that the structured layer currently claims?
// ============================================================================

function buildSubClassesRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep one runtime Sub-Classes row per spell so the gate panel can explain
  // the selected spell concisely without exposing the entire raw report table.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Sub-Classes") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let subClassesRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

function getCurrentSubClassesFacts(spell: unknown): Pick<
  SubClassesRuntimeBucketDetail,
  "currentJsonValue" | "currentBaseClasses" | "currentJsonSubClasses" | "verificationState" | "redundantJsonEntries"
> {
  if (!spell || typeof spell !== "object") {
    return {
      currentJsonValue: "",
      currentBaseClasses: [],
      currentJsonSubClasses: [],
      verificationState: undefined,
      redundantJsonEntries: [],
    };
  }

  const record = spell as Record<string, unknown>;
  const currentBaseClasses = Array.isArray(record.classes)
    ? record.classes.filter((entry): entry is string => typeof entry === "string")
    : [];
  const currentJsonSubClasses = Array.isArray(record.subClasses)
    ? record.subClasses.filter((entry): entry is string => typeof entry === "string")
    : [];
  const verificationState = typeof record.subClassesVerification === "string"
    ? record.subClassesVerification
    : undefined;
  const redundantJsonEntries = currentJsonSubClasses.filter((entry) => {
    const baseClass = baseClassFromSubClassEntry(entry);
    return Boolean(baseClass && currentBaseClasses.includes(baseClass));
  });

  return {
    currentJsonValue: currentJsonSubClasses.join(", "),
    currentBaseClasses,
    currentJsonSubClasses,
    verificationState,
    redundantJsonEntries,
  };
}

function classifySubClassesRuntimeMismatch(
  spell: unknown,
  mismatch: StructuredJsonMismatchRecord | undefined,
  structuredSubClassesBucket: SubClassesBucketDetail | undefined,
): SubClassesRuntimeBucketDetail | undefined {
  const structuredValue = mismatch?.structuredValue ?? structuredSubClassesBucket?.structuredValue ?? "";
  const structuredEntries = parseDelimitedField(structuredValue);
  const malformedStructuredEntries = [...new Set(structuredEntries.filter((entry) => entry.toLowerCase() === "none" || !entry.includes(" - ")))];
  const {
    currentJsonValue,
    currentBaseClasses,
    currentJsonSubClasses,
    verificationState,
    redundantJsonEntries,
  } = getCurrentSubClassesFacts(spell);
  const summary = mismatch?.summary
    ?? (structuredSubClassesBucket
      ? "The canonical Sub-Classes review is already active for this spell, so this runtime lane checks whether the structured subclass access still matches the live spell JSON."
      : "");
  const structuredOnlyEntries = structuredEntries.filter((entry) => !currentJsonSubClasses.includes(entry));
  const jsonOnlyEntries = currentJsonSubClasses.filter((entry) => !structuredEntries.includes(entry));
  const structuredMatchesJson = structuredValue.trim() === currentJsonValue.trim();
  const repeatedBaseStructuredEntries = structuredOnlyEntries.filter((entry) => {
    const baseClass = baseClassFromSubClassEntry(entry);
    return Boolean(baseClass && currentBaseClasses.includes(baseClass));
  });
  const runtimeMissingEntries = structuredOnlyEntries.filter((entry) => !repeatedBaseStructuredEntries.includes(entry));

  if (structuredValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime Sub-Classes value cannot be reviewed because the structured spell block does not currently expose a comparable Sub-Classes field.",
      problemStatement: "The structured spell block does not currently expose a Sub-Classes field, so the runtime spell JSON cannot be reviewed for this bucket yet.",
      classification: "missing_structured_subclasses",
      reviewVerdict: "Add or fix the structured Sub-Classes field first, then re-check whether the runtime spell JSON is still behind it.",
      explanation: "Sub-Classes runtime review is blocked because the interpreted structured layer has no comparable subclass-access field.",
      structuredMatchesJson,
      currentBaseClasses,
      currentJsonSubClasses,
      verificationState,
      structuredOnlyEntries,
      jsonOnlyEntries,
      redundantJsonEntries,
      malformedStructuredEntries,
    };
  }

  if (malformedStructuredEntries.length > 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Sub-Classes field contains malformed placeholder-style values.",
      problemStatement: "The structured Sub-Classes field contains malformed values, so the runtime spell JSON cannot be judged cleanly until the structured field is corrected.",
      classification: "malformed_structured_value",
      reviewVerdict: "Fix the malformed structured Sub-Classes entries first, then re-check whether the runtime spell JSON is still behind them.",
      explanation: "Placeholder-style values like bare 'None' are not valid subclass access data and should not be mirrored into runtime JSON.",
      structuredMatchesJson,
      currentBaseClasses,
      currentJsonSubClasses,
      verificationState,
      structuredOnlyEntries,
      jsonOnlyEntries,
      redundantJsonEntries,
      malformedStructuredEntries,
    };
  }

  if (!mismatch && !structuredSubClassesBucket && structuredMatchesJson && redundantJsonEntries.length === 0) {
    return undefined;
  }

  if (runtimeMissingEntries.length === 0 && jsonOnlyEntries.length === 0 && structuredMatchesJson && verificationState === "verified" && redundantJsonEntries.length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Sub-Classes field and the runtime spell JSON are aligned.",
      problemStatement: "The structured Sub-Classes field and the runtime spell JSON currently agree.",
      classification: "aligned",
      reviewVerdict: "No runtime Sub-Classes drift is currently indicated for this spell.",
      explanation: "The glossary is already rendering the same normalized subclass access the structured layer expresses.",
      structuredMatchesJson,
      currentBaseClasses,
      currentJsonSubClasses,
      verificationState,
      structuredOnlyEntries,
      jsonOnlyEntries,
      redundantJsonEntries,
      malformedStructuredEntries,
    };
  }

  if (runtimeMissingEntries.length === 0 && jsonOnlyEntries.length === 0 && repeatedBaseStructuredEntries.length > 0 && currentJsonSubClasses.length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Sub-Classes field includes repeated-base subclass entries that the runtime spell JSON intentionally normalizes away.",
      problemStatement: "The structured Sub-Classes field includes subclass entries whose base classes are already present in the runtime spell's base class list, so the runtime JSON intentionally omits them.",
      classification: "repeated_base_normalization",
      reviewVerdict: "Treat this as an accepted normalization boundary unless the project decides repeated-base subclass entries should also be stored in runtime JSON.",
      explanation: "The runtime JSON keeps subclass access non-redundant by omitting entries that repeat a base class already present in `classes`.",
      structuredMatchesJson,
      currentBaseClasses,
      currentJsonSubClasses,
      verificationState,
      structuredOnlyEntries,
      jsonOnlyEntries,
      redundantJsonEntries,
      malformedStructuredEntries,
    };
  }

  if (runtimeMissingEntries.length === 0 && jsonOnlyEntries.length === 0 && verificationState !== "verified") {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured and runtime Sub-Classes entries match, but the runtime spell JSON still marks subclass access as unverified.",
      problemStatement: "The runtime spell JSON already carries the same Sub-Classes entries as the structured layer, but it still marks subclass access as unverified.",
      classification: "json_unverified_after_transfer",
      reviewVerdict: "Mark the runtime spell JSON as verified once the structured subclass transfer for this spell is considered complete.",
      explanation: "The access data appears to be transferred already; the remaining drift is that the runtime verification flag still says the subclass lane is not trusted.",
      structuredMatchesJson,
      currentBaseClasses,
      currentJsonSubClasses,
      verificationState,
      structuredOnlyEntries,
      jsonOnlyEntries,
      redundantJsonEntries,
      malformedStructuredEntries,
    };
  }

  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-json-field" || (runtimeMissingEntries.length > 0 && currentJsonSubClasses.length === 0)) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Sub-Classes field has entries that the runtime spell JSON does not currently store.",
      problemStatement: "The structured Sub-Classes field still includes subclass access that the runtime spell JSON is missing for this spell.",
      classification: "missing_runtime_subclasses",
      reviewVerdict: "Copy the structured subclass access into the runtime spell JSON and then mark the subclass lane verified if the transfer is now complete.",
      explanation: verificationState === "verified"
        ? "This is real implementation drift because the glossary renders from runtime spell JSON, and that JSON is still missing subclass access that the structured layer now carries."
        : "This is real implementation drift because the glossary renders from runtime spell JSON, and that JSON is still missing subclass access that the structured layer now carries. The runtime verification flag also still says the subclass lane is unverified.",
      structuredMatchesJson,
      currentBaseClasses,
      currentJsonSubClasses,
      verificationState,
      structuredOnlyEntries,
      jsonOnlyEntries,
      redundantJsonEntries,
      malformedStructuredEntries,
    };
  }

  return {
    structuredValue,
    currentJsonValue,
    summary: summary || "The structured Sub-Classes field and the runtime spell JSON still disagree about subclass access for this spell.",
    problemStatement: "The structured Sub-Classes field still differs from the runtime spell JSON for this spell.",
    classification: "true_runtime_drift",
    reviewVerdict: "Review the structured subclass access against the runtime spell JSON and update the JSON if the structured layer now carries the intended access data.",
    explanation: "This remains runtime implementation drift until the glossary-facing spell JSON reflects the same normalized subclass access the structured layer expresses.",
    structuredMatchesJson,
    currentBaseClasses,
    currentJsonSubClasses,
    verificationState,
    structuredOnlyEntries,
    jsonOnlyEntries,
    redundantJsonEntries,
    malformedStructuredEntries,
  };
}

function normalizeHigherLevelsForComparison(value: string): string {
  return value
    .replace(/^Using a Higher-Level Spell Slot\.\s*/i, "")
    .replace(/^At Higher Levels\.\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrentHigherLevels(spell: unknown): string | undefined {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success || typeof parsed.data.higherLevels !== "string") return undefined;

  const normalized = parsed.data.higherLevels.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function classifyHigherLevelsMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): HigherLevelsBucketDetail {
  const structuredValue = mismatch.structuredValue ?? "";
  const canonicalValue = mismatch.canonicalValue ?? "";
  const currentJsonValue = formatCurrentHigherLevels(spell);
  const structuredMatchesJson = (currentJsonValue ?? "") === structuredValue;
  const normalizedStructured = normalizeHigherLevelsForComparison(structuredValue);
  const normalizedCanonical = normalizeHigherLevelsForComparison(canonicalValue);
  const normalizedValuesMatch = normalizedStructured.length > 0 && normalizedStructured === normalizedCanonical;

  // When the canonical side is "missing", this bucket usually means the copied
  // source snapshot kept the scaling text inline inside Rules Text rather than
  // exposing a separate Higher Levels field. That is a source-shape boundary.
  if ((mismatch.mismatchKind ?? "value-mismatch") === "missing-canonical-field") {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      classification: "audit_shape_residue",
      subbucket: "canonical_inline_only",
      interpretation: "The structured Higher Levels value still exists and the live JSON can still carry it, but the canonical snapshot usually stores the same scaling text inline under raw Rules Text instead of as a separate field.",
      currentJsonValue,
      structuredMatchesJson,
      normalizedValuesMatch,
      severityLabel: "Informational",
      reviewerConclusion: "This spell is not currently proving a bad higher-level value. The audit is missing a separate canonical Higher Levels field even though the source likely still includes the scaling text inline.",
      nextStep: "Treat this as a source-shape boundary unless the structured Higher Levels text also stops matching the live spell JSON.",
    };
  }

  // This is the most common non-empty canonical case: the canonical snapshot
  // prefixes the same scaling sentence with a standard source heading.
  if (normalizedValuesMatch) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      classification: "canonical_prefix_only",
      subbucket: "prefix_only_residue",
      interpretation: "The scaling text matches after removing the canonical source heading. This is display-shape residue, not a disagreement between the structured data and the source meaning.",
      currentJsonValue,
      structuredMatchesJson,
      normalizedValuesMatch,
      severityLabel: "Informational",
      reviewerConclusion: "The structured Higher Levels text is effectively the same as the canonical scaling text. The source is only wrapping it in a heading like 'Using a Higher-Level Spell Slot.'",
      nextStep: "No data correction is needed unless you want the audit to understand and ignore the canonical prefix automatically.",
    };
  }

  // Some summon/stat-block spells append a large canonical rules tail after the
  // opening scaling sentence. The structured model currently stores only the
  // concise higher-level summary, so this remains a source-shape boundary too.
  if (
    normalizedCanonical.startsWith(normalizedStructured)
    && normalizedCanonical.length > normalizedStructured.length
  ) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      classification: "canonical_statblock_tail",
      subbucket: "statblock_tail_residue",
      interpretation: "The structured Higher Levels summary matches the start of the canonical scaling text, but the source keeps additional stat-block detail in the same prose block. This is a storage-shape boundary, not a simple wrong value.",
      currentJsonValue,
      structuredMatchesJson,
      normalizedValuesMatch,
      severityLabel: "Informational",
      reviewerConclusion: "The spell's higher-level summary still lines up, but the canonical source keeps extra stat-block or summon detail inside the same upcast prose block.",
      nextStep: "Treat this as a storage-shape boundary unless the project later decides to model that extra canonical tail in a dedicated field.",
    };
  }

  return {
    structuredValue,
    canonicalValue,
    summary: mismatch.summary,
    classification: "true_higher_levels_drift",
    subbucket: "true_canonical_drift",
    interpretation: "The structured Higher Levels value still appears materially different from the copied canonical source text even after accounting for the usual source headings.",
    currentJsonValue,
    structuredMatchesJson,
    normalizedValuesMatch,
    severityLabel: "Review Needed",
    reviewerConclusion: "This looks like a real higher-level mismatch rather than a simple source formatting difference.",
    nextStep: "Review the structured Higher Levels text against the copied canonical scaling text and update the structured markdown and spell JSON if the local wording is incomplete or wrong.",
  };
}

// ============================================================================
// Higher Levels runtime review
// ============================================================================
// The canonical Higher Levels bucket above answers whether the interpreted
// structured header still lines up with the copied source snapshot. This second
// lane answers a different question the glossary actually cares about:
// does the runtime spell JSON still carry the same scaling text as the
// structured header that the user already reviewed?
// ============================================================================

function usesHigherLevelsPrefix(value: string): boolean {
  return /^Using a Higher-Level Spell Slot\.\s*/i.test(value) || /^At Higher Levels\.\s*/i.test(value);
}

function buildHigherLevelsRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep one Higher Levels mismatch row per spell. The gate checker is meant to
  // diagnose the current selected spell, not act like a raw report browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Higher Levels") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let higherLevelsRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

function classifyHigherLevelsRuntimeMismatch(
  spell: unknown,
  mismatch: StructuredJsonMismatchRecord | undefined,
  structuredHigherLevelsBucket: HigherLevelsBucketDetail | undefined,
): HigherLevelsRuntimeBucketDetail | undefined {
  const currentJsonValue = formatCurrentHigherLevels(spell) ?? "";
  const structuredValue = mismatch?.structuredValue ?? structuredHigherLevelsBucket?.structuredValue ?? "";
  const summary = mismatch?.summary ?? structuredHigherLevelsBucket?.summary ?? "";
  const normalizedStructured = normalizeHigherLevelsForComparison(structuredValue);
  const normalizedCurrentJson = normalizeHigherLevelsForComparison(currentJsonValue);
  const structuredMatchesJson = structuredValue === currentJsonValue;

  // If the interpreted layer has no Higher Levels value, the runtime review is
  // blocked. That is a structured-layer problem first, not proof that runtime
  // JSON drifted on its own.
  if (structuredValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime Higher Levels value cannot be reviewed because the structured spell block does not currently expose a Higher Levels value.",
      problemStatement: "The structured spell block does not currently expose a Higher Levels value, so the runtime JSON cannot be reviewed for this bucket yet.",
      classification: "missing_structured_higher_levels",
      subbucket: "structured_missing_json_present",
      reviewVerdict: "Fix the structured Higher Levels field first, then re-check whether the runtime spell JSON is still behind it.",
      explanation: "Higher Levels runtime review is blocked because the interpreted structured layer has no comparable scaling text.",
      structuredMatchesJson,
    };
  }

  // When no runtime mismatch row exists and the normalized values already match,
  // there is nothing useful to show in a dedicated runtime panel.
  if (!mismatch && normalizedStructured === normalizedCurrentJson) {
    return undefined;
  }

  // If the runtime JSON is blank while the structured layer has scaling text,
  // the glossary spell card is genuinely missing data that the interpreter
  // already knows about.
  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-json-field" || currentJsonValue.trim().length === 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured spell block has Higher Levels text, but the runtime spell JSON does not currently store it.",
      problemStatement: "The structured spell block has Higher Levels text, but the runtime spell JSON is still missing its Higher Levels value.",
      classification: "missing_runtime_higher_levels",
      subbucket: "runtime_missing_structured_present",
      reviewVerdict: "Copy the structured Higher Levels text into the runtime spell JSON so the glossary spell card is no longer missing scaling behavior.",
      explanation: "This is real implementation drift because the glossary renders from runtime spell JSON, not from the structured markdown block.",
      structuredMatchesJson,
    };
  }

  // Some runtime rows differ only because one side keeps the standard source
  // heading while the other stores the core scaling sentence directly.
  if (normalizedStructured === normalizedCurrentJson) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured and runtime Higher Levels text match after normalization.",
      problemStatement: "The structured and runtime Higher Levels values are semantically aligned, but formatting differences still prevent an exact match.",
      classification: "formatting_runtime_residue",
      subbucket: usesHigherLevelsPrefix(structuredValue) !== usesHigherLevelsPrefix(currentJsonValue)
        ? "prefix_only_residue"
        : "punctuation_or_formatting_residue",
      reviewVerdict: "Treat this as low-severity formatting residue unless the exact stored text now matters for downstream tooling.",
      explanation: "The glossary-facing runtime JSON appears to preserve the same higher-level meaning as the structured header after removing standard headings and spacing differences.",
      structuredMatchesJson,
    };
  }

  return {
    structuredValue,
    currentJsonValue,
    summary: summary || "The structured Higher Levels field and the runtime spell JSON still disagree.",
    problemStatement: "The structured Higher Levels value still differs from the runtime spell JSON for this spell.",
    classification: "real_runtime_drift",
    subbucket: "true_runtime_drift",
    reviewVerdict: "Review the structured Higher Levels text against the runtime spell JSON and update the JSON if the structured layer now represents the intended scaling behavior.",
    explanation: "This is real implementation drift until the glossary-facing runtime JSON carries the same scaling text as the interpreted structured layer.",
    structuredMatchesJson,
  };
}

function normalizeDescriptionForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/Ã¢â‚¬â„¢|â€™|’/g, "'")
    .replace(/Ã¢â‚¬â€|â€”|—/g, "-")
    .replace(/Ã¢Ë†â€™|âˆ’|−/g, "-")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyDescriptionMismatch(
  mismatch: StructuredCanonicalMismatchRecord,
): DescriptionBucketDetail {
  const kind = mismatch.mismatchKind ?? "value-mismatch";
  const structuredValue = mismatch.structuredValue ?? "";
  const canonicalValue = mismatch.canonicalValue ?? "";

  // When the audit says the canonical side is missing, but the copied snapshot
  // still contains Rules Text, we treat that as an audit-shape boundary rather
  // than accusing the spell of missing canonical prose.
  if (kind === "missing-canonical-field") {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      classification: "audit_shape_residue",
      interpretation: "Canonical prose is likely present under raw Rules Text, but the audit did not derive a directly comparable canonical Description field.",
    };
  }

  // This is the only description case that is definitely a structured content
  // failure rather than an audit-shape boundary.
  if (kind === "missing-structured-field") {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      classification: "missing_structured_description",
      interpretation: "Canonical spell prose exists, but the structured spell block is missing a comparable Description value.",
    };
  }

  const normalizedStructured = normalizeDescriptionForComparison(structuredValue);
  const normalizedCanonical = normalizeDescriptionForComparison(canonicalValue);

  // If normalization collapses the difference away, this is low-severity text
  // residue such as punctuation, glossary formatting, or encoding artifacts.
  if (normalizedStructured.length > 0 && normalizedStructured === normalizedCanonical) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      classification: "formatting_residue",
      interpretation: "The structured and canonical descriptions appear semantically aligned, but punctuation, glossary formatting, or encoding artifacts still prevent exact equality.",
    };
  }

  return {
    structuredValue,
    canonicalValue,
    summary: mismatch.summary,
    classification: "real_prose_drift",
    interpretation: "The structured Description is still materially different from the copied canonical Rules Text and likely omits or reshapes spell meaning.",
  };
}

// ============================================================================
// Classes bucket helpers
// ============================================================================
// The current canonical snapshots preserve class access under raw `Available For`
// lines rather than a dedicated `Classes` field. The structured-vs-canonical
// audit therefore reports many class mismatches as "missing canonical field"
// even when the normalized spell JSON still has the correct base classes.
//
// This bucket keeps that distinction visible in the glossary. It shows whether
// the structured header still matches the live spell JSON and whether the audit
// residue is best understood as source-shape mismatch or as a real base-class
// disagreement that should be reviewed separately.
// ============================================================================

function buildClassesMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Classes") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let classesMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};

function normalizeCanonicalClassEntry(entry: string): string {
  return entry
    .replace(/\s+\(Legacy\)$/i, "")
    .trim();
}

function classifyClassesMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): ClassesBucketDetail {
  const structuredEntries = parseDelimitedField(mismatch.structuredValue ?? "");
  const canonicalEntries = parseDelimitedField(mismatch.canonicalValue ?? "").map(normalizeCanonicalClassEntry);
  const parsed = SpellValidator.safeParse(spell);
  const currentClasses = parsed.success ? parsed.data.classes : [];
  const structuredMatchesJson = parsed.success
    ? structuredEntries.length === currentClasses.length && structuredEntries.every((entry) => currentClasses.includes(entry))
    : false;
  const canonicalOnlyEntries = canonicalEntries.filter((entry) => !structuredEntries.includes(entry));
  const structuredOnlyEntries = structuredEntries.filter((entry) => !canonicalEntries.includes(entry));

  if ((mismatch.mismatchKind ?? "value-mismatch") === "missing-canonical-field") {
    return {
      structuredValue: mismatch.structuredValue ?? "",
      canonicalValue: mismatch.canonicalValue ?? "",
      summary: mismatch.summary,
      problemStatement: structuredMatchesJson
        ? `The spell's base classes are currently stored as "${mismatch.structuredValue ?? "(none)"}" and that still matches the live spell JSON, but the canonical snapshot does not expose a separate comparable Classes field.`
        : `The structured class line says "${mismatch.structuredValue ?? "(none)"}", but the live spell JSON no longer matches it and the canonical snapshot still only exposes access under raw Available For lines.`,
      classification: "source_shape_residue",
      interpretation: structuredMatchesJson
        ? "The structured base class list matches the live spell JSON, but the canonical snapshot stores class access under raw `Available For` lines rather than a separate `Classes` field. This is source-shape residue, not active class drift."
        : "The canonical side still uses `Available For` instead of a direct `Classes` field, and the structured class line no longer matches the live spell JSON. Review the local base class list before treating this as source-shape-only residue.",
      reviewVerdict: structuredMatchesJson
        ? "No live base-class error is currently proven here. The bucket exists because the copied canonical snapshot uses a different storage shape."
        : "This spell needs a local base-class review first, because the structured header and the live spell JSON have already drifted apart.",
      currentClasses,
      canonicalBaseClasses: [],
      canonicalOnlyEntries,
      structuredOnlyEntries,
      structuredMatchesJson,
      canonicalUsesAvailableFor: true,
    };
  }

  if (canonicalOnlyEntries.length === 0 && structuredOnlyEntries.length === 0) {
    return {
      structuredValue: mismatch.structuredValue ?? "",
      canonicalValue: mismatch.canonicalValue ?? "",
      summary: mismatch.summary,
      problemStatement: `The comparable canonical class access reduces to the same base classes as the structured spell data: "${mismatch.structuredValue ?? "(none)"}".`,
      classification: "legacy_available_for_surface",
      interpretation: "The canonical access list appears to differ only because the raw source preserved legacy class labels in `Available For`. After normalization, the base class set aligns.",
      reviewVerdict: "No class correction is indicated. This residue is only about legacy labels on the source side.",
      currentClasses,
      canonicalBaseClasses: canonicalEntries,
      canonicalOnlyEntries,
      structuredOnlyEntries,
      structuredMatchesJson,
      canonicalUsesAvailableFor: false,
    };
  }

  return {
    structuredValue: mismatch.structuredValue ?? "",
    canonicalValue: mismatch.canonicalValue ?? "",
    summary: mismatch.summary,
    problemStatement: `The structured base classes "${mismatch.structuredValue ?? "(none)"}" still do not line up with the comparable canonical class access "${mismatch.canonicalValue ?? "(none)"}".`,
    classification: "true_class_drift",
    interpretation: "The structured base class list still appears materially different from the comparable canonical class access surface, so this spell likely needs a real base-class review rather than a source-shape explanation.",
    reviewVerdict: "Treat this as a real base-class mismatch until reviewed.",
    currentClasses,
    canonicalBaseClasses: canonicalEntries,
    canonicalOnlyEntries,
    structuredOnlyEntries,
    structuredMatchesJson,
    canonicalUsesAvailableFor: false,
  };
}

function classifyRangeAreaMismatch(
  spell: unknown,
  mismatch: StructuredCanonicalMismatchRecord,
): NonNullable<NonNullable<GateResult["bucketDetails"]>["rangeArea"]> {
  const structuredValue = mismatch.structuredValue ?? "";
  const canonicalValue = mismatch.canonicalValue ?? "";
  const parsed = SpellValidator.safeParse(spell);

  if (!parsed.success) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The structured Range/Area "${structuredValue}" does not currently reconcile with the canonical "${canonicalValue}", and the live spell JSON could not be parsed cleanly enough to explain why.`,
      classification: "true_range_area_drift",
      interpretation: "Range/Area drift exists, but the live spell JSON did not parse cleanly enough to classify it further here.",
      reviewVerdict: "Treat this as unresolved Range/Area drift until the live spell JSON can be inspected cleanly.",
    };
  }

  const { range, targeting } = parsed.data;
  const area = targeting.areaOfEffect;
  const structuredBreakdown = {
    rangeType: range.type,
    rangeDistance: range.distance,
    targetingType: targeting.type,
    areaShape: area.shape,
    areaSize: area.size,
    followsCaster: area.followsCaster,
  };

  // This is the strongest concrete bug this bucket can expose: self-centered
  // geometry stored in range.distance instead of in areaOfEffect.
  if (range.type === "self" && range.distance > 0) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The spell is storing a self-centered radius in range.distance (${range.distance} ft.) even though self-range geometry should live under targeting.areaOfEffect.`,
      classification: "self_radius_in_range",
      interpretation: "Likely normalization issue: the spell stores a self-centered radius in range.distance instead of in targeting.areaOfEffect.",
      reviewVerdict: "Move the self-centered radius out of range.distance and keep it only in areaOfEffect.",
      structuredBreakdown,
    };
  }

  // When the live JSON already stores explicit geometry, most mismatches are
  // just the canonical page using a terse display string.
  if (
    area.shape === "Emanation"
    || area.shape === "Wall"
    || area.shape === "Hemisphere"
    || area.shape === "Ring"
    || area.size > 0
  ) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The live spell JSON already stores explicit geometry (${area.shape} ${area.size} ft.), while the canonical source compresses that into the shorter display "${canonicalValue}".`,
      classification: "display_model_boundary",
      interpretation: "Likely display/model boundary: the JSON stores explicit geometry while the canonical page uses a compact Range/Area string.",
      reviewVerdict: "Keep the richer JSON geometry unless the underlying shape or size is actually wrong.",
      structuredBreakdown,
    };
  }

  // Some spells are only about cast reach and do not carry meaningful area
  // geometry. Those should still be separated from true shape/size drift.
  if (range.type !== "self" && area.size === 0) {
    return {
      structuredValue,
      canonicalValue,
      summary: mismatch.summary,
      problemStatement: `The spell's cast reach is represented locally as "${structuredValue}", while the canonical page presents it as "${canonicalValue}" without enough extra geometry to clearly reduce the difference.`,
      classification: "range_only_boundary",
      interpretation: `Range/Area differs between the normalized Aralia structure and the copied canonical display: ${mismatch.summary}`,
      reviewVerdict: "Review whether this is only a cast-range display difference before changing the JSON geometry.",
      structuredBreakdown,
    };
  }

  return {
    structuredValue,
    canonicalValue,
    summary: mismatch.summary,
    problemStatement: `The structured Range/Area "${structuredValue}" does not cleanly match the canonical "${canonicalValue}".`,
    classification: "true_range_area_drift",
    interpretation: `Range/Area differs between the normalized Aralia structure and the copied canonical display: ${mismatch.summary}`,
    reviewVerdict: "Treat this as a real Range/Area mismatch until the geometry is reviewed spell by spell.",
    structuredBreakdown,
  };
}

// ============================================================================
// Range/Area runtime bucket helpers
// ============================================================================
// Canonical -> structured review is only half the story for this lane. The
// glossary renders runtime spell JSON, so the gate checker also needs to answer
// whether the interpreted structured Range/Area has actually made it into the
// live spell JSON the app is using right now.
//
// This section reuses the same display rules as the structured-vs-json audit so
// the gate checker and the audit speak the same language about what counts as a
// real runtime drift versus a tolerated display/model boundary.
// ============================================================================

function buildRangeAreaRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Range/Area") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

let rangeAreaRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

function normalizeRangeAreaComparableText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseRangeAreaWord(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// Render a Range/Area measurement the same way the glossary spell card does.
// Missing units still mean legacy feet so older spell JSON keeps working while
// the explicit-unit migration is still in progress.
function formatRangeAreaDistance(
  value: number,
  unit: "feet" | "miles" | "inches" = "feet",
  style: "separated" | "hyphenated" = "separated",
): string {
  if (unit === "miles") {
    if (style === "hyphenated") {
      return `${value}-mile`;
    }

    return `${value} ${value === 1 ? "mile" : "miles"}`;
  }

  if (unit === "inches") {
    if (style === "hyphenated") {
      return `${value}-inch`;
    }

    return `${value} ${value === 1 ? "inch" : "inches"}`;
  }

  return style === "hyphenated" ? `${value}-ft.` : `${value} ft.`;
}

function parseStructuredRangeAreaDisplay(value: string): RangeAreaRuntimeBucketDetail["structuredBreakdown"] | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;

  const baseAreaMatch = normalized.match(/^(?<base>.+?)(?:\s+\((?<area>.+)\))?$/);
  const base = baseAreaMatch?.groups?.base?.trim() ?? normalized;
  const area = baseAreaMatch?.groups?.area?.trim() ?? "";
  const breakdown: RangeAreaRuntimeBucketDetail["structuredBreakdown"] = {};

  if (/^self$/i.test(base)) {
    breakdown.rangeType = "self";
  } else if (/^touch$/i.test(base)) {
    breakdown.rangeType = "touch";
  } else if (/^special$/i.test(base)) {
    breakdown.rangeType = "special";
  } else if (/^sight$/i.test(base)) {
    breakdown.rangeType = "sight";
  } else if (/^unlimited$/i.test(base)) {
    breakdown.rangeType = "unlimited";
  } else {
    const rangeMatch = base.match(/^(?<distance>\d+)\s*(?<unit>ft\.?|feet|foot|mile|miles|inch|inches)?$/i);
    if (rangeMatch?.groups?.distance) {
      breakdown.rangeType = "ranged";
      breakdown.rangeDistance = Number(rangeMatch.groups.distance);
      breakdown.rangeDistanceUnit = /mile/i.test(rangeMatch.groups.unit ?? "")
        ? "miles"
        : /inch/i.test(rangeMatch.groups.unit ?? "")
          ? "inches"
          : "feet";
    }
  }

  if (area) {
    const areaMatch = area.match(/^(?<size>\d+)(?<unit>-ft\.?|\s*ft\.?|\s*feet|\s*foot|\s*mile|\s*miles|\s*inch|\s*inches)?\s*(?<shape>.+)?$/i);
    if (areaMatch?.groups?.size) {
      breakdown.areaSize = Number(areaMatch.groups.size);
      breakdown.areaSizeUnit = /mile/i.test(areaMatch.groups.unit ?? "")
        ? "miles"
        : /inch/i.test(areaMatch.groups.unit ?? "")
          ? "inches"
          : "feet";
    }

    if (areaMatch?.groups?.shape) {
      breakdown.areaShape = areaMatch.groups.shape
        .trim()
        .split(/[_\s-]+/)
        .map(titleCaseRangeAreaWord)
        .join(" ");
    }
  }

  return breakdown;
}

function getCurrentJsonRangeAreaDisplay(spell: unknown): {
  currentJsonValue: string;
  currentJsonBreakdown?: RangeAreaRuntimeBucketDetail["currentJsonBreakdown"];
} {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) {
    return { currentJsonValue: "" };
  }

  const { range, targeting } = parsed.data;
  const area = targeting.areaOfEffect;
  let base = "";

  switch (range.type) {
    case "self":
      base = "Self";
      break;
    case "touch":
      base = "Touch";
      break;
    case "special":
      base = "Special";
      break;
    case "sight":
      base = "Sight";
      break;
    case "unlimited":
      base = "Unlimited";
      break;
    case "ranged":
      base = typeof range.distance === "number"
        ? formatRangeAreaDistance(range.distance, range.distanceUnit ?? "feet")
        : "";
      break;
    default:
      base = "";
      break;
  }

  const currentJsonBreakdown: RangeAreaRuntimeBucketDetail["currentJsonBreakdown"] = {
    rangeType: range.type,
    rangeDistance: range.distance,
    rangeDistanceUnit: range.distanceUnit,
    targetingType: targeting.type,
    areaShape: area.shape,
    areaSize: area.size,
    areaSizeUnit: area.sizeUnit,
    followsCaster: area.followsCaster,
  };

  if (!area || !area.size) {
    return { currentJsonValue: base, currentJsonBreakdown };
  }

  const renderedShape = area.shape
    ? area.shape.split(/[_\s-]+/).map(titleCaseRangeAreaWord).join(" ")
    : "";
  const areaLabel = renderedShape
    ? `${formatRangeAreaDistance(area.size, area.sizeUnit ?? "feet", "hyphenated")} ${renderedShape}`
    : `${area.size}`;
  return {
    currentJsonValue: base ? `${base} (${areaLabel})` : areaLabel,
    currentJsonBreakdown,
  };
}

function classifyRangeAreaRuntimeMismatch(
  spell: unknown,
  mismatch: StructuredJsonMismatchRecord | undefined,
  structuredCanonicalMismatch: StructuredCanonicalMismatchRecord | undefined,
): RangeAreaRuntimeBucketDetail | undefined {
  const structuredValue = mismatch?.structuredValue ?? structuredCanonicalMismatch?.structuredValue ?? "";
  const { currentJsonValue, currentJsonBreakdown } = getCurrentJsonRangeAreaDisplay(spell);
  const summary = mismatch?.summary
    ?? (structuredValue && currentJsonValue && normalizeRangeAreaComparableText(structuredValue) === normalizeRangeAreaComparableText(currentJsonValue)
      ? "The structured Range/Area and the runtime spell JSON are currently aligned."
      : "");

  if (!structuredValue && !mismatch) {
    return undefined;
  }

  const normalizedStructured = normalizeRangeAreaComparableText(structuredValue);
  const normalizedJson = normalizeRangeAreaComparableText(currentJsonValue);
  const structuredMatchesJson = normalizedStructured.length > 0 && normalizedStructured === normalizedJson;
  const structuredBreakdown = parseStructuredRangeAreaDisplay(structuredValue);

  if (!mismatch && structuredMatchesJson) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Range/Area and the runtime spell JSON are aligned.",
      problemStatement: "The structured Range/Area value and the runtime spell JSON currently agree.",
      classification: "aligned",
      reviewVerdict: "No runtime Range/Area drift is currently indicated for this spell.",
      structuredMatchesJson: true,
      explanation: "The glossary is already rendering the same Range/Area fact that the interpreted structured spell data expresses.",
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-structured-field" || !structuredValue.trim()) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime spell JSON still has Range/Area data, but the structured spell block is missing a comparable Range/Area value.",
      problemStatement: "The runtime spell JSON has Range/Area data, but the structured spell block is missing the comparable interpreted Range/Area line.",
      classification: "missing_structured_range_area",
      reviewVerdict: "Restore the structured Range/Area line first, then re-check whether the runtime JSON is still behind it.",
      structuredMatchesJson: false,
      explanation: "Structured -> JSON review is blocked because the interpreted structured layer does not currently provide a comparable Range/Area value.",
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  if ((mismatch?.mismatchKind ?? "value-mismatch") === "missing-json-field" || !currentJsonValue.trim()) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The structured Range/Area line exists, but the runtime spell JSON does not currently store a comparable Range/Area value.",
      problemStatement: "The structured spell block has Range/Area data, but the runtime spell JSON is missing the comparable Range/Area value.",
      classification: "missing_runtime_range_area",
      reviewVerdict: "Update the runtime spell JSON so the glossary spell card is no longer behind the structured Range/Area interpretation.",
      structuredMatchesJson: false,
      explanation: "This is real implementation drift because the glossary renders from the runtime spell JSON, not from the structured markdown block.",
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  if (currentJsonBreakdown?.rangeType === "self" && typeof currentJsonBreakdown.rangeDistance === "number" && currentJsonBreakdown.rangeDistance > 0) {
    return {
      structuredValue,
      currentJsonValue,
      summary: summary || "The runtime spell JSON is storing a self-centered area radius in range.distance instead of only in areaOfEffect.",
      problemStatement: `The runtime spell JSON still stores a self-centered radius in range.distance (${formatRangeAreaDistance(currentJsonBreakdown.rangeDistance, currentJsonBreakdown.rangeDistanceUnit ?? "feet")}) instead of only in targeting.areaOfEffect.`,
      classification: "range_used_as_area_radius",
      reviewVerdict: "Move the self-centered radius out of range.distance and keep it only in areaOfEffect.",
      structuredMatchesJson: false,
      explanation: "This is the exact normalization bug this runtime review block is meant to expose.",
      structuredBreakdown,
      currentJsonBreakdown,
    };
  }

  if (structuredBreakdown && currentJsonBreakdown) {
    const sameRangeType = (structuredBreakdown.rangeType ?? "") === currentJsonBreakdown.rangeType;
    const sameRangeDistance = (structuredBreakdown.rangeDistance ?? 0) === (currentJsonBreakdown.rangeDistance ?? 0);
    const sameRangeDistanceUnit = (structuredBreakdown.rangeDistanceUnit ?? "feet") === (currentJsonBreakdown.rangeDistanceUnit ?? "feet");
    const sameAreaShape = (structuredBreakdown.areaShape ?? "") === (currentJsonBreakdown.areaShape ?? "");
    const sameAreaSize = (structuredBreakdown.areaSize ?? 0) === (currentJsonBreakdown.areaSize ?? 0);
    const sameAreaSizeUnit = (structuredBreakdown.areaSizeUnit ?? "feet") === (currentJsonBreakdown.areaSizeUnit ?? "feet");

    if (sameRangeType && sameRangeDistance && sameRangeDistanceUnit && sameAreaShape && sameAreaSize && sameAreaSizeUnit) {
      return {
        structuredValue,
        currentJsonValue,
        summary: summary || "The structured Range/Area and the runtime spell JSON encode the same geometry, but they are still rendered differently.",
        problemStatement: "The structured Range/Area and the runtime spell JSON appear to describe the same geometry, but they are still formatted differently.",
        classification: "model_display_boundary",
        reviewVerdict: "Accepted model/display boundary. The runtime JSON is not currently behind on the actual geometry facts.",
        structuredMatchesJson: false,
        explanation: "The remaining difference looks like formatting or display-shape residue rather than a true runtime geometry bug.",
        structuredBreakdown,
        currentJsonBreakdown,
      };
    }
  }

  return {
    structuredValue,
    currentJsonValue,
    summary: summary || "The structured Range/Area line and the runtime spell JSON still disagree.",
    problemStatement: "The structured Range/Area interpretation and the runtime spell JSON are still materially different for this spell.",
    classification: "true_runtime_drift",
    reviewVerdict: "Review and update the runtime spell JSON if the glossary spell card is still lagging behind the structured Range/Area interpretation.",
    structuredMatchesJson,
    explanation: "This still looks like real implementation drift because the runtime/app layer does not reduce cleanly to the structured Range/Area value.",
    structuredBreakdown,
    currentJsonBreakdown,
  };
}

// Structured report configuration
// ============================================================================
// The spell gate checker still derives its bucket panels from the generated
// structured-vs-canonical and structured-vs-runtime reports, but those reports
// are now loaded on demand by spellGateBootstrap.ts instead of being imported
// eagerly when the glossary bundle starts up.
// ============================================================================

export function configureStructuredReportIndexes(
  structuredCanonicalReport: StructuredCanonicalReportFile,
  structuredJsonReport: StructuredJsonReportFile,
): void {
  rangeAreaMismatchIndex = buildRangeAreaMismatchIndex(structuredCanonicalReport);
  materialComponentMismatchIndex = buildMaterialComponentMismatchIndex(structuredCanonicalReport);
  materialComponentRuntimeMismatchIndex = buildMaterialComponentRuntimeMismatchIndex(structuredJsonReport);
  componentsMismatchIndex = buildComponentsMismatchIndex(structuredCanonicalReport);
  componentsRuntimeMismatchIndex = buildComponentsRuntimeMismatchIndex(structuredJsonReport);
  durationMismatchIndex = buildDurationMismatchIndex(structuredCanonicalReport);
  durationRuntimeMismatchIndex = buildDurationRuntimeMismatchIndex(structuredJsonReport);
  castingTimeMismatchIndex = buildCastingTimeMismatchIndex(structuredCanonicalReport);
  descriptionMismatchIndex = buildDescriptionMismatchIndex(structuredCanonicalReport);
  descriptionRuntimeMismatchIndex = buildDescriptionRuntimeMismatchIndex(structuredJsonReport);
  higherLevelsMismatchIndex = buildHigherLevelsMismatchIndex(structuredCanonicalReport);
  subClassesMismatchIndex = buildSubClassesMismatchIndex(structuredCanonicalReport);
  subClassesRuntimeMismatchIndex = buildSubClassesRuntimeMismatchIndex(structuredJsonReport);
  higherLevelsRuntimeMismatchIndex = buildHigherLevelsRuntimeMismatchIndex(structuredJsonReport);
  classesMismatchIndex = buildClassesMismatchIndex(structuredCanonicalReport);
  rangeAreaRuntimeMismatchIndex = buildRangeAreaRuntimeMismatchIndex(structuredJsonReport);
}
