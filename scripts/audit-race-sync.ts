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
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);

// Forced-choice base families (variants-only). These base entries are helpers and intentionally excluded
// from Character Creator selection and from the Glossary race index (Aasimar-style).
const NON_SELECTABLE_BASE_RACE_IDS = new Set<string>(['elf', 'tiefling', 'goliath', 'eladrin', 'dragonborn']);

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
  tsHasJsonMissing: Array<{ race: RaceInfo; glossaryId: string }>;
  /** TS race declares modernizationStatus but has NO matching glossary JSON at all. */
  tsButNoJson: RaceInfo[];
  /** Both TS and matching JSON declare modernizationStatus (informational count). */
  inSync: number;
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
  modernizationDrift: ModernizationDriftResult;
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
    races.push(...extractRacesFromContent(content, file));
  }

  // Sort by name for consistent output
  return races.sort((a, b) => a.name.localeCompare(b.name));
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
export function extractRacesFromContent(content: string, filename: string): RaceInfo[] {
  const races: RaceInfo[] = [];

  const raceExportMatches = content.matchAll(
    /export\s+const\s+(\w+_DATA):\s*Race\s*=\s*\{/g
  );

  for (const exportMatch of raceExportMatches) {
    // Scope each race block to the text between this export and the next
    // matching export (or EOF), so fields don't leak across exports.
    const exportIndex = exportMatch.index!;
    const nextMatch = content
      .slice(exportIndex + exportMatch[0].length)
      .match(/export\s+const\s+\w+_DATA:\s*Race\s*=\s*\{/);
    const blockEnd =
      nextMatch && nextMatch.index !== undefined
        ? exportIndex + exportMatch[0].length + nextMatch.index
        : content.length;
    const block = content.slice(exportIndex, blockEnd);

    const idMatch = block.match(/id:\s*['"]([^'"]+)['"]/);
    const nameMatch = block.match(/name:\s*['"]([^'"]+)['"]/);
    const baseRaceMatch = block.match(/baseRace:\s*['"]([^'"]+)['"]/);
    const modernizationMatch = block.match(/modernizationStatus:\s*['"]([^'"]+)['"]/);
    const hasTraits = block.includes('traits:');

    // Only add if it has traits (real race, not a subrace/benefit helper)
    if (idMatch && nameMatch && hasTraits) {
      if (NON_SELECTABLE_BASE_RACE_IDS.has(idMatch[1])) continue;
      races.push({
        id: idMatch[1],
        name: nameMatch[1],
        baseRace: baseRaceMatch?.[1],
        filename,
        modernizationStatus: modernizationMatch?.[1],
      });
    }
  }

  return races;
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
 * Scans the glossary entries directory for race JSON files (including subdirectories)
 * and parses each into a GlossaryEntry (id + whether it declares modernizationStatus).
 *
 * @returns Array of parsed glossary entries (one per JSON file)
 */
function getGlossaryEntries(): GlossaryEntry[] {
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
    return [];
  }

  // Get all JSON files recursively (including subdirectories)
  const files = findJsonFilesRecursively(glossaryDir);

  const entries: GlossaryEntry[] = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Fall back to filename when the JSON omits an explicit id.
      const id = data.id || path.basename(filePath, '.json');
      entries.push({
        id,
        hasModernizationStatus: Object.prototype.hasOwnProperty.call(
          data,
          'modernizationStatus'
        ),
        modernizationStatus: data.modernizationStatus,
        filePath,
      });
    } catch {
      // Skip files that can't be parsed
      console.warn(`⚠️  Could not parse: ${filePath}`);
    }
  }

  return entries;
}

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
export function buildGlossaryEntryMap(
  entries: GlossaryEntry[]
): Map<string, GlossaryEntry> {
  const map = new Map<string, GlossaryEntry>();

  const add = (key: string, entry: GlossaryEntry) => {
    if (!map.has(key)) map.set(key, entry);
  };

  for (const entry of entries) {
    add(entry.id, entry);
    add(entry.id.replace(/-/g, '_'), entry);
    add(entry.id.replace(/_/g, '-'), entry);

    // Filename-based fallback (basename without extension), if derivable.
    const filename = entry.filePath
      ? path.basename(entry.filePath, '.json')
      : entry.id;
    add(filename, entry);
    add(filename.replace(/-/g, '_'), entry);
    add(filename.replace(/_/g, '-'), entry);
  }

  return map;
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
 * Resolves a race ID to its matching glossary entry, handling the various naming
 * conventions between character creator and glossary. Pure — operates on a map.
 *
 * @param raceId - The character creator race ID
 * @param entryMap - Map of normalized id variants → GlossaryEntry (see buildGlossaryEntryMap)
 * @returns The matching GlossaryEntry, or undefined if none matches
 */
export function resolveGlossaryEntry(
  raceId: string,
  entryMap: Map<string, GlossaryEntry>
): GlossaryEntry | undefined {
  // Candidate keys to try, in order. First hit wins.
  const candidates: string[] = [
    raceId,
    raceId.replace(/_/g, '-'),
    raceId.replace(/-/g, '_'),
  ];

  // Suffix-stripping conventions (variant -> base ancestry/color/season/etc.)
  const suffixes = ['_goliath', '_aasimar', '_tiefling', '_dragonborn', '_halfling', '_shifter', '_eladrin'];
  for (const suffix of suffixes) {
    if (raceId.endsWith(suffix)) {
      const stripped = raceId.slice(0, -suffix.length);
      candidates.push(stripped, stripped.replace(/_/g, '-'));
    }
  }

  // Prefix-stripping: half_elf_aquatic -> aquatic
  if (raceId.startsWith('half_elf_')) {
    const stripped = raceId.replace('half_elf_', '');
    candidates.push(stripped, stripped.replace(/_/g, '-'));
  }

  for (const key of candidates) {
    const entry = entryMap.get(key);
    if (entry) return entry;
  }

  return undefined;
}

/**
 * Checks if a race has a matching glossary entry.
 *
 * @param raceId - The character creator race ID
 * @param entryMap - Map of normalized id variants → GlossaryEntry
 * @returns true if a match exists
 */
function hasGlossaryEntry(
  raceId: string,
  entryMap: Map<string, GlossaryEntry>
): boolean {
  return resolveGlossaryEntry(raceId, entryMap) !== undefined;
}

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
export function computeModernizationDrift(
  races: RaceInfo[],
  entryMap: Map<string, GlossaryEntry>
): ModernizationDriftResult {
  const tsHasJsonMissing: Array<{ race: RaceInfo; glossaryId: string }> = [];
  const tsButNoJson: RaceInfo[] = [];
  let inSync = 0;

  for (const race of races) {
    // Only races that DECLARE a modernizationStatus in TS are in scope.
    if (!race.modernizationStatus) continue;

    const entry = resolveGlossaryEntry(race.id, entryMap);
    if (!entry) {
      tsButNoJson.push(race);
    } else if (!entry.hasModernizationStatus) {
      tsHasJsonMissing.push({ race, glossaryId: entry.id });
    } else {
      inSync += 1;
    }
  }

  return { tsHasJsonMissing, tsButNoJson, inSync };
}

/**
 * Runs the full audit comparing character creator races to glossary entries.
 */
function runAudit(): AuditResult {
  const races = getCharacterCreatorRaces();
  const glossaryEntries = getGlossaryEntries();
  const entryMap = buildGlossaryEntryMap(glossaryEntries);
  const glossaryCount = getGlossaryFileCount();

  const missingGlossaryEntries: RaceInfo[] = [];
  const matchedEntries: string[] = [];

  for (const race of races) {
    if (hasGlossaryEntry(race.id, entryMap)) {
      matchedEntries.push(race.id);
    } else {
      missingGlossaryEntries.push(race);
    }
  }

  const coverage = Math.round((matchedEntries.length / races.length) * 100);
  const modernizationDrift = computeModernizationDrift(races, entryMap);

  return {
    totalCharacterCreatorRaces: races.length,
    totalGlossaryEntries: glossaryCount,
    missingGlossaryEntries,
    matchedEntries,
    coverage,
    modernizationDrift,
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

/**
 * Prints the modernizationStatus drift section. Report-only: no rulings, no data changes.
 */
function printModernizationDrift(drift: ModernizationDriftResult): void {
  const { tsHasJsonMissing, tsButNoJson, inSync } = drift;

  console.log('🔧 Modernization Status Drift (report-only — no rulings made):');
  console.log('----------------------------------------------------------\n');
  console.log(`   TS declares + JSON in sync:   ${inSync}`);
  console.log(`   TS declares, JSON MISSING it: ${tsHasJsonMissing.length}`);
  console.log(`   TS declares, NO matching JSON:${' '}${tsButNoJson.length}\n`);

  if (tsHasJsonMissing.length === 0 && tsButNoJson.length === 0) {
    console.log('✅ No modernization drift detected.\n');
    return;
  }

  if (tsHasJsonMissing.length > 0) {
    console.log('  ⚠️  TS declares modernizationStatus but glossary JSON is MISSING it:');
    for (const { race, glossaryId } of tsHasJsonMissing) {
      console.log(
        `    - ${race.name} (${race.id}) → glossary "${glossaryId}" [TS: ${race.modernizationStatus}]`
      );
    }
    console.log('');
  }

  if (tsButNoJson.length > 0) {
    console.log('  ⚠️  TS declares modernizationStatus but has NO matching glossary JSON:');
    for (const race of tsButNoJson) {
      console.log(`    - ${race.name} (${race.id}) [TS: ${race.modernizationStatus}]`);
    }
    console.log('');
  }

  console.log('  ℹ️  These are drift signals for human review, not corrections.\n');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  console.log('🔍 Running Race Sync Audit...\n');

  const result = runAudit();
  printReport(result);
  printModernizationDrift(result.modernizationDrift);

  // Summary line
  if (result.coverage < 80) {
    console.warn(`⚠️  Coverage is below 80%. Consider adding missing glossary entries.`);
  } else if (result.coverage < 100) {
    console.log(`ℹ️  Coverage is ${result.coverage}%. ${result.missingGlossaryEntries.length} races need glossary entries.`);
  } else {
    console.log('✅ Full coverage achieved!');
  }
}

// Only run the live audit when executed directly (not when imported by tests).
const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === SCRIPT_FILE
  : false;

if (isDirectRun) {
  main();
}
