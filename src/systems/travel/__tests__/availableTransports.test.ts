import { describe, it, expect } from 'vitest';
import { availableTransports } from '../availableTransports';

describe('availableTransports', () => {
  it('always offers walking first', () => {
    const t = availableTransports([]);
    expect(t[0].id).toBe('walking');
    expect(t).toHaveLength(1);
    expect(availableTransports(null)[0].id).toBe('walking');
  });

  it('adds a riding horse when any party member is mounted', () => {
    const t = availableTransports([{ transportMode: 'foot' }, { transportMode: 'mounted' }]);
    expect(t.map((x) => x.id)).toEqual(['walking', 'riding_horse']);
    expect(t[1].option.method).toBe('mounted');
    expect(t[1].option.vehicle?.id).toBe('riding_horse');
    expect(t[1].readoutLabel).toBe('by horse');
  });

  it('no horse when nobody is mounted', () => {
    expect(availableTransports([{ transportMode: 'foot' }]).map((x) => x.id)).toEqual(['walking']);
  });
});
