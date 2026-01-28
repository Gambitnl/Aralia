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

import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Simplified race info extracted from character creator files.
 */
interface RaceInfo {
  id: string;
  name: string;
  baseRace?: string;
  filename: string;
}

/**
 * Audit result structure.
 */
interface AuditResult {
  totalCharacterCreatorRaces: number;
  totalGlossaryEntries: number;
  missingGlossaryEntries: RaceInfo[];
  matchedEntries: string[];
  coverage: number;
}

// ============================================================================
// FILE SCANNING
// ============================================================================

/**
 * Scans the character creator race files and extracts race IDs.
 * Parses TypeScript files to find exported race data.
 *
 * @returns Array of race info objects
 */
function getCharacterCreatorRaces(): RaceInfo[] {
  // Path to race data files
  const racesDir = path.join(process.cwd(), 'src', 'data', 'races');

  // Get all .ts files except index.ts and raceGroups.ts
  const files = fs.readdirSync(racesDir).filter((file) => {
    return (
      file.endsWith('.ts') &&
      file !== 'index.ts' &&
      file !== 'raceGroups.ts'
    );
  });

  const races: RaceInfo[] = [];

  // Parse each file to extract race data
  // We need to find exports that end with _DATA and contain a Race object
  for (const file of files) {
    const filePath = path.join(racesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Look for Race exports (pattern: export const XXX_DATA: Race = { ... })
    // A real Race object must have a 'traits:' field (array of trait strings)
    // This distinguishes races from subraces/benefits which don't have traits

    // Find all DATA exports that look like races
    // Match the pattern: export const XXX_DATA: Race = {
    const raceExportMatches = content.matchAll(
      /export\s+const\s+(\w+_DATA):\s*Race\s*=\s*\{/g
    );

    for (const exportMatch of raceExportMatches) {
      const exportName = exportMatch[1];

      // Find the block for this export and extract id/name/baseRace
      // We look for the id: field that appears after this export and before the next export or EOF
      const exportIndex = exportMatch.index!;
      const remainingContent = content.slice(exportIndex);

      // Extract fields from this race block
      // Use a simpler approach: find id/name right after the export
      const idMatch = remainingContent.match(/id:\s*['"]([^'"]+)['"]/);
      const nameMatch = remainingContent.match(/name:\s*['"]([^'"]+)['"]/);
      const baseRaceMatch = remainingContent.match(/baseRace:\s*['"]([^'"]+)['"]/);
      const hasTraits = remainingContent.includes('traits:');

      // Only add if it has traits (real race, not a subrace/benefit helper)
      if (idMatch && nameMatch && hasTraits) {
        races.push({
          id: idMatch[1],
          name: nameMatch[1],
          baseRace: baseRaceMatch?.[1],
          filename: file,
        });
      }
    }
  }

  // Sort by name for consistent output
  return races.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively finds all JSON files in a directory.
 *
 * @param dir - Directory to scan
 * @returns Array of file paths
 */
function findJsonFilesRecursively(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Recurse into subdirectories
      results.push(...findJsonFilesRecursively(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Scans the glossary entries directory for race JSON files (including subdirectories).
 * Parses each JSON file to extract the actual 'id' field.
 *
 * @returns Set of glossary entry IDs (normalized)
 */
function getGlossaryEntryIds(): Set<string> {
  // Path to glossary race entries
  const glossaryDir = path.join(
    process.cwd(),
    'public',
    'data',
    'glossary',
    'entries',
    'races'
  );

  // Check if directory exists
  if (!fs.existsSync(glossaryDir)) {
    console.warn(`⚠️  Glossary directory not found: ${glossaryDir}`);
    return new Set();
  }

  // Get all JSON files recursively (including subdirectories)
  const files = findJsonFilesRecursively(glossaryDir);

  const entryIds = new Set<string>();

  for (const filePath of files) {
    try {
      // Parse JSON to get the actual ID field
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.id) {
        // Add the actual ID from the JSON
        entryIds.add(data.id);
        // Also add normalized versions
        entryIds.add(data.id.replace(/-/g, '_'));
        entryIds.add(data.id.replace(/_/g, '-'));
      }

      // Also add filename-based ID as fallback
      const filename = path.basename(filePath, '.json');
      entryIds.add(filename);
      entryIds.add(filename.replace(/-/g, '_'));
      entryIds.add(filename.replace(/_/g, '-'));
    } catch {
      // Skip files that can't be parsed
      console.warn(`⚠️  Could not parse: ${filePath}`);
    }
  }

  return entryIds;
}

/**
 * Counts the actual number of glossary files (including subdirectories).
 */
function getGlossaryFileCount(): number {
  const glossaryDir = path.join(
    process.cwd(),
    'public',
    'data',
    'glossary',
    'entries',
    'races'
  );

  return findJsonFilesRecursively(glossaryDir).length;
}

// ============================================================================
// AUDIT LOGIC
// ============================================================================

/**
 * Checks if a race has a matching glossary entry.
 * Handles various naming conventions between character creator and glossary.
 *
 * @param raceId - The character creator race ID
 * @param glossaryIds - Set of known glossary IDs
 * @returns true if a match exists
 */
function hasGlossaryEntry(raceId: string, glossaryIds: Set<string>): boolean {
  // Direct match
  if (glossaryIds.has(raceId)) return true;

  // Try different formats (hyphen vs underscore)
  if (glossaryIds.has(raceId.replace(/_/g, '-'))) return true;
  if (glossaryIds.has(raceId.replace(/-/g, '_'))) return true;

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

  // Handle elf lineages: high_elf -> high_elf (already covered by direct match)
  // but also astral_elf etc.

  // Handle gnome subraces: forest_gnome -> forest_gnome (already covered)

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

  // Handle dwarf subraces: mountain_dwarf -> mountain_dwarf (already covered)
  // but also hill_dwarf etc.

  return false;
}

/**
 * Runs the full audit comparing character creator races to glossary entries.
 */
function runAudit(): AuditResult {
  const races = getCharacterCreatorRaces();
  const glossaryIds = getGlossaryEntryIds();
  const glossaryCount = getGlossaryFileCount();

  const missingGlossaryEntries: RaceInfo[] = [];
  const matchedEntries: string[] = [];

  for (const race of races) {
    if (hasGlossaryEntry(race.id, glossaryIds)) {
      matchedEntries.push(race.id);
    } else {
      missingGlossaryEntries.push(race);
    }
  }

  const coverage = Math.round((matchedEntries.length / races.length) * 100);

  return {
    totalCharacterCreatorRaces: races.length,
    totalGlossaryEntries: glossaryCount,
    missingGlossaryEntries,
    matchedEntries,
    coverage,
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Groups missing races by their base race for easier review.
 */
function groupByBaseRace(races: RaceInfo[]): Map<string, RaceInfo[]> {
  const groups = new Map<string, RaceInfo[]>();

  for (const race of races) {
    const key = race.baseRace || '(standalone)';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(race);
  }

  return groups;
}

/**
 * Prints the audit report to console.
 */
function printReport(result: AuditResult): void {
  console.log('Race Sync Audit Results');
  console.log('=======================\n');

  console.log(`📊 Statistics:`);
  console.log(`   Character Creator Races: ${result.totalCharacterCreatorRaces}`);
  console.log(`   Glossary Entries:        ${result.totalGlossaryEntries}`);
  console.log(`   Matched:                 ${result.matchedEntries.length}`);
  console.log(`   Missing:                 ${result.missingGlossaryEntries.length}`);
  console.log(`   Coverage:                ${result.coverage}%\n`);

  if (result.missingGlossaryEntries.length === 0) {
    console.log('✅ All races have glossary entries!');
    return;
  }

  console.log('📋 Missing Glossary Entries (grouped by base race):\n');

  const grouped = groupByBaseRace(result.missingGlossaryEntries);

  // Sort groups: standalone first, then alphabetically
  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === '(standalone)') return -1;
    if (b === '(standalone)') return 1;
    return a.localeCompare(b);
  });

  for (const baseRace of sortedKeys) {
    const races = grouped.get(baseRace)!;
    console.log(`  ${baseRace}:`);
    for (const race of races) {
      console.log(`    - ${race.name} (${race.id})`);
    }
    console.log('');
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  console.log('🔍 Running Race Sync Audit...\n');

  const result = runAudit();
  printReport(result);

  // Summary line
  if (result.coverage < 80) {
    console.warn(`⚠️  Coverage is below 80%. Consider adding missing glossary entries.`);
  } else if (result.coverage < 100) {
    console.log(`ℹ️  Coverage is ${result.coverage}%. ${result.missingGlossaryEntries.length} races need glossary entries.`);
  } else {
    console.log('✅ Full coverage achieved!');
  }
}

main();
