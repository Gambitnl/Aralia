// Description bucket family (canonical + runtime), extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "../spellGateDataTypes";
import type { DescriptionBucketDetail, DescriptionRuntimeBucketDetail } from "./bucketDetailTypes";

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

export function buildDescriptionMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
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

export function buildDescriptionRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Description") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

function getCurrentJsonDescription(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success || typeof parsed.data.description !== "string") return "";
  return parsed.data.description;
}

export function classifyDescriptionRuntimeMismatch(
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

export function classifyDescriptionMismatch(
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
