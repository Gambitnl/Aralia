// Higher Levels bucket family (canonical + runtime), extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "../spellGateDataTypes";
import type { HigherLevelsBucketDetail, HigherLevelsRuntimeBucketDetail } from "./bucketDetailTypes";

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

export function buildHigherLevelsMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep the latest Higher Levels mismatch row per spell. The gate checker only
  // needs one focused explanation, not the full raw audit payload.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Higher Levels") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
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

export function classifyHigherLevelsMismatch(
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

export function buildHigherLevelsRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep one Higher Levels mismatch row per spell. The gate checker is meant to
  // diagnose the current selected spell, not act like a raw report browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Higher Levels") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

export function classifyHigherLevelsRuntimeMismatch(
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
