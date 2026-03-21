/**
 * ARCHITECTURAL CONTEXT:
 * This test suite validates the 'Noble House' procedural generation 
 * system. It ensures that houses are created with consistent hierarchies 
 * (Head/Spouse), valid stats, and internal 'Secrets' for the Intrigue system.
 *
 * Recent updates focus on 'Seed Predictability'. By passing an explicit 
 * incrementing seed in loops rather than relying on the system clock, 
 * the tests can reliably exercise a wide range of house configurations 
 * in a short time window.
 * 
 * @file src/systems/intrigue/__tests__/NobleHouseGenerator.test.ts
 */

import { describe, it, expect } from 'vitest';
import { generateNobleHouse } from '../NobleHouseGenerator';
import { SecretGenerator } from '../SecretGenerator';

describe('NobleHouseGenerator', () => {
  it('should generate a valid noble house', () => {
    const house = generateNobleHouse();

    expect(house).toBeDefined();
    expect(house.type).toBe('NOBLE_HOUSE');
    expect(house.members.length).toBeGreaterThanOrEqual(2); // Head + Spouse
    expect(house.colors).toBeDefined();
    expect(house.name).toContain('House');
  });

  it('should generate members with correct roles', () => {
    const house = generateNobleHouse();
    const head = house.members.find(m => m.role === 'head');
    const spouse = house.members.find(m => m.role === 'spouse');

    expect(head).toBeDefined();
    expect(spouse).toBeDefined();
    expect(head?.stats.intrigue).toBeGreaterThanOrEqual(1);
  });

  it('should assign secrets to the house or members', () => {
    // WHAT CHANGED: Switched to incrementing seeds (1000 + i).
    // WHY IT CHANGED: The generator is deterministic. If multiple 
    // calls happen in the same millisecond, they might share the 
    // same seed, leading to the same result and making the 
    // 'Probability Check' useless. Forced seed variance ensures 
    // we actually hit the 15% secret-spawn chance.
    let foundSecrets = false;
    for (let i = 0; i < 20; i++) {
      const house = generateNobleHouse('default', 1000 + i);
      if (house.houseSecrets.length > 0) {
        foundSecrets = true;
        break;
      }
    }
    expect(foundSecrets).toBe(true);
  });

  it('should ensure secrets have valid structure', () => {
    const generator = new SecretGenerator(123);
    const secret = generator.generateMemberSecret('subject-1', 'Lord Test');
    expect(secret.content).toContain('Lord Test');
    expect(secret.value).toBeGreaterThanOrEqual(1);
    expect(secret.value).toBeLessThanOrEqual(10);
    expect(secret.knownBy).toEqual([]);
  });
});
