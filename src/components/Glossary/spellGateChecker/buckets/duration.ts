// Duration bucket family (canonical + runtime), extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "../spellGateDataTypes";
import type { DurationBucketDetail, DurationRuntimeBucketDetail } from "./bucketDetailTypes";

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

export function buildDurationMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep a single duration row per spell. The glossary only needs one concise
  // explanation for this bucket rather than the full raw audit payload.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Duration") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

export function buildDurationRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep a single runtime Duration row per spell. The gate checker is a
  // spell-specific diagnosis surface, not a raw mismatch browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Duration") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

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

export function classifyDurationMismatch(
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

export function classifyDurationRuntimeMismatch(
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
