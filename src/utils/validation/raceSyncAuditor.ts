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

import { ACTIVE_RACES } from '../../data/races/index';
import type { Race } from '../../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of issues that can be detected during the audit.
 * - missing_glossary: Race exists in character creator but not in glossary
 * - id_mismatch: Glossary entry ID doesn't match expected race ID format
 * - image_path_mismatch: Image paths differ between character creator and glossary
 */
export type RaceSyncIssueType =
  | 'missing_glossary'
  | 'id_mismatch'
  | 'image_path_mismatch';

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

// ============================================================================
// GLOSSARY ENTRY SCANNING
// ============================================================================

/**
 * Scans for glossary entry files using Vite's import.meta.glob.
 * This matches the pattern used in the character creator for race loading.
 * Uses **\/*.json to include subdirectories (e.g., elf_lineages/, dragonborn_ancestries/).
 *
 * @returns A set of glossary entry IDs (derived from JSON id field and filenames)
 */
function getGlossaryEntryIds(): Set<string> {
  // Use import.meta.glob to scan glossary entry files
  // The glob pattern matches all JSON files in the races directory AND subdirectories
  const glossaryModules = import.meta.glob<{ id?: string }>(
    '/public/data/glossary/entries/races/**/*.json',
    { eager: true }
  );

  const entryIds = new Set<string>();

  // Extract IDs from the file contents (primary) and paths (fallback)
  for (const filePath in glossaryModules) {
    const module = glossaryModules[filePath];

    // Primary: use the 'id' field from the JSON file
    if (module && module.id) {
      entryIds.add(module.id);
      entryIds.add(module.id.replace(/-/g, '_'));
      entryIds.add(module.id.replace(/_/g, '-'));
    }

    // Fallback: extract from filename
    const filename = filePath.split('/').pop()?.replace('.json', '') ?? '';
    if (filename) {
      entryIds.add(filename);
      entryIds.add(filename.replace(/-/g, '_'));
      entryIds.add(filename.replace(/_/g, '-'));
    }
  }

  return entryIds;
}

/**
 * Gets the count of glossary entry files (including subdirectories).
 *
 * @returns The number of glossary entry JSON files
 */
function getGlossaryEntryCount(): number {
  const glossaryModules = import.meta.glob(
    '/public/data/glossary/entries/races/**/*.json',
    { eager: true }
  );
  return Object.keys(glossaryModules).length;
}

// ============================================================================
// AUDIT LOGIC
// ============================================================================

/**
 * Determines if a race should be expected to have its own glossary entry.
 * Some races are variants/subraces that may be covered by a parent entry.
 *
 * @param race - The race to check
 * @returns true if this race should have a dedicated glossary entry
 */
function shouldHaveGlossaryEntry(race: Race): boolean {
  // Races with a baseRace are variants - they might be covered by the parent
  // But we still want to track them as potentially missing
  // This function can be refined based on project conventions
  return true;
}

/**
 * Checks if a glossary entry exists for a given race.
 * Handles various ID format differences and naming conventions between
 * character creator and glossary systems.
 *
 * @param raceId - The race ID to look for
 * @param glossaryIds - Set of known glossary entry IDs
 * @returns true if a matching glossary entry exists
 */
function hasGlossaryEntry(raceId: string, glossaryIds: Set<string>): boolean {
  // Direct match
  if (glossaryIds.has(raceId)) return true;

  // Try hyphen format (race_id -> race-id)
  const hyphenFormat = raceId.replace(/_/g, '-');
  if (glossaryIds.has(hyphenFormat)) return true;

  // Try underscore format (race-id -> race_id)
  const underscoreFormat = raceId.replace(/-/g, '_');
  if (glossaryIds.has(underscoreFormat)) return true;

  // Handle goliath ancestry naming: cloud_giant_goliath -> cloud_giant
  if (raceId.endsWith('_goliath')) {
    const ancestryId = raceId.replace('_goliath', '');
    if (glossaryIds.has(ancestryId)) return true;
    if (glossaryIds.has(ancestryId.replace(/_/g, '-'))) return true;
  }

  // Handle aasimar variants: fallen_aasimar -> fallen
  if (raceId.endsWith('_aasimar')) {
    const variantId = raceId.replace('_aasimar', '');
    if (glossaryIds.has(variantId)) return true;
  }

  // Handle tiefling variants: abyssal_tiefling -> abyssal
  if (raceId.endsWith('_tiefling')) {
    const variantId = raceId.replace('_tiefling', '');
    if (glossaryIds.has(variantId)) return true;
  }

  // Handle dragonborn colors: black_dragonborn -> black
  if (raceId.endsWith('_dragonborn')) {
    const colorId = raceId.replace('_dragonborn', '');
    if (glossaryIds.has(colorId)) return true;
  }

  // Handle halfling subraces: lightfoot_halfling -> lightfoot
  if (raceId.endsWith('_halfling')) {
    const subraceId = raceId.replace('_halfling', '');
    if (glossaryIds.has(subraceId)) return true;
  }

  // Handle shifter variants: beasthide_shifter -> beasthide
  if (raceId.endsWith('_shifter')) {
    const variantId = raceId.replace('_shifter', '');
    if (glossaryIds.has(variantId)) return true;
  }

  // Handle half_elf variants: half_elf_aquatic -> aquatic
  if (raceId.startsWith('half_elf_')) {
    const variantId = raceId.replace('half_elf_', '');
    if (glossaryIds.has(variantId)) return true;
  }

  // Handle eladrin seasons: autumn_eladrin -> autumn
  if (raceId.endsWith('_eladrin')) {
    const seasonId = raceId.replace('_eladrin', '');
    if (glossaryIds.has(seasonId)) return true;
  }

  return false;
}

/**
 * Performs a complete audit of race data synchronization between
 * the character creator and glossary systems.
 *
 * @returns Audit result with counts, missing entries, issues, and summary
 */
export function auditRaceSync(): RaceSyncAuditResult {
  // Get all character creator races
  const characterCreatorRaces = ACTIVE_RACES;
  const totalCharacterCreatorRaces = characterCreatorRaces.length;

  // Get all glossary entries
  const glossaryIds = getGlossaryEntryIds();
  const totalGlossaryEntries = getGlossaryEntryCount();

  // Track missing entries and issues
  const missingGlossaryEntries: string[] = [];
  const issues: RaceSyncIssue[] = [];

  // Check each character creator race for a corresponding glossary entry
  for (const race of characterCreatorRaces) {
    if (!shouldHaveGlossaryEntry(race)) continue;

    if (!hasGlossaryEntry(race.id, glossaryIds)) {
      missingGlossaryEntries.push(race.id);

      // Create an issue for this missing entry
      issues.push({
        type: 'missing_glossary',
        severity: 'warning',
        raceId: race.id,
        message: `Race "${race.name}" (${race.id}) has no glossary entry`,
        details: {
          raceName: race.name,
          baseRace: race.baseRace,
        },
      });
    }
  }

  // Sort missing entries alphabetically for easier reading
  missingGlossaryEntries.sort();

  // Generate human-readable summary
  const syncPercentage = Math.round(
    ((totalCharacterCreatorRaces - missingGlossaryEntries.length) /
      totalCharacterCreatorRaces) *
      100
  );

  const summary = [
    `Race Sync Audit Results`,
    `=======================`,
    `Total character creator races: ${totalCharacterCreatorRaces}`,
    `Total glossary entries: ${totalGlossaryEntries}`,
    `Missing glossary entries: ${missingGlossaryEntries.length}`,
    `Sync coverage: ${syncPercentage}%`,
    ``,
    missingGlossaryEntries.length > 0
      ? `Missing entries:\n${missingGlossaryEntries.map((id) => `  - ${id}`).join('\n')}`
      : `All races have glossary entries!`,
  ].join('\n');

  return {
    totalCharacterCreatorRaces,
    totalGlossaryEntries,
    missingGlossaryEntries,
    issues,
    summary,
  };
}

/**
 * Prints the audit results to the console in a formatted way.
 * Useful for CLI scripts.
 *
 * @param result - The audit result to print
 */
export function printAuditResults(result: RaceSyncAuditResult): void {
  console.log(result.summary);

  if (result.issues.length > 0) {
    console.log('\nDetailed Issues:');
    result.issues.forEach((issue) => {
      const icon =
        issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${icon} [${issue.type}] ${issue.message}`);
    });
  }
}
