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
import type { NPCGenerationConfig } from '../../../services/npcGenerator';
import { generateNPC } from '../../../services/npcGenerator';
import { generateNpcBusiness, generateBusinessName } from '../../economy/NpcBusinessManager';
import { SeededRandom } from '../../../utils/random/seededRandom';
import { makeCellLocationId } from '../../../utils/location/cellLocationId';
import { getBridgeAtlas, getBurgCultureType, getBurgNamer } from '../bridge/legacySubmapBridge';
import { styleFamilyForCultureType } from '../town/architectureStyle';
import { getCanonicalTownPlan, townSpanFtForBurg, transformTownPlan, CANON_TOWN_SPAN } from '../town/canonicalTown';
import { toArtifactPlan } from '../town/townPlanAdapter';

/** Same plot→business-type mapping the 3D bake uses (keeps stock coherent per role). */
export function businessTypeForTownPlot(role: string, plotId: number): BusinessType {
  const types: BusinessType[] = role === 'market'
    ? ['general_store', 'tavern', 'apothecary', 'trading_company', 'enchanter_shop']
    : ['smithy', 'mine', 'farm', 'trading_company'];
  const index = Math.abs(Math.imul(plotId + 17, 2654435761) >>> 8) % types.length;
  return types[index];
}

/** The plot-keyed npc/business id scheme shared with `World3DWrapper`. */
export const townMerchantNpcId = (burgId: number, plotId: number) => `npc_burg_${burgId}_plot_${plotId}`;
export const townMerchantBizId = (burgId: number, plotId: number) => `biz_burg_${burgId}_plot_${plotId}`;

export interface BurgMerchants {
  npcs: RichNPC[];
  businesses: WorldBusiness[];
}

/**
 * Compute (do not dispatch) the merchant NPCs + businesses for a burg's market
 * and workshop plots, skipping any already present in state. Pure/deterministic.
 */
export function computeBurgMerchants(
  worldSeed: number,
  burgId: number,
  gameDay: number,
  existingNpcs: Record<string, RichNPC> | undefined,
  existingBusinesses: Record<string, WorldBusiness> | undefined,
): BurgMerchants {
  const atlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, burgId);
  // Match the 3D bake's plot ids: same canonical plan, same burg-determined scale
  // (translation is irrelevant to the sub-tile plot filter, so dx/dy = 0).
  const placeScale = townSpanFtForBurg(atlas, burgId) / CANON_TOWN_SPAN;
  const feetPlan = transformTownPlan(enginePlan, placeScale, 0, 0);
  const family = styleFamilyForCultureType(getBurgCultureType(worldSeed, burgId));
  const adapted = toArtifactPlan(feetPlan, burgId, family);
  const nameFor = getBurgNamer(worldSeed, burgId);
  const bizCell = (atlas.pack.burgs?.[burgId] as { cell?: number } | undefined)?.cell ?? 0;

  const npcs: RichNPC[] = [];
  const businesses: WorldBusiness[] = [];

  for (const plot of adapted.plan.plots) {
    if (plot.role !== 'market' && plot.role !== 'workshop') continue;
    const npcId = townMerchantNpcId(burgId, plot.id);
    const bizId = townMerchantBizId(burgId, plot.id);
    if (existingNpcs?.[npcId] && existingBusinesses?.[bizId]) continue;

    const rng = new SeededRandom(worldSeed + burgId + plot.id);
    const bizType = businessTypeForTownPlot(plot.role, plot.id);
    const bizName = generateBusinessName(bizType, rng);

    const npcConfig: NPCGenerationConfig = {
      id: npcId,
      name: nameFor(rng),
      role: 'merchant',
      occupation: plot.role === 'market' ? 'shopkeeper' : 'artisan',
      level: 3,
    };
    const richNpc = generateNPC(npcConfig);
    richNpc.businessId = bizId;

    const worldBiz = generateNpcBusiness(richNpc, makeCellLocationId(bizCell), bizType, gameDay, rng);
    worldBiz.id = bizId;
    worldBiz.name = bizName;
    worldBiz.ownerId = npcId;
    (worldBiz as { burgId?: number }).burgId = burgId;
    (worldBiz as { plotId?: number }).plotId = plot.id;

    if (!existingNpcs?.[npcId]) npcs.push(richNpc);
    if (!existingBusinesses?.[bizId]) businesses.push(worldBiz);
  }

  return { npcs, businesses };
}
