
import { describe, it, expect } from 'vitest';
import { checkNavigation, TERRAIN_NAVIGATION_DCS } from '../TravelNavigation';
import { SeededRandom } from '../../../utils/seededRandom';
import { TravelPace, TravelTerrain } from '../../../types/travel';

describe('TravelNavigation', () => {
  const rng = new SeededRandom(12345); // Fixed seed for drift

  describe('checkNavigation', () => {
    it('should auto-succeed on roads (DC 0)', () => {
      const result = checkNavigation(1, 'road', 'normal', false, 'N', rng);
      expect(result.success).toBe(true);
      expect(result.driftDirection).toBeNull();
    });

    it('should succeed when roll meets DC (Open Terrain)', () => {
      // Open DC is 5
      // Roll 5 + Normal(0) = 5 >= 5 -> Success
      const result = checkNavigation(5, 'open', 'normal', false, 'N', rng);
      expect(result.success).toBe(true);
    });

    it('should fail when roll is below DC (Difficult Terrain)', () => {
      // Difficult DC is 15
      // Roll 10 + Normal(0) = 10 < 15 -> Fail
      const result = checkNavigation(10, 'difficult', 'normal', false, 'N', rng);
      expect(result.success).toBe(false);
      expect(result.driftDirection).not.toBeNull();
      expect(result.driftDirection).not.toBe('N'); // Should not be intended direction
      expect(result.timePenaltyHours).toBeGreaterThan(0);
    });

    it('should apply Slow pace bonus (+5)', () => {
      // Difficult DC 15
      // Roll 10 + Slow(+5) = 15 >= 15 -> Success
      const result = checkNavigation(10, 'difficult', 'slow', false, 'N', rng);
      expect(result.success).toBe(true);
    });

    it('should apply Fast pace penalty (-5)', () => {
      // Open DC 5
      // Roll 8 + Fast(-5) = 3 < 5 -> Fail
      const result = checkNavigation(8, 'open', 'fast', false, 'N', rng);
      expect(result.success).toBe(false);
    });

    it('should apply Map/Compass bonus (+5)', () => {
      // Difficult DC 15
      // Roll 10 + Normal(0) + Map(5) = 15 >= 15 -> Success
      const result = checkNavigation(10, 'difficult', 'normal', true, 'N', rng);
      expect(result.success).toBe(true);
    });
  });
});
