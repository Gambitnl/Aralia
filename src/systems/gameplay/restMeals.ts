/** Rest meals preserve ownership: a companion's supplies feed that person.
 * Shared-only parties retain their existing whole-party, all-or-nothing meal.
 * A complete private meal remains possible when the shared pantry is empty. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 17:15:11
 * Dependents: components/ui/LongRestModal.tsx, state/reducers/characterReducer.ts, systems/companions/companionSiteRisk.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { Item } from '@/types/items';
import {resourceDays} from '../travel/provisioning';
import {consumeProvision} from '../travel/containedWater';

type MealState = Pick<GameState, 'party' | 'inventory' | 'companions'>;
const resources = ['rations', 'water-day'] as const;
const quantity = (item: Item) => Number.isFinite(item.quantity ?? 1) && (item.quantity ?? 1) > 0 ? item.quantity ?? 1 : 0;
const count = (items: Item[], id: string) => resourceDays(items.filter(item=>quantity(item)>0),id);
function consume(items: Item[], food: number, water: number): Item[] {
  if (!food && !water) return items;
  // Existing whole-meal allocation stays above this debit. The shared primitive
  // additionally drains a filled vessel without discarding its owned shell.
  return consumeProvision(consumeProvision(items,'rations',food).inventory,'water-day',water).inventory;
}

/** Pure preview and settlement share one allocation. No private surplus is
 * offered to another person, and an incomplete meal consumes neither resource.
 * Denied/downed members keep their private supplies; the legacy shared-only
 * branch preserves the existing pantry reservation behavior. */
export function planRestMeals(state: MealState, deniedIds: string[] = []) {
  const shared = state.inventory ?? [];
  const owners = state.party.map(person => state.companions?.[person.id])
    .filter(owner => owner?.inParty && owner.inventory?.some(item => resources.some(id => count([item],id)>0)));
  const fedIds: string[] = [];
  const privateMeals: Record<string, [number, number]> = {};
  let sharedFood = 0, sharedWater = 0;
  if (!owners.length) {
    if (state.party.length && resources.every(id => count(shared, id) >= state.party.length)) {
      fedIds.push(...state.party.map(person => person.id));
      sharedFood = sharedWater = state.party.length;
    }
  } else {
    const eligible = state.party.filter(person => person.hp > 0 && !deniedIds.includes(person.id));
    const own = (id: string) => owners.find(owner => owner.id === id)?.inventory ?? [];
    // Reserve each complete private meal before considering the shared pantry.
    for (const person of eligible) {
      if (resources.every(id => count(own(person.id), id) >= 1)) {
        fedIds.push(person.id);
        privateMeals[person.id] = [1, 1];
      }
    }
    const remaining = eligible.filter(person => !fedIds.includes(person.id));
    const needs = resources.map(id => remaining.reduce((sum, person) => sum + Math.max(0, 1 - count(own(person.id), id)), 0));
    // Keep shared stocks untouched unless every remaining member can eat.
    if (count(shared, 'rations') >= needs[0] && count(shared, 'water-day') >= needs[1]) {
      sharedFood = needs[0]; sharedWater = needs[1];
      for (const person of remaining) {
        fedIds.push(person.id);
        privateMeals[person.id] = resources.map(id => Math.min(1, count(own(person.id), id))) as [number, number];
      }
    }
  }
  let companions = state.companions;
  for (const [id, [food, water]] of Object.entries(privateMeals)) {
    if (!(food || water)) continue;
    const owner = companions[id];
    companions = { ...companions, [id]: { ...owner, inventory: consume(owner.inventory ?? [], food, water) } };
  }
  const inventory = consume(shared, sharedFood, sharedWater);
  const names = (ids: string[]) => ids.map(id => state.party.find(person => person.id === id)!.name).join(', ');
  const privateIds = Object.keys(privateMeals).filter(id => privateMeals[id].some(n => n > 0));
  const unfed = state.party.filter(person => !fedIds.includes(person.id)).map(person => person.id);
  const summary = [
    privateIds.length ? `${names(privateIds)} will use their own supplies for their own meal.` : '',
    // Distinguish the whole carried bag from the allocation for this meal.
    `Carried shared food / water: ${count(shared, 'rations')} / ${count(shared, 'water-day')} day(s).`,
    sharedFood || sharedWater ? `This meal uses ${sharedFood} ration(s) and ${sharedWater} water supply unit(s) from shared supplies.` : '',
    fedIds.length ? `Eating: ${names(fedIds)}.` : 'No complete meal is available; no supplies will be consumed.',
    unfed.length ? `Without a meal: ${names(unfed)}. Starving members cannot recover Hit Points.` : '',
  ].filter(Boolean).join(' ');
  return { fedIds, summary, inventory, companions, patch: {
    ...(inventory !== shared ? { inventory } : {}),
    ...(companions !== state.companions ? { companions } : {}),
  } };
}
