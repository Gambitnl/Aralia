/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:20:35
 * Dependents: components/ActionPane/index.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Action, Location, NPC, Item } from '../../types';
import type { BusinessType } from '../../types/business';
/**
 * Map a worldforge business type to the closest legacy merchant-type string the
 * MerchantModal chain understands. `handleOpenDynamicMerchant` treats merchantType
 * as a free label (it feeds the tavern-hire substring check and the deterministic
 * inventory generator), so the returned string must (a) carry "tavern"/"inn" for
 * drinking houses and (b) be a stable, type-appropriate shop key. Explicit map,
 * no silent fallback — an unmapped type routes to the general store on purpose.
 */
export declare function merchantTypeForBusiness(businessType: BusinessType): string;
interface UseActionGenerationProps {
    currentLocation: Location;
    npcsInLocation: NPC[];
    itemsInLocation: Item[];
}
export declare const useActionGeneration: ({ currentLocation, npcsInLocation, itemsInLocation, }: UseActionGenerationProps) => {
    generalActions: Action[];
};
export {};
