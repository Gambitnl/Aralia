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
  for (const file of files) {
    const filePath = path.join(racesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract id from the file using regex
    // Pattern: id: 'race_id' or id: "race_id"
    const idMatch = content.match(/id:\s*['"]([^'"]+)['"]/);
    const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
    const baseRaceMatch = content.match(/baseRace:\s*['"]([^'"]+)['"]/);

    if (idMatch && nameMatch) {
      races.push({
        id: idMatch[1],
        name: nameMatch[1],
        baseRace: baseRaceMatch?.[1],
        filename: file,
      });
    }
  }

  // Sort by name for consistent output
  return races.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scans the glossary entries directory for race JSON files.
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

  // Get all JSON files
  const files = fs.readdirSync(glossaryDir).filter((file) =>
    file.endsWith('.json')
  );

  const entryIds = new Set<string>();

  for (const file of files) {
    // Extract ID from filename: "elf.json" -> "elf"
    const id = file.replace('.json', '');

    // Add both original and normalized versions
    entryIds.add(id);
    entryIds.add(id.replace(/-/g, '_')); // half-elf -> half_elf
    entryIds.add(id.replace(/_/g, '-')); // half_elf -> half-elf
  }

  return entryIds;
}

/**
 * Counts the actual number of glossary files.
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

  if (!fs.existsSync(glossaryDir)) return 0;

  return fs.readdirSync(glossaryDir).filter((f) => f.endsWith('.json')).length;
}

// ============================================================================
// AUDIT LOGIC
// ============================================================================

/**
 * Checks if a race has a matching glossary entry.
 *
 * @param raceId - The character creator race ID
 * @param glossaryIds - Set of known glossary IDs
 * @returns true if a match exists
 */
function hasGlossaryEntry(raceId: string, glossaryIds: Set<string>): boolean {
  // Direct match
  if (glossaryIds.has(raceId)) return true;

  // Try different formats
  if (glossaryIds.has(raceId.replace(/_/g, '-'))) return true;
  if (glossaryIds.has(raceId.replace(/-/g, '_'))) return true;

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
