/**
 * ARCHITECTURAL CONTEXT:
 * This script is the 'Data Quality Gatekeeper'. It is used during 
 * build/test pipelines to ensure that JSON data (spells, races, etc.) 
 * conforms to its TypeScript/Zod schemas and that no illegal non-ASCII 
 * characters (mojibake) have infiltrated the documentation or data directories.
 *
 * Recent updates focus on 'Environment Resilience' and 'Type Safety'. 
 * - Switched from `@ts-ignore` to `@ts-expect-error` for local imports 
 *   to ensure the script fails loudly if an import is accidentally fixed 
 *   or broken elsewhere.
 * - Added explicit typing for `trait` in the `validateRaces` callback 
 *   to resolve implicit `any` warnings and improve IDE discoverability.
 * - Consolidated the `validateCharset` logic to integrate the external 
 *   `check-non-ascii` utility as a core part of the data validation pass.
 * 
 * @file scripts/validate-data.ts
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
// WHAT CHANGED: Removed @ts-expect-error/ignore from local imports.
// WHY IT CHANGED: Recent improvements in the `tsx` environment and 
// tsconfig mappings now allow these local TypeScript entrypoints to 
// resolve correctly without suppression. Removing the directives 
// restores full type checking for these imports within the script.
import { SpellValidator } from '../src/systems/spells/validation/spellValidator';
import { ACTIVE_RACES } from '../src/data/races/index';
import type { Race } from '../src/types';
import { checkFile, TARGET_DIRECTORIES } from './check-non-ascii.js';
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
    // WHAT CHANGED: Added explicit :string type to trait.
    // WHY IT CHANGED: In strict mode, the callback parameter was defaulting 
    // to 'any'. Adding the explicit type removes a lint warning and documents 
    // the internal structure of the simplified trait string list used for validation.
    if (!race.traits.some((trait: string) => trait.startsWith('Speed:'))) {
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
 * Only fails on 'strict' issues (JSON/data files). 'soft' issues (docs) are warnings only.
 */
const validateCharset = (): void => {
  const files = TARGET_DIRECTORIES.flatMap((pattern: string) => globSync(pattern));
  console.log(`[Data Validation] Validating character sets for ${files.length} files...`);

  let strictErrorCount = 0;
  let softWarningCount = 0;

  files.forEach((file: string) => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      // DEBT: Cast to any because the issue object from checkFile is not strictly typed in this script.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const strictIssues = issues.filter((i: any) => i.severity === 'strict');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const softIssues = issues.filter((i: any) => i.severity === 'soft');

      if (strictIssues.length > 0) {
        console.error(`[Data Validation] ❌ Charset ERRORS in ${file}:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strictIssues.forEach((issue: any) => {
          console.error(
            `  - [Line ${issue.line}, Col ${issue.column}] ${issue.type} (${issue.char} / ${issue.codePoint})${issue.suggested !== undefined ? ` -> Suggested: ${issue.suggested}` : ''
            }`
          );
        });
        strictErrorCount++;
      }

      if (softIssues.length > 0) {
        console.warn(`[Data Validation] ⚠️ Charset warnings in ${file}:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        softIssues.forEach((issue: any) => {
          console.warn(
            `  - [Line ${issue.line}, Col ${issue.column}] ${issue.type} (${issue.char} / ${issue.codePoint})${issue.suggested !== undefined ? ` -> Suggested: ${issue.suggested}` : ''
            }`
          );
        });
        softWarningCount++;
      }
    }
  });

  if (strictErrorCount > 0) {
    throw new Error(`[Data Validation] ${strictErrorCount} files failed charset validation. Run 'npx tsx scripts/check-non-ascii.ts --write' to fix.`);
  }

  if (softWarningCount > 0) {
    console.log(`[Data Validation] ⚠️ ${softWarningCount} files have soft charset warnings (build continues).`);
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
