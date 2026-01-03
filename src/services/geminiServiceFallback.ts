
import { Monster } from '../types';
import type { MonsterData } from '../types/ui';
import { MONSTERS_DATA, XP_BY_CR } from '../constants';
import { logger } from '../utils/logger';

/**
 * Generates a fallback encounter when the AI service is unavailable or fails.
 * It attempts to select monsters from the static data that fit the XP budget.
 *
 * @param xpBudget The target XP budget for the encounter.
 * @param themeTags Tags to filter monsters by (e.g., 'forest', 'goblinoid').
 * @returns An array of Monster objects.
 */
export function getFallbackEncounter(xpBudget: number, themeTags: string[]): Monster[] {
  const encounter: Monster[] = [];
  let currentXp = 0;

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
  const getXp = (m: MonsterData) => XP_BY_CR[(m?.baseStats as any)?.cr as keyof typeof XP_BY_CR] || 0;

  // Sort by XP descending, but filter out monsters that are too strong (XP > budget)
  const validCandidates = candidates
    .filter(m => getXp(m) <= xpBudget)
    .sort((a, b) => getXp(b) - getXp(a));

  if (validCandidates.length === 0) {
      // If even the weakest monster is too strong, just give one of the weakest.
      const weakest = candidates.sort((a, b) => getXp(a) - getXp(b))[0];
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

  // 3. Fill the budget
  // Simple greedy approach: take the strongest monster that fits, then repeat.
  // Limit to max 6 monsters to avoid swarms of tiny things.
  let monsterCount = 0;
  const MAX_MONSTERS = 6;

  while (currentXp < xpBudget && monsterCount < MAX_MONSTERS) {
    const remainingBudget = xpBudget - currentXp;

    // Find the strongest monster that fits in remaining budget
    const nextMonster = validCandidates.find(m => getXp(m) <= remainingBudget);

    if (nextMonster) {
      const xp = getXp(nextMonster);

      // Check if we already have this monster in the list
      const existingEntry = encounter.find(e => e.name === nextMonster.name);
      if (existingEntry) {
        existingEntry.quantity += 1;
      } else {
        encounter.push({
          name: nextMonster.name,
          quantity: 1,
          cr: nextMonster.baseStats.cr,
          description: `A group of ${nextMonster.name}s.` // Simple description
        });
      }
      currentXp += xp;
      monsterCount++;
    } else {
      // No monster fits the remaining budget
      break;
    }
  }

  // If we didn't add anything (e.g. budget too small for any monster), force one weak monster
  if (encounter.length === 0 && validCandidates.length > 0) {
       const weakest = validCandidates[validCandidates.length - 1]; // Sorted desc, so last is weakest
       encounter.push({
          name: weakest.name,
          quantity: 1,
          cr: weakest.baseStats.cr,
          description: `A lone ${weakest.name} appears.`
       });
  }

  return encounter;
}
