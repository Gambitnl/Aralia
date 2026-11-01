/**
 * Settles one merchant purchase or sale against the latest game state.
 * Coin, carried quantities, live shelves and saved stock move together, so a
 * repeated click cannot buy an exhausted shelf or sell a whole provision stack.
 * characterReducer calls these helpers; the merchant handler supplies the quote.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:49:57
 * Dependents: state/reducers/characterReducer.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState, Item } from '../../types';
import type { AppAction } from '../actionTypes';
import { ALL_ITEMS } from '../../data/items';
import { priceStockItem } from '../../data/economy/businessStock';
import { payPartyFunds } from '../../systems/economy/partyFunds';
import { isCurrencyItemId } from '../../utils/character/coinPurseUtils';

function activeBusiness(state: GameState) {
  const merchantId = state.merchantModal?.merchantId;
  if (!merchantId) return undefined;
  const businessId = state.generatedNpcs?.[merchantId]?.businessId;
  return (businessId ? state.worldBusinesses?.[businessId] : undefined)
    ?? Object.values(state.worldBusinesses ?? {}).find(b => b.ownerId === merchantId);
}

export function applyMerchantPurchase(
  state: GameState,
  { item, cost }: Extract<AppAction, { type: 'BUY_ITEM' }>['payload'],
  stampAcquired: (item: Item) => Item,
): Partial<GameState> {
  // Currency pays at face value; it is never discounted shop merchandise.
  if (isCurrencyItemId(item.id)) return {};
  const payment = payPartyFunds(state, cost);
  if (!payment) return {};
  const business = activeBusiness(state);
  const isService = item.type === 'service';
  // A paid rumor receipt is remembered knowledge, not repeatable consumable stock.
  if (isService && item.id.startsWith('rumor_') && item.sourceId
    && state.inventory.some(owned => owned.type === 'service' && owned.sourceId === item.sourceId)) return {};
  const line = business?.stock?.find(stock => stock.itemId === item.id);
  const shelves = state.merchantModal?.merchantInventory ?? [];
  const shelfIndex = shelves.findIndex(stock => stock.id === item.id);
  // A registered store can sell only its current physical stock. Service
  // delivery (such as a bought rumor) retains its existing separate owner.
  if (!isService && business && (!line || line.quantity < 1)) return {};
  if (!isService && state.merchantModal?.isOpen && (shelfIndex < 0 || (shelves[shelfIndex].quantity ?? 1) < 1)) return {};
  const updatedShelves = shelves.flatMap((stock, index) => {
    if (index !== shelfIndex || isService) return [stock];
    const quantity = (stock.quantity ?? 1) - 1;
    return quantity > 0 ? [{ ...stock, quantity }] : [];
  });
  return {
    gold: payment.gold,
    inventory: [...payment.inventory, stampAcquired({ ...item, quantity: 1 })],
    merchantModal: state.merchantModal ? { ...state.merchantModal, merchantInventory: updatedShelves } : undefined,
    ...(!isService && business && line ? { worldBusinesses: {
      ...state.worldBusinesses,
      [business.id]: { ...business, stock: business.stock!.map(stock => stock === line ? { ...stock, quantity: stock.quantity - 1 } : stock) },
    } } : {}),
  };
}

export function applyMerchantSale(
  state: GameState,
  { itemId, value, inventoryIndex, inventoryItem }: Extract<AppAction, { type: 'SELL_ITEM' }>['payload'],
): Partial<GameState> {
  if (isCurrencyItemId(itemId) || !Number.isFinite(value) || value < 0 || !Number.isFinite(state.gold)) return {};
  const index = inventoryIndex ?? state.inventory.findIndex(item => item.id === itemId);
  if (!Number.isInteger(index) || index < 0 || state.inventory[index]?.id !== itemId) return {};
  const item = state.inventory[index];
  // Selling this receipt would make the same learned account purchasable again.
  if (item.type === 'service' && item.id.startsWith('rumor_')) return {};
  // The optional reference travels unchanged from the clicked row. If another
  // sale shifted that row, reject the old click even when both items share an id.
  if (inventoryItem && inventoryItem !== item) return {};
  if ((item.quantity ?? 1) < 1) return {};
  const inventory = state.inventory.flatMap((entry, entryIndex) => {
    if (entryIndex !== index) return [entry];
    return (entry.quantity ?? 1) > 1 ? [{ ...entry, quantity: entry.quantity! - 1 }] : [];
  });
  const business = activeBusiness(state);
  const line = business?.stock?.find(stock => stock.itemId === itemId);
  // A shop retains a catalog good it buys even if it did not carry that model
  // before. Keep its normal markup; the seller's payout is not its retail price.
  // Custom items outside the catalog still need instance-aware stock storage;
  // do not silently replace their source identity with another catalog item.
  const canStock = Boolean(business && (line || (ALL_ITEMS[itemId] && item.type !== 'service')));
  const retailPrice = canStock && business && ALL_ITEMS[itemId]
    ? priceStockItem(ALL_ITEMS[itemId], business.priceMultiplier, state.economy,
      (state as { currentRegionId?: string }).currentRegionId, line?.priceOverride,
      { factions: state.factions, standings: state.playerFactionStandings })
    : undefined;
  const shelves = state.merchantModal?.merchantInventory ?? [];
  const shelfIndex = shelves.findIndex(stock => stock.id === itemId);
  const restoredShelf = canStock ? (shelfIndex >= 0
    ? shelves.map((stock, i) => i === shelfIndex ? { ...stock, quantity: (stock.quantity ?? 1) + 1 } : stock)
    : [...shelves, { ...item, ...(retailPrice !== undefined ? { costInGp: retailPrice, cost: `${retailPrice} GP` } : {}), quantity: 1 }]) : shelves;
  return {
    inventory,
    gold: Math.round((state.gold + value) * 100) / 100,
    ...(business && canStock ? {
      worldBusinesses: { ...state.worldBusinesses, [business.id]: { ...business, stock: line
        ? business.stock!.map(stock => stock === line ? { ...stock, quantity: stock.quantity + 1 } : stock)
        : [...(business.stock ?? []), { itemId, quantity: 1 }] } },
      merchantModal: state.merchantModal ? { ...state.merchantModal, merchantInventory: restoredShelf } : undefined,
    } : {}),
  };
}
