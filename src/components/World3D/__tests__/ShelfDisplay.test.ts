/** Shelf detail must fit the existing solid footprint and show only owned goods. */
import { describe, expect, it } from 'vitest';
import { shelfGeometry, shelfModel, SHELF_ITEM_IDS } from '../ShelfDisplay';

describe('source-bound shelf display', () => {
  it('shows source-owned library volumes before bulky legacy goods without changing exact stock', () => {
    const stock = {front:'x+' as const,ownerHomeId:'b98',entries:[
      {itemId:'clay_pot',qty:18},{itemId:'tallow_candles',qty:6},{itemId:'book',qty:12},
    ]};
    const before=structuredClone(stock);
    const model=shelfModel(.4,1.8,1.8,stock);
    expect(model.renderedUnits.book).toBe(12);
    expect(model.unrepresented).not.toContain('book');
    expect(model.renderedUnits.clay_pot).toBeLessThan(18);
    expect(stock).toEqual(before);
    expect(model.goods.length).toBeLessThan(200);
  });

  it('fits the unchanged catalog footprint in all facing directions', () => {
    for (const front of ['x+', 'x-', 'z+', 'z-'] as const) {
      const side = front.startsWith('x'), w = side ? .4 : 1.8, d = side ? 1.8 : .4;
      for (const id of SHELF_ITEM_IDS) {
        const model = shelfModel(w, 1.8, d, {front, ownerHomeId: 'home-a', entries: [{itemId: id, qty: 3}]});
        for (const list of [model.frame, model.goods]) {
          const geometry = shelfGeometry(list, model.angle, true), bounds = geometry.boundingBox!;
          expect(bounds.min.x).toBeGreaterThanOrEqual(-w / 2 - 1e-6);
          expect(bounds.max.x).toBeLessThanOrEqual(w / 2 + 1e-6);
          expect(bounds.min.z).toBeGreaterThanOrEqual(-d / 2 - 1e-6);
          expect(bounds.max.z).toBeLessThanOrEqual(d / 2 + 1e-6);
          expect(bounds.min.y).toBeGreaterThanOrEqual(-.9 - 1e-6);
          expect(bounds.max.y).toBeLessThanOrEqual(.9 + 1e-6);
          expect(Array.from(geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
          expect(Array.from(geometry.attributes.color.array).every(Number.isFinite)).toBe(true);
          geometry.dispose();
        }
      }
    }
  });

  it('shows Roban’s two ledger books and two coins without changing owned rows', () => {
    const stock = {front: 'x+' as const, ownerHomeId: 'b151', entries: [
      {itemId: 'gold_piece', qty: 2}, {itemId: 'ledger_book', qty: 1}, {itemId: 'ledger_book', qty: 1},
    ]};
    const before = structuredClone(stock);
    const model = shelfModel(.4, 1.8, 1.8, stock);
    expect(model.renderedUnits).toEqual({gold_piece: 2, ledger_book: 2});
    expect(model.unrepresented).toEqual([]);
    expect(stock).toEqual(before);
    expect(new Set(model.goods.map(shape => shape.surface)).size).toBeLessThanOrEqual(3);
  });

  it('uses additional bays for repeated source draws but bounds future huge stock', () => {
    const repeated = shelfModel(1.8, 1.8, .4, {front: 'z+', entries: [
      {itemId: 'clay_pot', qty: 3}, {itemId: 'clay_pot', qty: 3},
      {itemId: 'clay_pot', qty: 3}, {itemId: 'clay_pot', qty: 3},
    ]});
    expect(repeated.renderedUnits).toEqual({clay_pot: 12});
    expect(repeated.unrepresented).toEqual([]);
    const huge = shelfModel(1.8, 1.8, .4, {front: 'z+', entries: [{itemId: 'gold_piece', qty: 1000000}]});
    expect(huge.renderedUnits.gold_piece).toBe(72);
    expect(huge.unrepresented).toEqual(['gold_piece']);
    expect(huge.goods).toHaveLength(72);
  });

  it('fits existing counting-room reserves and their extra ledger draws', () => {
    const model = shelfModel(1.8, 1.8, .4, {front: 'z+', entries: [
      {itemId: 'silver_piece', qty: 20}, {itemId: 'gold_piece', qty: 10},
      {itemId: 'ledger_book', qty: 3}, {itemId: 'ledger_book', qty: 3},
    ]});
    expect(model.renderedUnits).toEqual({silver_piece: 20, gold_piece: 10, ledger_book: 6});
    expect(model.unrepresented).toEqual([]);
    const geometry = shelfGeometry(model.goods, model.angle, true);
    expect(geometry.boundingBox!.min.y).toBeGreaterThan(-.9);
    expect(geometry.boundingBox!.max.y).toBeLessThan(.9);
    geometry.dispose();
  });

  it('does not invent books for absent, invalid or unknown stock', () => {
    expect(shelfModel(1.8, 1.8, .4).goods).toEqual([]);
    const unknown = shelfModel(1.8, 1.8, .4, {front: 'z-', entries: [
      {itemId: 'unmodeled_item', qty: 2}, {itemId: 'ledger_book', qty: 0},
    ]});
    expect(unknown.goods).toEqual([]);
    expect(unknown.unrepresented).toEqual(['unmodeled_item']);
  });
});
