/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/economyService.ts
 * Service for handling dynamic economy calculations, price fluctuations, and market generation.
 */

import { Item, Location, EconomyState } from '../types';
import { WorldEvent, EconomyContext } from '../types/economy';

// Default Economy State
export const DEFAULT_ECONOMY_STATE: EconomyState = {
  marketFactors: {
    scarcity: [],
    surplus: []
  },
  buyMultiplier: 1.0,
  sellMultiplier: 0.5
};

/**
 * Calculates the dynamic price of an item based on location and active world events.
 */
export function calculateItemPrice(item: Item, context: EconomyContext): number {
  if (!item.costInGp) return 0;

  let multiplier = 1.0;
  const basePrice = item.costInGp;

  // 1. Location Modifiers (Biome/Type based)
  // Example: Mountains have cheaper ore/weapons, expensive food
  if (context.location.biomeId === 'mountains') {
    if (item.type === 'weapon' || item.type === 'armor') multiplier *= 0.8; // Cheaper
    if (item.type === 'food_drink') multiplier *= 1.5; // Expensive
  } else if (context.location.biomeId === 'forest') {
    if (item.type === 'potion' || item.type === 'crafting_material') multiplier *= 0.8;
  }

  // 2. Event Modifiers
  context.events.forEach(event => {
    // Check if location is affected
    const locationAffected = event.affectedLocations.includes(context.location.id) ||
                             event.affectedLocations.includes(context.location.biomeId);

    if (locationAffected) {
      // Check if item category matches
      // Use includes for flexibility
      const matchesCategory = event.affectedItemCategories.some(cat =>
          item.type === cat || (item.category && item.category.includes(cat))
      );

      if (matchesCategory) {
        multiplier *= event.priceModifier;
      }
    }
  });

  // 3. Merchant Type Modifiers
  if (context.merchantType) {
    // Future expansion
  }

  return Math.round(basePrice * multiplier);
}

/**
 * Generates a local economy state for a merchant or location.
 * This can be stored in the merchantModal state.
 */
export function generateLocalEconomy(location: Location, events: WorldEvent[]): EconomyState {
  const scarcity: string[] = [];
  const surplus: string[] = [];
  let buyMult = 1.0;

  // Basic Biome Logic
  if (location.biomeId === 'mountains') {
    surplus.push('weapon', 'armor');
    scarcity.push('food_drink');
  } else if (location.biomeId === 'forest') {
    surplus.push('potion', 'crafting_material');
  } else if (location.biomeId === 'desert') {
    scarcity.push('water', 'food_drink');
  }

  // Event Logic
  events.forEach(event => {
    const locationAffected = event.affectedLocations.includes(location.id) ||
                             event.affectedLocations.includes(location.biomeId);

    if (locationAffected) {
      if (event.priceModifier > 1) {
        // High prices -> Scarcity
        scarcity.push(...event.affectedItemCategories);
        buyMult *= 1.1; // General inflation
      } else {
        // Low prices -> Surplus
        surplus.push(...event.affectedItemCategories);
      }
    }
  });

  return {
    marketFactors: {
      scarcity: [...new Set(scarcity)],
      surplus: [...new Set(surplus)]
    },
    buyMultiplier: parseFloat(buyMult.toFixed(2)),
    sellMultiplier: 0.5 // Standard sell rate, could be dynamic too
  };
}

/**
 * Creates a new random world event.
 */
export function generateRandomWorldEvent(gameTime: number): WorldEvent {
  const eventTypes: Array<{type: any, name: string, items: string[], mod: number}> = [
    { type: 'WAR', name: 'Border Skirmish', items: ['weapon', 'armor', 'medicine'], mod: 1.5 },
    { type: 'FAMINE', name: 'Crop Blight', items: ['food_drink'], mod: 2.0 },
    { type: 'BOOM', name: 'Mining Boom', items: ['gem', 'jewelry'], mod: 0.7 }, // Cheaper due to supply
    { type: 'PLAGUE', name: 'Sweating Sickness', items: ['potion', 'herb'], mod: 1.8 }
  ];

  const template = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const biomes = ['forest', 'mountains', 'plains', 'desert', 'swamp'];
  const affectedBiome = biomes[Math.floor(Math.random() * biomes.length)];

  return {
    id: `evt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
    type: template.type,
    name: `${template.name} in ${affectedBiome}`,
    description: `A ${template.name.toLowerCase()} is affecting the ${affectedBiome}, impacting prices.`,
    affectedLocations: [affectedBiome],
    affectedItemCategories: template.items,
    priceModifier: template.mod,
    duration: 7, // 7 days default
    startTime: gameTime
  };
}
