import { describe, it, expect } from 'vitest';
import { knownPortsFromPack } from '../knownPorts';

describe('knownPortsFromPack', () => {
  it('returns sorted burg-id strings for port burgs, skipping holes and non-port burgs', () => {
    const pack = {
      burgs: [
        0,                              // hole at index 0 — skip
        { i: 1, port: 1, cell: 10 },   // port burg
        { i: 2, port: 0, cell: 20 },   // non-port burg — skip
        { i: 3, port: 5, cell: 30 },   // port burg (truthy port value)
      ],
    };

    const result = knownPortsFromPack(pack);

    expect(result).toEqual(['1', '3']);
  });

  it('returns empty array when no port burgs exist', () => {
    const pack = {
      burgs: [
        0,
        { i: 1, port: 0, cell: 10 },
        { i: 2, cell: 20 },            // no port field at all
      ],
    };

    expect(knownPortsFromPack(pack)).toEqual([]);
  });

  it('returns results in ascending burg-id order regardless of input order', () => {
    const pack = {
      burgs: [
        0,
        { i: 5, port: 1, cell: 50 },
        { i: 2, port: 1, cell: 20 },
        { i: 8, port: 1, cell: 80 },
      ],
    };

    expect(knownPortsFromPack(pack)).toEqual(['2', '5', '8']);
  });

  it('returns [] for a pack with no burgs array', () => {
    expect(knownPortsFromPack({})).toEqual([]);
    expect(knownPortsFromPack({ burgs: undefined })).toEqual([]);
  });
});
