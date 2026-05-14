import path from 'path';
import { pathToFileURL } from 'url';
import { globSync } from 'glob';
import type { Race } from '../src/types';

/**
 * Node-side race data loader for validation scripts.
 *
 * The app-facing race index uses Vite's `import.meta.glob`, which is correct
 * inside the Vite pipeline but unavailable when `tsx` runs scripts directly in
 * Node. This loader keeps validation tooling independent from Vite while still
 * reading the same source race files and preserving the same "discover Race
 * shaped exports" behavior.
 *
 * Called by: scripts/validate-data.ts
 * Depends on: glob for file discovery and dynamic import for loading TS modules
 */

// ============================================================================
// Race Selection Rules
// ============================================================================
// These IDs mirror src/data/races/index.ts so validation checks the same
// selectable race set as the app, without importing the Vite-only index module.
// ============================================================================

const NON_SELECTABLE_BASE_RACE_IDS = new Set<string>([
  'elf',
  'tiefling',
  'goliath',
  'eladrin',
  'dragonborn',
]);

function isRaceExport(value: unknown): value is Race {
  // Race files also export helper arrays and maps. The validator only wants
  // actual Race records, so use the same structural guard as the app index.
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    'name' in value &&
    'description' in value &&
    'traits' in value
  );
}

// ============================================================================
// Node Loader
// ============================================================================
// This section imports every concrete race module directly from disk. It skips
// index and grouping files because those are aggregators rather than source
// records, and it ignores declaration files because they have no runtime data.
// ============================================================================

export async function loadActiveRacesForValidation(): Promise<Race[]> {
  const raceModulePaths = globSync('src/data/races/*.ts', {
    ignore: [
      'src/data/races/*.d.ts',
      'src/data/races/index.ts',
      'src/data/races/raceGroups.ts',
    ],
  }).sort();

  const racesData: Record<string, Race> = {};

  for (const modulePath of raceModulePaths) {
    const absolutePath = path.resolve(modulePath);
    const moduleUrl = pathToFileURL(absolutePath).href;
    const raceModule = await import(moduleUrl);

    Object.values(raceModule).forEach((exportValue) => {
      if (isRaceExport(exportValue)) {
        racesData[exportValue.id] = exportValue;
      }
    });
  }

  return Object.values(racesData)
    .filter((race) => !NON_SELECTABLE_BASE_RACE_IDS.has(race.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}
