// Range/Area bucket family (canonical + runtime), extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  GateResult,
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "../spellGateDataTypes";
import type { RangeAreaRuntimeBucketDetail } from "./bucketDetailTypes";

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

export function buildRangeAreaMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep only the one mismatch row the glossary needs for this bucket. If the
  // report format grows later, the UI still stays focused on Range/Area.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Range/Area") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

export function classifyRangeAreaMismatch(
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
    areaShape: area?.shape,
    areaSize: area?.size,
    followsCaster: area?.followsCaster,
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
    area
    && (
      area.shape === "Emanation"
      || area.shape === "Wall"
      || area.shape === "Hemisphere"
      || area.shape === "Ring"
      || area.size > 0
    )
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
  if (range.type !== "self" && (!area || area.size === 0)) {
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

export function buildRangeAreaRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Range/Area") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

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
    areaShape: area?.shape,
    areaSize: area?.size,
    areaSizeUnit: area?.sizeUnit,
    followsCaster: area?.followsCaster,
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

export function classifyRangeAreaRuntimeMismatch(
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
