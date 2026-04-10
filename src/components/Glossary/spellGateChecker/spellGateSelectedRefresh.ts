// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:48
 * Dependents: components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file performs the dev-only selected-spell gate refresh workflow.
 *
 * The full spell gate checker walks the entire manifest so the glossary can
 * display broad status signals, but reviewers also need a faster "refresh only
 * the spell I am looking at" path. This helper isolates that narrower request
 * and the follow-up schema validation so the hook does not own every network step.
 *
 * Called by: useSpellGateChecks.ts
 * Depends on: fetchWithTimeout, assetUrl, SpellValidator, and shared payload types
 */

import { assetUrl } from "../../../config/env";
import { SpellValidator } from "../../../systems/spells/validation/spellValidator";
import { fetchWithTimeout } from "../../../utils/networkUtils";
import type { LiveSpellGateRefreshResponse } from "./spellGateDataTypes";

// ============================================================================
// Selected-spell refresh
// ============================================================================
// This asks the local dev server to rebuild just one spell's gate entry, then
// re-validates the returned spell JSON client-side so the glossary panel still
// speaks with the same schema language as the broader gate checker.
// ============================================================================

export async function refreshSelectedSpellGate(spellId: string) {
  const response = await fetchWithTimeout<LiveSpellGateRefreshResponse>("/api/glossary/recheck-spell-gate", {
    method: "POST",
    timeoutMs: 30000,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ spellId }),
  });

  if (!response.ok || !response.gateEntry) {
    throw new Error(response.message || response.error || `Selected spell refresh failed for ${spellId}.`);
  }

  const assetPath = response.gateEntry.jsonPath.replace(/^public\//, "");
  const fetchedSpell = await fetchWithTimeout<unknown>(assetUrl(assetPath), { timeoutMs: 15000 });
  const parsed = SpellValidator.safeParse(fetchedSpell);
  const schemaIssues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => {
        const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `${pathLabel}: ${issue.message}`;
      });

  return {
    response,
    assetPath,
    fetchedSpell,
    schemaIssues,
    // DEBT: This still probes the legacy bit straight off the live spell JSON
    // because the client already fetched that payload. If the refresh endpoint
    // later becomes the sole source of truth, promote this onto the endpoint.
    isLegacySpell: typeof fetchedSpell === "object"
      && fetchedSpell !== null
      && (fetchedSpell as { legacy?: unknown }).legacy === true,
  };
}
