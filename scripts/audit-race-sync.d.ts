#!/usr/bin/env npx tsx
/**
 * @file audit-race-sync.ts
 * CLI script to audit synchronization between character creator races and glossary entries.
 *
 * This script compares races defined in src/data/races/ against glossary entries
 * in public/data/glossary/entries/races/ and generates a detailed report.
 *
 * Usage:
 *   npx tsx scripts/audit-race-sync.ts
 *   npm run audit:races
 *
 * Output:
 *   - Total counts for both systems
 *   - List of missing glossary entries
 *   - Sync coverage percentage
 *   - Grouped by base race for easier review
 */
/**
 * Simplified race info extracted from character creator files.
 */
interface RaceInfo {
    id: string;
    name: string;
    baseRace?: string;
    filename: string;
    /** Value of the `modernizationStatus` field declared in the TS race file, if any. */
    modernizationStatus?: string;
}
/**
 * A parsed glossary race entry, carrying just what the audit needs.
 */
interface GlossaryEntry {
    /** The `id` field from the JSON (as-authored, e.g. hyphenated). */
    id: string;
    /** Whether the JSON declares a `modernizationStatus` field. */
    hasModernizationStatus: boolean;
    /** The declared value, if present. */
    modernizationStatus?: string;
    /** Source file path (for reporting). */
    filePath: string;
}
/**
 * Report of `modernizationStatus` drift between TS races and glossary JSON.
 * Report-only: makes no rulings, changes no data.
 */
interface ModernizationDriftResult {
    /** TS declares modernizationStatus, a matching glossary JSON exists, but that JSON is MISSING the field. */
    tsHasJsonMissing: Array<{
        race: RaceInfo;
        glossaryId: string;
    }>;
    /** TS race declares modernizationStatus but has NO matching glossary JSON at all. */
    tsButNoJson: RaceInfo[];
    /** Both TS and matching JSON declare modernizationStatus (informational count). */
    inSync: number;
}
/**
 * Pure parser: extracts race info (including `modernizationStatus`) from the text
 * of a single TS race file. Exposed as an export seam so the audit is testable
 * against synthetic content without touching the filesystem.
 *
 * A real Race export matches `export const XXX_DATA: Race = {` and contains a
 * `traits:` field (which distinguishes races from subrace/benefit helpers).
 *
 * @param content - Raw TS file contents
 * @param filename - Source filename (recorded on each RaceInfo)
 * @returns Parsed races found in the content (order-preserving; unsorted)
 */
export declare function extractRacesFromContent(content: string, filename: string): RaceInfo[];
/**
 * Builds a lookup map from all normalized id/filename variants to their GlossaryEntry.
 * Pure — safe to call with synthetic entries in tests.
 *
 * Mirrors the historical normalization (hyphen/underscore + filename fallback) so a
 * single race id can resolve to its entry regardless of naming convention.
 *
 * @param entries - Parsed glossary entries
 * @returns Map keyed by every normalized variant → the owning entry
 */
export declare function buildGlossaryEntryMap(entries: GlossaryEntry[]): Map<string, GlossaryEntry>;
/**
 * Resolves a race ID to its matching glossary entry, handling the various naming
 * conventions between character creator and glossary. Pure — operates on a map.
 *
 * @param raceId - The character creator race ID
 * @param entryMap - Map of normalized id variants → GlossaryEntry (see buildGlossaryEntryMap)
 * @returns The matching GlossaryEntry, or undefined if none matches
 */
export declare function resolveGlossaryEntry(raceId: string, entryMap: Map<string, GlossaryEntry>): GlossaryEntry | undefined;
/**
 * Computes modernizationStatus drift between TS races and glossary entries.
 * Report-only: makes NO rulings and changes NO data — it only surfaces where the
 * TS files declare a modernizationStatus that the matching glossary JSON lacks
 * (or has no matching JSON at all), so a human can decide what to do.
 *
 * Pure — testable against synthetic races + entries.
 *
 * @param races - Character creator races (only those declaring modernizationStatus are considered)
 * @param entryMap - Map of normalized id variants → GlossaryEntry
 * @returns Drift buckets and an in-sync count
 */
export declare function computeModernizationDrift(races: RaceInfo[], entryMap: Map<string, GlossaryEntry>): ModernizationDriftResult;
export {};
