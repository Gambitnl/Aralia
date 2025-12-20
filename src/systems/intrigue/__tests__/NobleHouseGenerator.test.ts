/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/__tests__/NobleHouseGenerator.test.ts
 * Tests for the NobleHouseGenerator.
 */

import { describe, it, expect } from 'vitest';
import { generateNobleHouse } from '../NobleHouseGenerator';
import { SecretGenerator } from '../SecretGenerator';

describe('NobleHouseGenerator', () => {
  it('should generate a valid noble house', () => {
    const house = generateNobleHouse();

    expect(house).toBeDefined();
    expect(house.type).toBe('political');
    expect(house.members.length).toBeGreaterThanOrEqual(2); // Head + Spouse
    expect(house.heraldry).toBeDefined();
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
    // Generate multiple times to ensure we hit the probability
    let foundSecrets = false;
    for (let i = 0; i < 20; i++) {
      const house = generateNobleHouse();
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
