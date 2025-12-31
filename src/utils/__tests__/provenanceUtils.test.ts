import { describe, it, expect } from 'vitest';
import { createProvenance, addProvenanceEvent, generateLegendaryHistory } from '../provenanceUtils';
import { Item, ItemType, ItemRarity } from '../../types/items';

describe('provenanceUtils', () => {
  const mockItem: Item = {
    id: 'test-item',
    name: 'Test Item',
    type: ItemType.Weapon,
    rarity: ItemRarity.Common,
    costInGp: 10,
    weight: 1,
    description: 'A test item'
  };

  describe('createProvenance', () => {
    it('should create a new provenance record with correct initial values', () => {
      const creator = 'Test Creator';
      const date = 1000;
      const originalName = 'Excalibur';

      const provenance = createProvenance(creator, date, originalName);

      expect(provenance).toEqual({
        creator,
        createdDate: date,
        originalName,
        previousOwners: [creator],
        history: [
          {
            date,
            type: 'CRAFTED',
            description: `Created by ${creator}`,
            actorId: creator
          }
        ]
      });
    });

    it('should handle missing originalName', () => {
      const creator = 'Test Creator';
      const date = 1000;

      const provenance = createProvenance(creator, date);

      expect(provenance.originalName).toBeUndefined();
    });
  });

  describe('addProvenanceEvent', () => {
    it('should add a new event to item history and maintain immutability', () => {
      const date = 2000;

      const newItem = addProvenanceEvent(
        mockItem,
        'FOUND',
        'Found in a cave',
        date,
        'Finder',
        'Cave'
      );

      // Check newItem has provenance
      expect(newItem.provenance).toBeDefined();
      expect(newItem.provenance?.history).toHaveLength(1);
      expect(newItem.provenance?.history[0]).toEqual({
        date,
        type: 'FOUND',
        description: 'Found in a cave',
        actorId: 'Finder',
        locationId: 'Cave'
      });

      // Check immutability (original item unchanged)
      expect(mockItem.provenance).toBeUndefined();
    });

    it('should append to existing provenance', () => {
      const creator = 'Maker';
      const date1 = 1000;
      const itemWithProv = {
        ...mockItem,
        provenance: createProvenance(creator, date1)
      };

      const date2 = 2000;
      const updatedItem = addProvenanceEvent(
        itemWithProv,
        'SOLD',
        'Sold to merchant',
        date2,
        'Merchant'
      );

      expect(updatedItem.provenance?.history).toHaveLength(2);
      expect(updatedItem.provenance?.history[0].type).toBe('CRAFTED');
      expect(updatedItem.provenance?.history[1].type).toBe('SOLD');
    });
  });

  describe('generateLegendaryHistory', () => {
    it('should generate a history with CRAFTED and FOUND events', () => {
      const currentDate = 1000000;

      const itemWithHistory = generateLegendaryHistory(mockItem, currentDate);

      expect(itemWithHistory.provenance).toBeDefined();
      expect(itemWithHistory.provenance?.creator).toBeDefined();
      expect(itemWithHistory.provenance?.createdDate).toBeLessThan(currentDate);
      expect(itemWithHistory.provenance?.history.length).toBeGreaterThan(1);
    });
  });
});
