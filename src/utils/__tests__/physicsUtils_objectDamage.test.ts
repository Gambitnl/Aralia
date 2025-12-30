
import { calculateObjectDamage } from '../physicsUtils';

describe('physicsUtils - Object Damage', () => {
  const DEFAULT_IMMUNITIES = ['poison', 'psychic'];

  it('should take full damage if no resistance/immunity/threshold', () => {
    // 10 slashing damage
    const result = calculateObjectDamage(10, 'slashing');
    expect(result.finalDamage).toBe(10);
    expect(result.message).toContain('takes 10 slashing damage');
  });

  it('should take 0 damage if immune (poison)', () => {
    const result = calculateObjectDamage(20, 'poison');
    expect(result.finalDamage).toBe(0);
    expect(result.message).toContain('is immune to poison');
  });

  it('should take 0 damage if immune (psychic)', () => {
    const result = calculateObjectDamage(50, 'psychic');
    expect(result.finalDamage).toBe(0);
    expect(result.message).toContain('is immune to psychic');
  });

  it('should take 0 damage if custom immunity provided', () => {
    const result = calculateObjectDamage(20, 'fire', { threshold: 0, immunities: ['fire'] });
    expect(result.finalDamage).toBe(0);
    expect(result.message).toContain('is immune to fire');
  });

  it('should apply resistance (half damage)', () => {
    // 20 fire damage, resistant to fire
    const result = calculateObjectDamage(20, 'fire', { resistances: ['fire'] });
    expect(result.finalDamage).toBe(10);
  });

  it('should apply vulnerability (double damage)', () => {
    // 10 fire damage, vulnerable to fire
    const result = calculateObjectDamage(10, 'fire', { vulnerabilities: ['fire'] });
    expect(result.finalDamage).toBe(20);
  });

  describe('Damage Thresholds', () => {
    it('should take 0 damage if below threshold', () => {
      // 9 damage vs 10 threshold
      const result = calculateObjectDamage(9, 'slashing', { threshold: 10 });
      expect(result.finalDamage).toBe(0);
      expect(result.message).toContain('superficial');
    });

    it('should take full damage if meeting threshold', () => {
      // 10 damage vs 10 threshold
      const result = calculateObjectDamage(10, 'slashing', { threshold: 10 });
      expect(result.finalDamage).toBe(10);
    });

    it('should take full damage if exceeding threshold', () => {
      // 15 damage vs 10 threshold
      const result = calculateObjectDamage(15, 'slashing', { threshold: 10 });
      expect(result.finalDamage).toBe(15);
    });

    it('should apply resistance BEFORE threshold check', () => {
       // 20 Fire damage. Resistant (so 10). Threshold 15.
       // 10 < 15 -> 0 damage.
       const result = calculateObjectDamage(20, 'fire', { threshold: 15, resistances: ['fire'] });
       expect(result.finalDamage).toBe(0);
    });

    it('should apply resistance then check threshold (pass case)', () => {
        // 40 Fire damage. Resistant (so 20). Threshold 15.
        // 20 >= 15 -> 20 damage.
        const result = calculateObjectDamage(40, 'fire', { threshold: 15, resistances: ['fire'] });
        expect(result.finalDamage).toBe(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative damage (healing?) as 0 for this function', () => {
        const result = calculateObjectDamage(-10, 'healing');
        expect(result.finalDamage).toBe(0);
    });

    it('should respect order of operations: Resistance (halve) then Vulnerability (double)', () => {
      // 11 damage.
      // Resistance: floor(11 / 2) = 5.
      // Vulnerability: 5 * 2 = 10.
      // If done reverse: 11 * 2 = 22, / 2 = 11.
      // So 10 is the correct answer per PHB p.197.
      const result = calculateObjectDamage(11, 'fire', { resistances: ['fire'], vulnerabilities: ['fire'] });
      expect(result.finalDamage).toBe(10);
    });
  });
});
