// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/04/2026, 00:27:00
 * Dependents: components/Glossary/Glossary.tsx, components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx, components/Glossary/spellGateChecker/buildGateLabel.ts, components/Glossary/spellGateChecker/index.ts, components/Glossary/spellGateChecker/spellGateIssueSummary.ts, hooks/useSpellGateChecks.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "../../../utils/networkUtils";
import { logger } from "../../../utils/logger";
import { assetUrl } from "../../../config/env";
import { SpellValidator } from "../../../systems/spells/validation/spellValidator";
import { fetchSpellGateBootstrap } from "./spellGateBootstrap";
import { refreshSelectedSpellGate } from "./spellGateSelectedRefresh";
import {
  buildGateResultForSpell,
  configureStructuredReportIndexes,
} from "./spellGateBucketDetails";
import type {
  FidelityData,
  GateResult,
} from "./spellGateDataTypes";

export type { GateChecklist, GateResult, GateStatus, SpellGateArtifactEntry } from "./spellGateDataTypes";

/**
 * This hook powers the developer-only spell gate checker inside the glossary.
 *
 * It exists so a spell can be reviewed in one place against three layers at once:
 * the live runtime JSON, the generated spell-truth reports, and the accepted
 * residue buckets from the structured-vs-canonical audit. Glossary.tsx now
 * reaches this hook through the dedicated spellGateChecker folder and
 * GlossaryEntryPanel.tsx renders the results.
 *
 * Called by: Glossary.tsx
 * Depends on: spell JSON files, generated audit artifacts, SpellValidator, and the bucket-detail builder
 */


export const useSpellGateChecks = (
  selectedSpellId?: string | null,
  enableSelectedSpellLiveRefresh = false,
  enabled = true,
) => {
  const [results, setResults] = useState<Record<string, GateResult>>({});
  const [recheckTrigger, setRecheckTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [fidelitySnapshot, setFidelitySnapshot] = useState<FidelityData | null>(null);
  const [knownGaps, setKnownGaps] = useState<Set<string>>(new Set());

  const recheck = useCallback(() => {
    setRecheckTrigger((prev) => prev + 1);
  }, []);

  // Keep the gate-check state empty when the glossary spell-check toggle is off.
  // This prevents the dev-only corpus walk from running just because the glossary
  // itself is open.
  useEffect(() => {
    if (enabled) {
      return;
    }

    setResults({});
    setIsLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);

    const run = async () => {
      try {
        const {
          manifest,
          fidelity,
          gateArtifact,
          knownGaps: nextKnownGaps,
          structuredCanonicalReport,
          structuredJsonReport,
        } = await fetchSpellGateBootstrap();
        setFidelitySnapshot(fidelity);
        setKnownGaps(nextKnownGaps);
        configureStructuredReportIndexes(structuredCanonicalReport, structuredJsonReport);

        const next: Record<string, GateResult> = {};

        await Promise.all(
          Object.entries(manifest).map(async ([id, entry]) => {
            const level = entry.level;
            if (typeof level !== "number") return;

            let schemaIssues: string[] = [];
            let fetchedSpell: unknown = null;
            let isLegacySpell = false;

            const spellFidelity = fidelity?.spells[id];
            const artifactEntry = gateArtifact?.spells?.[id];

            try {
              // TODO(lint-intent): The any on this value hides the intended shape of this data.
              // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
              // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
              const spell = await fetchWithTimeout<unknown>(assetUrl(entry.path), { timeoutMs: 15000 });
              fetchedSpell = spell;

              const parsed = SpellValidator.safeParse(spell);
              if (parsed.success) {
                // DEBT: Cast to any to probe optional legacy property on generic Spell type.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                isLegacySpell = (spell as any)?.legacy === true;
              } else {
                schemaIssues = parsed.error.issues.map((issue) => {
                  const pathLabel = issue.path.length > 0 ? issue.path.join('.') : '(root)';
                  return `${pathLabel}: ${issue.message}`;
                });
              }
            } catch {
              next[id] = {
                status: "fail",
                reasons: ["Spell JSON not found"],
                issueSummaries: ["Spell JSON could not be fetched for this glossary entry."],
                level,
                checklist: {
                  manifestPathOk: entry.path ? entry.path.includes(`/level-${level}/`) : false,
                  spellJsonExists: false,
                  spellJsonValid: false,
                  noKnownGaps: !nextKnownGaps.has(id),
                },
                schemaIssues: [],
                gapAnalysis: spellFidelity,
              };
              return;
            }

            next[id] = {
              ...buildGateResultForSpell({
                spellId: id,
                level,
                jsonPath: entry.path,
                knownGaps: nextKnownGaps,
                spellFidelity,
                artifactEntry,
                fetchedSpell,
                schemaIssues,
                isLegacySpell,
              }),
            };
          }),
        );

        setResults(next);
        setIsLoading(false);
      } catch (err) {
        logger.error("Spell gate check failed", { error: err });
        setResults({});
        setIsLoading(false);
      }
    };

    run();
  }, [enabled, recheckTrigger]);

  // ============================================================================
  // Selected-spell live refresh
  // ============================================================================
  // The full gate checker still loads the broad artifact set on startup because
  // that gives the glossary an immediate overview. This effect exists to answer
  // a narrower question: "what is the status of the spell I am looking at right
  // now?" In dev mode, the glossary asks the local server to recompute only that
  // spell's gate data and then overlays the fresh answer onto the selected entry.
  // ============================================================================
  useEffect(() => {
    if (!enabled || !enableSelectedSpellLiveRefresh || !selectedSpellId) {
      return;
    }

    let cancelled = false;

    const runSelectedSpellRefresh = async () => {
      try {
        setIsLoading(true);
        const {
          response,
          assetPath,
          fetchedSpell,
          schemaIssues,
          isLegacySpell,
        } = await refreshSelectedSpellGate(selectedSpellId);

        const nextResult = buildGateResultForSpell({
          spellId: selectedSpellId,
          level: response.gateEntry!.level,
          jsonPath: assetPath,
          knownGaps,
          spellFidelity: fidelitySnapshot?.spells?.[selectedSpellId],
          artifactEntry: response.gateEntry!,
          fetchedSpell,
          schemaIssues,
          overrideRows: response.structuredMismatches,
          overrideJsonRows: response.structuredJsonMismatches,
          isLegacySpell,
        });

        if (cancelled) {
          return;
        }

        setResults((current) => ({
          ...current,
          [selectedSpellId]: nextResult,
        }));
      } catch (error) {
        if (!cancelled) {
          logger.error("Selected spell gate refresh failed", { spellId: selectedSpellId, error });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    runSelectedSpellRefresh();

    return () => {
      cancelled = true;
    };
  }, [enabled, enableSelectedSpellLiveRefresh, fidelitySnapshot, knownGaps, selectedSpellId, recheckTrigger]);

  return { results, recheck, isLoading };
};
