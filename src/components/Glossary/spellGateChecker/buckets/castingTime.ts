// Casting Time bucket family, extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
} from "../spellGateDataTypes";
import type { CastingTimeBucketDetail } from "./bucketDetailTypes";

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

export function buildCastingTimeMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
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

export function classifyCastingTimeMismatch(
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
