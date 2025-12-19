import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithTimeout } from "../utils/networkUtils";
import { logger } from "../utils/logger";
import { assetUrl } from "../config/env";
import { SpellValidator } from "../systems/spells/validation/spellValidator";

// TODO: Raw markdown imports will hard-fail if the gaps doc is missing or the bundler doesn't support ?raw; allow a fallback injection to keep gate checks/test harness running.
import level1GapsMd from "../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw";
import cantripGapsMd from "../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw";

const normalizeId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type GateStatus = "pass" | "gap" | "fail";

export interface GateChecklist {
  manifestPathOk: boolean;
  spellJsonExists: boolean;
  spellJsonValid: boolean;
  noKnownGaps: boolean; // Reversed logic: true means "Clean"
}

export interface GateResult {
  status: GateStatus;
  reasons: string[];
  level?: number;
  checklist: GateChecklist;
  gapAnalysis?: {
    state: string;
    gaps: string[];
    notes: string;
  };
}

type SpellManifestEntry = {
  name: string;
  level: number;
  school: string;
  path: string;
};

const extractIdsFromMarkdown = (md: string): Set<string> => {
  const ids = new Set<string>();

  // Bolded spell names: **Spell Name**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  // Inline code identifiers: `spell-id`
  const codeRegex = /`([^`]+?)`/g;
  while ((match = codeRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  return ids;
};

const buildKnownGapSet = (): Set<string> => {
  const set = new Set<string>();
  extractIdsFromMarkdown(level1GapsMd).forEach((id) => set.add(id));
  extractIdsFromMarkdown(cantripGapsMd).forEach((id) => set.add(id));
  return set;
};

export const useSpellGateChecks = () => {
  const [results, setResults] = useState<Record<string, GateResult>>({});
  const [recheckTrigger, setRecheckTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const knownGaps = useMemo(buildKnownGapSet, []);

  const recheck = useCallback(() => {
    setRecheckTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    setIsLoading(true);

    const run = async () => {
      try {
        const manifest = await fetchWithTimeout<Record<string, SpellManifestEntry>>(
          assetUrl("data/spells_manifest.json"),
        );

        const next: Record<string, GateResult> = {};

        await Promise.all(
          Object.entries(manifest).map(async ([id, entry]) => {
            const level = entry.level;
            if (typeof level !== "number") return;

            const checklist: GateChecklist = {
              manifestPathOk: false,
              spellJsonExists: false,
              spellJsonValid: false,
              noKnownGaps: !knownGaps.has(id), // Default to true if not in old markdown list
            };
            const reasons: string[] = [];
            let status: GateStatus = "pass";
            let gapAnalysisData = undefined;

            if (entry.path && entry.path.includes(`/level-${level}/`)) {
              checklist.manifestPathOk = true;
            } else {
              status = "fail";
              reasons.push("Manifest path not in expected level folder");
            }

            try {
              const spell = await fetchWithTimeout<any>(assetUrl(entry.path), { timeoutMs: 15000 });
              checklist.spellJsonExists = true;

              const parsed = SpellValidator.safeParse(spell);
              if (parsed.success) {
                checklist.spellJsonValid = true;

                // Prioritize GapAnalysis from JSON if it exists and is audited
                if (spell.gapAnalysis) {
                  gapAnalysisData = spell.gapAnalysis;
                  if (spell.gapAnalysis.state === "analyzed_with_gaps") {
                    checklist.noKnownGaps = false;
                    reasons.push(`Gaps: ${spell.gapAnalysis.gaps.join(', ')}`);
                  } else if (spell.gapAnalysis.state === "analyzed_clean") {
                    checklist.noKnownGaps = true;
                  } else if (spell.gapAnalysis.state === "not_started" && knownGaps.has(id)) {
                    // Fallback to markdown if JSON analysis not yet started
                    checklist.noKnownGaps = false;
                    reasons.push("Marked as gap in legacy docs");
                  }
                }

                if (spell?.legacy === true) {
                  checklist.noKnownGaps = false;
                  reasons.push("Marked as legacy spell");
                }
              } else {
                checklist.spellJsonValid = false;
                status = "fail";
                reasons.push("Spell JSON failed schema validation");
              }
            } catch {
              checklist.spellJsonExists = false;
              checklist.spellJsonValid = false;
              status = "fail";
              reasons.push("Spell JSON not found");
            }

            // Final status calculation
            if (!checklist.noKnownGaps && status === "pass") {
              status = "gap";
            }

            next[id] = { status, reasons, level, checklist, gapAnalysis: gapAnalysisData };
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
  }, [knownGaps, recheckTrigger]);

  return { results, recheck, isLoading };
};

