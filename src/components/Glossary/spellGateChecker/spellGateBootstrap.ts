// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:48
 * Dependents: components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file loads the heavyweight spell gate bootstrap data on demand.
 *
 * The glossary shell should not front-load large dev-only spell review artifacts
 * unless the reviewer actually turns spell checks on. This helper keeps the
 * fetches and dynamic imports in one place so the main hook can stay focused on
 * turning those raw inputs into gate results instead of owning every network step.
 *
 * Called by: useSpellGateChecks.ts
 * Depends on: assetUrl, fetchWithTimeout, and the shared spell gate data types
 */

import { assetUrl } from "../../../config/env";
import { fetchWithTimeout } from "../../../utils/networkUtils";
import type {
  FidelityData,
  SpellGateArtifact,
  SpellManifestEntry,
  StructuredCanonicalReportFile,
  StructuredJsonReportFile,
} from "./spellGateDataTypes";

// ============================================================================
// Optional local report paths
// ============================================================================
// These structured comparison reports are generated into .agent/roadmap-local.
// That folder is intentionally ignored by Git, so GitHub Pages builds will not
// have these files even though a local reviewer may have them on disk.
// ============================================================================

const STRUCTURED_CANONICAL_REPORT_PATH =
  "../../../../.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json";
const STRUCTURED_JSON_REPORT_PATH =
  "../../../../.agent/roadmap-local/spell-validation/spell-structured-vs-json-report.json";

const EMPTY_STRUCTURED_CANONICAL_REPORT: StructuredCanonicalReportFile = {
  mismatches: [],
};

const EMPTY_STRUCTURED_JSON_REPORT: StructuredJsonReportFile = {
  mismatches: [],
};

// ============================================================================
// Known-gap extraction helpers
// ============================================================================
// Older gap tracking still lives in markdown documents. The gate checker keeps
// reading those docs for now, but it now does so lazily instead of forcing the
// main glossary bundle to parse them on every open.
// ============================================================================

const normalizeId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function extractIdsFromMarkdown(md: string): Set<string> {
  const ids = new Set<string>();

  // Bolded spell names are the older human-facing gap list format.
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  // Inline code identifiers are also used in some of the migration notes.
  const codeRegex = /`([^`]+?)`/g;
  while ((match = codeRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  return ids;
}

// ============================================================================
// Optional local artifact loading
// ============================================================================
// Vite resolves literal dynamic imports during production builds. The local
// .agent reports are ignored files, so we hide these two imports from bundling
// and fall back to empty reports when the files are unavailable.
// ============================================================================

async function loadOptionalJsonModule<T>(modulePath: string, fallback: T): Promise<T> {
  try {
    // The vite-ignore marker is intentional: these files are local review output,
    // not production assets. CI should build without them, while local reviewers
    // can still load them when they exist next to the repo.
    const module = await import(/* @vite-ignore */ modulePath);
    return module.default as T;
  } catch {
    // Missing local reports should only remove bucket-specific review detail.
    // The glossary gate checker still has manifest, fidelity, schema, and public
    // gate-report data, so failing open preserves the usable review surface.
    return fallback;
  }
}

// ============================================================================
// Dynamic artifact loading
// ============================================================================
// These dynamic imports are cached at the module level so turning the spell gate
// checker on multiple times in one session does not keep re-importing the same
// large report files.
// ============================================================================

let spellGateArtifactsPromise: Promise<{
  knownGaps: Set<string>;
  structuredCanonicalReport: StructuredCanonicalReportFile;
  structuredJsonReport: StructuredJsonReportFile;
}> | null = null;

async function loadSpellGateArtifacts() {
  if (!spellGateArtifactsPromise) {
    spellGateArtifactsPromise = Promise.all([
      loadOptionalJsonModule<StructuredCanonicalReportFile>(
        STRUCTURED_CANONICAL_REPORT_PATH,
        EMPTY_STRUCTURED_CANONICAL_REPORT,
      ),
      loadOptionalJsonModule<StructuredJsonReportFile>(
        STRUCTURED_JSON_REPORT_PATH,
        EMPTY_STRUCTURED_JSON_REPORT,
      ),
      import("../../../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw"),
      import("../../../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw"),
    ]).then(([structuredCanonicalReport, structuredJsonReport, level1Module, cantripModule]) => {
      const knownGaps = new Set<string>();
      extractIdsFromMarkdown(level1Module.default).forEach((id) => knownGaps.add(id));
      extractIdsFromMarkdown(cantripModule.default).forEach((id) => knownGaps.add(id));

      return {
        knownGaps,
        structuredCanonicalReport,
        structuredJsonReport,
      };
    });
  }

  return spellGateArtifactsPromise;
}

// ============================================================================
// Bootstrap fetch orchestration
// ============================================================================
// The hook only needs one "get me everything I need to evaluate the corpus"
// entrypoint. This function keeps that surface explicit.
// ============================================================================

export async function fetchSpellGateBootstrap() {
  const [manifest, fidelity, spellGateArtifacts] = await Promise.all([
    fetchWithTimeout<Record<string, SpellManifestEntry>>(assetUrl("data/spells_manifest.json")),
    fetchWithTimeout<FidelityData>(assetUrl("data/spells_fidelity.json")),
    loadSpellGateArtifacts(),
  ]);

  let gateArtifact: SpellGateArtifact | null = null;

  // DEBT: The generated public artifact is optional because the glossary must
  // still function if the report has not been refreshed yet. We intentionally
  // fail open here instead of turning the whole gate checker into a hard error.
  try {
    gateArtifact = await fetchWithTimeout<SpellGateArtifact>(assetUrl("data/spell_gate_report.json"));
  } catch {
    gateArtifact = null;
  }

  return {
    manifest,
    fidelity,
    gateArtifact,
    knownGaps: spellGateArtifacts.knownGaps,
    structuredCanonicalReport: spellGateArtifacts.structuredCanonicalReport,
    structuredJsonReport: spellGateArtifacts.structuredJsonReport,
  };
}
