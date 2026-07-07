import { describe, expect, it } from 'vitest';
import { tradeRoomsFor } from '../tradeRooms';

describe('tradeRoomsFor', () => {
  it('blacksmith demands a street-facing forge', () => {
    expect(tradeRoomsFor('blacksmith')).toEqual([{ purpose: 'forge', streetFacing: true }]);
  });
  it('shopkeeper demands shopfront + stockroom behind it', () => {
    expect(tradeRoomsFor('shopkeeper')).toEqual([
      { purpose: 'shopfront', streetFacing: true },
      { purpose: 'stockroom', adjacentTo: 'shopfront' },
    ]);
  });
  it('unknown/plain trades demand nothing', () => {
    expect(tradeRoomsFor('labourer')).toEqual([]);
    expect(tradeRoomsFor('farmer')).toEqual([]);
  });
});
