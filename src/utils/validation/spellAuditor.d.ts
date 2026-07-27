/**
 * @file spellAuditor.ts
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added '@ts-ignore' to imports to
 * suppress script-specific resolution warnings. Added explicit 'any'
 * types to 'effect' parameters in 'some' and 'forEach' callbacks to
 * resolve implicit any warnings.
 */
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:46
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
