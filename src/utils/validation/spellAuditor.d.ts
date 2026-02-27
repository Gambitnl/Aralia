// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:34:44
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/01/2026, 01:40:14
 * Dependents: validation/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export interface AuditResult {
    spellId: string;
    spellName: string;
    issues: AuditIssue[];
}
export interface AuditIssue {
    type: 'phantom_scaling' | 'invalid_schema' | 'complex_scaling';
    severity: 'error' | 'warning' | 'info';
    message: string;
}
/**
 * Audits a single spell for implementation gaps.
 * Specifically checks for "Phantom Scaling" (text promises scaling, data delivers nothing)
 * and missing audiovisual assets.
 */
export declare function auditSpell(spellData: unknown): AuditResult;
