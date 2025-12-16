
import { describe, it, expect } from 'vitest';
import { generateTravelEvent } from '../travelEventService';
import { TRAVEL_EVENTS } from '../../data/travelEvents';

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
