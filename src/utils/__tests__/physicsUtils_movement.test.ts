
import { describe, it, expect } from 'vitest';
import { applyMovementCostModifiers, MovementConfig } from '../physicsUtils';

describe('applyMovementCostModifiers', () => {
  it('returns base cost for no modifiers', () => {
    const config: MovementConfig = {};
    const distance = 5;
    expect(applyMovementCostModifiers(distance, config)).toBe(5);
  });

  it('adds +1 ft/ft for difficult terrain (doubles cost)', () => {
    const config: MovementConfig = { isDifficultTerrain: true };
    const distance = 5;
    // Cost = 5 * (1 + 1) = 10
    expect(applyMovementCostModifiers(distance, config)).toBe(10);
  });

  it('adds +1 ft/ft for climbing without speed', () => {
    const config: MovementConfig = { isClimbing: true, hasClimbSpeed: false };
    const distance = 5;
    expect(applyMovementCostModifiers(distance, config)).toBe(10);
  });

  it('adds 0 extra for climbing WITH speed', () => {
    const config: MovementConfig = { isClimbing: true, hasClimbSpeed: true };
    const distance = 5;
    expect(applyMovementCostModifiers(distance, config)).toBe(5);
  });

  it('stacks difficult terrain and climbing correctly (additive)', () => {
    // 1 (base) + 1 (terrain) + 1 (climb) = 3 ft per ft
    // Total for 5 ft = 15
    const config: MovementConfig = {
      isDifficultTerrain: true,
      isClimbing: true,
      hasClimbSpeed: false
    };
    const distance = 5;
    expect(applyMovementCostModifiers(distance, config)).toBe(15);
  });
});
