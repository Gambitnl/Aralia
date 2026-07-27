/**
 * @file registerBurgMerchants.ts — compute a burg's shop/tavern keepers + their
 * businesses from the CANONICAL town plan, so towns reached by 2D map travel are
 * populated with interactable merchants (not empty shells).
 *
 * IDENTITY: this MUST bind merchants to the SAME plot ids the 3D ground bake uses
 * (`World3DWrapper` → `canonicalArtifactTownForSite`), so a keeper registered on
 * 2D arrival is the SAME keeper the 3D town renders — Worldforge Option B,
 * "identical 2D/3D towns". The ids are `npc_burg_<burg>_plot_<plot>` /
 * `biz_burg_<burg>_plot_<plot>`, and the plot ids come from the same
 * `getCanonicalTownPlan` → `transformTownPlan` → `toArtifactPlan` pipeline the 3D
 * side uses. The transform's SCALE (which decides the sub-tile plot filter) is
 * burg-determined (`townSpanFtForBurg`), not envelope-dependent, so passing
 * dx/dy = 0 yields the identical plot ids. Callers register with the existing
 * `if (!already registered)` guard, so whichever view runs first wins and the two
 * never duplicate.
 */
import type { RichNPC } from '../../../types/world';
import type { WorldBusiness } from '../../../types/business';
import type { BusinessType } from '../../../types/business';
/** Same plot→business-type mapping the 3D bake uses (keeps stock coherent per role). */
export declare function businessTypeForTownPlot(role: string, plotId: number): BusinessType;
/** The plot-keyed npc/business id scheme shared with `World3DWrapper`. */
export declare const townMerchantNpcId: (burgId: number, plotId: number) => string;
export declare const townMerchantBizId: (burgId: number, plotId: number) => string;
export interface BurgMerchants {
    npcs: RichNPC[];
    businesses: WorldBusiness[];
}
/**
 * Compute (do not dispatch) the merchant NPCs + businesses for a burg's market
 * and workshop plots, skipping any already present in state. Pure/deterministic.
 */
export declare function computeBurgMerchants(worldSeed: number, burgId: number, gameDay: number, existingNpcs: Record<string, RichNPC> | undefined, existingBusinesses: Record<string, WorldBusiness> | undefined): BurgMerchants;
