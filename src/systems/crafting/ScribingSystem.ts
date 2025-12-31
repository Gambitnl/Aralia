/**
 * @file src/systems/crafting/ScribingSystem.ts
 * Logic for scribing spell scrolls.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Knowledge is power.
 */

import { Crafter } from './craftingSystem';
import { CraftingResult } from './types';

// D&D 5e Standard Scribing Costs (XGE)
// Cantrip/Lvl1: 25 gp
// Lvl 2: 250 gp (simplified, usually 250 for lvl 2-3)
// Lvl 3: 500 gp
// Lvl 4: 2500 gp
// Lvl 5: 5000 gp
// For Aralia, we simplify to a "Gold Value" of ink required, or specific items.
// To avoid strict item dependencies on specific "rare ink", we will check for
// generic 'ink_fine' and 'parchment', and perhaps raw gold cost for the "materials".

export interface ScribingRequest {
  spellId: string;
  spellLevel: number;
  spellName: string;
}

export interface ScribingCost {
  timeMinutes: number;
  goldCost: number; // Value of ink/materials needed
}

export function getScribingCost(level: number): ScribingCost {
  if (level <= 1) return { timeMinutes: 8 * 60, goldCost: 25 }; // 1 day
  if (level <= 3) return { timeMinutes: 3 * 8 * 60, goldCost: 250 }; // 3 days
  if (level <= 5) return { timeMinutes: 4 * 7 * 8 * 60, goldCost: 2500 }; // 4 weeks
  return { timeMinutes: 8 * 7 * 8 * 60, goldCost: 5000 }; // 8 weeks+
}

/**
 * Validates if the crafter can scribe the spell.
 * Requires:
 * 1. Knowledge of the spell (checked by caller or passed in request validation).
 * 2. Proficiency in Arcana.
 * 3. Materials (Parchment + Ink/Gold).
 */
export function canScribe(crafter: Crafter, request: ScribingRequest): boolean {
  // Check materials
  const hasParchment = crafter.inventory.some(i => i.itemId === 'parchment' && i.quantity >= 1);
  if (!hasParchment) return false;

  // Check Ink/Gold (Assuming crafter has 'gold' item or 'ink' items)
  // For simplicity in this implementation, we assume the cost is deducted from 'gold'
  // or checks for 'ink_fine' items.
  // Let's implement a 'gold' check if it exists in inventory.
  const goldItem = crafter.inventory.find(i => i.itemId === 'gold' || i.itemId === 'currency_gold');
  const cost = getScribingCost(request.spellLevel);

  if (!goldItem || goldItem.quantity < cost.goldCost) {
    return false;
  }

  return true;
}

export function attemptScribe(crafter: Crafter, request: ScribingRequest): CraftingResult {
  const { spellId, spellLevel, spellName } = request;
  const cost = getScribingCost(spellLevel);

  // 1. Validate
  if (!canScribe(crafter, request)) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'Insufficient materials (Parchment + Gold for Ink).'
    };
  }

  // 2. Skill Check (Arcana)
  // DC = 10 + spell level
  const dc = 10 + spellLevel;
  const roll = crafter.rollSkill('Arcana');

  let success = false;
  let quality: 'poor' | 'standard' | 'superior' = 'standard';
  let message = '';
  const consumed: { itemId: string; quantity: number }[] = [];

  if (roll >= dc) {
    success = true;
    message = `Successfully scribed Scroll of ${spellName}.`;
    if (roll >= dc + 10) {
        quality = 'superior';
        message += ' The calligraphy is flawless.';
    }
  } else {
    success = false;
    quality = 'poor';
    message = `Failed to scribe ${spellName}. The ink blotted and the parchment is ruined.`;
  }

  // 3. Consume Materials
  // Always consume materials on attempt (success or fail) logic?
  // XGE: "If you fail, the spell is not scribed and the materials are lost."
  // So yes, consume materials.
  consumed.push({ itemId: 'parchment', quantity: 1 });
  consumed.push({ itemId: 'currency_gold', quantity: cost.goldCost });

  // 4. Output
  const outputs = success ? [{ itemId: `scroll_${spellId}`, quantity: 1 }] : [];

  return {
    success,
    quality,
    outputs,
    consumedMaterials: consumed,
    materialsLost: true, // Materials always consumed in scribing attempt
    message
  };
}
