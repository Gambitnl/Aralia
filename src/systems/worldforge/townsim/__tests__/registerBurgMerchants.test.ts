import { describe, it, expect } from 'vitest';
import { businessTypeForTownPlot, computeBurgMerchants, townMerchantNpcId, townMerchantBizId } from '../registerBurgMerchants';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { canonicalArtifactTownForSite } from '../../bridge/groundChunkLoader';
import type { TownLayoutRevision } from '../../town/townLayoutRevision';

const SEED = 42;

/** Find a real burg in the seed-42 world that has market/workshop plots. */
function findShopBurg(layoutRevision: TownLayoutRevision = 2): { burgId: number; shopPlotIds: number[] } {
  const atlas = getBridgeAtlas(SEED);
  const burgs = (atlas.pack.burgs ?? []) as Array<{ i?: number; cell?: number; removed?: boolean }>;
  for (const b of burgs) {
    const id = b.i ?? 0;
    if (!id || b.removed) continue;
    const site = { burgId: id, envelope: { x: 0, y: 0, width: 200, height: 200 }, gates: [] } as never;
    const { plan } = canonicalArtifactTownForSite(SEED, site, layoutRevision);
    const shops = plan.plots.filter((p) => p.role === 'market' || p.role === 'workshop');
    if (shops.length > 0) return { burgId: id, shopPlotIds: shops.map((p) => p.id) };
  }
  throw new Error('no burg with shop plots found in seed 42');
}

describe('computeBurgMerchants — 2D/3D town identity', () => {
  it('uses the saved earlier layout for every merchant plot', () => {
    const {burgId,shopPlotIds} = findShopBurg(1);
    const life = {layoutRevision:1 as const,villagers:{}};
    const before = JSON.stringify(life);
    const result = computeBurgMerchants(SEED,burgId,1,{}, {},life);
    expect(result.businesses.map(business=>business.plotId).sort())
      .toEqual([...shopPlotIds].sort());
    expect(JSON.stringify(life)).toBe(before);
  });

  it('keeps already-owned stock and identities while reading the earlier layout', () => {
    const {burgId,shopPlotIds} = findShopBurg(1);
    const npcId = townMerchantNpcId(burgId,shopPlotIds[0]);
    const bizId = townMerchantBizId(burgId,shopPlotIds[0]);
    const npcs = {[npcId]:{id:npcId} as never};
    const businesses = {[bizId]:{id:bizId,name:'Owned old shop',inventory:[{id:'owned-lot',quantity:3}]} as never};
    const before = JSON.stringify({npcs,businesses});
    const result = computeBurgMerchants(SEED,burgId,1,npcs,businesses,{layoutRevision:1,villagers:{}});
    expect(result.npcs.some(npc=>npc.id===npcId)).toBe(false);
    expect(result.businesses.some(business=>business.id===bizId)).toBe(false);
    expect(JSON.stringify({npcs,businesses})).toBe(before);
  });

  it('binds merchants to the SAME plot ids the 3D bake uses (no divergence)', () => {
    const { burgId, shopPlotIds } = findShopBurg();
    const { npcs, businesses } = computeBurgMerchants(SEED, burgId, 1, {}, {});

    // One merchant NPC + business per market/workshop plot.
    expect(npcs.length).toBe(shopPlotIds.length);
    expect(businesses.length).toBe(shopPlotIds.length);

    // The generated ids are exactly the plot-keyed ids the 3D renderer looks up,
    // for the SAME plot ids — so a 2D-arrival keeper is the 3D town's keeper.
    const expectedNpcIds = new Set(shopPlotIds.map((p) => townMerchantNpcId(burgId, p)));
    const expectedBizIds = new Set(shopPlotIds.map((p) => townMerchantBizId(burgId, p)));
    for (const n of npcs) expect(expectedNpcIds.has(n.id)).toBe(true);
    for (const b of businesses) {
      expect(expectedBizIds.has(b.id)).toBe(true);
      expect(b.ownerId).toBe(b.id.replace('biz_', 'npc_'));
    }
  });

  it('skips plots already registered (whichever view runs first wins — no duplicates)', () => {
    const { burgId, shopPlotIds } = findShopBurg();
    const firstId = shopPlotIds[0];
    const existingNpcs = { [townMerchantNpcId(burgId, firstId)]: { id: townMerchantNpcId(burgId, firstId) } as never };
    const existingBiz = { [townMerchantBizId(burgId, firstId)]: { id: townMerchantBizId(burgId, firstId) } as never };
    const { npcs } = computeBurgMerchants(SEED, burgId, 1, existingNpcs, existingBiz);
    expect(npcs.some((n) => n.id === townMerchantNpcId(burgId, firstId))).toBe(false);
    expect(npcs.length).toBe(shopPlotIds.length - 1);
  });

  it('gives each merchant a linked business with a proper name and coherent type', () => {
    const { burgId } = findShopBurg();
    const { npcs, businesses } = computeBurgMerchants(SEED, burgId, 1, {}, {});
    expect(npcs[0].businessId).toBe(businesses[0].id);
    expect(businesses[0].name.length).toBeGreaterThan(0);
    expect(businesses[0].businessType).toBeTruthy();
  });
});

describe('fitted business use for new registration', () => {
  it.each([
    ['market', 49, 'inn', 'tavern'],
    ['market', 48, 'tavern', 'tavern'],
    ['workshop', 8, 'smithy', 'smithy'],
    ['market', 68, 'shop', 'general_store'],
  ] as const)('respects the canonical %s plot %i fitted as %s', (role, id, fitted, expected) => {
    expect(businessTypeForTownPlot(role, id, fitted)).toBe(expected);
  });

  it('retains legacy selection when no explicit fitted use settles the trade', () => {
    expect(businessTypeForTownPlot('workshop', 8)).toBe('farm');
    expect(businessTypeForTownPlot('market', 49)).toBe('enchanter_shop');
    expect(businessTypeForTownPlot('workshop', 135, 'workshop')).toBe(businessTypeForTownPlot('workshop', 135));
    expect(businessTypeForTownPlot('market', 12, 'shop')).toBe('enchanter_shop');
  });

  it('passes the real played town fitted uses through the shared 2D/3D owner', () => {
    const result = computeBurgMerchants(1793176470555, 2, 3, {}, {});
    expect(result.businesses.find(b => b.id === 'biz_burg_2_plot_228')?.businessType).toBe('tavern');
    expect(result.businesses.find(b => b.id === 'biz_burg_2_plot_45')?.businessType).toBe('smithy');
    expect(result.businesses.find(b => b.id === 'biz_burg_2_plot_263')?.businessType).toBe('general_store');
    // Re-pinned 2026-11-02 for the GG-563/GG-577 layout (GG-552 rule), and the
    // general store again for GG-582 (Kalg's roads keep to a bank), and the
    // tavern and general store for GG-586 (the houses that face the market
    // square trade, and the market square's size floor re-cuts the wards):
    // the first
    // tavern, smithy and general store of the current layout.
    const inn = result.businesses.find(b => b.id === 'biz_burg_2_plot_228')!;
    const keeper = result.npcs.find(n => n.id === inn.ownerId)!;
    // Old sales and shelves remain history even when a new-registration rule changes.
    const oldBusiness = {...inn, name: 'The Grand Wonders', businessType: 'enchanter_shop' as const, stock: [{itemId: 'healing_potion', quantity: 2}], priceMultiplier: 1.17};
    const oldSnapshot = JSON.stringify(oldBusiness);
    const replay = computeBurgMerchants(1793176470555, 2, 4, {[keeper.id]: keeper}, {[inn.id]: oldBusiness});
    expect(replay.businesses.some(b => b.id === inn.id)).toBe(false);
    expect(JSON.stringify(oldBusiness)).toBe(oldSnapshot);
    expect(replay.npcs.some(n => n.id === keeper.id)).toBe(false);
  });
});
