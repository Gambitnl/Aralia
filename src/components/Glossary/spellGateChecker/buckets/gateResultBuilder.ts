// Core spell-gate result builder. Extracted from spellGateBucketDetails.ts, which now
// re-exports the public API below. This module owns the shared mismatch-index state and
// composes the per-bucket-family classifiers under ./

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
} from "../spellGateDataTypes";
import { buildRangeAreaMismatchIndex, buildRangeAreaRuntimeMismatchIndex, classifyRangeAreaMismatch, classifyRangeAreaRuntimeMismatch } from "./rangeArea";
import { buildMaterialComponentMismatchIndex, buildMaterialComponentRuntimeMismatchIndex, classifyMaterialComponentMismatch, classifyMaterialComponentRuntimeMismatch } from "./material";
import { buildComponentsMismatchIndex, buildComponentsRuntimeMismatchIndex, classifyComponentsMismatch, classifyComponentsRuntimeMismatch } from "./components";
import { buildDurationMismatchIndex, buildDurationRuntimeMismatchIndex, classifyDurationMismatch, classifyDurationRuntimeMismatch } from "./duration";
import { buildCastingTimeMismatchIndex, classifyCastingTimeMismatch } from "./castingTime";
import { buildDescriptionMismatchIndex, buildDescriptionRuntimeMismatchIndex, classifyDescriptionMismatch, classifyDescriptionRuntimeMismatch } from "./description";
import { buildHigherLevelsMismatchIndex, buildHigherLevelsRuntimeMismatchIndex, classifyHigherLevelsMismatch, classifyHigherLevelsRuntimeMismatch } from "./higherLevels";
import { buildSubClassesMismatchIndex, buildSubClassesRuntimeMismatchIndex, classifySubClassesMismatch, classifySubClassesRuntimeMismatch } from "./subClasses";
import { buildClassesMismatchIndex, classifyClassesMismatch } from "./classes";

// ============================================================================
// Imports
// ============================================================================
// The bucket builder validates live spell JSON before it reads optional fields.
// The shared data types keep this module aligned with the hook and display panels.
// ============================================================================

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
    // subClassesVerification retired 2026-05-11 with Sub-Classes bucket closure.
    // Treat absent or "verified" as verified; only an explicit "unverified" on
    // legacy data still gates the checklist.
    checklist.classAccessVerified = artifactEntry.localData.subClassesVerification !== "unverified";
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

// Shared mutable mismatch-index state. Populated by configureStructuredReportIndexes()
// and read by buildBucketDetailsForSpell(); no other module touches these bindings.
let rangeAreaMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let materialComponentMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let materialComponentRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};
let componentsMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let componentsRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};
let durationMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let durationRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};
let castingTimeMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let descriptionMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let descriptionRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};
let higherLevelsMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let subClassesMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let subClassesRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};
let higherLevelsRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};
let classesMismatchIndex: Record<string, StructuredCanonicalMismatchRecord> = {};
let rangeAreaRuntimeMismatchIndex: Record<string, StructuredJsonMismatchRecord> = {};

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
