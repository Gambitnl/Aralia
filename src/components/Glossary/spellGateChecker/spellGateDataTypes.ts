// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/04/2026, 20:32:03
 * Dependents: components/Glossary/spellGateChecker/spellGateBootstrap.ts, components/Glossary/spellGateChecker/spellGateSelectedRefresh.ts
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
