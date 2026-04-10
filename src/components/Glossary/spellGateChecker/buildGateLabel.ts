// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:09
 * Dependents: components/Glossary/spellGateChecker/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GateResult } from './useSpellGateChecks';
import { buildSpecificIssueList } from './spellGateIssueSummary';

/**
 * This helper turns rich spell gate issues into the short sidebar tooltip text.
 *
 * It exists because the sidebar only has room for a quick "what is wrong?"
 * answer, while the full spell gate panel renders the longer diagnostic prose.
 * GlossarySidebar.tsx calls this helper so the wording stays aligned with the
 * same issue summaries the detailed spell gate panel uses.
 *
 * Called by: GlossarySidebar.tsx
 * Depends on: the GateResult shape produced by useSpellGateChecks
 */

// ============================================================================
// Sidebar gate label builder
// ============================================================================
// The sidebar should surface the primary problem without dumping the entire
// bucket report into a tooltip. This helper keeps that summary logic in the
// spell gate checker module instead of duplicating it in navigation code.
// ============================================================================

export function buildGateLabel(gate: GateResult | undefined, isDevModeEnabled: boolean): string | undefined {
    if (!isDevModeEnabled || !gate) return undefined;

    // Reuse the same summary ordering as the full spell gate panel so the
    // sidebar tooltip and the developer detail surface do not drift apart.
    const issues = buildSpecificIssueList(gate);

    if (issues.length === 0) return undefined;

    const [primaryIssue, ...otherIssues] = issues;
    if (otherIssues.length === 0) {
        return `What is wrong: ${primaryIssue}`;
    }

    return [
        `What is wrong: ${primaryIssue}`,
        ...otherIssues.slice(0, 3).map((issue) => `Also: ${issue}`),
    ].join('\n');
}
