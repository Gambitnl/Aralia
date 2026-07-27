/**
 * @file src/hooks/actions/handleMerchantInteraction.ts
 * Handles interactions with dynamic merchants and shops.
 */
import React from 'react';
import { GameState, Action } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import type { RichNPC } from '../../types/world';
import type { Item } from '../../types';
import type { WorldBusiness } from '../../types/business';
/**
 * Ensure a resolved business has owned stock, lazily backfilling it for
 * businesses persisted in saves that predate the stock field. The backfill is
 * deterministic per (worldSeed, business.id) — see stockSeedForBusiness — so
 * every browse/save/reload of the same shop reproduces the same shelves. When a
 * backfill happens, the updated business is persisted via REGISTER_WORLD_BUSINESS
 * (a full-record upsert, reusing the existing action) and the patched copy is
 * returned for immediate use in this browse.
 */
export declare function ensureBusinessStock(business: WorldBusiness, worldSeed: number, dispatch: React.Dispatch<AppAction>): WorldBusiness;
/**
 * Build a merchant inventory from a business's persisted, owned stock.
 *
 * Each stock line becomes a catalog Item priced through the shared economy
 * engine (calculatePrice) × the business's own priceMultiplier — see
 * priceStockItem. The per-unit price is stamped onto `costInGp`/`cost` so the
 * downstream MerchantModal and calculatePrice display it consistently, and the
 * on-shelf quantity is carried on `quantity`. Lines whose item id is unknown or
 * whose quantity is zero are dropped.
 */
export declare function buildInventoryFromStock(business: WorldBusiness, economy: GameState['economy'] | undefined, regionId?: string): Item[];
/**
 * Tavern/inn merchant types are the surface where a patron can be hired into the
 * party. Merchant types arrive in several shapes — `shop_tavern` (VillageScene),
 * the display name `Tavern`, or a raw worldforge building type (`tavern`, `inn`).
 * We match case-insensitively on the substring so all of those route to the hire
 * affordance without enumerating every producer's naming convention.
 */
export declare function isTavernOrInnMerchant(merchantType: string): boolean;
/**
 * Offer to hire the tavern/innkeeper-generated NPC into the party.
 *
 * Reuses the shared recruitment pipeline built for every join surface:
 *   1. {@link evaluateRecruitOffer} (P5) — disposition-gated consent verdict.
 *   2. On a yes, {@link npcToPartyMember} (P4) converts the world NPC into the
 *      paired `{ character, companion }` and we dispatch `RECRUIT_COMPANION`
 *      (P3) with `source: 'tavern'` so both stores are written under one id.
 *   3. On a no, we surface the in-fiction decline in the merchant's voice,
 *      matching the existing "I don't haggle" decline style.
 *
 * This is additive: it never blocks or alters the browse/barter flow that runs
 * after it.
 */
export declare function offerTavernHire(npc: RichNPC, gameState: GameState, dispatch: React.Dispatch<AppAction>, addMessage: AddMessageFn): void;
/**
 * Validates a merchant transaction (buy/sell) before dispatching to the reducer.
 * Ensures the player has enough gold for purchases and the item exists for sales.
 *
 * @param type 'buy' or 'sell'
 * @param payload The transaction payload containing item and cost/value
 * @param gameState Current game state for gold and inventory checks
 * @returns { valid: boolean; error?: string }
 */
export declare function validateMerchantTransaction(type: 'buy' | 'sell', payload: {
    item?: any;
    cost?: number;
    itemId?: string;
    value?: number;
}, gameState: GameState): {
    valid: boolean;
    error?: string;
};
interface HandleMerchantInteractionProps {
    action: Action;
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    generalActionContext: string;
}
export declare function handleOpenDynamicMerchant({ action, gameState, dispatch, addMessage, addGeminiLog, generalActionContext, }: HandleMerchantInteractionProps): Promise<void>;
export declare function handleMerchantAction({ action, gameState, dispatch, addMessage, }: HandleMerchantInteractionProps): Promise<void>;
export {};
