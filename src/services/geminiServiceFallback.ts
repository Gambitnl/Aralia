// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 00:42:56
 * Dependents: services/gemini/encounters.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Monster } from '../types';
import type { MonsterData } from '../types/ui';
import { XP_BY_CR } from '../constants';
import { MONSTERS_DATA } from '../data/monsters';
import { logger } from '../utils/logger';
import { MAX_ENCOUNTER_MONSTER_COUNT } from '../utils/world/encounterUtils';
import { SeededRandom } from '../utils/random/seededRandom';

type SeededRng = SeededRandom | null;

function pickRandom<T>(arr: T[], rng: SeededRng): T | undefined {
  if (arr.length === 0) return undefined;
  const randomValue = (rng ? rng.next() : Math.random()) * arr.length;
  return arr[Math.floor(randomValue)];
}

function shuffleWithRandom<T>(values: T[], rng: SeededRng): T[] {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i--) {
    const randomValue = (rng ? rng.next() : Math.random()) * (i + 1);
    const j = Math.floor(randomValue);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Generates a fallback encounter when the AI service is unavailable or fails.
 * It attempts to select monsters from the static data that fit the XP budget.
 *
 * @param xpBudget The target XP budget for the encounter.
 * @param themeTags Tags to filter monsters by (e.g., 'forest', 'goblinoid').
 * @param seed Optional deterministic seed for replayable fallback runs.
 * @returns An array of Monster objects.
 */
export function getFallbackEncounter(xpBudget: number, themeTags: string[], seed?: number): Monster[] {
  return getFallbackEncounterWithSeed(xpBudget, themeTags, seed);
}

/**
 * Generates a fallback encounter when the AI service is unavailable or fails.
 * It attempts to select monsters from static data that fit the XP budget.
 *
 * @param xpBudget The target XP budget for the encounter.
 * @param themeTags Tags to filter monsters by (e.g., 'forest', 'goblinoid').
 * @param seed Deterministic seed for replayable fallback runs.
 * @returns An array of Monster objects.
 */
export function getFallbackEncounterWithSeed(
  xpBudget: number,
  themeTags: string[],
  seed: number | undefined,
): Monster[] {
  const encounter: Monster[] = [];
  let currentXp = 0;
  const rng = seed === undefined ? null : new SeededRandom(seed);

  // 1. Filter available monsters based on themes if possible
  const availableMonsters: MonsterData[] = Object.values(MONSTERS_DATA);
  let candidates = availableMonsters.filter(m =>
    themeTags.some(tag => m.tags?.some(t => t.toLowerCase() === tag.toLowerCase()))
  );

  // If no themed monsters found, use all available monsters
  if (candidates.length === 0) {
    candidates = availableMonsters;
  }

  // If still no monsters (shouldn't happen if MONSTERS_DATA is populated), return empty
  if (candidates.length === 0) {
    logger.warn("No monsters found for fallback encounter generation.");
    return [];
  }

  // 2. Sort candidates by XP (descending) to try and fill budget efficiently
  // We need to look up XP by CR.
  // TODO(2026-01-03 Codex-CLI): Define a slimmer Monster-like type for fallback encounters; using permissive accessors until data is refit.
  // DEBT: Cast baseStats to any to probe optional CR property without full schema mapping.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getXp = (m: MonsterData) => XP_BY_CR[(m?.baseStats as any)?.cr as keyof typeof XP_BY_CR] || 0;

  // Sort by XP descending, but filter out monsters that are too strong (XP > budget)
  const validCandidates = candidates
    .filter(m => getXp(m) <= xpBudget);

  if (validCandidates.length === 0) {
      // If even the weakest monster is too strong, just give one of the weakest.
      const sortedByWeakest = [...candidates].sort((a, b) => getXp(a) - getXp(b));
      const weakest = sortedByWeakest[0];
      if (weakest) {
         return [{
             name: weakest.name,
             quantity: 1,
             cr: weakest.baseStats.cr,
             description: `A lone ${weakest.name} approaches.`
         }];
      }
      return [];
  }

  // 3. Fill the budget with randomized selection
  // Shuffle candidates to ensure variety
  const shuffledCandidates = shuffleWithRandom([...validCandidates], rng);
  
  let monsterCount = 0;
  const targetXp = xpBudget;
  
  // Attempt to fill budget by picking random valid monsters
  // We'll try several passes or just pick until we can't fit anything else
  let attempts = 0;
  const MAX_ATTEMPTS = 20;

  while (currentXp < targetXp && monsterCount < MAX_ENCOUNTER_MONSTER_COUNT && attempts < MAX_ATTEMPTS) {
    attempts++;
    const remainingBudget = targetXp - currentXp;
    
    // Filter candidates that still fit
    const affordable = shuffledCandidates.filter(m => getXp(m) <= remainingBudget);
    
    if (affordable.length === 0) break;

    // Pick a random affordable monster
    const nextMonster = pickRandom(affordable, rng);
    if (!nextMonster) break;
    const xp = getXp(nextMonster);

    // Check if we already have this monster in the list
    const existingEntry = encounter.find(e => e.name === nextMonster.name);
    if (existingEntry) {
      // Limit quantity of a single type to 4 to encourage variety
      if (existingEntry.quantity < 4) {
        existingEntry.quantity += 1;
        currentXp += xp;
        monsterCount++;
      }
    } else {
      encounter.push({
        name: nextMonster.name,
        quantity: 1,
        cr: nextMonster.baseStats.cr,
        description: `A group of ${nextMonster.name}s.` // Simple description
      });
      currentXp += xp;
      monsterCount++;
    }
  }

  // If we didn't add anything (e.g. budget too small for any monster), force one weak monster
  if (encounter.length === 0 && validCandidates.length > 0) {
       const sortedByWeakest = [...validCandidates].sort((a, b) => getXp(a) - getXp(b));
       const weakest = sortedByWeakest[0];
       encounter.push({
          name: weakest.name,
          quantity: 1,
          cr: weakest.baseStats.cr,
          description: `A lone ${weakest.name} appears.`
       });
  }

  return encounter;
}
