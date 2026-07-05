import { describe, it, expect } from 'vitest';
import { getTownTilesForGrid, getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { townMerchantNpcsForCell } from '../npcsForCell';
import type { RichNPC } from '../../../../types/world';
import type { WorldBusiness } from '../../../../types/business';

/**
 * Packet A proof: when the player stands in a wf town, the registered burg
 * merchants surface as talk targets. This mirrors the exact registry keys
 * World3DWrapper writes (npc_burg_<burg>_plot_* + biz_burg_<burg>_plot_* with
 * business.burgId set), so the selector's burg match is exercised end-to-end.
 */
const SEED = 12345;
const COLS = 96;
const ROWS = 96;
const firstTile = getTownTilesForGrid(SEED, COLS, ROWS)[0];
const firstBurgCell = (getBridgeAtlas(SEED).pack.burgs as Array<{ cell?: number }>)[firstTile.burgId].cell!;

function makeKeeper(burgId: number, plotId: number) {
  const npcId = `npc_burg_${burgId}_plot_${plotId}`;
  const bizId = `biz_burg_${burgId}_plot_${plotId}`;
  const npc = { id: npcId, name: `Keeper ${plotId}`, businessId: bizId } as unknown as RichNPC;
  const biz = {
    id: bizId,
    name: `Shop ${plotId}`,
    ownerId: npcId,
    burgId,
    businessType: 'general_store',
  } as unknown as WorldBusiness;
  return { npcId, bizId, npc, biz };
}

describe('townMerchantNpcsForCell — Packet A talk targets', () => {
  it('returns the burg keeper when the player stands on that burg cell', () => {
    const k1 = makeKeeper(firstTile.burgId, 1);
    const k2 = makeKeeper(firstTile.burgId, 2);
    // A keeper of a DIFFERENT burg must be excluded.
    const other = makeKeeper(firstTile.burgId + 9999, 3);

    const npcs = townMerchantNpcsForCell({
      worldSeed: SEED,
      cellId: firstBurgCell,
      generatedNpcs: { [k1.npcId]: k1.npc, [k2.npcId]: k2.npc, [other.npcId]: other.npc },
      worldBusinesses: { [k1.bizId]: k1.biz, [k2.bizId]: k2.biz, [other.bizId]: other.biz },
    });

    const ids = npcs.map((n) => n.id);
    expect(ids).toContain(k1.npcId);
    expect(ids).toContain(k2.npcId);
    expect(ids).not.toContain(other.npcId);
  });

  it('returns [] when the cell holds no burg', () => {
    const k1 = makeKeeper(firstTile.burgId, 1);
    expect(
      townMerchantNpcsForCell({
        worldSeed: SEED,
        cellId: 0, // border/no-burg cell
        generatedNpcs: { [k1.npcId]: k1.npc },
        worldBusinesses: { [k1.bizId]: k1.biz },
      }),
    ).toEqual([]);
  });

  it('is bounded by max', () => {
    const gen: Record<string, RichNPC> = {};
    const biz: Record<string, WorldBusiness> = {};
    for (let i = 0; i < 20; i++) {
      const k = makeKeeper(firstTile.burgId, i);
      gen[k.npcId] = k.npc;
      biz[k.bizId] = k.biz;
    }
    const npcs = townMerchantNpcsForCell({
      worldSeed: SEED,
      cellId: firstBurgCell,
      generatedNpcs: gen,
      worldBusinesses: biz,
      max: 4,
    });
    expect(npcs.length).toBe(4);
  });
});
