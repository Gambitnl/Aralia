import { describe, it, expect } from 'vitest';
import { CreatureTaxonomy } from '../CreatureTaxonomy';
import { CreatureType } from '../../../types/creatures';

describe('CreatureTaxonomy', () => {
  describe('isValidTarget', () => {
    it('should validate allowed creature types (whitelist)', () => {
      // Hold Person case: Only Humanoids
      const filter = { creatureTypes: ['Humanoid'] };

      expect(CreatureTaxonomy.isValidTarget(['Humanoid'], filter)).toBe(true);
      expect(CreatureTaxonomy.isValidTarget(['Undead'], filter)).toBe(false);
      expect(CreatureTaxonomy.isValidTarget(['Humanoid', 'Shapechanger'], filter)).toBe(true);
    });

    it('should validate excluded creature types (blacklist)', () => {
      // Cure Wounds case: No Undead or Constructs
      const filter = { excludeCreatureTypes: ['Undead', 'Construct'] };

      expect(CreatureTaxonomy.isValidTarget(['Humanoid'], filter)).toBe(true);
      expect(CreatureTaxonomy.isValidTarget(['Undead'], filter)).toBe(false);
      expect(CreatureTaxonomy.isValidTarget(['Construct'], filter)).toBe(false);
      expect(CreatureTaxonomy.isValidTarget(['Beast'], filter)).toBe(true);
    });

    it('should handle mixed inclusion and exclusion', () => {
      // Complex case: Target Beasts but not Shapechangers (e.g., Moonbeam logic might care)
      const filter = {
        creatureTypes: ['Beast'],
        excludeCreatureTypes: ['Shapechanger']
      };

      expect(CreatureTaxonomy.isValidTarget(['Beast'], filter)).toBe(true);
      expect(CreatureTaxonomy.isValidTarget(['Beast', 'Shapechanger'], filter)).toBe(false);
      expect(CreatureTaxonomy.isValidTarget(['Humanoid'], filter)).toBe(false);
    });

    it('should be case insensitive', () => {
      const filter = { creatureTypes: ['humanoid'] };
      expect(CreatureTaxonomy.isValidTarget(['Humanoid'], filter)).toBe(true);
    });
  });

  describe('normalize', () => {
    it('should return correct Enum value', () => {
      expect(CreatureTaxonomy.normalize('undead')).toBe(CreatureType.Undead);
      expect(CreatureTaxonomy.normalize('HUMANOID')).toBe(CreatureType.Humanoid);
    });

    it('should return null for invalid types', () => {
      expect(CreatureTaxonomy.normalize('Robot')).toBe(null);
    });
  });
});
