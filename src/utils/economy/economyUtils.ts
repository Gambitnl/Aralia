/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/economy/economyUtils.ts
 * Utility functions for the dynamic economy system.
 */

import { Item, EconomyState, MarketEventType } from '../../types';
import { REGIONAL_ECONOMIES } from '../../data/economy/regions';

/**
 * Parses a cost string like "10 GP" into a gold value.
 */
export const parseCost = (costStr: string | undefined): number => {
  if (!costStr) return 0;

  // Remove commas
  const cleanCost = costStr.replace(/,/g, '');

  const pp = cleanCost.match(/(\d+(?:\.\d+)?)\s*PP/i);
  if (pp) return parseFloat(pp[1]) * 10;

  const gp = cleanCost.match(/(\d+(?:\.\d+)?)\s*GP/i);
  if (gp) return parseFloat(gp[1]);

  const sp = cleanCost.match(/(\d+(?:\.\d+)?)\s*SP/i);
  if (sp) return parseFloat(sp[1]) * 0.1;

  const cp = cleanCost.match(/(\d+(?:\.\d+)?)\s*CP/i);
  if (cp) return parseFloat(cp[1]) * 0.01;

  return 0;
};

/**
 * Aralia currently displays prices in "GP" (gold pieces), but many item sources
 * (Gemini + fallbacks) include CP/SP/EP prices. If we round to whole GP, cheap
 * items like torches/rations collapse to 0 and become impossible to buy (the
 * merchant UI intentionally blocks purchases with a 0 price).
 *
 * To keep the UI consistent while supporting low-value items, we round to the
 * nearest copper piece (1 CP = 0.01 GP) and apply transaction-friendly rounding:
 * - Buying: round UP to the nearest CP so items never become free.
 * - Selling: round DOWN to the nearest CP so we don't overpay due to rounding.
 */
const roundGpToCopperCeil = (gp: number): number => Math.ceil(gp * 100) / 100;
const roundGpToCopperFloor = (gp: number): number => Math.floor(gp * 100) / 100;

export interface PriceCalculationResult {
  finalPrice: number;
  basePrice: number;
  multiplier: number;
  isModified: boolean;
}

/**
 * Calculates the dynamic price of an item based on the current economy state.
 *
 * @param item The item to price.
 * @param economy The current global economy state.
 * @param transactionType 'buy' (player buying from merchant) or 'sell' (player selling to merchant).
 * @param regionId Optional region ID to apply local import/export modifiers.
 * @returns Detailed calculation result including final price and modifiers.
 */
export const calculatePrice = (
  item: Item,
  economy: EconomyState | undefined,
  transactionType: 'buy' | 'sell',
  regionId?: string
): PriceCalculationResult => {
  // Prefer numeric `costInGp` because it's unambiguous and already normalized.
  // Fall back to parsing the `cost` string (supports "cp/sp/ep/gp/pp").
  let baseValue = typeof item.costInGp === 'number' ? item.costInGp : 0;
  if (baseValue <= 0 && item.cost) {
    baseValue = parseCost(item.cost);
  }

  if (!baseValue || baseValue <= 0) {
    // Still allow selling for minimum 1cp even if item has no explicit value
    const minSellPrice = transactionType === 'sell' ? 0.01 : 0;
    return { finalPrice: minSellPrice, basePrice: 0, multiplier: 1, isModified: false };
  }

  // Default multipliers if economy is missing (fallback/legacy)
  if (!economy) {
    const multiplier = transactionType === 'buy' ? 1.0 : 0.5;
    const rawPrice = baseValue * multiplier;
    const finalPrice = transactionType === 'buy'
      ? roundGpToCopperCeil(rawPrice)
      : roundGpToCopperFloor(rawPrice);

    // Ensure minimum sell price of 1cp
    const minPrice = transactionType === 'sell' ? 0.01 : 0;

    return {
      finalPrice: Math.max(minPrice, finalPrice),
      basePrice: baseValue,
      multiplier,
      isModified: false
    };
  }

  let multiplier = transactionType === 'buy' ? economy.buyMultiplier : economy.sellMultiplier;

  // Apply market factors
  const itemTags = [item.type, ...(item.name.toLowerCase().split(' '))].map(t => t.toLowerCase());

  // 1. Check MarketEvents (Primary System)
  if (economy.marketEvents && economy.marketEvents.length > 0) {
    economy.marketEvents.forEach(event => {
      // Determine if event applies to this item
      // Note: MarketEvent doesn't have `affectedTags` in the type, so we parse `name` or look for matching logic
      // In TradeRouteManager, we stored tag in name like "Boom: Grain"
      // This is a bit weak, but better than nothing until we fully migrate tags into MarketEvent proper
      const applies = itemTags.some(tag => event.name?.toLowerCase().includes(tag));

      if (applies) {
        if (event.type === MarketEventType.SHORTAGE) {
          // Shortage = Higher Price
          // Buy: +Intensity, Sell: +Intensity * 0.5 (Merchants pay more for scarce items)
          const mod = event.intensity || 0.5;
          multiplier += transactionType === 'buy' ? mod : mod * 0.5;
        } else if (event.type === MarketEventType.SURPLUS) {
          // Surplus = Lower Price
          // Buy: -Intensity, Sell: -Intensity * 0.8 (Merchants pay way less for common items)
          const mod = event.intensity || 0.3;
          multiplier -= transactionType === 'buy' ? mod : mod * 0.8;
        }
      }
    });
  } else {
    // 2. Fallback to Legacy MarketFactors (If no events found)
    // Scarcity increases price (Demand > Supply)
    const isScarce = economy.marketFactors.scarcity.some(tag =>
      itemTags.some(it => it.includes(tag.toLowerCase()))
    );

    // Surplus decreases price (Supply > Demand)
    const isSurplus = economy.marketFactors.surplus.some(tag =>
      itemTags.some(it => it.includes(tag.toLowerCase()))
    );

    // Logic from MerchantModal (preserved):
    if (transactionType === 'buy') {
      if (isScarce) multiplier += 0.5; // Expensive
      if (isSurplus) multiplier -= 0.3; // Cheap
    } else {
      if (isScarce) multiplier += 0.3; // They pay more
      if (isSurplus) multiplier -= 0.2; // They pay less
    }
  }

  // Regional Modifiers
  if (regionId) {
    const region = REGIONAL_ECONOMIES[regionId];
    if (region) {
      // EXPORTS are locally abundant -> CHEAPER (Surplus logic)
      // Use substring matching so tags like "food" match item types like "food_drink".
      const isExport = region.exports.some(tag =>
        itemTags.some(it => it.includes(tag.toLowerCase()))
      );

      // IMPORTS are locally scarce -> EXPENSIVE (Scarcity logic)
      const isImport = region.imports.some(tag =>
        itemTags.some(it => it.includes(tag.toLowerCase()))
      );

      if (transactionType === 'buy') {
        if (isExport) multiplier -= 0.2; // Local goods are cheap
        if (isImport) multiplier += 0.2; // Imported goods are expensive
      } else {
        // Selling to merchant
        if (isExport) multiplier -= 0.1; // They have plenty, pay less
        if (isImport) multiplier += 0.1; // They need it, pay more
      }
    }
  }

  // Clamp multiplier
  multiplier = Math.max(0.1, multiplier);

  const rawPrice = baseValue * multiplier;
  const finalPrice = transactionType === 'buy'
    ? roundGpToCopperCeil(rawPrice)
    : roundGpToCopperFloor(rawPrice);

  const standardMultiplier = transactionType === 'buy' ? 1.0 : 0.5;
  // Consider modified if significantly different from standard
  const isModified = Math.abs(multiplier - standardMultiplier) > 0.05;

  // Ensure minimum sell price of 1cp (0.01 GP) so all items are sellable
  const minPrice = transactionType === 'sell' ? 0.01 : 0;

  return {
    finalPrice: Math.max(minPrice, finalPrice),
    basePrice: baseValue,
    multiplier,
    isModified
  };
};
