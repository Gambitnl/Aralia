/** The town plan's fitted use determines both registration and ground labels.
 * Sharing the existing rule keeps an inn recognizable without changing its
 * saved keeper, stock, payment, plot identity or physical building. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 13:17:56
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/townsim/registerBurgMerchants.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BusinessType } from '../../../types/business';
import type { BuildingType } from '../interior/blueprintTypes';

/** New shops on either entry surface respect explicit fitted use; briefless towns keep the old draw. */
export function businessTypeForTownPlot(role: string, plotId: number, fittedType?: BuildingType): BusinessType {
  const types: BusinessType[] = role === 'market'
    ? ['general_store', 'tavern', 'apothecary', 'trading_company', 'enchanter_shop']
    : ['smithy', 'mine', 'farm', 'trading_company'];
  const index = Math.abs(Math.imul(plotId + 17, 2654435761) >>> 8) % types.length;
  const selected = types[index];
  // The canonical inn and forge already have rooms, furnishings and households.
  // A separate plot hash must not turn their new business into another trade.
  // Generic workshops/storehouses do not identify a specialty, so keep their draw.
  if (fittedType === 'inn' || fittedType === 'tavern') return 'tavern';
  if (fittedType === 'smithy') return 'smithy';
  if (fittedType === 'shop' && !['general_store', 'apothecary', 'trading_company', 'enchanter_shop'].includes(selected)) {
    return 'general_store';
  }
  return selected;
}

