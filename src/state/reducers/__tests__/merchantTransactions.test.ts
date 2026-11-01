/** Played regression: a ration buy hid eight remaining units; selling the
 * purchased row deleted a different five-unit stack. Exercise settlement, not
 * just dispatched button shapes, including repeated clicks and rejected money.
 */
import { describe, expect, it } from 'vitest';
import { applyMerchantPurchase, applyMerchantSale } from '../merchantTransactions';
import type { GameState, Item } from '../../../types';

const ration = { id: 'rations', name: 'Rations (1 day)', type: 'food_drink', costInGp: 0.5, quantity: 1 } as Item;
const stateForTrade = (stock = 9): GameState => ({
  gold: 24,
  inventory: [{ ...ration, quantity: 5, acquiredAt: 100 }, { ...ration, acquiredAt: 200 }],
  merchantModal: { isOpen: true, merchantId: 'keeper', merchantName: 'Silver Bear', merchantInventory: [{ ...ration, quantity: stock }] },
  generatedNpcs: {},
  worldBusinesses: { shop: { id: 'shop', ownerId: 'keeper', stock: [{ itemId: 'rations', quantity: stock }] } },
}) as unknown as GameState;
const stamp = (item: Item) => ({ ...item, acquiredAt: 300 });

describe('merchant unit settlement', () => {
  it('charges once for a paid account even when an old purchase is repeated', () => {
    const before=stateForTrade();
    const item={id:'rumor_gossip_source',sourceId:'gossip_source',name:'Rumor',type:'service',cost:'0',weight:0,description:'Paid account'} as Item;
    const payload={item,cost:6};
    const after={...before,...applyMerchantPurchase(before,payload,stamp)};
    expect(after.gold).toBe(18);
    expect(after.inventory.filter(owned=>owned.sourceId===item.sourceId)).toHaveLength(1);
    expect(applyMerchantPurchase(after,payload,stamp)).toEqual({});
  });
  it('keeps a paid knowledge receipt when a stale resale requests one copper', () => {
    const before=stateForTrade();
    before.inventory=[{id:'rumor_gossip_source',sourceId:'gossip_source',type:'service',name:'Rumor',cost:'0',weight:0,description:'Paid account'} as Item];
    expect(applyMerchantSale(before,{itemId:before.inventory[0].id,value:0.01,inventoryIndex:0})).toEqual({});
    expect(before.inventory[0].sourceId).toBe('gossip_source');
    expect(before.gold).toBe(24);
  });
  it('buys one unit and keeps the remaining shelf and saved stock aligned', () => {
    const before = stateForTrade();
    const after = { ...before, ...applyMerchantPurchase(before, { item: { ...ration, quantity: 9 }, cost: 0.48 }, stamp) };
    expect(after.gold).toBe(23.52);
    expect(after.inventory.at(-1)).toMatchObject({ id: 'rations', quantity: 1, acquiredAt: 300 });
    expect(after.merchantModal!.merchantInventory[0].quantity).toBe(8);
    expect(after.worldBusinesses.shop.stock![0].quantity).toBe(8);
    expect(before.worldBusinesses.shop.stock![0].quantity).toBe(9);
    expect(before.inventory).toHaveLength(2);
  });

  it('sells the selected single unit without consuming the earlier five-unit stack', () => {
    const before = stateForTrade();
    const after = { ...before, ...applyMerchantSale(before, { itemId: 'rations', value: 0.25, inventoryIndex: 1 }) };
    expect(after.inventory).toEqual([before.inventory[0]]);
    expect(after.gold).toBe(24.25);
    expect(after.worldBusinesses.shop.stock![0].quantity).toBe(10);
    expect(after.merchantModal!.merchantInventory[0].quantity).toBe(10);
    expect(applyMerchantSale(after, { itemId: 'rations', value: 0.25, inventoryIndex: 1 })).toEqual({});
  });

  it('selling one unit from a stack preserves its remaining quantity and provenance', () => {
    const before = stateForTrade();
    const after = applyMerchantSale(before, { itemId: 'rations', value: 0.25, inventoryIndex: 0 });
    expect(after.inventory![0]).toMatchObject({ quantity: 4, acquiredAt: 100 });
    expect(after.inventory![1]).toBe(before.inventory[1]);
  });

  it('cannot buy the last unit twice, even when both requests carried an old shelf', () => {
    const before = stateForTrade(1);
    const payload = { item: ration, cost: 0.48 };
    const after = { ...before, ...applyMerchantPurchase(before, payload, stamp) };
    expect(after.merchantModal!.merchantInventory).toEqual([]);
    expect(after.worldBusinesses.shop.stock![0].quantity).toBe(0);
    expect(applyMerchantPurchase(after, payload, stamp)).toEqual({});
  });

  it.each([NaN, Infinity, -1, 25])('rejects invalid or unaffordable purchase %s without changes', cost => {
    expect(applyMerchantPurchase(stateForTrade(), { item: ration, cost }, stamp)).toEqual({});
  });

  it.each([NaN, Infinity, -1])('rejects invalid sale amount %s without changes', value => {
    expect(applyMerchantSale(stateForTrade(), { itemId: 'rations', value, inventoryIndex: 0 })).toEqual({});
  });

  it('rejects a shifted row whose item identity no longer matches', () => {
    expect(applyMerchantSale(stateForTrade(), { itemId: 'greatsword', value: 25, inventoryIndex: 0 })).toEqual({});
  });

  it('rejects a repeated click after an identical-id row shifts into its position', () => {
    const before = stateForTrade();
    const payload = { itemId: 'rations', value: 0.25, inventoryIndex: 1, inventoryItem: before.inventory[1] };
    const withAnother = { ...before, inventory: [...before.inventory, { ...ration, acquiredAt: 999 }] };
    const after = { ...withAnother, ...applyMerchantSale(withAnother, payload) };
    expect(after.inventory[1].acquiredAt).toBe(999);
    expect(applyMerchantSale(after, payload)).toEqual({});
  });

  it('retains a newly bought catalog weapon for resale at the shop price', () => {
    const before = stateForTrade();
    const greatsword = { id: 'greatsword', name: 'Greatsword', type: 'weapon', cost: '50 GP', quantity: 1 } as Item;
    before.inventory = [...before.inventory, greatsword];
    const after = { ...before, ...applyMerchantSale(before, { itemId: 'greatsword', value: 25, inventoryIndex: 2, inventoryItem: greatsword }) };
    expect(after.gold).toBe(49);
    expect(after.inventory).toEqual(before.inventory.slice(0, 2));
    expect(after.worldBusinesses.shop.stock).toContainEqual({ itemId: 'greatsword', quantity: 1 });
    expect(after.merchantModal!.merchantInventory).toContainEqual(expect.objectContaining({ id: 'greatsword', quantity: 1, costInGp: 50 }));
    expect(before.worldBusinesses.shop.stock).not.toContainEqual(expect.objectContaining({ itemId: 'greatsword' }));
    const rebought = { ...after, ...applyMerchantPurchase({ ...after, gold: 50 }, { item: greatsword, cost: 50 }, stamp) };
    expect(rebought.gold).toBe(0);
    expect(rebought.worldBusinesses.shop.stock!.find(line => line.itemId === 'greatsword')!.quantity).toBe(0);
    expect(rebought.inventory.at(-1)).toMatchObject({ id: 'greatsword', quantity: 1 });
  });
});

describe('earned coin settlement', () => {
  const coin = { id: 'gold_piece', name: 'Gold Piece', type: 'treasure', costInGp: 1, sourceId: 'cache9', acquiredAt: 42 } as Item;
  it('uses earned coins atomically when liquid funds cannot cover the quote', () => {
    const before = { ...stateForTrade(1), gold: 0.77, inventory: [{ ...coin, quantity: 8, containerId: 'pouch' }] };
    const after = { ...before, ...applyMerchantPurchase(before, { item: ration, cost: 2.78 }, stamp) };
    expect(after.gold).toBe(0.99);
    expect(after.inventory[0]).toEqual({ ...coin, quantity: 5, containerId: 'pouch' });
    expect(after.inventory[1]).toMatchObject({ id: 'rations', quantity: 1 });
    expect(after.worldBusinesses.shop.stock![0].quantity).toBe(0);
    expect(applyMerchantPurchase(after, { item: ration, cost: 2.78 }, stamp)).toEqual({});
    expect(before.inventory[0].quantity).toBe(8);
  });
  it('spends the played1CP quote from liquid funds without changing any earned coin record', () => {
    const coins = Array.from({ length: 8 }, (_, i) => ({ ...coin, sourceId: 'cache9-' + i }));
    const before = { ...stateForTrade(), gold: 20.77, inventory: coins };
    const after = applyMerchantPurchase(before, { item: ration, cost: 0.01 }, stamp);
    expect(after.gold).toBe(20.76);
    expect(after.inventory!.slice(0, 8)).toEqual(coins);
    coins.forEach((entry, i) => expect(after.inventory![i]).toBe(entry));
  });
  it('rejects unaffordable quotes without spending coins or changing stock', () => {
    const before = { ...stateForTrade(), gold: 0.77, inventory: [coin] };
    expect(applyMerchantPurchase(before, { item: ration, cost: 1.78 }, stamp)).toEqual({});
  });
  it('does not buy or sell legal currency as discounted goods', () => {
    const before = { ...stateForTrade(), inventory: [coin] };
    expect(applyMerchantSale(before, { itemId: coin.id, value: 0.1, inventoryIndex: 0 })).toEqual({});
    expect(applyMerchantPurchase(before, { item: coin, cost: 0.1 }, stamp)).toEqual({});
  });
});
