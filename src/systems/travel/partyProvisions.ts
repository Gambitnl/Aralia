/** Personal road supplies remain owned by the people carrying them. The map
 * quotes the actual traveling party's pool; spending preserves every unused
 * stack attribute and never touches an absent companion's belongings. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 17:15:11
 * Dependents: components/layout/GameModals.tsx, hooks/app/useAppTravelActions.ts, state/reducers/companionReducer.ts
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
import { RATIONS_ITEM_ID, WATER_ITEM_ID, resourceDays } from './provisioning';
import {containedWaterDays,consumeProvision} from './containedWater';
const validQuantity = (item: Item) => Number.isFinite(item.quantity ?? 1) && (item.quantity ?? 1) > 0;
const isSupply = (item: Item) => item.id === RATIONS_ITEM_ID || item.id === WATER_ITEM_ID || item.containedWater!==undefined;
function personalOwners(state: GameState) {
  return Object.values(state.companions).filter(c => c.inParty && state.party.some(person => person.id === c.id));
}
export function hasPersonalPartyProvisions(state: GameState): boolean {
  return personalOwners(state).some(c => c.inventory?.some(item => validQuantity(item)&&(item.id===RATIONS_ITEM_ID||item.id===WATER_ITEM_ID||containedWaterDays(item)>0)));
}
export function partyProvisionInventory(state: GameState): Item[] {
  const personal = personalOwners(state).flatMap(c => (c.inventory ?? []).filter(item => isSupply(item) && validQuantity(item)));
  return personal.length ? [...state.inventory.filter(item => !isSupply(item) || validQuantity(item)), ...personal] : state.inventory;
}

/** Whole-quote reservation: both resources must exist before either is spent.
 * Each owner uses their own proportional share first; shared stocks cover a
 * shortfall, followed by consenting party stocks. Fractional ration-days retain
 * the existing resource-day meaning instead of destroying an entire stack. */
export function spendPartyProvisions(state: GameState, rations: number, water: number): Partial<GameState> | null {
  if (![rations, water].every(n => Number.isFinite(n) && n >= 0)) return null;
  const owners = [{ id: null as string | null, inventory: state.inventory }, ...personalOwners(state).map(c => ({ id: c.id, inventory: c.inventory ?? [] }))];
  const next = owners.map(owner => owner.inventory);
  const available = (items: Item[], id: string) => resourceDays(items.filter(validQuantity),id);
  for (const [id, wanted] of [[RATIONS_ITEM_ID, rations], [WATER_ITEM_ID, water]] as const) {
    if (owners.reduce((sum, owner) => sum + available(owner.inventory, id), 0) + 1e-9 < wanted) return null;
    const allocation = owners.map(owner => Math.min(available(owner.inventory, id), wanted / Math.max(1, state.party.length)));
    let remaining = Math.max(0, wanted - allocation.reduce((sum, n) => sum + n, 0));
    for (let index = 0; index < owners.length && remaining > 1e-9; index++) {
      const extra = Math.min(remaining, available(owners[index].inventory, id) - allocation[index]);
      allocation[index] += extra; remaining -= extra;
    }
    next.forEach((items, index) => {
      let spend = allocation[index]; if (spend <= 0) return;
      // Drain contained water through the same allocator as ordinary travel;
      // the vessel and its provenance remain after its water is spent.
      next[index] = consumeProvision(items,id,spend).inventory;
    });
  }
  let companions = state.companions;
  owners.forEach((owner, index) => { if (owner.id && next[index] !== owner.inventory) companions = { ...companions, [owner.id]: { ...companions[owner.id], inventory: next[index] } }; });
  return { inventory: next[0], companions };
}
