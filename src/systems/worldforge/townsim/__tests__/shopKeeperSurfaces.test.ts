/**
 * NPC lives (2026-11-02): the merchant talk list and merchant registration
 * follow the town sim's shop keeper. A succeeded or reopened shop shows its new
 * keeper; a closed shop shows no keeper.
 */
import { describe, it, expect } from 'vitest';
import { getTownTilesForGrid, getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { townMerchantNpcsForCell } from '../npcsForCell';
import { computeBurgMerchants, townMerchantBizId, townMerchantNpcId } from '../registerBurgMerchants';
import { buildTownSimStateForBurg } from '../townSimRegistration';
import { shopKeeperAt } from '../shopLife';
import type { RichNPC } from '../../../../types/world';
import type { WorldBusiness } from '../../../../types/business';

const SEED = 12345;
const firstTile = getTownTilesForGrid(SEED, 96, 96)[0];
const burgId = firstTile.burgId;
const burgCell = (getBridgeAtlas(SEED).pack.burgs as Array<{ cell?: number }>)[burgId].cell!;

function keeper(plotId: number, name: string) {
  const npcId = townMerchantNpcId(burgId, plotId);
  const bizId = townMerchantBizId(burgId, plotId);
  const npc = { id: npcId, name, businessId: bizId,
    worldforgeHousehold: { burgId, memberId: 'b151:head', signature: 'old' } } as unknown as RichNPC;
  const biz = { id: bizId, name: 'Shop', ownerId: npcId, burgId, plotId, businessType: 'smithy' } as unknown as WorldBusiness;
  return { npcId, bizId, npc, biz };
}

const deadRoban: { occupantId: number; householdMemberId: string; name: string; homePlotId: number; bornDay: number; diedDay?: number } = { occupantId: 395, householdMemberId: 'b151:head', name: 'Roban Westsmith', homePlotId: 151, bornDay: -10000, diedDay: -253 };
const mara = { occupantId: 500, name: 'Mara Westsmith', homePlotId: 151, bornDay: -8000 };

describe('townMerchantNpcsForCell follows the sim shop record', () => {
  const talk = (npcName: string, shops: Record<number, unknown>, roban = deadRoban) => {
    const k = keeper(156, npcName);
    return townMerchantNpcsForCell({
      worldSeed: SEED, cellId: burgCell, day: 3,
      generatedNpcs: { [k.npcId]: k.npc }, worldBusinesses: { [k.bizId]: k.biz },
      townLife: { [burgId]: { villagers: { 395: roban, 500: mara }, shops: shops as never } },
    }).map((n) => n.name);
  };

  it('shows the heir once the merchant identity names them, despite the dead household link', () => {
    expect(talk('Mara Westsmith', { 156: { keeperId: 500, sinceDay: -253 } })).toEqual(['Mara Westsmith']);
  });

  it('hides a stale identity until merchant registration renames it', () => {
    expect(talk('Roban Westsmith', { 156: { keeperId: 500, sinceDay: -253 } })).toEqual([]);
  });

  it('hides the keeper of a closed shop even when that person lives', () => {
    const alive = { ...deadRoban, diedDay: undefined };
    expect(talk('Roban Westsmith', { 156: { keeperId: null, sinceDay: 0, closedDay: 1 } }, alive)).toEqual([]);
  });

  it('keeps the household check when the shop has no record (old save)', () => {
    expect(talk('Roban Westsmith', {})).toEqual([]);
    const alive = { ...deadRoban, diedDay: undefined };
    expect(talk('Roban Westsmith', {}, alive)).toEqual(['Roban Westsmith']);
  });
});

describe('computeBurgMerchants follows the sim shop record', () => {
  // A real burg with shop plots; the base registration supplies its identities.
  const base = computeBurgMerchants(SEED, burgId, 3, {}, {});
  const plotOf = (npc: RichNPC) => Number(/_plot_(\d+)$/.exec(npc.id)![1]);

  it('names a sim-born heir and drops the dead keeper household link', () => {
    expect(base.npcs.length).toBeGreaterThan(0);
    const original = base.npcs[0];
    const plotId = plotOf(original);
    const life = {
      villagers: { 9001: { occupantId: 9001, name: 'Newa Sprout', homePlotId: 1, bornDay: -6000 } },
      shops: { [plotId]: { keeperId: 9001, sinceDay: 2, trade: 'smithy' } },
    };
    // Fresh registration.
    const fresh = computeBurgMerchants(SEED, burgId, 3, {}, {}, life).npcs.find((n) => n.id === original.id)!;
    expect(fresh.name).toBe('Newa Sprout');
    expect((fresh as { worldforgeHousehold?: unknown }).worldforgeHousehold).toBeUndefined();
    // Saved merchant: the id and business stay; the identity follows the sim.
    const savedNpcs = Object.fromEntries(base.npcs.map((n) => [n.id, n]));
    const savedBiz = Object.fromEntries(base.businesses.map((b) => [b.id, b]));
    const revised = computeBurgMerchants(SEED, burgId, 3, savedNpcs, savedBiz, life);
    expect(revised.businesses).toEqual([]);
    expect(revised.npcs.map((n) => n.id)).toEqual([original.id]);
    expect(revised.npcs[0]).toMatchObject({ id: original.id, name: 'Newa Sprout', businessId: original.businessId,
      baseDescription: 'Newa Sprout, keeper of the smithy.' });
    expect((revised.npcs[0] as { worldforgeHousehold?: unknown }).worldforgeHousehold).toBeUndefined();
    // A second pass is a no-op: the revision is idempotent.
    const again = computeBurgMerchants(SEED, burgId, 3, { ...savedNpcs, [original.id]: revised.npcs[0] }, savedBiz, life);
    expect(again.npcs).toEqual([]);
  });

  it('reconciles a household heir with their own household facts', () => {
    const withKeys = base.npcs.filter((n) => (n as { worldforgeHousehold?: { memberId: string } }).worldforgeHousehold);
    expect(withKeys.length).toBeGreaterThan(1);
    const [target, other] = withKeys;
    const otherKey = (other as unknown as { worldforgeHousehold: { memberId: string } }).worldforgeHousehold.memberId;
    const life = {
      villagers: { 7001: { occupantId: 7001, householdMemberId: otherKey, name: other.name, homePlotId: 1, bornDay: -9000 } },
      shops: { [plotOf(target)]: { keeperId: 7001, sinceDay: 2 } },
    };
    const out = computeBurgMerchants(SEED, burgId, 3, {}, {}, life).npcs.find((n) => n.id === target.id)!;
    expect(out.name).toBe(other.name);
    expect((out as unknown as { worldforgeHousehold: { memberId: string } }).worldforgeHousehold.memberId).toBe(otherKey);
  });

  it('a real registration seeds one shop record per merchant plot, keyed to the same keepers', () => {
    const state = buildTownSimStateForBurg(SEED, burgId, 1000);
    const merchantPlots = base.businesses.map((b) => b.plotId!).sort((a, b) => a - b);
    expect(Object.keys(state.shops ?? {}).map(Number).sort((a, b) => a - b)).toEqual(merchantPlots);
    // With the registered life state, every keeper who is still the roster
    // worker keeps the merchant name that base registration chose.
    const withLife = computeBurgMerchants(SEED, burgId, 1000, {}, {}, state);
    for (const npc of withLife.npcs.filter((n) => /_plot_/.test(n.id))) {
      const shop = shopKeeperAt(state, plotOf(npc), 1000);
      if (shop.status === 'open') expect(npc.name).toBe(shop.keeper.name);
    }
  }, 120_000);

  it('leaves registration unchanged when the sim keeper is the roster worker or untracked', () => {
    const untracked = computeBurgMerchants(SEED, burgId, 3, {}, {}, { villagers: {} });
    expect(untracked.npcs.map((n) => n.name)).toEqual(base.npcs.map((n) => n.name));
  });
});
