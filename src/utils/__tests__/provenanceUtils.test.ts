
import { describe, it, expect } from 'vitest';
import { createProvenance, addProvenanceEvent, generateLegendaryHistory } from '../provenanceUtils';
import { ItemProvenance } from '../../types/provenance';
import { Item } from '../../types/items';

describe('provenanceUtils', () => {
  it('should create a new provenance record', () => {
    const creator = 'Test Smith';
    const date = 1000;
    const provenance = createProvenance(creator, date);

    expect(provenance.creator).toBe(creator);
    expect(provenance.createdDate).toBe(date);
    expect(provenance.history).toHaveLength(1);
    expect(provenance.history[0].type).toBe('CRAFTED');
  });

  it('should add a provenance event to an item', () => {
    const item: Item = {
      id: 'test-sword',
      name: 'Test Sword',
      description: 'A test sword',
      type: 'weapon',
      provenance: createProvenance('Smith', 1000)
    };

    const newItem = addProvenanceEvent(item, 'used_in_combat' as any, 'Killed a goblin', 1050, 'Hero');

    expect(newItem.provenance?.history).toHaveLength(2);
    expect(newItem.provenance?.history[1].description).toBe('Killed a goblin');
  });

  it('should generate legendary history for an item without provenance', () => {
    const item: Item = {
      id: 'ancient-sword',
      name: 'Ancient Sword',
      description: 'An old sword',
      type: 'weapon'
    };

    const legendaryItem = generateLegendaryHistory(item, 5000);

    expect(legendaryItem.provenance).toBeDefined();
    expect(legendaryItem.provenance?.creator).toBe('Ancient Smith');
    expect(legendaryItem.provenance?.history.length).toBeGreaterThan(0);
  });
});
