// Material Component bucket family (canonical + runtime), extracted behind the spellGateBucketDetails facade.

import { SpellValidator } from "../../../../systems/spells/validation/spellValidator";
import type {
  StructuredCanonicalMismatchRecord,
  StructuredCanonicalReportFile,
  StructuredJsonMismatchRecord,
  StructuredJsonReportFile,
} from "../spellGateDataTypes";
import type { MaterialComponentBucketDetail, MaterialComponentRuntimeBucketDetail } from "./bucketDetailTypes";

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

export function buildMaterialComponentMismatchIndex(report: StructuredCanonicalReportFile): Record<string, StructuredCanonicalMismatchRecord> {
  const next: Record<string, StructuredCanonicalMismatchRecord> = {};

  // Keep one Material Component mismatch row per spell. The glossary panel is a
  // diagnosis surface, not a raw report browser.
  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Material Component") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

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

export function classifyMaterialComponentMismatch(
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

export function buildMaterialComponentRuntimeMismatchIndex(report: StructuredJsonReportFile): Record<string, StructuredJsonMismatchRecord> {
  const next: Record<string, StructuredJsonMismatchRecord> = {};

  for (const mismatch of report.mismatches ?? []) {
    if (mismatch.field !== "Material Component") continue;
    next[mismatch.spellId] = mismatch;
  }

  return next;
}

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

export function classifyMaterialComponentRuntimeMismatch(
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
