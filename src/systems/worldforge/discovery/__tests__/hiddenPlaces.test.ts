import { describe, it, expect } from 'vitest';
import {
  generateHiddenPlaces,
  revealNearby,
  discoveredCount,
  HIDDEN_PLACE_KINDS,
} from '../hiddenPlaces';
import { pointInPolygon, type Pt } from '../../submap/submapEngine';
import { rootSeedPath } from '../../seedPath';

const region: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]];

describe('generateHiddenPlaces', () => {
  it('scatters the requested count inside the region, all undiscovered', () => {
    const places = generateHiddenPlaces(region, rootSeedPath(42), { count: 10 });
    expect(places).toHaveLength(10);
    for (const p of places) {
      expect(pointInPolygon(p.position, region)).toBe(true);
      expect(p.discovered).toBe(false);
      expect(HIDDEN_PLACE_KINDS).toContain(p.kind);
      expect(p.discoveryRadius).toBeGreaterThan(0);
    }
  });

  it('is deterministic: same seed-path → identical places', () => {
    const a = generateHiddenPlaces(region, rootSeedPath(7), { count: 8 });
    const b = generateHiddenPlaces(region, rootSeedPath(7), { count: 8 });
    expect(a).toEqual(b);
  });

  it('different seed-paths → different scatter', () => {
    const a = generateHiddenPlaces(region, rootSeedPath(1), { count: 8 });
    const b = generateHiddenPlaces(region, rootSeedPath(2), { count: 8 });
    expect(a.map((p) => p.position)).not.toEqual(b.map((p) => p.position));
  });
});

describe('revealNearby (proximity discovery)', () => {
  const places = [
    { id: 'hp:0', kind: 'ruin' as const, position: [10, 10] as Pt, discoveryRadius: 5, name: 'Ruins', discovered: false },
    { id: 'hp:1', kind: 'cave' as const, position: [90, 90] as Pt, discoveryRadius: 5, name: 'Cave', discovered: false },
  ];

  it('reveals a place the player comes within radius of, leaves the far one hidden', () => {
    const r = revealNearby(places, [12, 11]); // ~2.2 from hp:0 (radius 5)
    expect(r.revealed.map((p) => p.id)).toEqual(['hp:0']);
    expect(r.places.find((p) => p.id === 'hp:0')!.discovered).toBe(true);
    expect(r.places.find((p) => p.id === 'hp:1')!.discovered).toBe(false);
  });

  it('is idempotent: re-checking the same spot reveals nothing new', () => {
    const first = revealNearby(places, [12, 11]);
    const second = revealNearby(first.places, [12, 11]);
    expect(second.revealed).toHaveLength(0);
    expect(discoveredCount(second.places)).toBe(1);
  });

  it('does not reveal anything when the player is far from all places', () => {
    const r = revealNearby(places, [50, 50]);
    expect(r.revealed).toHaveLength(0);
    expect(discoveredCount(r.places)).toBe(0);
  });
});
