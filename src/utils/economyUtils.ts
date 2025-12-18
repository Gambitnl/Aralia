/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/economyUtils.ts
 * Utility functions for the dynamic economy system.
 */

import { Item, EconomyState } from '../types';

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

    const ep = cleanCost.match(/(\d+(?:\.\d+)?)\s*EP/i);
    if (ep) return parseFloat(ep[1]) * 0.5;

    const sp = cleanCost.match(/(\d+(?:\.\d+)?)\s*SP/i);
    if (sp) return parseFloat(sp[1]) * 0.1;

    const cp = cleanCost.match(/(\d+(?:\.\d+)?)\s*CP/i);
    if (cp) return parseFloat(cp[1]) * 0.01;

    return 0;
};

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
 * @returns Detailed calculation result including final price and modifiers.
 */
export const calculatePrice = (
  item: Item,
  economy: EconomyState | undefined,
  transactionType: 'buy' | 'sell'
): PriceCalculationResult => {
  // Use explicit value if present, else parse string cost
  let baseValue = item.value;
  if ((baseValue === undefined || baseValue === 0) && item.cost) {
      baseValue = parseCost(item.cost);
  }

  if (!baseValue || baseValue <= 0) {
      return { finalPrice: 0, basePrice: 0, multiplier: 1, isModified: false };
  }

  // Default multipliers if economy is missing (fallback/legacy)
  if (!economy) {
      const multiplier = transactionType === 'buy' ? 1.0 : 0.5;
      const finalPrice = transactionType === 'buy'
          ? Math.ceil(baseValue)
          : Math.floor(baseValue * 0.5);

      return {
          finalPrice: Math.max(0, finalPrice),
          basePrice: baseValue,
          multiplier,
          isModified: false
      };
  }

  let multiplier = transactionType === 'buy' ? economy.buyMultiplier : economy.sellMultiplier;

  // Apply market factors
  const itemTags = [item.type, ...(item.name.toLowerCase().split(' '))];

  // Scarcity increases price (Demand > Supply)
  const isScarce = economy.marketFactors.scarcity.some(tag =>
      itemTags.some(it => it.includes(tag.toLowerCase()))
  );

  // Surplus decreases price (Supply > Demand)
  const isSurplus = economy.marketFactors.surplus.some(tag =>
      itemTags.some(it => it.includes(tag.toLowerCase()))
  );

  // Logic from MerchantModal:
  if (transactionType === 'buy') {
      if (isScarce) multiplier += 0.5; // Expensive
      if (isSurplus) multiplier -= 0.3; // Cheap
  } else {
      if (isScarce) multiplier += 0.3; // They pay more
      if (isSurplus) multiplier -= 0.2; // They pay less
  }

  // Clamp multiplier
  multiplier = Math.max(0.1, multiplier);

  const finalPrice = Math.floor(baseValue * multiplier);

  const standardMultiplier = transactionType === 'buy' ? 1.0 : 0.5;
  // Consider modified if significantly different from standard
  const isModified = Math.abs(multiplier - standardMultiplier) > 0.05;

  return {
      finalPrice: Math.max(0, finalPrice),
      basePrice: baseValue,
      multiplier,
      isModified
  };
};
