#!/usr/bin/env npx tsx
/**
 * @file sync-race-modernization-status.ts
 * Propagates the authoritative `modernizationStatus` value from character-creator
 * race definitions (src/data/races/*.ts) into the matching glossary race entries
 * (public/data/glossary/entries/races/**\/*.json).
 *
 * This is PURE data propagation (gap RM-043):
 *   - The TS race file is the source of truth and is READ-ONLY here.
 *   - Only races whose TS file ALREADY declares a `modernizationStatus` are synced.
 *     Races with no TS flag are left completely untouched (a judgment call reserved
 *     for a human).
 *   - The TS race is joined to a glossary JSON STRICTLY by matching the `id` field.
 *     No suffix-stripping / fuzzy mapping is performed. A flagged TS race with no
 *     glossary entry whose `id` equals it is skipped and reported.
 *   - The value written is byte-identical to the TS value.
 *
 * The script is idempotent / re-runnable: writing an already-correct value is a no-op.
 *
 * Usage:
 *   npx tsx scripts/sync-race-modernization-status.ts
 */

import fs from 'fs';
import path from 'path';

interface FlaggedRace {
  id: string;
  modernizationStatus: string;
  filename: string;
}

const RACES_DIR = path.join(process.cwd(), 'src', 'data', 'races');
const GLOSSARY_DIR = path.join(
  process.cwd(),
  'public',
  'data',
  'glossary',
  'entries',
  'races'
);

/**
 * Reads every src/data/races/*.ts file and collects the id + modernizationStatus
 * for each exported Race that ALREADY declares a modernizationStatus.
 */
function collectFlaggedRaces(): FlaggedRace[] {
  const files = fs.readdirSync(RACES_DIR).filter((file) => {
    return (
      file.endsWith('.ts') &&
      file !== 'index.ts' &&
      file !== 'raceGroups.ts'
    );
  });

  const flagged: FlaggedRace[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(RACES_DIR, file), 'utf-8');

    // Find each exported Race object block, then read its id + modernizationStatus.
    const raceExportMatches = content.matchAll(
      /export\s+const\s+(\w+_DATA):\s*Race\s*=\s*\{/g
    );

    for (const exportMatch of raceExportMatches) {
      const exportIndex = exportMatch.index!;
      const remaining = content.slice(exportIndex);

      const idMatch = remaining.match(/id:\s*['"]([^'"]+)['"]/);
      const statusMatch = remaining.match(
        /modernizationStatus:\s*['"]([^'"]+)['"]/
      );

      // Only collect races that ALREADY declare a modernizationStatus.
      if (idMatch && statusMatch) {
        flagged.push({
          id: idMatch[1],
          modernizationStatus: statusMatch[1],
          filename: file,
        });
      }
    }
  }

  return flagged.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Recursively finds all JSON files under a directory.
 */
function findJsonFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFilesRecursively(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Indexes every glossary race JSON by its declared `id` field.
 */
function indexGlossaryById(): Map<string, string> {
  const byId = new Map<string, string>();

  for (const filePath of findJsonFilesRecursively(GLOSSARY_DIR)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (typeof data.id === 'string') {
        if (byId.has(data.id)) {
          console.warn(
            `  duplicate glossary id "${data.id}": ${byId.get(data.id)} and ${filePath}`
          );
        }
        byId.set(data.id, filePath);
      }
    } catch {
      console.warn(`  could not parse: ${filePath}`);
    }
  }

  return byId;
}

function main(): void {
  console.log('RM-043 modernizationStatus TS -> JSON sync\n');

  const flagged = collectFlaggedRaces();
  const glossaryById = indexGlossaryById();

  const synced: { id: string; value: string; file: string; changed: boolean }[] = [];
  const skippedNoJson: FlaggedRace[] = [];

  for (const race of flagged) {
    const jsonPath = glossaryById.get(race.id);
    if (!jsonPath) {
      skippedNoJson.push(race);
      continue;
    }

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    const changed = data.modernizationStatus !== race.modernizationStatus;

    if (changed) {
      data.modernizationStatus = race.modernizationStatus;
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    }

    synced.push({
      id: race.id,
      value: race.modernizationStatus,
      file: path.relative(process.cwd(), jsonPath),
      changed,
    });
  }

  console.log('Flagged TS races (already declare modernizationStatus):');
  for (const race of flagged) {
    console.log(`  ${race.id.padEnd(24)} ${race.modernizationStatus}  (${race.filename})`);
  }

  console.log('\nSynced into glossary JSON:');
  if (synced.length === 0) {
    console.log('  (none)');
  }
  for (const s of synced) {
    console.log(
      `  ${s.changed ? 'WROTE  ' : 'already'} ${s.id.padEnd(24)} ${s.value}  -> ${s.file}`
    );
  }

  console.log('\nSkipped (flagged TS race has no glossary entry with a matching id):');
  if (skippedNoJson.length === 0) {
    console.log('  (none)');
  }
  for (const race of skippedNoJson) {
    console.log(`  ${race.id.padEnd(24)} ${race.modernizationStatus}  (${race.filename})`);
  }

  console.log('\nSummary:');
  console.log(`  flagged TS races:        ${flagged.length}`);
  console.log(`  synced (matched JSON):   ${synced.length}`);
  console.log(`  newly written:           ${synced.filter((s) => s.changed).length}`);
  console.log(`  skipped (no matching JSON id): ${skippedNoJson.length}`);
}

main();
