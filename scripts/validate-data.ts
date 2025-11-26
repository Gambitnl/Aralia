/**
 * @file scripts/validate-data.ts
 * This script contains validation functions to ensure the integrity of game data.
 * It checks for duplicate IDs in races, subraces, and other data structures
 * to prevent runtime errors and maintain data consistency.
 */
import { ACTIVE_RACES } from '../src/data/races/index.ts';
import type { Race } from '../src/types.ts';

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

  races.forEach((race) => {
    // Check for duplicate race IDs
    if (seenRaceIds.has(race.id)) {
      throw new Error(`[Data Validation] Duplicate race ID found: ${race.id}`);
    }
    seenRaceIds.add(race.id);

    // Check for duplicate subrace/lineage IDs
    const subraces = [
      ...(race.elvenLineages ?? []),
      ...(race.gnomeSubraces ?? []),
      ...(race.giantAncestryChoices ?? []),
      ...(race.fiendishLegacies ?? []),
    ];

    subraces.forEach((subrace) => {
      if (seenSubraceIds.has(subrace.id)) {
        throw new Error(`[Data Validation] Duplicate subrace/lineage ID found: ${subrace.id} in race ${race.id}`);
      }
      seenSubraceIds.add(subrace.id);
    });
  });
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
    validateRaces(ACTIVE_RACES);
    console.log('[Data Validation] All race data validated successfully.');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

main();
