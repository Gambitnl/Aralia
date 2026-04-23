// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: manual addition; the dependency sync tool skips scripts.
 * Dependents: scripts/auditSpellStructuredAgainstJson.ts, scripts/generateSpellGateReport.ts, src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, src/components/Glossary/spellGateChecker/spellGateDataTypes.ts, src/components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellValidator } from "../src/systems/spells/validation/spellValidator";
import { ConditionType } from "../src/types/conditions";
import { isStatusConditionEffect } from "../src/types/spells";

/**
 * Shared helpers for comparing spell condition rows against runtime spell JSON.
 *
 * Why this exists:
 * the spell gate checker needs one consistent way to read the structured
 * `Conditions Applied` line and one consistent way to read the live runtime
 * status-condition effects. Keeping that logic here avoids making the audit
 * script, the gate report generator, and the glossary panel each invent their
 * own slightly different condition parsing rules.
 */

// ============================================================================
// Standard condition vocabulary
// ============================================================================
// The runtime spell data can express both standard D&D condition names and a
// few custom labels. Keeping the standard list here lets every caller make the
// same aligned-vs-custom distinction instead of re-implementing it separately.
// ============================================================================

const STANDARD_CONDITION_NAMES = new Set<string>(Object.values(ConditionType));

export interface RuntimeConditionSummary {
  value: string;
  conditions: string[];
  standardConditions: string[];
  customConditions: string[];
}

// This normalizer keeps punctuation and spacing differences from hiding the
// real condition names the spell is using.
export function normalizeConditionText(value: string): string {
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

// "None" in the structured row should behave like an empty value so the gate
// checker can tell the difference between "no condition" and "missing row."
export function normalizeConditionComparisonValue(value: string): string {
  const normalized = normalizeConditionText(value);
  if (!normalized || normalized.toLowerCase() === "none") {
    return "";
  }

  return normalized;
}

// This reader pulls the structured markdown line into the exact plain text the
// gate checker needs to compare against runtime spell JSON.
export function readStructuredConditionsApplied(markdown: string): string {
  const match = markdown.match(/^- \*\*Conditions Applied\*\*:\s*(.*)$/m);
  return match ? (match[1] ?? "").trim() : "";
}

// This formatter reads the runtime spell JSON and returns the condition names
// in a form the glossary can compare, display, and classify without guessing at
// the spell's actual status-condition mechanics.
export function formatRuntimeConditionsApplied(spell: unknown): RuntimeConditionSummary {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) {
    return {
      value: "",
      conditions: [],
      standardConditions: [],
      customConditions: [],
    };
  }

  const conditions = parsed.data.effects
    .filter(isStatusConditionEffect)
    .map((effect) => effect.statusCondition.name.trim())
    .filter((name) => name.length > 0);

  const standardConditions = conditions.filter((name) => STANDARD_CONDITION_NAMES.has(name));
  const customConditions = conditions.filter((name) => !STANDARD_CONDITION_NAMES.has(name));

  return {
    value: conditions.length > 0 ? conditions.join(", ") : "",
    conditions,
    standardConditions,
    customConditions,
  };
}
