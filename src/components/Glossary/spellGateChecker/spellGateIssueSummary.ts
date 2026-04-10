// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:48
 * Dependents: components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx, components/Glossary/spellGateChecker/buildGateLabel.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GateResult } from "./useSpellGateChecks";

/**
 * This file turns rich spell gate results into short human-readable issue lists.
 *
 * The spell gate checker now has several output surfaces: the sidebar tooltip,
 * the gate panel headline, and the detailed review sections. They all need the
 * same "what is wrong with this spell?" summary logic, so it lives here instead
 * of being duplicated in the panel renderer and sidebar label helper.
 *
 * Called by: buildGateLabel.ts, SpellGateChecksPanel.tsx
 * Depends on: GateResult from the spell gate hook
 */

// ============================================================================
// Issue summary normalization
// ============================================================================
// These helpers collapse the richer gate result into a short ordered list that
// always leads with the most concrete problem we can name for the current spell.
// ============================================================================

function uniqueIssues(issues: string[]): string[] {
  return [...new Set(issues.map((issue) => issue.trim()).filter((issue) => issue.length > 0))];
}

export function buildSpecificIssueList(gate: GateResult): string[] {
  if (gate.issueSummaries.length > 0) {
    return uniqueIssues(gate.issueSummaries);
  }

  const issues: string[] = [];

  for (const schemaIssue of gate.schemaIssues ?? []) {
    issues.push(`Schema issue: ${schemaIssue}`);
  }

  for (const flag of gate.spellTruth?.localFlags ?? []) {
    if (flag === "classes-empty") {
      issues.push("The spell JSON has an empty base class list.");
    } else {
      issues.push(`Local data issue: ${flag}`);
    }
  }

  if (gate.bucketDetails?.rangeArea) issues.push(`Range/Area: ${gate.bucketDetails.rangeArea.summary}`);
  if (gate.bucketDetails?.materialComponent) issues.push(`Material Component: ${gate.bucketDetails.materialComponent.summary}`);
  if (gate.bucketDetails?.materialComponentRuntime) issues.push(`Material Component Runtime: ${gate.bucketDetails.materialComponentRuntime.problemStatement}`);
  if (gate.bucketDetails?.components) issues.push(`Components: ${gate.bucketDetails.components.summary}`);
  if (gate.bucketDetails?.castingTime) issues.push(`Casting Time: ${gate.bucketDetails.castingTime.summary}`);
  if (gate.bucketDetails?.duration) issues.push(`Duration: ${gate.bucketDetails.duration.summary}`);
  if (gate.bucketDetails?.description) issues.push(`Description: ${gate.bucketDetails.description.summary}`);
  if (gate.bucketDetails?.classes) issues.push(`Classes: ${gate.bucketDetails.classes.problemStatement}`);
  if (gate.bucketDetails?.higherLevels) issues.push(`Higher Levels: ${gate.bucketDetails.higherLevels.summary}`);
  if (gate.bucketDetails?.subClasses) issues.push(`Sub-Classes: ${gate.bucketDetails.subClasses.summary}`);

  if (gate.gapAnalysis?.state === "analyzed_with_gaps" && gate.gapAnalysis.gaps.length > 0) {
    for (const gap of gate.gapAnalysis.gaps) {
      issues.push(`Engine gap: ${gap}`);
    }
  }

  if (issues.length === 0) {
    for (const reason of gate.reasons) {
      issues.push(reason);
    }
  }

  return uniqueIssues(issues);
}

export function getPrimaryIssue(gate: GateResult): string | null {
  const issues = buildSpecificIssueList(gate);
  return issues.length > 0 ? issues[0] : null;
}
