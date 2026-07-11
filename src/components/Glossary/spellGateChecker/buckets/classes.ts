// Classes bucket family, extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
} from "../spellGateDataTypes";
import type { ClassesBucketDetail } from "./bucketDetailTypes";
import { parseDelimitedField } from "./shared";

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

export function buildClassesMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Classes") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

function normalizeCanonicalClassEntry(entry: string): string {
  return entry
    .replace(/\s+\(Legacy\)$/i, "")
    .trim();
}

export function classifyClassesMismatch(
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
