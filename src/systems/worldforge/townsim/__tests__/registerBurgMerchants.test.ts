import { describe, it, expect } from 'vitest';
import { computeBurgMerchants, townMerchantNpcId, townMerchantBizId } from '../registerBurgMerchants';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { canonicalArtifactTownForSite } from '../../bridge/groundChunkLoader';

const SEED = 42;

/** Find a real burg in the seed-42 world that has market/workshop plots. */
function findShopBurg(): { burgId: number; shopPlotIds: number[] } {
  const atlas = getBridgeAtlas(SEED);
  const burgs = (atlas.pack.burgs ?? []) as Array<{ i?: number; cell?: number; removed?: boolean }>;
  for (const b of burgs) {
    const id = b.i ?? 0;
    if (!id || b.removed) continue;
    const site = { burgId: id, envelope: { x: 0, y: 0, width: 200, height: 200 } } as never;
    const { plan } = canonicalArtifactTownForSite(SEED, site);
    const shops = plan.plots.filter((p) => p.role === 'market' || p.role === 'workshop');
    if (shops.length > 0) return { burgId: id, shopPlotIds: shops.map((p) => p.id) };
  }
  throw new Error('no burg with shop plots found in seed 42');
}

describe('computeBurgMerchants — 2D/3D town identity', () => {
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
