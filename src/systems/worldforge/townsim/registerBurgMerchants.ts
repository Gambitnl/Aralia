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
 * dx/dy = 0 yields the identical plot ids. Both entry surfaces use this resolver.
 * Existing businesses stay intact; household facts can repair an old independent
 * keeper draw without changing ids, capabilities or stored meeting memory.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:47:46
 * Dependents: components/World3D/World3DWrapper.tsx, hooks/useTownMerchantRegistration.ts
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RichNPC } from '../../../types/world';
import type { WorldBusiness } from '../../../types/business';
import type { NPCGenerationConfig } from '../../../services/npcGenerator';
import { generateNPC } from '../../../services/npcGenerator';
import { generateNpcBusiness, generateBusinessName } from '../../economy/NpcBusinessManager';
import { SeededRandom } from '../../../utils/random/seededRandom';
import { makeCellLocationId } from '../../../utils/location/cellLocationId';
import { getBridgeAtlas, getBurgCultureType, getBurgNamer } from '../bridge/legacySubmapBridge';
import { styleFamilyForCultureType } from '../town/architectureStyle';
import { getCanonicalTownPlan, townSpanFtForBurg, transformTownPlan, CANON_TOWN_SPAN } from '../town/canonicalTown';
import { toArtifactPlan } from '../town/townPlanAdapter';
import { canonicalTownSeedPath } from '../town/canonicalTown';
import { generateTownRoster } from '../roster/generateTownRoster';
import { householdForPlot, householdPopulationForPlot, householdPopulationsForPlan, householdMemberIdentity } from '../town/householdBrief';
import { reconcileHouseholdNpc } from './householdNpc';
import type { TownLifeState, TownLifeVillager } from '../roster/agentLife';
import { shopKeeperAt, type ShopLifeView } from './shopLife';

import { businessTypeForTownPlot } from './townBusinessIdentity';
export { businessTypeForTownPlot } from './townBusinessIdentity';

/** The plot-keyed npc/business id scheme shared with `World3DWrapper`. */
export const townMerchantNpcId = (burgId: number, plotId: number) => `npc_burg_${burgId}_plot_${plotId}`;
export const townMerchantBizId = (burgId: number, plotId: number) => `biz_burg_${burgId}_plot_${plotId}`;

export interface BurgMerchants {
  npcs: RichNPC[];
  businesses: WorldBusiness[];
}

/** True when the sim keeper is the roster worker (same household key, or the
 * same name and home for a legacy record without a key). */
function isRosterWorker(keeper: TownLifeVillager, worker: { name: string; homePlotId: number; householdMemberId?: string } | undefined): boolean {
  if (!worker) return false;
  if (keeper.householdMemberId || worker.householdMemberId) return keeper.householdMemberId === worker.householdMemberId;
  return keeper.name === worker.name && keeper.homePlotId === worker.homePlotId;
}

/**
 * NPC lives (2026-11-02): a keeper born in the sim has no household brief, so
 * no household facts exist for them. Keep the merchant id, business and stock;
 * replace the dead keeper's identity with a short honest one. Removing the old
 * household link stops the dead keeper's death from hiding the new keeper.
 */
function simBornKeeperNpc(npc: RichNPC, keeper: TownLifeVillager, trade: string, townName: string): RichNPC {
  if (npc.name === keeper.name && !(npc as { worldforgeHousehold?: unknown }).worldforgeHousehold) return npc;
  const description = `${keeper.name}, keeper of the ${trade}.`;
  const revised: RichNPC & { worldforgeHousehold?: unknown } = {
    ...npc,
    name: keeper.name,
    baseDescription: description,
    initialPersonalityPrompt: `${description} You live in ${townName}. Do not claim to have met the player before unless your memory records it.`,
    biography: { ...npc.biography, family: [], background: undefined },
  };
  delete revised.worldforgeHousehold;
  return revised;
}

/**
 * Compute (do not dispatch) the merchant NPCs + businesses for a burg's market
 * and workshop plots. Existing stock is preserved, while outdated household
 * identity can be reconciled once. Canonical name/family selection is seeded;
 * the existing NPC generator still owns new mechanical/flavor draws.
 */
export function computeBurgMerchants(
  worldSeed: number,
  burgId: number,
  gameDay: number,
  existingNpcs: Record<string, RichNPC> | undefined,
  existingBusinesses: Record<string, WorldBusiness> | undefined,
  life?: TownLifeState & Pick<ShopLifeView, 'shops'>,
): BurgMerchants {
  const atlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, burgId, life?.layoutRevision);
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
  const seed = canonicalTownSeedPath(worldSeed, burgId);
  const roster = generateTownRoster(adapted.plan, seed, {nameFor});
  const populations = householdPopulationsForPlan(adapted.plan);
  const homes = adapted.plan.plots.flatMap(plot => {
    const population = householdPopulationForPlot(plot);
    const home = population?.residential ? householdForPlot(population, populations, seed)?.household : undefined;
    return home ? [home] : [];
  });
  const members = new Map(homes.flatMap(home => home.members.map((_, index) => [householdMemberIdentity(home, index), {home, index}] as const)));
  const keeperIds = new Map(roster.occupants.filter(o => o.householdMemberId && o.workPlotId !== undefined)
    .map(o => [o.householdMemberId!, townMerchantNpcId(burgId, o.workPlotId!)]));
  const townName = (atlas.pack.burgs?.[burgId] as {name?: string} | undefined)?.name;
  if (!townName) throw new Error(`Missing canonical name for settlement ${burgId}`);

  // NPC lives (2026-11-02): when the town sim records a different living
  // keeper (an heir or a reopened shop), the merchant id now speaks for that
  // keeper. The id, business and stock stay; only the identity follows the
  // sim. Family links point the new keeper's household key at the merchant id.
  const simKeepers = new Map<number, TownLifeVillager>();
  for (const plot of adapted.plan.plots) {
    if (plot.role !== 'market' && plot.role !== 'workshop') continue;
    const shop = shopKeeperAt(life, plot.id, gameDay);
    if (shop.status !== 'open') continue;
    if (isRosterWorker(shop.keeper, roster.occupants.find(o => o.workPlotId === plot.id))) continue;
    simKeepers.set(plot.id, shop.keeper);
    const npcId = townMerchantNpcId(burgId, plot.id);
    for (const [memberId, mapped] of [...keeperIds]) if (mapped === npcId) keeperIds.delete(memberId);
    if (shop.keeper.householdMemberId) keeperIds.set(shop.keeper.householdMemberId, npcId);
  }

  for (const plot of adapted.plan.plots) {
    if (plot.role !== 'market' && plot.role !== 'workshop') continue;
    const npcId = townMerchantNpcId(burgId, plot.id);
    const bizId = townMerchantBizId(burgId, plot.id);
    const worker = roster.occupants.find(o => o.workPlotId === plot.id);
    const simKeeper = simKeepers.get(plot.id);
    const keeperKey = simKeeper ? simKeeper.householdMemberId : worker?.householdMemberId;
    const identity = keeperKey ? members.get(keeperKey) : undefined;
    const trade = life?.shops?.[plot.id]?.trade ?? 'shop';
    const previous = existingNpcs?.[npcId];
    if (previous && existingBusinesses?.[bizId]) {
      if (identity && previous.biography) {
        const revised = reconcileHouseholdNpc(previous, identity.home, identity.index, burgId, townName, keeperIds, life, gameDay);
        if (revised !== previous) npcs.push(revised);
      } else if (simKeeper) {
        const revised = simBornKeeperNpc(previous, simKeeper, trade, townName);
        if (revised !== previous) npcs.push(revised);
      }
      continue;
    }

    const rng = new SeededRandom(worldSeed + burgId + plot.id);
    // This is only reached for registration; saved business/stock skips above
    // preserve old purchases and ownership rather than silently migrating history.
    const bizType = businessTypeForTownPlot(plot.role, plot.id, plot.pop?.buildingType);
    const bizName = generateBusinessName(bizType, rng);
    // Keep the established 2D stock stream's name draw even when the household
    // supplies the displayed name. Existing saved business objects are untouched.
    const fallbackName = nameFor(rng);

    const npcConfig: NPCGenerationConfig = {
      id: npcId,
      name: simKeeper?.name ?? worker?.name ?? fallbackName,
      role: 'merchant',
      occupation: plot.role === 'market' ? 'shopkeeper' : 'artisan',
      level: 3,
    };
    const generated = previous ?? generateNPC({...npcConfig, worldSeed});
    let richNpc = identity && generated.biography ? reconcileHouseholdNpc(generated, identity.home, identity.index, burgId, townName, keeperIds, life, gameDay)
      : simKeeper ? simBornKeeperNpc(generated, simKeeper, trade, townName) : generated;
    if (richNpc.businessId !== bizId) richNpc = {...richNpc, businessId: bizId};

    const worldBiz = generateNpcBusiness(richNpc, makeCellLocationId(bizCell), bizType, gameDay, rng);
    worldBiz.id = bizId;
    worldBiz.name = bizName;
    worldBiz.ownerId = npcId;
    (worldBiz as { burgId?: number }).burgId = burgId;
    (worldBiz as { plotId?: number }).plotId = plot.id;

    if (richNpc !== previous) npcs.push(richNpc);
    if (!existingBusinesses?.[bizId]) businesses.push(worldBiz);
  }

  // Residents first met at home also link their parent/spouse to the same
  // keeper id used at work. Do not duplicate the adult under a member alias.
  const prefix = `npc_burg_${burgId}_member_`;
  for (const [id, npc] of Object.entries(existingNpcs ?? {})) {
    if (!id.startsWith(prefix) || !npc.biography) continue;
    const identity = members.get(id.slice(prefix.length));
    if (!identity) continue;
    const revised = reconcileHouseholdNpc(npc, identity.home, identity.index, burgId, townName, keeperIds, life, gameDay);
    if (revised !== npc) npcs.push(revised);
  }
  return { npcs, businesses };
}
