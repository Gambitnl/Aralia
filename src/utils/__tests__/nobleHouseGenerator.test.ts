
import { describe, it, expect } from 'vitest';
import { generateNobleHouse, generateRegionalPolitics } from '../nobleHouseGenerator';
import { Faction } from '../../types/factions';

describe('nobleHouseGenerator', () => {
  describe('generateNobleHouse', () => {
    it('should generate a valid noble house with all required fields', () => {
      const house = generateNobleHouse({ seed: 12345 });

      expect(house.id).toBeDefined();
      expect(house.name).toBeDefined();
      expect(house.type).toBe('NOBLE_HOUSE');
      expect(house.motto).toBeDefined();
      expect(house.colors).toBeDefined();
      expect(house.ranks.length).toBeGreaterThan(0);
      expect(house.values.length).toBeGreaterThan(0);
      expect(house.hates.length).toBeGreaterThan(0);
    });

    it('should be deterministic based on seed', () => {
      const house1 = generateNobleHouse({ seed: 999 });
      const house2 = generateNobleHouse({ seed: 999 });
      const house3 = generateNobleHouse({ seed: 888 });

      expect(house1).toEqual(house2);
      expect(house1).not.toEqual(house3);
    });

    it('should generate different properties for different seeds', () => {
       // This is probabilistic, but with different seeds highly likely to be different
       const houseA = generateNobleHouse({ seed: 1 });
       const houseB = generateNobleHouse({ seed: 2 });

       // Just check name or id
       expect(houseA.name).not.toBe(houseB.name);
    });
  });

  describe('generateRegionalPolitics', () => {
    it('should generate the requested number of houses', () => {
      const houses = generateRegionalPolitics(555, 5);
      expect(houses).toHaveLength(5);
    });

    it('should establish reciprocal relationships', () => {
      const houses = generateRegionalPolitics(777, 4);

      houses.forEach(house => {
        // Check allies
        house.allies.forEach(allyId => {
           const ally = houses.find(h => h.id === allyId);
           expect(ally).toBeDefined();
           expect(ally?.allies).toContain(house.id);
        });

        // Check enemies
        house.enemies.forEach(enemyId => {
            const enemy = houses.find(h => h.id === enemyId);
            expect(enemy).toBeDefined();
            expect(enemy?.enemies).toContain(house.id);
         });

         // Check rivals
         house.rivals.forEach(rivalId => {
            const rival = houses.find(h => h.id === rivalId);
            expect(rival).toBeDefined();
            expect(rival?.rivals).toContain(house.id);
         });
      });
    });

    it('should not have self-relationships', () => {
        const houses = generateRegionalPolitics(888, 3);
        houses.forEach(house => {
            expect(house.allies).not.toContain(house.id);
            expect(house.enemies).not.toContain(house.id);
            expect(house.rivals).not.toContain(house.id);
        });
    });
  });
});
