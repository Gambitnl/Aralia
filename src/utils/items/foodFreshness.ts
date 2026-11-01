/** Shared inventory and meal freshness rules; legacy unstamped food stays unknown. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 13:17:07
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx, systems/travel/partyMeal.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Item } from '../../types/items';
const SHELF_LIFE_UNIT_MS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

const parseShelfLifeToMs = (shelfLife?: string): number | null => {
  if (!shelfLife) return null;

  // Shelf life is authored as phrases like "3 days" or "1 week".
  // The first supported number+unit pair is enough for the current item data.
  const match = shelfLife.trim().toLowerCase().match(/(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/);
  if (!match) return null;

  const amount = Number(match[1]);
  const normalizedUnit = match[2].replace(/s$/, '');
  const unitMs = SHELF_LIFE_UNIT_MS[normalizedUnit];

  // If authored data drifts into an unsupported unit, keep the food usable
  // and visible instead of silently declaring it expired.
  if (!Number.isFinite(amount) || !unitMs) return null;

  return amount * unitMs;
};

export const getFoodExpirationState = (item: Item, now = Date.now()): { isExpired: boolean; label: string } => {
  if (!item.perishable) return { isExpired: false, label: '' };

  const shelfLifeMs = parseShelfLifeToMs(item.shelfLife);
  if (typeof item.acquiredAt !== 'number' || !shelfLifeMs) {
    return { isExpired: false, label: `Expires: ${item.shelfLife || 'Unknown'}` };
  }

  const expiresAt = item.acquiredAt + shelfLifeMs;
  if (now >= expiresAt) {
    return { isExpired: true, label: `Expired: ${item.shelfLife || 'Unknown'} shelf life elapsed` };
  }

  return { isExpired: false, label: `Expires: ${item.shelfLife || 'Unknown'}` };
};
