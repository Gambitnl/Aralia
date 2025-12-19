import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator.ts';
import { ACTIVE_RACES } from '../src/data/races/index.ts';
import type { Race } from '../src/types';
import { checkFile, TARGET_DIRECTORIES } from './check-non-ascii.ts';
import { globSync } from 'glob';

/**
 * Validates all spell data against the Zod schema.
 */
const validateSpells = (): void => {
  const manifestPath = path.join(process.cwd(), 'public', 'data', 'spells_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.warn('[Data Validation] Spells manifest not found. Skipping spell validation.');
    return;
  }

  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  let manifest;
  try {
    manifest = JSON.parse(manifestContent);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`[Data Validation] Failed to parse spells_manifest.json: ${message}`);
  }

  const spellIds = Object.keys(manifest);
  console.log(`[Data Validation] Validating ${spellIds.length} spells...`);

  let errorCount = 0;

  spellIds.forEach(id => {
    const entry = manifest[id];
    // entry.path is like "/data/spells/acid-splash.json"
    const relativePath = entry.path.startsWith('/') ? entry.path.substring(1) : entry.path;
    const spellFilePath = path.join(process.cwd(), 'public', relativePath);

    if (!fs.existsSync(spellFilePath)) {
      console.error(`[Data Validation] Spell file not found for ${id}: ${spellFilePath}`);
      errorCount++;
      return;
    }

    try {
      const spellContent = fs.readFileSync(spellFilePath, 'utf-8');
      const spellData = JSON.parse(spellContent);
      SpellValidator.parse(spellData);
    } catch (error: unknown) {
      console.error(`[Data Validation] Validation failed for spell ${id}:`);
      if (error instanceof z.ZodError) {
        error.issues.forEach((e) => console.error(`  - ${e.path.join('.')}: ${e.message}`));
      } else if (error instanceof Error) {
        console.error(error.message);
        if (error.stack) console.error(error.stack);
      } else {
        console.error(String(error));
      }
      errorCount++;
    }
  });

  if (errorCount > 0) {
    throw new Error(`[Data Validation] ${errorCount} spells failed validation.`);
  }
};

/**
 * Validates all race data, checking for duplicate race IDs and subrace/lineage IDs.
 * Throws an error if any duplicates are found.
 */
// Why: Centralizing data validation in this script makes it easier to maintain and expand
// as new data types are added. By running these checks during the build process or in a
// pre-commit hook, we can catch data errors early and prevent them from reaching production.
const validateRaces = (races: readonly Race[]): void => {
  const seenRaceIds = new Set<string>();
  const seenSubraceIds = new Set<string>();

  races.forEach(race => {
    if (seenRaceIds.has(race.id)) {
      throw new Error(`[Data Validation] Duplicate race ID found: ${race.id}`);
    }
    seenRaceIds.add(race.id);

    // Validate required fields (basic check)
    if (!race.name) {
      throw new Error(`[Data Validation] Race missing name: ${race.id}`);
    }
    // Check for speed trait
    if (!race.traits.some(trait => trait.startsWith('Speed:'))) {
      throw new Error(`[Data Validation] Race missing speed trait: ${race.id}`);
    }

    // Check for duplicate subrace/lineage IDs
    const subraces = [
      ...(race.elvenLineages ?? []),
      ...(race.gnomeSubraces ?? []),
      ...(race.giantAncestryChoices ?? []),
      ...(race.fiendishLegacies ?? []),
    ];

    subraces.forEach(subrace => {
      if (seenSubraceIds.has(subrace.id)) {
        throw new Error(
          `[Data Validation] Duplicate subrace/lineage ID found: ${subrace.id} in race ${race.id}`,
        );
      }
      seenSubraceIds.add(subrace.id);
    });
  });
};

/**
 * Validates all files in TARGET_DIRECTORIES for non-ASCII or mojibake characters.
 */
const validateCharset = (): void => {
  const files = TARGET_DIRECTORIES.flatMap((pattern) => globSync(pattern));
  console.log(`[Data Validation] Validating character sets for ${files.length} files...`);

  let errorCount = 0;
  files.forEach((file) => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      console.error(`[Data Validation] Charset issues found in ${file}:`);
      issues.forEach((issue) => {
        console.error(
          `  - [Line ${issue.line}, Col ${issue.column}] ${issue.type} (${issue.char} / ${issue.codePoint})${issue.suggested !== undefined ? ` -> Suggested: ${issue.suggested}` : ''
          }`
        );
      });
      errorCount++;
    }
  });

  if (errorCount > 0) {
    throw new Error(`[Data Validation] ${errorCount} files failed charset validation. Run 'npx tsx scripts/check-non-ascii.ts --write' to fix.`);
  }
};

/**
 * The main validation function that orchestrates all data validation checks.
 * It calls specific validation functions for different data types.
 */
// Why: This main function serves as the entry point for all data validation.
// As we add more validation checks (e.g., for items, spells, or classes),
// we can simply add them to this function to ensure they are all executed.
const main = () => {
  try {
    validateCharset();
    console.log('[Data Validation] All character sets validated successfully.');

    validateRaces(ACTIVE_RACES);
    console.log('[Data Validation] All race data validated successfully.');

    validateSpells();
    console.log('[Data Validation] All spell data validated successfully.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
};

main();
