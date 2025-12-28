
import { describe, it, expect } from 'vitest';
import { StateTag, StateInteractions } from '../elemental';

describe('Elemental State System', () => {
  describe('StateTag Enum', () => {
    it('should include new Webbed state', () => {
      expect(StateTag.Webbed).toBe('webbed');
    });

    it('should include new Acid state', () => {
      expect(StateTag.Acid).toBe('acid');
    });
  });

  describe('StateInteractions', () => {
    it('should define Burning + Webbed interaction', () => {
      const result = StateInteractions['burning+webbed'];
      expect(result).toBe(StateTag.Burning);
    });

    it('should define Acid + Webbed interaction', () => {
      // Acid dissolves webs
      const result = StateInteractions['acid+webbed'];
      expect(result).toBe(null);
    });

    it('should define Acid + Oiled interaction', () => {
      // Acid neutralizes oil
      const result = StateInteractions['acid+oiled'];
      expect(result).toBe(null);
    });

    it('should maintain existing interactions', () => {
      expect(StateInteractions['cold+wet']).toBe(StateTag.Frozen);
      expect(StateInteractions['burning+wet']).toBe(StateTag.Smoke);
    });
  });
});
