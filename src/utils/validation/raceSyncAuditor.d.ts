/**
 * @file raceSyncAuditor.ts
 * Audits synchronization between character creator races and glossary entries.
 *
 * This module compares the races defined in src/data/races/ against the glossary
 * entries in public/data/glossary/entries/races/ to identify:
 * - Missing glossary entries (races without corresponding glossary files)
 * - ID mismatches (glossary entries that don't match race IDs)
 * - Image path discrepancies (different image paths between systems)
 *
 * Usage:
 *   import { auditRaceSync } from './raceSyncAuditor';
 *   const result = auditRaceSync();
 *   console.log(result.summary);
 */
/**
 * Types of issues that can be detected during the audit.
 * - missing_glossary: Race exists in character creator but not in glossary
 * - id_mismatch: Glossary entry ID doesn't match expected race ID format
 * - image_path_mismatch: Image paths differ between character creator and glossary
 */
export type RaceSyncIssueType = 'missing_glossary' | 'id_mismatch' | 'image_path_mismatch';
/**
 * Severity levels for audit issues.
 * - error: Critical issue that should block CI
 * - warning: Important issue that should be addressed
 * - info: Informational finding for awareness
 */
export type RaceSyncIssueSeverity = 'error' | 'warning' | 'info';
/**
 * Represents a single issue found during the audit.
 */
export interface RaceSyncIssue {
    /** The type of issue detected */
    type: RaceSyncIssueType;
    /** How severe this issue is */
    severity: RaceSyncIssueSeverity;
    /** The race ID this issue pertains to */
    raceId: string;
    /** Human-readable description of the issue */
    message: string;
    /** Additional context or details (optional) */
    details?: Record<string, unknown>;
}
/**
 * The complete result of a race synchronization audit.
 */
export interface RaceSyncAuditResult {
    /** Total number of races in the character creator */
    totalCharacterCreatorRaces: number;
    /** Total number of glossary entry files found */
    totalGlossaryEntries: number;
    /** List of race IDs that don't have glossary entries */
    missingGlossaryEntries: string[];
    /** All issues found during the audit */
    issues: RaceSyncIssue[];
    /** Human-readable summary of the audit */
    summary: string;
}
/**
 * Performs a complete audit of race data synchronization between
 * the character creator and glossary systems.
 *
 * @returns Audit result with counts, missing entries, issues, and summary
 */
export declare function auditRaceSync(): RaceSyncAuditResult;
/**
 * Prints the audit results to the console in a formatted way.
 * Useful for CLI scripts.
 *
 * @param result - The audit result to print
 */
export declare function printAuditResults(result: RaceSyncAuditResult): void;
