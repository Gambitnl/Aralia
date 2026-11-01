/** Water carried inside a vessel remains part of that owned item. Provision
 * consumption drains its contents and leaves the vessel, identity and history.
 * Loose legacy water-day stacks keep their existing meaning. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 17:15:11
 * Dependents: components/CharacterSheet/Spellbook/CastSpellControls.tsx, state/reducers/characterReducer.ts, systems/gameplay/containedWaterCasting.ts, systems/gameplay/restMeals.ts, systems/travel/partyProvisions.ts, systems/travel/provisionEncumbrance.ts, systems/travel/provisioning.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {Item} from '../../types/items';

// Create or Destroy Water's authored provisioning metadata maps ten gallons
// to five water-days. Keep that conversion explicit rather than granting a
// whole day merely because a four-pint skin is full.
export const GALLONS_PER_WATER_DAY = 2;
export const WATER_POUNDS_PER_GALLON = 8.34;

export function waterCapacityGallons(item:Item):number {
  const quantity=item.quantity??1;
  if (!Number.isSafeInteger(quantity)||quantity<1||(item.containedWater&&quantity!==1)) return 0;
  const knownLegacySkin=item.id==='waterskin'&&item.name==='Waterskin'&&!item.magicProperties&&!item.questHooks&&!item.requiresAttunement&&!item.readableContent;
  const capacity=item.waterCapacityGallons ?? (knownLegacySkin?0.5:0);
  return Number.isFinite(capacity)&&capacity>0?capacity:0;
}
export function containedWaterGallons(item:Item):number {
  const amount=item.containedWater?.gallons,capacity=waterCapacityGallons(item);
  return Number.isFinite(amount)&&amount!>=0&&amount!<=capacity?amount!:0;
}
export function containedWaterDays(item:Item):number {
  return containedWaterGallons(item)/GALLONS_PER_WATER_DAY;
}

/** One shared spending primitive serves rest, travel and direct resource debit.
 * It preserves every untouched item reference and never consumes a vessel as if
 * it were a disposable water-day stack. Insufficient stock spends only stock
 * actually present; callers that require a whole quote validate totals first. */
export function consumeProvision(items:Item[],id:string,amount:number):{inventory:Item[];spent:number} {
  if (!Number.isFinite(amount)||amount<=0) return {inventory:items,spent:0};
  let remaining=amount,changed=false;
  const inventory=items.flatMap(item=>{
    const quantity=item.quantity??1;
    if (remaining<=1e-9) return [item];
    if (item.id===id&&Number.isFinite(quantity)&&quantity>0) {
      const taken=Math.min(remaining,quantity);remaining-=taken;changed=true;
      return quantity-taken>1e-9?[{...item,quantity:quantity-taken}]:[];
    }
    if (id==='water-day'&&containedWaterDays(item)>0) {
      const taken=Math.min(remaining,containedWaterDays(item));remaining-=taken;changed=true;
      return [{...item,containedWater:{...item.containedWater!,gallons:Math.max(0,containedWaterGallons(item)-taken*GALLONS_PER_WATER_DAY)}}];
    }
    return [item];
  });
  return {inventory:changed?inventory:items,spent:amount-remaining};
}
