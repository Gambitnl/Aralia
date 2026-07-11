// Sub-Classes bucket family (canonical + runtime), extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "../spellGateDataTypes";
import type { SubClassesBucketDetail, SubClassesRuntimeBucketDetail } from "./bucketDetailTypes";
import { parseDelimitedField } from "./shared";

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

export function buildSubClassesMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep one focused Sub-Classes row per spell so the glossary can explain the
  // residue without becoming a raw report browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Sub-Classes") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

function baseClassFromSubClassEntry(entry: string): string | null {
  const separatorIndex = entry.indexOf(" - ");
  if (separatorIndex <= 0) return null;
  return entry.slice(0, separatorIndex).trim();
}

export function classifySubClassesMismatch(
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

export function buildSubClassesRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep one runtime Sub-Classes row per spell so the gate panel can explain
  // the selected spell concisely without exposing the entire raw report table.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Sub-Classes") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

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

export function classifySubClassesRuntimeMismatch(
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
