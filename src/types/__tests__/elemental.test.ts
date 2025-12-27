
import { describe, it, expect } from 'vitest';
import { StateTag, StateInteractions } from '../elemental';

describe('Elemental State System', () => {
  describe('StateTag Enum', () => {
    it('should include new Webbed state', () => {
      expect(StateTag.Webbed).toBe('webbed');
    });
  });

  describe('StateInteractions', () => {
    it('should define Burning + Webbed interaction', () => {
      const result = StateInteractions['burning+webbed'];
      expect(result).toBe(StateTag.Burning);
    });

    it('should maintain existing interactions', () => {
      expect(StateInteractions['cold+wet']).toBe(StateTag.Frozen);
      expect(StateInteractions['burning+wet']).toBe(StateTag.Smoke);
    });
  });
});
