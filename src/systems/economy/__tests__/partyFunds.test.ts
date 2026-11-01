/** Currency earned as inventory must retain its face value and source history
 * while paying for real goods. These checks exercise conservation and rejection,
 * including representations different from the played eight separate coins. */
import { describe, expect, it } from 'vitest';
import type { Item } from '../../../types';
import { ALL_ITEMS } from '../../../data/items';
import { CURRENCY_COPPER_VALUES, isCurrencyItemId } from '../../../utils/character/coinPurseUtils';
import { getPartyFundsGp, payPartyFunds } from '../partyFunds';
import { parseCost } from '../../../utils/economy/economyUtils';

const coin = (id: string, quantity?: number): Item => ({
  id, name: id, type: 'treasure', sourceId: 'earned-cache', acquiredAt: 42,
  containerId: 'pouch', ...(quantity === undefined ? {} : { quantity }),
}) as Item;

describe('party currency value and payment', () => {
  it.each(Object.entries(CURRENCY_COPPER_VALUES))('%s matches the catalog face value', (id, value) => {
    expect(ALL_ITEMS[id].costInGp ?? parseCost(ALL_ITEMS[id].cost)).toBe(value / 100);
    expect(getPartyFundsGp({ gold: 0, inventory: [coin(id, 3)] })).toBe(value * 3 / 100);
  });

  it('counts the played eight separate coins and one eight-coin stack equally', () => {
    expect(getPartyFundsGp({ gold: 20.77, inventory: Array.from({ length: 8 }, () => coin('gold_piece')) })).toBe(28.77);
    expect(getPartyFundsGp({ gold: 20.77, inventory: [coin('gold_piece', 8)] })).toBe(28.77);
  });

  it('uses liquid funds first and retains every earned object', () => {
    const item = coin('gold_piece', 8);
    const funds = { gold: 20.77, inventory: [item] };
    const after = payPartyFunds(funds, 0.01)!;
    expect(after.gold).toBe(20.76);
    expect(after.inventory[0]).toBe(item);
    expect(getPartyFundsGp(after)).toBe(28.76);
    expect(funds.gold).toBe(20.77);
  });

  it('breaks only one required gold piece and gives exact change', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ ...coin('gold_piece'), sourceId: 'cache-' + i }));
    const after = payPartyFunds({ gold: 0, inventory: items }, 0.01)!;
    expect(after.gold).toBe(0.99);
    expect(after.inventory).toEqual(items.slice(1));
    expect(after.inventory[0]).toBe(items[1]);
    expect(getPartyFundsGp(after)).toBe(7.99);
    expect(items).toHaveLength(8);
  });

  it('preserves partial-stack source and container metadata', () => {
    const item = coin('electrum_piece', 8);
    const after = payPartyFunds({ gold: 0, inventory: [item] }, 1.01)!;
    expect(after.inventory).toEqual([{ ...item, quantity: 5 }]);
    expect(after.gold).toBe(0.49);
    expect(getPartyFundsGp(after)).toBe(2.99);
    expect(item.quantity).toBe(8);
  });

  it('uses smaller denominations first without spending unrelated treasure', () => {
    const treasure = coin('gold_piece_relic', 4);
    const gold = coin('gold_piece');
    const silver = coin('silver_piece', 3);
    const after = payPartyFunds({ gold: 0.02, inventory: [gold, treasure, silver, coin('copper_piece', 4)] }, 0.25)!;
    expect(after.gold).toBe(0.01);
    expect(after.inventory).toEqual([gold, treasure, { ...silver, quantity: 1 }]);
    expect(after.inventory[0]).toBe(gold);
    expect(after.inventory[1]).toBe(treasure);
  });

  it.each([NaN, Infinity, -1, 1.01])('rejects invalid or unaffordable cost %s without mutation', cost => {
    const funds = { gold: 0, inventory: [coin('gold_piece')] };
    const before = structuredClone(funds);
    expect(payPartyFunds(funds, cost)).toBeNull();
    expect(funds).toEqual(before);
  });

  it.each([0, -1, 1.5, NaN, Infinity])('does not spend malformed coin quantity %s', quantity => {
    const funds = { gold: 0, inventory: [coin('gold_piece', quantity)] };
    expect(getPartyFundsGp(funds)).toBe(0);
    expect(payPartyFunds(funds, 0.01)).toBeNull();
  });

  it('does not treat prototype properties, similar names or arbitrary treasure as currency', () => {
    for (const id of ['constructor', '__proto__', 'gold_piece_relic', 'shiny_coin_relic', 'shiny_coin_legacy_uuid', 'treasure']) expect(isCurrencyItemId(id)).toBe(false);
  });

  it('spends only required earned shiny coins and retains partial-stack provenance', () => {
    const earned = coin('shiny_coin', 6);
    const relic = coin('shiny_coin_relic', 3);
    const before = {gold: 0, inventory: [earned, relic]};
    expect(getPartyFundsGp(before)).toBe(6);
    const after = payPartyFunds(before, 1.01)!;
    expect(after.gold).toBe(0.99);
    expect(after.inventory).toEqual([{...earned, quantity: 4}, relic]);
    expect(after.inventory[1]).toBe(relic);
    expect(getPartyFundsGp(after)).toBe(4.99);
    expect(earned.quantity).toBe(6);
    expect(payPartyFunds(before, 6.01)).toBeNull();
  });

  it('does not create money for a canceled/free quote or an invalid balance', () => {
    const item = coin('gold_piece', 8);
    expect(payPartyFunds({ gold: 0.77, inventory: [item] }, 0)).toEqual({ gold: 0.77, inventory: [item] });
    expect(payPartyFunds({ gold: NaN, inventory: [item] }, 0.01)).toBeNull();
  });
});
