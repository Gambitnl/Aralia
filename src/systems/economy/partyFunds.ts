/**
 * Counts and pays with the party's existing liquid money and carried currency.
 * Merchant and service owners call this before granting a good or permission.
 * No balance is credited on load: unspent source coins remain the same records.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 19:49:57
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx, components/Trade/MerchantModal.tsx, hooks/actions/handleMerchantInteraction.ts, state/reducers/merchantTransactions.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Item } from '../../types';
import { CURRENCY_COPPER_VALUES, isCurrencyItemId } from '../../utils/character/coinPurseUtils';

type Funds = { gold: number; inventory?: readonly Item[] };

function copper(value: number): number | null {
  const rounded = Math.round(value * 100);
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(rounded) ? rounded : null;
}

function coinQuantity(item: Item): number {
  const quantity = item.quantity ?? 1;
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
}

function totalCopper(funds: Funds): number | null {
  let total = copper(funds.gold);
  if (total === null) return null;
  for (const item of funds.inventory ?? []) {
    if (isCurrencyItemId(item.id)) total += CURRENCY_COPPER_VALUES[item.id] * coinQuantity(item);
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

/** The same spendable face value for sheets, quotes and transaction admission. */
export function getPartyFundsGp(funds: Funds): number {
  return (totalCopper(funds) ?? 0) / 100;
}

/** Pure payment proposal: the owner commits it with delivery in one reducer update.
 * Spend liquid funds first, then smaller denominations in stable inventory order.
 * Break only needed coins; ordinary change returns to the existing liquid purse.
 * A partial stack retains every source/container field and untouched rows retain
 * their references. Invalid/insufficient requests return null without mutation. */
export function payPartyFunds(funds: Funds, costGp: number): { gold: number; inventory: Item[] } | null {
  const cost = copper(costGp), available = totalCopper(funds), liquid = copper(funds.gold);
  if (cost === null || available === null || liquid === null || available < cost) return null;
  const inventory = funds.inventory ?? [];
  let remaining = Math.max(0, cost - liquid);
  let change = Math.max(0, liquid - cost);
  const spent = new Map<number, number>();
  const coins = inventory.flatMap((item, index) => isCurrencyItemId(item.id)
    ? [{ index, quantity: coinQuantity(item), value: CURRENCY_COPPER_VALUES[item.id] }] : [])
    .sort((a, b) => a.value - b.value || a.index - b.index);
  for (const coin of coins) {
    if (remaining <= 0) break;
    const count = Math.min(coin.quantity, Math.ceil(remaining / coin.value));
    if (!count) continue;
    spent.set(coin.index, count);
    remaining -= count * coin.value;
  }
  if (remaining > 0) return null;
  change -= remaining;
  return {
    gold: change / 100,
    inventory: inventory.flatMap((item, index) => {
      const count = spent.get(index);
      if (!count) return [item];
      const quantity = coinQuantity(item) - count;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }),
  };
}
