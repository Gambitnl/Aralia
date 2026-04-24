// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/04/2026, 00:24:19
 * Dependents: components/Glossary/spellGateChecker/spellGateBootstrap.ts, components/Glossary/spellGateChecker/spellGateBucketDetails.ts, components/Glossary/spellGateChecker/spellGateSelectedRefresh.ts, components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file holds the shared data-only shapes used by the spell gate checker.
 *
 * The spell gate checker now pulls data from several places: generated spell-truth
 * reports, live spell JSON, glossary refresh endpoints, and the old fidelity audit.
 * Keeping those transport shapes in one file prevents the hook, the bootstrap
 * loader, and the selected-spell refresh helper from each re-declaring them.
 *
 * Called by: useSpellGateChecks.ts, spellGateBootstrap.ts, spellGateSelectedRefresh.ts
 * Depends on: no runtime game systems; this file is only shared typing glue
 */

// ============================================================================
// Manifest and audit snapshot shapes
// ============================================================================
// These types describe the generated or fetched spell-audit files the glossary
// gate checker reads. They are intentionally narrower than the full spell model:
// the goal here is to describe transport payloads, not runtime spell behavior.
// ============================================================================

export type SpellManifestEntry = {
  name: string;
  level: number;
  school: string;
  path: string;
};

export interface FidelityData {
  spells: Record<
    string,
    {
      state: string;
      gaps: string[];
      notes: string;
      lastAuditDate?: string;
    }
  >;
}

export interface SpellGateArtifactEntry {
  spellId: string;
  spellName: string;
  level: number;
  jsonPath: string;
  schema: {
    valid: boolean;
    issues: string[];
  };
  localData: {
    classesCount: number;
    subClassesCount: number;
    subClassesVerification: string;
    flags: string[];
  };
  canonicalReview: {
    // The live gate artifact now builds canonical review from the current
    // structured-vs-canonical audit. Older retrieval-only states such as
    // detail-fetch failures are no longer emitted here.
    state: "clean" | "mismatch" | "not_reviewed";
    generatedAt?: string;
    listingUrl?: string;
    mismatchCount: number;
    mismatchFields: string[];
    mismatchSummaries: string[];
  };
  structuredJsonReview: {
    state: "clean" | "mismatch" | "not_reviewed";
    generatedAt?: string;
    mismatchCount: number;
    mismatchFields: string[];
    mismatchSummaries: string[];
  };
}

export interface SpellGateArtifact {
  generatedAt: string;
  spellCount: number;
  spells: Record<string, SpellGateArtifactEntry>;
}

// ============================================================================
// Structured-vs-source and structured-vs-runtime report rows
// ============================================================================
// These are the richer mismatch rows that power the bucket-specific review
// sections in the spell gate checker. The hook turns these into human-readable
// review panels after the bootstrap loader or selected-spell refresh fetches them.
// ============================================================================

export interface StructuredCanonicalMismatchRecord {
  spellId: string;
  field: string;
  mismatchKind?: string;
  structuredValue: string;
  canonicalValue: string;
  summary: string;
}

export interface StructuredCanonicalReportFile {
  mismatches?: StructuredCanonicalMismatchRecord[];
}

export interface StructuredJsonMismatchRecord {
  spellId: string;
  field: string;
  mismatchKind?: string;
  structuredValue: string;
  jsonValue: string;
  summary: string;
}

export interface StructuredJsonReportFile {
  mismatches?: StructuredJsonMismatchRecord[];
}

// ============================================================================
// Gate result shapes
// ============================================================================
// These shapes are the public result surface for the glossary spell gate checker.
// Display components read these objects, while useSpellGateChecks.ts and
// spellGateBucketDetails.ts create them from live JSON and generated reports.
// ============================================================================

export type GateStatus = "pass" | "gap" | "fail";

export interface GateChecklist {
  manifestPathOk: boolean;
  spellJsonExists: boolean;
  spellJsonValid: boolean;
  noKnownGaps: boolean; // Reversed logic: true means "Clean"
  classAccessVerified?: boolean;
  canonicalTopLevelAligned?: boolean;
  structuredJsonAligned?: boolean;
}

export interface GateResult {
  status: GateStatus;
  reasons: string[];
  issueSummaries: string[];
  level?: number;
  checklist: GateChecklist;
  schemaIssues?: string[];
  spellTruth?: {
    localFlags: string[];
    canonicalReviewState?: string;
    canonicalMismatchFields: string[];
    canonicalMismatchSummaries: string[];
    listingUrl?: string;
    structuredJsonReviewState?: string;
    structuredJsonMismatchFields: string[];
    structuredJsonMismatchSummaries: string[];
    structuredJsonGeneratedAt?: string;
    generatedAt?: string;
  };
  bucketDetails?: {
    rangeArea?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      problemStatement: string;
      classification: "self_radius_in_range" | "display_model_boundary" | "range_only_boundary" | "true_range_area_drift";
      interpretation: string;
      reviewVerdict: string;
      structuredBreakdown?: {
        rangeType: string;
        rangeDistance?: number;
        targetingType: string;
        areaShape?: string;
        areaSize?: number;
        followsCaster?: boolean;
      };
    };
    rangeAreaRuntime?: {
      structuredValue: string;
      currentJsonValue: string;
      summary: string;
      problemStatement: string;
      classification: "aligned" | "missing_runtime_range_area" | "missing_structured_range_area" | "range_used_as_area_radius" | "model_display_boundary" | "true_runtime_drift";
      reviewVerdict: string;
      structuredMatchesJson: boolean;
      explanation: string;
      structuredBreakdown?: {
        rangeType?: string;
        rangeDistance?: number;
        rangeDistanceUnit?: "feet" | "miles" | "inches";
        areaShape?: string;
        areaSize?: number;
        areaSizeUnit?: "feet" | "miles" | "inches";
      };
      currentJsonBreakdown?: {
        rangeType: string;
        rangeDistance?: number;
        rangeDistanceUnit?: "feet" | "miles" | "inches";
        targetingType: string;
        areaShape?: string;
        areaSize?: number;
        areaSizeUnit?: "feet" | "miles" | "inches";
        followsCaster?: boolean;
      };
    };
    materialComponent?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      problemStatement: string;
      classification: "footnote_marker_residue" | "missing_canonical_comparable_field" | "missing_structured_material" | "consumed_state_drift" | "alternate_source_shape" | "true_material_component_drift";
      interpretation: string;
      currentJsonValue?: string;
      materialRequired?: boolean;
      materialDescription?: string;
      materialCostGp?: number;
      consumed?: boolean;
      canonicalComparableField: boolean;
      canonicalConsumed?: boolean;
      canonicalCostGp?: number;
      normalizedStructuredNote?: string;
      normalizedCanonicalNote?: string;
      descriptionAligned?: boolean;
      costAligned?: boolean;
      consumedAligned?: boolean;
    };
    materialComponentRuntime?: {
      structuredValue: string;
      currentJsonValue: string;
      summary: string;
      problemStatement: string;
      classification: "aligned" | "missing_runtime_material_component" | "missing_structured_material_component" | "consumed_state_runtime_drift" | "cost_runtime_drift" | "model_display_boundary" | "real_runtime_drift";
      reviewVerdict: string;
      explanation: string;
      structuredMatchesJson: boolean;
      structuredMaterialRequired?: boolean;
      jsonMaterialRequired?: boolean;
      structuredDescription?: string;
      jsonDescription?: string;
      structuredCostGp?: number;
      jsonCostGp?: number;
      structuredConsumed?: boolean;
      jsonConsumed?: boolean;
      descriptionAligned?: boolean;
      costAligned?: boolean;
      consumedAligned?: boolean;
    };
    components?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      classification: "footnote_marker_residue" | "alternate_source_shape" | "true_components_drift";
      interpretation: string;
      reviewVerdict: string;
      structuredLetters: string;
      canonicalLetters: string;
      lettersMatch: boolean;
      currentJsonValue?: string;
      materialRequired?: boolean;
      materialDescription?: string;
    };
    componentsRuntime?: {
      structuredValue: string;
      currentJsonValue: string;
      summary: string;
      problemStatement: string;
      classification: "aligned" | "missing_runtime_components" | "missing_structured_components" | "model_display_boundary" | "real_runtime_drift";
      reviewVerdict: string;
      explanation: string;
      structuredMatchesJson: boolean;
      structuredLetters: string;
      jsonLetters: string;
      lettersMatch: boolean;
      materialRequired?: boolean;
      materialDescription?: string;
    };
    duration?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      problemStatement: string;
      classification: "flattened_concentration_display" | "duration_unit_pluralization" | "until_dispelled_boundary" | "until_dispelled_or_triggered_boundary" | "special_duration_boundary" | "alternate_source_shape" | "true_duration_drift";
      severity: "low" | "medium" | "high";
      semanticStatus: "equivalent" | "boundary" | "mismatch";
      interpretation: string;
      recommendedAction: string;
      canonicalBreakdown?: {
        concentration: boolean;
        durationText: string;
      };
      structuredBreakdown?: {
        type: string;
        value?: number;
        unit?: string;
        concentration: boolean;
      };
    };
    durationRuntime?: {
      structuredValue: string;
      currentJsonValue: string;
      summary: string;
      problemStatement: string;
      classification: "aligned" | "missing_runtime_duration" | "missing_structured_duration" | "flattened_concentration_runtime_residue" | "duration_wording_runtime_residue" | "special_bucket_normalization" | "until_dispelled_boundary" | "until_dispelled_or_triggered_boundary" | "true_runtime_duration_drift";
      reviewVerdict: string;
      explanation: string;
      structuredMatchesJson: boolean;
      structuredBreakdown?: {
        type?: string;
        value?: number;
        unit?: string;
        concentration?: boolean;
      };
      currentJsonBreakdown?: {
        type: string;
        value?: number;
        unit?: string;
        concentration: boolean;
      };
    };
    castingTime?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      problemStatement: string;
      classification: "ritual_inline_display" | "trigger_footnote_display" | "canonical_suffix_display" | "true_casting_time_drift";
      interpretation: string;
      reviewVerdict: string;
      baseCastingTime?: string;
      ritual?: boolean;
      ritualCastingTime?: string;
      structuredContainsBaseTiming?: boolean;
      canonicalContainsBaseTiming?: boolean;
      structuredVsJson?: {
        structuredValue: string;
        currentJsonBaseCastingTime?: string;
        currentJsonRitual?: boolean;
        currentJsonRitualCastingTime?: string;
        problemStatement: string;
        classification: "aligned" | "model_display_boundary" | "real_implementation_drift";
        reviewVerdict: string;
        structuredMatchesJson: boolean;
      };
    };
    description?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      classification: "audit_shape_residue" | "real_prose_drift" | "formatting_residue" | "missing_structured_description";
      interpretation: string;
    };
    descriptionRuntime?: {
      structuredValue: string;
      currentJsonValue: string;
      summary: string;
      problemStatement: string;
      classification: "blocked_missing_structured_description" | "missing_runtime_description" | "formatting_runtime_residue" | "real_runtime_drift";
      reviewVerdict: string;
      explanation: string;
    };
    classes?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      problemStatement: string;
      classification: "source_shape_residue" | "legacy_available_for_surface" | "true_class_drift";
      interpretation: string;
      reviewVerdict: string;
      currentClasses: string[];
      canonicalBaseClasses: string[];
      canonicalOnlyEntries: string[];
      structuredOnlyEntries: string[];
      structuredMatchesJson: boolean;
      canonicalUsesAvailableFor: boolean;
    };
    higherLevels?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      classification: "audit_shape_residue" | "canonical_prefix_only" | "canonical_statblock_tail" | "true_higher_levels_drift";
      subbucket: "canonical_inline_only" | "prefix_only_residue" | "statblock_tail_residue" | "true_canonical_drift";
      interpretation: string;
      currentJsonValue?: string;
      structuredMatchesJson: boolean;
      normalizedValuesMatch: boolean;
      severityLabel: "Informational" | "Review Needed";
      reviewerConclusion: string;
      nextStep: string;
    };
    higherLevelsRuntime?: {
      structuredValue: string;
      currentJsonValue: string;
      summary: string;
      problemStatement: string;
      classification: "aligned" | "missing_runtime_higher_levels" | "missing_structured_higher_levels" | "formatting_runtime_residue" | "real_runtime_drift";
      subbucket: "structured_missing_json_present" | "runtime_missing_structured_present" | "prefix_only_residue" | "punctuation_or_formatting_residue" | "true_runtime_drift";
      reviewVerdict: string;
      explanation: string;
      structuredMatchesJson: boolean;
    };
    subClasses?: {
      structuredValue: string;
      canonicalValue: string;
      summary: string;
      classification: "repeated_base_normalization" | "markdown_malformed_value" | "real_subclass_drift";
      interpretation: string;
      currentClasses: string[];
      currentSubClasses: string[];
      verificationState?: string;
      repeatedBaseEntries: string[];
      canonicalOnlyEntries: string[];
      structuredOnlyEntries: string[];
      malformedEntries: string[];
    };
    subClassesRuntime?: {
      structuredValue: string;
      currentJsonValue: string;
      summary: string;
      problemStatement: string;
      classification: "aligned" | "missing_runtime_subclasses" | "missing_structured_subclasses" | "json_unverified_after_transfer" | "repeated_base_normalization" | "malformed_structured_value" | "true_runtime_drift";
      reviewVerdict: string;
      explanation: string;
      structuredMatchesJson: boolean;
      currentBaseClasses: string[];
      currentJsonSubClasses: string[];
      verificationState?: string;
      structuredOnlyEntries: string[];
      jsonOnlyEntries: string[];
      redundantJsonEntries: string[];
      malformedStructuredEntries: string[];
    };
  };
  gapAnalysis?: {
    state: string;
    gaps: string[];
    notes: string;
    lastAuditDate?: string;
  };
}

// ============================================================================
// Dev-server selected-spell refresh payload
// ============================================================================
// This is the narrower response used when the glossary re-checks only the spell
// the reviewer is currently looking at instead of re-walking the whole corpus.
// ============================================================================

export interface LiveSpellGateRefreshResponse {
  ok: boolean;
  spellId: string;
  gateEntry?: SpellGateArtifactEntry;
  structuredMismatches?: StructuredCanonicalMismatchRecord[];
  structuredJsonMismatches?: StructuredJsonMismatchRecord[];
  generatedAt?: string;
  error?: string;
  message?: string;
}
