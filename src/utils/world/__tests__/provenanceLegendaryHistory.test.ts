/**
 * @file src/utils/world/__tests__/provenanceLegendaryHistory.test.ts
 * Covers the procedural legendary-history generator added for agora-7c9e, which
 * replaced the single hardcoded 'Ancient Smith' / 'The Lost King' story.
 */
import { describe, it, expect } from 'vitest';
import { generateLegendaryHistory } from '../provenanceUtils';
import { Item, ItemType } from '../../../types/items';
import { FACTIONS } from '../../../data/factions';

const NOW = 5_000_000_000;

function makeItem(id: string, name: string, type: ItemType): Item {
  return { id, name, icon: '*', description: 'A test item.', type } as Item;
}

const sword = makeItem('legendary_sword', 'Legendary Sword', ItemType.Weapon);
const tome = makeItem('legendary_tome', 'Legendary Tome', ItemType.Book);

describe('generateLegendaryHistory (agora-7c9e)', () => {
  it('is deterministic for the same item and date', () => {
    expect(generateLegendaryHistory(sword, NOW)).toEqual(generateLegendaryHistory(sword, NOW));
  });

  it('honours an explicit seed for a caller-owned stream', () => {
    const a = generateLegendaryHistory(sword, NOW, 90210);
    const b = generateLegendaryHistory(sword, NOW, 90210);
    expect(a).toEqual(b);
    expect(a.provenance).not.toEqual(generateLegendaryHistory(sword, NOW, 90211).provenance);
  });

  it('no longer returns the retired hardcoded creator and owners', () => {
    const creators = new Set<string>();
    const owners = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const item = makeItem(`artifact_${i}`, `Artifact ${i}`, ItemType.Weapon);
      const provenance = generateLegendaryHistory(item, NOW).provenance!;
      creators.add(provenance.creator);
      provenance.previousOwners.forEach((owner) => owners.add(owner));
    }
    expect(creators.has('Ancient Smith')).toBe(false);
    expect(owners.has('The Lost King')).toBe(false);
    expect(owners.has('General Thorne')).toBe(false);
  });

  it('gives different items different histories', () => {
    const creators = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const item = makeItem(`artifact_${i}`, `Artifact ${i}`, ItemType.Weapon);
      creators.add(generateLegendaryHistory(item, NOW).provenance!.creator);
    }
    // 60 distinct items must not all share one maker.
    expect(creators.size).toBeGreaterThan(10);
  });

  it('places the forging deep in the past and keeps the history chronological', () => {
    for (let i = 0; i < 60; i++) {
      const item = makeItem(`artifact_${i}`, `Artifact ${i}`, ItemType.Armor);
      const provenance = generateLegendaryHistory(item, NOW).provenance!;

      expect(provenance.createdDate).toBeLessThan(NOW);
      expect(provenance.history.length).toBeGreaterThan(3);
      expect(provenance.history[0].type).toBe('CRAFTED');
      expect(provenance.history[provenance.history.length - 1].type).toBe('FOUND');

      for (let e = 1; e < provenance.history.length; e++) {
        expect(provenance.history[e].date).toBeGreaterThanOrEqual(provenance.history[e - 1].date);
        expect(provenance.history[e].date).toBeLessThanOrEqual(NOW);
      }
    }
  });

  it('records the creator first among previous owners and keeps them unique', () => {
    for (let i = 0; i < 40; i++) {
      const item = makeItem(`artifact_${i}`, `Artifact ${i}`, ItemType.Accessory);
      const provenance = generateLegendaryHistory(item, NOW).provenance!;
      expect(provenance.previousOwners[0]).toBe(provenance.creator);
      expect(new Set(provenance.previousOwners).size).toBe(provenance.previousOwners.length);
      expect(provenance.originalName).toBe(item.name);
    }
  });

  it('draws its powers from the real faction roster', () => {
    const factionNames = Object.values(FACTIONS).map((faction) => faction.name);
    let sawFaction = false;
    for (let i = 0; i < 80 && !sawFaction; i++) {
      const item = makeItem(`artifact_${i}`, `Artifact ${i}`, ItemType.Weapon);
      const text = generateLegendaryHistory(item, NOW)
        .provenance!.history.map((event) => event.description)
        .join(' ');
      sawFaction = factionNames.some((name) => text.includes(name));
    }
    expect(sawFaction).toBe(true);
  });

  it('gives a written work a different forging tradition from a weapon', () => {
    // Books come only from the scriptorium tradition; weapons never do.
    const weaponCreators = new Set<string>();
    const tomeCreators = new Set<string>();
    for (let i = 0; i < 40; i++) {
      weaponCreators.add(
        generateLegendaryHistory(makeItem(`w_${i}`, `Blade ${i}`, ItemType.Weapon), NOW).provenance!
          .creator
      );
      tomeCreators.add(
        generateLegendaryHistory(makeItem(`t_${i}`, `Tome ${i}`, ItemType.Book), NOW).provenance!
          .creator
      );
    }
    expect([...tomeCreators].every((name) => name.endsWith(', Archivist'))).toBe(true);
    expect([...weaponCreators].some((name) => name.endsWith(', Archivist'))).toBe(false);
  });

  it('leaves the rest of the item untouched', () => {
    const result = generateLegendaryHistory(tome, NOW);
    expect(result.id).toBe(tome.id);
    expect(result.name).toBe(tome.name);
    expect(result.type).toBe(tome.type);
    expect(tome.provenance).toBeUndefined();
  });
});
