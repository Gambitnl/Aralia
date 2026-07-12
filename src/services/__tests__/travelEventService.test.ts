
import { describe, it, expect } from 'vitest';
import { generateTravelEvent } from '../travelEventService';
import { TRAVEL_EVENTS } from '../../data/travelEvents';
import type { TravelEvent } from '../../types/exploration';

describe('travelEventService', () => {
  it('should return null when event chance is 0', () => {
    const event = generateTravelEvent('forest', 0);
    expect(event).toBeNull();
  });

  it('should return an event when chance is 1', () => {
    const event = generateTravelEvent('forest', 1);
    expect(event).not.toBeNull();
    // It should be either a forest event or a general event
    const possibleIds = [
      ...TRAVEL_EVENTS['forest'].map(e => e.id),
      ...TRAVEL_EVENTS['general'].map(e => e.id)
    ];
    expect(possibleIds).toContain(event?.id);
  });

  it('should fallback to general events for unknown biomes', () => {
    const event = generateTravelEvent('unknown_biome_xyz', 1);
    expect(event).not.toBeNull();
    const generalIds = TRAVEL_EVENTS['general'].map(e => e.id);
    expect(generalIds).toContain(event?.id);
  });

  it('should correctly match partial biome names', () => {
    // Assuming 'forest_ancient' matches 'forest' key logic in service
    const event = generateTravelEvent('forest_ancient', 1);
    expect(event).not.toBeNull();
    const possibleIds = [
        ...TRAVEL_EVENTS['forest'].map(e => e.id),
        ...TRAVEL_EVENTS['general'].map(e => e.id)
      ];
    expect(possibleIds).toContain(event?.id);
  });
});

// ── Variant forest pools (forests task 7) ───────────────────────────────────
// Haunted/fey forests carry their own event pools. The service must pick an
// exact biome-id pool ('forest_haunted') BEFORE the partial-family fallback
// ('forest_haunted'.includes('forest')), or the variants would never fire.
describe('variant forest pools (forest_haunted / forest_fey)', () => {
  const ids = (key: string) => TRAVEL_EVENTS[key].map(e => e.id);

  /** One runtime shape assertion per event: the fields the game reads. */
  const assertEventShape = (e: TravelEvent) => {
    expect(typeof e.id).toBe('string');
    expect(e.id.length).toBeGreaterThan(0);
    expect(typeof e.description).toBe('string');
    expect(e.description.length).toBeGreaterThan(0);
    if (e.effect) {
      expect(typeof e.effect.type).toBe('string');
      expect(typeof e.effect.amount).toBe('number');
    }
    if (e.skillCheck) {
      expect(typeof e.skillCheck.check.skill).toBe('string');
      expect(typeof e.skillCheck.check.dc).toBe('number');
      expect(typeof e.skillCheck.successDescription).toBe('string');
    }
  };

  it('exact pool wins over the partial forest fallback for forest_haunted', () => {
    const allowed = new Set([...ids('forest_haunted'), ...ids('general')]);
    const forestOnly = new Set(ids('forest'));
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const event = generateTravelEvent('forest_haunted', 1);
      expect(event).not.toBeNull();
      expect(allowed.has(event!.id)).toBe(true);
      expect(forestOnly.has(event!.id)).toBe(false);
      seen.add(event!.id);
    }
    // The haunted pool actually participates (not just the general pool).
    expect(ids('forest_haunted').some(id => seen.has(id))).toBe(true);
  });

  it('exact pool wins for forest_fey too', () => {
    const allowed = new Set([...ids('forest_fey'), ...ids('general')]);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const event = generateTravelEvent('forest_fey', 1);
      expect(event).not.toBeNull();
      expect(allowed.has(event!.id)).toBe(true);
      seen.add(event!.id);
    }
    expect(ids('forest_fey').some(id => seen.has(id))).toBe(true);
  });

  it('variants WITHOUT an exact pool still fall back to the forest family', () => {
    // Intent-preserving: partial matching keeps working for un-pooled variants.
    const allowed = new Set([...ids('forest'), ...ids('general')]);
    for (let i = 0; i < 50; i++) {
      const event = generateTravelEvent('forest_ancient', 1);
      expect(event).not.toBeNull();
      expect(allowed.has(event!.id)).toBe(true);
    }
  });

  it('forest_haunted holds exactly 3 well-formed TravelEvents with the specified checks', () => {
    const pool: TravelEvent[] = TRAVEL_EVENTS['forest_haunted']; // compile-time shape check
    expect(pool).toHaveLength(3);
    pool.forEach(assertEventShape);
    const byId = new Map(pool.map(e => [e.id, e]));
    expect(byId.get('whispering_dead')?.skillCheck?.check).toEqual({ skill: 'religion', dc: 13 });
    expect(byId.get('cold_mists')?.skillCheck?.check).toEqual({ skill: 'survival', dc: 12 });
    expect(byId.get('grasping_roots')?.skillCheck?.check).toEqual({ skill: 'athletics', dc: 12 });
  });

  it('forest_fey holds exactly 3 well-formed TravelEvents; stolen_hour is a checkless flat 1h delay', () => {
    const pool: TravelEvent[] = TRAVEL_EVENTS['forest_fey']; // compile-time shape check
    expect(pool).toHaveLength(3);
    pool.forEach(assertEventShape);
    const byId = new Map(pool.map(e => [e.id, e]));
    expect(byId.get('dancing_lights')?.skillCheck?.check).toEqual({ skill: 'arcana', dc: 13 });
    expect(byId.get('mushroom_ring')?.skillCheck?.check).toEqual({ skill: 'nature', dc: 12 });
    expect(byId.get('stolen_hour')?.skillCheck).toBeUndefined();
    expect(byId.get('stolen_hour')?.effect).toEqual({ type: 'delay', amount: 1, description: '1 hour delay' });
  });
});
