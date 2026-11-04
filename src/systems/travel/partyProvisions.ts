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
 * shortfall. Membership does not authorize another person's private surplus;
 * a remembered agreement may authorize a bounded amount on one return.
 * Fractional ration-days retain
 * the existing resource-day meaning instead of destroying an entire stack. */
export function spendPartyProvisions(state: GameState, rations: number, water: number, destinationCellId?: number): Partial<GameState> | null {
  if (![rations, water].every(n => Number.isFinite(n) && n >= 0)) return null;
  const owners = [{ id: null as string | null, inventory: state.inventory }, ...personalOwners(state).map(c => ({ id: c.id, inventory: c.inventory ?? [] }))];
  const next = owners.map(owner => owner.inventory);
  const permits = owners.map(owner => {
    const c = owner.id ? state.companions[owner.id] : undefined, consent = c?.travelAgreement?.returnWater, leg = c?.journey;
    if (!c || !consent || consent.response !== 'accepted' || !Number.isFinite(consent.amount) || consent.amount <= 0
      || (c.relationships.player?.approval ?? 0) < 0 || c.travelAgreement?.worldSeed !== state.worldSeed
      || !Number.isFinite(consent.respondedAt) || consent.destinationCellId !== destinationCellId || !leg || leg.worldSeed !== state.worldSeed) return 0;
    // The caller checks departure before movement; settlement uses the same
    // consent after MOVE_PLAYER has recorded the actual return leg.
    const departure = state.currentLocationId === consent.fromLocationId && leg.id === consent.journeyId;
    const settlement = leg.from.locationId === consent.fromLocationId && leg.intendedCellId === destinationCellId
      && state.currentLocationId === leg.to.locationId && Number.isFinite(consent.respondedAt)
      && leg.departedAt >= consent.respondedAt!;
    return departure || settlement ? consent.amount : 0;
  });
  const available = (items: Item[], id: string) => resourceDays(items.filter(validQuantity),id);
  for (const [id, wanted] of [[RATIONS_ITEM_ID, rations], [WATER_ITEM_ID, water]] as const) {
    if (owners.reduce((sum, owner) => sum + available(owner.inventory, id), 0) + 1e-9 < wanted) return null;
    const allocation = owners.map(owner => Math.min(available(owner.inventory, id), wanted / Math.max(1, state.party.length)));
    let remaining = Math.max(0, wanted - allocation.reduce((sum, n) => sum + n, 0));
    const extra = Math.min(remaining, available(owners[0].inventory, id) - allocation[0]);
    allocation[0] += extra; remaining -= extra;
    if (id === WATER_ITEM_ID) {
      for (let index = 1; index < owners.length && remaining > 1e-9; index++) {
        const shared = Math.min(remaining, permits[index], available(owners[index].inventory, id) - allocation[index]);
        allocation[index] += shared; remaining -= shared;
      }
    }
    if (remaining > 1e-9) return null;
    next.forEach((items, index) => {
      let spend = allocation[index]; if (spend <= 0) return;
      // Drain contained water through the same allocator as ordinary travel;
      // the vessel and its provenance remain after its water is spent.
      next[index] = consumeProvision(items,id,spend).inventory;
    });
  }
  let companions = state.companions;
  owners.forEach((owner, index) => {
    if (!owner.id) return;
    const c = companions[owner.id], consent = c.travelAgreement?.returnWater;
    if (next[index] !== owner.inventory || permits[index] > 0) companions = { ...companions, [owner.id]: { ...c, inventory: next[index],
      ...(permits[index] > 0 && consent ? {travelAgreement:{...c.travelAgreement!,returnWater:{...consent,response:'used',usedAt:state.gameTime.getTime()}}} : {}) } };
  });
  return { inventory: next[0], companions };
}
