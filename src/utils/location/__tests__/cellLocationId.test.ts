import { describe, it, expect } from 'vitest';
import { makeCellLocationId, parseCellLocationId, isCellLocationId, isWildernessLocationId } from '../cellLocationId';

describe('cellLocationId', () => {
  it('round-trips a cell id', () => {
    expect(makeCellLocationId(1880)).toBe('cell_1880');
    expect(parseCellLocationId('cell_1880')).toBe(1880);
    expect(isCellLocationId('cell_1880')).toBe(true);
  });

  it('accepts cell 0', () => {
    expect(parseCellLocationId('cell_0')).toBe(0);
    expect(isCellLocationId('cell_0')).toBe(true);
  });

  it('isWildernessLocationId accepts both cell_ and legacy coord_ forms, rejects authored ids', () => {
    expect(isWildernessLocationId('cell_1880')).toBe(true);
    expect(isWildernessLocationId('coord_15_10')).toBe(true); // legacy save
    expect(isWildernessLocationId('clearing')).toBe(false);
    expect(isWildernessLocationId('town_1')).toBe(false);
    expect(isWildernessLocationId(null)).toBe(false);
  });

  it('rejects static LOCATIONS ids, the legacy coord form, and malformed strings', () => {
    for (const id of ['clearing', 'town_1', 'coord_15_10', 'cell_', 'cell_x', 'cell_-3', '', null, undefined]) {
      expect(parseCellLocationId(id as string), `parse ${id}`).toBeNull();
      expect(isCellLocationId(id as string), `is ${id}`).toBe(false);
    }
  });
});
