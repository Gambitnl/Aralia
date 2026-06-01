
import { Monster } from '../types';
import type { MonsterData } from '../types/ui';
import { XP_BY_CR } from '../constants';
import { MONSTERS_DATA } from '../data/monsters';
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
  const shuffledCandidates = [...validCandidates].sort(() => Math.random() - 0.5);
  
  let monsterCount = 0;
  const MAX_MONSTERS = 6;
  const targetXp = xpBudget;
  
  // Attempt to fill budget by picking random valid monsters
  // We'll try several passes or just pick until we can't fit anything else
  let attempts = 0;
  const MAX_ATTEMPTS = 20;

  while (currentXp < targetXp && monsterCount < MAX_MONSTERS && attempts < MAX_ATTEMPTS) {
    attempts++;
    const remainingBudget = targetXp - currentXp;
    
    // Filter candidates that still fit
    const affordable = shuffledCandidates.filter(m => getXp(m) <= remainingBudget);
    
    if (affordable.length === 0) break;

    // Pick a random affordable monster
    const nextMonster = affordable[Math.floor(Math.random() * affordable.length)];
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
