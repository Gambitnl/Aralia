// Components bucket family (canonical + runtime), extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "../spellGateDataTypes";
import type { ComponentsBucketDetail, ComponentsRuntimeBucketDetail } from "./bucketDetailTypes";

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

export function buildComponentsMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep one component mismatch row per spell. The gate panel is meant to
  // explain the active bucket, not expose the full raw audit table.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Components") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

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

export function classifyComponentsMismatch(
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

export function buildComponentsRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  // Keep one Components runtime row per spell so the gate checker can explain
  // the selected spell concisely without exposing the whole raw report table.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Components") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

export function classifyComponentsRuntimeMismatch(
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
