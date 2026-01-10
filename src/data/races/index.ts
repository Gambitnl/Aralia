/**
 * @file index.ts
 * Aggregates all race data exports for centralized access using import.meta.glob.
 * Race files are automatically discovered - no manual imports needed!
 *
 * To add a new race:
 * 1. Create a new .ts file in src/data/races/ (e.g., kobold.ts)
 * 2. Export a constant named <RACE_ID>_DATA (e.g., KOBOLD_DATA)
 * 3. That's it! The race will be automatically included.
 */
import { Race } from '../../types';

// Auto-import all race files using Vite's import.meta.glob
// This scans for all .ts files in the current directory, excluding index.ts and raceGroups.ts
const raceModules = import.meta.glob<{ [key: string]: Race | any }>('./*.ts', { eager: true });

// Build the races data map dynamically
const racesData: Record<string, Race> = {};

for (const path in raceModules) {
  // Skip index.ts and raceGroups.ts
  if (path === './index.ts' || path === './raceGroups.ts') continue;

  const module = raceModules[path];

  // Find exports that match the pattern *_DATA and are Race objects
  for (const exportName in module) {
    const exportValue = module[exportName];

    // Check if this export is a Race object (has id, name, description, traits)
    if (
      exportValue &&
      typeof exportValue === 'object' &&
      'id' in exportValue &&
      'name' in exportValue &&
      'description' in exportValue &&
      'traits' in exportValue
    ) {
      // Use the race's id as the key
      racesData[exportValue.id] = exportValue as Race;
    }
  }
}

// Aggregated data map (auto-populated from race files)
export const ALL_RACES_DATA: Record<string, Race> = racesData;

// Import legacy data bundles that are still used by deprecated systems
// TODO: These can be removed once deprecated race selection components are cleaned up
import { DRAGONBORN_ANCESTRIES_DATA } from './dragonborn';
import { GIANT_ANCESTRY_BENEFITS_DATA } from './goliath';
import { FIENDISH_LEGACIES_DATA } from './tiefling';

// Bundled exports for subraces/legacies that need to be accessed by constants.ts
// This prevents circular dependencies or missing exports
export const RACE_DATA_BUNDLE = {
  dragonbornAncestries: DRAGONBORN_ANCESTRIES_DATA,
  goliathGiantAncestries: GIANT_ANCESTRY_BENEFITS_DATA,
  tieflingLegacies: FIENDISH_LEGACIES_DATA,
  gnomeSubraces: [] as any[], // Deprecated - will be removed
};

// Array for iteration (e.g., character creator list)
// Updated to filter out legacy or helper entries if needed
export const ACTIVE_RACES = Object.values(ALL_RACES_DATA).sort((a, b) =>
  a.name.localeCompare(b.name)
);
