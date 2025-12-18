
import { describe, it, expect } from 'vitest';
import { EntityResolverService } from '../EntityResolverService';
import { GameState } from '../../types';
import { FACTIONS } from '../../data/factions';
import { LOCATIONS } from '../../data/world/locations';

describe('EntityResolverService', () => {
  const mockState = {
    factions: { ...FACTIONS },
    dynamicLocations: {},
    // minimal state
  } as unknown as GameState;

  it('should find known factions in text', () => {
    const text = "I am a member of The Iron Ledger and I seek profit.";
    const result = EntityResolverService.resolveEntities(text, mockState);

    const factionRef = result.references.find(r => r.normalizedName === "The Iron Ledger");
    expect(factionRef).toBeDefined();
    expect(factionRef?.exists).toBe(true);
    expect(factionRef?.type).toBe('faction');
  });

  it('should find known locations in text', () => {
    // Assuming 'clearing' is a location with name "Forest Clearing"
    // The current resolver uses exact name matching or landmark templates.
    // "Forest Clearing" is the name.
    const text = "Let's meet at the Forest Clearing.";
    const result = EntityResolverService.resolveEntities(text, mockState);

    const locRef = result.references.find(r => r.normalizedName === "Forest Clearing");
    expect(locRef).toBeDefined();
    expect(locRef?.exists).toBe(true);
    expect(locRef?.type).toBe('location');
  });

  it('should flag unknown proper nouns as potential gaps', () => {
    const text = "Have you heard of the secret society called The Black Lotus?";
    const result = EntityResolverService.resolveEntities(text, mockState);

    const unknownRef = result.references.find(r => r.originalText === "The Black Lotus");
    expect(unknownRef).toBeDefined();
    expect(unknownRef?.exists).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(result.validationErrors[0]).toContain("The Black Lotus");
  });

  describe('ensureEntityExists', () => {
    it('should return existing faction if found', () => {
      const result = EntityResolverService.ensureEntityExists('faction', 'The Iron Ledger', mockState);
      expect(result.created).toBe(false);
      expect(result.entity).toBeDefined();
      expect(result.entity?.id).toBe('iron_ledger');
    });

    it('should create a new faction if missing', () => {
      const result = EntityResolverService.ensureEntityExists('faction', 'The Silver Swords', mockState);
      expect(result.created).toBe(true);
      expect(result.entity).toBeDefined();
      expect(result.entity?.name).toBe('The Silver Swords');
      // ID generation check (snake_case)
      expect(result.entity?.id).toContain('silver_swords');
    });

    it('should create a new location if missing', () => {
        const result = EntityResolverService.ensureEntityExists('location', 'Castle Ravenloft', mockState);
        expect(result.created).toBe(true);
        expect(result.entity).toBeDefined();
        expect(result.entity?.name).toBe('Castle Ravenloft');
        expect(result.entity?.id).toContain('castle_ravenloft');
        // Check default props
        expect((result.entity as any).mapCoordinates).toEqual({ x: -1, y: -1 });
    });

    it('should check dynamic locations in state', () => {
       // Mock state with a dynamic location
       const dynamicState = {
           ...mockState,
           dynamicLocations: {
               'new_place': { id: 'new_place', name: 'New Place', baseDescription: 'Desc', exits: {}, mapCoordinates: {x:0, y:0}, biomeId: 'plains' }
           }
       } as unknown as GameState;

       const result = EntityResolverService.ensureEntityExists('location', 'New Place', dynamicState);
       expect(result.created).toBe(false);
       expect(result.entity?.id).toBe('new_place');
    });
  });
});
